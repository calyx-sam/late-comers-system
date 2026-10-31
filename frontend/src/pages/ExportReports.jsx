/**
 * Export Reports page — central export center for Daily Register, Repeated Late Comers,
 * Department-wise summaries, and Annual Monthly reports with CSV formula injection protection.
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  MdFileDownload,
  MdSecurity,
  MdToday,
  MdWarning,
  MdBusiness,
  MdCalendarMonth,
  MdCheckCircle,
} from 'react-icons/md';

export default function ExportReports() {
  const [departments, setDepartments] = useState([]);
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  // Daily Register Export State
  const [dailyFrom, setDailyFrom] = useState(todayStr);
  const [dailyTo, setDailyTo] = useState(todayStr);
  const [dailyDept, setDailyDept] = useState('');

  // Repeated Late Comers Export State
  const [repeatFrom, setRepeatFrom] = useState(firstOfMonth);
  const [repeatTo, setRepeatTo] = useState(todayStr);
  const [repeatThreshold, setRepeatThreshold] = useState(3);

  // Department Export State
  const [deptFrom, setDeptFrom] = useState(firstOfMonth);
  const [deptTo, setDeptTo] = useState(todayStr);

  // Monthly Export State
  const currentYear = new Date().getFullYear();
  const [monthlyYear, setMonthlyYear] = useState(currentYear);

  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.departments || res || []))
      .catch(() => {});
  }, []);

  const handleExportDaily = () => {
    const params = new URLSearchParams();
    if (dailyFrom) params.set('from', dailyFrom);
    if (dailyTo) params.set('to', dailyTo);
    if (dailyDept) params.set('department_id', dailyDept);
    window.open(`/api/exports/daily?${params.toString()}`, '_blank');
  };

  const handleExportRepeated = () => {
    const params = new URLSearchParams();
    params.set('threshold', repeatThreshold);
    if (repeatFrom) params.set('from', repeatFrom);
    if (repeatTo) params.set('to', repeatTo);
    window.open(`/api/exports/repeated?${params.toString()}`, '_blank');
  };

  const handleExportDepartment = () => {
    const params = new URLSearchParams();
    if (deptFrom) params.set('from', deptFrom);
    if (deptTo) params.set('to', deptTo);
    window.open(`/api/exports/department?${params.toString()}`, '_blank');
  };

  const handleExportMonthly = () => {
    window.open(`/api/exports/monthly?year=${monthlyYear}`, '_blank');
  };

  return (
    <div className="fade-in">
      {/* Security Banner */}
      <div className="alert alert-info d-flex align-items-center gap-3 mb-4">
        <MdSecurity className="fs-3 flex-shrink-0 text-primary" />
        <div className="small">
          <strong>Security Protection Active:</strong> All CSV and spreadsheet exports automatically
          neutralise spreadsheet formula injection (CWE-1236). Leading <code>=</code>, <code>+</code>,
          <code>-</code>, or <code>@</code> characters are escaped to prevent formula execution in
          Microsoft Excel, LibreOffice, and Google Sheets.
        </div>
      </div>

      <div className="row g-4">
        {/* 1. Daily Register Export */}
        <div className="col-12 col-md-6">
          <div className="content-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-primary bg-opacity-10 text-primary rounded-2 fs-5">
                  <MdToday />
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Daily Late Comers Register</h6>
                  <small className="text-muted">Itemised log of all late arrival entries</small>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dailyFrom}
                    onChange={(e) => setDailyFrom(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dailyTo}
                    onChange={(e) => setDailyTo(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold text-secondary">Department</label>
                  <select
                    className="form-select form-select-sm"
                    value={dailyDept}
                    onChange={(e) => setDailyDept(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleExportDaily}
            >
              <MdFileDownload /> Export Daily Register (.CSV)
            </button>
          </div>
        </div>

        {/* 2. Repeated Late Arrivals Export */}
        <div className="col-12 col-md-6">
          <div className="content-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-danger bg-opacity-10 text-danger rounded-2 fs-5">
                  <MdWarning />
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Repeated Late Comers Summary</h6>
                  <small className="text-muted">Repeat offenders with guardian contact info</small>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={repeatFrom}
                    onChange={(e) => setRepeatFrom(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={repeatTo}
                    onChange={(e) => setRepeatTo(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold text-secondary">
                    Threshold (Minimum Late Arrivals)
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={repeatThreshold}
                    onChange={(e) => setRepeatThreshold(Number(e.target.value))}
                  >
                    <option value="2">&ge; 2 Late Arrivals</option>
                    <option value="3">&ge; 3 Late Arrivals (Default)</option>
                    <option value="5">&ge; 5 Late Arrivals (Severe)</option>
                    <option value="7">&ge; 7 Late Arrivals</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-danger w-100 d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleExportRepeated}
            >
              <MdFileDownload /> Export Repeat Offenders (.CSV)
            </button>
          </div>
        </div>

        {/* 3. Department-Wise Summary Export */}
        <div className="col-12 col-md-6">
          <div className="content-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-info bg-opacity-10 text-info rounded-2 fs-5">
                  <MdBusiness />
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Department-Wise Report</h6>
                  <small className="text-muted">Aggregated counts per academic department</small>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={deptFrom}
                    onChange={(e) => setDeptFrom(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold text-secondary">To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={deptTo}
                    onChange={(e) => setDeptTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-info text-dark w-100 d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleExportDepartment}
            >
              <MdFileDownload /> Export Department Summary (.CSV)
            </button>
          </div>
        </div>

        {/* 4. Monthly Summary Export */}
        <div className="col-12 col-md-6">
          <div className="content-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-success bg-opacity-10 text-success rounded-2 fs-5">
                  <MdCalendarMonth />
                </div>
                <div>
                  <h6 className="fw-bold mb-0">Annual Monthly Report</h6>
                  <small className="text-muted">12-month summary for an academic calendar year</small>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Academic Year</label>
                <select
                  className="form-select form-select-sm"
                  value={monthlyYear}
                  onChange={(e) => setMonthlyYear(Number(e.target.value))}
                >
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-success w-100 d-inline-flex align-items-center justify-content-center gap-2"
              onClick={handleExportMonthly}
            >
              <MdFileDownload /> Export Annual Monthly Summary (.CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
