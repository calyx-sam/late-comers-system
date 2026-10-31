/**
 * Parent/Guardian Communication page — log, view, and track all communications with parents.
 * Supports student autocomplete, communication method tags, history log with pagination.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MdContactPhone,
  MdPhone,
  MdSms,
  MdEmail,
  MdPeople,
  MdAdd,
  MdSearch,
  MdCheckCircle,
  MdHistory,
} from 'react-icons/md';

export default function ParentCommunication() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const paramStudentId = searchParams.get('student_id');
  const paramStudentName = searchParams.get('student_name');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [communications, setCommunications] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form state
  const [studentSearch, setStudentSearch] = useState(paramStudentName || '');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(
    paramStudentId ? { id: Number(paramStudentId), name: paramStudentName } : null
  );
  const [contactMethod, setContactMethod] = useState('Phone Call');
  const [contactDate, setContactDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter state for history log
  const [filterMethod, setFilterMethod] = useState('');

  // Search students for autocomplete
  useEffect(() => {
    if (!studentSearch || (selectedStudent && selectedStudent.name === studentSearch)) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/students/search?q=${encodeURIComponent(studentSearch)}`);
        setSearchResults(res.items || res || []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [studentSearch, selectedStudent]);

  // Load communications
  const loadCommunications = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('per_page', '15');
      if (filterMethod) params.set('method', filterMethod);

      const res = await api.get(`/parent-communications?${params.toString()}`);
      setCommunications(res.items || []);
      setTotalPages(res.pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load parent communications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunications();
  }, [page, filterMethod]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      setError('Please search and select a student.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/parent-communications', {
        student_id: selectedStudent.id,
        contact_method: contactMethod,
        contact_date: contactDate,
        remarks,
      });

      setSuccess(`Communication with ${selectedStudent.name}'s parent logged successfully.`);
      setSelectedStudent(null);
      setStudentSearch('');
      setRemarks('');
      loadCommunications();
    } catch (err) {
      setError(err.message || 'Failed to log communication');
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'Phone Call':
        return (
          <span className="badge bg-primary d-inline-flex align-items-center gap-1">
            <MdPhone /> Phone Call
          </span>
        );
      case 'SMS':
        return (
          <span className="badge bg-info text-dark d-inline-flex align-items-center gap-1">
            <MdSms /> SMS
          </span>
        );
      case 'Email':
        return (
          <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
            <MdEmail /> Email
          </span>
        );
      case 'In Person':
        return (
          <span className="badge bg-success d-inline-flex align-items-center gap-1">
            <MdPeople /> In Person
          </span>
        );
      default:
        return <span className="badge bg-secondary">{method}</span>;
    }
  };

  return (
    <div className="fade-in">
      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4">
          <span>{error}</span>
          <button className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4">
          <span className="d-flex align-items-center gap-2">
            <MdCheckCircle className="fs-5" /> {success}
          </span>
          <button className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="row g-4">
        {/* Form Column */}
        <div className="col-12 col-lg-5">
          <div className="content-card h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="p-2 bg-primary bg-opacity-10 text-primary rounded-2 fs-5">
                <MdContactPhone />
              </div>
              <div>
                <h6 className="fw-bold mb-0">Record Parent Contact</h6>
                <small className="text-muted">Log communication regarding late arrivals</small>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Student Picker with Autocomplete */}
              <div className="mb-3 position-relative">
                <label className="form-label small fw-semibold">
                  Select Student <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <MdSearch />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name or register number..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setSelectedStudent(null);
                    }}
                    required
                  />
                </div>

                {searchResults.length > 0 && (
                  <div
                    className="position-absolute start-0 end-0 bg-white border rounded-3 shadow-lg mt-1 z-3"
                    style={{ maxHeight: 220, overflowY: 'auto' }}
                  >
                    {searchResults.map((st) => (
                      <div
                        key={st.id}
                        className="p-2 border-bottom cursor-pointer hover-bg-light"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedStudent(st);
                          setStudentSearch(`${st.name} (${st.register_number})`);
                          setSearchResults([]);
                        }}
                      >
                        <div className="fw-semibold small">{st.name}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Reg: {st.register_number} &bull; {st.department?.name || ''} &bull; Year {st.year}
                          {st.guardian_phone && ` &bull; Guardian: ${st.guardian_name} (${st.guardian_phone})`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedStudent && (
                  <div className="mt-2 p-2 bg-light rounded-2 border small">
                    <span className="text-success fw-semibold">Selected:</span> {selectedStudent.name}
                    {selectedStudent.register_number && ` (Reg: ${selectedStudent.register_number})`}
                  </div>
                )}
              </div>

              {/* Contact Method */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Communication Method</label>
                <div className="d-flex flex-wrap gap-2">
                  {['Phone Call', 'SMS', 'Email', 'In Person'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn btn-sm ${
                        contactMethod === m ? 'btn-primary' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setContactMethod(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact Date */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Contact Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={contactDate}
                  onChange={(e) => setContactDate(e.target.value)}
                  required
                />
              </div>

              {/* Remarks */}
              <div className="mb-4">
                <label className="form-label small fw-semibold">Conversation Remarks / Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g. Informed parent of 3rd late arrival. Parent acknowledged and promised student will leave earlier."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                ></textarea>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
                disabled={submitting}
              >
                <MdAdd /> {submitting ? 'Saving...' : 'Save Communication Record'}
              </button>
            </form>
          </div>
        </div>

        {/* History Table Column */}
        <div className="col-12 col-lg-7">
          <div className="content-card h-100">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <MdHistory className="text-primary fs-5" /> Communication Log History
              </h6>

              <select
                className="form-select form-select-sm"
                value={filterMethod}
                onChange={(e) => {
                  setFilterMethod(e.target.value);
                  setPage(1);
                }}
                style={{ width: 140 }}
              >
                <option value="">All Methods</option>
                <option value="Phone Call">Phone Call</option>
                <option value="SMS">SMS</option>
                <option value="Email">Email</option>
                <option value="In Person">In Person</option>
              </select>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : communications.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-0">No communication records logged yet.</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Student</th>
                        <th>Method</th>
                        <th>Remarks</th>
                        <th>Logged By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.contact_date}</strong>
                          </td>
                          <td>
                            <div className="fw-semibold small">{c.student?.name || '—'}</div>
                            <code style={{ fontSize: '0.75rem' }}>
                              {c.student?.register_number || ''}
                            </code>
                          </td>
                          <td>{getMethodBadge(c.contact_method)}</td>
                          <td>
                            <span className="small text-muted">{c.remarks || '—'}</span>
                          </td>
                          <td>
                            <span className="small text-secondary">{c.communicator?.name || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span className="small text-muted">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
