/**
 * Auth context — provides current user state and login/logout methods.
 * Fetches /api/auth/me on mount to check for existing session.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user || null);
      if (data.settings) setSettings(data.settings);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch {
      // Settings not available yet
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = '/login';
  };

  const value = {
    user,
    loading,
    settings,
    login,
    logout,
    refreshUser: fetchUser,
    refreshSettings: fetchSettings,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
