"""Department routes — admin write, staff read.

GET    /api/departments           — list all
POST   /api/departments           — create (admin)
PUT    /api/departments/:id       — update (admin)
"""

from flask import Blueprint, jsonify, request, g
from backend.decorators import login_required, role_required
from backend.extensions import get_db
from backend.models import Department
from backend.services.audit_service import log_audit

departments_bp = Blueprint("departments", __name__, url_prefix="/api/departments")


@departments_bp.route("", methods=["GET"])
@login_required
def list_departments():
    """List all departments — any authenticated user."""
    db = next(get_db())
    try:
        show_inactive = request.args.get("include_inactive") == "true"
        query = db.query(Department)
        if not show_inactive:
            query = query.filter(Department.is_active == True)
        depts = query.order_by(Department.name).all()
        return jsonify([d.to_dict() for d in depts]), 200
    finally:
        db.close()


@departments_bp.route("", methods=["POST"])
@login_required
@role_required("admin")
def create_department():
    """Create a new department — admin only."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        name = str(data.get("name", "")).strip()
        code = str(data.get("code", "")).strip().upper()

        if not name or len(name) > 200:
            return jsonify({"error": "Department name is required (max 200 chars)"}), 400
        if not code or len(code) > 20:
            return jsonify({"error": "Department code is required (max 20 chars)"}), 400

        # Check duplicates
        existing = db.query(Department).filter(
            (Department.name == name) | (Department.code == code)
        ).first()
        if existing:
            return jsonify({"error": "A department with this name or code already exists"}), 409

        dept = Department(name=name, code=code, is_active=True)
        db.add(dept)
        db.commit()

        log_audit(
            "department_create",
            entity_type="department",
            entity_id=dept.id,
            details={"name": name, "code": code},
        )

        return jsonify(dept.to_dict()), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to create department"}), 500
    finally:
        db.close()


@departments_bp.route("/<int:dept_id>", methods=["PUT"])
@login_required
@role_required("admin")
def update_department(dept_id):
    """Update a department — admin only."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            return jsonify({"error": "Department not found"}), 404

        changes = {}

        if "name" in data:
            name = str(data["name"]).strip()
            if not name or len(name) > 200:
                return jsonify({"error": "Department name is required (max 200 chars)"}), 400
            # Check unique
            dup = db.query(Department).filter(
                Department.name == name, Department.id != dept_id
            ).first()
            if dup:
                return jsonify({"error": "A department with this name already exists"}), 409
            dept.name = name
            changes["name"] = name

        if "code" in data:
            code = str(data["code"]).strip().upper()
            if not code or len(code) > 20:
                return jsonify({"error": "Department code is required (max 20 chars)"}), 400
            dup = db.query(Department).filter(
                Department.code == code, Department.id != dept_id
            ).first()
            if dup:
                return jsonify({"error": "A department with this code already exists"}), 409
            dept.code = code
            changes["code"] = code

        if "is_active" in data:
            dept.is_active = bool(data["is_active"])
            changes["is_active"] = dept.is_active

        db.commit()

        log_audit(
            "department_update",
            entity_type="department",
            entity_id=dept.id,
            details=changes,
        )

        return jsonify(dept.to_dict()), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to update department"}), 500
    finally:
        db.close()
