"""Student routes — admin write, staff read, CSV import.

GET    /api/students              — list with search/filters/pagination
GET    /api/students/search       — autocomplete search
GET    /api/students/:id          — single student
POST   /api/students              — create (admin)
PUT    /api/students/:id          — update (admin)
POST   /api/students/import       — CSV import (admin)
"""

import csv
import io
from flask import Blueprint, jsonify, request, g
from decorators import login_required, role_required
from extensions import get_db
from models import Student, Department
from services.audit_service import log_audit

students_bp = Blueprint("students", __name__, url_prefix="/api/students")

MAX_CSV_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_CSV_ROWS = 5000


@students_bp.route("", methods=["GET"])
@login_required
def list_students():
    """List students with optional filters and pagination."""
    db = next(get_db())
    try:
        query = db.query(Student)

        # Filters
        search = request.args.get("search", "").strip()
        if search:
            like = f"%{search}%"
            query = query.filter(
                (Student.name.ilike(like)) | (Student.register_number.ilike(like))
            )

        dept_id = request.args.get("department_id")
        if dept_id:
            try:
                query = query.filter(Student.department_id == int(dept_id))
            except ValueError:
                pass

        year = request.args.get("year")
        if year:
            try:
                query = query.filter(Student.year == int(year))
            except ValueError:
                pass

        show_inactive = request.args.get("include_inactive") == "true"
        if not show_inactive:
            query = query.filter(Student.is_active == True)

        # Pagination
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))

        total = query.count()
        students = (
            query.order_by(Student.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return jsonify({
            "items": [s.to_dict() for s in students],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        }), 200
    finally:
        db.close()


@students_bp.route("/search", methods=["GET"])
@login_required
def search_students():
    """Autocomplete search — returns up to 10 matching students."""
    db = next(get_db())
    try:
        q = request.args.get("q", "").strip()
        if len(q) < 2:
            return jsonify([]), 200

        like = f"%{q}%"
        students = (
            db.query(Student)
            .filter(
                Student.is_active == True,
                (Student.name.ilike(like)) | (Student.register_number.ilike(like)),
            )
            .order_by(Student.name)
            .limit(10)
            .all()
        )

        return jsonify([s.to_dict(mask_phone=False) for s in students]), 200
    finally:
        db.close()


@students_bp.route("/<int:student_id>", methods=["GET"])
@login_required
def get_student(student_id):
    """Get a single student by ID."""
    db = next(get_db())
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return jsonify({"error": "Student not found"}), 404
        return jsonify(student.to_dict(mask_phone=False)), 200
    finally:
        db.close()


@students_bp.route("", methods=["POST"])
@login_required
@role_required("admin")
def create_student():
    """Create a new student — admin only."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        errors = _validate_student_data(data, db)
        if errors:
            return jsonify({"error": errors[0]}), 400

        student = Student(
            register_number=str(data["register_number"]).strip().upper(),
            name=str(data["name"]).strip(),
            department_id=int(data["department_id"]),
            year=int(data["year"]),
            section=str(data.get("section", "A")).strip().upper(),
            guardian_name=str(data.get("guardian_name", "")).strip() or None,
            guardian_phone=str(data.get("guardian_phone", "")).strip() or None,
            is_active=True,
        )
        db.add(student)
        db.commit()

        log_audit(
            "student_create",
            entity_type="student",
            entity_id=student.id,
            details={"register_number": student.register_number, "name": student.name},
        )

        return jsonify(student.to_dict()), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to create student"}), 500
    finally:
        db.close()


@students_bp.route("/<int:student_id>", methods=["PUT"])
@login_required
@role_required("admin")
def update_student(student_id):
    """Update a student — admin only."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return jsonify({"error": "Student not found"}), 404

        changes = {}

        if "name" in data:
            name = str(data["name"]).strip()
            if not name or len(name) > 200:
                return jsonify({"error": "Name is required (max 200 chars)"}), 400
            student.name = name
            changes["name"] = name

        if "register_number" in data:
            rn = str(data["register_number"]).strip().upper()
            if not rn or len(rn) > 50:
                return jsonify({"error": "Register number is required (max 50 chars)"}), 400
            dup = db.query(Student).filter(
                Student.register_number == rn, Student.id != student_id
            ).first()
            if dup:
                return jsonify({"error": f"Register number {rn} already exists"}), 409
            student.register_number = rn
            changes["register_number"] = rn

        if "department_id" in data:
            try:
                dept_id = int(data["department_id"])
                dept = db.query(Department).filter(Department.id == dept_id).first()
                if not dept:
                    return jsonify({"error": "Department not found"}), 400
                student.department_id = dept_id
                changes["department_id"] = dept_id
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid department"}), 400

        if "year" in data:
            try:
                yr = int(data["year"])
                if yr < 1 or yr > 5:
                    raise ValueError
                student.year = yr
                changes["year"] = yr
            except (ValueError, TypeError):
                return jsonify({"error": "Year must be 1-5"}), 400

        if "section" in data:
            student.section = str(data["section"]).strip().upper() or "A"
            changes["section"] = student.section

        if "guardian_name" in data:
            student.guardian_name = str(data["guardian_name"]).strip() or None
            changes["guardian_name"] = student.guardian_name

        if "guardian_phone" in data:
            student.guardian_phone = str(data["guardian_phone"]).strip() or None
            changes["guardian_phone"] = "***"  # Don't log full phone

        if "is_active" in data:
            student.is_active = bool(data["is_active"])
            changes["is_active"] = student.is_active

        db.commit()

        log_audit(
            "student_update",
            entity_type="student",
            entity_id=student.id,
            details=changes,
        )

        return jsonify(student.to_dict()), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to update student"}), 500
    finally:
        db.close()


@students_bp.route("/import", methods=["POST"])
@login_required
@role_required("admin")
def import_students():
    """CSV import — admin only. Max 2 MB, 5000 rows.

    Required columns: register_number, name, department_code, year
    Optional columns: section, guardian_name, guardian_phone
    """
    db = next(get_db())
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if not file.filename or not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv files are accepted"}), 400

        # Size check
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_CSV_SIZE:
            return jsonify({"error": f"File too large. Maximum size is {MAX_CSV_SIZE // (1024*1024)} MB"}), 400

        # Read CSV
        try:
            content = file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return jsonify({"error": "File must be UTF-8 encoded"}), 400

        reader = csv.DictReader(io.StringIO(content))

        # Validate headers
        required_cols = {"register_number", "name", "department_code", "year"}
        if not reader.fieldnames:
            return jsonify({"error": "CSV file is empty or has no headers"}), 400
        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = required_cols - headers
        if missing:
            return jsonify({"error": f"Missing required columns: {', '.join(sorted(missing))}"}), 400

        # Load departments for lookup
        depts = {d.code: d.id for d in db.query(Department).filter(Department.is_active == True).all()}

        # Process rows
        created = 0
        skipped = 0
        errors = []
        rows = list(reader)

        if len(rows) > MAX_CSV_ROWS:
            return jsonify({"error": f"Too many rows. Maximum is {MAX_CSV_ROWS}"}), 400

        for i, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
            rn = str(row.get("register_number", "")).strip().upper()
            name = str(row.get("name", "")).strip()
            dept_code = str(row.get("department_code", "")).strip().upper()
            year_str = str(row.get("year", "")).strip()
            section = str(row.get("section", "A")).strip().upper() or "A"
            guardian_name = str(row.get("guardian_name", "")).strip() or None
            guardian_phone = str(row.get("guardian_phone", "")).strip() or None

            # Validate
            row_errors = []
            if not rn:
                row_errors.append("register_number is required")
            if len(rn) > 50:
                row_errors.append("register_number too long")
            if not name:
                row_errors.append("name is required")
            if len(name) > 200:
                row_errors.append("name too long")
            if dept_code not in depts:
                row_errors.append(f"unknown department_code '{dept_code}'")

            try:
                yr = int(year_str)
                if yr < 1 or yr > 5:
                    row_errors.append("year must be 1-5")
            except ValueError:
                row_errors.append("year must be a number 1-5")
                yr = 0

            if row_errors:
                errors.append({"row": i, "errors": row_errors})
                skipped += 1
                continue

            # Check duplicate
            existing = db.query(Student).filter(Student.register_number == rn).first()
            if existing:
                skipped += 1
                errors.append({"row": i, "errors": [f"register_number '{rn}' already exists"]})
                continue

            student = Student(
                register_number=rn,
                name=name,
                department_id=depts[dept_code],
                year=yr,
                section=section,
                guardian_name=guardian_name,
                guardian_phone=guardian_phone,
                is_active=True,
            )
            db.add(student)
            created += 1

        db.commit()

        log_audit(
            "student_import",
            entity_type="student",
            details={
                "filename": file.filename,
                "total_rows": len(rows),
                "created": created,
                "skipped": skipped,
            },
        )

        return jsonify({
            "message": f"Import complete: {created} created, {skipped} skipped",
            "created": created,
            "skipped": skipped,
            "errors": errors[:50],  # Limit error details
        }), 200 if not errors else 207
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to import students"}), 500
    finally:
        db.close()


def _validate_student_data(data, db):
    """Validate student creation data. Returns list of error messages."""
    errors = []
    rn = str(data.get("register_number", "")).strip()
    if not rn or len(rn) > 50:
        errors.append("Register number is required (max 50 chars)")
    else:
        existing = db.query(Student).filter(Student.register_number == rn.upper()).first()
        if existing:
            errors.append(f"Register number {rn} already exists")

    name = str(data.get("name", "")).strip()
    if not name or len(name) > 200:
        errors.append("Name is required (max 200 chars)")

    try:
        dept_id = int(data.get("department_id", 0))
        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            errors.append("Department not found")
    except (ValueError, TypeError):
        errors.append("Valid department is required")

    try:
        yr = int(data.get("year", 0))
        if yr < 1 or yr > 5:
            errors.append("Year must be 1-5")
    except (ValueError, TypeError):
        errors.append("Year must be a number 1-5")

    return errors
