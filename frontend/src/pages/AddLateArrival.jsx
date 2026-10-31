/**
 * Add Late Arrival — the main data entry form.
 * Staff search for a student, fill in arrival details, and submit.
 */
import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { MdPersonAdd, MdSearch, MdWarning, MdCheckCircle } from 'react-icons/md';

const REASONS = [
  'College Bus Delay', 'Public Transport Delay', 'Heavy Traffic',
  'Overslept', 'Personal Reasons', 'Medical', 'Other',
];
const ACTIONS = ['No Action', 'Verbal Warning', 'Written Warning', 'Counselling'];
const CONTACT_METHODS = ['Phone Call', 'SMS', 'Email', 'In Person'];

export default function AddLateArrival() {
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [settings, setSettings] = useState(null);
  const [duplicateWarn, setDuplicateWarn] = useState(false);
  const searchRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    arrival_time: '',
    reason: '',
    reason_other: '',
    action_taken: 'No Action',
    remarks: '',
    parent_informed: false,
    parent_contact_date: today,
    parent_contact_method: '',
    parent_communication_remarks: '',
    student_acknowledgement: '',
  });

  useEffect(() => {
    api.get('/settings').then(setSettings).catch(() => {});
  }, []);

  // Debounced student search
  useEffect(() => {
    if (searchQ.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/students/search?q=${encodeURIComponent(searchQ)}`);
        setResults(data);
        setShowResults(true);
      } catch (err) { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Check duplicate when student or date changes
  useEffect(() => {
    if (!selectedStudent || !form.date) { setDuplicateWarn(false); return; }
    api.get(`/late-arrivals/check-dup?student_id=${selectedStudent.id}&date=${form.date}`)
      .then(d => setDuplicateWarn(d.exists))
      .catch(() => {});
  }, [selectedStudent, form.date]);

  const selectStudent = (s) => {
    setSelectedStudent(s);
    setSearchQ(s.name + ' (' + s.register_number + ')');
    setShowResults(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (!selectedStudent) {
      setMessage({ type: 'danger', text: 'Please search and select a student first' });
      return;
    }
    try {
      await api.post('/late-arrivals', {
        student_id: selectedStudent.id,
        ...form,
      });
      setMessage({ type: 'success', text: `Late arrival recorded for ${selectedStudent.name}` });
      // Reset form
      setSelectedStudent(null);
      setSearchQ('');
      setForm(f => ({
        ...f,
        arrival_time: '', reason: '', reason_other: '', action_taken: 'No Action',
        remarks: '', parent_informed: false, parent_communication_remarks: '',
        student_acknowledgement: '',
      }));
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to record late arrival' });
    }
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="fade-in">
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible`} role="alert">
          {message.type === 'success' && <MdCheckCircle className="me-2" />}
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      <div className="content-card">
        <div className="content-card-header">
          <h5 className="content-card-title d-flex align-items-center gap-2">
            <MdPersonAdd /> Record Late Arrival
          </h5>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Student Search */}
          <div className="row g-3 mb-3">
            <div className="col-md-6 position-relative" ref={searchRef}>
              <label className="form-label fw-semibold">Student <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text"><MdSearch /></span>
                <input type="text" className="form-control" placeholder="Search by name or register number..."
                  value={searchQ} onChange={e => { setSearchQ(e.target.value); setSelectedStudent(null); }}
                  onFocus={() => results.length > 0 && setShowResults(true)} />
              </div>
              {showResults && results.length > 0 && (
                <div className="dropdown-menu show w-100" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {results.map(s => (
                    <button key={s.id} type="button" className="dropdown-item" onClick={() => selectStudent(s)}>
                      <strong>{s.register_number}</strong> — {s.name}
                      <small className="text-muted ms-2">{s.department_name} / Year {s.year} {s.section}</small>
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div className="mt-2 p-2 bg-light rounded small">
                  <strong>{selectedStudent.register_number}</strong> — {selectedStudent.name} |
                  {selectedStudent.department_name} | Year {selectedStudent.year}/{selectedStudent.section}
                  {selectedStudent.guardian_name && <> | Guardian: {selectedStudent.guardian_name}</>}
                </div>
              )}
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Date <span className="text-danger">*</span></label>
              <input type="date" className="form-control" value={form.date} onChange={set('date')} max={today} required />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Arrival Time <span className="text-danger">*</span></label>
              <input type="time" className="form-control" value={form.arrival_time} onChange={set('arrival_time')} required />
              {settings && <small className="text-muted">Reporting time: {settings.reporting_time}</small>}
            </div>
          </div>

          {duplicateWarn && (
            <div className="alert alert-warning py-2 d-flex align-items-center gap-2">
              <MdWarning /> A late arrival entry already exists for this student on this date.
            </div>
          )}

          {/* Reason and Action */}
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Reason <span className="text-danger">*</span></label>
              <select className="form-select" value={form.reason} onChange={set('reason')} required>
                <option value="">Select reason...</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {form.reason === 'Other' && (
              <div className="col-md-4">
                <label className="form-label fw-semibold">Specify Reason <span className="text-danger">*</span></label>
                <input type="text" className="form-control" value={form.reason_other} onChange={set('reason_other')} required maxLength={200} />
              </div>
            )}
            <div className="col-md-4">
              <label className="form-label fw-semibold">Action Taken</label>
              <select className="form-select" value={form.action_taken} onChange={set('action_taken')}>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div className="row g-3 mb-3">
            <div className="col-md-8">
              <label className="form-label fw-semibold">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={set('remarks')} maxLength={500} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold">Student Acknowledgement</label>
              <input type="text" className="form-control" value={form.student_acknowledgement}
                onChange={set('student_acknowledgement')} placeholder="Signature / initials" maxLength={100} />
            </div>
          </div>

          {/* Parent Communication */}
          <div className="p-3 bg-light rounded mb-3">
            <div className="form-check mb-2">
              <input type="checkbox" className="form-check-input" id="parentInformed"
                checked={form.parent_informed} onChange={set('parent_informed')} />
              <label className="form-check-label fw-semibold" htmlFor="parentInformed">Parent/Guardian Informed</label>
            </div>
            {form.parent_informed && (
              <div className="row g-2 mt-1">
                <div className="col-md-3">
                  <label className="form-label small">Contact Date</label>
                  <input type="date" className="form-control form-control-sm" value={form.parent_contact_date}
                    onChange={set('parent_contact_date')} max={today} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Contact Method</label>
                  <select className="form-select form-select-sm" value={form.parent_contact_method} onChange={set('parent_contact_method')}>
                    <option value="">Select...</option>
                    {CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Communication Remarks</label>
                  <input type="text" className="form-control form-control-sm" value={form.parent_communication_remarks}
                    onChange={set('parent_communication_remarks')} maxLength={300} />
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={duplicateWarn}>
            <MdPersonAdd /> Record Late Arrival
          </button>
        </form>
      </div>
    </div>
  );
}
