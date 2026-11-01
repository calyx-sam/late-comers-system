import os
from flask import Blueprint, redirect, url_for, jsonify, request, make_response, session
from config import Config, _clean_env
from extensions import oauth, get_db
from models import User, Settings
from decorators import login_required
from services.auth_service import create_session, revoke_session
from services.audit_service import log_audit

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

ACCESS_DENIED_MSG = "Access denied. Contact your administrator."


def _extract_google_error(e):
    """Extract OAuth error code and description from exception or response, without sensitive tokens."""
    error_code = None
    error_desc = None

    # Check OAuthError attributes directly
    if hasattr(e, "error") and e.error:
        error_code = str(e.error)
    if hasattr(e, "description") and e.description:
        error_desc = str(e.description)

    # Check response object (requests / httpx)
    resp = getattr(e, "response", None)
    if resp is not None:
        try:
            data = resp.json()
            if isinstance(data, dict):
                error_code = error_code or data.get("error")
                error_desc = error_desc or data.get("error_description")
        except Exception:
            try:
                text = resp.text
                if text and len(text) < 500:
                    error_desc = error_desc or text
            except Exception:
                pass

    # Check exception args
    if not error_code and hasattr(e, "args") and e.args:
        first = e.args[0]
        if isinstance(first, dict):
            error_code = first.get("error")
            error_desc = first.get("error_description")
        elif isinstance(first, str):
            if "invalid_client" in first:
                error_code = "invalid_client"
            elif "invalid_grant" in first:
                error_code = "invalid_grant"
            elif "redirect_uri_mismatch" in first:
                error_code = "redirect_uri_mismatch"
            elif not error_desc:
                error_desc = first

    return error_code, error_desc


def _get_redirect_uri():
    """Read GOOGLE_REDIRECT_URI from environment for both login and token exchange."""
    env_uri = _clean_env(os.environ.get("GOOGLE_REDIRECT_URI", "")) or Config.GOOGLE_REDIRECT_URI
    if env_uri:
        return env_uri
    callback_url = url_for("auth.callback", _external=True)
    if callback_url.startswith("http://") and not ("localhost" in callback_url or "127.0.0.1" in callback_url):
        callback_url = "https://" + callback_url[len("http://"):]
    return callback_url


@auth_bp.route("/login")
def login():
    # Read GOOGLE_REDIRECT_URI directly from environment for login request
    redirect_uri = _get_redirect_uri()
    print(f"[OAuth Login] Initiated with redirect_uri: {redirect_uri}", flush=True)

    import secrets
    nonce = secrets.token_urlsafe(16)
    session["oauth_nonce"] = nonce
    session.permanent = True
    return oauth.google.authorize_redirect(redirect_uri, nonce=nonce)


def _fail_login(code: str, details: dict = None, user_id: int = None):
    """Log specific reason code, record to audit_log, and redirect to /?error=<code>."""
    print(f"[OAuth Failure] reason_code={code}", flush=True)
    if details:
        safe_details = {k: v for k, v in details.items() if k not in ("token", "secret", "code", "database_url")}
        print(f"[OAuth Failure Details] {safe_details}", flush=True)

    try:
        log_audit(
            "login_failure",
            entity_type="user" if user_id else None,
            entity_id=user_id,
            details={"reason": code, **(details or {})},
            user_id=user_id,
        )
    except Exception as e:
        print(f"[OAuth Audit Failure] Could not write audit log for '{code}': {type(e).__name__}", flush=True)

    target_path = f"/?error={code}"
    if Config.DEBUG and Config.FRONTEND_URL:
        target_path = f"{Config.FRONTEND_URL}/?error={code}"
    return redirect(target_path)


