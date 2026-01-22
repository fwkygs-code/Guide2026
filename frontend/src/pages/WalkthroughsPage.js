import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Edit, Trash2, Eye, FolderOpen, ChevronRight, Archive, Share2, Code, Copy, Settings, Upload, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrlsInObject, normalizeImageUrl } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import { useQuota } from '../hooks/useQuota';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Surface, Card, Button, Badge, Panel } from '../components/ui/design-system';

const WalkthroughsPage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
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
    category_ids: []
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);

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
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
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
      toast.error('Failed to load walkthroughs');
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
      description: walkthrough.description || '',
      icon_url: walkthrough.icon_url || '',
      category_ids: walkthrough.category_ids || []
    });
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!editingWalkthrough || !editSettings.title?.trim()) {
      toast.error('Please enter a walkthrough name');
      return;
    }

    try {
      await api.updateWalkthrough(workspaceId, editingWalkthrough.id, {
        title: editSettings.title.trim(),
        slug: editSettings.slug?.trim() || null,
        description: editSettings.description || '',
        category_ids: editSettings.category_ids || [],
        icon_url: editSettings.icon_url || null
      });
      
      // Update local state (refresh from server to get updated slug)
      const updatedResponse = await api.getWalkthrough(workspaceId, editingWalkthrough.id);
      setWalkthroughs(walkthroughs.map(w => 
        w.id === editingWalkthrough.id 
          ? { ...w, ...updatedResponse.data }
          : w
      ));
      
      setSettingsDialogOpen(false);
      setEditingWalkthrough(null);
      toast.success('Settings updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update settings');
    }
  };

  const handleSettingsIconUpload = async (file) => {
    try {
      setUploadingIcon(true);
      
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
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
        toast.error(`Upload not completed (status: ${response.data.status}). Please try again.`);
        return;
      }
      
      if (!response.data.url) {
        toast.error('Upload succeeded but no URL returned.');
        return;
      }
      
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : normalizeImageUrl(uploadedUrl);
      
      setEditSettings(prev => ({ ...prev, icon_url: fullUrl }));
      toast.success('Icon uploaded!');
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
    }
  };

  if (loading || !workspaceId) {
    return (
      <DashboardLayout>
        <Surface variant="glass" className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </Surface>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.backToWorkspace', 'Back to Workspace')}
            </Button>
            <div>
              <Surface variant="floating" className="inline-block px-6 py-3">
                <h1 className="text-3xl font-heading font-bold text-white">
                  {workspace?.name} - {t('workspace.walkthroughs')}
                </h1>
                <p className="text-slate-400 mt-1">{t('walkthrough.createAndManage')}</p>
              </Surface>
            </div>
          </div>
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
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('walkthrough.new')}
            </Button>
          </div>
        </div>

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
                      className="flex items-center gap-3 group"
                    >
                      <ChevronRight
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                          expandedCategories.has(category.id) ? 'rotate-90' : ''
                        }`}
                      />
                      <FolderOpen className="w-6 h-6 text-primary" />
                      <div className="text-left">
                        <h2 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors">
                          {category.name}
                        </h2>
                        {category.description && (
                          <p className="text-sm text-slate-400 mt-1">{category.description}</p>
                        )}
                        {category.children.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {category.children.map(subCat => (
                              <Badge key={subCat.id} variant="secondary" className="text-xs">
                                {subCat.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="mb-6">
                    <h2 className="text-2xl font-heading font-bold text-white inline-block group-hover:text-primary transition-colors">{t('walkthrough.uncategorized')}</h2>
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
                        className="rounded-xl p-6 transition-all relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700"
                        data-testid={`walkthrough-card-${walkthrough.id}`}
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

                        <div className="flex items-start gap-3 mb-4">
                          {walkthrough.icon_url ? (
                            <img
                              src={normalizeImageUrl(walkthrough.icon_url)}
                              alt={walkthrough.title}
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                              onError={(e) => {
                                console.error('Failed to load icon:', walkthrough.icon_url);
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-heading font-semibold text-white mb-1">
                              {walkthrough.title}
                            </h3>
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {walkthrough.description || t('walkthrough.noDescription')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant={walkthrough.status === 'published' ? 'default' : 'secondary'}>
                            {walkthrough.status === 'published' ? t('builder.status.published') : t('builder.status.draft')}
                          </Badge>
                          <Badge variant="outline">
                            {walkthrough.steps?.length || 0} {t('walkthrough.steps').toLowerCase()}
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSettings(walkthrough)}
                            title="Edit Settings"
                            className="px-2"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs/${walkthrough.id}/edit`)}
                            data-testid={`edit-walkthrough-${walkthrough.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            {t('common.edit')}
                          </Button>
                          <WalkthroughShareButton 
                            walkthrough={walkthrough} 
                            workspaceSlug={workspace?.slug}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(walkthrough.id)}
                            data-testid={`delete-walkthrough-${walkthrough.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
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
            <Button onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs/new`)} data-testid="empty-create-walkthrough-button">
              <Plus className="w-4 h-4 mr-2" />
              {t('walkthrough.createWalkthrough')}
            </Button>
          </div>
        )}

        {/* Settings Edit Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Walkthrough Settings</DialogTitle>
              <DialogDescription>
                Update walkthrough name, description, icon, and categories
              </DialogDescription>
            </DialogHeader>

            {editingWalkthrough && (
              <div className="space-y-6 mt-4">
                {/* Walkthrough Name */}
                <div>
                  <Label htmlFor="edit-title" className="text-sm font-medium text-slate-900 mb-2 block">
                    Walkthrough Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={editSettings.title}
                    onChange={(e) => setEditSettings(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter walkthrough name"
                    className="w-full"
                  />
                </div>

                {/* URL Slug */}
                <div>
                  <Label htmlFor="edit-slug" className="text-sm font-medium text-slate-900 mb-2 block">
                    URL Name (Optional)
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
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Custom name for the walkthrough URL. Leave empty to use the walkthrough ID.
                      {editSettings.slug && workspace?.slug && (
                        <span className="block mt-1 font-mono text-primary break-all">
                          URL: {window.location.origin}/portal/{workspace.slug}/{editSettings.slug}
                        </span>
                      )}
                      {!editSettings.slug && editingWalkthrough && (
                        <span className="block mt-1 font-mono text-slate-400 text-xs">
                          Current URL: {window.location.origin}/portal/{workspace?.slug}/{editingWalkthrough.id}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="edit-description" className="text-sm font-medium text-slate-900 mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editSettings.description}
                    onChange={(e) => setEditSettings(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter description (optional)"
                    rows={3}
                    className="w-full"
                  />
                </div>

                {/* Icon/Photo */}
                <div>
                  <Label className="text-sm font-medium text-slate-900 mb-2 block">
                    Icon/Photo <span className="text-slate-500 font-normal">(Optional)</span>
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
                      <p className="text-sm text-slate-500">or</p>
                      <Input
                        placeholder="Enter image URL"
                        value={editSettings.icon_url}
                        onChange={(e) => setEditSettings(prev => ({ ...prev, icon_url: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-sm font-medium text-slate-900 mb-2 block">
                    Categories
                  </Label>
                  {parentCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">No categories available. Create categories in the Categories page.</p>
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
                    variant="outline"
                    onClick={() => {
                      setSettingsDialogOpen(false);
                      setEditingWalkthrough(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={!editSettings.title?.trim() || uploadingIcon}
                    className="flex-1"
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Share Button Component for Walkthroughs
const WalkthroughShareButton = ({ walkthrough, workspaceSlug }) => {
  const { t } = useTranslation();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // Use backend URL for sharing (WhatsApp crawlers need backend route)
  const getBackendUrl = () => {
    const apiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;
    if (apiUrl) {
      return apiUrl.replace(/\/api$/, '').replace(/\/$/, '');
    }
    return 'https://guide2026-backend.onrender.com';
  };
  // Use slug if available, otherwise fall back to ID
  const walkthroughIdentifier = walkthrough.slug || walkthrough.id;
  const walkthroughUrl = `${getBackendUrl()}/portal/${workspaceSlug}/${walkthroughIdentifier}`;
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
              <div className="mt-3 p-3 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/50">
                <p className="text-xs text-gray-600 mb-2">{t('walkthrough.preview')}</p>
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

export default WalkthroughsPage;
