import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await api.createCategory(workspaceId, {
        name: newCategoryName,
        description: newCategoryDesc
      });
      setCategories([...categories, response.data]);
      setDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
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
            <p className="text-slate-600 mt-1">Organize your walkthroughs into categories</p>
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
                <Button type="submit" className="w-full" data-testid="create-category-submit">
                  Create Category
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {categories.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all"
                data-testid={`category-card-${category.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                      {category.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {category.description || 'No description'}
                    </p>
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