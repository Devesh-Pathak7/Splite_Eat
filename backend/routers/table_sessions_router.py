"""Table Sessions Router - Manages table order sessions"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import datetime
from typing import Optional
import logging
import uuid

from database import get_db
from models import TableOrderSession, Order, Restaurant, User, OrderStatus
from auth import get_current_user, require_role
from schemas import TableOrderSessionResponse, ClearTableRequest
from services.websocket_service import broadcast_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/table-sessions", tags=["Table Sessions"])


@router.post("/clear-table")
async def clear_table(
    data: ClearTableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin", "counter_admin"]))
):
    """Clear a table by ending its active session"""
    try:
        # Find active session for this table
        result = await db.execute(
            select(TableOrderSession).where(
                and_(
                    TableOrderSession.restaurant_id == data.restaurant_id,
                    TableOrderSession.table_no == data.table_no,
                    TableOrderSession.is_active == True
                )
            )
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=404,
                detail=f"No active session found for table {data.table_no}"
            )
        
        # End the session
        session.is_active = False
        session.ended_at = datetime.now(datetime.now().astimezone().tzinfo)
        
        await db.commit()
        
        # Broadcast table cleared event
        await broadcast_event(
            restaurant_id=data.restaurant_id,
            event_type="table.cleared",
            data={
                "table_no": data.table_no,
                "session_id": session.session_id,
                "cleared_by": current_user.username
            }
        )
        
        logger.info(f"Table {data.table_no} cleared by {current_user.username}")
        
        return {
            "message": f"Table {data.table_no} cleared successfully",
            "session_id": session.session_id,
            "total_orders": session.total_orders_count,
            "total_amount": session.total_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing table: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to clear table")


@router.get("/active-orders")
async def get_active_session_orders(
    restaurant_id: int,
    table_no: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all orders in the active session for a table"""
    try:
        # Find active session
        session_result = await db.execute(
            select(TableOrderSession).where(
                and_(
                    TableOrderSession.restaurant_id == restaurant_id,
                    TableOrderSession.table_no == table_no,
                    TableOrderSession.is_active == True
                )
            )
        )
        session = session_result.scalar_one_or_none()
        
        if not session:
            return {
                "session": None,
                "orders": []
            }
        
        # Get all orders for this session
        orders_result = await db.execute(
            select(Order).where(
                Order.session_id == session.session_id
            ).order_by(Order.created_at.desc())
        )
        orders = orders_result.scalars().all()
        
        from schemas import OrderResponse
        
        return {
            "session": TableOrderSessionResponse.model_validate(session),
            "orders": [OrderResponse.model_validate(order) for order in orders]
        }
        
    except Exception as e:
        logger.error(f"Error fetching active session orders: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch orders")


@router.get("/stats/half-orders")
async def get_half_order_stats(
    restaurant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get half-order statistics (restaurant-wise and overall)"""
    try:
        from models import HalfOrderSession, PairedOrder, HalfOrderStatus
        
        stats = {}
        
        # If restaurant_id provided, get stats for that restaurant
        if restaurant_id:
            # Get restaurant details
            rest_result = await db.execute(
                select(Restaurant).where(Restaurant.id == restaurant_id)
            )
            restaurant = rest_result.scalar_one_or_none()
            
            if not restaurant:
                raise HTTPException(status_code=404, detail="Restaurant not found")
            
            # Active half-order sessions
            active_result = await db.execute(
                select(func.count(HalfOrderSession.id)).where(
                    and_(
                        HalfOrderSession.restaurant_id == restaurant_id,
                        HalfOrderSession.status == HalfOrderStatus.ACTIVE
                    )
                )
            )
            active_count = active_result.scalar() or 0
            
            # Completed paired orders
            completed_result = await db.execute(
                select(func.count(PairedOrder.id)).where(
                    PairedOrder.restaurant_id == restaurant_id
                )
            )
            completed_count = completed_result.scalar() or 0
            
            # Total join fees collected
            join_fee = restaurant.half_order_join_fee or 20.0
            total_join_fees = completed_count * join_fee
            
            # Joined today
            from models import utc_now
            today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
            joined_today_result = await db.execute(
                select(func.count(HalfOrderSession.id)).where(
                    and_(
                        HalfOrderSession.restaurant_id == restaurant_id,
                        HalfOrderSession.status == HalfOrderStatus.JOINED,
                        HalfOrderSession.joined_at >= today_start
                    )
                )
            )
            joined_today = joined_today_result.scalar() or 0
            
            stats[restaurant.name] = {
                "restaurant_id": restaurant_id,
                "restaurant_name": restaurant.name,
                "active_half_orders": active_count,
                "completed_pairings": completed_count,
                "join_fee_per_pairing": join_fee,
                "total_join_fees_collected": total_join_fees,
                "joined_today": joined_today
            }
        
        # Get overall stats (all restaurants)
        else:
            # Get all restaurants
            restaurants_result = await db.execute(select(Restaurant))
            restaurants = restaurants_result.scalars().all()
            
            overall_active = 0
            overall_completed = 0
            overall_fees = 0.0
            overall_joined_today = 0
            
            from models import utc_now
            today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            for restaurant in restaurants:
                # Active
                active_result = await db.execute(
                    select(func.count(HalfOrderSession.id)).where(
                        and_(
                            HalfOrderSession.restaurant_id == restaurant.id,
                            HalfOrderSession.status == HalfOrderStatus.ACTIVE
                        )
                    )
                )
                active = active_result.scalar() or 0
                
                # Completed
                completed_result = await db.execute(
                    select(func.count(PairedOrder.id)).where(
                        PairedOrder.restaurant_id == restaurant.id
                    )
                )
                completed = completed_result.scalar() or 0
                
                # Join fees
                join_fee = restaurant.half_order_join_fee or 20.0
                fees = completed * join_fee
                
                # Joined today
                joined_today_result = await db.execute(
                    select(func.count(HalfOrderSession.id)).where(
                        and_(
                            HalfOrderSession.restaurant_id == restaurant.id,
                            HalfOrderSession.status == HalfOrderStatus.JOINED,
                            HalfOrderSession.joined_at >= today_start
                        )
                    )
                )
                joined_today = joined_today_result.scalar() or 0
                
                stats[restaurant.name] = {
                    "restaurant_id": restaurant.id,
                    "restaurant_name": restaurant.name,
                    "active_half_orders": active,
                    "completed_pairings": completed,
                    "join_fee_per_pairing": join_fee,
                    "total_join_fees_collected": fees,
                    "joined_today": joined_today
                }
                
                overall_active += active
                overall_completed += completed
                overall_fees += fees
                overall_joined_today += joined_today
            
            stats["_overall"] = {
                "total_active_half_orders": overall_active,
                "total_completed_pairings": overall_completed,
                "total_join_fees_collected": overall_fees,
                "total_joined_today": overall_joined_today
            }
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching half-order stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch statistics")


# Import session helper functions from service
from services.table_session_service import get_or_create_session, update_session_totals
