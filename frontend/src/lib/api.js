import axios from 'axios';

// Render/Vercel/etc: set REACT_APP_API_URL to your backend base URL (no trailing /api).
// Example: https://your-backend.onrender.com
const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

// Render `fromService.property: host` provides a bare hostname (no scheme).
export const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

export const API = `${API_BASE.replace(/\/$/, '')}/api`;
export const apiClient = axios.create({
  baseURL: API,
  withCredentials: true
});

// Get backend URL for sharing (WhatsApp previews need backend route)
export const getBackendUrl = () => {
  // Remove /api suffix if present to get base backend URL
  return API_BASE.replace(/\/api$/, '').replace(/\/$/, '');
};

export const api = {
  // Workspaces
  createWorkspace: (data) => apiClient.post(`/workspaces`, data),
  getWorkspaces: () => apiClient.get(`/workspaces`),
  getWorkspace: (id) => apiClient.get(`/workspaces/${id}`),
  updateWorkspace: (id, data) => apiClient.put(`/workspaces/${id}`, data),
  deleteWorkspace: (id) => apiClient.delete(`/workspaces/${id}`),

  // Categories
  createCategory: (workspaceId, data) => apiClient.post(`/workspaces/${workspaceId}/categories`, data),
  getCategories: (workspaceId) => apiClient.get(`/workspaces/${workspaceId}/categories`),
  updateCategory: (workspaceId, categoryId, data) => apiClient.put(`/workspaces/${workspaceId}/categories/${categoryId}`, data),
  deleteCategory: (workspaceId, categoryId) => apiClient.delete(`/workspaces/${workspaceId}/categories/${categoryId}`),

  // Walkthroughs
  createWalkthrough: (workspaceId, data) => apiClient.post(`/workspaces/${workspaceId}/walkthroughs`, data),
  getWalkthroughs: (workspaceId) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs`),
  getArchivedWalkthroughs: (workspaceId) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs-archived`),
  getWalkthrough: (workspaceId, id) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${id}`),
  updateWalkthrough: (workspaceId, id, data) => apiClient.put(`/workspaces/${workspaceId}/walkthroughs/${id}`, data),
  getWalkthroughVersions: (workspaceId, id) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${id}/versions`),
  deleteWalkthroughVersion: (workspaceId, id, version) => apiClient.delete(`/workspaces/${workspaceId}/walkthroughs/${id}/versions/${version}`),
  rollbackWalkthrough: (workspaceId, id, version) => apiClient.post(`/workspaces/${workspaceId}/walkthroughs/${id}/rollback/${version}`),
  diagnoseWalkthrough: (workspaceId, id) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${id}/diagnose`),
  diagnoseBlocks: (workspaceId, id) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${id}/diagnose-blocks`),
  recoverBlocks: (workspaceId, id, versionNumber = null) => {
    const body = versionNumber !== null ? { version_number: versionNumber } : {};
    return apiClient.post(`/workspaces/${workspaceId}/walkthroughs/${id}/recover-blocks`, body);
  },
  archiveWalkthrough: (workspaceId, id) => apiClient.post(`/workspaces/${workspaceId}/walkthroughs/${id}/archive`),
  restoreWalkthrough: (workspaceId, id) => apiClient.post(`/workspaces/${workspaceId}/walkthroughs/${id}/restore`),
  permanentlyDeleteWalkthrough: (workspaceId, id) => apiClient.delete(`/workspaces/${workspaceId}/walkthroughs/${id}/permanent`),
  deleteWalkthrough: (workspaceId, id) => apiClient.delete(`/workspaces/${workspaceId}/walkthroughs/${id}`),

  // Steps
  addStep: (workspaceId, walkthroughId, data) => apiClient.post(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps`, data),
  updateStep: (workspaceId, walkthroughId, stepId, data) => apiClient.put(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`, data),
  deleteStep: (workspaceId, walkthroughId, stepId) => apiClient.delete(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/${stepId}`),
  reorderSteps: (workspaceId, walkthroughId, step_ids) =>
    apiClient.put(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/steps/reorder`, { step_ids }),

  // Portal
  getPortal: (slug) => apiClient.get(`/portal/${slug}`),
  getPublicWalkthrough: (slug, walkthroughId) => apiClient.get(`/portal/${slug}/walkthroughs/${walkthroughId}`),

  // Analytics
  trackEvent: (data) => apiClient.post(`/analytics/event`, data),
  getAnalytics: (workspaceId, walkthroughId) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/analytics`),
  resetAnalytics: (workspaceId, walkthroughId) => apiClient.delete(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/analytics`),

  // Feedback
  submitFeedback: (data) => apiClient.post(`/feedback`, data),
  getFeedback: (workspaceId, walkthroughId) => apiClient.get(`/workspaces/${workspaceId}/walkthroughs/${walkthroughId}/feedback`),

  // Onboarding
  getOnboardingStatus: () => apiClient.get(`/onboarding/status`),
  completeOnboarding: () => apiClient.post(`/onboarding/complete`),
  dismissOnboarding: () => apiClient.post(`/onboarding/dismiss`),

  // Password Reset
  forgotPassword: (email) => apiClient.post(`/auth/forgot-password`, { email }),
  resetPassword: (token, newPassword, confirmPassword) =>
    apiClient.post(`/auth/reset-password`, { token, new_password: newPassword, confirm_password: confirmPassword }),

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
    const requestPromise = apiClient.post(`/upload`, formData, { 
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
  getUserPlan: () => apiClient.get(`/users/me/plan`),
  getWorkspaceQuota: (workspaceId) => apiClient.get(`/workspaces/${workspaceId}/quota`),
  changePlan: (planName) => apiClient.put(`/users/me/plan`, null, { params: { plan_name: planName } }),
  getPlans: () => apiClient.get(`/plans`),
  
  // PayPal Subscriptions
  subscribePayPal: (data) => apiClient.post(`/billing/paypal/subscribe`, data),
  cancelPayPalSubscription: () => apiClient.post(`/billing/paypal/cancel`),
  // PRODUCTION HARDENING: Reconciliation endpoint (queries PayPal directly)
  reconcileSubscription: () => apiClient.post(`/billing/reconcile`),
  
  // File Management
  deleteFile: (fileId) => apiClient.delete(`/files/${fileId}`),
  
  // Notifications
  getNotifications: () => apiClient.get(`/notifications`),
  markNotificationRead: (notificationId) => apiClient.post(`/notifications/${notificationId}/read`),
  deleteNotification: (notificationId) => apiClient.delete(`/notifications/${notificationId}`),
  
  // Workspace Invitations & Members
  inviteUserToWorkspace: (workspaceId, email) => apiClient.post(`/workspaces/${workspaceId}/invite`, { email }),
  acceptInvitation: (workspaceId, invitationId) => apiClient.post(`/workspaces/${workspaceId}/invitations/${invitationId}/accept`),
  declineInvitation: (workspaceId, invitationId) => apiClient.post(`/workspaces/${workspaceId}/invitations/${invitationId}/decline`),
  removeWorkspaceMember: (workspaceId, userId) => apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`),
  getWorkspaceMembers: (workspaceId) => apiClient.get(`/workspaces/${workspaceId}/members`),
  
  // Workspace Locking
  lockWorkspace: async (workspaceId, force = false) => {
    try {
      const response = await apiClient.post(`/workspaces/${workspaceId}/lock?force=${force}`);
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
      await apiClient.delete(`/workspaces/${workspaceId}/lock`).catch(() => {});
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
  unlockWorkspace: (workspaceId) => apiClient.delete(`/workspaces/${workspaceId}/lock`),
  
  // Admin endpoints
  // Users
  adminListUsers: (page = 1, limit = 50, search = null) => {
    const params = { page, limit };
    if (search) params.search = search;
    return apiClient.get(`/admin/users`, { params });
  },
  adminGetUser: (userId) => apiClient.get(`/admin/users/${userId}`),
  adminUpdateUserRole: (userId, role) => apiClient.put(`/admin/users/${userId}/role`, { role }),
  adminUpdateUserPlan: (userId, planName) => apiClient.put(`/admin/users/${userId}/plan`, { plan_name: planName }),
  
  // Subscriptions
  adminCreateManualSubscription: (userId, planName, durationDays = null) => 
    apiClient.post(`/admin/users/${userId}/subscription/manual`, { plan_name: planName, duration_days: durationDays }),
  adminCancelSubscription: (userId) => apiClient.delete(`/admin/users/${userId}/subscription`),
  adminGetSubscription: (userId) => apiClient.get(`/admin/users/${userId}/subscription`),
  adminUpdateSubscription: (userId, startedAt, effectiveEndDate, status) => 
    apiClient.put(`/admin/users/${userId}/subscription`, { 
      started_at: startedAt, 
      effective_end_date: effectiveEndDate, 
      status: status 
    }),
  adminSendPaymentReminder: (userId, message = null) => 
    apiClient.post(`/admin/users/${userId}/payment-reminder`, { message }),
  
  // User management
  adminDisableUser: (userId) => apiClient.put(`/admin/users/${userId}/disable`),
  adminEnableUser: (userId) => apiClient.put(`/admin/users/${userId}/enable`),
  adminDowngradeUser: (userId) => apiClient.put(`/admin/users/${userId}/plan/downgrade`),
  adminUpgradeUser: (userId) => apiClient.put(`/admin/users/${userId}/plan/upgrade`),
  adminSetGracePeriod: (userId, gracePeriodEndsAt) => 
    apiClient.put(`/admin/users/${userId}/grace-period`, { grace_period_ends_at: gracePeriodEndsAt }),
  adminSetCustomQuota: (userId, storageBytes, maxWorkspaces, maxWalkthroughs) => 
    apiClient.put(`/admin/users/${userId}/quota`, { 
      storage_bytes: storageBytes, 
      max_workspaces: maxWorkspaces, 
      max_walkthroughs: maxWalkthroughs 
    }),
  adminSoftDeleteUser: (userId) => apiClient.put(`/admin/users/${userId}/soft-delete`),
  adminRestoreUser: (userId) => apiClient.put(`/admin/users/${userId}/restore`),
  adminHardDeleteUser: (userId) => apiClient.delete(`/admin/users/${userId}?confirm=true`),
  
  // Stats
  adminGetStats: () => apiClient.get(`/admin/stats`),
  adminGetUserMemberships: (userId, page = 1, limit = 50) => {
    return apiClient.get(`/admin/users/${userId}/memberships`, { params: { page, limit } });
  },
  
  // Existing admin endpoints
  adminReconcileQuota: (userId = null, fixDiscrepancies = false) => {
    const params = { fix_discrepancies: fixDiscrepancies };
    if (userId) params.user_id = userId;
    return apiClient.post(`/admin/reconcile-quota`, null, { params });
  },
  adminCleanupFiles: (pendingHours = 24, failedDays = 7, dryRun = true) => 
    apiClient.post(`/admin/cleanup-files`, null, { 
      params: { pending_hours: pendingHours, failed_days: failedDays, dry_run: dryRun } 
    }),
  adminGetEmailConfig: () => apiClient.get(`/admin/email/config`),
  adminTestEmail: (email) => apiClient.post(`/admin/email/test`, email),
  adminGetPayPalAudit: (subscriptionId) => apiClient.get(`/admin/paypal/audit/${subscriptionId}`),
  adminGetPayPalState: (subscriptionId) => apiClient.get(`/admin/paypal/state/${subscriptionId}`),

  // Knowledge Systems
  createKnowledgeSystem: (workspaceId, data) => apiClient.post(`/workspaces/${workspaceId}/knowledge-systems`, data),
  getKnowledgeSystems: (workspaceId, systemType = null, status = null) => {
    const params = {};
    if (systemType) params.system_type = systemType;
    if (status) params.status = status;
    return apiClient.get(`/workspaces/${workspaceId}/knowledge-systems`, { params });
  },
  getKnowledgeSystem: (workspaceId, systemId) => apiClient.get(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`),
  updateKnowledgeSystem: (workspaceId, systemId, data) => apiClient.put(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, data),
  deleteKnowledgeSystem: (workspaceId, systemId) => apiClient.delete(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`),

  // Public Portal Knowledge Systems (no auth)
  getPortalKnowledgeSystems: (slug, systemType = null) => {
    const params = {};
    if (systemType) params.system_type = systemType;
    return apiClient.get(`/portal/${slug}/knowledge-systems`, { params });
  },
  getPortalKnowledgeSystem: (slug, systemId) => apiClient.get(`/portal/${slug}/knowledge-systems/${systemId}`)
};