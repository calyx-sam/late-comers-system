"""Audit log helper — writes events to audit_log table."""

from flask import request, g
from extensions import get_db
from models import AuditLog


def log_audit(action, entity_type=None, entity_id=None, details=None, user_id=None):
    db = next(get_db())
    try:
        uid = user_id
        if uid is None:
            user = getattr(g, "current_user", None)
            uid = user.id if user else None

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        if ip and "," in ip:
            ip = ip.split(",")[0].strip()

        entry = AuditLog(
            user_id=uid,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
