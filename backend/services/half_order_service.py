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
    HalfOrderStatus, PairedOrderStatus, utc_now, ist_now, IST,
    Order, OrderStatus
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
        
        # Check for existing ACTIVE sessions for same menu item in same restaurant
        now_ist = ist_now()
        existing_result = await db.execute(
            select(HalfOrderSession)
            .where(
                and_(
                    HalfOrderSession.restaurant_id == restaurant_id,
                    HalfOrderSession.menu_item_id == menu_item_id,
                    HalfOrderSession.status == HalfOrderStatus.ACTIVE
                )
            )
        )
        existing_sessions = existing_result.scalars().all()
        
        # Filter out expired sessions
        valid_existing = []
        for sess in existing_sessions:
            expires_at = sess.expires_at
            if expires_at.tzinfo is None:
                expires_at = IST.localize(expires_at)
            elif expires_at.tzinfo != IST:
                expires_at = expires_at.astimezone(IST)
            
            if expires_at > now_ist:
                valid_existing.append(sess)
        
        if valid_existing:
            # Found active session(s) for same item - suggest joining instead
            session_info = ", ".join([
                f"Session #{s.id} by Table {s.table_no} ({s.customer_name})"
                for s in valid_existing[:3]  # Show max 3
            ])
            raise ValueError(
                f"Active half-order already exists for {menu_item.name}. "
                f"Please join existing session(s): {session_info}"
            )
        
        # Set expiry time based on TTL in IST
        ttl_minutes = int(os.getenv('HALF_ORDER_TTL_MINUTES', '30'))
        created_at_ist = ist_now()
        expires_at = created_at_ist + timedelta(minutes=ttl_minutes)
        
        # Create session
        session = HalfOrderSession(
            restaurant_id=restaurant_id,
            table_no=table_no,
            customer_name=customer_name,
            customer_mobile=customer_mobile,
            menu_item_id=menu_item_id,
            menu_item_name=menu_item.name,
            status=HalfOrderStatus.ACTIVE,
            created_at=created_at_ist,
            expires_at=expires_at
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
                "expires_at": expires_at.isoformat()
            },
            ip_address=ip_address
        )
        
        logger.info(
            f"Half-session {session.id} created - "
            f"Created: {created_at_ist.isoformat()}, Expires: {expires_at.isoformat()}, "
            f"TTL: {ttl_minutes} minutes"
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
        if session.status not in [HalfOrderStatus.ACTIVE, HalfOrderStatus.JOINED]:
            raise ValueError(f"Session is not available for joining (status: {session.status})")
        
        # Check if expired (IST timezone)
        now_ist = ist_now()
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = IST.localize(expires_at)
        elif expires_at.tzinfo != IST:
            expires_at = expires_at.astimezone(IST)
        
        if expires_at <= now_ist:
            session.status = HalfOrderStatus.EXPIRED
            await db.commit()
            raise ValueError("Session has expired")
        
        # Prevent same-table join
        if session.table_no == joiner_table_no:
            raise ValueError("Cannot join your own table's half-order")
        
        # Check if this table already joined
        existing_paired = await db.execute(
            select(PairedOrder).where(
                and_(
                    or_(
                        PairedOrder.half_session_a == session.id,
                        PairedOrder.half_session_b == session.id
                    ),
                    PairedOrder.joiner_table_no == joiner_table_no
                )
            )
        )
        if existing_paired.scalar_one_or_none():
            raise ValueError(f"Table {joiner_table_no} has already joined this session")
        
        # Update session status to JOINED (allows multiple joins)
        if session.status == HalfOrderStatus.ACTIVE:
            session.status = HalfOrderStatus.JOINED
            session.joined_by_table_no = joiner_table_no
            session.joined_by_customer_name = joiner_name
            session.joined_at = now_ist
        
        # Track additional joiners in session metadata
        if not hasattr(session, 'total_joiners'):
            session.total_joiners = 1
        else:
            session.total_joiners += 1
        
        # Get menu item for pricing
        result = await db.execute(
            select(MenuItem).where(MenuItem.id == session.menu_item_id)
        )
        menu_item = result.scalar_one_or_none()
        
        if not menu_item:
            raise ValueError("Menu item not found")
        
        # Calculate total price (2 half orders)
        base_price = (menu_item.half_price * 2) if menu_item.half_price else menu_item.price
        
        # Apply join fee
        join_fee = float(os.getenv('HALF_ORDER_JOIN_FEE', '20'))
        total_price = base_price + join_fee
        
        # Create paired order with joiner tracking
        paired_order = PairedOrder(
            half_session_a=session.id,
            half_session_b=session.id,  # Will be updated in checkout if there's a second session
            restaurant_id=session.restaurant_id,
            menu_item_id=menu_item.id,
            menu_item_name=menu_item.name,
            total_price=total_price,
            join_fee=join_fee,
            status=PairedOrderStatus.PENDING,
            joiner_table_no=joiner_table_no,
            joiner_customer_name=joiner_name,
            joiner_customer_mobile=joiner_mobile
        )
        
        db.add(paired_order)
        await db.flush()
        
        # AUTO-CREATE ORDER for Counter Dashboard visibility
        # When someone joins, create a full order combining both customers
        from models import Order
        import json
        
        order = Order(
            restaurant_id=session.restaurant_id,
            table_no=f"{session.table_no}+{joiner_table_no}",  # Combined tables
            customer_name=f"{session.customer_name} & {joiner_name}",  # Both customers
            phone=f"{session.customer_mobile}, {joiner_mobile}",  # Both phones
            items=json.dumps([{
                "menu_item_id": menu_item.id,
                "name": menu_item.name,
                "quantity": 1,
                "price": total_price,
                "type": "paired",
                "half_session_id": session.id,
                "paired_order_id": paired_order.id
            }]),
            total_amount=total_price,
            status=OrderStatus.PENDING,
            created_at=utc_now()
        )
        
        db.add(order)
        await db.flush()
        
        # Link order to paired order
        paired_order.order_id = order.id
        
        logger.info(
            f"Auto-created Order #{order.id} for paired half-order session {session.id} "
            f"(Tables {session.table_no} + {joiner_table_no})"
        )
        
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
            "order_id": order.id,  # NEW: Include created order ID
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
    async def get_session_join_count(db: AsyncSession, session_id: int) -> int:
        """Get the number of customers who joined a session"""
        result = await db.execute(
            select(PairedOrder).where(
                or_(
                    PairedOrder.half_session_a == session_id,
                    PairedOrder.half_session_b == session_id
                )
            )
        )
        return len(result.scalars().all())
    
    @staticmethod
    async def expire_sessions(db: AsyncSession):
        """Background job to expire sessions - returns count of expired"""
        now_ist = ist_now()
        
        result = await db.execute(
            select(HalfOrderSession)
            .where(HalfOrderSession.status == HalfOrderStatus.ACTIVE)
        )
        
        sessions = result.scalars().all()
        expired_count = 0
        
        for session in sessions:
            # Ensure timezone-aware comparison with IST
            expires_at = session.expires_at
            if expires_at.tzinfo is None:
                expires_at = IST.localize(expires_at)
            elif expires_at.tzinfo != IST:
                expires_at = expires_at.astimezone(IST)
            
            if expires_at <= now_ist:
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