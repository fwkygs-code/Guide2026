import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Edit, Trash2, ChevronRight, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const CategoriesPage = () => {
  const { workspaceId } = useParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [creatingForParent, setCreatingForParent] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDesc, setEditCategoryDesc] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [workspaceId]);

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories(workspaceId);
      setCategories(response.data);
    } catch (error) {
      toast.error('Failed to load categories');
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

  const parentCategories = categories.filter(c => !c.parent_id);

  const handleIconUpload = async (file, isEdit = false) => {
    try {
      const response = await api.uploadFile(file);
      const fullUrl = `${API_BASE.replace(/\/$/, '')}${response.data.url}`;
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
    try {
      const parentId = creatingForParent || newCategoryParent || null;
      const response = await api.createCategory(workspaceId, {
        name: newCategoryName,
        description: newCategoryDesc,
        parent_id: parentId,
        icon_url: newCategoryIcon || null
      });
      setCategories([...categories, response.data]);
      setDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryParent('');
      setNewCategoryIcon('');
      setCreatingForParent(null);
      toast.success(parentId ? 'Sub-category created!' : 'Category created!');
    } catch (error) {
      toast.error('Failed to create category');
    }
  };

  const openEditDialog = (category) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryDesc(category.description || '');
    setEditCategoryIcon(category.icon_url || '');
    setEditDialogOpen(true);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const response = await api.updateCategory(workspaceId, editingCategory.id, {
        name: editCategoryName,
        description: editCategoryDesc,
        icon_url: editCategoryIcon || null
      });
      setCategories(categories.map(c => c.id === editingCategory.id ? response.data : c));
      setEditDialogOpen(false);
      setEditingCategory(null);
      setEditCategoryName('');
      setEditCategoryDesc('');
      setEditCategoryIcon('');
      toast.success('Category updated!');
    } catch (error) {
      toast.error('Failed to update category');
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
        setCategories(categories.filter(c => c.id !== categoryId && c.parent_id !== categoryId));
        toast.success('Category deleted. Walkthroughs are now uncategorized.');
      } catch (error) {
        toast.error('Failed to delete category');
      }
    }
  };

  const openCreateSubCategory = (parentId, parentName) => {
    setCreatingForParent(parentId);
    setNewCategoryParent(parentId);
    setNewCategoryName('');
    setNewCategoryDesc('');
    setDialogOpen(true);
  };

  if (loading) {
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
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-slate-900">Categories</h1>
            <p className="text-slate-600 mt-1">Organize your walkthroughs into categories and sub-categories</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setCreatingForParent(null);
              setNewCategoryParent('');
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="create-category-button">
                <Plus className="w-4 h-4 mr-2" />
                New Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {creatingForParent 
                    ? `Create Sub-category under "${categories.find(c => c.id === creatingForParent)?.name || ''}"`
                    : 'Create Category'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="category-name">Name</Label>
                  <Input
                    id="category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Getting Started"
                    required
                    data-testid="category-name-input"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="category-desc">Description</Label>
                  <Textarea
                    id="category-desc"
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder="Guides for new users"
                    rows={3}
                    data-testid="category-description-input"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="category-icon">Icon/Photo (Optional)</Label>
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
                        placeholder="Icon/Photo URL"
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
                    <Label htmlFor="category-parent">Parent Category (Optional)</Label>
                    <Select value={newCategoryParent} onValueChange={setNewCategoryParent}>
                      <SelectTrigger className="mt-1.5" data-testid="category-parent-select">
                        <SelectValue placeholder="None (Top-level category)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (Top-level category)</SelectItem>
                        {parentCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Select a parent to create a sub-category, or leave empty for a top-level category
                    </p>
                  </div>
                )}
                {creatingForParent && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Creating sub-category under:</span>{' '}
                      {categories.find(c => c.id === creatingForParent)?.name}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatingForParent(null);
                        setNewCategoryParent('');
                      }}
                      className="mt-2 text-xs"
                    >
                      Change to top-level category
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  {creatingForParent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        setCreatingForParent(null);
                        setNewCategoryParent('');
                        setNewCategoryName('');
                        setNewCategoryDesc('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" className={creatingForParent ? "flex-1" : "w-full"} data-testid="create-category-submit">
                    {creatingForParent ? 'Create Sub-category' : 'Create Category'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {categoryTree.length > 0 ? (
          <div className="space-y-6">
            {categoryTree.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all"
                data-testid={`category-card-${category.id}`}
              >
                <div className="flex items-start gap-4">
                  {category.icon_url ? (
                    <img
                      src={category.icon_url}
                      alt={category.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-heading font-semibold text-slate-900">
                        {category.name}
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(category)}
                          data-testid={`edit-category-${category.id}`}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          data-testid={`delete-category-${category.id}`}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {category.description || 'No description'}
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-500">
                          {category.children.length > 0 ? 'Sub-categories:' : 'No sub-categories yet'}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCreateSubCategory(category.id, category.name)}
                          className="h-7 text-xs"
                          data-testid={`create-subcategory-${category.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Sub-category
                        </Button>
                      </div>
                      {category.children.length > 0 && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {category.children.map((subCat) => (
                            <div
                              key={subCat.id}
                              className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 group"
                            >
                              {subCat.icon_url ? (
                                <img
                                  src={subCat.icon_url}
                                  alt={subCat.name}
                                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900">{subCat.name}</div>
                                {subCat.description && (
                                  <div className="text-xs text-slate-600 truncate">{subCat.description}</div>
                                )}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(subCat)}
                                  data-testid={`edit-subcategory-${subCat.id}`}
                                  className="h-6 w-6 p-0"
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
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
              No categories yet
            </h3>
            <p className="text-slate-600 mb-6">Create categories to organize your walkthroughs</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="empty-create-category-button">
              <Plus className="w-4 h-4 mr-2" />
              Create Category
            </Button>
          </div>
        )}

        {/* Edit Category Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
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
                <Label htmlFor="edit-category-icon">Icon/Photo (Optional)</Label>
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
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" data-testid="update-category-submit">
                  Update Category
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CategoriesPage;
