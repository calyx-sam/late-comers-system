"""OAuth state and nonce persistence for serverless environments.

Ensures OAuth state/nonce is NOT stored in process memory.
Stores state/nonce in:
1. Signed Flask session cookie (HttpOnly, Secure, SameSite=Lax, Path=/).
2. Database table `oauth_states` so any serverless instance can validate it.
"""

import json
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from extensions import engine
from config import Config


_table_checked = False

def ensure_oauth_states_table():
    """Ensure oauth_states table exists in database (lazy check)."""
    global _table_checked
    if _table_checked or not engine:
        return
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS oauth_states (
                    key         TEXT PRIMARY KEY,
                    value       TEXT NOT NULL,
                    expires_at  TIMESTAMPTZ NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
            """))
            conn.commit()
            _table_checked = True
    except Exception as e:
        print(f"[OAuth State DB Warning] Table check failed: {type(e).__name__}", flush=True)


def init_oauth_state_storage(google_app):
    """
    Hook Authlib's state storage methods to persist in both signed Flask session cookie
    and database table `oauth_states`.
    """
    orig_set = google_app.framework.set_state_data
    orig_get = google_app.framework.get_state_data
    orig_clear = google_app.framework.clear_state_data

    def custom_set_state(session_obj, state, data):
        # 1. Store in signed Flask session cookie
        try:
            orig_set(session_obj, state, data)
            if hasattr(session_obj, "permanent"):
                session_obj.permanent = True
        except Exception as e:
            print(f"[OAuth State Session Warning] Could not set session cookie: {type(e).__name__}", flush=True)

        # 2. Store in database table `oauth_states` so any serverless instance can validate it
        if engine and state:
            ensure_oauth_states_table()
            key = f"_state_{google_app.name}_{state}"
            try:
                expires_in = getattr(google_app.framework, "expires_in", 600) or 600
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                val_json = json.dumps(data)
                with engine.connect() as conn:
                    conn.execute(
                        text("""
                            INSERT INTO oauth_states (key, value, expires_at)
                            VALUES (:key, :val, :exp)
                            ON CONFLICT (key) DO UPDATE SET value = :val, expires_at = :exp
                        """),
                        {"key": key, "val": val_json, "exp": expires_at}
                    )
                    conn.commit()
            except Exception as e:
                print(f"[OAuth State DB Warning] Could not persist state to DB: {type(e).__name__}", flush=True)

    def custom_get_state(session_obj, state):
        key = f"_state_{google_app.name}_{state}"
        data = None

        # 1. Try signed Flask session cookie first
        try:
            val = session_obj.get(key)
            if val and isinstance(val, dict):
                exp = val.get("exp")
                if not exp or exp > time.time():
                    data = val.get("data")
        except Exception:
            pass

        if data:
            if not data.get("redirect_uri") and Config.GOOGLE_REDIRECT_URI:
                data["redirect_uri"] = Config.GOOGLE_REDIRECT_URI
            return data

        # 2. Try database table `oauth_states` for cross-instance / serverless validation
        if engine and state:
            try:
                now = datetime.now(timezone.utc)
                with engine.connect() as conn:
                    row = conn.execute(
                        text("SELECT value FROM oauth_states WHERE key = :key AND expires_at > :now"),
                        {"key": key, "now": now}
                    ).fetchone()
                    if row and row[0]:
                        db_data = json.loads(row[0])
                        if not db_data.get("redirect_uri") and Config.GOOGLE_REDIRECT_URI:
                            db_data["redirect_uri"] = Config.GOOGLE_REDIRECT_URI
                        return db_data
            except Exception as e:
                print(f"[OAuth State DB Warning] Could not retrieve state from DB: {type(e).__name__}", flush=True)

        return None

    def custom_clear_state(session_obj, state):
        # 1. Clear from session
        try:
            orig_clear(session_obj, state)
        except Exception:
            pass

        # 2. Clear from database table `oauth_states`
        if engine and state:
            key = f"_state_{google_app.name}_{state}"
            try:
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM oauth_states WHERE key = :key"), {"key": key})
                    conn.commit()
            except Exception as e:
                print(f"[OAuth State DB Warning] Could not clear state from DB: {type(e).__name__}", flush=True)

    google_app.framework.set_state_data = custom_set_state
    google_app.framework.get_state_data = custom_get_state
    google_app.framework.clear_state_data = custom_clear_state
