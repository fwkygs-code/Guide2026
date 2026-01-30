import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { normalizeImageUrl } from '../lib/utils';

const WorkspaceContext = createContext();

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    // Return null values if not in workspace context (e.g., on dashboard page)
    return {
      workspace: null,
      workspaceId: null,
      backgroundUrl: null,
      logoUrl: null,
      loading: false,
      error: null,
    };
  }
  return context;
};

export const WorkspaceProvider = ({ children }) => {
  const location = useLocation();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extract workspaceId from URL path
  useEffect(() => {
    const match = location.pathname.match(/^\/workspace\/([^/]+)/);
    const newWorkspaceId = match?.[1] || null;
    
    if (newWorkspaceId !== workspaceId) {
      setWorkspaceId(newWorkspaceId);
      setWorkspace(null); // Clear previous workspace
    }
  }, [location.pathname, workspaceId]);

  // Fetch workspace data when workspaceId changes
  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchWorkspace = async () => {
      try {
        const response = await api.getWorkspace(workspaceId);
        if (isMounted) {
          setWorkspace(response.data);
          setError(null);
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error);
        if (isMounted) {
          setWorkspace(null);
          setError({
            status: error.response?.status,
            message: error.response?.data?.detail || error.message
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWorkspace();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  // Normalize background and logo URLs
  const backgroundUrl = workspace?.portal_background_url 
    ? normalizeImageUrl(workspace.portal_background_url)
    : null;
  
  const logoUrl = workspace?.logo 
    ? normalizeImageUrl(workspace.logo)
    : null;

  const value = useMemo(() => ({
    workspace,
    workspaceId,
    backgroundUrl,
    logoUrl,
    loading,
    error,
  }), [workspace, workspaceId, backgroundUrl, logoUrl, loading, error]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
