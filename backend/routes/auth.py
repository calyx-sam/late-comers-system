"""Auth routes: Google OAuth login, callback, logout, current user."""

from flask import Blueprint, redirect, url_for, jsonify, request, make_response, session
from config import Config
from extensions import oauth, get_db
from models import User, Settings
from decorators import login_required
from services.auth_service import create_session, revoke_session
from services.audit_service import log_audit

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

ACCESS_DENIED_MSG = "Access denied. Contact your administrator."


def _get_redirect_uri():
    """Get OAuth redirect URI from env variable or auto-detect with HTTPS."""
    if Config.GOOGLE_REDIRECT_URI:
        return Config.GOOGLE_REDIRECT_URI
    callback_url = url_for("auth.callback", _external=True)
    if callback_url.startswith("http://") and not ("localhost" in callback_url or "127.0.0.1" in callback_url):
        callback_url = "https://" + callback_url[len("http://"):]
    return callback_url


@auth_bp.route("/login")
def login():
    redirect_uri = _get_redirect_uri()
    print(f"[OAuth Login] Initiated with redirect_uri: {redirect_uri}", flush=True)

    import secrets
    nonce = secrets.token_urlsafe(16)
    session["oauth_nonce"] = nonce
    session["oauth_redirect_uri"] = redirect_uri
    return oauth.google.authorize_redirect(redirect_uri, nonce=nonce)


@auth_bp.route("/callback")
@auth_bp.route("/google/callback")
def callback():
    db = next(get_db())
    try:
        redirect_uri = session.pop("oauth_redirect_uri", None) or _get_redirect_uri()
        print(f"[OAuth Callback] Token exchange with redirect_uri: {redirect_uri}", flush=True)
        token = oauth.google.authorize_access_token(redirect_uri=redirect_uri)
        nonce = session.pop("oauth_nonce", None)
        user_info = oauth.google.parse_id_token(token, nonce=nonce)

        if not user_info:
            log_audit("login_failure", details={"reason": "ID token parsing failed"})
            return _access_denied_redirect()

        email = user_info.get("email", "").lower().strip()
        email_verified = user_info.get("email_verified", False)
        google_name = user_info.get("name", "")
        print(f"[OAuth Callback] Successfully authenticated with Google as '{email}'", flush=True)

        if not email_verified:
            print(f"[OAuth Access Denied] Email '{email}' is not verified by Google", flush=True)
            log_audit("login_failure", details={"email": email, "reason": "email_not_verified"})
            return _access_denied_redirect()

        if Config.ALLOWED_EMAIL_DOMAIN:
            domain = email.split("@")[-1] if "@" in email else ""
            if domain != Config.ALLOWED_EMAIL_DOMAIN:
                print(f"[OAuth Access Denied] Domain '{domain}' != '{Config.ALLOWED_EMAIL_DOMAIN}'", flush=True)
                log_audit("login_failure", details={"email": email, "reason": "domain_not_allowed"})
                return _access_denied_redirect()

        db_user = db.query(User).filter(User.email == email).first()

        if not db_user:
            print(f"[OAuth Access Denied] Email '{email}' not found in 'users' database table", flush=True)
            log_audit("login_failure", details={"email": email, "reason": "user_not_found"})
            return _access_denied_redirect()

        if not db_user.is_active:
            print(f"[OAuth Access Denied] User '{email}' is inactive", flush=True)
            log_audit("login_failure", details={"email": email, "reason": "user_disabled"}, user_id=db_user.id)
            return _access_denied_redirect()

        if google_name and db_user.name != google_name:
            db_user.name = google_name
            db.commit()

        raw_token = create_session(db, db_user.id)
        print(f"[OAuth Success] Session created for user '{email}' (role: {db_user.role})", flush=True)

        log_audit(
            "login_success",
            entity_type="user",
            entity_id=db_user.id,
            details={"email": email, "role": db_user.role},
            user_id=db_user.id,
        )

        target_path = "/dashboard"
        if Config.DEBUG and Config.FRONTEND_URL:
            target_path = f"{Config.FRONTEND_URL}/dashboard"
        response = make_response(redirect(target_path))

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
        print(f"[OAuth Callback Exception] {str(e)}", flush=True)
        log_audit("login_failure", details={"reason": "exception", "error": str(e)[:200]})
        return _access_denied_redirect()
    finally:
        db.close()


@auth_bp.route("/me")
def me():
    from services.auth_service import validate_session as validate_sess

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
    target_path = "/login?error=access_denied"
    if Config.DEBUG and Config.FRONTEND_URL:
        target_path = f"{Config.FRONTEND_URL}/login?error=access_denied"
    return redirect(target_path)
