"""Late arrival routes — core functionality.

GET    /api/late-arrivals              — list with filters/sorting/pagination
POST   /api/late-arrivals              — create (staff+)
PUT    /api/late-arrivals/:id          — update (admin)
DELETE /api/late-arrivals/:id          — delete (admin)
GET    /api/late-arrivals/check-dup    — check duplicate for student+date
"""

from datetime import date, time, datetime
from flask import Blueprint, jsonify, request, g
from sqlalchemy import desc, func
from decorators import login_required, role_required
from extensions import get_db
from models import LateArrival, Student, Settings
from services.audit_service import log_audit

late_arrivals_bp = Blueprint("late_arrivals", __name__, url_prefix="/api/late-arrivals")


@late_arrivals_bp.route("", methods=["GET"])
@login_required
def list_late_arrivals():
    """List late arrivals with filters and server-side pagination."""
    db = next(get_db())
    try:
        query = db.query(LateArrival)

        # Filters
        date_val = request.args.get("date")
        if date_val:
            query = query.filter(LateArrival.date == date_val)

        date_from = request.args.get("from")
        if date_from:
            query = query.filter(LateArrival.date >= date_from)

        date_to = request.args.get("to")
        if date_to:
            query = query.filter(LateArrival.date <= date_to)

        student_search = request.args.get("search", "").strip()
        if student_search:
            like = f"%{student_search}%"
            student_ids = [s.id for s in db.query(Student).filter(
                (Student.name.ilike(like)) | (Student.register_number.ilike(like))
            ).all()]
            if student_ids:
                query = query.filter(LateArrival.student_id.in_(student_ids))
            else:
                query = query.filter(False)

        dept_id = request.args.get("department_id")
        if dept_id:
            dept_student_ids = [s.id for s in db.query(Student).filter(Student.department_id == int(dept_id)).all()]
            if dept_student_ids:
                query = query.filter(LateArrival.student_id.in_(dept_student_ids))
            else:
                query = query.filter(False)

        year = request.args.get("year")
        if year:
            yr_student_ids = [s.id for s in db.query(Student).filter(Student.year == int(year)).all()]
            if yr_student_ids:
                query = query.filter(LateArrival.student_id.in_(yr_student_ids))
            else:
                query = query.filter(False)

        reason = request.args.get("reason")
        if reason:
            query = query.filter(LateArrival.reason == reason)

        parent_informed = request.args.get("parent_informed")
        if parent_informed is not None and parent_informed != "":
            query = query.filter(LateArrival.parent_informed == (parent_informed == "true"))

        action = request.args.get("action_taken")
        if action:
            query = query.filter(LateArrival.action_taken == action)

        # Sort
        sort_by = request.args.get("sort", "date")
        sort_dir = request.args.get("dir", "desc")
        sort_col = getattr(LateArrival, sort_by, LateArrival.date)
        query = query.order_by(desc(sort_col) if sort_dir == "desc" else sort_col)

        # Pagination
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))

        total = query.count()
        entries = query.offset((page - 1) * per_page).limit(per_page).all()

        # Get previous late count for each student
        items = []
        for e in entries:
            d = e.to_dict()
            prev_count = db.query(func.count(LateArrival.id)).filter(
                LateArrival.student_id == e.student_id,
                LateArrival.id != e.id,
            ).scalar()
            d["previous_lates"] = prev_count
            items.append(d)

        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }), 200
    finally:
        db.close()


