"""Flask application factory — entry point for Vercel serverless function."""

import sys
import os
import traceback
from flask import Flask, jsonify, request

_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)


def _init_real_app():
    from werkzeug.middleware.proxy_fix import ProxyFix
    from config import Config
    from middleware import apply_security_headers, check_csrf
    from extensions import oauth
    from routes.auth import auth_bp
    from routes.settings import settings_bp
    from routes.users import users_bp
    from routes.audit import audit_bp
    from routes.departments import departments_bp
    from routes.students import students_bp
    from routes.late_arrivals import late_arrivals_bp
    from routes.dashboard import dashboard_bp
    from routes.exports import exports_bp

    # Startup environment check
    status = {
        "DATABASE_URL": bool(Config.SQLALCHEMY_DATABASE_URI),
        "SESSION_SECRET": bool(Config.SECRET_KEY),
        "GOOGLE_CLIENT_ID": bool(Config.GOOGLE_CLIENT_ID),
        "GOOGLE_CLIENT_SECRET": bool(Config.GOOGLE_CLIENT_SECRET),
        "GOOGLE_REDIRECT_URI": bool(Config.GOOGLE_REDIRECT_URI),
        "COOKIE_SECURE": bool(Config.COOKIE_SECURE),
    }
    print(f"[Startup Env Check] {status}", flush=True)

    has_session_secret = bool(Config.SECRET_KEY)
    if not has_session_secret:
        print("[Startup Warning] SESSION_SECRET environment variable is missing. It must be set.", flush=True)

    flask_app = Flask(__name__)
    flask_app.config.from_object(Config)
    if not flask_app.secret_key:
        # Prevent crash on import; enforce strictly on auth routes
        flask_app.secret_key = "temporary-unset-secret-must-be-configured"

    flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

    oauth.init_app(flask_app)
    oauth.register(
        name="google",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    from services.oauth_state import init_oauth_state_storage
    init_oauth_state_storage(oauth.google)

    flask_app.after_request(apply_security_headers)

    @flask_app.before_request
    def csrf_check():
        if request.path.startswith("/api/auth") and not Config.SECRET_KEY:
            raise RuntimeError("SESSION_SECRET environment variable is missing. It must be set.")
        return check_csrf()

    @flask_app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @flask_app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @flask_app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    @flask_app.route("/api/health")
    def health():
        from config import _clean_env
        return jsonify({
            "status": "ok" if bool(Config.SECRET_KEY) else "session_secret_missing",
            "service": "latecomers-api",
            "env_check": {
                "SESSION_SECRET": bool(Config.SECRET_KEY),
                "FLASK_SECRET_KEY": bool(_clean_env(os.environ.get("FLASK_SECRET_KEY", ""))),
                "GOOGLE_CLIENT_ID": bool(Config.GOOGLE_CLIENT_ID),
                "GOOGLE_CLIENT_SECRET": bool(Config.GOOGLE_CLIENT_SECRET),
                "GOOGLE_REDIRECT_URI": bool(Config.GOOGLE_REDIRECT_URI),
                "DATABASE_URL": bool(Config.SQLALCHEMY_DATABASE_URI),
            }
        })

    @flask_app.route("/api/health/db")
    def health_db():
        from extensions import engine
        from sqlalchemy import text
        if not engine:
            return jsonify({"status": "failed"}), 500
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return jsonify({"status": "ok"}), 200
        except Exception as e:
            print(f"[Health DB] Check failed: {type(e).__name__}", flush=True)
            return jsonify({"status": "failed"}), 500

    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(settings_bp)
    flask_app.register_blueprint(users_bp)
    flask_app.register_blueprint(audit_bp)
    flask_app.register_blueprint(departments_bp)
    flask_app.register_blueprint(students_bp)
    flask_app.register_blueprint(late_arrivals_bp)
    flask_app.register_blueprint(dashboard_bp)
    flask_app.register_blueprint(exports_bp)

    return flask_app


try:
    app = _init_real_app()
except Exception as startup_err:
    err_msg = str(startup_err)
    err_type = type(startup_err).__name__
    tb_str = traceback.format_exc()
    sys.stderr.write(f"[STARTUP CRITICAL ERROR] {err_type}: {err_msg}\n{tb_str}\n")
    sys.stderr.flush()

    fallback_app = Flask("startup_error")

    @fallback_app.route("/api/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    @fallback_app.route("/api/health", methods=["GET"])
    @fallback_app.route("/api/health/db", methods=["GET"])
    @fallback_app.route("/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    @fallback_app.route("/", methods=["GET"])
    def startup_failure(subpath=None):
        return jsonify({
            "status": "error",
            "startup_error": err_msg,
            "error_type": err_type,
            "traceback": tb_str.splitlines(),
        }), 500

    app = fallback_app