@auth_bp.route("/callback")
@auth_bp.route("/google/callback")
def callback():
    # Check for direct error in Google redirect parameters
    if request.args.get("error"):
        err = request.args.get("error")
        err_desc = request.args.get("error_description", "")
        print(f"[Google OAuth Callback Error] error_code: {err} | error_description: {err_desc}", flush=True)
        if "access_denied" in err:
            return _fail_login("state_mismatch", details={"google_error": err, "google_description": err_desc})
        return _fail_login("token_exchange_failed", details={"google_error": err, "google_description": err_desc})

    # Step 1: Token Exchange (reading the same GOOGLE_REDIRECT_URI from environment)
    redirect_uri = _get_redirect_uri()
    print(f"[OAuth Step: Token Exchange] Exchanging token with redirect_uri: {redirect_uri}", flush=True)
    try:
        token = oauth.google.authorize_access_token(redirect_uri=redirect_uri)
    except Exception as e:
        err_msg = str(e).lower()
        err_type = type(e).__name__
        g_error, g_desc = _extract_google_error(e)

        # Print Google's error code and error_description to terminal/runtime logs
        # Never print authorization code, tokens, client secret, or database URL
        print(f"[Google Token Exchange Failed] error_code: {g_error or 'none'} | error_description: {g_desc or 'none'} | exception: {err_type}: {str(e)}", flush=True)

        if "state" in err_msg or "mismatch" in err_msg or "mismatchingstate" in err_type.lower():
            return _fail_login("state_mismatch", details={"error_type": err_type, "google_error": g_error})

        fail_details = {"error_type": err_type}
        if g_error:
            fail_details["google_error"] = str(g_error)
        if g_desc:
            fail_details["google_description"] = str(g_desc)[:200]

        return _fail_login("token_exchange_failed", details=fail_details)

    if not token:
        print("[OAuth Step Error: Token Exchange] Empty token response received", flush=True)
        return _fail_login("token_exchange_failed", details={"info": "empty_token"})

    # Step 2: Token Parsing & Validation
    try:
        nonce = session.pop("oauth_nonce", None)
        user_info = oauth.google.parse_id_token(token, nonce=nonce)
    except Exception as e:
        err_type = type(e).__name__
        print(f"[OAuth Step Error: ID Token Parse] {err_type}: {str(e)}", flush=True)
        return _fail_login("token_invalid", details={"error_type": err_type})

    if not user_info:
        print("[OAuth Step Error: ID Token Parse] Empty user_info received", flush=True)
        return _fail_login("token_invalid", details={"info": "empty_user_info"})

    # Step 3: Email Verification
    email = user_info.get("email", "").lower().strip()
    email_verified = user_info.get("email_verified", False)
    google_name = user_info.get("name", "")

    if not email:
        print("[OAuth Step Error: Email] Missing email in Google ID token", flush=True)
        return _fail_login("token_invalid", details={"info": "missing_email"})

    if not email_verified:
        print("[OAuth Step Error: Email] Google reports email_verified=False", flush=True)
        return _fail_login("email_not_verified", details={"email_provided": True})

    # Step 4: Domain Check
    if Config.ALLOWED_EMAIL_DOMAIN:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain != Config.ALLOWED_EMAIL_DOMAIN:
            print(f"[OAuth Step Error: Domain] Domain '{domain}' not allowed (requires '{Config.ALLOWED_EMAIL_DOMAIN}')", flush=True)
            return _fail_login("domain_not_allowed", details={"domain": domain})

    # Step 5: Database Connection & Lookup
    try:
        db = next(get_db())
    except Exception as e:
        print(f"[OAuth Step Error: DB Connection] {type(e).__name__}: {str(e)}", flush=True)
        return _fail_login("db_error", details={"step": "connect"})

    try:
        # Lookup user
        try:
            db_user = db.query(User).filter(User.email == email).first()
        except Exception as e:
            db.rollback()
            print(f"[OAuth Step Error: DB Query] {type(e).__name__}: {str(e)}", flush=True)
            return _fail_login("db_error", details={"step": "query_user"})

        if not db_user:
            print("[OAuth Step Error: User Lookup] Email not registered in users table", flush=True)
            return _fail_login("user_not_found", details={"domain": email.split("@")[-1]})

        if not db_user.is_active:
            print(f"[OAuth Step Error: User Status] User id={db_user.id} is inactive", flush=True)
            return _fail_login("user_inactive", details={"user_id": db_user.id}, user_id=db_user.id)

        # Update name if changed
        try:
            if google_name and db_user.name != google_name:
                db_user.name = google_name
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"[OAuth DB Warning] Could not update user name: {type(e).__name__}", flush=True)

        # Step 6: Create Session
        try:
            raw_token = create_session(db, db_user.id)
        except Exception as e:
            db.rollback()
            print(f"[OAuth Step Error: Create Session] {type(e).__name__}: {str(e)}", flush=True)
            return _fail_login("db_error", details={"step": "create_session"}, user_id=db_user.id)

        # Step 7: Audit Success
        try:
            log_audit(
                "login_success",
                entity_type="user",
                entity_id=db_user.id,
                details={"role": db_user.role},
                user_id=db_user.id,
            )
        except Exception as e:
            print(f"[OAuth Audit Warning] Success audit failed: {type(e).__name__}", flush=True)

        print(f"[OAuth Success] User id={db_user.id} logged in successfully (role: {db_user.role})", flush=True)

        target_path = "/dashboard"
        if Config.DEBUG and Config.FRONTEND_URL:
            target_path = f"{Config.FRONTEND_URL}/dashboard"
        response = make_response(redirect(target_path))

        response.set_cookie(
            "session_token",
            value=raw_token,
            httponly=True,
            secure=Config.COOKIE_SECURE,
            samesite="Lax",
            path="/",
            max_age=Config.SESSION_ABSOLUTE_LIFETIME_HOURS * 3600,
        )
        return response

    except Exception as e:
        db.rollback()
        print(f"[OAuth Unexpected Callback Error] {type(e).__name__}: {str(e)}", flush=True)
        return _fail_login("db_error", details={"step": "general_exception"})
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
