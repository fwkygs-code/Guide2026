import { useState, useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Hook to resolve workspace slug to workspace data and ID
 * Used when routes use workspaceSlug instead of workspaceId
 */
export const useWorkspaceSlug = (workspaceSlug) => {
  const [workspace, setWorkspace] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }

    const fetchWorkspace = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getWorkspace(workspaceSlug);
        const workspaceData = response.data;
        setWorkspace(workspaceData);
        setWorkspaceId(workspaceData.id);
      } catch (err) {
        console.error('Failed to fetch workspace:', err);
        // Provide more detailed error information
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load workspace';
        const errorStatus = err.response?.status;
        setError({
          message: errorMessage,
          status: errorStatus,
          originalError: err
        });
        setWorkspace(null);
        setWorkspaceId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceSlug]);

  return { workspace, workspaceId, loading, error };
};
