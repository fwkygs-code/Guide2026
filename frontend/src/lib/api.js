import axios from 'axios';

// Render/Vercel/etc: set REACT_APP_API_URL to your backend base URL (no trailing /api).
// Example: https://your-backend.onrender.com
const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

// Render `fromService.property: host` provides a bare hostname (no scheme).
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const API = `${API_BASE.replace(/\/$/, '')}/api`;

export const api = {
  // Workspaces
  createWorkspace: (data) => axios.post(`${API}/workspaces`, data),
  getWorkspaces: () => axios.get(`${API}/workspaces`),
  getWorkspace: (id) => axios.get(`${API}/workspaces/${id}`),
  updateWorkspace: (id, data) => axios.put(`${API}/workspaces/${id}`, data),
  deleteWorkspace: (id) => axios.delete(`${API}/workspaces/${id}`),

  // Categories
  createCategory: (workspaceId, data) => axios.post(`${API}/workspaces/${workspaceId}/categories`, data),
  getCategories: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/categories`),
  updateCategory: (workspaceId, categoryId, data) => axios.put(`${API}/workspaces/${workspaceId}/categories/${categoryId}`, data),
  deleteCategory: (workspaceId, categoryId) => axios.delete(`${API}/workspaces/${workspaceId}/categories/${categoryId}`),

  // Walkthroughs
  createWalkthrough: (workspaceId, data) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs`, data),
  getWalkthroughs: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs`),
  getArchivedWalkthroughs: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs-archived`),
  getWalkthrough: (workspaceId, id) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`),
  updateWalkthrough: (workspaceId, id, data) => axios.put(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`, data),
  getWalkthroughVersions: (workspaceId, id) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/versions`),
  deleteWalkthroughVersion: (workspaceId, id, version) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/versions/${version}`),
  rollbackWalkthrough: (workspaceId, id, version) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/rollback/${version}`),
  diagnoseWalkthrough: (workspaceId, id) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/diagnose`),
  diagnoseBlocks: (workspaceId, id) => axios.get(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/diagnose-blocks`),
  recoverBlocks: (workspaceId, id, versionNumber = null) => {
    const body = versionNumber !== null ? { version_number: versionNumber } : {};
    return axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/recover-blocks`, body);
  },
  archiveWalkthrough: (workspaceId, id) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/archive`),
  restoreWalkthrough: (workspaceId, id) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/restore`),
  permanentlyDeleteWalkthrough: (workspaceId, id) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${id}/permanent`),
  deleteWalkthrough: (workspaceId, id) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${id}`),

  // Steps
  addStep: (workspaceId, walkthroughId, data) => axios.post(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps`, data),
  updateStep: (workspaceId, walkthroughId, stepId, data) => axios.put(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`, data),
  deleteStep: (workspaceId, walkthroughId, stepId) => axios.delete(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`),
  reorderSteps: (workspaceId, walkthroughId, step_ids) =>
    axios.put(`${API}/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/reorder`, { step_ids }),

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
  uploadFile: (file, options = {}) => {
    console.log('[API] uploadFile called:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      options,
      endpoint: `${API}/upload`
    });
    
    const formData = new FormData();
    formData.append('file', file);
    
    // CRITICAL: Move all metadata to FormData body, NOT headers
    // Headers cannot contain Unicode characters (ISO-8859-1 only)
    // User-controlled values like filenames must be in body, not headers
    if (options.workspaceId) {
      formData.append('workspace_id', options.workspaceId);
    }
    if (options.idempotencyKey) {
      // Idempotency key may contain Unicode from filename, so it must be in body
      formData.append('idempotency_key', options.idempotencyKey);
    }
    if (options.referenceType) {
      formData.append('reference_type', options.referenceType);
    }
    if (options.referenceId) {
      formData.append('reference_id', options.referenceId);
    }
    
    // Only set Content-Type header - let browser set it with boundary for multipart/form-data
    const headers = {};
    
    console.log('[API] Making POST request to:', `${API}/upload`, 'with FormData (no Unicode in headers)');
    
    // Set timeout for large files (GIFs can be several MB)
    // 5 minutes should be enough for most files
    const requestPromise = axios.post(`${API}/upload`, formData, { 
      headers,
      timeout: 300000, // 5 minutes for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`[API] Upload progress: ${percentCompleted}%`);
        }
      }
    });
    
    requestPromise
      .then(response => {
        console.log('[API] Upload request succeeded:', response);
      })
      .catch(error => {
        console.error('[API] Upload request failed:', error);
        if (error.code === 'ECONNABORTED') {
          console.error('[API] Upload timed out - file may be too large or connection too slow');
        }
      });
    
    return requestPromise;
  },
  
  // Quota & Plan
  getUserPlan: () => axios.get(`${API}/users/me/plan`),
  getWorkspaceQuota: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/quota`),
  changePlan: (planName) => axios.put(`${API}/users/me/plan`, null, { params: { plan_name: planName } }),
  createCheckoutSession: () => axios.post(`${API}/subscriptions/create-checkout`),
  getPlans: () => axios.get(`${API}/plans`),
  
  // File Management
  deleteFile: (fileId) => axios.delete(`${API}/files/${fileId}`)
};