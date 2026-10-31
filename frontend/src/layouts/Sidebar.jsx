/**
 * Sidebar component — dark navy, responsive, role-aware menu.
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  MdDashboard, MdPeople, MdBusiness, MdPersonAdd, MdListAlt,
  MdRepeat, MdPhone, MdBarChart, MdCalendarMonth, MdFileDownload,
  MdSettings, MdAdminPanelSettings, MdLogout, MdSchool, MdHistory,
} from 'react-icons/md';

const allNavItems = [
  { path: '/dashboard',              label: 'Dashboard',                  icon: MdDashboard,           adminOnly: false },
  { path: '/students',               label: 'Student Management',         icon: MdPeople,              adminOnly: false },
  { path: '/departments',            label: 'Department Management',      icon: MdBusiness,            adminOnly: false },
  { path: '/add-late-arrival',       label: 'Add Late Arrival',           icon: MdPersonAdd,           adminOnly: false },
  { path: '/daily-register',         label: 'Daily Late Comers Register', icon: MdListAlt,             adminOnly: false },
  { path: '/repeated-late-arrivals', label: 'Repeated Late Arrivals',     icon: MdRepeat,              adminOnly: false },
  { path: '/parent-communication',   label: 'Parent/Guardian\nCommunication', icon: MdPhone,           adminOnly: false },
  { path: '/department-reports',     label: 'Department-Wise Reports',    icon: MdBarChart,            adminOnly: false },
  { path: '/monthly-reports',        label: 'Monthly Reports',            icon: MdCalendarMonth,       adminOnly: false },
  { path: '/export-reports',         label: 'Export Reports',             icon: MdFileDownload,        adminOnly: false },
  { path: '/settings',               label: 'Settings & Rules',           icon: MdSettings,            adminOnly: true  },
  { path: '/user-management',        label: 'User Management',            icon: MdAdminPanelSettings,  adminOnly: true  },
  { path: '/audit-log',              label: 'Audit Log',                  icon: MdHistory,             adminOnly: true  },
];

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin, logout, settings } = useAuth();

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <MdSchool />
          </div>
          <div className="sidebar-brand-text">
            <h6>{settings?.college_name || 'College'}</h6>
            <small>Late Comers Management</small>
          </div>
        </div>

        {/* Navigation */}
        <ul className="sidebar-nav">
          {navItems.map(item => (
            <li key={item.path} className="sidebar-nav-item">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <span className="nav-icon"><item.icon /></span>
                <span>{item.label.replace('\n', ' ')}</span>
              </NavLink>
            </li>
          ))}
          <li className="sidebar-nav-item">
            <button className="sidebar-nav-link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}>
              <span className="nav-icon"><MdLogout /></span>
              <span>Logout</span>
            </button>
          </li>
        </ul>

        {/* Footer */}
        <div className="sidebar-footer">
          {settings?.semester_label || ''}<br />
          Reporting time: <strong>{settings?.reporting_time || '08:25'}</strong>
        </div>
      </nav>
    </>
  );
}
