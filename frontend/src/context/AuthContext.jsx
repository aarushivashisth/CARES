import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('cares_auth_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Validate session on app initialization
  useEffect(() => {
    async function verifySession() {
      const savedToken = localStorage.getItem('cares_auth_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response.success && response.user) {
          setUser(response.user);
          setToken(savedToken);
        } else {
          localStorage.removeItem('cares_auth_token');
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err.message);
        localStorage.removeItem('cares_auth_token');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.success && response.token) {
        localStorage.setItem('cares_auth_token', response.token);
        setToken(response.token);
        setUser(response.user);
        return response.user;
      }
      throw new Error(response.error || 'Authentication failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async (patientData) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/register', patientData);
      if (response.success && response.token) {
        localStorage.setItem('cares_auth_token', response.token);
        setToken(response.token);
        setUser(response.user);
        return response.user;
      }
      throw new Error(response.error || 'Registration failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('cares_auth_token');
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  const value = {
    user,
    token,
    loading,
    authError,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
