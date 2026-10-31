/**
 * Dashboard page — real-time statistics, trend charts, department distribution,
 * and quick-action shortcuts.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MdToday,
  MdWarning,
  MdBusiness,
  MdContactPhone,
  MdTrendingUp,
  MdAdd,
  MdFilterList,
  MdRefresh,
} from 'react-icons/md';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);

  // Default dates: current month from day 1 to today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [deptFilter, setDeptFilter] = useState('');

  const [data, setData] = useState({
    stats: {
      total_students: 0,
      late_today: 0,
      late_period: 0,
      top_department: null,
      repeat_count: 0,
      parent_notified: 0,
      threshold: 3,
    },
    charts: {
      department: [],
      daily: [],
    },
  });

  // Load departments
  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.departments || res || []))
      .catch(() => {});
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (deptFilter) params.set('department_id', deptFilter);

      const res = await api.get(`/dashboard?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [dateFrom, dateTo, deptFilter]);

  const setPreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
      setDateFrom(monday);
      setDateTo(todayStr);
    } else if (preset === 'month') {
      setDateFrom(firstOfMonth);
      setDateTo(todayStr);
    }
  };

  // Bar chart configuration for department distribution
  const deptChartData = {
    labels: (data.charts?.department || []).map((d) => d.name),
    datasets: [
      {
        label: 'Late Arrivals',
        data: (data.charts?.department || []).map((d) => d.count),
        backgroundColor: '#2563eb',
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ],
  };

  const deptChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.parsed.y} late comers`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#e2e8f0' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  // Line chart configuration for daily trend
  const dailyChartData = {
    labels: (data.charts?.daily || []).map((d) => {
      const parts = d.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    }),
    datasets: [
      {
        label: 'Late Arrivals per Day',
        data: (data.charts?.daily || []).map((d) => d.count),
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#0284c7',
      },
    ],
  };

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.parsed.y} student(s)`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#e2e8f0' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  return (
    <div className="fade-in">
      {/* Top Filter Bar */}
      <div className="content-card mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold text-secondary d-flex align-items-center gap-1">
              <MdFilterList /> Filter Period:
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className={`btn btn-outline-primary ${dateFrom === todayStr && dateTo === todayStr ? 'active' : ''}`}
                onClick={() => setPreset('today')}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => setPreset('week')}
              >
                This Week
              </button>
              <button
                type="button"
                className={`btn btn-outline-primary ${dateFrom === firstOfMonth && dateTo === todayStr ? 'active' : ''}`}
                onClick={() => setPreset('month')}
              >
                This Month
              </button>
            </div>
            <div className="d-flex align-items-center gap-1 ms-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-muted">to</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={loadDashboardData}
              title="Refresh"
            >
              <MdRefresh /> Refresh
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

      {/* KPI Stat Cards */}
      <div className="row g-3 mb-4">
        {/* Late Today */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="content-card stat-kpi-card h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/daily-register')}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-muted mb-1 small fw-semibold text-uppercase">Late Today</p>
                <h3 className="fw-bold mb-0 text-primary">{data.stats.late_today}</h3>
                <span className="small text-muted">Arrivals logged today</span>
              </div>
              <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-3 fs-4">
                <MdToday />
              </div>
            </div>
          </div>
        </div>

        {/* Total In Period */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="content-card stat-kpi-card h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/daily-register')}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-muted mb-1 small fw-semibold text-uppercase">Late in Period</p>
                <h3 className="fw-bold mb-0 text-dark">{data.stats.late_period}</h3>
                <span className="small text-muted">From {dateFrom} to {dateTo}</span>
              </div>
              <div className="p-3 bg-info bg-opacity-10 text-info rounded-3 fs-4">
                <MdTrendingUp />
              </div>
            </div>
          </div>
        </div>

        {/* Repeat Offenders */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="content-card stat-kpi-card h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/repeated-late-arrivals')}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-muted mb-1 small fw-semibold text-uppercase">Repeat Offenders</p>
                <h3 className="fw-bold mb-0 text-danger">{data.stats.repeat_count}</h3>
                <span className="small text-muted">&ge; {data.stats.threshold} late arrivals</span>
              </div>
              <div className="p-3 bg-danger bg-opacity-10 text-danger rounded-3 fs-4">
                <MdWarning />
              </div>
            </div>
          </div>
        </div>

        {/* Parent Informed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="content-card stat-kpi-card h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/parent-communication')}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-muted mb-1 small fw-semibold text-uppercase">Parents Informed</p>
                <h3 className="fw-bold mb-0 text-success">{data.stats.parent_notified}</h3>
                <span className="small text-muted">Communications completed</span>
              </div>
              <div className="p-3 bg-success bg-opacity-10 text-success rounded-3 fs-4">
                <MdContactPhone />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Charts Row */}
          <div className="row g-4 mb-4">
            {/* Daily Trend Line Chart */}
            <div className="col-12 col-lg-7">
              <div className="content-card h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Daily Late Arrival Trend</h6>
                  <span className="badge bg-light text-secondary border">Timeline</span>
                </div>
                <div style={{ height: 280 }}>
                  {data.charts.daily && data.charts.daily.length > 0 ? (
                    <Line data={dailyChartData} options={dailyChartOptions} />
                  ) : (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                      No arrival records for this date range.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Department Distribution Bar Chart */}
            <div className="col-12 col-lg-5">
              <div className="content-card h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Late Arrivals by Department</h6>
                  <span className="badge bg-light text-secondary border">Department</span>
                </div>
                <div style={{ height: 280 }}>
                  {data.charts.department && data.charts.department.length > 0 ? (
                    <Bar data={deptChartData} options={deptChartOptions} />
                  ) : (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                      No department data for this date range.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="content-card bg-primary text-white p-4">
            <div className="row align-items-center">
              <div className="col-12 col-md-8 mb-3 mb-md-0">
                <h5 className="fw-bold mb-1">Gate Entry & Late Arrival Tracking</h5>
                <p className="mb-0 text-white-50 small">
                  Quickly log arriving students with auto-calculated delay minutes, reason tracking, and instant repeat counter.
                </p>
              </div>
              <div className="col-12 col-md-4 text-md-end">
                <button
                  type="button"
                  className="btn btn-light text-primary fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                  onClick={() => navigate('/add-late-arrival')}
                >
                  <MdAdd /> Log Student Arrival
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
