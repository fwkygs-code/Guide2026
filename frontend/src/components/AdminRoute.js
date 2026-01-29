import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WorkspaceLoader from './WorkspaceLoader';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Check if user is admin (role field from backend)
  if (!user.role || user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
};

export default AdminRoute;
