import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Edit, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

const CategoriesPage = () => {
  const { workspaceId } = useParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState('');

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

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await api.createCategory(workspaceId, {
        name: newCategoryName,
        description: newCategoryDesc,
        parent_id: newCategoryParent || null
      });
      setCategories([...categories, response.data]);
      setDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryParent('');
      toast.success('Category created!');
    } catch (error) {
      toast.error('Failed to create category');
    }
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-category-button">
                <Plus className="w-4 h-4 mr-2" />
                New Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Category</DialogTitle>
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
                    Select a parent to create a sub-category
                  </p>
                </div>
                <Button type="submit" className="w-full" data-testid="create-category-submit">
                  Create Category
                </Button>
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
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                      {category.name}
                    </h3>
                    <p className="text-sm text-slate-600 mb-3">
                      {category.description || 'No description'}
                    </p>
                    {category.children.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-medium text-slate-500 mb-2">Sub-categories:</div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {category.children.map((subCat) => (
                            <div
                              key={subCat.id}
                              className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900">{subCat.name}</div>
                                {subCat.description && (
                                  <div className="text-xs text-slate-600 truncate">{subCat.description}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
      </div>
    </DashboardLayout>
  );
};

export default CategoriesPage;
