import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, FolderOpen, BarChart3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';

const DashboardPage = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState('#4f46e5');
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

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const response = await api.createWorkspace({
        name: newWorkspaceName,
        brand_color: newWorkspaceColor
      });
      toast.success('Workspace created!');
      setWorkspaces([...workspaces, response.data]);
      setCreateDialogOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceColor('#4f46e5');
    } catch (error) {
      toast.error('Failed to create workspace');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold text-slate-900">Welcome, {user?.name}</h1>
            <p className="text-slate-600 mt-1">Manage your workspaces and walkthroughs</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="create-workspace-button">
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace Name</Label>
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
              onClick={() => navigate(`/workspace/${workspace.id}/walkthroughs`)}
              data-testid={`workspace-card-${workspace.id}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
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
                    navigate(`/workspace/${workspace.id}/walkthroughs`);
                  }}
                  data-testid={`workspace-walkthroughs-${workspace.id}`}
                >
                  <BookOpen className="w-4 h-4 mb-1" />
                  <span className="text-xs">Guides</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col h-auto py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workspace/${workspace.id}/categories`);
                  }}
                  data-testid={`workspace-categories-${workspace.id}`}
                >
                  <FolderOpen className="w-4 h-4 mb-1" />
                  <span className="text-xs">Categories</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-col h-auto py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/workspace/${workspace.id}/settings`);
                  }}
                  data-testid={`workspace-settings-${workspace.id}`}
                >
                  <Settings className="w-4 h-4 mb-1" />
                  <span className="text-xs">Settings</span>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {workspaces.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
              No workspaces yet
            </h3>
            <p className="text-slate-600 mb-6">Create your first workspace to get started</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="empty-create-workspace-button">
              <Plus className="w-4 h-4 mr-2" />
              Create Workspace
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;