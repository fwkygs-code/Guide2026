import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
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

// Knowledge Systems (isolated modules)
import KnowledgeSystemsPage from './knowledge-systems/workspace-settings/KnowledgeSystemsPage';
import { useWorkspaceSlug } from './hooks/useWorkspaceSlug';
import { POLICY_ROUTES } from './policy-system/routes';
import { PROCEDURE_ROUTES } from './procedure-system/routes';
import { DOCUMENTATION_ROUTES } from './documentation-system/routes';
import { FAQ_ROUTES } from './faq-system/routes';
import { DECISION_TREE_ROUTES } from './decision-tree-system/routes';
import { PolicyEditorRoot } from './policy-system/EditorRoot';
import { ProcedureEditorRoot } from './procedure-system/EditorRoot';
import { DocumentationEditorRoot } from './documentation-system/EditorRoot';
import { FAQEditorRoot } from './faq-system/EditorRoot';
import { DecisionTreeEditorRoot } from './decision-tree-system/EditorRoot';
import { PolicyPortalRoot } from './policy-system/PortalRoot';
import { ProcedurePortalRoot } from './procedure-system/PortalRoot';
import { DocumentationPortalRoot } from './documentation-system/PortalRoot';
import { FAQPortalRoot } from './faq-system/PortalRoot';
import { DecisionTreePortalRoot } from './decision-tree-system/PortalRoot';

// Mandatory surface component - guarantees no white backgrounds
import { AppSurface } from './components/ui/design-system/AppSurface';
import OnboardingController from './onboarding/OnboardingController';

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

const WorkspaceLoader = ({ accent = 'cyan' }) => {
  const accentClass = accent === 'amber'
    ? 'border-amber-400'
    : accent === 'purple'
      ? 'border-purple-400'
      : accent === 'emerald'
        ? 'border-emerald-400'
        : accent === 'indigo'
          ? 'border-indigo-400'
          : 'border-cyan-400';
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className={`h-10 w-10 rounded-full border-2 ${accentClass} border-t-transparent animate-spin`} />
    </div>
  );
};

const PolicyEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <WorkspaceLoader accent="amber" />;
  return (
    <PolicyEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const ProcedureEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <WorkspaceLoader accent="cyan" />;
  return (
    <ProcedureEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const DocumentationEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <WorkspaceLoader accent="purple" />;
  return (
    <DocumentationEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const FAQEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <WorkspaceLoader accent="emerald" />;
  return (
    <FAQEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const DecisionTreeEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <WorkspaceLoader accent="indigo" />;
  return (
    <DecisionTreeEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const PolicyPortalRoute = () => {
  const { slug } = useParams();
  return <PolicyPortalRoot portalSlug={slug} />;
};

const ProcedurePortalRoute = () => {
  const { slug } = useParams();
  return <ProcedurePortalRoot portalSlug={slug} />;
};

const DocumentationPortalRoute = () => {
  const { slug } = useParams();
  return <DocumentationPortalRoot portalSlug={slug} />;
};

const FAQPortalRoute = () => {
  const { slug } = useParams();
  return <FAQPortalRoot portalSlug={slug} />;
};

const DecisionTreePortalRoute = () => {
  const { slug } = useParams();
  return <DecisionTreePortalRoot portalSlug={slug} />;
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
          <AppSurface>
          <OnboardingController />
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
          <Route path={POLICY_ROUTES.portal} element={<PolicyPortalRoute />} />
          <Route path={PROCEDURE_ROUTES.portal} element={<ProcedurePortalRoute />} />
          <Route path={DOCUMENTATION_ROUTES.portal} element={<DocumentationPortalRoute />} />
          <Route path={FAQ_ROUTES.portal} element={<FAQPortalRoute />} />
          <Route path={DECISION_TREE_ROUTES.portal} element={<DecisionTreePortalRoute />} />
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
          <Route path={POLICY_ROUTES.create} element={<PrivateRoute><PolicyEditorRoute /></PrivateRoute>} />
          <Route path={POLICY_ROUTES.edit} element={<PrivateRoute><PolicyEditorRoute /></PrivateRoute>} />
          <Route path={PROCEDURE_ROUTES.create} element={<PrivateRoute><ProcedureEditorRoute /></PrivateRoute>} />
          <Route path={PROCEDURE_ROUTES.edit} element={<PrivateRoute><ProcedureEditorRoute /></PrivateRoute>} />
          <Route path={DOCUMENTATION_ROUTES.create} element={<PrivateRoute><DocumentationEditorRoute /></PrivateRoute>} />
          <Route path={DOCUMENTATION_ROUTES.edit} element={<PrivateRoute><DocumentationEditorRoute /></PrivateRoute>} />
          <Route path={FAQ_ROUTES.create} element={<PrivateRoute><FAQEditorRoute /></PrivateRoute>} />
          <Route path={FAQ_ROUTES.edit} element={<PrivateRoute><FAQEditorRoute /></PrivateRoute>} />
          <Route path={DECISION_TREE_ROUTES.create} element={<PrivateRoute><DecisionTreeEditorRoute /></PrivateRoute>} />
          <Route path={DECISION_TREE_ROUTES.edit} element={<PrivateRoute><DecisionTreeEditorRoute /></PrivateRoute>} />
          </Routes>
          </AppSurface>
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