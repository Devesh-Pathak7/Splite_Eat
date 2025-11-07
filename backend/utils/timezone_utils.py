"""Timezone utilities for IST (Indian Standard Time) and UTC conversion"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

# Indian Standard Time
IST = ZoneInfo("Asia/Kolkata")


def utc_now() -> datetime:
    """Get current UTC datetime with timezone info"""
    return datetime.now(timezone.utc)


def to_ist(dt: datetime) -> datetime:
    """Convert UTC datetime to IST"""
    if dt.tzinfo is None:
        # Assume UTC if no timezone
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def from_ist_to_utc(dt: datetime) -> datetime:
    """Convert IST datetime to UTC"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)


def format_ist_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime as IST string"""
    if not dt:
        return None
    ist_dt = to_ist(dt)
    return ist_dt.strftime("%Y-%m-%d %H:%M:%S IST")


def parse_datetime_flexible(dt_str: str) -> datetime:
    """Parse datetime string flexibly (handles ISO format with/without timezone)"""
    if not dt_str:
        return None
    
    # Try parsing with timezone
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except:
        # Try parsing without timezone and assume UTC
        dt = datetime.fromisoformat(dt_str)
        return dt.replace(tzinfo=timezone.utc)