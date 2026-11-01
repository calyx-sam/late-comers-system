"""Auth decorators: @login_required, @role_required."""

from functools import wraps
from flask import request, jsonify, g
from extensions import get_db
from services.auth_service import validate_session


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        raw_token = request.cookies.get("session_token")
        if not raw_token:
            return jsonify({"error": "Authentication required"}), 401
        db = next(get_db())
        try:
            user, session = validate_session(db, raw_token)
            if not user:
                return jsonify({"error": "Authentication required"}), 401
            g.current_user = user
            g.current_session = session
            return f(*args, **kwargs)
        except Exception:
            return jsonify({"error": "Authentication required"}), 401
        finally:
            db.close()
    return decorated


def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user:
                return jsonify({"error": "Authentication required"}), 401
            if user.role != role:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
