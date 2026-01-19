import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, LogOut, Home, ArrowLeft, BookText, FolderOpen, BarChart3, Settings, Archive, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { api } from '../lib/api';
import LanguageSwitcher from './LanguageSwitcher';
import InterGuideLogo from './InterGuideLogo';

const DashboardLayout = ({ children, backgroundUrl: propBackgroundUrl = null }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { workspace, workspaceId: contextWorkspaceId, backgroundUrl: contextBackgroundUrl, logoUrl } = useWorkspace();
  
  // Use prop background (for dashboard) or context background (for workspace pages)
  const backgroundUrl = propBackgroundUrl || contextBackgroundUrl;
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaceSlug, setWorkspaceSlug] = useState(null);

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
    <div className="min-h-screen bg-white" style={backgroundStyle}>
      {/* Overlay for background image readability */}
      {backgroundUrl && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm -z-10" />
      )}
      {/* Top Navigation */}
      <nav className="glass border-b border-slate-200/50 sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
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

            <div className="flex items-center gap-2 cursor-pointer min-w-0" onClick={() => navigate('/dashboard')} data-testid="dashboard-logo">
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
              <InterGuideLogo className="w-7 h-7" />
            )}
            <span className="text-xl font-heading font-bold truncate">InterGuide</span>
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
            <LanguageSwitcher />
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
              <Button
                variant={location.pathname.includes('/settings') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/settings`)}
                data-testid="nav-workspace-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                {t('workspace.settings')}
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};

export default DashboardLayout;