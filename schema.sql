-- =============================================================================
-- College Late Comers Management System — Supabase Postgres Schema
-- Source of truth. Run this in the Supabase SQL Editor.
-- =============================================================================

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT        NOT NULL UNIQUE,
    code            TEXT        NOT NULL UNIQUE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Users (authorised staff / admins)
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    role            TEXT        NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('admin', 'staff')),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Students
CREATE TABLE IF NOT EXISTS students (
    id              BIGSERIAL PRIMARY KEY,
    register_number TEXT        NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    department_id   BIGINT      NOT NULL REFERENCES departments(id),
    year            INTEGER     NOT NULL CHECK (year BETWEEN 1 AND 5),
    section         TEXT        NOT NULL DEFAULT 'A',
    guardian_name   TEXT,
    guardian_phone  TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_register   ON students(register_number);

-- 4. Late arrivals
CREATE TABLE IF NOT EXISTS late_arrivals (
    id                          BIGSERIAL PRIMARY KEY,
    student_id                  BIGINT      NOT NULL REFERENCES students(id),
    date                        DATE        NOT NULL,
    arrival_time                TIME        NOT NULL,
    reporting_time              TIME        NOT NULL,
    reason                      TEXT        NOT NULL
                                CHECK (reason IN (
                                    'College Bus Delay',
                                    'Public Transport Delay',
                                    'Heavy Traffic',
                                    'Overslept',
                                    'Personal Reasons',
                                    'Medical',
                                    'Other'
                                )),
    reason_other                TEXT,
    action_taken                TEXT        NOT NULL DEFAULT 'No Action'
                                CHECK (action_taken IN (
                                    'No Action',
                                    'Verbal Warning',
                                    'Written Warning',
                                    'Counselling'
                                )),
    remarks                     TEXT,
    parent_informed             BOOLEAN     NOT NULL DEFAULT FALSE,
    parent_contact_date         DATE,
    parent_contact_method       TEXT
                                CHECK (parent_contact_method IS NULL OR
                                       parent_contact_method IN (
                                           'Phone Call', 'SMS', 'Email', 'In Person'
                                       )),
    parent_communication_remarks TEXT,
    student_acknowledgement     TEXT,
    recorded_by                 BIGINT      NOT NULL REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_late_arrivals_student ON late_arrivals(student_id);
CREATE INDEX IF NOT EXISTS idx_late_arrivals_date    ON late_arrivals(date);
CREATE INDEX IF NOT EXISTS idx_late_arrivals_recorded ON late_arrivals(recorded_by);

-- 5. Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    college_name        TEXT        NOT NULL DEFAULT 'Don Bosco College of Arts and Science',
    reporting_time      TIME        NOT NULL DEFAULT '08:25',
    repeat_threshold    INTEGER     NOT NULL DEFAULT 3 CHECK (repeat_threshold >= 1),
    semester_label      TEXT        NOT NULL DEFAULT '2025-26 Even Semester',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT      REFERENCES users(id)
);

-- Insert or update default settings row with 08:25 reporting time
INSERT INTO settings (id, reporting_time) VALUES (1, '08:25')
ON CONFLICT (id) DO UPDATE SET reporting_time = '08:25';

-- 6. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      REFERENCES users(id),
    action          TEXT        NOT NULL,
    entity_type     TEXT,
    entity_id       BIGINT,
    details         JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- 7. Sessions (server-managed, hashed tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id              BIGSERIAL PRIMARY KEY,
    token_hash      TEXT        NOT NULL UNIQUE,
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked         BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 8. Parent/Guardian communications (standalone log)
CREATE TABLE IF NOT EXISTS parent_communications (
    id                  BIGSERIAL PRIMARY KEY,
    student_id          BIGINT      NOT NULL REFERENCES students(id),
    late_arrival_id     BIGINT      REFERENCES late_arrivals(id),
    contact_date        DATE        NOT NULL,
    contact_method      TEXT        NOT NULL
                        CHECK (contact_method IN ('Phone Call', 'SMS', 'Email', 'In Person')),
    remarks             TEXT,
    communicated_by     BIGINT      NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_comm_student ON parent_communications(student_id);

-- 9. Rate limit tracking (for serverless rate limiting)
CREATE TABLE IF NOT EXISTS rate_limits (
    id              BIGSERIAL PRIMARY KEY,
    key             TEXT        NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    hit_count       INTEGER     NOT NULL DEFAULT 1,
    UNIQUE(key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key, window_start);

-- =============================================================================
-- Row Level Security — enabled on all tables, no policies.
-- Only the Flask backend connects via the service_role/direct connection.
-- =============================================================================
ALTER TABLE departments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_arrivals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits          ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers (idempotent: drop if exists first)
DROP TRIGGER IF EXISTS trg_departments_updated ON departments;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_students_updated ON students;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_late_arrivals_updated ON late_arrivals;
CREATE TRIGGER trg_late_arrivals_updated BEFORE UPDATE ON late_arrivals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
