import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

// Render `fromService.property: host` provides a bare hostname (no scheme).
// Axios needs a full URL, otherwise it becomes a relative path on the frontend origin.
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const API = `${API_BASE.replace(/\/$/, '')}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Only fetch user if we don't already have it (e.g., on page refresh)
      // Skip fetch on public portal pages to prevent timeout
      const isPublicPage = window.location.pathname.includes('/portal/') || 
                          window.location.pathname.includes('/embed/');
      // Skip fetch if we already have user (e.g., just logged in)
      if (!user && !isPublicPage) {
        fetchUser();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchUser = async () => {
    try {
      // Use Promise.race with timeout to prevent hanging
      // Increased timeout to 20 seconds for slow connections
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 20000)
      );
      const response = await Promise.race([
        axios.get(`${API}/auth/me`, {
          timeout: 20000, // Also set axios timeout
          validateStatus: (status) => status < 500 // Don't throw on 401/403
        }),
        timeoutPromise
      ]);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Only logout on actual auth errors (401), not timeouts or network errors
      if (error.response?.status === 401) {
        logout();
      }
      // For timeouts or network errors, just clear loading state
      // Don't logout - user might still have valid token, just slow connection
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // Set timeout to prevent hanging - increased to 30 seconds for slow connections
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timeout')), 30000)
      );
      const response = await Promise.race([
        axios.post(`${API}/auth/login`, { email, password }, {
          timeout: 30000 // Also set axios timeout
        }),
        timeoutPromise
      ]);
      const data = response.data || {};
      const token = data.token || data.access_token || data.jwt;
      const user = data.user;
      if (!token) {
        throw new Error('Login succeeded but no token was returned (check API base URL/env vars).');
      }
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user); // Set user immediately from login response
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Don't fetch user again - we already have it from login response
      setLoading(false);
      return user;
    } catch (error) {
      // Re-throw with better error message
      if (error.message === 'Login request timeout') {
        throw new Error('Login request timed out. Please check your internet connection and try again.');
      }
      throw error;
    }
  };

  const signup = async (email, password, name) => {
    try {
      // Set timeout to prevent hanging - increased to 30 seconds for slow connections
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signup request timeout')), 30000)
      );
      const response = await Promise.race([
        axios.post(`${API}/auth/signup`, { email, password, name }, {
          timeout: 30000 // Also set axios timeout
        }),
        timeoutPromise
      ]);
      const data = response.data || {};
      const token = data.token || data.access_token || data.jwt;
      const user = data.user;
      if (!token) {
        throw new Error('Signup succeeded but no token was returned (check API base URL/env vars).');
      }
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user); // Set user immediately from signup response
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Don't fetch user again - we already have it from signup response
      setLoading(false);
      return user;
    } catch (error) {
      // Re-throw with better error message
      if (error.message === 'Signup request timeout') {
        throw new Error('Signup request timed out. Please check your internet connection and try again.');
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);