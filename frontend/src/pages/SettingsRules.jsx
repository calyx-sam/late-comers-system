/**
 * Settings & Rules — admin can edit college name, reporting time,
 * repeat threshold, and semester label. Single-row settings.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { MdSave, MdSettings } from 'react-icons/md';

export default function SettingsRules() {
  const { refreshSettings } = useAuth();
  const [form, setForm] = useState({
    college_name: '',
    reporting_time: '08:25',
    repeat_threshold: 3,
    semester_label: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      setForm({
        college_name: data.college_name || '',
        reporting_time: data.reporting_time || '08:25',
        repeat_threshold: data.repeat_threshold || 3,
        semester_label: data.semester_label || '',
      });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.put('/settings', form);
      setMessage({ type: 'success', text: 'Settings updated successfully' });
      refreshSettings();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
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

      <div className="content-card" style={{ maxWidth: '700px' }}>
        <div className="content-card-header">
          <h5 className="content-card-title d-flex align-items-center gap-2">
            <MdSettings /> Settings &amp; Rules
          </h5>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold">College Name</label>
            <input
              type="text"
              className="form-control"
              value={form.college_name}
              onChange={e => handleChange('college_name', e.target.value)}
              maxLength={200}
              required
            />
            <small className="text-muted">This name appears in the sidebar, reports, and exports.</small>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Scheduled Reporting Time</label>
              <input
                type="time"
                className="form-control"
                value={form.reporting_time}
                onChange={e => handleChange('reporting_time', e.target.value)}
                required
              />
              <small className="text-muted">Students arriving after this time are marked late.</small>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Repeat Threshold</label>
              <input
                type="number"
                className="form-control"
                value={form.repeat_threshold}
                onChange={e => handleChange('repeat_threshold', parseInt(e.target.value) || 1)}
                min={1}
                max={50}
                required
              />
              <small className="text-muted">Students with ≥ this many late arrivals are flagged as repeat offenders.</small>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold">Semester Label</label>
            <input
              type="text"
              className="form-control"
              value={form.semester_label}
              onChange={e => handleChange('semester_label', e.target.value)}
              maxLength={100}
              placeholder="e.g., 2025-26 Even Semester"
            />
            <small className="text-muted">Displayed in the sidebar footer.</small>
          </div>

          <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={saving}>
            <MdSave />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
