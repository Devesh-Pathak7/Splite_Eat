"""Orders Router - Enhanced with paired order completion and CSV export"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import csv
import io
import logging

from database import get_db
from models import User, Order, OrderStatus, utc_now
from auth import get_current_user, require_role
from services.order_service import OrderService
from services.websocket_service import broadcast_event
from schemas import OrderCreate, OrderResponse, OrderUpdateStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.get("/half-orders/stats")
async def get_half_order_stats(
    restaurant_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"]))
):
    """Get half-order statistics"""
    from sqlalchemy import select, func
    
    query = select(
        func.count(PairedOrder.id).label("half_count"),
        func.sum(PairedOrder.join_fee).label("join_fee_total")
    ).select_from(PairedOrder)
    
    if restaurant_id:
        query = query.where(PairedOrder.restaurant_id == restaurant_id)
    
    result = await db.execute(query)
    row = result.first()
    
    return {
        "half_count": row.half_count or 0,
        "join_fee_total": float(row.join_fee_total or 0)
    }


@router.get("/tables/{table_no}/active-orders")
async def get_table_active_orders(
    table_no: str,
    restaurant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get active session and orders for a table"""
    from services.session_service import SessionService
    from sqlalchemy import select
    
    session = await SessionService.get_active_session_for_table(db, restaurant_id, table_no)
    
    orders = []
    if session:
        result = await db.execute(
            select(Order).where(Order.session_id == session.id)
        )
        orders = result.scalars().all()
    
    return {
        "session": {"id": session.id, "table_no": session.table_no, "started_at": session.started_at.isoformat()} if session else None,
        "orders": [OrderResponse.model_validate(o) for o in orders]
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create order with support for paired orders (half + full items)"""
    try:
        result = await OrderService.create_order_with_paired(
            db=db,
            restaurant_id=data.restaurant_id,
            table_no=data.table_no,
            customer_name=data.customer_name,
            phone=data.phone,
            items=data.items,
            paired_order_ids=data.paired_order_ids if hasattr(data, 'paired_order_ids') else None,
            current_user=current_user,
            ip_address=request.client.host if request.client else None,
            idempotency_key=data.idempotency_key if hasattr(data, 'idempotency_key') else None
        )
        
        await db.commit()
        
        # Broadcast with session_id
        from services.websocket_service import broadcast_event
        await broadcast_event(
            restaurant_id=data.restaurant_id,
            event_type="order.created",
            data={
                "order_id": result.get("order_id"),
                "session_id": result.get("session_id"),
                "table_no": data.table_no,
                "status": "PENDING"
            }
        )
        
        # Broadcast paired completion if any
        if result.get("paired_orders_completed"):
            for paired in result["paired_orders_completed"]:
                await broadcast_event(
                    restaurant_id=data.restaurant_id,
                    event_type="paired.completed",
                    data=paired
                )
        
        logger.info(f"Order {result['order_id']} created with {len(data.items)} items")
        return result
        
    except ValueError as e:
        logger.error(f"Validation error creating order: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating order: {str(e)}", exc_info=True)
        # Return the actual error message for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@router.get("", response_model=dict)
async def get_orders(
    restaurant_id: Optional[int] = None,
    period: str = Query("today", regex="^(today|last_7|month|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin", "staff"]))
):
    """Get orders with flexible filtering"""
    try:
        # Build query conditions
        conditions = []
        
        # Restaurant filter (based on user role)
        if current_user.role.value == "super_admin":
            if restaurant_id:
                conditions.append(Order.restaurant_id == restaurant_id)
        else:
            # Counter admin/staff can only see their restaurant
            if current_user.restaurant_id:
                conditions.append(Order.restaurant_id == current_user.restaurant_id)
            else:
                raise HTTPException(status_code=403, detail="User not assigned to a restaurant")
        
        # Date filtering
        now_utc = utc_now()
        if period == "today":
            start_of_day = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
            conditions.append(Order.created_at >= start_of_day)
        elif period == "last_7":
            seven_days_ago = now_utc - timedelta(days=7)
            conditions.append(Order.created_at >= seven_days_ago)
        elif period == "month":
            start_of_month = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            conditions.append(Order.created_at >= start_of_month)
        elif period == "custom":
            if start_date:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                conditions.append(Order.created_at >= start_dt)
            if end_date:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                conditions.append(Order.created_at <= end_dt)
        
        # Status filter
        if status_filter:
            conditions.append(Order.status == OrderStatus[status_filter])
        
        # Count total
        count_query = select(func.count(Order.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Get paginated orders
        query = select(Order).order_by(Order.created_at.desc())
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.limit(page_size).offset((page - 1) * page_size)
        result = await db.execute(query)
        orders = result.scalars().all()
        
        # Import schema
        from schemas import OrderResponse
        
        return {
            "orders": [OrderResponse.model_validate(order) for order in orders],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch orders")


@router.get("/export")
async def export_orders_csv(
    restaurant_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin"]))
):
    """Export orders as CSV"""
    try:
        # Build query
        conditions = []
        
        if current_user.role.value == "super_admin":
            if restaurant_id:
                conditions.append(Order.restaurant_id == restaurant_id)
        else:
            if current_user.restaurant_id:
                conditions.append(Order.restaurant_id == current_user.restaurant_id)
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            conditions.append(Order.created_at >= start_dt)
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            conditions.append(Order.created_at <= end_dt)
        
        query = select(Order).order_by(Order.created_at.desc())
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await db.execute(query)
        orders = result.scalars().all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Order ID', 'Restaurant ID', 'Table No', 'Customer Name', 
            'Phone', 'Total Amount', 'Status', 'Created At', 
            'Sent to Kitchen', 'Cancelled At'
        ])
        
        # Data rows
        for order in orders:
            writer.writerow([
                order.id,
                order.restaurant_id,
                order.table_no,
                order.customer_name,
                order.phone,
                f"₹{order.total_amount:.2f}",
                order.status.value,
                order.created_at.isoformat(),
                order.sent_to_kitchen_at.isoformat() if order.sent_to_kitchen_at else '',
                order.cancelled_at.isoformat() if order.cancelled_at else ''
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=orders_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting orders: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to export orders")


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int,
    data: OrderUpdateStatus,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin", "staff"]))
):
    """Update order status"""
    try:
        order = await OrderService.update_order_status(
            db=db,
            order_id=order_id,
            new_status=data.status,
            current_user=current_user,
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        await db.refresh(order)
        
        # Broadcast WebSocket event
        await broadcast_event(
            restaurant_id=order.restaurant_id,
            event_type="order.status_updated",
            data={
                "order_id": order_id,
                "status": order.status.value,
                "table_no": order.table_no
            }
        )
        
        return order
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating order: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update order")


@router.post("/{order_id}/send-to-kitchen")
async def send_order_to_kitchen(
    order_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin"]))
):
    """Send order to kitchen"""
    try:
        order = await OrderService.send_to_kitchen(
            db=db,
            order_id=order_id,
            current_user=current_user,
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        
        # Broadcast counter alert
        await broadcast_event(
            restaurant_id=order.restaurant_id,
            event_type="counter.alert",
            data={
                "type": "order_to_kitchen",
                "order_id": order_id,
                "table_no": order.table_no,
                "sent_by": current_user.username
            }
        )
        
        return {"message": "Order sent to kitchen", "order_id": order_id}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending to kitchen: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to send to kitchen")


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    reason: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin"]))
):
    """Cancel an order"""
    try:
        order = await OrderService.cancel_order(
            db=db,
            order_id=order_id,
            current_user=current_user,
            reason=reason,
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        
        # Broadcast event
        await broadcast_event(
            restaurant_id=order.restaurant_id,
            event_type="order.cancelled",
            data={
                "order_id": order_id,
                "table_no": order.table_no,
                "cancelled_by": current_user.username,
                "reason": reason
            }
        )
        
        return {"message": "Order cancelled", "order_id": order_id}
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling order: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cancel order")


@router.post("/{order_id}/reopen")
async def reopen_order(
    order_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin"]))
):
    """Reopen a cancelled order"""
    try:
        order = await OrderService.reopen_order(
            db=db,
            order_id=order_id,
            current_user=current_user,
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        
        # Broadcast event
        await broadcast_event(
            restaurant_id=order.restaurant_id,
            event_type="order.reopened",
            data={
                "order_id": order_id,
                "table_no": order.table_no,
                "reopened_by": current_user.username
            }
        )
        
        return {"message": "Order reopened", "order_id": order_id}
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reopening order: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reopen order")