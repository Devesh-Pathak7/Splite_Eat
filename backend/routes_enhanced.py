from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import os
import json

from database import get_db
from models import (
    User, Restaurant, MenuItem, HalfOrderSession, Order, AuditLog, ErrorLog,
    UserRole, HalfOrderStatus, RestaurantType, MenuItemType, AuditAction
)
from models import PairedOrder, PairedOrderStatus
from schemas import (
    OverrideLoginRequest, TokenResponse, UserResponse,
    AuditLogResponse, ErrorLogResponse, HalfOrderJoin, HalfOrderResponse
)
from schemas import UserCreate
from auth import (
    create_access_token, get_current_user, require_role,
    log_audit, check_restaurant_access
)

router = APIRouter(prefix="/api")

# ============ SUPER ADMIN OVERRIDE LOGIN ============
@router.post("/system/override-login", response_model=TokenResponse)
async def override_login(
    request: Request,
    override_data: OverrideLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Emergency override login for super admin access"""
    OVERRIDE_KEY = os.getenv("SUPER_ADMIN_OVERRIDE_KEY", "")
    
    if not OVERRIDE_KEY or override_data.override_key != OVERRIDE_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid override key"
        )
    
    # Get target user
    result = await db.execute(select(User).where(User.username == override_data.target_username))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log override login
    client_ip = request.client.host if request.client else "unknown"
    await log_audit(
        db=db,
        user=user,
        action=AuditAction.OVERRIDE_LOGIN,
        details=f"Override login from IP: {client_ip}",
        ip_address=client_ip
    )
    
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# ============ AUDIT LOGS ============
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = 100,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Get audit logs (Super admin only)"""
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(skip)
    )
    return result.scalars().all()

