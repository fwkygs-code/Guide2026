import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Edit, Trash2, Eye, FolderOpen, ChevronRight, Archive, Share2, Code, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrlsInObject, normalizeImageUrl } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const WalkthroughsPage = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const [wtResponse, wsResponse, catResponse] = await Promise.all([
        api.getWalkthroughs(workspaceId),
        api.getWorkspace(workspaceId),
        api.getCategories(workspaceId)
      ]);
      // Normalize image URLs
      setWalkthroughs(normalizeImageUrlsInObject(wtResponse.data));
      setWorkspace(normalizeImageUrlsInObject(wsResponse.data));
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
    if (window.confirm('Move this walkthrough to Archive? You can restore it later from Archive.')) {
      try {
        await api.archiveWalkthrough(workspaceId, walkthroughId);
        setWalkthroughs(walkthroughs.filter(w => w.id !== walkthroughId));
        toast.success('Moved to Archive');
      } catch (error) {
        toast.error('Failed to archive walkthrough');
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
              onClick={() => window.open(`/portal/${workspace?.slug}`, '_blank')}
              data-testid="view-portal-button"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Portal
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/workspace/${workspaceId}/archive`)}
              data-testid="view-archive-button"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
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
                        <h2 className="text-2xl font-heading font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {category.name}
                        </h2>
                        {category.description && (
                          <p className="text-sm text-slate-600 mt-1">{category.description}</p>
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
                    <h2 className="text-2xl font-heading font-bold text-slate-900">Uncategorized</h2>
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
                        className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all"
                        data-testid={`walkthrough-card-${walkthrough.id}`}
                      >
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

// Share Button Component for Walkthroughs
const WalkthroughShareButton = ({ walkthrough, workspaceSlug }) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const walkthroughUrl = `${window.location.origin}/portal/${workspaceSlug}/${walkthrough.id}`;
  const embedUrl = `${window.location.origin}/embed/portal/${workspaceSlug}/${walkthrough.id}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const copyToClipboard = (text, message = 'Copied!') => {
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
          <DialogTitle>Share & Embed Walkthrough</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="share" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share">
              <Share2 className="w-4 h-4 mr-2" />
              Share Link
            </TabsTrigger>
            <TabsTrigger value="embed">
              <Code className="w-4 h-4 mr-2" />
              Embed Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-4 mt-4">
            <div>
              <Label>Walkthrough Link</Label>
              <p className="text-xs text-gray-500 mb-1.5">Share this link to give others access</p>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={walkthroughUrl}
                  readOnly
                  className="flex-1 font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(walkthroughUrl, 'Link copied!')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 mt-4">
            <div>
              <Label>iFrame Embed Code</Label>
              <p className="text-xs text-gray-500 mb-1.5">Copy and paste this code into your website</p>
              <div className="flex gap-2 mt-1.5">
                <Textarea
                  value={iframeCode}
                  readOnly
                  className="flex-1 font-mono text-xs min-h-[100px]"
                />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(iframeCode, 'Embed code copied!')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-3 p-3 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/50">
                <p className="text-xs text-gray-600 mb-2">Preview:</p>
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
