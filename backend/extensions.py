"""SQLAlchemy and Authlib extension instances."""

from sqlalchemy import create_engine, NullPool
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from authlib.integrations.flask_client import OAuth
from backend.config import Config


class Base(DeclarativeBase):
    pass


def _build_engine():
    url = Config.SQLALCHEMY_DATABASE_URI
    if not url:
        return None
    return create_engine(
        url,
        poolclass=NullPool,
        echo=False,
        connect_args={
            "options": "-c statement_timeout=30000",
            "prepare_threshold": 0,
        },
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False) if engine else None

oauth = OAuth()


def get_db():
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
