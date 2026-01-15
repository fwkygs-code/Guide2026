import axios from 'axios';

// Render/Vercel/etc: set REACT_APP_API_URL to your backend base URL (no trailing /api).
// Example: https://your-backend.onrender.com
const API_BASE =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API = `${API_BASE.replace(/\/$/, '')}/api`;

export const api = {
  // Workspaces
  createWorkspace: (data) => axios.post(`${API}/workspaces`, data),
  getWorkspaces: () => axios.get(`${API}/workspaces`),
  getWorkspace: (id) => axios.get(`${API}/workspaces/${id}`),
  updateWorkspace: (id, data) => axios.put(`${API}/workspaces/${id}`, data),

  // Categories
  createCategory: (workspaceId, data) => axios.post(`${API}/workspaces/${workspaceId}/categories`, data),
  getCategories: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/categories`),

  // Walkthroughs
  createWalkthrough: (workspaceId, data) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs`, data),
  getWalkthroughs: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs`),
  getWalkthrough: (workspaceId, id) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`),
  updateWalkthrough: (workspaceId, id, data) => axios.put(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`, data),
  deleteWalkthrough: (workspaceId, id) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`),

  // Steps
  addStep: (workspaceId, walkthroughId, data) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps`, data),
  updateStep: (workspaceId, walkthroughId, stepId, data) => axios.put(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`, data),
  deleteStep: (workspaceId, walkthroughId, stepId) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`),

  // Portal
  getPortal: (slug) => axios.get(`${API}/portal/${slug}`),
  getPublicWalkthrough: (slug, walkthroughId) => axios.get(`${API}/portal/${slug}/walkthroughs/${walkthroughId}`),

  // Analytics
  trackEvent: (data) => axios.post(`${API}/analytics/event`, data),
  getAnalytics: (workspaceId, walkthroughId) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/analytics`),

  // Feedback
  submitFeedback: (data) => axios.post(`${API}/feedback`, data),
  getFeedback: (workspaceId, walkthroughId) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/feedback`),

  // Upload
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};