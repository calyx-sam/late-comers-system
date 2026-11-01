"""User management routes — admin only."""

from flask import Blueprint, jsonify, request, g
from decorators import login_required, role_required
from extensions import get_db
from models import User
from services.audit_service import log_audit
from services.auth_service import revoke_all_user_sessions

users_bp = Blueprint("users", __name__, url_prefix="/api/users")

VALID_ROLES = ["admin", "staff"]


@users_bp.route("", methods=["GET"])
@login_required
@role_required("admin")
def list_users():
    db = next(get_db())
    try:
        users = db.query(User).order_by(User.name).all()
        return jsonify([u.to_dict(include_email=True) for u in users]), 200
    finally:
        db.close()


@users_bp.route("", methods=["POST"])
@login_required
@role_required("admin")
def create_user():
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email = str(data.get("email", "")).lower().strip()
        name = str(data.get("name", "")).strip()
        role = str(data.get("role", "staff")).strip()

        if not email or "@" not in email:
            return jsonify({"error": "Valid email is required"}), 400
        if len(email) > 255:
            return jsonify({"error": "Email too long"}), 400
        if not name or len(name) > 200:
            return jsonify({"error": "Name is required (max 200 chars)"}), 400
        if role not in VALID_ROLES:
            return jsonify({"error": f"Role must be one of: {', '.join(VALID_ROLES)}"}), 400

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return jsonify({"error": "A user with this email already exists"}), 409

        user = User(email=email, name=name, role=role, is_active=True)
        db.add(user)
        db.commit()

        log_audit("user_create", entity_type="user", entity_id=user.id, details={"email": email, "role": role})

        return jsonify(user.to_dict(include_email=True)), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to create user"}), 500
    finally:
        db.close()


@users_bp.route("/<int:user_id>", methods=["PUT"])
@login_required
@role_required("admin")
def update_user(user_id):
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.id == g.current_user.id and data.get("is_active") is False:
            return jsonify({"error": "You cannot deactivate your own account"}), 400

        changes = {}

        if "name" in data:
            name = str(data["name"]).strip()
            if not name or len(name) > 200:
                return jsonify({"error": "Name is required (max 200 chars)"}), 400
            user.name = name
            changes["name"] = name

        if "role" in data:
            role = str(data["role"]).strip()
            if role not in VALID_ROLES:
                return jsonify({"error": f"Role must be one of: {', '.join(VALID_ROLES)}"}), 400
            if user.id == g.current_user.id and role != "admin":
                return jsonify({"error": "You cannot remove your own admin role"}), 400
            user.role = role
            changes["role"] = role

        if "is_active" in data:
            is_active = bool(data["is_active"])
            user.is_active = is_active
            changes["is_active"] = is_active
            if not is_active:
                revoke_all_user_sessions(db, user.id)

        db.commit()

        log_audit("user_update", entity_type="user", entity_id=user.id, details=changes)

        return jsonify(user.to_dict(include_email=True)), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to update user"}), 500
    finally:
        db.close()
