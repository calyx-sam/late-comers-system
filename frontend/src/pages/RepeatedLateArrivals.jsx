/**
 * Repeated Late Arrivals page — identify and track students with repeated late entries.
 * Includes threshold filter, student history modal, communication status, and direct CSV export.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MdWarning,
  MdFilterList,
  MdHistory,
  MdPhone,
  MdFileDownload,
  MdClose,
  MdCheckCircle,
  MdPerson,
  MdArrowForward,
} from 'react-icons/md';

export default function RepeatedLateArrivals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [threshold, setThreshold] = useState(3);
  const [departments, setDepartments] = useState([]);

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Selected student for history modal
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Load departments
  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.departments || res || []))
      .catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('threshold', threshold);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (deptFilter) params.set('department_id', deptFilter);
      if (yearFilter) params.set('year', yearFilter);

      const res = await api.get(`/reports/repeated?${params.toString()}`);
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load repeated late comers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [threshold, dateFrom, dateTo, deptFilter, yearFilter]);

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set('threshold', threshold);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.open(`/api/exports/repeated?${params.toString()}`, '_blank');
  };

  return (
    <div className="fade-in">
      {/* Top Filter & Settings Bar */}
      <div className="content-card mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-auto">
            <label className="form-label small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
              <MdWarning className="text-warning" /> Late Count Threshold:
            </label>
            <div className="btn-group btn-group-sm">
              {[2, 3, 5, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`btn btn-outline-warning ${threshold === num ? 'active text-dark fw-bold' : ''}`}
                  onClick={() => setThreshold(num)}
                >
                  &ge; {num} Lates
                </button>
              ))}
            </div>
          </div>

          <div className="col-12 col-md-auto">
            <label className="form-label small fw-semibold text-secondary mb-1">Date Range:</label>
            <div className="d-flex align-items-center gap-1">
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-muted small">to</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-auto">
            <label className="form-label small fw-semibold text-secondary mb-1">Department:</label>
            <select
              className="form-select form-select-sm"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-auto">
            <label className="form-label small fw-semibold text-secondary mb-1">Year:</label>
            <select
              className="form-select form-select-sm"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          <div className="col-12 col-md-auto ms-auto text-end pt-3 pt-md-0">
            <button
              type="button"
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
              onClick={handleExport}
            >
              <MdFileDownload /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4">
          <span>{error}</span>
          <button className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Main List */}
      <div className="content-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 className="fw-bold mb-0">Frequent Late Comers</h6>
            <small className="text-muted">
              Found <strong>{items.length}</strong> student(s) with &ge; {threshold} late arrivals between {dateFrom} and {dateTo}.
            </small>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div className="text-center py-5">
            <div className="fs-1 text-success mb-2">
              <MdCheckCircle />
            </div>
            <h6 className="fw-semibold">No repeat offenders found</h6>
            <p className="text-muted small">
              No students exceeded the threshold of {threshold} late arrivals in this period.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Student</th>
                  <th>Register No</th>
                  <th>Department</th>
                  <th>Year / Sec</th>
                  <th className="text-center">Late Count</th>
                  <th>Guardian</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((student) => {
                  const isHigh = student.late_count >= 5;
                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="avatar-circle">
                            <MdPerson />
                          </div>
                          <span className="fw-semibold">{student.name}</span>
                        </div>
                      </td>
                      <td>
                        <code>{student.register_number}</code>
                      </td>
                      <td>{student.department?.name || '—'}</td>
                      <td>
                        Year {student.year} &bull; Sec {student.section}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${
                            isHigh ? 'bg-danger text-white' : 'bg-warning text-dark'
                          } fs-6 px-3 py-1 rounded-pill`}
                        >
                          {student.late_count} times
                        </span>
                      </td>
                      <td>
                        <div className="small">
                          <div>{student.guardian_name || 'Guardian'}</div>
                          {student.guardian_phone && (
                            <a
                              href={`tel:${student.guardian_phone}`}
                              className="text-muted text-decoration-none d-inline-flex align-items-center gap-1"
                            >
                              <MdPhone size={13} /> {student.guardian_phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-primary d-inline-flex align-items-center gap-1"
                            onClick={() => setSelectedStudent(student)}
                            title="View arrival dates and reasons"
                          >
                            <MdHistory /> History
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                            onClick={() =>
                              navigate(
                                `/parent-communication?student_id=${student.id}&student_name=${encodeURIComponent(
                                  student.name
                                )}`
                              )
                            }
                            title="Log communication with parents"
                          >
                            <MdPhone /> Contact
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Details Modal */}
      {selectedStudent && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold">
                    Late Arrival History: {selectedStudent.name}
                  </h5>
                  <div className="small text-muted">
                    Reg No: <code>{selectedStudent.register_number}</code> &bull;{' '}
                    {selectedStudent.department?.name} (Year {selectedStudent.year}) &bull;{' '}
                    <span className="text-danger fw-semibold">{selectedStudent.late_count} total late(s)</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedStudent(null)}
                ></button>
              </div>

              <div className="modal-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Arrival Time</th>
                        <th>Reporting Time</th>
                        <th>Delay</th>
                        <th>Reason</th>
                        <th>Parent Informed</th>
                        <th>Action Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStudent.history || []).map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <strong>{entry.date}</strong>
                          </td>
                          <td>{entry.arrival_time ? entry.arrival_time.slice(0, 5) : '—'}</td>
                          <td className="text-muted">
                            {entry.reporting_time ? entry.reporting_time.slice(0, 5) : '—'}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                (entry.delay_minutes || 0) > 30
                                  ? 'bg-danger'
                                  : (entry.delay_minutes || 0) > 15
                                  ? 'bg-warning text-dark'
                                  : 'bg-success'
                              }`}
                            >
                              +{entry.delay_minutes || 0} min
                            </span>
                          </td>
                          <td>
                            <span className="small">{entry.reason || '—'}</span>
                          </td>
                          <td>
                            {entry.parent_informed ? (
                              <span className="badge bg-success">Yes</span>
                            ) : (
                              <span className="badge bg-secondary">No</span>
                            )}
                          </td>
                          <td>
                            <span className="small text-muted">{entry.action_taken || 'None'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                  onClick={() => {
                    const st = selectedStudent;
                    setSelectedStudent(null);
                    navigate(
                      `/parent-communication?student_id=${st.id}&student_name=${encodeURIComponent(
                        st.name
                      )}`
                    );
                  }}
                >
                  <MdPhone /> Record Parent Contact <MdArrowForward />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
