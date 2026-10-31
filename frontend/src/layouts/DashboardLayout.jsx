/**
 * DashboardLayout — sidebar + top bar + content area shell.
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from './Sidebar';
import { MdMenu, MdAdd, MdPerson } from 'react-icons/md';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/students': 'Student Management',
  '/departments': 'Department Management',
  '/add-late-arrival': 'Add Late Arrival',
  '/daily-register': 'Daily Late Comers Register',
  '/repeated-late-arrivals': 'Repeated Late Arrivals',
  '/parent-communication': 'Parent/Guardian Communication',
  '/department-reports': 'Department-Wise Reports',
  '/monthly-reports': 'Monthly Reports',
  '/export-reports': 'Export Reports',
  '/settings': 'Settings & Rules',
  '/user-management': 'User Management',
  '/audit-log': 'Audit Log',
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <MdMenu />
            </button>
            <h1 className="page-title">{pageTitle}</h1>
          </div>

          <div className="top-bar-right">
            <button
              className="btn-log-late"
              onClick={() => navigate('/add-late-arrival')}
            >
              <MdAdd /> Log Late Arrival
            </button>
            <div className="user-badge">
              <MdPerson />
              <span>{user?.name || 'User'}</span>
              <span className={`role-badge ${user?.role || 'staff'}`}>
                {user?.role?.toUpperCase() || 'STAFF'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="content-area fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
