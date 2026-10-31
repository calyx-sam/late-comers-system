"""Auth routes: Google OAuth login, callback, logout, current user."""

from flask import Blueprint, redirect, url_for, jsonify, request, make_response, session
from backend.config import Config
from backend.extensions import oauth, get_db
from backend.models import User, Settings
from backend.decorators import login_required
from backend.services.auth_service import create_session, revoke_session
from backend.services.audit_service import log_audit

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

ACCESS_DENIED_MSG = "Access denied. Contact your administrator."


@auth_bp.route("/login")
def login():
    callback_url = url_for("auth.callback", _external=True)
    import secrets
    nonce = secrets.token_urlsafe(16)
    session["oauth_nonce"] = nonce
    return oauth.google.authorize_redirect(callback_url, nonce=nonce)


@auth_bp.route("/callback")
def callback():
    db = next(get_db())
    try:
        token = oauth.google.authorize_access_token()
        nonce = session.pop("oauth_nonce", None)
        user_info = oauth.google.parse_id_token(token, nonce=nonce)

        if not user_info:
            log_audit("login_failure", details={"reason": "ID token parsing failed"})
            return _access_denied_redirect()

        email = user_info.get("email", "").lower().strip()
        email_verified = user_info.get("email_verified", False)
        google_name = user_info.get("name", "")

        if not email_verified:
            log_audit("login_failure", details={"email": email, "reason": "email_not_verified"})
            return _access_denied_redirect()

        if Config.ALLOWED_EMAIL_DOMAIN:
            domain = email.split("@")[-1] if "@" in email else ""
            if domain != Config.ALLOWED_EMAIL_DOMAIN:
                log_audit("login_failure", details={"email": email, "reason": "domain_not_allowed"})
                return _access_denied_redirect()

        db_user = db.query(User).filter(User.email == email).first()

        if not db_user:
            log_audit("login_failure", details={"email": email, "reason": "user_not_found"})
            return _access_denied_redirect()

        if not db_user.is_active:
            log_audit("login_failure", details={"email": email, "reason": "user_disabled"}, user_id=db_user.id)
            return _access_denied_redirect()

        if google_name and db_user.name != google_name:
            db_user.name = google_name
            db.commit()

        raw_token = create_session(db, db_user.id)

        log_audit(
            "login_success",
            entity_type="user",
            entity_id=db_user.id,
            details={"email": email, "role": db_user.role},
            user_id=db_user.id,
        )

        frontend_url = Config.FRONTEND_URL or ""
        response = make_response(redirect(f"{frontend_url}/dashboard"))

        is_secure = not Config.DEBUG
        response.set_cookie(
            "session_token",
            value=raw_token,
            httponly=True,
            secure=is_secure,
            samesite="Lax",
            path="/",
            max_age=Config.SESSION_ABSOLUTE_LIFETIME_HOURS * 3600,
        )
        return response

    except Exception as e:
        db.rollback()
        log_audit("login_failure", details={"reason": "exception", "error": str(e)[:200]})
        return _access_denied_redirect()
    finally:
        db.close()


@auth_bp.route("/me")
def me():
    from backend.services.auth_service import validate_session as validate_sess

    raw_token = request.cookies.get("session_token")
    if not raw_token:
        return jsonify({"user": None}), 200

    db = next(get_db())
    try:
        user, sess = validate_sess(db, raw_token)
        if not user:
            return jsonify({"user": None}), 200

        settings = db.query(Settings).filter(Settings.id == 1).first()
        settings_dict = settings.to_dict() if settings else {
            "college_name": "College",
            "reporting_time": "08:25",
            "repeat_threshold": 3,
            "semester_label": "",
        }

        return jsonify({
            "user": user.to_dict(include_email=True),
            "settings": settings_dict,
        }), 200
    except Exception:
        return jsonify({"user": None}), 200
    finally:
        db.close()


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    from flask import g

    raw_token = request.cookies.get("session_token")
    if raw_token:
        db = next(get_db())
        try:
            revoke_session(db, raw_token)
            log_audit("logout", entity_type="user", entity_id=g.current_user.id, user_id=g.current_user.id)
        except Exception:
            db.rollback()
        finally:
            db.close()

    response = make_response(jsonify({"message": "Logged out"}))
    response.delete_cookie("session_token", path="/")
    return response, 200


def _access_denied_redirect():
    frontend_url = Config.FRONTEND_URL or ""
    return redirect(f"{frontend_url}/login?error=access_denied")
