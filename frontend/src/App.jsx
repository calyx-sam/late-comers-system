/**
 * App — React Router configuration with protected routes.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddLateArrival from './pages/AddLateArrival';
import DailyRegister from './pages/DailyRegister';
import RepeatedLateArrivals from './pages/RepeatedLateArrivals';
import StudentManagement from './pages/StudentManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import ParentCommunication from './pages/ParentCommunication';
import DepartmentReports from './pages/DepartmentReports';
import MonthlyReports from './pages/MonthlyReports';
import ExportReports from './pages/ExportReports';
import SettingsRules from './pages/SettingsRules';
import UserManagement from './pages/UserManagement';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes — all within dashboard layout */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<StudentManagement />} />
          <Route path="/departments" element={<DepartmentManagement />} />
          <Route path="/add-late-arrival" element={<AddLateArrival />} />
          <Route path="/daily-register" element={<DailyRegister />} />
          <Route path="/repeated-late-arrivals" element={<RepeatedLateArrivals />} />
          <Route path="/parent-communication" element={<ParentCommunication />} />
          <Route path="/department-reports" element={<DepartmentReports />} />
          <Route path="/monthly-reports" element={<MonthlyReports />} />
          <Route path="/export-reports" element={<ExportReports />} />

          {/* Admin-only routes */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute adminOnly>
                <SettingsRules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management"
            element={
              <ProtectedRoute adminOnly>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-log"
            element={
              <ProtectedRoute adminOnly>
                <AuditLog />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
