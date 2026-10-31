/**
 * Monthly Reports — year-level aggregated analytics and month-over-month trends.
 * Includes interactive trend chart, monthly breakdown table, and CSV export.
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MdCalendarMonth,
  MdFileDownload,
  MdPrint,
  MdTrendingUp,
  MdTrendingDown,
  MdBarChart,
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
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function MonthlyReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reports/monthly?year=${year}`);
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load monthly reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year]);

  const handleExport = () => {
    window.open(`/api/exports/monthly?year=${year}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  // 12 months template
  const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyDataMap = {};
  items.forEach((item) => {
    monthlyDataMap[item.month] = item;
  });

  const fullMonths = allMonths.map((m, idx) => {
    const existing = monthlyDataMap[m];
    return {
      month: m,
      month_num: idx + 1,
      total_lates: existing ? existing.total_lates : 0,
      unique_students: existing ? existing.unique_students : 0,
    };
  });

  // Calculate annual stats
  const totalYearLates = fullMonths.reduce((sum, m) => sum + m.total_lates, 0);
  const activeMonths = fullMonths.filter((m) => m.total_lates > 0);
  const avgMonthly =
    activeMonths.length > 0 ? Math.round(totalYearLates / activeMonths.length) : 0;

  let peakMonth = null;
  fullMonths.forEach((m) => {
    if (!peakMonth || m.total_lates > peakMonth.total_lates) {
      peakMonth = m;
    }
  });

  // Chart setup
  const chartData = {
    labels: allMonths,
    datasets: [
      {
        label: 'Total Late Arrivals',
        data: fullMonths.map((m) => m.total_lates),
        backgroundColor: '#2563eb',
        borderRadius: 4,
      },
      {
        label: 'Unique Students',
        data: fullMonths.map((m) => m.unique_students),
        backgroundColor: '#06b6d4',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
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
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold text-secondary d-flex align-items-center gap-1 small">
              <MdCalendarMonth /> Select Academic Year:
            </span>
            <select
              className="form-select form-select-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: 120 }}
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
              onClick={handlePrint}
            >
              <MdPrint /> Print
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
              onClick={handleExport}
            >
              <MdFileDownload /> Export CSV
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

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Year Total</span>
            <h3 className="fw-bold mb-0 text-primary mt-1">{totalYearLates}</h3>
            <span className="small text-muted">Arrivals in {year}</span>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Monthly Average</span>
            <h3 className="fw-bold mb-0 text-dark mt-1">{avgMonthly}</h3>
            <span className="small text-muted">Across active months</span>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Peak Month</span>
            <h3 className="fw-bold mb-0 text-danger mt-1">
              {peakMonth && peakMonth.total_lates > 0 ? peakMonth.month : '—'}
            </h3>
            <span className="small text-muted">
              {peakMonth && peakMonth.total_lates > 0
                ? `${peakMonth.total_lates} arrivals`
                : 'No data yet'}
            </span>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Active Months</span>
            <h3 className="fw-bold mb-0 text-info mt-1">{activeMonths.length} / 12</h3>
            <span className="small text-muted">With recorded latecomers</span>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Chart Section */}
          <div className="content-card mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <MdBarChart className="text-primary fs-5" /> 12-Month Trend ({year})
              </h6>
            </div>
            <div style={{ height: 300 }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="content-card">
            <h6 className="fw-bold mb-3">Month-by-Month Summary</h6>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Month</th>
                    <th className="text-center">Total Late Arrivals</th>
                    <th className="text-center">Unique Students</th>
                    <th>Share of Year</th>
                    <th>Trend vs Prior Month</th>
                  </tr>
                </thead>
                <tbody>
                  {fullMonths.map((m, idx) => {
                    const prevMonth = idx > 0 ? fullMonths[idx - 1] : null;
                    const diff = prevMonth ? m.total_lates - prevMonth.total_lates : 0;
                    const pct =
                      totalYearLates > 0
                        ? Math.round((m.total_lates / totalYearLates) * 100)
                        : 0;

                    return (
                      <tr key={m.month}>
                        <td>
                          <strong>{m.month} {year}</strong>
                        </td>
                        <td className="text-center">
                          <span
                            className={`badge ${
                              m.total_lates > 0 ? 'bg-primary text-white' : 'bg-light text-muted border'
                            } px-3 py-1 fs-6`}
                          >
                            {m.total_lates}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-info text-dark px-3 py-1">
                            {m.unique_students}
                          </span>
                        </td>
                        <td style={{ minWidth: 150 }}>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 6 }}>
                              <div
                                className="progress-bar bg-primary"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="small text-muted" style={{ width: 35 }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td>
                          {idx === 0 || (!prevMonth.total_lates && !m.total_lates) ? (
                            <span className="text-muted small">—</span>
                          ) : diff > 0 ? (
                            <span className="text-danger small d-inline-flex align-items-center gap-1">
                              <MdTrendingUp /> +{diff} arrivals
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-success small d-inline-flex align-items-center gap-1">
                              <MdTrendingDown /> {diff} arrivals
                            </span>
                          ) : (
                            <span className="text-muted small">No change</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
