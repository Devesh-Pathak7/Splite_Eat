"""Half Order Service - Handles half-order creation, joining, and pairing with proper locking"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import logging
import os

from models import (
    HalfOrderSession, PairedOrder, MenuItem, User,
    HalfOrderStatus, PairedOrderStatus, utc_now
)
from services.audit_service import log_audit

logger = logging.getLogger(__name__)

HALF_ORDER_TTL_MINUTES = int(os.getenv('HALF_ORDER_TTL_MINUTES', '30'))
CUSTOMER_CANCEL_WINDOW_MINUTES = int(os.getenv('CUSTOMER_CANCEL_WINDOW_MINUTES', '5'))


class HalfOrderService:
    
    @staticmethod
    async def create_half_session(
        db: AsyncSession,
        restaurant_id: int,
        table_no: str,
        customer_name: str,
        customer_mobile: str,
        menu_item_id: int,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> HalfOrderSession:
        """Create a new half-order session with UTC timezone-aware datetimes"""
        
        # Get menu item details
        result = await db.execute(
            select(MenuItem).where(MenuItem.id == menu_item_id)
        )
        menu_item = result.scalar_one_or_none()
        
        if not menu_item:
            raise ValueError(f"Menu item {menu_item_id} not found")
        
        if not menu_item.half_price:
            raise ValueError(f"Menu item {menu_item.name} does not support half orders")
        
        # Calculate expiry with UTC timezone
        now_utc = utc_now()
        expires_at_utc = now_utc + timedelta(minutes=HALF_ORDER_TTL_MINUTES)
        
        # Create session
        session = HalfOrderSession(
            restaurant_id=restaurant_id,
            table_no=table_no,
            customer_name=customer_name,
            customer_mobile=customer_mobile,
            menu_item_id=menu_item_id,
            menu_item_name=menu_item.name,
            status=HalfOrderStatus.ACTIVE,
            created_at=now_utc,
            expires_at=expires_at_utc
        )
        
        db.add(session)
        await db.flush()
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="CREATE",
            resource_type="half_order_session",
            resource_id=str(session.id),
            meta={
                "restaurant_id": restaurant_id,
                "table_no": table_no,
                "menu_item_id": menu_item_id,
                "expires_at": expires_at_utc.isoformat()
            },
            ip_address=ip_address
        )
        
        logger.info(
            f"Half-session {session.id} created - "
            f"Created: {now_utc.isoformat()}, Expires: {expires_at_utc.isoformat()}, "
            f"TTL: {HALF_ORDER_TTL_MINUTES} minutes"
        )
        
        return session
    
    @staticmethod
    async def join_half_session(
        db: AsyncSession,
        session_id: int,
        joiner_table_no: str,
        joiner_name: str,
        joiner_mobile: str,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Join a half-order session with proper locking to prevent race conditions"""
        
        # Use SELECT FOR UPDATE to lock the row
        result = await db.execute(
            select(HalfOrderSession)
            .where(HalfOrderSession.id == session_id)
            .with_for_update()
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("Half-order session not found")
        
        # Validation checks
        if session.status != HalfOrderStatus.ACTIVE:
            raise ValueError(f"Session is not active (status: {session.status})")
        
        # Check if expired
        now_utc = utc_now()
        if session.expires_at <= now_utc:
            session.status = HalfOrderStatus.EXPIRED
            await db.commit()
            raise ValueError("Session has expired")
        
        # Prevent same-table join
        if session.table_no == joiner_table_no:
            raise ValueError("Cannot join your own table's half-order")
        
        # Update session with joiner info
        session.status = HalfOrderStatus.JOINED
        session.joined_by_table_no = joiner_table_no
        session.joined_by_customer_name = joiner_name
        session.joined_at = now_utc
        
        # Get menu item for pricing
        result = await db.execute(
            select(MenuItem).where(MenuItem.id == session.menu_item_id)
        )
        menu_item = result.scalar_one_or_none()
        
        if not menu_item:
            raise ValueError("Menu item not found")
        
        # Calculate total price (2 half orders)
        total_price = (menu_item.half_price * 2) if menu_item.half_price else menu_item.price
        
        # Create paired order
        paired_order = PairedOrder(
            half_session_a=session.id,
            half_session_b=session.id,  # Will be updated in checkout if there's a second session
            restaurant_id=session.restaurant_id,
            menu_item_id=menu_item.id,
            menu_item_name=menu_item.name,
            total_price=total_price,
            status=PairedOrderStatus.PENDING
        )
        
        db.add(paired_order)
        await db.flush()
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="JOIN_SESSION",
            resource_type="half_order_session",
            resource_id=str(session.id),
            meta={
                "paired_order_id": paired_order.id,
                "joiner_table": joiner_table_no,
                "original_table": session.table_no
            },
            ip_address=ip_address
        )
        
        logger.info(
            f"Session {session.id} joined - "
            f"Original table: {session.table_no}, Joiner table: {joiner_table_no}, "
            f"Paired order: {paired_order.id}"
        )
        
        return {
            "session_id": session.id,
            "paired_order_id": paired_order.id,
            "table_pairing": f"Table {session.table_no} + Table {joiner_table_no}",
            "menu_item": menu_item.name,
            "total_price": total_price,
            "status": "matched"
        }
    
    @staticmethod
    async def cancel_half_session(
        db: AsyncSession,
        session_id: int,
        current_user: User,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> HalfOrderSession:
        """Cancel a half-order session with permission checks"""
        
        result = await db.execute(
            select(HalfOrderSession).where(HalfOrderSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("Half-order session not found")
        
        if session.status in [HalfOrderStatus.EXPIRED, HalfOrderStatus.COMPLETED]:
            raise ValueError(f"Cannot cancel session with status: {session.status}")
        
        now_utc = utc_now()
        
        # Check permissions
        if current_user.role.value == 'customer':
            # Customers can only cancel within the window
            time_elapsed = (now_utc - session.created_at).total_seconds() / 60
            if time_elapsed > CUSTOMER_CANCEL_WINDOW_MINUTES:
                raise PermissionError(
                    f"Customer cancel window expired ({CUSTOMER_CANCEL_WINDOW_MINUTES} minutes)"
                )
        elif current_user.role.value not in ['super_admin', 'counter_admin']:
            raise PermissionError("Insufficient permissions to cancel")
        
        # Cancel the session
        session.status = HalfOrderStatus.EXPIRED  # Use EXPIRED for cancelled sessions
        
        # If there's a paired order, cancel it
        result = await db.execute(
            select(PairedOrder).where(
                or_(
                    PairedOrder.half_session_a == session_id,
                    PairedOrder.half_session_b == session_id
                )
            )
        )
        paired_order = result.scalar_one_or_none()
        
        if paired_order:
            paired_order.status = PairedOrderStatus.CANCELLED
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="CANCEL",
            resource_type="half_order_session",
            resource_id=str(session.id),
            meta={
                "reason": reason,
                "time_elapsed_minutes": (now_utc - session.created_at).total_seconds() / 60
            },
            ip_address=ip_address
        )
        
        logger.info(f"Session {session.id} cancelled by {current_user.username}")
        
        return session
    
    @staticmethod
    async def get_active_sessions(db: AsyncSession, restaurant_id: int):
        """Get all active half-order sessions for a restaurant"""
        now_utc = utc_now()
        
        result = await db.execute(
            select(HalfOrderSession)
            .where(
                and_(
                    HalfOrderSession.restaurant_id == restaurant_id,
                    HalfOrderSession.status == HalfOrderStatus.ACTIVE,
                    HalfOrderSession.expires_at > now_utc
                )
            )
            .order_by(HalfOrderSession.created_at.desc())
        )
        
        return result.scalars().all()
    
    @staticmethod
    async def expire_sessions(db: AsyncSession):
        """Background job to expire sessions - returns count of expired"""
        now_utc = utc_now()
        
        result = await db.execute(
            select(HalfOrderSession)
            .where(
                and_(
                    HalfOrderSession.status == HalfOrderStatus.ACTIVE,
                    HalfOrderSession.expires_at <= now_utc
                )
            )
        )
        
        sessions = result.scalars().all()
        expired_count = 0
        
        for session in sessions:
            session.status = HalfOrderStatus.EXPIRED
            
            # Cancel any pending paired orders
            paired_result = await db.execute(
                select(PairedOrder).where(
                    and_(
                        or_(
                            PairedOrder.half_session_a == session.id,
                            PairedOrder.half_session_b == session.id
                        ),
                        PairedOrder.status == PairedOrderStatus.PENDING
                    )
                )
            )
            
            for paired in paired_result.scalars():
                paired.status = PairedOrderStatus.CANCELLED
            
            expired_count += 1
            
            logger.info(
                f"Expired session {session.id} - "
                f"Created: {session.created_at.isoformat()}, "
                f"Expired: {session.expires_at.isoformat()}, "
                f"Now: {now_utc.isoformat()}"
            )
        
        if expired_count > 0:
            await db.commit()
            logger.info(f"Expired {expired_count} half-order sessions")
        
        return expired_count