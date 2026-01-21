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
  const [isBlocked, setIsBlocked] = useState(false);

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
          validateStatus: (status) => status < 500, // Don't throw on 401/403
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        timeoutPromise
      ]);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Check if account is disabled or deleted (403)
      if (error.response?.status === 403) {
        setIsBlocked(true);
        setLoading(false);
        return;
      }
      // Only logout on actual auth errors (401), not timeouts or network errors
      if (error.response?.status === 401) {
        logout();
      }
      // For timeouts or network errors, just clear loading state
      // Don't logout - user might still have valid token, just slow connection
      // This prevents the "Failed to fetch user" error from blocking the app
    } finally {
      setLoading(false);
    }
  };

  // Check if backend is available before attempting login
  const checkBackendHealth = async () => {
    try {
      // Try /health first, then /api/health as fallback
      let response;
      try {
        response = await axios.get(`${API_BASE}/health`, {
          timeout: 5000 // Quick health check
        });
      } catch (err) {
        // If /health fails with 404, try /api/health
        if (err.response?.status === 404) {
          response = await axios.get(`${API_BASE}/api/health`, {
            timeout: 5000
          });
        } else {
          throw err;
        }
      }
      return response.data?.status === 'healthy';
    } catch (error) {
      console.warn('Backend health check failed:', error);
      return false;
    }
  };

  const login = async (email, password) => {
    try {
      // Check backend health (non-blocking - just for info)
      // Don't fail login if health check fails - the login request itself will wake the server
      checkBackendHealth().then(isHealthy => {
        if (!isHealthy) {
          console.warn('Backend health check failed - system may be initializing');
        }
      }).catch(() => {
        // Ignore health check errors
      });
      
      // Set timeout to prevent hanging - increased to 45 seconds for system initialization
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timeout')), 45000)
      );
      
      // Log API endpoint for debugging
      console.log('Attempting login to:', `${API}/auth/login`);
      
      // Retry logic for system initialization
      let lastError = null;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await Promise.race([
            axios.post(`${API}/auth/login`, { email, password }, {
              timeout: 45000, // Also set axios timeout - longer for wake-up
              headers: {
                'Content-Type': 'application/json'
              }
            }),
            timeoutPromise
          ]);
          
          // Success - break out of retry loop
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
          lastError = error;
          // If it's a timeout and we have retries left, wait and retry
          if ((error.message === 'Login request timeout' || error.code === 'ECONNABORTED') && attempt < maxRetries) {
            console.log(`Login attempt ${attempt + 1} timed out, retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            continue;
          }
          // Otherwise, break and throw the error
          break;
        }
      }
      
      // If we get here, all retries failed - throw the last error
      throw lastError;
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        apiUrl: `${API}/auth/login`,
        apiBase: API_BASE
      });
      
      // Check if account is blocked (403)
      if (error.response?.status === 403) {
        setIsBlocked(true);
        throw new Error('Account is disabled or deleted. Please contact support at support@interguide.app');
      }
      
      // Re-throw with better error message
      if (error.message === 'Login request timeout' || error.code === 'ECONNABORTED') {
        throw new Error(`Backend server is not responding. The server at ${API_BASE} may be sleeping or unavailable. Please try again in a moment.`);
      }
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        throw new Error(`Cannot connect to backend server at ${API_BASE}. Please check your internet connection and verify the server is running.`);
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
      const email_verification_sent = data.email_verification_sent;
      if (!token) {
        throw new Error('Signup succeeded but no token was returned (check API base URL/env vars).');
      }
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user); // Set user immediately from signup response
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Don't fetch user again - we already have it from signup response
      setLoading(false);
      return { user, email_verification_sent };
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
    setIsBlocked(false);
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, isBlocked }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);