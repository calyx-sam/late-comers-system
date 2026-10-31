"""SQLAlchemy ORM models — maps to schema.sql tables."""

from datetime import datetime, date, time
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Column, Date, DateTime,
    ForeignKey, Index, Integer, String, Text, Time, UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from backend.extensions import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    code = Column(Text, nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    students = relationship("Student", back_populates="department")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False, server_default=text("'staff'"))
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'staff')", name="ck_users_role"),
    )

    def to_dict(self, include_email=False):
        d = {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_email:
            d["email"] = self.email
        return d


class Student(Base):
    __tablename__ = "students"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    register_number = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    department_id = Column(BigInteger, ForeignKey("departments.id"), nullable=False)
    year = Column(Integer, nullable=False)
    section = Column(Text, nullable=False, server_default=text("'A'"))
    guardian_name = Column(Text)
    guardian_phone = Column(Text)
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    __table_args__ = (
        CheckConstraint("year BETWEEN 1 AND 5", name="ck_students_year"),
        Index("idx_students_department", "department_id"),
        Index("idx_students_register", "register_number"),
    )

    department = relationship("Department", back_populates="students")
    late_arrivals = relationship("LateArrival", back_populates="student")

    def to_dict(self, mask_phone=True):
        phone = self.guardian_phone
        if mask_phone and phone and len(phone) > 4:
            phone = "X" * (len(phone) - 4) + phone[-4:]
        return {
            "id": self.id,
            "register_number": self.register_number,
            "name": self.name,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "year": self.year,
            "section": self.section,
            "guardian_name": self.guardian_name,
            "guardian_phone": phone,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LateArrival(Base):
    __tablename__ = "late_arrivals"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    student_id = Column(BigInteger, ForeignKey("students.id"), nullable=False)
    date = Column(Date, nullable=False)
    arrival_time = Column(Time, nullable=False)
    reporting_time = Column(Time, nullable=False)
    reason = Column(Text, nullable=False)
    reason_other = Column(Text)
    action_taken = Column(Text, nullable=False, server_default=text("'No Action'"))
    remarks = Column(Text)
    parent_informed = Column(Boolean, nullable=False, server_default=text("false"))
    parent_contact_date = Column(Date)
    parent_contact_method = Column(Text)
    parent_communication_remarks = Column(Text)
    student_acknowledgement = Column(Text)
    recorded_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    VALID_REASONS = [
        "College Bus Delay", "Public Transport Delay", "Heavy Traffic",
        "Overslept", "Personal Reasons", "Medical", "Other",
    ]
    VALID_ACTIONS = ["No Action", "Verbal Warning", "Written Warning", "Counselling"]
    VALID_CONTACT_METHODS = ["Phone Call", "SMS", "Email", "In Person"]

    __table_args__ = (
        CheckConstraint(
            "reason IN ('College Bus Delay','Public Transport Delay','Heavy Traffic',"
            "'Overslept','Personal Reasons','Medical','Other')",
            name="ck_late_arrivals_reason",
        ),
        CheckConstraint(
            "action_taken IN ('No Action','Verbal Warning','Written Warning','Counselling')",
            name="ck_late_arrivals_action",
        ),
        Index("idx_late_arrivals_student", "student_id"),
        Index("idx_late_arrivals_date", "date"),
        Index("idx_late_arrivals_recorded", "recorded_by"),
    )

    student = relationship("Student", back_populates="late_arrivals")
    recorder = relationship("User", foreign_keys=[recorded_by])

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else None,
            "register_number": self.student.register_number if self.student else None,
            "department_name": (
                self.student.department.name
                if self.student and self.student.department else None
            ),
            "year": self.student.year if self.student else None,
            "section": self.student.section if self.student else None,
            "date": self.date.isoformat() if self.date else None,
            "arrival_time": self.arrival_time.strftime("%H:%M") if self.arrival_time else None,
            "reporting_time": self.reporting_time.strftime("%H:%M") if self.reporting_time else None,
            "delay_minutes": self._delay_minutes(),
            "reason": self.reason,
            "reason_other": self.reason_other,
            "action_taken": self.action_taken,
            "remarks": self.remarks,
            "parent_informed": self.parent_informed,
            "parent_contact_date": (
                self.parent_contact_date.isoformat() if self.parent_contact_date else None
            ),
            "parent_contact_method": self.parent_contact_method,
            "parent_communication_remarks": self.parent_communication_remarks,
            "student_acknowledgement": self.student_acknowledgement,
            "recorded_by": self.recorded_by,
            "recorded_by_name": self.recorder.name if self.recorder else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def _delay_minutes(self):
        if self.arrival_time and self.reporting_time:
            arr = datetime.combine(date.today(), self.arrival_time)
            rep = datetime.combine(date.today(), self.reporting_time)
            diff = (arr - rep).total_seconds() / 60
            return max(0, int(diff))
        return 0


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)
    college_name = Column(
        Text, nullable=False,
        server_default=text("'Don Bosco College of Arts and Science'"),
    )
    reporting_time = Column(Time, nullable=False, server_default=text("'08:25'"))
    repeat_threshold = Column(Integer, nullable=False, server_default=text("3"))
    semester_label = Column(
        Text, nullable=False,
        server_default=text("'2025-26 Even Semester'"),
    )
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_by = Column(BigInteger, ForeignKey("users.id"))

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_single_row"),
        CheckConstraint("repeat_threshold >= 1", name="ck_settings_threshold"),
    )

    def to_dict(self):
        return {
            "college_name": self.college_name,
            "reporting_time": (
                self.reporting_time.strftime("%H:%M") if self.reporting_time else "08:25"
            ),
            "repeat_threshold": self.repeat_threshold,
            "semester_label": self.semester_label,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"))
    action = Column(Text, nullable=False)
    entity_type = Column(Text)
    entity_id = Column(BigInteger)
    details = Column(JSONB)
    ip_address = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    user = relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Session(Base):
    __tablename__ = "sessions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    token_hash = Column(Text, nullable=False, unique=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_seen = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    revoked = Column(Boolean, nullable=False, server_default=text("false"))

    user = relationship("User", foreign_keys=[user_id])


class ParentCommunication(Base):
    __tablename__ = "parent_communications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    student_id = Column(BigInteger, ForeignKey("students.id"), nullable=False)
    late_arrival_id = Column(BigInteger, ForeignKey("late_arrivals.id"))
    contact_date = Column(Date, nullable=False)
    contact_method = Column(Text, nullable=False)
    remarks = Column(Text)
    communicated_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    __table_args__ = (
        CheckConstraint(
            "contact_method IN ('Phone Call','SMS','Email','In Person')",
            name="ck_parent_comm_method",
        ),
    )

    student = relationship("Student", foreign_keys=[student_id])
    communicator = relationship("User", foreign_keys=[communicated_by])

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else None,
            "register_number": self.student.register_number if self.student else None,
            "late_arrival_id": self.late_arrival_id,
            "contact_date": self.contact_date.isoformat() if self.contact_date else None,
            "contact_method": self.contact_method,
            "remarks": self.remarks,
            "communicated_by": self.communicated_by,
            "communicated_by_name": self.communicator.name if self.communicator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class RateLimit(Base):
    __tablename__ = "rate_limits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    key = Column(Text, nullable=False)
    window_start = Column(DateTime(timezone=True), nullable=False)
    hit_count = Column(Integer, nullable=False, server_default=text("1"))

    __table_args__ = (
        UniqueConstraint("key", "window_start", name="uq_rate_limits_key_window"),
    )
