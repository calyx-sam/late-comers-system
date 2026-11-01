"""Flask application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


def _clean_env(val: str) -> str:
    """Strip leading/trailing whitespace and surrounding single/double quotes."""
    if not val:
        return ""
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val


class Config:
    """Base configuration."""

    # Flask & Session Secret (fixed value from SESSION_SECRET or FLASK_SECRET_KEY)
    SECRET_KEY = (
        _clean_env(os.environ.get("SESSION_SECRET", ""))
        or _clean_env(os.environ.get("FLASK_SECRET_KEY", ""))
        or "c4774a3f5a1bb6705db8ea9e51c6c8e31766c299c8942b03fa723fa8d7a46c3b"
    )
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    # Session cookie configuration
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_NAME = "session"
    PERMANENT_SESSION_LIFETIME = 3600 * 8

    # Database — Supabase transaction pooler (port 6543)
    _db_url = _clean_env(os.environ.get("DATABASE_URL", ""))
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif _db_url.startswith("postgresql://") and "+psycopg2" not in _db_url:
        _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "connect_args": {
            "options": "-c statement_timeout=30000",
        },
    }

    # Google OAuth2 (cleaned of quotes and whitespace)
    GOOGLE_CLIENT_ID = _clean_env(os.environ.get("GOOGLE_CLIENT_ID", ""))
    GOOGLE_CLIENT_SECRET = _clean_env(os.environ.get("GOOGLE_CLIENT_SECRET", ""))
    GOOGLE_REDIRECT_URI = _clean_env(os.environ.get("GOOGLE_REDIRECT_URI", ""))

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
