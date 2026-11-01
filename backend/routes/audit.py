"""Audit log routes — admin only."""

from flask import Blueprint, jsonify, request
from decorators import login_required, role_required
from extensions import get_db
from models import AuditLog
from sqlalchemy import desc

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit-log")


@audit_bp.route("", methods=["GET"])
@login_required
@role_required("admin")
def list_audit_log():
    db = next(get_db())
    try:
        query = db.query(AuditLog)

        action = request.args.get("action")
        if action:
            query = query.filter(AuditLog.action == action)

        entity_type = request.args.get("entity_type")
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)

        user_id = request.args.get("user_id")
        if user_id:
            try:
                query = query.filter(AuditLog.user_id == int(user_id))
            except ValueError:
                pass

        date_from = request.args.get("from")
        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)

        date_to = request.args.get("to")
        if date_to:
            query = query.filter(AuditLog.created_at <= date_to + "T23:59:59")

        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 50))))

        total = query.count()
        entries = (
            query.order_by(desc(AuditLog.created_at))
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return jsonify({
            "items": [e.to_dict() for e in entries],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }), 200
    except Exception:
        return jsonify({"error": "Failed to fetch audit log"}), 500
    finally:
        db.close()
