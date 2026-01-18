import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export const useQuota = (workspaceId = null) => {
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQuotaData();
  }, [workspaceId]);

  const fetchQuotaData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const planResponse = await api.getUserPlan();
      const planData = planResponse.data;
      
      let workspaceQuota = null;
      if (workspaceId) {
        try {
          const workspaceResponse = await api.getWorkspaceQuota(workspaceId);
          workspaceQuota = workspaceResponse.data;
        } catch (err) {
          console.warn('Workspace quota not available:', err);
        }
      }
      
      setQuotaData({
        plan: planData.plan,
        subscription: planData.subscription,
        trial_period_end: planData.trial_period_end || null,
        next_billing_date: planData.next_billing_date || null,
        current_period_end: planData.current_period_end || null,
        cancel_at_period_end: planData.cancel_at_period_end || false,
        paypal_verified_status: planData.paypal_verified_status || null,
        last_verified_at: planData.last_verified_at || null,
        cancellation_receipt: planData.cancellation_receipt || null,
        quota: {
          storage_used: planData.quota.storage_used_bytes || 0,
          storage_allowed: planData.quota.storage_allowed_bytes || 0,
          workspaces_used: planData.quota.workspace_count || 0,
          workspaces_limit: planData.quota.workspace_limit,
          walkthroughs_used: planData.quota.walkthroughs_used || 0,
          walkthroughs_limit: planData.quota.walkthroughs_limit,
          categories_used: planData.quota.categories_used || 0,
          categories_limit: planData.quota.categories_limit,
          over_quota: planData.quota.over_quota || false
        },
        workspaceQuota: workspaceQuota
      });
    } catch (err) {
      console.error('Failed to fetch quota data:', err);
      setError('Failed to load quota information');
    } finally {
      setLoading(false);
    }
  };

  const refreshQuota = () => {
    fetchQuotaData();
  };

  // Check if user can upload a file of given size
  const canUploadFile = (fileSize) => {
    // If quota data is still loading, allow upload to proceed
    // Backend will perform the final quota check anyway
    if (!quotaData || loading) {
      console.log('[Quota Check] Data loading, allowing upload (backend will verify)');
      return { allowed: true };
    }
    
    const { quota, plan } = quotaData;
    
    // Debug logging
    console.log('[Quota Check]', {
      fileSize: formatBytes(fileSize),
      storageUsed: formatBytes(quota.storage_used),
      storageAllowed: formatBytes(quota.storage_allowed),
      availableStorage: formatBytes(quota.storage_allowed - quota.storage_used),
      maxFileSize: formatBytes(plan.max_file_size_bytes),
      overQuota: quota.over_quota
    });
    
    // Check file size limit
    if (fileSize > plan.max_file_size_bytes) {
      return { allowed: false, reason: 'file_size', message: `File size (${formatBytes(fileSize)}) exceeds maximum allowed (${formatBytes(plan.max_file_size_bytes)}) for your plan.` };
    }
    
    // Check storage quota
    // Only block if storage would be exceeded (not if already at limit, since user might have space)
    const storageUsed = quota.storage_used || 0;
    const storageAllowed = quota.storage_allowed || 0;
    const availableStorage = storageAllowed - storageUsed;
    
    // If storage_allowed is 0 or null, allow upload (unlimited plan or data issue)
    if (storageAllowed === 0 || storageAllowed === null) {
      console.log('[Quota Check] Unlimited storage or data issue, allowing upload');
      return { allowed: true };
    }
    
    if (availableStorage < fileSize) {
      console.warn('[Quota Check] Blocked:', {
        availableStorage: formatBytes(availableStorage),
        fileSize: formatBytes(fileSize),
        storageUsed: formatBytes(quota.storage_used),
        storageAllowed: formatBytes(quota.storage_allowed)
      });
      return { 
        allowed: false, 
        reason: 'storage', 
        message: `Storage quota would be exceeded. Available: ${formatBytes(Math.max(0, availableStorage))}, Required: ${formatBytes(fileSize)}. Please delete some files or upgrade your plan.` 
      };
    }
    
    console.log('[Quota Check] Allowed');
    return { allowed: true };
  };

  // Check if user can create workspace
  const canCreateWorkspace = () => {
    if (!quotaData) return { allowed: false, reason: 'loading' };
    
    const { quota } = quotaData;
    
    if (quota.workspaces_limit !== null && quota.workspaces_used >= quota.workspaces_limit) {
      return { allowed: false, reason: 'workspaces', message: `Workspace limit reached (${quota.workspaces_used}/${quota.workspaces_limit}). Please upgrade your plan.` };
    }
    
    return { allowed: true };
  };

  // Check if user can create walkthrough
  const canCreateWalkthrough = () => {
    if (!quotaData) return { allowed: false, reason: 'loading' };
    
    const { quota } = quotaData;
    
    if (quota.walkthroughs_limit !== null && quota.walkthroughs_used >= quota.walkthroughs_limit) {
      return { allowed: false, reason: 'walkthroughs', message: `Walkthrough limit reached (${quota.walkthroughs_used}/${quota.walkthroughs_limit}). Please upgrade your plan.` };
    }
    
    return { allowed: true };
  };

  // Check if user can create category
  const canCreateCategory = () => {
    if (!quotaData) return { allowed: false, reason: 'loading' };
    
    const { quota } = quotaData;
    
    if (quota.categories_limit !== null && quota.categories_used >= quota.categories_limit) {
      return { allowed: false, reason: 'categories', message: `Category limit reached (${quota.categories_used}/${quota.categories_limit}). Please upgrade your plan.` };
    }
    
    return { allowed: true };
  };

  const isOverQuota = () => {
    if (!quotaData) return false;
    return quotaData.quota.over_quota || false;
  };

  return {
    quotaData,
    loading,
    error,
    refreshQuota,
    canUploadFile,
    canCreateWorkspace,
    canCreateWalkthrough,
    canCreateCategory,
    isOverQuota,
    isLoading: loading // Alias for clarity
  };
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  if (bytes === null || bytes === undefined) return 'Unlimited';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
