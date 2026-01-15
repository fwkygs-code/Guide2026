import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

const WalkthroughsPage = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const [wtResponse, wsResponse] = await Promise.all([
        api.getWalkthroughs(workspaceId),
        api.getWorkspace(workspaceId)
      ]);
      setWalkthroughs(wtResponse.data);
      setWorkspace(wsResponse.data);
    } catch (error) {
      toast.error('Failed to load walkthroughs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (walkthroughId) => {
    if (window.confirm('Are you sure you want to delete this walkthrough?')) {
      try {
        await api.deleteWalkthrough(workspaceId, walkthroughId);
        setWalkthroughs(walkthroughs.filter(w => w.id !== walkthroughId));
        toast.success('Walkthrough deleted');
      } catch (error) {
        toast.error('Failed to delete walkthrough');
      }
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
            <h1 className="text-3xl font-heading font-bold text-slate-900">
              {workspace?.name} - Walkthroughs
            </h1>
            <p className="text-slate-600 mt-1">Create and manage your interactive guides</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/portal/${workspace?.slug}`)}
              data-testid="view-portal-button"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Portal
            </Button>
            <Button
              onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs/new`)}
              data-testid="create-walkthrough-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Walkthrough
            </Button>
          </div>
        </div>

        {walkthroughs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {walkthroughs.map((walkthrough, index) => (
              <motion.div
                key={walkthrough.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all"
                data-testid={`walkthrough-card-${walkthrough.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                      {walkthrough.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {walkthrough.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={walkthrough.status === 'published' ? 'default' : 'secondary'}>
                    {walkthrough.status}
                  </Badge>
                  <Badge variant="outline">
                    {walkthrough.steps?.length || 0} steps
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs/${walkthrough.id}/edit`)}
                    data-testid={`edit-walkthrough-${walkthrough.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
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
        ) : (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
              No walkthroughs yet
            </h3>
            <p className="text-slate-600 mb-6">Create your first walkthrough to get started</p>
            <Button onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs/new`)} data-testid="empty-create-walkthrough-button">
              <Plus className="w-4 h-4 mr-2" />
              Create Walkthrough
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WalkthroughsPage;