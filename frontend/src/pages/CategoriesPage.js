import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, FolderOpen, Edit, Trash2, ChevronRight, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrlsInObject } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { PageHeader, PageSurface, Card } from '../components/ui/design-system';
import { CardContent } from '@/components/ui/card';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const CategoriesPage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Resolve workspace slug to ID
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState(undefined);
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [newCategoryNotebooklmUrl, setNewCategoryNotebooklmUrl] = useState('');
  const [creatingForParent, setCreatingForParent] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDesc, setEditCategoryDesc] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');
  const [editCategoryNotebooklmUrl, setEditCategoryNotebooklmUrl] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [workspaceId]);

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

  const fetchCategories = async () => {
    if (!workspaceId) return; // Wait for workspace ID to be resolved
    try {
      const response = await api.getCategories(workspaceId);
      setCategories(normalizeImageUrlsInObject(response.data));
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Organize categories into tree structure
  const categoryTree = useMemo(() => {
    // Filter out any null/undefined categories and ensure parent_id is properly handled
    const validCategories = categories.filter(c => c && c.id);
    const parents = validCategories.filter(c => !c.parent_id || c.parent_id === null || c.parent_id === '');
    return parents.map(parent => ({
      ...parent,
      children: validCategories.filter(c => c.parent_id === parent.id)
    }));
  }, [categories]);

  const parentCategories = useMemo(() => {
    const validCategories = categories.filter(c => c && c.id);
    return validCategories.filter(c => !c.parent_id || c.parent_id === null || c.parent_id === '');
  }, [categories]);

  const handleIconUpload = async (file, isEdit = false) => {
    try {
      const response = await api.uploadFile(file);
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      // If URL is already absolute (starts with http:// or https://), use it directly
      // Otherwise, prepend API_BASE for local storage fallback
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${API_BASE.replace(/\/$/, '')}${uploadedUrl}`;
      if (isEdit) {
        setEditCategoryIcon(fullUrl);
      } else {
        setNewCategoryIcon(fullUrl);
      }
      toast.success('Icon uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      const parentId = creatingForParent || (newCategoryParent && newCategoryParent !== 'none' ? newCategoryParent : null);
      const response = await api.createCategory(workspaceId, {
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || null,
        parent_id: parentId,
        icon_url: newCategoryIcon || null,
        notebooklm_url: newCategoryNotebooklmUrl.trim() || null
      });
      // Refresh categories to ensure tree structure is correct
      await fetchCategories();
      setDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryParent(undefined);
      setNewCategoryIcon('');
      setNewCategoryNotebooklmUrl('');
      setCreatingForParent(null);
      toast.success(parentId ? 'Sub-category created!' : 'Category created!');
    } catch (error) {
      console.error('Create category error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create category');
    }
  };

  const openEditDialog = (category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryDesc(category.description || '');
    setEditCategoryIcon(category.icon_url || '');
    setEditCategoryNotebooklmUrl(category.notebooklm_url || '');
    setEditDialogOpen(true);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    if (!editCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      const response = await api.updateCategory(workspaceId, editingCategory.id, {
        name: editCategoryName.trim(),
        description: editCategoryDesc.trim() || null,
        icon_url: editCategoryIcon || null,
        notebooklm_url: editCategoryNotebooklmUrl.trim() || null
      });
      // Refresh categories to ensure consistency
      await fetchCategories();
      setEditDialogOpen(false);
      setEditingCategory(null);
      setEditCategoryName('');
      setEditCategoryDesc('');
      setEditCategoryIcon('');
      setEditCategoryNotebooklmUrl('');
      toast.success('Category updated!');
    } catch (error) {
      console.error('Update category error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    const hasChildren = categories.some(c => c.parent_id === categoryId);
    const message = hasChildren
      ? `Delete "${categoryName}" and all its sub-categories? Walkthroughs will become uncategorized.`
      : `Delete "${categoryName}"? Walkthroughs will become uncategorized.`;
    
    if (window.confirm(message)) {
      try {
        await api.deleteCategory(workspaceId, categoryId);
        // Refresh categories to ensure consistency
        await fetchCategories();
        toast.success('Category deleted. Walkthroughs are now uncategorized.');
      } catch (error) {
        console.error('Delete category error:', error);
        toast.error(error.response?.data?.detail || 'Failed to delete category');
      }
    }
  };

  const openCreateSubCategory = (parentId, parentName) => {
    setCreatingForParent(parentId);
    setNewCategoryParent(undefined); // Clear parent selection since we're creating for a specific parent
    setNewCategoryName('');
    setNewCategoryDesc('');
    setNewCategoryIcon('');
    setDialogOpen(true);
  };

  if (loading || workspaceLoading || !workspaceId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={t('workspace.categories')}
        description={t('category.organizeWalkthroughs')}
        actions={
          <Button onClick={() => setDialogOpen(true)} data-testid="create-category-button">
            <Plus className="w-4 h-4 mr-2" />
            {t('category.newCategory')}
          </Button>
        }
      />

      <PageSurface>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setCreatingForParent(null);
            setNewCategoryParent(undefined);
            setNewCategoryName('');
            setNewCategoryDesc('');
            setNewCategoryIcon('');
            setNewCategoryNotebooklmUrl('');
          }
        }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto z-[9999]">
              <DialogHeader>
                <DialogTitle>
                  {creatingForParent
                    ? `${t('category.creatingSubcategory')} "${categories.find(c => c.id === creatingForParent)?.name || ''}"`
                    : t('category.create')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="category-name">{t('category.name')}</Label>
                  <Input
                    id="category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={t('category.gettingStarted', 'Getting Started')}
                    required
                    data-testid="category-name-input"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="category-desc">{t('category.description')}</Label>
                  <Textarea
                    id="category-desc"
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder={t('category.guidesForNewUsers', 'Guides for new users')}
                    rows={3}
                    data-testid="category-description-input"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="category-icon">{t('category.icon')}</Label>
                  <div className="space-y-2 mt-1.5">
                    {newCategoryIcon ? (
                      <div className="flex items-center gap-2">
                        <img src={newCategoryIcon} alt="Icon" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewCategoryIcon('')}
                          className="h-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={newCategoryIcon}
                        onChange={(e) => setNewCategoryIcon(e.target.value)}
                        placeholder={t('category.iconUrl', 'Icon/Photo URL')}
                        className="h-9"
                        data-testid="category-icon-url-input"
                      />
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIconUpload(file, false);
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
                {!creatingForParent && (
                  <div>
                    <Label htmlFor="category-parent">{t('category.parentCategory')}</Label>
                    <Select 
                      value={newCategoryParent || 'none'} 
                      onValueChange={(value) => setNewCategoryParent(value === 'none' ? undefined : value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="category-parent-select">
                        <SelectValue placeholder={t('category.noneTopLevel', 'None (Top-level category)')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('category.noneTopLevel')}</SelectItem>
                        {parentCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {t('category.selectParentHint', t('category.selectParent'))}
                    </p>
                  </div>
                )}
                {creatingForParent && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{t('category.creatingSubcategory')}</span>{' '}
                      {categories.find(c => c.id === creatingForParent)?.name}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatingForParent(null);
                        setNewCategoryParent(undefined);
                      }}
                      className="mt-2 text-xs"
                    >
                      {t('category.changeToTopLevel')}
                    </Button>
                  </div>
                )}
                <div>
                  <Label htmlFor="category-notebooklm-url">{t('category.notebooklmUrl')}</Label>
                  <Input
                    id="category-notebooklm-url"
                    type="url"
                    value={newCategoryNotebooklmUrl}
                    onChange={(e) => setNewCategoryNotebooklmUrl(e.target.value)}
                    placeholder={t('category.notebooklmExample', 'https://notebooklm.google.com/notebook/...')}
                    className="mt-1.5"
                    data-testid="category-notebooklm-url-input"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    {t('category.notebooklmDescription')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {creatingForParent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        setCreatingForParent(null);
                        setNewCategoryParent(undefined);
                        setNewCategoryName('');
                        setNewCategoryDesc('');
                        setNewCategoryIcon('');
                      }}
                      className="flex-1"
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                  <Button type="submit" className={creatingForParent ? "flex-1" : "w-full"} data-testid="create-category-submit">
                    {creatingForParent ? t('category.createSubcategory') : t('category.create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

        {categoryTree.length > 0 ? (
          <div className="space-y-6">
            {categoryTree.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                data-testid={`category-card-${category.id}`}
              >
                <Card className="relative overflow-hidden border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
                  {/* Animated background effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  <CardContent className="relative p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        {category.icon_url ? (
                          <img
                            src={category.icon_url}
                            alt={category.name}
                            className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-white text-xl shadow-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-white text-xl shadow-lg">
                            <FolderOpen className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors mb-1">
                            {category.name}
                          </h3>
                          <p className="text-slate-300 text-sm leading-relaxed">
                            {category.description || 'No description'}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm font-medium text-green-400">
                        Active
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-slate-400">Sub-categories:</span>
                      <span className="text-white font-medium">{category.children.length}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                        onClick={() => openCreateSubCategory(category.id, category.name)}
                        data-testid={`create-subcategory-${category.id}`}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Sub-category
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                        data-testid={`edit-category-${category.id}`}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                        data-testid={`delete-category-${category.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>

                    {/* Sub-categories */}
                    {category.children.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 mt-4 pt-4 border-t border-white/20"
                      >
                        <div className="text-sm font-medium text-slate-300 mb-2">Sub-categories:</div>
                        <div className="grid grid-cols-1 gap-2">
                          {category.children.map((subCat) => (
                            <div
                              key={subCat.id}
                              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg group/sub"
                            >
                              <div className="flex items-center gap-3">
                                {subCat.icon_url ? (
                                  <img
                                    src={subCat.icon_url}
                                    alt={subCat.name}
                                    className="w-6 h-6 rounded-lg object-cover"
                                  />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <div>
                                  <div className="text-sm font-medium text-white">{subCat.name}</div>
                                  {subCat.description && (
                                    <div className="text-xs text-slate-400 truncate">{subCat.description}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-hover/sub:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(subCat)}
                                  data-testid={`edit-subcategory-${subCat.id}`}
                                  className="h-6 w-6 p-0 text-white hover:text-slate-300"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteCategory(subCat.id, subCat.name)}
                                  data-testid={`delete-subcategory-${subCat.id}`}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-white mb-2">
              {t('category.noCategories')}
            </h3>
            <p className="text-slate-600 mb-6">{t('category.createFirst')}</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="empty-create-category-button">
              <Plus className="w-4 h-4 mr-2" />
              {t('category.create')}
            </Button>
          </div>
        )}

        {/* Edit Category Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto z-[9999]">
            <DialogHeader>
              <DialogTitle>{t('category.edit')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateCategory} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-category-name">Name</Label>
                <Input
                  id="edit-category-name"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  placeholder="Category name"
                  required
                  data-testid="edit-category-name-input"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-category-desc">Description</Label>
                <Textarea
                  id="edit-category-desc"
                  value={editCategoryDesc}
                  onChange={(e) => setEditCategoryDesc(e.target.value)}
                  placeholder="Category description"
                  rows={3}
                  data-testid="edit-category-description-input"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-category-icon">{t('category.icon')}</Label>
                <div className="space-y-2 mt-1.5">
                  {editCategoryIcon ? (
                    <div className="flex items-center gap-2">
                      <img src={editCategoryIcon} alt="Icon" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditCategoryIcon('')}
                        className="h-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      value={editCategoryIcon}
                      onChange={(e) => setEditCategoryIcon(e.target.value)}
                      placeholder="Icon/Photo URL"
                      className="h-9"
                      data-testid="edit-category-icon-url-input"
                    />
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleIconUpload(file, true);
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
                <Label htmlFor="edit-category-notebooklm-url">{t('category.notebooklmUrl')}</Label>
                <Input
                  id="edit-category-notebooklm-url"
                  type="url"
                  value={editCategoryNotebooklmUrl}
                  onChange={(e) => setEditCategoryNotebooklmUrl(e.target.value)}
                  placeholder="https://notebooklm.google.com/notebook/..."
                  className="mt-1.5"
                  data-testid="edit-category-notebooklm-url-input"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Add a link to a Google NotebookLM or Gemini Chat notebook for this category
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingCategory(null);
                    setEditCategoryName('');
                    setEditCategoryDesc('');
                    setEditCategoryIcon('');
                    setEditCategoryNotebooklmUrl('');
                  }}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1" data-testid="update-category-submit">
                  {t('category.update', { defaultValue: 'Update Category' })}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageSurface>
    </DashboardLayout>
  );
};

export default CategoriesPage;
