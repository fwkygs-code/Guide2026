import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TextSizeProvider } from './contexts/TextSizeContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import WorkspaceLoader from './components/WorkspaceLoader';
import { toast } from 'sonner';
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
import ImplementationPage from './pages/ImplementationPage';
import PortalPage from './pages/PortalPage';
import WalkthroughViewerPage from './pages/WalkthroughViewerPage';
import ArchivePage from './pages/ArchivePage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import BillingPolicyPage from './pages/BillingPolicyPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EmailVerificationRequiredPage from './pages/EmailVerificationRequiredPage';
import AccountBlockedPage from './pages/AccountBlockedPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminRoute from './components/AdminRoute';
import PortalLayout from './components/PortalLayout';

// Knowledge Systems (isolated modules)
import KnowledgeSystemsPage from './knowledge-systems/workspace-settings/KnowledgeSystemsPage';
import KnowledgeSystemPortalPage from './knowledge-systems/portal/KnowledgeSystemPortalPage';
import WorkspaceKnowledgeLayout from './knowledge-systems/WorkspaceKnowledgeLayout';
import PolicyPortalPage from './knowledge-systems/portal/PolicyPortalPage';
import ProcedurePortalPage from './knowledge-systems/portal/ProcedurePortalPage';
import DocumentationPortalPage from './knowledge-systems/portal/DocumentationPortalPage';
import FAQPortalPage from './knowledge-systems/portal/FAQPortalPage';
import DecisionTreePortalPage from './knowledge-systems/portal/DecisionTreePortalPage';
import { useWorkspaceSlug } from './hooks/useWorkspaceSlug';
import { POLICY_ROUTES } from './policy-system/routes';
import { PROCEDURE_ROUTES } from './procedure-system/routes';
import { DOCUMENTATION_ROUTES } from './documentation-system/routes';
import { FAQ_ROUTES } from './faq-system/routes';
import { DECISION_TREE_ROUTES } from './decision-tree-system/routes';
import { PolicyEditorRoot } from './policy-system/EditorRoot';
import { PolicyListPage } from './pages/PolicyListPage';
import { ProcedureEditorRoot } from './procedure-system/EditorRoot';
import { DocumentationEditorRoot } from './documentation-system/EditorRoot';
import { FAQEditorRoot } from './faq-system/EditorRoot';
import { DecisionTreeEditorRoot } from './decision-tree-system/EditorRoot';

// Mandatory surface component - guarantees no white backgrounds
import { AppSurface } from './components/ui/design-system/AppSurface';
import OnboardingController from './onboarding/OnboardingController';
import { INTERGUIDE_ANIMATION_URL, INTERGUIDE_ANIMATIONX_URL } from './utils/logo';

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <WorkspaceLoader size={160} />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading, isBlocked } = useAuth();
  
  if (loading) {
    return <FullscreenLoader />;
  }
  
  // Show blocked page if account is disabled/deleted
  if (isBlocked) {
    return <AccountBlockedPage />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Block unverified users from accessing dashboard
  // Users with active PayPal subscriptions are grandfathered (backend handles this)
  // Frontend blocks all unverified users - backend will allow PayPal subscribers
  if (!user.email_verified) {
    return <EmailVerificationRequiredPage />;
  }
  
  return children;
};

const WorkspaceRouteGuard = ({ children }) => {
  const { t } = useTranslation();
  const { workspace, loading, error } = useWorkspace();

  if (loading) {
    return <FullscreenLoader />;
  }

  if (error?.status === 403) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('auth.noAccessTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('auth.noAccessBody')}</p>
        </div>
      </div>
    );
  }

  if (error?.status === 404 || (error && !workspace)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('auth.workspaceNotFoundTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('auth.workspaceNotFoundBody')}</p>
        </div>
      </div>
    );
  }

  return children;
};

const AuthSessionListener = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionExpired, clearSessionExpired } = useAuth();

  useEffect(() => {
    if (!sessionExpired) return;
    toast.error(t('auth.sessionExpiredTitle'), { description: t('auth.sessionExpiredBody') });
    clearSessionExpired();
    navigate('/login', { replace: true });
  }, [sessionExpired, clearSessionExpired, navigate, t]);

  return null;
};

const PolicyEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <FullscreenLoader />;
  return (
    <PolicyEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge/policy` : undefined}
    />
  );
};

const PolicyListRoute = () => {
  const { workspaceSlug } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <FullscreenLoader />;
  return (
    <PolicyListPage
      workspaceId={workspaceId || ''}
      workspaceSlug={workspaceSlug || ''}
    />
  );
};

const ProcedureEditorRoute = () => {
  const { workspaceSlug, itemId } = useParams();
  const { workspaceId, loading } = useWorkspaceSlug(workspaceSlug);
  if (loading) return <FullscreenLoader />;
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
  if (loading) return <FullscreenLoader />;
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
  if (loading) return <FullscreenLoader />;
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
  if (loading) return <FullscreenLoader />;
  return (
    <DecisionTreeEditorRoot
      workspaceId={workspaceId || undefined}
      itemId={itemId}
      closeHref={workspaceSlug ? `/workspace/${workspaceSlug}/knowledge-systems` : undefined}
    />
  );
};

const preloadVideo = (src) => {
  if (typeof document === 'undefined') return;
  const video = document.createElement('video');
  video.src = src;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.load();
};

const VideoPreloader = () => {
  useEffect(() => {
    preloadVideo(INTERGUIDE_ANIMATION_URL);
    preloadVideo(INTERGUIDE_ANIMATIONX_URL);
  }, []);
  return null;
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

  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (/[A-Z]/.test(pathname)) {
      const nextPath = pathname.toLowerCase();
      window.location.replace(`${nextPath}${search}${hash}`);
    }
  }, []);

  return (
    <ThemeProvider>
      <VideoPreloader />
      <TextSizeProvider>
        <AuthProvider>
          <BrowserRouter>
          <WorkspaceProvider>
          <AppSurface>
          <AuthSessionListener />
          <OnboardingController />
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/billing-policy" element={<BillingPolicyPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/portal/:slug" element={<PortalLayout />}>
            <Route index element={<PortalPage />} />
            <Route path="knowledge/policies" element={<PolicyPortalPage />} />
            <Route path="knowledge/procedures" element={<ProcedurePortalPage />} />
            <Route path="knowledge/documentation" element={<DocumentationPortalPage />} />
            <Route path="knowledge/faqs" element={<FAQPortalPage />} />
            <Route path="knowledge/decisions" element={<DecisionTreePortalPage />} />
            <Route path=":walkthroughId" element={<WalkthroughViewerPage />} />
          </Route>
          <Route path="/embed/portal/:slug" element={<PortalLayout isEmbedded={true} />}>
            <Route index element={<PortalPage />} />
            <Route path="knowledge/policies" element={<PolicyPortalPage />} />
            <Route path="knowledge/procedures" element={<ProcedurePortalPage />} />
            <Route path="knowledge/documentation" element={<DocumentationPortalPage />} />
            <Route path="knowledge/faqs" element={<FAQPortalPage />} />
            <Route path="knowledge/decisions" element={<DecisionTreePortalPage />} />
            <Route path=":walkthroughId" element={<WalkthroughViewerPage isEmbedded={true} />} />
          </Route>
          
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminDashboardPage /></AdminRoute></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs" element={<PrivateRoute><WorkspaceRouteGuard><WalkthroughsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/archive" element={<PrivateRoute><WorkspaceRouteGuard><ArchivePage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/new" element={<PrivateRoute><WorkspaceRouteGuard><BuilderV2Page /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/:walkthroughId/edit" element={<PrivateRoute><WorkspaceRouteGuard><BuilderV2Page /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/categories" element={<PrivateRoute><WorkspaceRouteGuard><CategoriesPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/analytics" element={<PrivateRoute><WorkspaceRouteGuard><AnalyticsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/implementation" element={<PrivateRoute><WorkspaceRouteGuard><ImplementationPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/settings" element={<PrivateRoute><WorkspaceRouteGuard><SettingsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge-systems" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge" element={<PrivateRoute><WorkspaceRouteGuard><WorkspaceKnowledgeLayout /></WorkspaceRouteGuard></PrivateRoute>}>
            <Route path="policy" element={<PolicyListRoute />} />
            <Route path="policy/new" element={<PolicyEditorRoute />} />
            <Route path="policy/:itemId" element={<PolicyEditorRoute />} />
            <Route path="procedure" element={<KnowledgeSystemPortalPage systemType="procedure" />} />
            <Route path="procedure/new" element={<ProcedureEditorRoute />} />
            <Route path="procedure/:itemId" element={<ProcedureEditorRoute />} />
            <Route path="documentation" element={<KnowledgeSystemPortalPage systemType="documentation" />} />
            <Route path="documentation/new" element={<DocumentationEditorRoute />} />
            <Route path="documentation/:itemId" element={<DocumentationEditorRoute />} />
            <Route path="faq" element={<KnowledgeSystemPortalPage systemType="faq" />} />
            <Route path="faq/new" element={<FAQEditorRoute />} />
            <Route path="faq/:itemId" element={<FAQEditorRoute />} />
            <Route path="decision_tree" element={<KnowledgeSystemPortalPage systemType="decision_tree" />} />
            <Route path="decision_tree/new" element={<DecisionTreeEditorRoute />} />
            <Route path="decision_tree/:itemId" element={<DecisionTreeEditorRoute />} />
          </Route>
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