import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Copy, ExternalLink, Share2, Code, Globe, Type, Upload, Plus, Trash2, Phone, Clock, MessageCircle, UserPlus, Mail, X, Check, Puzzle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api, getBackendUrl, getPublicPortalUrl } from '../lib/api';
import { useTextSize } from '../contexts/TextSizeContext';
import DashboardLayout from '../components/DashboardLayout';
import WorkspaceLoader from '../components/WorkspaceLoader';
import QuotaDisplay from '../components/QuotaDisplay';
import UpgradePrompt from '../components/UpgradePrompt';
import PlanSelectionModal from '../components/PlanSelectionModal';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, PageSurface, Surface, Card, Button, Badge } from '../components/ui/design-system';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const { textSize, setTextSize } = useTextSize();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Resolve workspace slug to ID
  const { workspace, workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [logoUrl, setLogoUrl] = useState('');
  const [portalBackgroundUrl, setPortalBackgroundUrl] = useState('');
  const [portalPalette, setPortalPalette] = useState({ primary: '#4f46e5', secondary: '#8b5cf6', accent: '#10b981' });
  const [portalLinks, setPortalLinks] = useState([]);
  const [portalPhone, setPortalPhone] = useState('');
  const [portalWorkingHours, setPortalWorkingHours] = useState('');
  const [portalWhatsapp, setPortalWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [planSelectionOpen, setPlanSelectionOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  
  // Extension Binding Token state
  const [bindingToken, setBindingToken] = useState(null);
  const [tokenStatus, setTokenStatus] = useState('none');
  const [tokenCreatedAt, setTokenCreatedAt] = useState(null);
  const [boundExtensionId, setBoundExtensionId] = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Browser Extension Targets state
  const [adminWalkthroughs, setAdminWalkthroughs] = useState([]);
  const [extensionTargets, setExtensionTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedWalkthrough, setSelectedWalkthrough] = useState('');
  const [selectedStep, setSelectedStep] = useState('');
  const [urlRuleType, setUrlRuleType] = useState('exact');
  const [urlRuleValue, setUrlRuleValue] = useState('');
  const [targetSelector, setTargetSelector] = useState('');
  const [targetEnabled, setTargetEnabled] = useState(true);
  const [creatingTarget, setCreatingTarget] = useState(false);

  const checkOwnership = useCallback(async () => {
    if (!workspaceId || !user) return;
    try {
      // Fetch workspace to get owner_id
      const response = await api.getWorkspace(workspaceId);
      if (response.data?.owner_id) {
        setIsOwner(response.data.owner_id === user.id);
      }
    } catch (error) {
      console.error('Failed to check ownership:', error);
    }
  }, [workspaceId, user]);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId || !user) return;
    setLoadingMembers(true);
    try {
      const response = await api.getWorkspaceMembers(workspaceId);
      const membersList = response.data || [];
      setMembers(membersList);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [workspaceId, user]);

  useEffect(() => {
    if (workspace && user) {
      // Check if user is owner directly from workspace object
      const userIsOwner = workspace.owner_id === user.id;
      setIsOwner(userIsOwner);
      
      // Redirect non-owners away from settings immediately
      if (!userIsOwner) {
        toast.error('Only workspace owners can access settings');
        const slug = workspace.slug || workspaceId;
        if (slug) {
          navigate(`/workspace/${slug}/walkthroughs`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }
      
      // Use workspace data from hook (only if owner)
      setName(workspace.name || '');
      setBrandColor(workspace.brand_color || '#4f46e5');
    } else if (!workspace && workspaceId && user) {
      // If workspace not loaded yet, wait for it
      // Don't redirect until we know the ownership status
    }
  }, [workspace, user, workspaceId, navigate, checkOwnership]);

  // Acquire workspace lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Failed to acquire workspace lock:', error);
      }
    };

    if (workspaceId) {
      acquireLock();
    }

    // Release lock on unmount (ignore errors - idempotent)
    return () => {
      if (workspaceId) {
        api.unlockWorkspace(workspaceId).catch(() => {
          // Ignore unlock errors - lock may already be released, expired, or user was forced out
        });
      }
    };
  }, [workspaceId, navigate]);

  // Fetch workspace members
  useEffect(() => {
    if (workspaceId && user) {
      fetchMembers();
    }
  }, [workspaceId, user, fetchMembers]);

  const handleLogoUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setLogoUrl(fullUrl);
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };

  const handleBackgroundUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setPortalBackgroundUrl(fullUrl);
      toast.success('Background uploaded!');
    } catch (error) {
      toast.error('Failed to upload background');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !workspaceId) return;
    setInviting(true);
    try {
      await api.inviteUserToWorkspace(workspaceId, inviteEmail);
      toast.success(t('settings.invitationSent', { email: inviteEmail }));
      setInviteEmail('');
      fetchMembers(); // Refresh members list
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to send invitation';
      toast.error(errorMsg);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId, isPending = false) => {
    if (!workspaceId) return;
    const confirmMessage = isPending 
      ? t('dialogs.confirm.cancelInvitation')
      : t('dialogs.confirm.removeMember');
    if (!confirm(confirmMessage)) return;
    try {
      await api.removeWorkspaceMember(workspaceId, userId);
      toast.success(isPending ? t('settings.invitationCancelled') : t('settings.memberRemoved'));
      fetchMembers();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || (isPending ? 'Failed to cancel invitation' : 'Failed to remove member');
      toast.error(errorMsg);
    }
  };

  const handleDeleteWorkspace = async () => {
    const expectedPhrase = `delete my workspace ${workspace?.name || ''}`;
    
    if (deleteConfirmation.trim().toLowerCase() !== expectedPhrase.toLowerCase()) {
      toast.error('Please type the exact phrase to confirm deletion');
      return;
    }
    
    setDeleting(true);
    try {
      await api.deleteWorkspace(workspaceId);
      toast.success(t('settings.workspaceDeleted'));
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete workspace');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateWorkspace(workspaceId, {
        name,
        brand_color: brandColor,
        logo: logoUrl || null,
        portal_background_url: portalBackgroundUrl || null,
        portal_palette: portalPalette,
        portal_links: portalLinks.length > 0 ? portalLinks : null,
        portal_phone: portalPhone || null,
        portal_working_hours: portalWorkingHours || null,
        portal_whatsapp: portalWhatsapp || null
      });
      toast.success('Settings saved!');
      // Workspace is loaded from useWorkspaceSlug hook
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Extension Binding Token handlers
  const fetchTokenStatus = useCallback(async () => {
    if (!workspaceId || !isOwner) return;
    setLoadingToken(true);
    try {
      const response = await api.getBindingTokenStatus(workspaceId);
      const state = response.data.state || 'none';
      setTokenStatus(state);
      setTokenCreatedAt(response.data.created_at);
      setBoundExtensionId(response.data.bound_extension_id || null);
      setBindingToken(null);
      setShowToken(false);
    } catch (error) {
      console.error('Failed to fetch token status:', error);
      setTokenStatus('none');
    } finally {
      setLoadingToken(false);
    }
  }, [workspaceId, isOwner]);

  useEffect(() => {
    if (workspaceId && isOwner) {
      fetchTokenStatus();
    }
  }, [workspaceId, isOwner, fetchTokenStatus]);

  const handleGenerateToken = async () => {
    if (!workspaceId || !isOwner) return;
    setLoadingToken(true);
    try {
      const response = await api.generateBindingToken(workspaceId);
      setBindingToken(response.data.token);
      setTokenStatus('unbound');
      setTokenCreatedAt(response.data.created_at);
      setBoundExtensionId(null);
      setShowToken(true);
      toast.success('Extension binding token generated');
    } catch (error) {
      console.error('Failed to generate token:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate token');
    } finally {
      setLoadingToken(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!workspaceId || !isOwner) return;
    if (!confirm('This will revoke the current token and all extensions using it will stop working immediately. Continue?')) return;
    setLoadingToken(true);
    try {
      const response = await api.regenerateBindingToken(workspaceId);
      setBindingToken(response.data.token);
      setTokenStatus('unbound');
      setTokenCreatedAt(response.data.created_at);
      setBoundExtensionId(null);
      setShowToken(true);
      toast.success('Extension binding token regenerated (old token revoked)');
    } catch (error) {
      console.error('Failed to regenerate token:', error);
      toast.error(error.response?.data?.detail || 'Failed to regenerate token');
    } finally {
      setLoadingToken(false);
    }
  };

  const handleCopyToken = () => {
    if (bindingToken && tokenStatus === 'unbound') {
      navigator.clipboard.writeText(bindingToken);
      toast.success('Token copied to clipboard');
    }
  };

  // Extension Targets handlers
  const fetchAdminWalkthroughs = useCallback(async () => {
    if (!isOwner) return;
    try {
      const response = await api.getAdminWalkthroughs();
      setAdminWalkthroughs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch admin walkthroughs:', error);
      toast.error('Failed to load walkthroughs');
    }
  }, [isOwner]);

  const fetchExtensionTargets = useCallback(async () => {
    if (!isOwner) return;
    setLoadingTargets(true);
    try {
      const response = await api.getExtensionTargets();
      setExtensionTargets(response.data || []);
    } catch (error) {
      console.error('Failed to fetch extension targets:', error);
      toast.error('Failed to load extension targets');
    } finally {
      setLoadingTargets(false);
    }
  }, [isOwner]);

  const handleCreateTarget = async () => {
    if (!selectedWalkthrough || !selectedStep || !urlRuleValue || !targetSelector) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreatingTarget(true);
    try {
      await api.createExtensionTarget({
        walkthrough_id: selectedWalkthrough,
        step_id: selectedStep,
        url_rule: { type: urlRuleType, value: urlRuleValue },
        selector: targetSelector
      });
      toast.success('Extension target created');
      // Reset form
      setSelectedWalkthrough('');
      setSelectedStep('');
      setUrlRuleValue('');
      setTargetSelector('');
      setTargetEnabled(true);
      // Refresh list
      fetchExtensionTargets();
    } catch (error) {
      console.error('Failed to create extension target:', error);
      toast.error(error.response?.data?.detail || 'Failed to create target');
    } finally {
      setCreatingTarget(false);
    }
  };

  const handleDeleteTarget = async (targetId) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    try {
      await api.deleteExtensionTarget(targetId);
      toast.success('Target deleted');
      fetchExtensionTargets();
    } catch (error) {
      console.error('Failed to delete target:', error);
      toast.error('Failed to delete target');
    }
  };

  // Load walkthroughs and targets when component mounts
  useEffect(() => {
    if (isOwner) {
      fetchAdminWalkthroughs();
      fetchExtensionTargets();
    }
  }, [isOwner, fetchAdminWalkthroughs, fetchExtensionTargets]);

  // Use public portal URL for sharing (user-facing link)
  const portalUrl = `${getPublicPortalUrl()}/portal/${workspace?.slug}`;
  const portalEmbedUrl = `${window.location.origin}/embed/portal/${workspace?.slug}`;
  const portalIframeCode = `<iframe src="${portalEmbedUrl}" width="100%" height="800" frameborder="0" allowfullscreen></iframe>`;
  const portalScriptCode = `<script src="${window.location.origin}/embed/widget.js" data-slug="${workspace?.slug}"></script>`;

  const copyToClipboard = (text, message = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const formatTokenStatusLabel = () => {
    if (tokenStatus === 'unbound') {
      return 'Active (unbound)';
    }
    if (tokenStatus === 'bound') {
      return 'Active (bound)';
    }
    return 'No active token';
  };

  const tokenBadgeVariant = () => {
    if (tokenStatus === 'unbound') return 'success';
    if (tokenStatus === 'bound') return 'warning';
    return 'secondary';
  };

  if (workspaceLoading || !workspaceId) {
    return (
      <DashboardLayout>
        <Surface variant="glass" className="min-h-screen flex items-center justify-center">
          <WorkspaceLoader size={160} />
        </Surface>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <UpgradePrompt open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} workspaceId={workspaceId} />
      <PlanSelectionModal
        open={planSelectionOpen}
        onOpenChange={setPlanSelectionOpen}
        isSignup={false}
      />

      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      <PageSurface className="text-foreground">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            <div className="space-y-6">
          {/* Basic Settings */}
          <Card interactive={true} className="mb-6">
            <Card.Header>
              <Card.Title className="text-foreground">{t('settings.basicInfo')}</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-6">
              <div>
                <Label htmlFor="workspace-name" className="text-foreground">{t('settings.workspaceName')}</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="workspace-name-input"
                  className="mt-1.5 text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="logo" className="text-foreground">{t('settings.workspaceLogo')}</Label>
                <div className="mt-1.5 space-y-2">
                  {logoUrl && (
                    <div className="relative inline-block">
                      <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-border" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                    className="text-sm text-foreground"
                  />
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl('')}
                      className="text-destructive"
                    >
                      {t('settings.removeLogo')}
                    </Button>
                  )}
                </div>
              </div>
            </Card.Content>
          </Card>


          {/* Portal Contact Information */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {t('settings.portalContactInfo')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">{t('settings.portalContactDescription')}</p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="portal-phone" className="flex items-center gap-2 text-foreground">
                  <Phone className="w-4 h-4" />
                  {t('settings.phoneNumber')}
                </Label>
                <Input
                  id="portal-phone"
                  value={portalPhone}
                  onChange={(e) => setPortalPhone(e.target.value)}
                  placeholder="e.g., +1 (555) 123-4567"
                  className="mt-1.5 text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="portal-working-hours" className="flex items-center gap-2 text-foreground">
                  <Clock className="w-4 h-4" />
                  {t('settings.workingHours')}
                </Label>
                <Input
                  id="portal-working-hours"
                  value={portalWorkingHours}
                  onChange={(e) => setPortalWorkingHours(e.target.value)}
                  placeholder="e.g., Mon-Fri: 9AM-5PM EST"
                  className="mt-1.5 text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="portal-whatsapp" className="flex items-center gap-2 text-foreground">
                  <MessageCircle className="w-4 h-4" />
                  {t('settings.whatsappLink')}
                </Label>
                <Input
                  id="portal-whatsapp"
                  value={portalWhatsapp}
                  onChange={(e) => setPortalWhatsapp(e.target.value)}
                  placeholder="e.g., https://wa.me/1234567890"
                  type="url"
                  className="mt-1.5 text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Format: https://wa.me/[country code][phone number]</p>
              </div>
            </div>
          </div>

          {/* Portal Links */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              {t('settings.portalExternalLinks')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">{t('settings.portalLinksDescription')}</p>
            <div className="space-y-3">
              {portalLinks.map((link, index) => (
                <div key={index} className="flex gap-2 items-start p-3 bg-secondary/50 dark:bg-background/50 rounded-lg border border-border/50 dark:border-slate-800/50">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Button Label (e.g., Visit Website)"
                      value={link.label || ''}
                      onChange={(e) => {
                        const newLinks = [...portalLinks];
                        newLinks[index] = { ...newLinks[index], label: e.target.value };
                        setPortalLinks(newLinks);
                      }}
                      className="text-sm text-foreground"
                    />
                    <Input
                      placeholder="URL (e.g., https://example.com)"
                      value={link.url || ''}
                      onChange={(e) => {
                        const newLinks = [...portalLinks];
                        newLinks[index] = { ...newLinks[index], url: e.target.value };
                        setPortalLinks(newLinks);
                      }}
                      type="url"
                      className="text-sm text-foreground"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newLinks = portalLinks.filter((_, i) => i !== index);
                      setPortalLinks(newLinks);
                    }}
                    className="text-destructive hover:text-destructive mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {portalLinks.length < 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPortalLinks([...portalLinks, { label: '', url: '' }])}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              )}
              {portalLinks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No links added yet. Click "Add Link" to get started.</p>
              )}
            </div>
          </div>

          {/* Plan Management */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-4">{t('settings.planManagement')}</h2>
            <div className="space-y-4">
              <div>
                <Label>Current Plan</Label>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {t('settings.planManagementDescription')}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setPlanSelectionOpen(true)}
                className="w-full"
              >
                {t('settings.changePlan')}
              </Button>
            </div>
          </div>

          {/* Danger Zone - Delete Workspace */}
          <div className="glass rounded-xl p-6 border-2 border-red-500/50">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-4">{t('settings.dangerZone')}</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-red-900">{t('settings.deleteWorkspace')}</Label>
                <p className="text-sm text-red-700 mt-1.5 mb-3">
                  {t('settings.deleteWorkspaceWarning')}
                </p>
                <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
                  setDeleteDialogOpen(open);
                  if (!open) {
                    setDeleteConfirmation('');
                  }
                }}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('settings.deleteWorkspace')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.deleteConfirmMessage')}
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>All walkthroughs in this workspace</li>
                          <li>All categories in this workspace</li>
                          <li>All files associated with this workspace</li>
                          <li>The workspace itself</li>
                        </ul>
                        <p className="mt-3 font-semibold text-red-600">
                          All data will be deleted forever.
                        </p>
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm font-medium text-red-800 mb-2">
                            To confirm deletion, type the following phrase:
                          </p>
                          <code className="block p-2 bg-red-100 rounded text-red-900 text-sm font-mono">
                            delete my workspace {workspace?.name || ''}
                          </code>
                        </div>
                        <div className="mt-3">
                          <Input
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="Type the phrase above to confirm"
                            className="w-full"
                            disabled={deleting}
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel 
                        disabled={deleting}
                        onClick={() => setDeleteConfirmation('')}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteWorkspace}
                        disabled={deleting || deleteConfirmation.trim().toLowerCase() !== `delete my workspace ${workspace?.name || ''}`.toLowerCase()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? t('settings.deleting') : t('settings.confirmDelete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>


          {/* Workspace Sharing */}
          {workspace && workspaceId && user && isOwner && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-xl font-heading font-semibold text-foreground mb-4">{t('settings.workspaceSharing')}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t('settings.inviteUserByEmail')}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{t('settings.inviteDescription')}</p>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
                      className="flex-1 text-foreground"
                    />
                    <Button
                      onClick={handleInvite}
                      disabled={inviting || !inviteEmail}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {inviting ? t('settings.inviting') : t('settings.invite')}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>{t('settings.workspaceMembers')}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{t('settings.workspaceMembersDescription')}</p>
                  {loadingMembers ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading members...</div>
                  ) : members.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border dark:border-slate-800 rounded-lg">
                      No members yet. Invite users to collaborate.
                    </div>
                  ) : (
                    <div className="space-y-2 mt-1.5">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-secondary dark:bg-background/50 rounded-lg border border-border dark:border-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {member.user_email || 'Member'}
                              </p>
                              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                                {member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer'}
                                {member.status === 'pending' && ' • Pending invitation'}
                              </p>
                            </div>
                          </div>
                          {member.user_id !== user?.id && isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.user_id, member.status === 'pending')}
                              className="text-destructive hover:text-destructive"
                              title={member.status === 'pending' ? 'Cancel invitation' : 'Remove member'}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Portal Settings */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold text-foreground mb-4">{t('settings.publicPortal')}</h2>
            <Tabs defaultValue="share" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="share">
                  <Share2 className="w-4 h-4 mr-2" />
                  {t('settings.share')}
                </TabsTrigger>
                <TabsTrigger value="embed">
                  <Code className="w-4 h-4 mr-2" />
                  {t('settings.embed')}
                </TabsTrigger>
                <TabsTrigger value="integration">
                  <Globe className="w-4 h-4 mr-2" />
                  {t('settings.integration')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="share" className="space-y-4 mt-4">
                <div>
                  <Label className="text-foreground">{t('settings.portalLink')}</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">{t('settings.portalLinkDescription')}</p>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={portalUrl}
                      readOnly
                      className="flex-1 text-foreground"
                      data-testid="portal-url-input"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(portalUrl, 'Portal link copied!')} 
                      data-testid="copy-portal-url-button"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(portalUrl, '_blank')}
                      data-testid="view-portal-button"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="embed" className="space-y-4 mt-4">
                <div>
                  <Label className="text-foreground">iFrame Embed Code</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">Copy and paste this code into your website HTML</p>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={portalIframeCode}
                      readOnly
                      className="flex-1 font-mono text-xs text-foreground"
                      data-testid="portal-iframe-input"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(portalIframeCode, 'Embed code copied!')}
                      data-testid="copy-iframe-button"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-3 p-3 glass rounded-xl">
                    <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                    <iframe 
                      src={portalEmbedUrl}
                      className="w-full h-96 border border-border rounded-lg"
                      title="Portal Preview"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="integration" className="space-y-4 mt-4">
                <div>
                  <Label className="text-foreground">CRM Integration</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">Use these URLs to integrate with your CRM or other platforms</p>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs text-foreground mb-1">Portal API Endpoint</Label>
                      <div className="flex gap-2">
                        <Input
                          value={`${window.location.origin}/api/portal/${workspace?.slug}`}
                          readOnly
                          className="flex-1 font-mono text-xs text-foreground"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(`${window.location.origin}/api/portal/${workspace?.slug}`, 'API endpoint copied!')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-foreground mb-1">Embeddable Portal URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={portalEmbedUrl}
                          readOnly
                          className="flex-1 font-mono text-xs text-foreground"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(portalEmbedUrl, 'Embed URL copied!')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 glass rounded-xl">
                    <p className="text-sm font-medium text-foreground mb-2">Integration Tips:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Use the embed URL in iframes for seamless integration</li>
                      <li>API endpoint returns JSON data for custom integrations</li>
                      <li>All portal routes support CORS for cross-origin embedding</li>
                      <li>Works with Salesforce, HubSpot, Zendesk, and other CRMs</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Interguide Extension Integration */}
          {isOwner && (
            <div className="glass rounded-xl p-6 border-2 border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-heading font-semibold text-foreground">Interguide Extension</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect the Chrome extension to this workspace. The extension displays walkthroughs on any website without requiring users to log in.
              </p>
              
              <div className="space-y-4">
                {/* Token Status */}
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Binding Token Status</p>
                    <p className="text-xs text-muted-foreground">
                      {tokenStatus === 'none'
                        ? 'No token generated yet'
                        : `${formatTokenStatusLabel()}${tokenCreatedAt ? ` · created ${new Date(tokenCreatedAt).toLocaleDateString()}` : ''}`}
                    </p>
                  </div>
                  <Badge variant={tokenBadgeVariant()}>
                    {tokenStatus === 'none' ? 'None' : tokenStatus === 'unbound' ? 'Active' : 'Bound'}
                  </Badge>
                </div>

                {tokenStatus === 'bound' && (
                  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning-foreground">
                    <p className="font-medium">Current token is already bound to an extension.</p>
                    {boundExtensionId && (
                      <p className="text-xs opacity-80 mt-1">Extension ID: {boundExtensionId}</p>
                    )}
                    <p className="text-xs mt-1">Regenerate to connect a new browser.</p>
                  </div>
                )}

                {/* Token Display (one-time reveal) */}
                {showToken && bindingToken && tokenStatus === 'unbound' && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        Copy this token now — it will never be shown again
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={bindingToken}
                        readOnly
                        type="text"
                        className="flex-1 font-mono text-xs bg-white dark:bg-slate-900"
                      />
                      <Button
                        variant="outline"
                        onClick={handleCopyToken}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Paste this token into the Interguide Extension popup to bind it to this workspace.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {tokenStatus === 'none' ? (
                    <Button
                      onClick={handleGenerateToken}
                      disabled={loadingToken}
                      className="flex-1"
                    >
                      {loadingToken ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Generate Token
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleRegenerateToken}
                        disabled={loadingToken}
                        className="flex-1"
                      >
                        {loadingToken ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Regenerate Token
                      </Button>
                      {!showToken && tokenStatus === 'unbound' && (
                        <Button
                          variant="secondary"
                          onClick={() => setShowToken(true)}
                          disabled={loadingToken}
                          className="flex-1"
                        >
                          <Puzzle className="w-4 h-4 mr-2" />
                          Show Token
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-4 p-3 bg-secondary/30 rounded-lg text-xs text-muted-foreground space-y-1">
                  <p><strong>How to use:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Install the Interguide Extension from the Chrome Web Store</li>
                    <li>Click the extension icon in your browser toolbar</li>
                    <li>Paste the token above and click "Bind to Workspace"</li>
                    <li>The extension will now display walkthroughs from this workspace on any matching website</li>
                  </ol>
                </div>

                {/* Browser Extension Targets */}
                <div className="mt-6 border-t border-border pt-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Browser Extension Targets</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Associate existing walkthrough steps with specific URLs and DOM elements. The extension will render bubble buttons on matching pages.
                  </p>

                  {/* Create Target Form */}
                  <div className="space-y-4 p-4 bg-secondary/30 rounded-lg mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Walkthrough Dropdown */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Walkthrough</Label>
                        <Select value={selectedWalkthrough} onValueChange={(val) => { setSelectedWalkthrough(val); setSelectedStep(''); }}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select walkthrough" />
                          </SelectTrigger>
                          <SelectContent>
                            {adminWalkthroughs.map((wt) => (
                              <SelectItem key={wt.walkthrough_id} value={wt.walkthrough_id}>
                                {wt.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Step Dropdown */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Step</Label>
                        <Select value={selectedStep} onValueChange={setSelectedStep} disabled={!selectedWalkthrough}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder={selectedWalkthrough ? "Select step" : "Select walkthrough first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {adminWalkthroughs
                              .find((wt) => wt.walkthrough_id === selectedWalkthrough)?.steps
                              ?.map((step) => (
                                <SelectItem key={step.id} value={step.id}>
                                  {step.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* URL Rule */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">URL Match Type</Label>
                        <Select value={urlRuleType} onValueChange={setUrlRuleType}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exact">Exact</SelectItem>
                            <SelectItem value="prefix">Prefix (wildcard)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">URL Pattern</Label>
                        <Input
                          value={urlRuleValue}
                          onChange={(e) => setUrlRuleValue(e.target.value)}
                          placeholder={urlRuleType === 'exact' ? 'https://example.com/page' : 'https://example.com/*'}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    {/* CSS Selector */}
                    <div>
                      <Label className="text-xs text-muted-foreground">CSS Selector</Label>
                      <Input
                        value={targetSelector}
                        onChange={(e) => setTargetSelector(e.target.value)}
                        className="mt-1.5 font-mono text-sm"
                        placeholder={'#login-form, .help-button, [data-help="login"]'}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        The DOM element where the bubble button will appear
                      </p>
                    </div>

                    {/* Add Button */}
                    <Button
                      onClick={handleCreateTarget}
                      disabled={creatingTarget || !selectedWalkthrough || !selectedStep || !urlRuleValue || !targetSelector}
                      className="w-full"
                    >
                      {creatingTarget ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Add Target
                    </Button>
                  </div>

                  {/* Existing Targets List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Existing Targets ({extensionTargets.length})</h4>
                    {loadingTargets ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Loading targets...</div>
                    ) : extensionTargets.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                        No targets configured yet. Add one above.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {extensionTargets.map((target) => {
                          const walkthrough = adminWalkthroughs.find((wt) => wt.walkthrough_id === target.walkthrough_id);
                          const step = walkthrough?.steps?.find((s) => s.id === target.step_id);
                          return (
                            <div
                              key={target.id}
                              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {walkthrough?.title || target.walkthrough_id}
                                  {step && <span className="text-muted-foreground"> → {step.title}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {target.url_rule?.type}: {target.url_rule?.value}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                                  {target.selector}
                                </p>
                                <Badge variant={target.status === 'active' ? 'success' : 'secondary'} className="mt-1.5">
                                  {target.status}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTarget(target.id)}
                                className="text-destructive hover:text-destructive shrink-0 ml-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button at Bottom */}
          <div className="glass rounded-xl p-6 border-t-2 border-primary/20">
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setLogoUrl(workspace?.logo || '');
                  setPortalBackgroundUrl(workspace?.portal_background_url || '');
                  setPortalPalette(workspace?.portal_palette || { primary: '#4f46e5', secondary: '#8b5cf6', accent: '#10b981' });
                  setPortalLinks(workspace?.portal_links || []);
                  setPortalPhone(workspace?.portal_phone || '');
                  setPortalWorkingHours(workspace?.portal_working_hours || '');
                  setPortalWhatsapp(workspace?.portal_whatsapp || '');
                  setBrandColor(workspace?.brand_color || '#4f46e5');
                  setName(workspace?.name || '');
                }}
              >
                {t('settings.reset')}
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="save-settings-button">
                <Save className="w-4 h-4 mr-2" />
                {t('settings.saveChanges')}
              </Button>
            </div>
          </div>
          </div>
          </div>

          {/* Quota Sidebar */}
          <div className="lg:col-span-1">
            <QuotaDisplay workspaceId={workspaceId} showWarnings={true} onUpgrade={() => setUpgradePromptOpen(true)} />
          </div>
        </div>
      </PageSurface>
    </DashboardLayout>
  );
};

export default SettingsPage;