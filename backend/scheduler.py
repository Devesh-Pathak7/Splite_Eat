from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import AsyncSessionLocal
from services.half_order_service import HalfOrderService
import logging
import os

logger = logging.getLogger(__name__)

# Get interval from environment
EXPIRY_JOB_INTERVAL_SECONDS = int(os.getenv('EXPIRY_JOB_INTERVAL_SECONDS', '60'))

scheduler = AsyncIOScheduler()

async def expire_half_orders():
    """Background task to expire half orders that have passed their expiry time"""
    try:
        async with AsyncSessionLocal() as db:
            expired_count = await HalfOrderService.expire_sessions(db)
            
            if expired_count > 0:
                # Broadcast WebSocket event about expired sessions
                # This will be handled by the WebSocket manager
                pass
            
    except Exception as e:
        logger.error(f"Error in expiry job: {str(e)}", exc_info=True)

def start_scheduler():
    """Start the background scheduler"""
    interval_minutes = EXPIRY_JOB_INTERVAL_SECONDS / 60
    scheduler.add_job(
        expire_half_orders, 
        'interval', 
        seconds=EXPIRY_JOB_INTERVAL_SECONDS, 
        id='expire_half_orders'
    )
    scheduler.start()
    logger.info(
        f\"Scheduler started - checking for expired sessions every \"
        f\"{EXPIRY_JOB_INTERVAL_SECONDS}s ({interval_minutes:.1f} minutes)\"
    )

def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info(\"Scheduler shutdown complete\")