import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export const useQuota = (workspaceId = null) => {
  const { user } = useAuth();
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchQuotaData();
  }, [user?.id, fetchQuotaData]);

  const fetchQuotaData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const planResponse = await api.getUserPlan();
      const planData = planResponse.data;
      
      // HARD INVARIANT: Canonical fields must exist
      if (planData.access_granted === undefined) {
        console.error('[QUOTA] INVALID PLAN PAYLOAD - access_granted missing', planData);
        throw new Error('Invalid plan data: access_granted field missing');
      }
      if (planData.quota_used === undefined) {
        console.error('[QUOTA] INVALID PLAN PAYLOAD - quota_used missing', planData);
        throw new Error('Invalid plan data: quota_used field missing');
      }
      if (planData.quota_limit === undefined) {
        console.error('[QUOTA] INVALID PLAN PAYLOAD - quota_limit missing', planData);
        throw new Error('Invalid plan data: quota_limit field missing');
      }
      
      let workspaceQuota = null;
      if (workspaceId) {
        try {
          const workspaceResponse = await api.getWorkspaceQuota(workspaceId);
          workspaceQuota = workspaceResponse.data;
          
          // Validate workspace quota structure
          if (workspaceQuota.walkthroughs_used === undefined) {
            console.error('[QUOTA] INVALID WORKSPACE QUOTA - walkthroughs_used missing', workspaceQuota);
            throw new Error('Invalid workspace quota: walkthroughs_used field missing');
          }
          if (workspaceQuota.walkthroughs_limit === undefined) {
            console.error('[QUOTA] INVALID WORKSPACE QUOTA - walkthroughs_limit missing', workspaceQuota);
            throw new Error('Invalid workspace quota: walkthroughs_limit field missing');
          }
        } catch (error) {
          console.warn('[QUOTA] Failed to fetch workspace quota:', error);
          // Don't throw here - continue with user quota only
        }
      }
      
      setQuotaData({
        user: {
          access_granted: planData.access_granted,
          quota_used: planData.quota_used,
          quota_limit: planData.quota_limit,
          plan: planData.plan || 'free',
          categories_limit: planData.quota.categories_limit,
          over_quota: planData.quota.over_quota || false
        },
        workspace: workspaceQuota
      });
    } catch (error) {
      console.error('[QUOTA] Failed to fetch quota data:', error);
      setError(error.message || 'Failed to fetch quota data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

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
    
    const { quota } = quotaData;
    
    // Debug logging
    console.log('[Quota Check]', {
      fileSize: formatBytes(fileSize),
      storageUsed: formatBytes(quota.storage_used),
      storageAllowed: formatBytes(quota.storage_allowed),
      availableStorage: formatBytes(quota.storage_allowed - quota.storage_used),
      maxFileSize: formatBytes(quota.max_file_size),
      overQuota: quota.over_quota
    });
    
    // Check file size limit
    if (quota.max_file_size && fileSize > quota.max_file_size) {
      return { allowed: false, reason: 'file_size', message: `File size (${formatBytes(fileSize)}) exceeds maximum allowed (${formatBytes(quota.max_file_size)}) for your plan.` };
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
