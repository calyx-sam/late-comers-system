"""Flask application factory — entry point for Vercel serverless function."""

from flask import Flask, jsonify
from backend.config import Config
from backend.middleware import apply_security_headers, check_csrf
from backend.extensions import oauth
from backend.routes.auth import auth_bp
from backend.routes.settings import settings_bp
from backend.routes.users import users_bp
from backend.routes.audit import audit_bp
from backend.routes.departments import departments_bp
from backend.routes.students import students_bp
from backend.routes.late_arrivals import late_arrivals_bp
from backend.routes.dashboard import dashboard_bp
from backend.routes.exports import exports_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

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
