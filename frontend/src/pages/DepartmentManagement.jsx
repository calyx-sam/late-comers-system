/**
 * Department Management — admin can add/edit departments, staff can view.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { MdBusiness, MdAdd, MdEdit, MdBlock, MdCheckCircle } from 'react-icons/md';

export default function DepartmentManagement() {
  const { isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [addForm, setAddForm] = useState({ name: '', code: '' });
  const [editForm, setEditForm] = useState({ name: '', code: '', is_active: true });

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    try {
      const data = await api.get('/departments?include_inactive=true');
      setDepartments(data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load departments' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      await api.post('/departments', addForm);
      setAddForm({ name: '', code: '' });
      setShowAdd(false);
      setMessage({ type: 'success', text: 'Department added successfully' });
      loadDepartments();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to add department' });
    }
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditForm({ name: d.name, code: d.code, is_active: d.is_active });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      await api.put(`/departments/${editingId}`, editForm);
      setEditingId(null);
      setMessage({ type: 'success', text: 'Department updated successfully' });
      loadDepartments();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update department' });
    }
  };

  const toggleActive = async (d) => {
    try {
      await api.put(`/departments/${d.id}`, { is_active: !d.is_active });
      setMessage({ type: 'success', text: `${d.name} ${d.is_active ? 'deactivated' : 'activated'}` });
      loadDepartments();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update' });
    }
  };

  if (loading) {
    return <div className="spinner-overlay"><div className="spinner-border text-primary" role="status" /></div>;
  }

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
            <MdBusiness /> Department Management
          </h5>
          {isAdmin && (
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setShowAdd(!showAdd)}>
              <MdAdd /> Add Department
            </button>
          )}
        </div>

        {showAdd && isAdmin && (
          <form onSubmit={handleAdd} className="mb-4 p-3 bg-light rounded">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Department Name</label>
                <input type="text" className="form-control form-control-sm" value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Computer Science" required maxLength={200} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Code</label>
                <input type="text" className="form-control form-control-sm" value={addForm.code}
                  onChange={e => setAddForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g., CS" required maxLength={20} />
              </div>
              <div className="col-md-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Students</th>
                <th>Created</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  {editingId === d.id ? (
                    <>
                      <td><input type="text" className="form-control form-control-sm" value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} maxLength={200} /></td>
                      <td><input type="text" className="form-control form-control-sm" value={editForm.code}
                        onChange={e => setEditForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={20} /></td>
                      <td><select className="form-select form-select-sm" value={editForm.is_active ? 'active' : 'inactive'}
                        onChange={e => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}>
                          <option value="active">Active</option><option value="inactive">Inactive</option>
                        </select></td>
                      <td></td><td></td>
                      <td>
                        <button className="btn btn-success btn-sm me-1" onClick={handleEdit}>Save</button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="fw-medium">{d.name}</td>
                      <td><span className="badge bg-primary">{d.code}</span></td>
                      <td>{d.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                      <td className="text-muted">—</td>
                      <td className="text-muted small">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-outline-primary btn-sm me-1" onClick={() => startEdit(d)} title="Edit"><MdEdit /></button>
                          <button className={`btn btn-sm ${d.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => toggleActive(d)} title={d.is_active ? 'Deactivate' : 'Activate'}>
                            {d.is_active ? <MdBlock /> : <MdCheckCircle />}
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {departments.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="text-center text-muted py-4">No departments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
