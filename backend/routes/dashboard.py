"""Dashboard and reports routes.

GET /api/dashboard          — stats + chart data
GET /api/reports/repeated   — repeated late arrivals
GET /api/reports/department — department-wise summary
GET /api/reports/monthly    — monthly summary
GET /api/parent-communications — parent communication log
POST /api/parent-communications — log communication
"""

from datetime import date, timedelta
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func, desc
from decorators import login_required, role_required
from extensions import get_db
from models import (
    LateArrival, Student, Department, Settings,
    ParentCommunication, User,
)
from services.audit_service import log_audit

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api")


@dashboard_bp.route("/dashboard", methods=["GET"])
@login_required
def dashboard():
    """Dashboard stats and chart data."""
    db = next(get_db())
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        threshold = settings.repeat_threshold if settings else 3

        # Date range
        date_from = request.args.get("from", str(date.today().replace(day=1)))
        date_to = request.args.get("to", str(date.today()))
        dept_id = request.args.get("department_id")

        today = date.today()

        # Base query with optional department filter
        base = db.query(LateArrival)
        if dept_id:
            dept_students = [s.id for s in db.query(Student).filter(Student.department_id == int(dept_id)).all()]
            if dept_students:
                base = base.filter(LateArrival.student_id.in_(dept_students))
            else:
                base = base.filter(False)

        # Stats
        total_students = db.query(func.count(Student.id)).filter(Student.is_active == True).scalar()
        late_today = base.filter(LateArrival.date == today).count()
        late_period = base.filter(LateArrival.date >= date_from, LateArrival.date <= date_to).count()

        # Department with most lates
        dept_counts = (
            db.query(Department.name, func.count(LateArrival.id).label("cnt"))
            .join(Student, Student.department_id == Department.id)
            .join(LateArrival, LateArrival.student_id == Student.id)
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(Department.name)
            .order_by(desc("cnt"))
            .all()
        )
        top_dept = dept_counts[0] if dept_counts else None

        # Repeat late arrivals (>= threshold)
        repeat_students = (
            db.query(func.count(func.distinct(LateArrival.student_id)))
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(LateArrival.student_id)
            .having(func.count(LateArrival.id) >= threshold)
            .all()
        )
        repeat_count = len(repeat_students)

        # Parent notifications
        parent_notified = base.filter(
            LateArrival.date >= date_from,
            LateArrival.date <= date_to,
            LateArrival.parent_informed == True,
        ).count()

        # Charts — department-wise bar
        dept_chart = [{"name": name, "count": cnt} for name, cnt in dept_counts]

        # Charts — daily trend
        daily = (
            db.query(LateArrival.date, func.count(LateArrival.id))
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(LateArrival.date)
            .order_by(LateArrival.date)
            .all()
        )
        daily_chart = [{"date": str(d), "count": c} for d, c in daily]

        return jsonify({
            "stats": {
                "total_students": total_students,
                "late_today": late_today,
                "late_period": late_period,
                "top_department": {"name": top_dept[0], "count": top_dept[1]} if top_dept else None,
                "repeat_count": repeat_count,
                "parent_notified": parent_notified,
                "threshold": threshold,
            },
            "charts": {
                "department": dept_chart,
                "daily": daily_chart,
            },
        }), 200
    finally:
        db.close()


@dashboard_bp.route("/reports/repeated", methods=["GET"])
@login_required
def repeated_late_arrivals():
    """Students with late count >= threshold."""
    db = next(get_db())
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        threshold = int(request.args.get("threshold", settings.repeat_threshold if settings else 3))

        date_from = request.args.get("from", str(date.today().replace(day=1)))
        date_to = request.args.get("to", str(date.today()))
        dept_id = request.args.get("department_id")
        year = request.args.get("year")

        # Students with count >= threshold
        q = (
            db.query(Student, func.count(LateArrival.id).label("late_count"))
            .join(LateArrival, LateArrival.student_id == Student.id)
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
        )
        if dept_id:
            q = q.filter(Student.department_id == int(dept_id))
        if year:
            q = q.filter(Student.year == int(year))

        q = q.group_by(Student.id).having(func.count(LateArrival.id) >= threshold)
        results = q.order_by(desc("late_count")).all()

        items = []
        for student, count in results:
            # Get history
            history = db.query(LateArrival).filter(
                LateArrival.student_id == student.id,
                LateArrival.date >= date_from,
                LateArrival.date <= date_to,
            ).order_by(desc(LateArrival.date)).all()

            items.append({
                **student.to_dict(),
                "late_count": count,
                "history": [h.to_dict() for h in history],
            })

        return jsonify({
            "items": items,
            "threshold": threshold,
            "date_from": date_from,
            "date_to": date_to,
        }), 200
    finally:
        db.close()


