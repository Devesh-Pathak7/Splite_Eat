"""Counter Router - Table management and counter operations"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List
import logging

from database import get_db
from models import User, Table, HalfOrderSession, Order, TableStatus, HalfOrderStatus, OrderStatus, utc_now
from auth import get_current_user, require_role
from services.websocket_service import broadcast_event
from services.audit_service import log_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/counter", tags=["Counter Management"])


@router.get("/tables")
async def get_tables_status(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin", "staff"]))
):
    """Get all tables with current status for a restaurant"""
    try:
        # Get tables
        result = await db.execute(
            select(Table).where(Table.restaurant_id == restaurant_id)
        )
        tables = result.scalars().all()
        
        tables_data = []
        for table in tables:
            # Check active sessions
            session_result = await db.execute(
                select(func.count(HalfOrderSession.id)).where(
                    and_(
                        HalfOrderSession.restaurant_id == restaurant_id,
                        HalfOrderSession.table_no == table.table_no,
                        HalfOrderSession.status == HalfOrderStatus.ACTIVE
                    )
                )
            )
            active_sessions = session_result.scalar()
            
            # Check active orders
            order_result = await db.execute(
                select(func.count(Order.id)).where(
                    and_(
                        Order.restaurant_id == restaurant_id,
                        Order.table_no == table.table_no,
                        Order.status.in_([OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY])
                    )
                )
            )
            active_orders = order_result.scalar()
            
            # Determine status
            if active_orders > 0:
                computed_status = "OCCUPIED"
            elif active_sessions > 0:
                computed_status = "RESERVED"
            else:
                computed_status = "AVAILABLE"
            
            # Update table status if changed
            if table.status.value != computed_status:
                table.status = TableStatus[computed_status]
                if computed_status == "OCCUPIED":
                    table.occupied_since = utc_now()
                else:
                    table.occupied_since = None
                table.last_updated = utc_now()
                
                # Broadcast status change
                await broadcast_event(
                    restaurant_id=restaurant_id,
                    event_type="table.status_changed",
                    data={
                        "table_id": table.id,
                        "table_no": table.table_no,
                        "old_status": table.status.value,
                        "new_status": computed_status
                    }
                )
            
            tables_data.append({
                "id": table.id,
                "table_no": table.table_no,
                "capacity": table.capacity,
                "status": computed_status,
                "active_sessions": active_sessions,
                "active_orders": active_orders,
                "occupied_since": table.occupied_since.isoformat() if table.occupied_since else None,
                "qr_code": table.qr_code
            })
        
        await db.commit()
        
        return {
            "tables": tables_data,
            "summary": {
                "total": len(tables),
                "available": len([t for t in tables_data if t["status"] == "AVAILABLE"]),
                "occupied": len([t for t in tables_data if t["status"] == "OCCUPIED"]),
                "reserved": len([t for t in tables_data if t["status"] == "RESERVED"])
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching table status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch table status")


@router.get("/dashboard-stats")
async def get_counter_dashboard_stats(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin", "staff"]))
):
    """Get real-time statistics for counter dashboard"""
    try:
        now_utc = utc_now()
        today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Active orders
        active_orders_result = await db.execute(
            select(func.count(Order.id)).where(
                and_(
                    Order.restaurant_id == restaurant_id,
                    Order.status.in_([OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY])
                )
            )
        )
        active_orders = active_orders_result.scalar()
        
        # Today's revenue
        revenue_result = await db.execute(
            select(func.sum(Order.total_amount)).where(
                and_(
                    Order.restaurant_id == restaurant_id,
                    Order.created_at >= today_start,
                    Order.status != OrderStatus.CANCELLED
                )
            )
        )
        today_revenue = revenue_result.scalar() or 0
        
        # Active half-orders
        half_orders_result = await db.execute(
            select(func.count(HalfOrderSession.id)).where(
                and_(
                    HalfOrderSession.restaurant_id == restaurant_id,
                    HalfOrderSession.status == HalfOrderStatus.ACTIVE,
                    HalfOrderSession.expires_at > now_utc
                )
            )
        )
        active_half_orders = half_orders_result.scalar()
        
        return {
            "active_orders": active_orders,
            "today_revenue": float(today_revenue),
            "active_half_orders": active_half_orders,
            "timestamp": now_utc.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")