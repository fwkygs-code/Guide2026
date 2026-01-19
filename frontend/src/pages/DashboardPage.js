import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, FolderOpen, BarChart3, Settings, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { normalizeImageUrl } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import DashboardLayout from '../components/DashboardLayout';
import QuotaDisplay from '../components/QuotaDisplay';
import OverQuotaBanner from '../components/OverQuotaBanner';
import UpgradePrompt from '../components/UpgradePrompt';
import BillingInfo from '../components/BillingInfo';

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
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.getWorkspaces();
      setWorkspaces(response.data);
    } catch (error) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // For dashboard page, use first workspace background if available
  const dashboardBackground = workspaces.length > 0 && workspaces[0].portal_background_url
    ? normalizeImageUrl(workspaces[0].portal_background_url)
    : null;

  return (
    <DashboardLayout backgroundUrl={dashboardBackground}>
      <div className="p-8">
        <OverQuotaBanner onUpgrade={() => setUpgradePromptOpen(true)} />
        <UpgradePrompt open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-heading font-bold text-slate-900">{t('dashboard.welcome', { name: user?.name })}</h1>
                <p className="text-slate-600 mt-1">{t('dashboard.manageWorkspaces')}</p>
              </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="create-workspace-button">
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.newWorkspace')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('workspace.create')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="workspace-name">{t('workspace.workspaces')} {t('common.name')}</Label>
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
                  <Label htmlFor="brand-color">Brand Color</Label>
                  <div className="flex gap-3 mt-1.5">
                    <Input
                      id="brand-color"
                      type="color"
                      value={newWorkspaceColor}
                      onChange={(e) => setNewWorkspaceColor(e.target.value)}
                      className="w-20 h-10"
                      data-testid="brand-color-input"
                    />
                    <Input
                      type="text"
                      value={newWorkspaceColor}
                      onChange={(e) => setNewWorkspaceColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workspace-logo">Workspace Logo</Label>
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
                  <Label htmlFor="workspace-background">Portal Background Image</Label>
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
                <Button type="submit" className="w-full rounded-full" data-testid="create-workspace-submit">
                  Create Workspace
                </Button>
              </form>
            </DialogContent>
            </Dialog>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace, index) => (
            <motion.div
              key={workspace.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all cursor-pointer"
              onClick={() => navigate(`/workspace/${workspace.slug}/walkthroughs`)}
              data-testid={`workspace-card-${workspace.id}`}
            >
              <div className="flex items-start gap-4">
                {workspace.logo ? (
                  <img 
                    src={normalizeImageUrl(workspace.logo)} 
                    alt={workspace.name} 
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold ${workspace.logo ? 'hidden' : ''}`}
                  style={{ backgroundColor: workspace.brand_color }}
                >
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                    {workspace.name}
                  </h3>
                  <p className="text-sm text-slate-500">/{workspace.slug}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col h-auto py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workspace/${workspace.slug}/walkthroughs`);
                  }}
                  data-testid={`workspace-walkthroughs-${workspace.id}`}
                >
                  <BookOpen className="w-4 h-4 mb-1" />
                  <span className="text-xs">{t('workspace.guides')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col h-auto py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workspace/${workspace.slug}/categories`);
                  }}
                  data-testid={`workspace-categories-${workspace.id}`}
                >
                  <FolderOpen className="w-4 h-4 mb-1" />
                  <span className="text-xs">{t('workspace.categories')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col h-auto py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workspace/${workspace.slug}/settings`);
                  }}
                  data-testid={`workspace-settings-${workspace.id}`}
                >
                  <Settings className="w-4 h-4 mb-1" />
                  <span className="text-xs">{t('workspace.settings')}</span>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {workspaces.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
              {t('dashboard.noWorkspaces')}
            </h3>
            <p className="text-slate-600 mb-6">{t('dashboard.createFirst')}</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="empty-create-workspace-button">
              <Plus className="w-4 h-4 mr-2" />
              {t('dashboard.newWorkspace')}
            </Button>
          </div>
        )}
          </div>

          {/* Quota Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <QuotaDisplay showWarnings={true} onUpgrade={() => setUpgradePromptOpen(true)} />
            <BillingInfo />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;