@late_arrivals_bp.route("", methods=["POST"])
@login_required
def create_late_arrival():
    """Create a new late arrival entry."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate student
        student_id = data.get("student_id")
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return jsonify({"error": "Student not found"}), 400

        # Get settings for reporting time
        settings = db.query(Settings).filter(Settings.id == 1).first()
        reporting_time = settings.reporting_time if settings else time(8, 25)

        # Validate date
        try:
            entry_date = date.fromisoformat(str(data.get("date", "")))
        except (ValueError, TypeError):
            return jsonify({"error": "Valid date is required (YYYY-MM-DD)"}), 400

        if entry_date > date.today():
            return jsonify({"error": "Future dates are not allowed"}), 400

        # Validate arrival time
        try:
            parts = str(data.get("arrival_time", "")).split(":")
            arrival = time(int(parts[0]), int(parts[1]))
        except (ValueError, IndexError, TypeError):
            return jsonify({"error": "Valid arrival time is required (HH:MM)"}), 400

        if arrival <= reporting_time:
            return jsonify({"error": f"Arrival time must be after reporting time ({reporting_time.strftime('%H:%M')})"}), 400

        # Validate reason
        reason = str(data.get("reason", "")).strip()
        if reason not in LateArrival.VALID_REASONS:
            return jsonify({"error": f"Invalid reason. Must be one of: {', '.join(LateArrival.VALID_REASONS)}"}), 400

        reason_other = None
        if reason == "Other":
            reason_other = str(data.get("reason_other", "")).strip()
            if not reason_other:
                return jsonify({"error": "Please specify the reason when 'Other' is selected"}), 400

        # Validate action
        action_taken = str(data.get("action_taken", "No Action")).strip()
        if action_taken not in LateArrival.VALID_ACTIONS:
            return jsonify({"error": f"Invalid action. Must be one of: {', '.join(LateArrival.VALID_ACTIONS)}"}), 400

        # Check for duplicate
        existing = db.query(LateArrival).filter(
            LateArrival.student_id == student_id,
            LateArrival.date == entry_date,
        ).first()
        if existing:
            return jsonify({
                "error": "A late arrival entry already exists for this student on this date",
                "duplicate": True,
            }), 409

        # Parent communication
        parent_informed = bool(data.get("parent_informed", False))
        parent_contact_date = None
        parent_contact_method = None
        parent_communication_remarks = None

        if parent_informed:
            if data.get("parent_contact_date"):
                try:
                    parent_contact_date = date.fromisoformat(str(data["parent_contact_date"]))
                except ValueError:
                    pass
            parent_contact_method = str(data.get("parent_contact_method", "")).strip() or None
            if parent_contact_method and parent_contact_method not in LateArrival.VALID_CONTACT_METHODS:
                return jsonify({"error": "Invalid contact method"}), 400
            parent_communication_remarks = str(data.get("parent_communication_remarks", "")).strip() or None

        entry = LateArrival(
            student_id=student_id,
            date=entry_date,
            arrival_time=arrival,
            reporting_time=reporting_time,
            reason=reason,
            reason_other=reason_other,
            action_taken=action_taken,
            remarks=str(data.get("remarks", "")).strip() or None,
            parent_informed=parent_informed,
            parent_contact_date=parent_contact_date,
            parent_contact_method=parent_contact_method,
            parent_communication_remarks=parent_communication_remarks,
            student_acknowledgement=str(data.get("student_acknowledgement", "")).strip() or None,
            recorded_by=g.current_user.id,  # Always from session, never from client
        )
        db.add(entry)
        db.commit()

        log_audit(
            "late_arrival_create",
            entity_type="late_arrival",
            entity_id=entry.id,
            details={"student_id": student_id, "date": str(entry_date)},
        )

        return jsonify(entry.to_dict()), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to create late arrival entry"}), 500
    finally:
        db.close()


@late_arrivals_bp.route("/<int:entry_id>", methods=["PUT"])
@login_required
@role_required("admin")
def update_late_arrival(entry_id):
    """Update a late arrival — admin only."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        entry = db.query(LateArrival).filter(LateArrival.id == entry_id).first()
        if not entry:
            return jsonify({"error": "Entry not found"}), 404

        changes = {}

        if "reason" in data:
            reason = str(data["reason"]).strip()
            if reason not in LateArrival.VALID_REASONS:
                return jsonify({"error": "Invalid reason"}), 400
            entry.reason = reason
            changes["reason"] = reason

        if "reason_other" in data:
            entry.reason_other = str(data["reason_other"]).strip() or None

        if "action_taken" in data:
            action = str(data["action_taken"]).strip()
            if action not in LateArrival.VALID_ACTIONS:
                return jsonify({"error": "Invalid action"}), 400
            entry.action_taken = action
            changes["action_taken"] = action

        if "remarks" in data:
            entry.remarks = str(data["remarks"]).strip() or None

        if "parent_informed" in data:
            entry.parent_informed = bool(data["parent_informed"])

        if "parent_contact_method" in data:
            method = str(data["parent_contact_method"]).strip() or None
            if method and method not in LateArrival.VALID_CONTACT_METHODS:
                return jsonify({"error": "Invalid contact method"}), 400
            entry.parent_contact_method = method

        if "parent_communication_remarks" in data:
            entry.parent_communication_remarks = str(data["parent_communication_remarks"]).strip() or None

        if "student_acknowledgement" in data:
            entry.student_acknowledgement = str(data["student_acknowledgement"]).strip() or None

        db.commit()

        log_audit("late_arrival_update", entity_type="late_arrival", entity_id=entry.id, details=changes)

        return jsonify(entry.to_dict()), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to update entry"}), 500
    finally:
        db.close()


@late_arrivals_bp.route("/<int:entry_id>", methods=["DELETE"])
@login_required
@role_required("admin")
def delete_late_arrival(entry_id):
    """Delete a late arrival — admin only."""
    db = next(get_db())
    try:
        entry = db.query(LateArrival).filter(LateArrival.id == entry_id).first()
        if not entry:
            return jsonify({"error": "Entry not found"}), 404

        details = {"student_id": entry.student_id, "date": str(entry.date)}
        db.delete(entry)
        db.commit()

        log_audit("late_arrival_delete", entity_type="late_arrival", entity_id=entry_id, details=details)

        return jsonify({"message": "Entry deleted"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to delete entry"}), 500
    finally:
        db.close()


@late_arrivals_bp.route("/check-dup", methods=["GET"])
@login_required
def check_duplicate():
    """Check if a late arrival already exists for student+date."""
    db = next(get_db())
    try:
        student_id = request.args.get("student_id")
        date_val = request.args.get("date")
        if not student_id or not date_val:
            return jsonify({"exists": False}), 200

        existing = db.query(LateArrival).filter(
            LateArrival.student_id == int(student_id),
            LateArrival.date == date_val,
        ).first()

        return jsonify({"exists": existing is not None}), 200
    finally:
        db.close()
