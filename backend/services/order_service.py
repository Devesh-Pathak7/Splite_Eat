"""Order Service - Handles order creation, completion of paired orders, and order management"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import json
import logging

from models import (
    Order, PairedOrder, HalfOrderSession, User, MenuItem,
    PairedOrderStatus, HalfOrderStatus, OrderStatus, utc_now
)
from services.audit_service import log_audit

logger = logging.getLogger(__name__)


class OrderService:
    
    @staticmethod
    async def create_order_with_paired(
        db: AsyncSession,
        restaurant_id: int,
        table_no: str,
        customer_name: str,
        phone: str,
        items: List[Dict[str, Any]],
        paired_order_ids: List[int] = None,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create order and complete any paired orders atomically"""
        
        # Check idempotency
        if idempotency_key:
            # Check if order with this key already exists
            # (implement idempotency table if needed)
            pass
        
        # Calculate total (items is list of Pydantic models)
        total_amount = sum(
            (item.price if hasattr(item, 'price') else item['price']) * 
            (item.quantity if hasattr(item, 'quantity') else item.get('quantity', 1))
            for item in items
        )
        
        # Lock paired orders if any
        paired_orders = []
        if paired_order_ids:
            for paired_id in paired_order_ids:
                result = await db.execute(
                    select(PairedOrder)
                    .where(PairedOrder.id == paired_id)
                    .with_for_update()
                )
                paired_order = result.scalar_one_or_none()
                
                if not paired_order:
                    raise ValueError(f"Paired order {paired_id} not found")
                
                if paired_order.status != PairedOrderStatus.PENDING:
                    raise ValueError(
                        f"Paired order {paired_id} is not pending (status: {paired_order.status})"
                    )
                
                paired_orders.append(paired_order)
        
        # Create the order - serialize items properly
        items_json = json.dumps([
            {
                "menu_item_id": item.menu_item_id if hasattr(item, 'menu_item_id') else item.get('menu_item_id'),
                "name": item.name if hasattr(item, 'name') else item.get('name'),
                "quantity": item.quantity if hasattr(item, 'quantity') else item.get('quantity', 1),
                "price": item.price if hasattr(item, 'price') else item.get('price')
            }
            for item in items
        ])
        
        order = Order(
            restaurant_id=restaurant_id,
            table_no=table_no,
            customer_name=customer_name,
            phone=phone,
            items=items_json,
            total_amount=total_amount,
            status="PENDING",
            created_at=utc_now()
        )
        
        db.add(order)
        await db.flush()
        
        # Complete paired orders
        completed_paired = []
        for paired_order in paired_orders:
            paired_order.status = PairedOrderStatus.COMPLETED
            paired_order.completed_at = utc_now()
            paired_order.order_id = order.id
            
            # Update half-order sessions to COMPLETED
            for session_id in [paired_order.half_session_a, paired_order.half_session_b]:
                session_result = await db.execute(
                    select(HalfOrderSession).where(HalfOrderSession.id == session_id)
                )
                session = session_result.scalar_one_or_none()
                if session:
                    session.status = HalfOrderStatus.COMPLETED
            
            completed_paired.append({
                "paired_order_id": paired_order.id,
                "menu_item": paired_order.menu_item_name,
                "price": paired_order.total_price
            })

        # Ensure updates are flushed so they are visible before returning
        try:
            await db.flush()
        except Exception:
            logger.exception("Failed to flush DB after completing paired orders")
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="CREATE",
            resource_type="order",
            resource_id=str(order.id),
            meta={
                "restaurant_id": restaurant_id,
                "table_no": table_no,
                "total_amount": total_amount,
                "paired_orders": [p.id for p in paired_orders],
                "items_count": len(items)
            },
            ip_address=ip_address
        )
        
        logger.info(
            f"Order {order.id} created - "
            f"Items: {len(items)}, Paired orders: {len(paired_orders)}, Total: ₹{total_amount}"
        )
        
        return {
            "order_id": order.id,
            "status": order.status,
            "total_amount": total_amount,
            "paired_orders_completed": completed_paired,
            "created_at": order.created_at.isoformat()
        }
    
    @staticmethod
    async def update_order_status(
        db: AsyncSession,
        order_id: int,
        new_status: str,
        current_user: User,
        ip_address: Optional[str] = None
    ) -> Order:
        """Update order status with audit logging"""
        
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise ValueError("Order not found")
        
        old_status = order.status
        order.status = new_status

        # If order moved to COMPLETED, ensure any related PairedOrder rows
        # are marked COMPLETED and their HalfOrderSession rows are also updated.
        if (isinstance(new_status, str) and new_status.upper() == "COMPLETED") or (hasattr(new_status, 'name') and new_status.name == 'COMPLETED'):
            try:
                result = await db.execute(
                    select(PairedOrder).where(PairedOrder.order_id == order_id)
                )
                paired_rows = result.scalars().all()
                for paired in paired_rows:
                    paired.status = PairedOrderStatus.COMPLETED
                    paired.completed_at = utc_now()
                    logger.info(f"Marking PairedOrder {paired.id} completed for order {order_id}")
                    # update linked half-order sessions
                    for session_id in [paired.half_session_a, paired.half_session_b]:
                        session_result = await db.execute(
                            select(HalfOrderSession).where(HalfOrderSession.id == session_id)
                        )
                        session = session_result.scalar_one_or_none()
                        if session:
                            session.status = HalfOrderStatus.COMPLETED
                # flush so changes are persisted when outer transaction commits
                await db.flush()
            except Exception:
                logger.exception("Failed to update paired orders on order completion")

        # Log audit (use plain strings, safe fallback)
        old_status_str = old_status if isinstance(old_status, str) else getattr(old_status, 'name', str(old_status))
        new_status_str = new_status if isinstance(new_status, str) else getattr(new_status, 'name', str(new_status))

        await log_audit(
            db=db,
            user=current_user,
            action="UPDATE",
            resource_type="order",
            resource_id=str(order_id),
            meta={
                "old_status": old_status_str,
                "new_status": new_status_str
            },
            ip_address=ip_address
        )
        
        logger.info(f"Order {order_id} status: {old_status_str} -> {new_status_str}")
        
        return order
    
    @staticmethod
    async def send_to_kitchen(
        db: AsyncSession,
        order_id: int,
        current_user: User,
        ip_address: Optional[str] = None
    ) -> Order:
        """Send order to kitchen"""
        
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise ValueError("Order not found")
        
        if order.sent_to_kitchen_at:
            raise ValueError("Order already sent to kitchen")
        
        order.sent_to_kitchen_at = utc_now()
        order.sent_to_kitchen_by = current_user.id
        order.status = "PREPARING"

        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="SEND_TO_KITCHEN",
            resource_type="order",
            resource_id=str(order_id),
            meta={"sent_at": order.sent_to_kitchen_at.isoformat()},
            ip_address=ip_address
        )

        logger.info(f"Order {order_id} sent to kitchen by {current_user.username}")

        return order
    
    @staticmethod
    async def cancel_order(
        db: AsyncSession,
        order_id: int,
        current_user: User,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Order:
        """Cancel an order with permission checks"""
        
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise ValueError("Order not found")
        
        if (order.status or '').upper() in ["SERVED", "COMPLETED"]:
            raise ValueError(f"Cannot cancel order with status: {order.status}")
        
        # Check permissions
        if current_user.role.value not in ['super_admin', 'counter_admin']:
            raise PermissionError("Only admin can cancel orders")
        
        order.status = "CANCELLED"
        order.cancelled_at = utc_now()
        order.cancelled_by = current_user.id
        order.cancel_reason = reason
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="CANCEL",
            resource_type="order",
            resource_id=str(order_id),
            meta={"reason": reason},
            ip_address=ip_address
        )
        
        logger.info(f"Order {order_id} cancelled by {current_user.username}")
        
        return order
    
    @staticmethod
    async def reopen_order(
        db: AsyncSession,
        order_id: int,
        current_user: User,
        ip_address: Optional[str] = None
    ) -> Order:
        """Reopen a cancelled order"""
        
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        
        if not order:
            raise ValueError("Order not found")
        
        if (order.status or '').upper() != "CANCELLED":
            raise ValueError("Only cancelled orders can be reopened")
        
        # Check permissions
        if current_user.role.value not in ['super_admin', 'counter_admin']:
            raise PermissionError("Only admin can reopen orders")
        
        order.status = "PENDING"
        order.cancelled_at = None
        order.cancelled_by = None
        order.cancel_reason = None
        
        # Log audit
        await log_audit(
            db=db,
            user=current_user,
            action="REOPEN",
            resource_type="order",
            resource_id=str(order_id),
            meta={},
            ip_address=ip_address
        )
        
        logger.info(f"Order {order_id} reopened by {current_user.username}")
        
        return order