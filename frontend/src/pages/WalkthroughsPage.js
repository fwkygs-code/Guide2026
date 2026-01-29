import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Edit, Trash2, Eye, FolderOpen, ChevronRight, Archive, Share2, Code, Copy, Settings, Upload, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api, getBackendUrl, getPublicPortalUrl } from '../lib/api';
import { normalizeImageUrlsInObject, normalizeImageUrl } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import { useQuota } from '../hooks/useQuota';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AppShell, PageHeader, PageSurface, Surface, Card, Button, Badge, CardContent } from '../components/ui/design-system';
import WorkspaceLoadingOverlay from '../components/WorkspaceLoadingOverlay';

const WalkthroughsPage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingWalkthrough, setEditingWalkthrough] = useState(null);
  const [editSettings, setEditSettings] = useState({
    title: '',
    slug: '',
    description: '',
    icon_url: '',
    category_ids: [],
    enable_stuck_button: false
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [showWorkspaceOverlay, setShowWorkspaceOverlay] = useState(!!location.state?.workspaceTransition);

  useEffect(() => {
    fetchData();
  }, [workspaceSlug]);

  // Acquire workspace lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          // If locked, redirect back to dashboard
          toast.error(t('toast.workspaceLocked', { user: lockResult.locked_by }));
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Failed to acquire workspace lock:', error);
        // Don't block access if lock check fails, but log it
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

  const fetchData = async () => {
    try {
      // First get workspace by slug to get the ID
      const wsResponse = await api.getWorkspace(workspaceSlug);
      const workspaceData = wsResponse.data;
      setWorkspace(workspaceData);
      setWorkspaceId(workspaceData.id);
      
      // Now fetch data using the actual workspace ID
      const [wtResponse, catResponse] = await Promise.all([
        api.getWalkthroughs(workspaceData.id),
        api.getCategories(workspaceData.id)
      ]);
      // Normalize image URLs
      setWalkthroughs(normalizeImageUrlsInObject(wtResponse.data));
      setCategories(normalizeImageUrlsInObject(catResponse.data));
      // Expand all categories by default
      const allCategoryIds = new Set(catResponse.data.map(c => c.id));
      setExpandedCategories(allCategoryIds);
    } catch (error) {
      toast.error(t('toast.failedToLoadWalkthroughs'));
    } finally {
      setLoading(false);
    }
  };

  // Organize categories into tree structure
  const categoryTree = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    return parents.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parent_id === parent.id)
    }));
  }, [categories]);

  // Helper function to get category names for a walkthrough
  const getWalkthroughCategoryNames = (walkthrough) => {
    if (!walkthrough.category_ids || walkthrough.category_ids.length === 0) {
      return [t('walkthrough.uncategorized')];
    }
    const categoryNames = walkthrough.category_ids
      .map(catId => {
        const cat = categories.find(c => c.id === catId);
        return cat ? cat.name : null;
      })
      .filter(Boolean);
    return categoryNames.length > 0 ? categoryNames : [t('walkthrough.uncategorized')];
  };

  // Group walkthroughs by category
  const walkthroughsByCategory = useMemo(() => {
    const grouped = {};
    categoryTree.forEach(cat => {
      const catIds = [cat.id, ...cat.children.map(c => c.id)];
      const items = walkthroughs.filter(wt => 
        wt.category_ids?.some(id => catIds.includes(id))
      );
      if (items.length > 0) {
        grouped[cat.id] = { category: cat, walkthroughs: items };
      }
    });
    // Uncategorized
    const uncategorized = walkthroughs.filter(wt => 
      !wt.category_ids || wt.category_ids.length === 0
    );
    if (uncategorized.length > 0) {
      grouped['_uncategorized'] = { category: null, walkthroughs: uncategorized };
    }
    return grouped;
  }, [categoryTree, walkthroughs]);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDelete = async (walkthroughId) => {
    if (window.confirm(t('walkthrough.moveToArchive'))) {
      try {
        await api.archiveWalkthrough(workspaceId, walkthroughId);
        setWalkthroughs(walkthroughs.filter(w => w.id !== walkthroughId));
        toast.success(t('walkthrough.movedToArchive'));
      } catch (error) {
        toast.error(t('archive.failedToLoad'));
      }
    }
  };

  const { canUploadFile } = useQuota(workspaceId);
  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  const handleOpenSettings = (walkthrough) => {
    setEditingWalkthrough(walkthrough);
    setEditSettings({
      title: walkthrough.title || '',
      slug: walkthrough.slug || '',
      description: walkthrough.description || '',
      icon_url: walkthrough.icon_url || '',
      category_ids: walkthrough.category_ids || [],
      enable_stuck_button: !!walkthrough.enable_stuck_button
    });
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!editingWalkthrough || !editSettings.title?.trim()) {
      toast.error(t('toast.enterWalkthroughName'));
      return;
    }

    try {
      const updateData = {
        title: editSettings.title.trim(),
        description: editSettings.description || '',
        category_ids: editSettings.category_ids || [],
        icon_url: editSettings.icon_url || null,
        enable_stuck_button: !!editSettings.enable_stuck_button,
        status: editingWalkthrough.status  // Preserve the current status
      };
      
      // Only include slug if it has a value (not empty or just whitespace)
      if (editSettings.slug?.trim()) {
        updateData.slug = editSettings.slug.trim();
      }
      
      await api.updateWalkthrough(workspaceId, editingWalkthrough.id, updateData);
      
      // Update local state (refresh from server to get updated slug)
      const updatedResponse = await api.getWalkthrough(workspaceId, editingWalkthrough.id);
      setWalkthroughs(walkthroughs.map(w => 
        w.id === editingWalkthrough.id 
          ? { ...w, ...updatedResponse.data }
          : w
      ));
      
      setSettingsDialogOpen(false);
      setEditingWalkthrough(null);
      toast.success(t('toast.settingsUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('toast.failedToUpdateSettings'));
    }
  };

  const handleSettingsIconUpload = async (file) => {
    try {
      setUploadingIcon(true);
      
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || t('toast.quotaExceeded'));
        return;
      }
      
      const idempotencyKey = `walkthrough-icon-${editingWalkthrough.id}-${file.name}-${Date.now()}`;
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'walkthrough_icon',
        referenceId: editingWalkthrough.id
      });
      
      if (response.data.status !== 'active' && response.data.status !== 'existing') {
        toast.error(t('toast.uploadNotCompleted', { status: response.data.status }));
        return;
      }
      
      if (!response.data.url) {
        toast.error(t('toast.uploadNoUrl'));
        return;
      }
      
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : normalizeImageUrl(uploadedUrl);
      
      setEditSettings(prev => ({ ...prev, icon_url: fullUrl }));
      toast.success(t('toast.iconUploaded'));
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.error(error.response?.data?.detail || t('toast.failedToUploadIcon'));
    } finally {
      setUploadingIcon(false);
    }
  };

  const workspaceReady = !loading && !!workspaceId;

  if (loading || !workspaceId) {
    return (
      <>
        <WorkspaceLoadingOverlay
          active={showWorkspaceOverlay}
          ready={workspaceReady}
          onFinish={() => setShowWorkspaceOverlay(false)}
        />
        <DashboardLayout>
          <Surface variant="glass" className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </Surface>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <WorkspaceLoadingOverlay
        active={showWorkspaceOverlay}
        ready={workspaceReady}
        onFinish={() => setShowWorkspaceOverlay(false)}
      />
      <DashboardLayout>
      <PageHeader
        title={`${workspace?.name} - ${t('workspace.walkthroughs')}`}
        description={t('walkthrough.createAndManage')}
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => window.open(`/portal/${workspace?.slug}`, '_blank')}
              data-testid="view-portal-button"
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('walkthrough.viewPortal')}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/workspace/${workspaceSlug}/archive`)}
              data-testid="view-archive-button"
            >
              <Archive className="w-4 h-4 mr-2" />
              {t('workspace.archive')}
            </Button>
            <Button
              onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs/new`)}
              data-testid="create-walkthrough-button"
              data-onboarding="create-walkthrough-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('walkthrough.new')}
            </Button>
          </div>
        }
      />

      <PageSurface>

        {Object.keys(walkthroughsByCategory).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(walkthroughsByCategory).map(([key, { category, walkthroughs: categoryWalkthroughs }], sectionIndex) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIndex * 0.1 }}
              >
                {category ? (
                  <div className="mb-6">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="flex items-center gap-3 group px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600/50 hover:border-slate-500/70 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/20"
                    >
                      <ChevronRight
                        className={`w-5 h-5 text-slate-300 transition-transform duration-200 ${
                          expandedCategories.has(category.id) ? 'rotate-90' : ''
                        }`}
                      />
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                          <FolderOpen className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <h2 className="text-lg font-heading font-bold text-white group-hover:text-primary transition-colors">
                            {category.name}
                          </h2>
                          {category.description && (
                            <p className="text-sm text-slate-300 mt-0.5">{category.description}</p>
                          )}
                          {category.children.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {category.children.map(subCat => (
                                <span key={subCat.id} className="px-2 py-1 text-xs rounded-full bg-slate-600/50 text-slate-200 border border-slate-500/30">
                                  {subCat.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600/50">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-400/10 flex items-center justify-center border border-slate-400/20">
                        <FolderOpen className="w-4 h-4 text-slate-400" />
                      </div>
                      <h2 className="text-lg font-heading font-bold text-white">{t('walkthrough.uncategorized')}</h2>
                    </div>
                  </div>
                )}

                {(!category || expandedCategories.has(category.id)) && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 ml-8">
                    {categoryWalkthroughs.map((walkthrough, index) => (
                      <motion.div
                        key={walkthrough.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (sectionIndex * 0.1) + (index * 0.05) }}
                        className="transition-all relative"
                        data-testid={`walkthrough-card-${walkthrough.id}`}
                        data-onboarding="walkthrough-card"
                        data-onboarding-walkthrough-id={walkthrough.id}
                      >
                        {/* Transparent 3D Bubble with Category and Company Name */}
                        <div
                          className="absolute -top-3 -right-3 z-10 px-3 py-1.5 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 shadow-lg transform hover:scale-105 transition-transform"
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-xs font-semibold text-white leading-tight">
                              {getWalkthroughCategoryNames(walkthrough).join(', ')}
                            </div>
                            <div className="text-[10px] font-medium text-slate-400 leading-tight">
                              {workspace?.name}
                            </div>
                          </div>
                        </div>
                        <Card className="relative overflow-hidden border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
                          {/* Animated background effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                          <CardContent className="relative p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-4">
                                {walkthrough.icon_url ? (
                                  <img
                                    src={normalizeImageUrl(walkthrough.icon_url)}
                                    alt={walkthrough.title}
                                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-white text-xl shadow-lg"
                                    onError={(e) => {
                                      console.error('Failed to load icon:', walkthrough.icon_url);
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-white text-xl shadow-lg">
                                    <BookOpen className="w-6 h-6" />
                                  </div>
                                )}
                                <div>
                                  <h3 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors mb-1">
                                    {walkthrough.title}
                                  </h3>
                                  <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">
                                    {walkthrough.description || t('walkthrough.noDescription')}
                                  </p>
                                </div>
                              </div>

                              <div className={`text-sm font-medium mt-2 ${walkthrough.status === 'published' ? 'text-green-400' : 'text-slate-500'}`}>
                                {walkthrough.status === 'published' ? t('workspace.published') : t('workspace.draft')}
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex justify-between text-sm mb-4">
                              <span className="text-slate-400">{t('workspace.steps')}:</span>
                              <span className="text-white font-medium">{walkthrough.steps?.length || 0}</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenSettings(walkthrough)}
                                title="Edit Settings"
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                {t('common.settings')}
                              </Button>
                              <Button
                                onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs/${walkthrough.id}/edit`)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                                variant="outline"
                                data-testid={`edit-walkthrough-${walkthrough.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                {t('common.edit')}
                              </Button>
                              <WalkthroughShareButton walkthrough={walkthrough} workspaceSlug={workspaceSlug} />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-white mb-2">
              {t('walkthrough.noWalkthroughs')}
            </h3>
            <p className="text-slate-400 mb-6">{t('walkthrough.createFirst')}</p>
            <Button onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs/new`)} data-testid="empty-create-walkthrough-button" data-onboarding="create-walkthrough-button">
              <Plus className="w-4 h-4 mr-2" />
              {t('walkthrough.createWalkthrough')}
            </Button>
          </div>
        )}

        {/* Settings Edit Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto glass z-[9999]">
            <DialogHeader>
              <DialogTitle className="text-white">{t('walkthrough.editSettings')}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {t('walkthrough.editSettingsDescription')}
              </DialogDescription>
            </DialogHeader>

            {editingWalkthrough && (
              <div className="space-y-6 mt-4">
                {/* Walkthrough Name */}
                <div>
                  <Label htmlFor="edit-title" className="text-sm font-medium text-white mb-2 block">
                    {t('walkthrough.name')} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={editSettings.title}
                    onChange={(e) => setEditSettings(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('walkthrough.enterName')}
                    className="w-full text-white"
                  />
                </div>

                {/* URL Slug */}
                <div>
                  <Label htmlFor="edit-slug" className="text-sm font-medium text-white mb-2 block">
                    {t('walkthrough.urlName')}
                  </Label>
                  <div className="space-y-2">
                    <Input
                      id="edit-slug"
                      value={editSettings.slug}
                      onChange={(e) => {
                        // Auto-format: lowercase, replace spaces/underscores with hyphens
                        const value = e.target.value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
                        setEditSettings(prev => ({ ...prev, slug: value }));
                      }}
                      placeholder="custom-url-name"
                      className="w-full text-white"
                    />
                    <p className="text-xs text-slate-400">
                      {t('walkthrough.urlNameDescription')}
                      {editSettings.slug && workspace?.slug && (
                        <span className="block mt-1 font-mono text-primary break-all">
                          URL: {window.location.origin}/portal/{workspace.slug}/{editSettings.slug}
                        </span>
                      )}
                      {!editSettings.slug && editingWalkthrough && (
                        <span className="block mt-1 font-mono text-slate-400 text-xs">
                          {t('walkthrough.currentUrl')}: {window.location.origin}/portal/{workspace?.slug}/{editingWalkthrough.id}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="edit-description" className="text-sm font-medium text-white mb-2 block">
                    {t('common.description')}
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editSettings.description}
                    onChange={(e) => setEditSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('walkthrough.enterDescription')}
                    rows={3}
                    className="w-full text-white"
                  />
                </div>

                {/* Stuck Button */}
                <div className="flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  <Checkbox
                    id="edit-stuck-button"
                    checked={editSettings.enable_stuck_button}
                    onCheckedChange={(checked) =>
                      setEditSettings(prev => ({ ...prev, enable_stuck_button: checked === true }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="edit-stuck-button" className="text-sm font-medium text-white">
                      {t('walkthrough.stuckButtonLabel')}
                    </Label>
                    <p className="text-xs text-slate-400">
                      {t('walkthrough.stuckButtonDescription')}
                    </p>
                  </div>
                </div>

                {/* Icon/Photo */}
                <div>
                  <Label className="text-sm font-medium text-white mb-2 block">
                    {t('walkthrough.iconPhoto')}
                  </Label>
                  {editSettings.icon_url ? (
                    <div className="space-y-2">
                      <img
                        src={normalizeImageUrl(editSettings.icon_url)}
                        alt="Icon preview"
                        className="w-24 h-24 rounded-lg object-cover border border-slate-200"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditSettings(prev => ({ ...prev, icon_url: '' }))}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSettingsIconUpload(file);
                          e.target.value = '';
                        }}
                        disabled={uploadingIcon}
                        className="w-full"
                      />
                      <p className="text-sm text-slate-400">{t('walkthrough.or')}</p>
                      <Input
                        placeholder={t('walkthrough.enterImageUrl')}
                        value={editSettings.icon_url}
                        onChange={(e) => setEditSettings(prev => ({ ...prev, icon_url: e.target.value }))}
                        className="w-full text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-sm font-medium text-white mb-2 block">
                    {t('common.categories')}
                  </Label>
                  {parentCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('walkthrough.noCategories')}</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                      {parentCategories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-cat-${category.id}`}
                            checked={editSettings.category_ids.includes(category.id)}
                            onCheckedChange={(checked) => {
                              setEditSettings(prev => ({
                                ...prev,
                                category_ids: checked
                                  ? [...prev.category_ids, category.id]
                                  : prev.category_ids.filter(id => id !== category.id)
                              }));
                            }}
                          />
                          <Label htmlFor={`edit-cat-${category.id}`} className="text-sm cursor-pointer">
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(t('dialogs.confirm.archiveWalkthrough', { title: editingWalkthrough?.title }))) {
                        handleDelete(editingWalkthrough.id);
                        setSettingsDialogOpen(false);
                        setEditingWalkthrough(null);
                      }
                    }}
                    className="mr-auto"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {t('walkthrough.archiveWalkthrough')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSettingsDialogOpen(false);
                      setEditingWalkthrough(null);
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={!editSettings.title?.trim() || uploadingIcon}
                    className="flex-1"
                  >
                    {t('walkthrough.saveSettings')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageSurface>
      </DashboardLayout>
    </>
  );
};

// Share Button Component for Walkthroughs
const WalkthroughShareButton = ({ walkthrough, workspaceSlug }) => {
  const { t } = useTranslation();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // Use backend URL for sharing (WhatsApp crawlers need backend route)
  // Use slug if available, otherwise fall back to ID
  const walkthroughIdentifier = walkthrough.slug || walkthrough.id;
  const walkthroughUrl = `${getPublicPortalUrl()}/portal/${workspaceSlug}/${walkthroughIdentifier}`;
  const embedUrl = `${window.location.origin}/embed/portal/${workspaceSlug}/${walkthrough.id}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const copyToClipboard = (text, message = t('common.success')) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  if (walkthrough.status !== 'published') {
    return null; // Only show share for published walkthroughs
  }

  return (
    <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`share-walkthrough-${walkthrough.id}`}
        >
          <Share2 className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('walkthrough.shareAndEmbed')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="share" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share">
              <Share2 className="w-4 h-4 mr-2" />
              {t('walkthrough.shareLink')}
            </TabsTrigger>
            <TabsTrigger value="embed">
              <Code className="w-4 h-4 mr-2" />
              {t('walkthrough.embedCode')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-4 mt-4">
            <div>
              <Label>{t('walkthrough.walkthroughLink')}</Label>
              <p className="text-xs text-gray-500 mb-1.5">{t('walkthrough.shareLinkDescription')}</p>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={walkthroughUrl}
                  readOnly
                  className="flex-1 font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(walkthroughUrl, t('walkthrough.linkCopied'))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 mt-4">
            <div>
              <Label>{t('walkthrough.iframeEmbedCode')}</Label>
              <p className="text-xs text-gray-500 mb-1.5">{t('walkthrough.embedCodeDescription')}</p>
              <div className="flex gap-2 mt-1.5">
                <Textarea
                  value={iframeCode}
                  readOnly
                  className="flex-1 font-mono text-xs min-h-[100px]"
                />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(iframeCode, t('walkthrough.embedCodeCopied'))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 p-3 glass rounded-xl">
                <p className="text-xs text-slate-400 mb-2">{t('walkthrough.preview')}</p>
                <iframe 
                  src={embedUrl}
                  className="w-full h-96 border border-gray-200 rounded-lg"
                  title="Walkthrough Preview"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export { WalkthroughShareButton };
export default WalkthroughsPage;
