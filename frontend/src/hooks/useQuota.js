import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export const useQuota = (workspaceId = null) => {
  const { user } = useAuth();
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dev-only: Track fetch counts to detect double-fetches
  const fetchCountRef = useRef(0);
  const loggedMissingQuotaRef = useRef(false);

  const fetchQuotaData = useCallback(async () => {
    // Dev-only: Log fetch count
    if (process.env.NODE_ENV === 'development') {
      fetchCountRef.current += 1;
      console.count('[fetchQuota]');
      console.log(`[useQuota] Fetch #${fetchCountRef.current} for workspace:`, workspaceId);
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const planResponse = await api.getUserPlan();
      const planData = planResponse.data || {};
      const accessGranted = planData.access_granted ?? false;
      
      if (process.env.NODE_ENV === 'development' && planData.access_granted === undefined) {
        console.warn('[useQuota] access_granted missing from plan payload, defaulting to false');
      }

      if (process.env.NODE_ENV === 'development' && !planData.quota && !loggedMissingQuotaRef.current) {
        console.warn('[useQuota] quota payload missing; falling back to null-safe defaults');
        loggedMissingQuotaRef.current = true;
      }
      
      let workspaceQuota = null;
      if (workspaceId) {
        const workspaceResponse = await api.getWorkspaceQuota(workspaceId);
        workspaceQuota = workspaceResponse.data;
      }
      
      const normalizeQuota = (quota = {}) => ({
        storage_used: quota.storage_used ?? null,
        storage_allowed: quota.storage_allowed ?? null,
        max_file_size: quota.max_file_size ?? null,
        workspaces_used: quota.workspaces_used ?? null,
        workspaces_limit: quota.workspaces_limit ?? null,
        walkthroughs_used: quota.walkthroughs_used ?? null,
        walkthroughs_limit: quota.walkthroughs_limit ?? null,
        categories_used: quota.categories_used ?? null,
        categories_limit: quota.categories_limit ?? null,
        over_quota: quota.over_quota ?? false
      });

      const normalizeWorkspaceQuota = (quota = null) => {
        if (!quota) return null;
        return {
          walkthroughs_used: quota.walkthroughs_used ?? null,
          walkthroughs_limit: quota.walkthroughs_limit ?? null,
          categories_used: quota.categories_used ?? null,
          categories_limit: quota.categories_limit ?? null
        };
      };

      setQuotaData({
        plan: planData.plan ?? 'free',
        planName: planData.plan ?? 'free',
        access_granted: accessGranted,
        access_until: planData.access_until ?? null,
        is_recurring: planData.is_recurring ?? false,
        management_url: planData.management_url ?? null,
        provider: planData.provider ?? planData.billing_provider ?? null,
        quota: normalizeQuota(planData.quota || {}),
        workspaceQuota: normalizeWorkspaceQuota(workspaceQuota),
        raw: planData,
        workspaceRaw: workspaceQuota
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch quota data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchQuotaData();
  }, [user?.id, fetchQuotaData]);

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

  // Runtime assertion: ensure explicit states
  const state = loading ? 'loading' : error ? 'error' : quotaData ? 'ready' : 'uninitialized';
  if (process.env.NODE_ENV === 'development' && state === 'uninitialized' && user?.id) {
    console.warn('[useQuota] Uninitialized state with authenticated user - possible TDZ or fetch failure');
  }

  return {
    quotaData,
    loading,
    error,
    state,
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
