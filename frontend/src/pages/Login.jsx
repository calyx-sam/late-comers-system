/**
 * Login page — split screen with college branding and Google sign-in.
 * Handles ?error=access_denied from OAuth callback.
 * No demo credentials shown.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MdSchool, MdCheckCircle, MdLogin, MdError } from 'react-icons/md';

export default function Login() {
  const { isAuthenticated, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;

    const reason = searchParams.get('reason');

    const errorMessages = {
      state_mismatch: 'Authentication session expired or state mismatch. Please try signing in again.',
      token_exchange_failed: 'Failed to exchange authorization code with Google. Please try again.',
      token_invalid: 'Invalid or malformed Google authentication token.',
      email_not_verified: 'Your Google email is not verified.',
      domain_not_allowed: 'Your email domain is not authorized for this portal.',
      user_not_found: 'Your account is not registered. Please contact the administrator.',
      user_inactive: 'Your account has been deactivated. Please contact the administrator.',
      db_error: 'Database connection error during login. Please try again later.',
      access_denied: 'Access denied. Contact your administrator.',
    };

    let msg = errorMessages[err] || `Sign in failed: ${err}`;
    if (reason) {
      msg += ` (Reason: ${reason})`;
    }
    setError(msg);
  }, [searchParams]);

  return (
    <div className="login-page">
      {/* Left — Branding */}
      <div className="login-left">
        <div className="login-left-content">
          <div style={{ marginBottom: '24px' }}>
            <MdSchool style={{ fontSize: '48px', color: '#2563eb' }} />
          </div>
          <h1>College Late Comers<br />Management System</h1>
          <p>
            Record, monitor and report student late arrivals — department-wise,
            month-wise, with parent communication tracking.
          </p>
          <ul className="login-features">
            <li>
              <MdCheckCircle className="check-icon" />
              Secure role-based access for admin &amp; staff
            </li>
            <li>
              <MdCheckCircle className="check-icon" />
              Automatic delay &amp; repeat-offender detection
            </li>
            <li>
              <MdCheckCircle className="check-icon" />
              Excel, PDF &amp; printable report exports
            </li>
          </ul>
        </div>
      </div>

      {/* Right — Sign In Card */}
      <div className="login-right">
        <div className="login-card">
          <h2>Staff Sign In</h2>
          <p className="subtitle">Authorized college staff only</p>

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
              <MdError style={{ fontSize: '20px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn-google" onClick={login}>
            <MdLogin />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
