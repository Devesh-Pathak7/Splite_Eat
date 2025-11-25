"""Half Order Router - Enhanced with proper locking and UTC timezone handling"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime
import logging

from database import get_db
from models import User, HalfOrderSession
# NOTE: get_current_user is ONLY used for staff-level actions like cancel or internal API logic
from auth import get_current_user 
from services.half_order_service import HalfOrderService
from services.websocket_service import broadcast_event
from schemas import HalfOrderCreate, HalfOrderJoin, HalfOrderResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/half-order", tags=["Half Orders"])


@router.post("", response_model=HalfOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_half_session(
    data: HalfOrderCreate,
    restaurant_id: int,
    table_no: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    # REMOVED: current_user: User = Depends(get_current_user) -- This is now public/unauthenticated
):
    """Create a new half-order session with UTC timezone-aware expiry"""
    try:
        session = await HalfOrderService.create_half_session(
            db=db,
            restaurant_id=restaurant_id,
            table_no=table_no,
            customer_name=data.customer_name,
            customer_mobile=data.customer_mobile,
            menu_item_id=data.menu_item_id,
            # current_user is now omitted from the service call
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        await db.refresh(session)
        
        # Broadcast WebSocket event
        await broadcast_event(
            restaurant_id=restaurant_id,
            event_type="session.created",
            data={
                "session_id": session.id,
                "table_no": session.table_no,
                "menu_item_name": session.menu_item_name,
                "customer_name": session.customer_name,
                "created_at": session.created_at.isoformat(),
                "expires_at": session.expires_at.isoformat(),
                "status": session.status.value
            }
        )
        
        logger.info(f"Half-session {session.id} created and broadcast")
        return session
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating half-session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create half-session")


@router.post("/{session_id}/join", status_code=status.HTTP_200_OK)
async def join_half_session(
    session_id: int,
    data: HalfOrderJoin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    # REMOVED: current_user: User = Depends(get_current_user) -- This is now public/unauthenticated
):
    """Join a half-order session with row-level locking to prevent race conditions"""
    try:
        result = await HalfOrderService.join_half_session(
            db=db,
            session_id=session_id,
            joiner_table_no=data.table_no,
            joiner_name=data.customer_name,
            joiner_mobile=data.customer_mobile,
            # current_user is now omitted from the service call
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        
        # Get session for broadcast
        from sqlalchemy import select
        session_result = await db.execute(
            select(HalfOrderSession).where(HalfOrderSession.id == session_id)
        )
        session = session_result.scalar_one()
        
        # Broadcast WebSocket event
        await broadcast_event(
            restaurant_id=session.restaurant_id,
            event_type="session.joined",
            data={
                "session_id": session_id,
                "paired_order_id": result["paired_order_id"],
                "original_table": session.table_no,
                "joiner_table": data.table_no,
                "table_pairing": result["table_pairing"],
                "menu_item": result["menu_item"],
                "total_price": result["total_price"]
            }
        )
        
        await broadcast_event(
            restaurant_id=session.restaurant_id,
            event_type="paired.created",
            data={
                "paired_order_id": result["paired_order_id"],
                "menu_item": result["menu_item"],
                "total_price": result["total_price"],
                "status": "pending"
            }
        )
        
        # Broadcast order.created for Counter Dashboard
        if "order_id" in result:
            await broadcast_event(
                restaurant_id=session.restaurant_id,
                event_type="order.created",
                data={
                    "order_id": result["order_id"],
                    "table_no": result["table_pairing"],
                    "customer_name": f"{session.customer_name} & {data.customer_name}",
                    "total_amount": result["total_price"],
                    "status": "PENDING",
                    "order_type": "paired",
                    "created_at": datetime.now().isoformat()
                }
            )
        
        logger.info(f"Session {session_id} joined, order created, and broadcast")
        return result
        
    except ValueError as e:
        if "not active" in str(e).lower() or "expired" in str(e).lower():
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error joining session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to join session")


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
async def cancel_half_session(
    session_id: int,
    reason: str = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # KEEP: This endpoint should remain protected for staff/admin
):
    """Cancel half-order session with permission-based rules"""
    try:
        session = await HalfOrderService.cancel_half_session(
            db=db,
            session_id=session_id,
            current_user=current_user,
            reason=reason,
            ip_address=request.client.host if request.client else None
        )
        
        await db.commit()
        
        # Broadcast WebSocket event
        await broadcast_event(
            restaurant_id=session.restaurant_id,
            event_type="session.cancelled",
            data={
                "session_id": session_id,
                "table_no": session.table_no,
                "cancelled_by": current_user.username,
                "reason": reason
            }
        )
        
        logger.info(f"Session {session_id} cancelled by {current_user.username}")
        return {"message": "Session cancelled successfully", "session_id": session_id}
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cancel session")


@router.get("/active", response_model=List[HalfOrderResponse])
async def get_active_sessions(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all active half-order sessions for a restaurant (restaurant-wide)"""
    try:
        sessions = await HalfOrderService.get_active_sessions(db, restaurant_id)
        return sessions
    except Exception as e:
        logger.error(f"Error fetching active sessions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch active sessions")