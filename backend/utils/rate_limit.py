"""Database-backed rate limiter for serverless (no in-memory state).

Uses the rate_limits table for tracking request counts per key per window.
"""

from datetime import datetime, timezone, timedelta
from flask import request, jsonify
from extensions import get_db
from models import RateLimit


def check_rate_limit(key_prefix, max_requests=10, window_seconds=60):
    """Check and increment rate limit. Returns (allowed, remaining, retry_after).

    Args:
        key_prefix: e.g. 'login', 'search', 'export'
        max_requests: max requests per window
        window_seconds: window duration in seconds

    Returns:
        (True, remaining) if allowed, (False, 0, retry_after_seconds) if blocked
    """
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip and "," in ip:
        ip = ip.split(",")[0].strip()

    key = f"{key_prefix}:{ip}"
    now = datetime.now(timezone.utc)
    window_start = now.replace(second=0, microsecond=0)  # Round to minute

    db = next(get_db())
    try:
        entry = db.query(RateLimit).filter(
            RateLimit.key == key,
            RateLimit.window_start == window_start,
        ).first()

        if entry:
            if entry.hit_count >= max_requests:
                return False, 0
            entry.hit_count += 1
            db.commit()
            return True, max_requests - entry.hit_count
        else:
            entry = RateLimit(key=key, window_start=window_start, hit_count=1)
            db.add(entry)
            db.commit()
            return True, max_requests - 1

    except Exception:
        db.rollback()
        return True, max_requests  # Fail open
    finally:
        db.close()


def rate_limit_response():
    """Return a 429 Too Many Requests response."""
    return jsonify({"error": "Too many requests. Please try again later."}), 429


def cleanup_old_rate_limits():
    """Remove rate limit entries older than 1 hour. Call periodically."""
    db = next(get_db())
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        db.query(RateLimit).filter(RateLimit.window_start < cutoff).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
