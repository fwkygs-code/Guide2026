import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, LogOut, Home, ArrowLeft, BookText, FolderOpen, BarChart3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';

const DashboardLayout = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const workspaceMatch = location.pathname.match(/^\/workspace\/([^/]+)/);
  const workspaceId = workspaceMatch?.[1] || null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 cursor-pointer min-w-0" onClick={() => navigate('/dashboard')} data-testid="dashboard-logo">
            <BookOpen className="w-7 h-7 text-primary" />
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
              Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
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
                Guides
              </Button>
              <Button
                variant={location.pathname.includes('/categories') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/categories`)}
                data-testid="nav-workspace-categories"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Categories
              </Button>
              <Button
                variant={location.pathname.includes('/analytics') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/analytics`)}
                data-testid="nav-workspace-analytics"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
              <Button
                variant={location.pathname.includes('/settings') ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceId}/settings`)}
                data-testid="nav-workspace-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
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