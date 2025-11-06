from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from models import HalfOrderSession, HalfOrderStatus
from database import AsyncSessionLocal
import logging
import os

logger = logging.getLogger(__name__)

# Get expiry time from environment
HALF_ORDER_EXPIRY_MINUTES = int(os.getenv('HALF_ORDER_EXPIRY_MINUTES', '30'))

scheduler = AsyncIOScheduler()

async def expire_half_orders():
    """Background task to expire half orders that have passed their expiry time"""
    try:
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            
            # Find all active half orders that have expired
            result = await db.execute(
                select(HalfOrderSession).where(
                    HalfOrderSession.status == HalfOrderStatus.ACTIVE,
                    HalfOrderSession.expires_at < now
                )
            )
            expired_sessions = result.scalars().all()
            
            if expired_sessions:
                logger.info(f"Expiring {len(expired_sessions)} half-order sessions")
                
                for session in expired_sessions:
                    session.status = HalfOrderStatus.EXPIRED
                    db.add(session)
                
                await db.commit()
                logger.info(f"Successfully expired {len(expired_sessions)} sessions")
            
    except Exception as e:
        logger.error(f"Error expiring half orders: {str(e)}")

def start_scheduler():
    """Start the background scheduler"""
    scheduler.add_job(expire_half_orders, 'interval', minutes=1, id='expire_half_orders')
    scheduler.start()
    logger.info("Scheduler started - checking for expired half orders every minute")

def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shutdown complete")