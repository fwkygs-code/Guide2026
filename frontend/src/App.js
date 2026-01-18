import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TextSizeProvider } from './contexts/TextSizeContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { Toaster } from '@/components/ui/sonner';
import './i18n/config'; // Initialize i18n
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import WalkthroughsPage from './pages/WalkthroughsPage';
import CanvasBuilderPage from './pages/CanvasBuilderPage';
import BuilderV2Page from './pages/BuilderV2Page';
import CategoriesPage from './pages/CategoriesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import PortalPage from './pages/PortalPage';
import WalkthroughViewerPage from './pages/WalkthroughViewerPage';
import ArchivePage from './pages/ArchivePage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import BillingPolicyPage from './pages/BillingPolicyPage';

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

// Component to handle direction changes
const AppContent = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Ensure direction is set on mount and language changes
    const dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);

  return (
    <TextSizeProvider>
      <AuthProvider>
        <BrowserRouter>
        <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/billing-policy" element={<BillingPolicyPage />} />
          <Route path="/portal/:slug" element={<PortalPage />} />
          <Route path="/portal/:slug/:walkthroughId" element={<WalkthroughViewerPage />} />
          <Route path="/embed/portal/:slug" element={<PortalPage isEmbedded={true} />} />
          <Route path="/embed/portal/:slug/:walkthroughId" element={<WalkthroughViewerPage isEmbedded={true} />} />
          
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs" element={<PrivateRoute><WalkthroughsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/archive" element={<PrivateRoute><ArchivePage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs/new" element={<PrivateRoute><CanvasBuilderPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/walkthroughs/:walkthroughId/edit" element={<PrivateRoute><CanvasBuilderPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/builder-v2/new" element={<PrivateRoute><BuilderV2Page /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/builder-v2/:walkthroughId" element={<PrivateRoute><BuilderV2Page /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceId/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        </Routes>
        </WorkspaceProvider>
        </BrowserRouter>
        <Toaster position={i18n.language === 'he' ? 'top-left' : 'top-right'} />
      </AuthProvider>
    </TextSizeProvider>
  );
};

function App() {
  return <AppContent />;
}

export default App;