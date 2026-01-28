import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, FolderOpen, BarChart3, Settings, Upload, X, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useQuota } from '../hooks/useQuota';
import { normalizeImageUrl } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import DashboardLayout from '../components/DashboardLayout';
import QuotaDisplay from '../components/QuotaDisplay';
import OverQuotaBanner from '../components/OverQuotaBanner';
import UpgradePrompt from '../components/UpgradePrompt';
import BillingInfo from '../components/BillingInfo';
import WorkspaceLockModal from '../components/WorkspaceLockModal';
import { AppShell, PageHeader, PageSurface, Surface, Card, Button, Badge, CardContent } from '../components/ui/design-system';

const DashboardPage = () => {
  const { t } = useTranslation();
  const { backgroundUrl: workspaceBackground } = useWorkspace(); // Won't be set on dashboard, but available for consistency
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#4f46e5');
  const [newWorkspaceLogo, setNewWorkspaceLogo] = useState('');
  const [newWorkspaceBackground, setNewWorkspaceBackground] = useState('');
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [pendingWorkspace, setPendingWorkspace] = useState(null);
  const [lockedBy, setLockedBy] = useState('');
  const { user } = useAuth();
  const { quotaData } = useQuota();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    fetchWorkspaces();
  }, [user?.id]);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.getWorkspaces();
      const workspacesData = response.data;
      setWorkspaces(workspacesData);
      
      // Release any locks for workspaces when user is on dashboard
      // This ensures locks are released even if user navigated directly to dashboard
      // (bypassing workspace page cleanup)
      if (workspacesData && workspacesData.length > 0 && user?.id) {
        workspacesData.forEach(async (workspace) => {
          try {
            // Silently release lock - ignore errors (lock may not exist or already released)
            await api.unlockWorkspace(workspace.id).catch(() => {});
          } catch (error) {
            // Ignore errors - lock may not exist
          }
        });
      }
    } catch (error) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanAction = () => {
    if (quotaData?.access_granted) {
      if (quotaData?.management_url) {
        window.open(quotaData.management_url, '_blank');
        return;
      }
    }
    setUpgradePromptOpen(true);
  };

  const handleLogoUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setNewWorkspaceLogo(fullUrl);
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };

  const handleBackgroundUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setNewWorkspaceBackground(fullUrl);
      toast.success('Background uploaded!');
    } catch (error) {
      toast.error('Failed to upload background');
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const response = await api.createWorkspace({
        name: newWorkspaceName,
        brand_color: newWorkspaceColor,
        logo: newWorkspaceLogo || null,
        portal_background_url: newWorkspaceBackground || null
      });
      toast.success('Workspace created!');
      setWorkspaces([...workspaces, response.data]);
      window.dispatchEvent(new CustomEvent('onboarding:workspaceCreated', { detail: { workspaceId: response.data.id, workspaceSlug: response.data.slug } }));
      setCreateDialogOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceColor('#4f46e5');
      setNewWorkspaceLogo('');
      setNewWorkspaceBackground('');
    } catch (error) {
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.detail || 'Workspace limit reached. Please upgrade your plan.');
        setUpgradePromptOpen(true);
      } else {
        toast.error(error.response?.data?.detail || 'Failed to create workspace');
      }
    }
  };

  if (loading) {
    return (
      <Surface variant="glass" className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </Surface>
    );
  }

  // For dashboard page, use first workspace background if available
  const dashboardBackground = workspaces.length > 0 && workspaces[0].portal_background_url
    ? normalizeImageUrl(workspaces[0].portal_background_url)
    : null;

  return (
    <DashboardLayout backgroundUrl={dashboardBackground}>
      <OverQuotaBanner onUpgrade={() => setUpgradePromptOpen(true)} />
      <UpgradePrompt open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} />

      <PageHeader
        title={t('dashboard.welcome', { name: user?.name })}
        description={t('dashboard.manageWorkspaces')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('onboarding:createWorkspace'));
                setCreateDialogOpen(true);
              }}
              className="rounded-full"
              data-testid="create-workspace-button"
              data-onboarding="create-workspace-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('dashboard.newWorkspace')}
            </Button>
          </div>
        }
      />

      <PageSurface>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            window.dispatchEvent(new CustomEvent('onboarding:dialogClosed'));
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('workspace.create')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateWorkspace} className="space-y-4 mt-4" data-onboarding="workspace-create-form">
                <div>
                  <Label htmlFor="workspace-name" className="text-sm font-medium text-foreground">{t('workspace.workspaces')} {t('common.name')}</Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="My Company"
                    required
                    data-testid="workspace-name-input"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="brand-color" className="text-sm font-medium text-foreground">{t('workspace.brandColor')}</Label>
                  <div className="flex gap-3 mt-1.5">
                    <Input
                      id="brand-color"
                      type="color"
                      value={newWorkspaceColor}
                      onChange={(e) => setNewWorkspaceColor(e.target.value)}
                      className="w-20 h-10"
                      data-testid="brand-color-input"
                      required
                    />
                    <Input
                      type="text"
                      value={newWorkspaceColor}
                      onChange={(e) => setNewWorkspaceColor(e.target.value)}
                      className="flex-1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workspace-logo" className="text-sm font-medium text-foreground">{t('workspace.workspaceLogo')}</Label>
                  <div className="mt-1.5 space-y-2">
                    {newWorkspaceLogo && (
                      <div className="relative">
                        <img src={newWorkspaceLogo} alt="Logo preview" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewWorkspaceLogo('')}
                          className="absolute top-0 right-0 h-6 w-6 p-0 text-destructive bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={newWorkspaceLogo}
                        onChange={(e) => setNewWorkspaceLogo(e.target.value)}
                        placeholder="Logo URL (optional)"
                        className="flex-1 text-sm"
                      />
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                          <span>
                            <Upload className="w-4 h-4" />
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="workspace-background" className="text-sm font-medium text-foreground">{t('workspace.portalBackgroundImage')}</Label>
                  <div className="mt-1.5 space-y-2">
                    {newWorkspaceBackground && (
                      <div className="relative">
                        <img src={newWorkspaceBackground} alt="Background preview" className="w-full h-32 rounded-lg object-cover border border-slate-200" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewWorkspaceBackground('')}
                          className="absolute top-2 right-2 text-destructive bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={newWorkspaceBackground}
                        onChange={(e) => setNewWorkspaceBackground(e.target.value)}
                        placeholder="Background image URL (optional)"
                        className="flex-1 text-sm"
                      />
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleBackgroundUpload(file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                          <span>
                            <Upload className="w-4 h-4" />
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-full" data-testid="create-workspace-submit" data-onboarding="workspace-create-submit">
                  {t('workspace.create')}
                </Button>
              </form>
            </DialogContent>
            </Dialog>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace, index) => (
            <Card
              key={workspace.id}
              animated={true}
              animationIndex={index}
              interactive={true}
              className="cursor-pointer"
              onClick={async () => {
                // Check if workspace is locked (read-only check, don't acquire lock)
                // Lock will be acquired by the workspace page itself when user actually enters
                try {
                  const lockResult = await api.checkWorkspaceLock(workspace.id);
                  if (lockResult.locked) {
                    // Workspace is locked, show modal
                    setLockedBy(lockResult.locked_by);
                    setPendingWorkspace(workspace);
                    setLockModalOpen(true);
                  } else {
                    // Not locked, navigate - workspace page will acquire lock
                    window.dispatchEvent(new CustomEvent('onboarding:workspaceEntered', { detail: { workspaceId: workspace.id, workspaceSlug: workspace.slug } }));
                    navigate(`/workspace/${workspace.slug}/walkthroughs`);
                  }
                } catch (error) {
                  // If lock check fails, still navigate - workspace page will handle it
                  console.error('Lock check failed:', error);
                  window.dispatchEvent(new CustomEvent('onboarding:workspaceEntered', { detail: { workspaceId: workspace.id, workspaceSlug: workspace.slug } }));
                  navigate(`/workspace/${workspace.slug}/walkthroughs`);
                }
              }}
              data-testid={`workspace-card-${workspace.id}`}
              data-onboarding="workspace-card"
              data-onboarding-workspace-id={workspace.id}
            >
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              <CardContent className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {workspace.logo ? (
                      <img
                        src={normalizeImageUrl(workspace.logo)}
                        alt={workspace.name}
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-white text-xl shadow-lg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-white text-xl shadow-lg"
                        style={{ backgroundColor: workspace.brand_color }}
                      >
                        {workspace.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors mb-1">
                        {workspace.name}
                      </h3>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        /{workspace.slug}
                        {workspace.owner_id && workspace.owner_id !== user?.id && (
                          <span className="ml-2 text-slate-400">(Shared)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-blue-400">
                    {t('workspace.active')}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Check if workspace is locked (read-only check, don't acquire lock)
                      try {
                        const lockResult = await api.checkWorkspaceLock(workspace.id);
                        if (lockResult.locked) {
                          setLockedBy(lockResult.locked_by);
                          setPendingWorkspace(workspace);
                          setLockModalOpen(true);
                        } else {
                          // Not locked, navigate - workspace page will acquire lock
                          navigate(`/workspace/${workspace.slug}/walkthroughs`);
                        }
                      } catch (error) {
                        // If lock check fails, still navigate - workspace page will handle it
                        console.error('Lock check failed:', error);
                        navigate(`/workspace/${workspace.slug}/walkthroughs`);
                      }
                    }}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('workspace.guides')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Check if workspace is locked (read-only check, don't acquire lock)
                      try {
                        const lockResult = await api.checkWorkspaceLock(workspace.id);
                        if (lockResult.locked) {
                          setLockedBy(lockResult.locked_by);
                          setPendingWorkspace(workspace);
                          setLockModalOpen(true);
                        } else {
                          // Not locked, navigate - workspace page will acquire lock
                          navigate(`/workspace/${workspace.slug}/categories`);
                        }
                      } catch (error) {
                        // If lock check fails, still navigate - workspace page will handle it
                        console.error('Lock check failed:', error);
                        navigate(`/workspace/${workspace.slug}/categories`);
                      }
                    }}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {t('workspace.categories')}
                  </Button>
                  {workspace.owner_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspace/${workspace.slug}/settings`);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <WorkspaceLockModal
          open={lockModalOpen}
          onOpenChange={setLockModalOpen}
          lockedBy={lockedBy}
          onCancel={() => {
            setLockModalOpen(false);
            setPendingWorkspace(null);
            setLockedBy('');
          }}
          onEnterAnyway={async () => {
            if (!pendingWorkspace) return;
            // Force takeover - this will acquire the lock
            // The workspace page will also try to acquire lock on mount, but since we're forcing,
            // it should succeed
            try {
              const lockResult = await api.lockWorkspace(pendingWorkspace.id, true);
              if (lockResult.success) {
                setLockModalOpen(false);
                navigate(`/workspace/${pendingWorkspace.slug}/walkthroughs`);
                setPendingWorkspace(null);
                setLockedBy('');
              } else {
                toast.error('Failed to enter workspace. Please try again.');
              }
            } catch (error) {
              console.error('Force takeover error:', error);
              // Even if there's an error, try to navigate - workspace page will handle lock acquisition
              toast.error('Error during force takeover. Attempting to enter workspace...');
              setLockModalOpen(false);
              navigate(`/workspace/${pendingWorkspace.slug}/walkthroughs`);
              setPendingWorkspace(null);
              setLockedBy('');
            }
          }}
        />

        {workspaces.length === 0 && (
          <div className="col-span-full">
            <Surface variant="floating" className="text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-heading font-semibold text-white mb-2">
                {t('dashboard.noWorkspaces')}
              </h3>
              <p className="text-slate-400 mb-6">{t('dashboard.createFirst')}</p>
              <Button variant="primary" onClick={() => setCreateDialogOpen(true)} data-testid="empty-create-workspace-button">
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.newWorkspace')}
              </Button>
            </Surface>
          </div>
        )}

          {/* Quota Sidebar */}
        <div className="lg:col-span-1 space-y-6">
            <QuotaDisplay showWarnings={true} onUpgrade={() => setUpgradePromptOpen(true)} />
            <BillingInfo />
          </div>
      </PageSurface>
    </DashboardLayout>
  );
};

export default DashboardPage;