@dashboard_bp.route("/reports/department", methods=["GET"])
@login_required
def department_report():
    """Department-wise late arrival summary."""
    db = next(get_db())
    try:
        date_from = request.args.get("from", str(date.today().replace(day=1)))
        date_to = request.args.get("to", str(date.today()))

        results = (
            db.query(
                Department.name,
                Department.code,
                func.count(LateArrival.id).label("total_lates"),
                func.count(func.distinct(LateArrival.student_id)).label("unique_students"),
            )
            .join(Student, Student.department_id == Department.id)
            .join(LateArrival, LateArrival.student_id == Student.id)
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(Department.name, Department.code)
            .order_by(desc("total_lates"))
            .all()
        )

        return jsonify({
            "items": [
                {"department": name, "code": code, "total_lates": total, "unique_students": unique}
                for name, code, total, unique in results
            ],
            "date_from": date_from,
            "date_to": date_to,
        }), 200
    finally:
        db.close()


@dashboard_bp.route("/reports/monthly", methods=["GET"])
@login_required
def monthly_report():
    """Monthly summary grouped by month."""
    db = next(get_db())
    try:
        year_val = int(request.args.get("year", date.today().year))

        results = (
            db.query(
                func.extract("month", LateArrival.date).label("month"),
                func.count(LateArrival.id).label("total"),
                func.count(func.distinct(LateArrival.student_id)).label("unique_students"),
            )
            .filter(func.extract("year", LateArrival.date) == year_val)
            .group_by("month")
            .order_by("month")
            .all()
        )

        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        items = []
        for month_num, total, unique in results:
            items.append({
                "month": months[int(month_num) - 1],
                "month_num": int(month_num),
                "total_lates": total,
                "unique_students": unique,
            })

        return jsonify({"items": items, "year": year_val}), 200
    finally:
        db.close()


@dashboard_bp.route("/parent-communications", methods=["GET"])
@login_required
def list_parent_communications():
    """List parent/guardian communications."""
    db = next(get_db())
    try:
        query = db.query(ParentCommunication)

        student_id = request.args.get("student_id")
        if student_id:
            query = query.filter(ParentCommunication.student_id == int(student_id))

        date_from = request.args.get("from")
        if date_from:
            query = query.filter(ParentCommunication.contact_date >= date_from)

        date_to = request.args.get("to")
        if date_to:
            query = query.filter(ParentCommunication.contact_date <= date_to)

        method = request.args.get("method")
        if method:
            query = query.filter(ParentCommunication.contact_method == method)

        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))

        total = query.count()
        entries = query.order_by(desc(ParentCommunication.contact_date)).offset((page - 1) * per_page).limit(per_page).all()

        return jsonify({
            "items": [e.to_dict() for e in entries],
            "total": total,
            "page": page,
            "pages": (total + per_page - 1) // per_page,
        }), 200
    finally:
        db.close()


@dashboard_bp.route("/parent-communications", methods=["POST"])
@login_required
def create_parent_communication():
    """Log a parent/guardian communication."""
    db = next(get_db())
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        student_id = data.get("student_id")
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return jsonify({"error": "Student not found"}), 400

        contact_method = str(data.get("contact_method", "")).strip()
        if contact_method not in ["Phone Call", "SMS", "Email", "In Person"]:
            return jsonify({"error": "Invalid contact method"}), 400

        try:
            contact_date = date.fromisoformat(str(data.get("contact_date", str(date.today()))))
        except ValueError:
            return jsonify({"error": "Invalid date"}), 400

        comm = ParentCommunication(
            student_id=student_id,
            late_arrival_id=data.get("late_arrival_id"),
            contact_date=contact_date,
            contact_method=contact_method,
            remarks=str(data.get("remarks", "")).strip() or None,
            communicated_by=g.current_user.id,
        )
        db.add(comm)
        db.commit()

        log_audit("parent_communication_create", entity_type="parent_communication", entity_id=comm.id)

        return jsonify(comm.to_dict()), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "Failed to log communication"}), 500
    finally:
        db.close()
