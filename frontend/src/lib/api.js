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

// Get backend URL for sharing (WhatsApp previews need backend route)
export const getBackendUrl = () => {
  // Remove /api suffix if present to get base backend URL
  return API_BASE.replace(/\/api$/, '').replace(/\/$/, '');
};

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
  getPlans: () => axios.get(`${API}/plans`),
  
  // PayPal Subscriptions
  subscribePayPal: (data) => axios.post(`${API}/billing/paypal/subscribe`, data),
  cancelPayPalSubscription: () => axios.post(`${API}/billing/paypal/cancel`),
  
  // File Management
  deleteFile: (fileId) => axios.delete(`${API}/files/${fileId}`),
  
  // Notifications
  getNotifications: () => axios.get(`${API}/notifications`),
  markNotificationRead: (notificationId) => axios.post(`${API}/notifications/${notificationId}/read`),
  deleteNotification: (notificationId) => axios.delete(`${API}/notifications/${notificationId}`),
  
  // Workspace Invitations & Members
  inviteUserToWorkspace: (workspaceId, email) => axios.post(`${API}/workspaces/${workspaceId}/invite`, { email }),
  acceptInvitation: (workspaceId, invitationId) => axios.post(`${API}/workspaces/${workspaceId}/invitations/${invitationId}/accept`),
  declineInvitation: (workspaceId, invitationId) => axios.post(`${API}/workspaces/${workspaceId}/invitations/${invitationId}/decline`),
  removeWorkspaceMember: (workspaceId, userId) => axios.delete(`${API}/workspaces/${workspaceId}/members/${userId}`),
  getWorkspaceMembers: (workspaceId) => axios.get(`${API}/workspaces/${workspaceId}/members`),
  
  // Workspace Locking
  lockWorkspace: async (workspaceId, force = false) => {
    try {
      const response = await axios.post(`${API}/workspaces/${workspaceId}/lock?force=${force}`);
      return { success: true, locked: false, data: response.data };
    } catch (error) {
      if (error.response?.status === 409) {
        // Extract locked_by name from error message
        const detail = error.response?.data?.detail || '';
        const match = detail.match(/Another user \(([^)]+)\)/);
        const lockedBy = match ? match[1] : 'Another user';
        return { success: false, locked: true, locked_by: lockedBy, error: detail };
      }
      throw error;
    }
  },
  // Check lock status without acquiring (read-only check)
  checkWorkspaceLock: async (workspaceId) => {
    try {
      // Try to acquire lock with force=false - if it succeeds, release it immediately
      // If it fails with 409, return lock info without acquiring
      const response = await axios.post(`${API}/workspaces/${workspaceId}/lock?force=false`);
      // Lock acquired successfully, release it immediately (we just wanted to check)
      await axios.delete(`${API}/workspaces/${workspaceId}/lock`).catch(() => {});
      return { success: true, locked: false };
    } catch (error) {
      if (error.response?.status === 409) {
        // Extract locked_by name from error message
        const detail = error.response?.data?.detail || '';
        const match = detail.match(/Another user \(([^)]+)\)/);
        const lockedBy = match ? match[1] : 'Another user';
        return { success: false, locked: true, locked_by: lockedBy, error: detail };
      }
      throw error;
    }
  },
  unlockWorkspace: (workspaceId) => axios.delete(`${API}/workspaces/${workspaceId}/lock`),
  
  // Admin endpoints
  // Users
  adminListUsers: (page = 1, limit = 50, search = null) => {
    const params = { page, limit };
    if (search) params.search = search;
    return axios.get(`${API}/admin/users`, { params });
  },
  adminGetUser: (userId) => axios.get(`${API}/admin/users/${userId}`),
  adminUpdateUserRole: (userId, role) => axios.put(`${API}/admin/users/${userId}/role`, { role }),
  adminUpdateUserPlan: (userId, planName) => axios.put(`${API}/admin/users/${userId}/plan`, { plan_name: planName }),
  
  // Subscriptions
  adminCreateManualSubscription: (userId, planName, durationDays = null) => 
    axios.post(`${API}/admin/users/${userId}/subscription/manual`, { plan_name: planName, duration_days: durationDays }),
  adminCancelSubscription: (userId) => axios.delete(`${API}/admin/users/${userId}/subscription`),
  
  // User management
  adminDisableUser: (userId) => axios.put(`${API}/admin/users/${userId}/disable`),
  adminEnableUser: (userId) => axios.put(`${API}/admin/users/${userId}/enable`),
  adminDowngradeUser: (userId) => axios.put(`${API}/admin/users/${userId}/plan/downgrade`),
  adminUpgradeUser: (userId) => axios.put(`${API}/admin/users/${userId}/plan/upgrade`),
  adminSetGracePeriod: (userId, gracePeriodEndsAt) => 
    axios.put(`${API}/admin/users/${userId}/grace-period`, { grace_period_ends_at: gracePeriodEndsAt }),
  adminSetCustomQuota: (userId, storageBytes, maxWorkspaces, maxWalkthroughs) => 
    axios.put(`${API}/admin/users/${userId}/quota`, { 
      storage_bytes: storageBytes, 
      max_workspaces: maxWorkspaces, 
      max_walkthroughs: maxWalkthroughs 
    }),
  
  // Stats
  adminGetStats: () => axios.get(`${API}/admin/stats`),
  adminGetUserMemberships: (userId, page = 1, limit = 50) => {
    return axios.get(`${API}/admin/users/${userId}/memberships`, { params: { page, limit } });
  },
  
  // Existing admin endpoints
  adminReconcileQuota: (userId = null, fixDiscrepancies = false) => {
    const params = { fix_discrepancies: fixDiscrepancies };
    if (userId) params.user_id = userId;
    return axios.post(`${API}/admin/reconcile-quota`, null, { params });
  },
  adminCleanupFiles: (pendingHours = 24, failedDays = 7, dryRun = true) => 
    axios.post(`${API}/admin/cleanup-files`, null, { 
      params: { pending_hours: pendingHours, failed_days: failedDays, dry_run: dryRun } 
    }),
  adminGetEmailConfig: () => axios.get(`${API}/admin/email/config`),
  adminTestEmail: (email) => axios.post(`${API}/admin/email/test`, email),
  adminGetPayPalAudit: (subscriptionId) => axios.get(`${API}/admin/paypal/audit/${subscriptionId}`),
  adminGetPayPalState: (subscriptionId) => axios.get(`${API}/admin/paypal/state/${subscriptionId}`)
};