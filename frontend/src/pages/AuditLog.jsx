/**
 * Audit Log — admin-only view of all system events.
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import { MdHistory, MdNavigateBefore, MdNavigateNext } from 'react-icons/md';

const ACTION_LABELS = {
  login_success: { label: 'Login', color: 'success' },
  login_failure: { label: 'Login Failed', color: 'danger' },
  logout: { label: 'Logout', color: 'secondary' },
  user_create: { label: 'User Created', color: 'primary' },
  user_update: { label: 'User Updated', color: 'info' },
  settings_update: { label: 'Settings Updated', color: 'warning' },
  student_create: { label: 'Student Created', color: 'primary' },
  student_update: { label: 'Student Updated', color: 'info' },
  student_import: { label: 'CSV Import', color: 'primary' },
  department_create: { label: 'Dept Created', color: 'primary' },
  department_update: { label: 'Dept Updated', color: 'info' },
  late_arrival_create: { label: 'Late Entry', color: 'warning' },
  late_arrival_update: { label: 'Late Updated', color: 'info' },
  late_arrival_delete: { label: 'Late Deleted', color: 'danger' },
  export_excel: { label: 'Excel Export', color: 'success' },
  export_csv: { label: 'CSV Export', color: 'success' },
  export_pdf: { label: 'PDF Export', color: 'success' },
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });

  useEffect(() => {
    loadAudit();
  }, [page, filters]);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('per_page', 30);
      if (filters.action) params.set('action', filters.action);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const data = await api.get(`/audit-log?${params.toString()}`);
      setEntries(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    loadAudit();
  };

  const resetFilters = () => {
    setFilters({ action: '', from: '', to: '' });
    setPage(1);
  };

  const getActionBadge = (action) => {
    const info = ACTION_LABELS[action] || { label: action, color: 'secondary' };
    return <span className={`badge bg-${info.color}`}>{info.label}</span>;
  };

  return (
    <div className="fade-in">
      <div className="content-card">
        <div className="content-card-header">
          <h5 className="content-card-title d-flex align-items-center gap-2">
            <MdHistory /> Audit Log
          </h5>
          <span className="text-muted small">{total} entries</span>
        </div>

        {/* Filters */}
        <div className="filter-bar mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small">Action</label>
              <select
                className="form-select form-select-sm"
                value={filters.action}
                onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              >
                <option value="">All</option>
                {Object.entries(ACTION_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">From</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small">To</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>Reset</button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">No audit entries found</td>
                </tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-nowrap small">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td>{getActionBadge(e.action)}</td>
                    <td>{e.user_name || '—'}</td>
                    <td className="small text-muted">
                      {e.entity_type ? `${e.entity_type} #${e.entity_id || ''}` : '—'}
                    </td>
                    <td className="small" style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                      {e.details ? JSON.stringify(e.details) : '—'}
                    </td>
                    <td className="small text-muted">{e.ip_address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">
              Page {page} of {pages}
            </small>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-primary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <MdNavigateBefore /> Prev
              </button>
              <button
                className="btn btn-outline-primary btn-sm"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
              >
                Next <MdNavigateNext />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
