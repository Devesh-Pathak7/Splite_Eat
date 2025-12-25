import asyncio
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_, text

# ensure project root
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database import AsyncSessionLocal
from models import Order, PairedOrder, HalfOrderSession, Restaurant

async def run():
    async with AsyncSessionLocal() as db:
        # compute IST today range
        now_ist = datetime.now(timezone.utc).astimezone(tz=timezone(timedelta(hours=5, minutes=30)))
        start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0)
        end_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 23, 59, 59, 999999)
        print('IST range:', start_ist, '->', end_ist)

        # Use CONVERT_TZ(Order.created_at, '+00:00', '+05:30') between start and end
        conv = func.convert_tz(Order.created_at, '+00:00', '+05:30')
        revenue_q = select(func.sum(Order.total_amount)).where(and_(conv >= start_ist, conv <= end_ist))
        r = await db.execute(revenue_q)
        total_revenue = r.scalar() or 0

        orders_q = select(func.count(Order.id)).where(and_(conv >= start_ist, conv <= end_ist))
        ro = await db.execute(orders_q)
        total_orders = ro.scalar() or 0

        # paired completed
        conv_p = func.convert_tz(PairedOrder.completed_at, '+00:00', '+05:30')
        paired_q = select(func.count(PairedOrder.id)).where(and_(conv_p >= start_ist, conv_p <= end_ist, PairedOrder.status == 'COMPLETED'))
        rp = await db.execute(paired_q)
        paired_count = int(rp.scalar() or 0)

        # fallback: orders with half_order marker not already in paired_orders
        subq = select(PairedOrder.order_id).where(PairedOrder.order_id != None)
        conv_o = func.convert_tz(Order.created_at, '+00:00', '+05:30')
        fallback_q = select(func.count(Order.id)).where(and_(conv_o >= start_ist, conv_o <= end_ist, Order.items.like('%half_order%'), Order.status.in_(['SERVED', 'COMPLETED']), ~Order.id.in_(subq)))
        rf = await db.execute(fallback_q)
        fallback_count = int(rf.scalar() or 0)

        print('total_revenue', total_revenue)
        print('total_orders', total_orders)
        print('paired_count', paired_count)

if __name__ == '__main__':
    asyncio.run(run())
