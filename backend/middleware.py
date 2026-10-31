"""Security middleware: headers, CSRF checks."""

from flask import request, jsonify


def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com; "
        "frame-src https://accounts.google.com; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    return response


STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_EXEMPT_PATHS = {"/api/auth/callback", "/api/auth/login", "/api/auth/google/callback"}


def check_csrf():
    if request.method not in STATE_CHANGING_METHODS:
        return None
    if request.path in CSRF_EXEMPT_PATHS:
        return None
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        return jsonify({"error": "CSRF token missing"}), 403
    origin = request.headers.get("Origin")
    if origin:
        host = request.host_url.rstrip("/")
        if not origin.startswith(host):
            if not (origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1")):
                return jsonify({"error": "Origin mismatch"}), 403
    return None
