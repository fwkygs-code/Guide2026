import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, LogOut, Home, ArrowLeft, BookText, FolderOpen, BarChart3, Settings, Archive, ExternalLink, Database, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { api } from '../lib/api';
import LanguageSwitcher from './LanguageSwitcher';
import DarkModeToggle from './DarkModeToggle';
import NotificationsMenu from './NotificationsMenu';
import QuotaDisplay from './QuotaDisplay';
import { Surface, Button } from './ui/design-system';

const DashboardLayout = ({ children, backgroundUrl: propBackgroundUrl = null }) => {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const { workspace, workspaceId: contextWorkspaceId, backgroundUrl: contextBackgroundUrl, logoUrl } = useWorkspace();
  
  // Use prop background (for dashboard) or context background (for workspace pages)
  const backgroundUrl = propBackgroundUrl || contextBackgroundUrl;
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaceSlug, setWorkspaceSlug] = useState(null);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  
  // Check if user is a shared member (not owner)
  const isSharedUser = workspace && workspace.owner_id && workspace.owner_id !== user?.id;
  const isOwner = workspace && workspace.owner_id === user?.id;

  const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)/);
  const workspaceId = workspaceMatch?.[1] || contextWorkspaceId;

  // Fetch workspace slug when workspaceId is available (fallback if context doesn't have it)
  useEffect(() => {
    if (workspaceId && !workspaceSlug) {
      if (workspace?.slug) {
        setWorkspaceSlug(workspace.slug);
      } else {
        api.getWorkspace(workspaceId)
          .then(response => {
            setWorkspaceSlug(response.data.slug);
          })
          .catch(error => {
            console.error('Failed to fetch workspace:', error);
            setWorkspaceSlug(null);
          });
      }
    } else if (!workspaceId) {
      setWorkspaceSlug(null);
    }
  }, [workspaceId, workspace, workspaceSlug]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backgroundStyle = backgroundUrl 
    ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={backgroundStyle}>
      {/* Overlay for background image readability */}
      {backgroundUrl && (
        <div className="fixed inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 -z-10" />
      )}
      {/* Top Navigation */}
      <nav className="sticky top-0 z-[9998]">
        <Surface variant="glass" className="border-b border-slate-200/50">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="shrink-0"
              data-testid="nav-back-button"
              title={t('common.back')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 cursor-pointer min-w-0" onClick={async () => {
              // Release workspace lock when navigating to dashboard
              if (workspaceId && user?.id) {
                try {
                  await api.unlockWorkspace(workspaceId);
                } catch (error) {
                  // Ignore errors - lock may already be released or expired
                }
              }
              navigate('/dashboard');
            }} data-testid="dashboard-logo">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={workspace?.name || 'Workspace'} 
                className="w-7 h-7 rounded-lg object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <img 
                src="/logo-main.png" 
                alt="InterGuide" 
                className="h-14 w-auto object-contain"
              />
            )}
          </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              data-testid="nav-home-button"
            >
              <Home className="w-4 h-4 mr-2" />
              {t('common.dashboard')}
            </Button>
            {workspaceSlug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/portal/${workspaceSlug}`, '_blank')}
                data-testid="nav-portal-button"
                title="Open Portal in new tab"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Portal
              </Button>
            )}
            {isSharedUser && workspaceId && (
              <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="View workspace limits"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Limits
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Workspace Limits</DialogTitle>
                  </DialogHeader>
                  <QuotaDisplay workspaceId={workspaceId} showWarnings={true} />
                </DialogContent>
              </Dialog>
            )}
            {user && user.role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                title="Admin Dashboard"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <LanguageSwitcher />
            <NotificationsMenu />
            <DarkModeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('common.logout')}
            </Button>
          </div>
        </div>

        {/* Workspace Navigation */}
        {workspaceId && (
          <div className="px-6 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={location.pathname.includes('/walkthroughs') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs`)}
                data-testid="nav-workspace-walkthroughs"
              >
                <BookText className="w-4 h-4 mr-2" />
                {t('workspace.guides')}
              </Button>
              <Button
                variant={location.pathname.includes('/archive') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/archive`)}
                data-testid="nav-workspace-archive"
              >
                <Archive className="w-4 h-4 mr-2" />
                {t('workspace.archive')}
              </Button>
              <Button
                variant={location.pathname.includes('/categories') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/categories`)}
                data-testid="nav-workspace-categories"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {t('workspace.categories')}
              </Button>
              <Button
                variant={location.pathname.includes('/analytics') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/analytics`)}
                data-testid="nav-workspace-analytics"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('workspace.analytics')}
              </Button>
              {isOwner && (
                <Button
                  variant={location.pathname.includes('/knowledge-systems') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => navigate(`/workspace/${workspaceSlug || workspaceId}/knowledge-systems`)}
                  data-testid="nav-workspace-knowledge-systems"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Knowledge Systems
                </Button>
              )}
              {isOwner && (
                <Button
                  variant={location.pathname.includes('/settings') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => navigate(`/workspace/${workspaceSlug || workspaceId}/settings`)}
                  data-testid="nav-workspace-settings"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {t('workspace.settings')}
                </Button>
              )}
            </div>
          </div>
        )}
        </Surface>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;