/**
 * User Management — admin adds/edits/disables staff by email.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { MdPersonAdd, MdEdit, MdBlock, MdCheckCircle, MdAdminPanelSettings } from 'react-icons/md';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Add form
  const [addForm, setAddForm] = useState({ email: '', name: '', role: 'staff' });
  // Edit form
  const [editForm, setEditForm] = useState({ name: '', role: 'staff', is_active: true });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      await api.post('/users', addForm);
      setAddForm({ email: '', name: '', role: 'staff' });
      setShowAdd(false);
      setMessage({ type: 'success', text: 'User added successfully' });
      loadUsers();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to add user' });
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, role: u.role, is_active: u.is_active });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      await api.put(`/users/${editingId}`, editForm);
      setEditingId(null);
      setMessage({ type: 'success', text: 'User updated successfully' });
      loadUsers();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update user' });
    }
  };

  const toggleActive = async (u) => {
    setMessage({ type: '', text: '' });
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      setMessage({
        type: 'success',
        text: `${u.name} ${u.is_active ? 'deactivated' : 'activated'} successfully`,
      });
      loadUsers();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update user' });
    }
  };

  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
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
            <MdAdminPanelSettings /> User Management
          </h5>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => setShowAdd(!showAdd)}>
            <MdPersonAdd /> Add User
          </button>
        </div>

        {/* Add user form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-4 p-3 bg-light rounded">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Email</label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@college.edu"
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Name</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  required
                  maxLength={200}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Role</label>
                <select
                  className="form-select form-select-sm"
                  value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="col-md-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {/* Users table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  {editingId === u.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          maxLength={200}
                        />
                      </td>
                      <td className="text-muted">{u.email}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={editForm.role}
                          onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                          disabled={u.id === currentUser?.id}
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={editForm.is_active ? 'active' : 'inactive'}
                          onChange={e => setEditForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                          disabled={u.id === currentUser?.id}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td></td>
                      <td>
                        <button className="btn btn-success btn-sm me-1" onClick={handleEdit}>Save</button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="fw-medium">{u.name}</td>
                      <td className="text-muted">{u.email}</td>
                      <td>
                        <span className={`role-badge ${u.role}`}>{u.role.toUpperCase()}</span>
                      </td>
                      <td>
                        {u.is_active ? (
                          <span className="badge bg-success">Active</span>
                        ) : (
                          <span className="badge bg-secondary">Inactive</span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-primary btn-sm me-1"
                          onClick={() => startEdit(u)}
                          title="Edit"
                        >
                          <MdEdit />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => toggleActive(u)}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? <MdBlock /> : <MdCheckCircle />}
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
