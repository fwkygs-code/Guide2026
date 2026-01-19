import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Hook to manage workspace lock acquisition, refresh, and monitoring.
 * Provides lock status and automatically handles lock refresh and takeover detection.
 */
export const useWorkspaceLock = (workspaceId, redirectPath = '/dashboard') => {
  const [lockStatus, setLockStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let refreshInterval = null;
    let statusInterval = null;

    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          // If locked by another user, redirect
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
          navigate(redirectPath, { replace: true });
          return;
        }
        
        // Lock acquired successfully
        if (isMounted) {
          setLockStatus({ locked: false, is_current_user: true });
        }
      } catch (error) {
        console.error('Failed to acquire workspace lock:', error);
      }
    };

    const refreshLock = async () => {
      if (!workspaceId) return;
      try {
        // Refresh/extend lock by calling lockWorkspace (idempotent for same user)
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          // Lock was taken by another user!
          toast.error(`Another user has taken control of this workspace. You are being redirected.`, {
            duration: 5000,
            important: true
          });
          navigate(redirectPath, { replace: true });
          return;
        }
      } catch (error) {
        console.error('Failed to refresh lock:', error);
      }
    };

    const checkLockStatus = async () => {
      if (!workspaceId) return;
      try {
        const status = await api.getWorkspaceLockStatus(workspaceId);
        if (isMounted) {
          setLockStatus(status);
          
          // If lock is held by another user, redirect immediately
          if (status.locked && !status.is_current_user) {
            toast.error(`Another user (${status.locked_by_name}) has taken control of this workspace. You are being redirected.`, {
              duration: 5000,
              important: true
            });
            navigate(redirectPath, { replace: true });
          }
        }
      } catch (error) {
        console.error('Failed to check lock status:', error);
      }
    };

    if (workspaceId) {
      acquireLock();
      
      // Refresh lock every 30 seconds to extend TTL
      refreshInterval = setInterval(refreshLock, 30000);
      
      // Check lock status every 5 seconds to detect if another user took over
      statusInterval = setInterval(checkLockStatus, 5000);
      
      return () => {
        isMounted = false;
        if (refreshInterval) clearInterval(refreshInterval);
        if (statusInterval) clearInterval(statusInterval);
        
        // Release lock on unmount (ignore errors - idempotent)
        if (workspaceId) {
          api.unlockWorkspace(workspaceId).catch(() => {
            // Ignore unlock errors - lock may already be released, expired, or user was forced out
          });
        }
      };
    }
  }, [workspaceId, navigate, redirectPath]);

  return lockStatus;
};
