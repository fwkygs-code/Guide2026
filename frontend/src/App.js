import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TextSizeProvider } from './contexts/TextSizeContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import './i18n/config'; // Initialize i18n
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import WalkthroughsPage from './pages/WalkthroughsPage';
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
import VerifyEmailPage from './pages/VerifyEmailPage';
import EmailVerificationRequiredPage from './pages/EmailVerificationRequiredPage';
import AccountBlockedPage from './pages/AccountBlockedPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminRoute from './components/AdminRoute';

// Knowledge Systems (isolated module)
import KnowledgeSystemsPage from './knowledge-systems/workspace-settings/KnowledgeSystemsPage';
import KnowledgeSystemConfigPage from './knowledge-systems/workspace-settings/KnowledgeSystemConfigPage';
import KnowledgeSystemContentPage from './knowledge-systems/workspace-settings/KnowledgeSystemContentPage';
import KnowledgeSystemPlaceholderPage from './knowledge-systems/workspace-settings/KnowledgeSystemPlaceholderPage';
import PolicyPortalPage from './knowledge-systems/portal/PolicyPortalPage';
import ProcedurePortalPage from './knowledge-systems/portal/ProcedurePortalPage';
import DocumentationPortalPage from './knowledge-systems/portal/DocumentationPortalPage';
import FAQPortalPage from './knowledge-systems/portal/FAQPortalPage';
import DecisionTreePortalPage from './knowledge-systems/portal/DecisionTreePortalPage';

const PrivateRoute = ({ children }) => {
  const { user, loading, isBlocked } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Show blocked page if account is disabled/deleted
  if (isBlocked) {
    return <AccountBlockedPage />;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Block unverified users from accessing dashboard
  // Users with active PayPal subscriptions are grandfathered (backend handles this)
  // Frontend blocks all unverified users - backend will allow PayPal subscribers
  if (!user.email_verified) {
    return <EmailVerificationRequiredPage />;
  }
  
  return children;
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
    <ThemeProvider>
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/portal/:slug" element={<PortalPage />} />
          <Route path="/portal/:slug/:walkthroughId" element={<WalkthroughViewerPage />} />
          <Route path="/portal/:slug/knowledge/policies" element={<PolicyPortalPage />} />
          <Route path="/portal/:slug/knowledge/procedures" element={<ProcedurePortalPage />} />
          <Route path="/portal/:slug/knowledge/documentation" element={<DocumentationPortalPage />} />
          <Route path="/portal/:slug/knowledge/faqs" element={<FAQPortalPage />} />
          <Route path="/portal/:slug/knowledge/decisions" element={<DecisionTreePortalPage />} />
          <Route path="/embed/portal/:slug" element={<PortalPage isEmbedded={true} />} />
          <Route path="/embed/portal/:slug/:walkthroughId" element={<WalkthroughViewerPage isEmbedded={true} />} />
          
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminDashboardPage /></AdminRoute></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs" element={<PrivateRoute><WalkthroughsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/archive" element={<PrivateRoute><ArchivePage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/new" element={<PrivateRoute><BuilderV2Page /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/:walkthroughId/edit" element={<PrivateRoute><BuilderV2Page /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge-systems" element={<PrivateRoute><KnowledgeSystemsPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/:systemType/configure" element={<PrivateRoute><KnowledgeSystemConfigPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/:systemType" element={<PrivateRoute><KnowledgeSystemContentPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/:systemType/new" element={<PrivateRoute><KnowledgeSystemPlaceholderPage /></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/:systemType/:itemId/edit" element={<PrivateRoute><KnowledgeSystemPlaceholderPage /></PrivateRoute>} />
        </Routes>
          </WorkspaceProvider>
          </BrowserRouter>
          <Toaster position={i18n.language === 'he' ? 'top-left' : 'top-right'} />
        </AuthProvider>
      </TextSizeProvider>
    </ThemeProvider>
  );
};

function App() {
  return <AppContent />;
}

export default App;