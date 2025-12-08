"""Session Service - Manages table dining sessions"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import TableOrderSession, utc_now
import logging

logger = logging.getLogger(__name__)


class SessionService:
    @staticmethod
    async def get_active_session_for_table(
        db: AsyncSession,
        restaurant_id: int,
        table_no: str
    ):
        """Get active session for a table"""
        result = await db.execute(
            select(TableOrderSession).where(
                and_(
                    TableOrderSession.restaurant_id == restaurant_id,
                    TableOrderSession.table_no == table_no,
                    TableOrderSession.is_active == True,
                    TableOrderSession.status == "ACTIVE"
                )
            )
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_session(
        db: AsyncSession,
        restaurant_id: int,
        table_no: str
    ) -> TableOrderSession:
        """Create new table session"""
        session = TableOrderSession(
            restaurant_id=restaurant_id,
            table_no=table_no,
            status="ACTIVE",
            is_active=True,
            started_at=utc_now()
        )
        db.add(session)
        await db.flush()
        logger.info(f"Created session #{session.id} for table {table_no}")
        return session
    
    @staticmethod
    async def get_or_create_active_session(
        db: AsyncSession,
        restaurant_id: int,
        table_no: str
    ) -> TableOrderSession:
        """Get existing active session or create new one"""
        session = await SessionService.get_active_session_for_table(
            db, restaurant_id, table_no
        )
        
        if not session:
            session = await SessionService.create_session(
                db, restaurant_id, table_no
            )
        
        return session
    
    @staticmethod
    async def close_session(
        db: AsyncSession,
        session_id: int
    ) -> TableOrderSession:
        """Close a table session"""
        result = await db.execute(
            select(TableOrderSession).where(TableOrderSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.status = "CLOSED"
            session.is_active = False
            session.ended_at = utc_now()
            await db.flush()
            logger.info(f"Closed session #{session_id}")
        
        return session
