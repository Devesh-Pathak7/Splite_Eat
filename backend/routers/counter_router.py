"""Counter Router - Table management and counter operations"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from typing import List
import logging

from database import get_db
from models import User, Table, HalfOrderSession, Order, TableStatus, HalfOrderStatus, PairedOrder, PairedOrderStatus, utc_now
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
                        Order.status.in_(["PENDING", "PREPARING", "READY"])
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
                    Order.status.in_(["PENDING", "PREPARING", "READY"])
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


@router.post("/close-session/{table_no}")
async def close_table_session(
    table_no: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["counter_admin", "super_admin"]))
):
    """Close table session and free table(s) for reuse"""
    try:
        # 1) Decode the path parameter (URL-encoded like "T21%2BT22" → "T21+T22")
        decoded_table_no = table_no.replace("%2B", "+").replace("%20", " ").strip()

        # 2) Detect table grouping
        if "+" in decoded_table_no:
            table_nos = [t.strip() for t in decoded_table_no.split("+") if t.strip()]
        else:
            table_nos = [decoded_table_no]

        logger.info(f"Closing session for tables: {table_nos}")

        # 3) Load involved tables safely - log warnings for missing tables but continue
        tables = []
        for tbl_no in table_nos:
            table_result = await db.execute(
                select(Table).where(
                    and_(
                        Table.restaurant_id == current_user.restaurant_id,
                        Table.table_no == tbl_no
                    )
                )
            )
            table = table_result.scalar_one_or_none()
            if not table:
                logger.warning(f"Table {tbl_no} not found for restaurant {current_user.restaurant_id} — continuing clear session")
                continue
            tables.append(table)

        # 4) Perform updates normally (no transaction context manager)
        # For each table: set status = "AVAILABLE", is_occupied = false
        for table in tables:
            table.status = TableStatus.AVAILABLE
            table.is_occupied = False
            table.occupied_since = None
            table.last_updated = utc_now()

        # 5) Mark ALL orders on these tables as SESSION_CLOSED (not just completed ones)
        # Include both individual table numbers and the paired table string
        table_identifiers = table_nos + ([decoded_table_no] if "+" in decoded_table_no else [])
        await db.execute(
            update(Order)
            .where(Order.restaurant_id == current_user.restaurant_id)
            .where(Order.table_no.in_(table_identifiers))
            .where(Order.status != "SESSION_CLOSED")  # Don't update already closed orders
            .values(status="SESSION_CLOSED")
        )

        # 5.1) Mark related PairedOrder records as COMPLETED
        # Find PairedOrder records related to the cleared tables via their sessions
        from sqlalchemy import or_
        paired_order_conditions = [
            PairedOrder.restaurant_id == current_user.restaurant_id,
            ~PairedOrder.status.in_([
                PairedOrderStatus.COMPLETED,
                PairedOrderStatus.CANCELLED
            ])
        ]
        
        # Join with HalfOrderSession to find paired orders on cleared tables
        session_subquery = select(HalfOrderSession.id).where(
            and_(
                HalfOrderSession.restaurant_id == current_user.restaurant_id,
                HalfOrderSession.table_no.in_(table_identifiers)
            )
        )
        
        paired_order_conditions.append(
            or_(
                PairedOrder.half_session_a.in_(session_subquery),
                PairedOrder.half_session_b.in_(session_subquery)
            )
        )
        
        await db.execute(
            update(PairedOrder)
            .where(and_(*paired_order_conditions))
            .values(status=PairedOrderStatus.COMPLETED, completed_at=utc_now())
        )

        # 6) Close related session records
        if "+" in decoded_table_no:
            # Handle HALF+HALF paired session
            session_result = await db.execute(
                select(HalfOrderSession).where(
                    and_(
                        HalfOrderSession.restaurant_id == current_user.restaurant_id,
                        HalfOrderSession.table_no == decoded_table_no,
                        HalfOrderSession.status == HalfOrderStatus.ACTIVE
                    )
                )
            )
            session = session_result.scalar_one_or_none()
            if session:
                session.status = HalfOrderStatus.COMPLETED
                logger.info(f"Completed paired session {session.id} for {decoded_table_no}")
        else:
            # Handle FULL order session - mark any active sessions as completed
            session_result = await db.execute(
                select(HalfOrderSession).where(
                    and_(
                        HalfOrderSession.restaurant_id == current_user.restaurant_id,
                        HalfOrderSession.table_no == decoded_table_no,
                        HalfOrderSession.status == HalfOrderStatus.ACTIVE
                    )
                )
            )
            active_sessions = session_result.scalars().all()
            for session in active_sessions:
                session.status = HalfOrderStatus.COMPLETED
                logger.info(f"Completed full session {session.id} for {decoded_table_no}")

        # Commit all changes
        await db.commit()

        # 7) Broadcast WebSocket event
        broadcast_tables = table_nos.copy()
        if "+" in decoded_table_no:
            broadcast_tables.append(decoded_table_no)  # Include the full paired string like "T30+T32"
        
        await broadcast_event(
            restaurant_id=current_user.restaurant_id,
            event_type="table_session_cleared",
            data={
                "tables": broadcast_tables,
                "cleared_at": utc_now().isoformat()
            }
        )

        # 8) Return success JSON
        return {
            "tables": table_nos,
            "status": "cleared"
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # 9) Safe error handling - log details, return 500
        logger.error(f"Error closing table session {table_no}: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to close table session"
        )