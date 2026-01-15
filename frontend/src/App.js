import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import WalkthroughsPage from './pages/WalkthroughsPage';
import CanvasBuilderPage from './pages/CanvasBuilderPage';
import CategoriesPage from './pages/CategoriesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import PortalPage from './pages/PortalPage';
import WalkthroughViewerPage from './pages/WalkthroughViewerPage';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/portal/:slug" element={<PortalPage />} />
          <Route path="/portal/:slug/:walkthroughId" element={<WalkthroughViewerPage />} />
          
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs" element={<PrivateRoute><WalkthroughsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs/new" element={<PrivateRoute><CanvasBuilderPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs/:walkthroughId/edit" element={<PrivateRoute><CanvasBuilderPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;