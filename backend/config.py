"""Flask application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""

    # Flask
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION")
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    # Database — Supabase transaction pooler (port 6543)
    _db_url = os.environ.get("DATABASE_URL", "")
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "connect_args": {
            "options": "-c statement_timeout=30000",
        },
    }

    # Google OAuth2
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()

    # Optional domain restriction
    ALLOWED_EMAIL_DOMAIN = os.environ.get("ALLOWED_EMAIL_DOMAIN", "")

    # Session lifetimes
    SESSION_ABSOLUTE_LIFETIME_HOURS = int(
        os.environ.get("SESSION_ABSOLUTE_LIFETIME_HOURS", "8")
    )
    SESSION_IDLE_TIMEOUT_MINUTES = int(
        os.environ.get("SESSION_IDLE_TIMEOUT_MINUTES", "30")
    )

    # Frontend URL for OAuth redirect (dev: http://localhost:5173, prod: empty = same origin)
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
