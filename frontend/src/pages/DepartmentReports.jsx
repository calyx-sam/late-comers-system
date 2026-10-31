/**
 * Department-Wise Reports — comparative breakdown of late arrivals across departments.
 * Includes interactive bar chart, department metrics table, date range filters, and export.
 */

import { useState, useEffect } from 'react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MdBusiness,
  MdFilterList,
  MdFileDownload,
  MdPrint,
  MdBarChart,
  MdPeople,
} from 'react-icons/md';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DepartmentReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  // Date range state
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await api.get(`/reports/department?${params.toString()}`);
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load department report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.open(`/api/exports/department?${params.toString()}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  // Chart configuration
  const chartData = {
    labels: items.map((i) => i.code || i.department),
    datasets: [
      {
        label: 'Total Late Arrivals',
        data: items.map((i) => i.total_lates),
        backgroundColor: '#2563eb',
        borderRadius: 4,
      },
      {
        label: 'Unique Students',
        data: items.map((i) => i.unique_students),
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

  const totalAllLates = items.reduce((sum, i) => sum + (i.total_lates || 0), 0);
  const totalUniqueStudents = items.reduce((sum, i) => sum + (i.unique_students || 0), 0);

  return (
    <div className="fade-in">
      {/* Top Filter Bar */}
      <div className="content-card mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold text-secondary d-flex align-items-center gap-1 small">
              <MdFilterList /> Period:
            </span>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-muted small">to</span>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
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

      {/* Overview Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Total Departments</span>
            <h3 className="fw-bold mb-0 text-primary mt-1">{items.length}</h3>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Total Late Arrivals</span>
            <h3 className="fw-bold mb-0 text-dark mt-1">{totalAllLates}</h3>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="content-card h-100">
            <span className="text-muted small fw-semibold text-uppercase">Unique Students</span>
            <h3 className="fw-bold mb-0 text-info mt-1">{totalUniqueStudents}</h3>
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
                <MdBarChart className="text-primary fs-5" /> Comparison Chart
              </h6>
              <span className="small text-muted">Arrivals vs Students</span>
            </div>
            <div style={{ height: 300 }}>
              {items.length > 0 ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                  No data available for this range.
                </div>
              )}
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="content-card">
            <h6 className="fw-bold mb-3">Department Statistics Table</h6>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Department Name</th>
                    <th>Code</th>
                    <th className="text-center">Total Late Arrivals</th>
                    <th className="text-center">Unique Students</th>
                    <th>Share of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const percentage =
                      totalAllLates > 0
                        ? Math.round((row.total_lates / totalAllLates) * 100)
                        : 0;
                    return (
                      <tr key={idx}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="p-2 bg-light text-primary rounded-2">
                              <MdBusiness />
                            </div>
                            <span className="fw-semibold">{row.department}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">{row.code}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-primary text-white fs-6 px-3 py-1">
                            {row.total_lates}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-info text-dark px-3 py-1">
                            {row.unique_students}
                          </span>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="progress flex-grow-1"
                              style={{ height: 6 }}
                            >
                              <div
                                className="progress-bar bg-primary"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="small text-muted fw-semibold" style={{ width: 40 }}>
                              {percentage}%
                            </span>
                          </div>
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
