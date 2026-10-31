/**
 * Student Management — admin adds/edits/deactivates students, CSV import.
 * Staff can view/search only.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import {
  MdPeople, MdAdd, MdEdit, MdBlock, MdCheckCircle,
  MdUploadFile, MdSearch, MdNavigateBefore, MdNavigateNext, MdClose,
} from 'react-icons/md';

export default function StudentManagement() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  // Forms
  const emptyForm = { register_number: '', name: '', department_id: '', year: '', section: 'A', guardian_name: '', guardian_phone: '' };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  useEffect(() => { loadDepartments(); }, []);
  useEffect(() => { loadStudents(); }, [page, search, filterDept, filterYear]);

  const loadDepartments = async () => {
    try {
      const data = await api.get('/departments');
      setDepartments(data);
    } catch (err) { /* ignore */ }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('per_page', 20);
      params.set('include_inactive', 'true');
      if (search) params.set('search', search);
      if (filterDept) params.set('department_id', filterDept);
      if (filterYear) params.set('year', filterYear);

      const data = await api.get(`/students?${params.toString()}`);
      setStudents(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load students' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      await api.post('/students', addForm);
      setAddForm({ ...emptyForm });
      setShowAdd(false);
      setMessage({ type: 'success', text: 'Student added successfully' });
      loadStudents();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to add student' });
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({
      register_number: s.register_number,
      name: s.name,
      department_id: s.department_id,
      year: s.year,
      section: s.section || 'A',
      guardian_name: s.guardian_name || '',
      guardian_phone: '',  // Don't pre-fill masked phone
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const payload = { ...editForm };
      if (!payload.guardian_phone) delete payload.guardian_phone;  // Don't overwrite with empty
      await api.put(`/students/${editingId}`, payload);
      setEditingId(null);
      setMessage({ type: 'success', text: 'Student updated successfully' });
      loadStudents();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update student' });
    }
  };

  const toggleActive = async (s) => {
    try {
      await api.put(`/students/${s.id}`, { is_active: !s.is_active });
      setMessage({ type: 'success', text: `${s.name} ${s.is_active ? 'deactivated' : 'activated'}` });
      loadStudents();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update' });
    }
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setMessage({ type: '', text: '' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/students/import', formData);
      setImportResult(result);
      if (result.created > 0) {
        setMessage({ type: 'success', text: result.message });
        loadStudents();
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // Student form fields (shared between add and edit)
  const renderForm = (form, setForm, onSubmit, onCancel, isEdit = false) => (
    <form onSubmit={onSubmit} className="mb-4 p-3 bg-light rounded">
      <div className="row g-2">
        <div className="col-md-3">
          <label className="form-label small fw-semibold">Register Number</label>
          <input type="text" className="form-control form-control-sm" value={form.register_number}
            onChange={e => setForm(f => ({ ...f, register_number: e.target.value }))} required maxLength={50}
            placeholder="e.g., 22CS001" />
        </div>
        <div className="col-md-3">
          <label className="form-label small fw-semibold">Full Name</label>
          <input type="text" className="form-control form-control-sm" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={200} />
        </div>
        <div className="col-md-3">
          <label className="form-label small fw-semibold">Department</label>
          <select className="form-select form-select-sm" value={form.department_id}
            onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} required>
            <option value="">Select...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="col-md-1">
          <label className="form-label small fw-semibold">Year</label>
          <select className="form-select form-select-sm" value={form.year}
            onChange={e => setForm(f => ({ ...f, year: e.target.value }))} required>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="col-md-1">
          <label className="form-label small fw-semibold">Section</label>
          <input type="text" className="form-control form-control-sm" value={form.section}
            onChange={e => setForm(f => ({ ...f, section: e.target.value.toUpperCase() }))} maxLength={5} />
        </div>
      </div>
      <div className="row g-2 mt-1">
        <div className="col-md-3">
          <label className="form-label small fw-semibold">Guardian Name</label>
          <input type="text" className="form-control form-control-sm" value={form.guardian_name}
            onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} maxLength={200} />
        </div>
        <div className="col-md-3">
          <label className="form-label small fw-semibold">Guardian Phone</label>
          <input type="text" className="form-control form-control-sm" value={form.guardian_phone}
            onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} maxLength={20}
            placeholder={isEdit ? 'Leave empty to keep current' : ''} />
        </div>
        <div className="col-md-3 d-flex align-items-end gap-2">
          <button type="submit" className="btn btn-primary btn-sm">{isEdit ? 'Save' : 'Add'}</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="fade-in">
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible`} role="alert">
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      <div className="content-card">
        <div className="content-card-header">
          <h5 className="content-card-title d-flex align-items-center gap-2">
            <MdPeople /> Student Management
            <span className="badge bg-secondary ms-2">{total} students</span>
          </h5>
          {isAdmin && (
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowImport(!showImport)}>
                <MdUploadFile /> CSV Import
              </button>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}>
                <MdAdd /> Add Student
              </button>
            </div>
          )}
        </div>

        {/* CSV Import Panel */}
        {showImport && isAdmin && (
          <div className="mb-4 p-3 bg-light rounded">
            <h6 className="fw-semibold mb-2">CSV Import</h6>
            <p className="small text-muted mb-2">
              Required columns: <code>register_number</code>, <code>name</code>, <code>department_code</code>, <code>year</code><br />
              Optional: <code>section</code>, <code>guardian_name</code>, <code>guardian_phone</code><br />
              Max file size: 2 MB. Max rows: 5,000. Duplicates are skipped.
            </p>
            <div className="d-flex gap-2 align-items-center">
              <input ref={fileRef} type="file" accept=".csv" className="form-control form-control-sm" style={{ maxWidth: 300 }} />
              <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : 'Upload'}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => { setShowImport(false); setImportResult(null); }}>
                <MdClose />
              </button>
            </div>
            {importResult && (
              <div className="mt-2">
                <div className={`alert alert-${importResult.errors?.length ? 'warning' : 'success'} py-2 mb-1`}>
                  Created: <strong>{importResult.created}</strong> | Skipped: <strong>{importResult.skipped}</strong>
                </div>
                {importResult.errors?.length > 0 && (
                  <div className="small text-danger" style={{ maxHeight: 150, overflowY: 'auto' }}>
                    {importResult.errors.map((e, i) => (
                      <div key={i}>Row {e.row}: {e.errors.join(', ')}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add Form */}
        {showAdd && isAdmin && renderForm(addForm, setAddForm, handleAdd, () => setShowAdd(false))}

        {/* Filters */}
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text"><MdSearch /></span>
              <input type="text" className="form-control" placeholder="Search name or register no..."
                value={search} onChange={handleSearchChange} />
            </div>
          </div>
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={filterDept}
              onChange={e => { setFilterDept(e.target.value); setPage(1); }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setPage(1); }}>
              <option value="">All Years</option>
              {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reg. No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Year / Sec</th>
                <th>Guardian</th>
                <th>Phone</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" /></td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="text-center text-muted py-4">No students found</td></tr>
              ) : students.map(s => (
                <tr key={s.id}>
                  {editingId === s.id ? (
                    <td colSpan={isAdmin ? 8 : 7}>
                      {renderForm(editForm, setEditForm, handleEdit, () => setEditingId(null), true)}
                    </td>
                  ) : (
                    <>
                      <td><code>{s.register_number}</code></td>
                      <td className="fw-medium">{s.name}</td>
                      <td>{s.department_name || '—'}</td>
                      <td>{s.year} / {s.section}</td>
                      <td className="small">{s.guardian_name || '—'}</td>
                      <td className="small text-muted">{s.guardian_phone || '—'}</td>
                      <td>{s.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-outline-primary btn-sm me-1" onClick={() => { startEdit(s); setShowAdd(false); }} title="Edit"><MdEdit /></button>
                          <button className={`btn btn-sm ${s.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => toggleActive(s)} title={s.is_active ? 'Deactivate' : 'Activate'}>
                            {s.is_active ? <MdBlock /> : <MdCheckCircle />}
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">Page {page} of {pages} ({total} total)</small>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <MdNavigateBefore /> Prev
              </button>
              <button className="btn btn-outline-primary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Next <MdNavigateNext />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
