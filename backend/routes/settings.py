"""Settings routes: read/update college settings (single-row table)."""

from flask import Blueprint, jsonify, request, g
from decorators import login_required, role_required
from extensions import get_db
from models import Settings
from services.audit_service import log_audit

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.route("", methods=["GET"])
@login_required
def get_settings():
    db = next(get_db())
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            return jsonify({
                "college_name": "Don Bosco College of Arts and Science",
                "reporting_time": "08:25",
                "repeat_threshold": 3,
                "semester_label": "",
            }), 200
        return jsonify(settings.to_dict()), 200
    finally:
        db.close()


@settings_bp.route("", methods=["PUT"])
@login_required
@role_required("admin")
def update_settings():
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        settings = db.query(Settings).filter(Settings.id == 1).first()
        if not settings:
            settings = Settings(id=1)
            db.add(settings)

        if "college_name" in data:
            name = str(data["college_name"]).strip()
            if not name or len(name) > 200:
                return jsonify({"error": "College name must be 1-200 characters"}), 400
            settings.college_name = name

        if "reporting_time" in data:
            rt = str(data["reporting_time"]).strip()
            try:
                parts = rt.split(":")
                h, m = int(parts[0]), int(parts[1])
                if not (0 <= h <= 23 and 0 <= m <= 59):
                    raise ValueError
            except (ValueError, IndexError):
                return jsonify({"error": "Reporting time must be HH:MM (00:00-23:59)"}), 400
            from datetime import time
            settings.reporting_time = time(h, m)

        if "repeat_threshold" in data:
            try:
                threshold = int(data["repeat_threshold"])
                if threshold < 1:
                    raise ValueError
            except (ValueError, TypeError):
                return jsonify({"error": "Repeat threshold must be a positive integer"}), 400
            settings.repeat_threshold = threshold

        if "semester_label" in data:
            label = str(data["semester_label"]).strip()
            if len(label) > 100:
                return jsonify({"error": "Semester label must be 100 chars max"}), 400
            settings.semester_label = label

        settings.updated_by = g.current_user.id
        db.commit()

        log_audit("settings_update", entity_type="settings", entity_id=1, details=data)

        return jsonify(settings.to_dict()), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to update settings"}), 500
    finally:
        db.close()
