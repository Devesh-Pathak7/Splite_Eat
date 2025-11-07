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
    UserRole, HalfOrderStatus, OrderStatus, RestaurantType, MenuItemType, AuditAction
)
from schemas import (
    OverrideLoginRequest, TokenResponse, UserResponse,
    AuditLogResponse, ErrorLogResponse, HalfOrderJoin, HalfOrderResponse
)
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
    
    if restaurant_id:
        conditions.append(Order.restaurant_id == restaurant_id)
    
    if start_date:
        start = datetime.fromisoformat(start_date)
        conditions.append(Order.created_at >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date)
        conditions.append(Order.created_at <= end)
    
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
            Order.status.in_([OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY])
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
        "total_customers": total_customers,
        "top_restaurants": restaurant_stats[:5],
        "all_restaurants": restaurant_stats
    }

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