# ============ ERROR LOGS ============
@router.get("/error-logs", response_model=List[ErrorLogResponse])
async def get_error_logs(
    limit: int = 100,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Get error logs (Super admin only)"""
    result = await db.execute(
        select(ErrorLog)
        .order_by(ErrorLog.created_at.desc())
        .limit(limit)
        .offset(skip)
    )
    return result.scalars().all()

# ============ ENHANCED HALF-ORDER ROUTES ============
@router.get("/restaurants/{restaurant_id}/half-orders/all", response_model=List[HalfOrderResponse])
async def get_all_restaurant_half_orders(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all active half-orders for entire restaurant (visible to all tables)"""
    result = await db.execute(
        select(HalfOrderSession).where(
            HalfOrderSession.restaurant_id == restaurant_id,
            HalfOrderSession.status == HalfOrderStatus.ACTIVE,
            HalfOrderSession.expires_at > datetime.now(timezone.utc)
        ).order_by(HalfOrderSession.created_at.desc())
    )
    return result.scalars().all()

@router.post("/half-orders/{session_id}/join-enhanced")
async def join_half_order_enhanced(
    session_id: int,
    join_data: HalfOrderJoin,
    db: AsyncSession = Depends(get_db)
):
    """Enhanced join with race condition handling and table tracking"""
    # Use row-level locking to prevent race conditions
    result = await db.execute(
        select(HalfOrderSession)
        .where(HalfOrderSession.id == session_id)
        .with_for_update()
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Half order session not found")
    
    # Check if already joined
    if session.status != HalfOrderStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="This half order has already been matched or expired"
        )
    
    # Check expiry
    if session.expires_at < datetime.now(timezone.utc):
        session.status = HalfOrderStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=400, detail="Half order session has expired")
    
    # Get menu item for pricing
    result = await db.execute(select(MenuItem).where(MenuItem.id == session.menu_item_id))
    menu_item = result.scalar_one_or_none()
    
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Update session with joiner info
    session.status = HalfOrderStatus.JOINED
    session.joined_by_table_no = join_data.table_no
    session.joined_by_customer_name = join_data.customer_name
    session.joined_at = datetime.now(timezone.utc)
    
    # Create combined order
    total_amount = menu_item.half_price * 2 if menu_item.half_price else menu_item.price
    items = json.dumps([{
        "menu_item_id": session.menu_item_id,
        "name": session.menu_item_name,
        "quantity": 1,
        "price": total_amount,
        "type": "half_order"
    }])
    
    order = Order(
        restaurant_id=session.restaurant_id,
        table_no=f"{session.table_no} + {join_data.table_no}",
        customer_name=f"{session.customer_name} & {join_data.customer_name}",
        phone=join_data.customer_mobile,
        items=items,
        total_amount=total_amount
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    return {
        "message": "Successfully joined half order",
        "order_id": order.id,
        "table_pairing": f"Table {session.table_no} + Table {join_data.table_no}",
        "total_amount": total_amount
    }

# ============ SUPER ADMIN ANALYTICS ============
@router.get("/analytics/super-admin-overview")
async def get_super_admin_analytics(
    restaurant_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant_type: Optional[str] = None,
    item_type: Optional[str] = None,
    meal_time: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Comprehensive analytics for super admin"""
    
    # Build query conditions
    conditions = []

    # Parse start/end once and make end_date inclusive for date-only input
    start_dt = None
    end_dt = None
    if start_date:
        # if time component present, respect it; otherwise assume start of day UTC
        if 'T' in start_date:
            start_dt = datetime.fromisoformat(start_date)
        else:
            start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)

    if end_date:
        # if time component present, respect it; otherwise treat end as end-of-day UTC (inclusive)
        if 'T' in end_date:
            end_dt = datetime.fromisoformat(end_date)
        else:
            end_dt = datetime.fromisoformat(end_date)
            end_dt = end_dt.replace(tzinfo=timezone.utc) + timedelta(days=1) - timedelta(microseconds=1)

    # When comparing against SQL CONVERT_TZ(...) (which yields a naive DATETIME
    # in the database's timezone), convert the parsed start/end datetimes to
    # IST and strip tzinfo so the bound parameters are naive and comparable.
    IST = timezone(timedelta(hours=5, minutes=30))
    def _to_ist_naive(dt: Optional[datetime]):
        if not dt:
            return None
        # Ensure we interpret the value as UTC when tzinfo is missing
        if dt.tzinfo is None:
            dt_utc = dt.replace(tzinfo=timezone.utc)
        else:
            dt_utc = dt.astimezone(timezone.utc)
        dt_ist = dt_utc.astimezone(IST)
        return dt_ist.replace(tzinfo=None)

    start_dt_ist = _to_ist_naive(start_dt)
    end_dt_ist = _to_ist_naive(end_dt)

    if restaurant_id:
        conditions.append(Order.restaurant_id == restaurant_id)

    if start_dt_ist:
        # convert stored UTC timestamps to IST for filtering so frontend (IST) semantics match
        conditions.append(func.convert_tz(Order.created_at, '+00:00', '+05:30') >= start_dt_ist)

    if end_dt_ist:
        conditions.append(func.convert_tz(Order.created_at, '+00:00', '+05:30') <= end_dt_ist)
    
    # Total revenue
    revenue_query = select(func.sum(Order.total_amount))
    if conditions:
        revenue_query = revenue_query.where(and_(*conditions))
    result = await db.execute(revenue_query)
    total_revenue = result.scalar() or 0
    
    # Total orders
    orders_query = select(func.count(Order.id))
    if conditions:
        orders_query = orders_query.where(and_(*conditions))
    result = await db.execute(orders_query)
    total_orders = result.scalar() or 0
    
    # Average order value
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    
    # Active half orders
    half_orders_query = select(func.count(HalfOrderSession.id)).where(
        HalfOrderSession.status == HalfOrderStatus.ACTIVE
    )
    if restaurant_id:
        half_orders_query = half_orders_query.where(HalfOrderSession.restaurant_id == restaurant_id)
    result = await db.execute(half_orders_query)
    active_half_orders = result.scalar() or 0

    # Half+Half joined (paired orders completed)
    paired_query = select(func.count(PairedOrder.id)).where(PairedOrder.status == PairedOrderStatus.COMPLETED)
    if restaurant_id:
        paired_query = paired_query.where(PairedOrder.restaurant_id == restaurant_id)
    if start_dt_ist:
        paired_query = paired_query.where(func.convert_tz(PairedOrder.completed_at, '+00:00', '+05:30') >= start_dt_ist)
    if end_dt_ist:
        paired_query = paired_query.where(func.convert_tz(PairedOrder.completed_at, '+00:00', '+05:30') <= end_dt_ist)
    result = await db.execute(paired_query)
    paired_count = int(result.scalar() or 0)

    # Fallback / augmentation: count Orders that contain a half-order item
    # and are completed (or served), but are not already represented in paired_orders (by order_id).
    orders_paired_query = select(func.count(Order.id))
    conds = [Order.items.like('%half_order%')]
    # Only count orders that reached SERVED, COMPLETED, or SESSION_CLOSED
    conds.append(Order.status.in_(["SERVED", "COMPLETED", "SESSION_CLOSED"]))
    if restaurant_id:
        conds.append(Order.restaurant_id == restaurant_id)
    if start_dt_ist:
        conds.append(func.convert_tz(Order.created_at, '+00:00', '+05:30') >= start_dt_ist)
    if end_dt_ist:
        conds.append(func.convert_tz(Order.created_at, '+00:00', '+05:30') <= end_dt_ist)

    # Exclude any orders already referenced by PairedOrder.order_id
    subq = select(PairedOrder.order_id).where(PairedOrder.order_id != None)
    orders_paired_query = orders_paired_query.where(and_(*conds)).where(~Order.id.in_(subq))
    result = await db.execute(orders_paired_query)
    fallback_count = int(result.scalar() or 0)

    # Total joined = paired table completed + completed orders fallback
    half_half_joined = paired_count + fallback_count

    # Half+Half commission: fixed per-join amount (in rupees), configurable via env var
    PER_JOIN_RUPEES = float(os.getenv('HALF_ORDER_COMMISSION_RUPEES', '20'))
    half_half_commission = float(half_half_joined * PER_JOIN_RUPEES)
    
    # Total customers served (unique customers)
    customers_query = select(func.count(func.distinct(Order.customer_name)))
    if conditions:
        customers_query = customers_query.where(and_(*conditions))
    result = await db.execute(customers_query)
    total_customers = result.scalar() or 0
    
    # Restaurant stats
    restaurant_stats = []
    restaurants_result = await db.execute(select(Restaurant))
    restaurants = restaurants_result.scalars().all()
    
    for rest in restaurants:
        rest_conditions = [Order.restaurant_id == rest.id] + conditions
        
        # Revenue for this restaurant
        rest_revenue_query = select(func.sum(Order.total_amount)).where(and_(*rest_conditions))
        result = await db.execute(rest_revenue_query)
        rest_revenue = result.scalar() or 0
        
        # Orders for this restaurant
        rest_orders_query = select(func.count(Order.id)).where(and_(*rest_conditions))
        result = await db.execute(rest_orders_query)
        rest_orders = result.scalar() or 0
        
        # Active tables
        tables_query = select(func.count(func.distinct(Order.table_no))).where(
            Order.restaurant_id == rest.id,
            Order.status.in_(["PENDING", "PREPARING", "READY"])
        )
        result = await db.execute(tables_query)
        active_tables = result.scalar() or 0
        
        restaurant_stats.append({
            "restaurant_id": rest.id,
            "name": rest.name,
            "type": rest.type.value,
            "revenue": float(rest_revenue),
            "orders": rest_orders,
            "active_tables": active_tables
        })
    
    # Sort by revenue
    restaurant_stats.sort(key=lambda x: x['revenue'], reverse=True)
    
    return {
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "average_order_value": float(avg_order_value),
        "active_half_orders": active_half_orders,
        "half_half_joined": half_half_joined,
        "half_half_commission": half_half_commission,
        "total_customers": total_customers,
        "top_restaurants": restaurant_stats[:5],
        "all_restaurants": restaurant_stats
    }


# ============ USER MANAGEMENT (SUPER ADMIN) ============
@router.get('/users', response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    result = await db.execute(select(User))
    return result.scalars().all()


@router.post('/users', response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    # Only allow counter_admin creation via this endpoint
    if user_in.role != UserRole.COUNTER_ADMIN:
        raise HTTPException(status_code=400, detail='Role must be counter_admin')

    # Counter admin must be assigned to exactly one restaurant
    if user_in.role == UserRole.COUNTER_ADMIN and not user_in.restaurant_id:
        raise HTTPException(
            status_code=400,
            detail='Counter Admin users must be assigned to a single restaurant.'
        )

    # Hash password
    from auth import get_password_hash
    hashed = get_password_hash(user_in.password)

    new_user = User(username=user_in.username, password=hashed, role=user_in.role, restaurant_id=user_in.restaurant_id)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.delete('/users/{user_id}')
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    result = await db.execute(select(User).where(User.id == user_id))
    user_obj = result.scalar_one_or_none()
    if not user_obj:
        raise HTTPException(status_code=404, detail='User not found')
    await db.delete(user_obj)
    await db.commit()
    return {"detail": "User deleted"}

# ============ MENU VALIDATION BY RESTAURANT TYPE ============
async def validate_menu_item_type(restaurant_id: int, item_type: MenuItemType, db: AsyncSession):
    """Validate menu item type matches restaurant type"""
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant.type == RestaurantType.VEG and item_type == MenuItemType.NON_VEG:
        raise HTTPException(
            status_code=400,
            detail="Cannot add non-veg items to a pure veg restaurant"
        )
    
    if restaurant.type == RestaurantType.NON_VEG and item_type == MenuItemType.VEG:
        raise HTTPException(
            status_code=400,
            detail="Cannot add veg items to a pure non-veg restaurant"
        )
    
    return True