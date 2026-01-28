import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API_ROOT = `${API_BASE.replace(/\/$/, '')}/api`;

let cachedClient = null;

export const getApiBase = () => API_BASE;
export const getApiRoot = () => API_ROOT;

export const getApiClient = () => {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = axios.create({
    baseURL: API_ROOT,
    withCredentials: true
  });
  return cachedClient;
};
