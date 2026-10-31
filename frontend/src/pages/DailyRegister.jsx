/**
 * Daily Late Comers Register — filterable, sortable, paginated table.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import {
  MdListAlt, MdSearch, MdNavigateBefore, MdNavigateNext,
  MdEdit, MdDelete, MdFilterList,
} from 'react-icons/md';

const REASONS = ['College Bus Delay','Public Transport Delay','Heavy Traffic','Overslept','Personal Reasons','Medical','Other'];
const ACTIONS = ['No Action','Verbal Warning','Written Warning','Counselling'];

export default function DailyRegister() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ search: '', date: today, department_id: '', year: '', reason: '' });

  useEffect(() => { api.get('/departments').then(setDepartments).catch(() => {}); }, []);
  useEffect(() => { loadEntries(); }, [page, filters]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('page', page); p.set('per_page', 25);
      if (filters.search) p.set('search', filters.search);
      if (filters.date) p.set('date', filters.date);
      if (filters.department_id) p.set('department_id', filters.department_id);
      if (filters.year) p.set('year', filters.year);
      if (filters.reason) p.set('reason', filters.reason);
      const data = await api.get(`/late-arrivals?${p.toString()}`);
      setEntries(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load entries' });
    } finally { setLoading(false); }
  };

  const setF = (key) => (e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1); };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditForm({ reason: e.reason, reason_other: e.reason_other || '', action_taken: e.action_taken,
      remarks: e.remarks || '', parent_informed: e.parent_informed, parent_contact_method: e.parent_contact_method || '',
      parent_communication_remarks: e.parent_communication_remarks || '' });
  };

  const saveEdit = async () => {
    try {
      await api.put(`/late-arrivals/${editingId}`, editForm);
      setEditingId(null);
      setMessage({ type: 'success', text: 'Entry updated' });
      loadEntries();
    } catch (err) { setMessage({ type: 'danger', text: err.message }); }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/late-arrivals/${id}`);
      setMessage({ type: 'success', text: 'Entry deleted' });
      loadEntries();
    } catch (err) { setMessage({ type: 'danger', text: err.message }); }
  };

  return (
    <div className="fade-in">
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      <div className="content-card">
        <div className="content-card-header">
          <h5 className="content-card-title d-flex align-items-center gap-2">
            <MdListAlt /> Daily Late Comers Register
            <span className="badge bg-secondary ms-2">{total} entries</span>
          </h5>
        </div>

        {/* Filters */}
        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <div className="input-group input-group-sm">
              <span className="input-group-text"><MdSearch /></span>
              <input type="text" className="form-control" placeholder="Search student..." value={filters.search} onChange={setF('search')} />
            </div>
          </div>
          <div className="col-md-2">
            <input type="date" className="form-control form-control-sm" value={filters.date} onChange={setF('date')} />
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={filters.department_id} onChange={setF('department_id')}>
              <option value="">All Depts</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
          </div>
          <div className="col-md-1">
            <select className="form-select form-select-sm" value={filters.year} onChange={setF('year')}>
              <option value="">Year</option>
              {[1,2,3,4,5].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={filters.reason} onChange={setF('reason')}>
              <option value="">All Reasons</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-secondary btn-sm w-100" onClick={() => { setFilters({ search: '', date: '', department_id: '', year: '', reason: '' }); setPage(1); }}>
              <MdFilterList /> Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Student</th><th>Reg No</th><th>Dept</th><th>Year</th>
                <th>Time</th><th>Delay</th><th>Reason</th><th>Prev</th>
                <th>Parent</th><th>Action</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 12 : 11} className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={isAdmin ? 12 : 11} className="text-center text-muted py-4">No late arrivals found for selected date/filters</td></tr>
              ) : entries.map((e, i) => (
                <tr key={e.id} className={e.previous_lates >= 3 ? 'table-warning' : ''}>
                  <td className="small">{(page - 1) * 25 + i + 1}</td>
                  <td className="fw-medium">{e.student_name}</td>
                  <td><code className="small">{e.register_number}</code></td>
                  <td className="small">{e.department_name}</td>
                  <td className="small">{e.year}/{e.section}</td>
                  <td className="small">{e.arrival_time}</td>
                  <td><span className={`badge ${e.delay_minutes > 30 ? 'bg-danger' : 'bg-warning text-dark'}`}>{e.delay_minutes}m</span></td>
                  <td className="small">{e.reason}{e.reason_other ? ` (${e.reason_other})` : ''}</td>
                  <td><span className={`badge ${e.previous_lates >= 3 ? 'bg-danger' : 'bg-secondary'}`}>{e.previous_lates}</span></td>
                  <td>{e.parent_informed ? <span className="badge bg-success">Yes</span> : <span className="badge bg-secondary">No</span>}</td>
                  <td className="small">{e.action_taken}</td>
                  {isAdmin && (
                    <td className="d-flex gap-1">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => startEdit(e)} title="Edit"><MdEdit /></button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => deleteEntry(e.id)} title="Delete"><MdDelete /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline Edit Modal */}
        {editingId && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header"><h6 className="modal-title">Edit Entry</h6>
                  <button type="button" className="btn-close" onClick={() => setEditingId(null)} /></div>
                <div className="modal-body">
                  <div className="mb-2"><label className="form-label small fw-semibold">Reason</label>
                    <select className="form-select form-select-sm" value={editForm.reason}
                      onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select></div>
                  <div className="mb-2"><label className="form-label small fw-semibold">Action</label>
                    <select className="form-select form-select-sm" value={editForm.action_taken}
                      onChange={e => setEditForm(f => ({ ...f, action_taken: e.target.value }))}>
                      {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select></div>
                  <div className="mb-2"><label className="form-label small fw-semibold">Remarks</label>
                    <textarea className="form-control form-control-sm" rows={2} value={editForm.remarks}
                      onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                  <div className="form-check mb-2">
                    <input type="checkbox" className="form-check-input" checked={editForm.parent_informed}
                      onChange={e => setEditForm(f => ({ ...f, parent_informed: e.target.checked }))} />
                    <label className="form-check-label small">Parent Informed</label></div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">Page {page} of {pages} ({total} entries)</small>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><MdNavigateBefore /> Prev</button>
              <button className="btn btn-outline-primary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next <MdNavigateNext /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
