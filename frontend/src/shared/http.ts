import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API_ROOT = `${API_BASE.replace(/\/$/, '')}/api`;

let cachedClient = null;
let authExpired = false;
let sessionActive = false;

const isAuthRoute = (url?: string) => {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  );
};

const notifyAuthExpired = () => {
  if (authExpired) return;
  authExpired = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ig:auth-expired'));
  }
};

export const getApiBase = () => API_BASE;
export const getApiRoot = () => API_ROOT;
export const resetAuthExpiredFlag = () => {
  authExpired = false;
};
export const setAuthSessionActive = (isActive: boolean) => {
  sessionActive = isActive;
  if (!isActive) {
    authExpired = false;
  }
};

export const getApiClient = () => {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = axios.create({
    baseURL: API_ROOT,
    withCredentials: true
  });
  cachedClient.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    if (authExpired && method !== 'get' && !isAuthRoute(config.url)) {
      notifyAuthExpired();
      const error = new Error('AUTH_EXPIRED');
      error.name = 'AuthExpiredError';
      // @ts-expect-error attach code for downstream handling
      error.code = 'AUTH_EXPIRED';
      return Promise.reject(error);
    }
    return config;
  });
  cachedClient.interceptors.response.use(
    (response) => {
      if (response.status === 401 && sessionActive) {
        notifyAuthExpired();
      }
      return response;
    },
    (error) => {
      if (error?.response?.status === 401 && sessionActive) {
        notifyAuthExpired();
      }
      return Promise.reject(error);
    }
  );
  return cachedClient;
};
