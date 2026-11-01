"""Flask application factory — entry point for Vercel serverless function."""

import sys
import os

# Ensure backend directory is in sys.path for top-level imports
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from flask import Flask, jsonify
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


def check_required_env():
    """Check required environment variables and log presence only (true/false). Never logs values."""
    status = {
        "DATABASE_URL": bool(Config.SQLALCHEMY_DATABASE_URI),
        "SESSION_SECRET": bool(Config.SECRET_KEY and Config.SECRET_KEY != "CHANGE-ME-IN-PRODUCTION"),
        "GOOGLE_CLIENT_ID": bool(Config.GOOGLE_CLIENT_ID),
        "GOOGLE_CLIENT_SECRET": bool(Config.GOOGLE_CLIENT_SECRET),
        "GOOGLE_REDIRECT_URI": bool(Config.GOOGLE_REDIRECT_URI),
        "COOKIE_SECURE": bool(Config.COOKIE_SECURE),
    }
    print(f"[Startup Env Check] {status}", flush=True)


def create_app():
    check_required_env()

    app = Flask(__name__)
    app.config.from_object(Config)

    # Support Vercel reverse proxy headers (https proto and forwarded host)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

    # Authlib OAuth
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

    # Middleware
    app.after_request(apply_security_headers)

    @app.before_request
    def csrf_check():
        return check_csrf()

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    # Health check
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "latecomers-api"})

    @app.route("/api/health/db")
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

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(late_arrivals_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(exports_bp)

    return app


app = create_app()
