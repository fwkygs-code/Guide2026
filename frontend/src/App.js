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
import { useTranslationEnforcement } from './hooks/useTranslationEnforcement';
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

// Knowledge Systems (isolated modules)
import KnowledgeSystemsPage from './knowledge-systems/workspace-settings/KnowledgeSystemsPage';
import KnowledgeSystemPortalPage from './knowledge-systems/portal/KnowledgeSystemPortalPage';
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
import { PolicyPortalRoot } from './policy-system/PortalRoot';
import { ProcedurePortalRoot } from './procedure-system/PortalRoot';
import { DocumentationPortalRoot } from './documentation-system/PortalRoot';
import { FAQPortalRoot } from './faq-system/PortalRoot';
import { DecisionTreePortalRoot } from './decision-tree-system/PortalRoot';

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
  
  // Enable translation enforcement in development
  useTranslationEnforcement();

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
          <Route path="/workspace/:workspaceSlug/walkthroughs" element={<PrivateRoute><WorkspaceRouteGuard><WalkthroughsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/archive" element={<PrivateRoute><WorkspaceRouteGuard><ArchivePage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/new" element={<PrivateRoute><WorkspaceRouteGuard><BuilderV2Page /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/walkthroughs/:walkthroughId/edit" element={<PrivateRoute><WorkspaceRouteGuard><BuilderV2Page /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/categories" element={<PrivateRoute><WorkspaceRouteGuard><CategoriesPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/analytics" element={<PrivateRoute><WorkspaceRouteGuard><AnalyticsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/implementation" element={<PrivateRoute><WorkspaceRouteGuard><ImplementationPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/settings" element={<PrivateRoute><WorkspaceRouteGuard><SettingsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge-systems" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemsPage /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={POLICY_ROUTES.list} element={<PrivateRoute><WorkspaceRouteGuard><PolicyListRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={POLICY_ROUTES.create} element={<PrivateRoute><WorkspaceRouteGuard><PolicyEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={POLICY_ROUTES.edit} element={<PrivateRoute><WorkspaceRouteGuard><PolicyEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          
          {/* Knowledge System Portal Routes */}
          <Route path="/workspace/:workspaceSlug/knowledge/policy" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemPortalPage systemType="policy" /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/procedure" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemPortalPage systemType="procedure" /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/documentation" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemPortalPage systemType="documentation" /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/faq" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemPortalPage systemType="faq" /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path="/workspace/:workspaceSlug/knowledge/decision_tree" element={<PrivateRoute><WorkspaceRouteGuard><KnowledgeSystemPortalPage systemType="decision_tree" /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={PROCEDURE_ROUTES.create} element={<PrivateRoute><WorkspaceRouteGuard><ProcedureEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={PROCEDURE_ROUTES.edit} element={<PrivateRoute><WorkspaceRouteGuard><ProcedureEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={DOCUMENTATION_ROUTES.create} element={<PrivateRoute><WorkspaceRouteGuard><DocumentationEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={DOCUMENTATION_ROUTES.edit} element={<PrivateRoute><WorkspaceRouteGuard><DocumentationEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={FAQ_ROUTES.create} element={<PrivateRoute><WorkspaceRouteGuard><FAQEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={FAQ_ROUTES.edit} element={<PrivateRoute><WorkspaceRouteGuard><FAQEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={DECISION_TREE_ROUTES.create} element={<PrivateRoute><WorkspaceRouteGuard><DecisionTreeEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
          <Route path={DECISION_TREE_ROUTES.edit} element={<PrivateRoute><WorkspaceRouteGuard><DecisionTreeEditorRoute /></WorkspaceRouteGuard></PrivateRoute>} />
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