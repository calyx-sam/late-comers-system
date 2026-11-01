"""Export routes — Excel, CSV, PDF with formula neutralisation and audit logging.

GET /api/exports/daily      — export daily register
GET /api/exports/repeated   — export repeated late arrivals
GET /api/exports/department — export department report
GET /api/exports/monthly    — export monthly report
"""

import io
import csv
from datetime import date
from flask import Blueprint, request, send_file, g
from sqlalchemy import func, desc
from decorators import login_required
from extensions import get_db
from models import LateArrival, Student, Department, Settings
from services.audit_service import log_audit
from utils.security import neutralise_formula, mask_phone

exports_bp = Blueprint("exports", __name__, url_prefix="/api/exports")


def _safe(val):
    """Neutralise formula injection and convert to string."""
    if val is None:
        return ""
    return neutralise_formula(str(val))


@exports_bp.route("/daily", methods=["GET"])
@login_required
def export_daily():
    """Export daily register as CSV."""
    db = next(get_db())
    try:
        fmt = request.args.get("format", "csv")
        date_from = request.args.get("from", str(date.today()))
        date_to = request.args.get("to", str(date.today()))

        query = db.query(LateArrival).filter(
            LateArrival.date >= date_from,
            LateArrival.date <= date_to,
        ).order_by(LateArrival.date, LateArrival.arrival_time)

        dept_id = request.args.get("department_id")
        if dept_id:
            dept_students = [s.id for s in db.query(Student).filter(Student.department_id == int(dept_id)).all()]
            if dept_students:
                query = query.filter(LateArrival.student_id.in_(dept_students))

        entries = query.all()

        # Build CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "S.No", "Date", "Student Name", "Register No", "Department",
            "Year/Class", "Arrival Time", "Reporting Time", "Delay (min)",
            "Reason", "Previous Lates", "Parent Informed", "Action Taken",
            "Recorded By",
        ])

        for i, e in enumerate(entries, 1):
            prev_count = db.query(func.count(LateArrival.id)).filter(
                LateArrival.student_id == e.student_id, LateArrival.id != e.id
            ).scalar()

            writer.writerow([
                i,
                _safe(e.date),
                _safe(e.student.name if e.student else ""),
                _safe(e.student.register_number if e.student else ""),
                _safe(e.student.department.name if e.student and e.student.department else ""),
                _safe(f"{e.student.year}/{e.student.section}" if e.student else ""),
                _safe(e.arrival_time.strftime("%H:%M") if e.arrival_time else ""),
                _safe(e.reporting_time.strftime("%H:%M") if e.reporting_time else ""),
                e._delay_minutes(),
                _safe(e.reason),
                prev_count,
                "Yes" if e.parent_informed else "No",
                _safe(e.action_taken),
                _safe(e.recorder.name if e.recorder else ""),
            ])

        log_audit("export_csv", entity_type="late_arrival", details={
            "type": "daily_register", "from": date_from, "to": date_to, "count": len(entries)
        })

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"daily_register_{date_from}_to_{date_to}.csv",
        )
    finally:
        db.close()


@exports_bp.route("/repeated", methods=["GET"])
@login_required
def export_repeated():
    """Export repeated late arrivals as CSV."""
    db = next(get_db())
    try:
        settings = db.query(Settings).filter(Settings.id == 1).first()
        threshold = int(request.args.get("threshold", settings.repeat_threshold if settings else 3))
        date_from = request.args.get("from", str(date.today().replace(day=1)))
        date_to = request.args.get("to", str(date.today()))

        results = (
            db.query(Student, func.count(LateArrival.id).label("late_count"))
            .join(LateArrival, LateArrival.student_id == Student.id)
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(Student.id)
            .having(func.count(LateArrival.id) >= threshold)
            .order_by(desc("late_count"))
            .all()
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["S.No", "Register No", "Student Name", "Department", "Year/Class",
                         "Late Count", "Guardian Name", "Guardian Phone"])

        for i, (student, count) in enumerate(results, 1):
            writer.writerow([
                i,
                _safe(student.register_number),
                _safe(student.name),
                _safe(student.department.name if student.department else ""),
                _safe(f"{student.year}/{student.section}"),
                count,
                _safe(student.guardian_name),
                _safe(mask_phone(student.guardian_phone)),
            ])

        log_audit("export_csv", entity_type="student", details={
            "type": "repeated_late_arrivals", "threshold": threshold, "count": len(results)
        })

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"repeated_latecomers_{date_from}_to_{date_to}.csv",
        )
    finally:
        db.close()


@exports_bp.route("/department", methods=["GET"])
@login_required
def export_department():
    """Export department-wise report as CSV."""
    db = next(get_db())
    try:
        date_from = request.args.get("from", str(date.today().replace(day=1)))
        date_to = request.args.get("to", str(date.today()))

        results = (
            db.query(
                Department.name, Department.code,
                func.count(LateArrival.id).label("total"),
                func.count(func.distinct(LateArrival.student_id)).label("unique"),
            )
            .join(Student, Student.department_id == Department.id)
            .join(LateArrival, LateArrival.student_id == Student.id)
            .filter(LateArrival.date >= date_from, LateArrival.date <= date_to)
            .group_by(Department.name, Department.code)
            .order_by(desc("total"))
            .all()
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Department", "Code", "Total Late Arrivals", "Unique Students"])
        for name, code, total, unique in results:
            writer.writerow([_safe(name), _safe(code), total, unique])

        log_audit("export_csv", entity_type="department", details={"type": "department_report", "count": len(results)})

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"department_report_{date_from}_to_{date_to}.csv",
        )
    finally:
        db.close()


@exports_bp.route("/monthly", methods=["GET"])
@login_required
def export_monthly():
    """Export monthly report as CSV."""
    db = next(get_db())
    try:
        year_val = int(request.args.get("year", date.today().year))

        results = (
            db.query(
                func.extract("month", LateArrival.date).label("month"),
                func.count(LateArrival.id),
                func.count(func.distinct(LateArrival.student_id)),
            )
            .filter(func.extract("year", LateArrival.date) == year_val)
            .group_by("month")
            .order_by("month")
            .all()
        )

        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Month", "Total Late Arrivals", "Unique Students"])
        for month_num, total, unique in results:
            writer.writerow([months[int(month_num) - 1], total, unique])

        log_audit("export_csv", entity_type="monthly", details={"type": "monthly_report", "year": year_val})

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"monthly_report_{year_val}.csv",
        )
    finally:
        db.close()
