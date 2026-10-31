"""Session management service — create, validate, revoke sessions."""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from backend.config import Config
from backend.models import Session, User


def generate_session_token():
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db, user_id: int) -> str:
    raw_token = generate_session_token()
    token_hash = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=Config.SESSION_ABSOLUTE_LIFETIME_HOURS)

    session = Session(
        token_hash=token_hash,
        user_id=user_id,
        created_at=now,
        expires_at=expires_at,
        last_seen=now,
        revoked=False,
    )
    db.add(session)
    db.commit()
    return raw_token


def validate_session(db, raw_token: str):
    token_hash = hash_token(raw_token)
    session = (
        db.query(Session)
        .filter(Session.token_hash == token_hash, Session.revoked == False)
        .first()
    )
    if not session:
        return None, None

    now = datetime.now(timezone.utc)

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    last_seen = session.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)

    if now > expires_at:
        session.revoked = True
        db.commit()
        return None, None

    idle_limit = timedelta(minutes=Config.SESSION_IDLE_TIMEOUT_MINUTES)
    if now - last_seen > idle_limit:
        session.revoked = True
        db.commit()
        return None, None

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        session.revoked = True
        db.commit()
        return None, None

    session.last_seen = now
    db.commit()
    return user, session


def revoke_session(db, raw_token: str):
    token_hash = hash_token(raw_token)
    session = db.query(Session).filter(Session.token_hash == token_hash).first()
    if session:
        session.revoked = True
        db.commit()


def revoke_all_user_sessions(db, user_id: int):
    db.query(Session).filter(
        Session.user_id == user_id,
        Session.revoked == False,
    ).update({"revoked": True})
    db.commit()
