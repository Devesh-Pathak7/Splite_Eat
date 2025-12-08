"""Table Session Service - Handles table session management"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import datetime
import uuid
import logging

from models import TableOrderSession, Order

logger = logging.getLogger(__name__)


async def get_or_create_session(
    db: AsyncSession,
    restaurant_id: int,
    table_no: str
) -> str:
    """Get active session_id or create new one for a table"""
    # Check for active session
    result = await db.execute(
        select(TableOrderSession).where(
            and_(
                TableOrderSession.restaurant_id == restaurant_id,
                TableOrderSession.table_no == table_no,
                TableOrderSession.is_active == True
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if session:
        return session.session_id
    
    # Create new session
    session_id = str(uuid.uuid4())
    new_session = TableOrderSession(
        restaurant_id=restaurant_id,
        table_no=table_no,
        session_id=session_id,
        is_active=True,
        started_at=datetime.now(datetime.now().astimezone().tzinfo)
    )
    
    db.add(new_session)
    await db.flush()
    
    logger.info(f"Created new session {session_id} for table {table_no}")
    
    return session_id


async def update_session_totals(
    db: AsyncSession,
    session_id: str
):
    """Update session total orders count and amount"""
    # Get session
    session_result = await db.execute(
        select(TableOrderSession).where(TableOrderSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        return
    
    # Count orders and sum amounts
    orders_result = await db.execute(
        select(
            func.count(Order.id),
            func.sum(Order.total_amount)
        ).where(Order.session_id == session_id)
    )
    count, total = orders_result.one()
    
    session.total_orders_count = count or 0
    session.total_amount = float(total or 0.0)
