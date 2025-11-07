"""Audit Service - Handles audit logging"""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from models import AuditLog, User, utc_now
import json


async def log_audit(
    db: AsyncSession,
    user: Optional[User],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """Log an audit entry"""
    audit_entry = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "anonymous",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        meta=meta,
        ip_address=ip_address,
        created_at=utc_now()
    )
    db.add(audit_entry)
    # Don't commit here - let the caller commit