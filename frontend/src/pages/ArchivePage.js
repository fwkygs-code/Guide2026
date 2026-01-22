import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { PageHeader, PageSurface, Card } from '../components/ui/design-system';

const ArchivePage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState([]);
  
  // Resolve workspace slug to ID
  const { workspace, workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  // Acquire workspace lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
          navigate(`/workspace/${workspaceSlug}/walkthroughs`);
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
          // Ignore unlock errors - lock may already be released or expired
        });
      }
    };
  }, [workspaceId, workspaceSlug, navigate]);

  const fetchData = async () => {
    if (!workspaceId) return; // Wait for workspace ID to be resolved
    try {
      const archivedRes = await api.getArchivedWalkthroughs(workspaceId);
      setArchived(archivedRes.data || []);
    } catch (e) {
      toast.error(t('archive.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (walkthroughId) => {
    try {
      await api.restoreWalkthrough(workspaceId, walkthroughId);
      setArchived((prev) => prev.filter((w) => w.id !== walkthroughId));
      toast.success(t('walkthrough.restored'));
    } catch (e) {
      toast.error(t('archive.failedToRestore'));
    }
  };

  const handleDeleteForever = async (walkthroughId) => {
    const ok = window.confirm(t('walkthrough.deleteForeverConfirm'));
    if (!ok) return;
    try {
      await api.permanentlyDeleteWalkthrough(workspaceId, walkthroughId);
      setArchived((prev) => prev.filter((w) => w.id !== walkthroughId));
      toast.success(t('walkthrough.deleteForeverSuccess'));
    } catch (e) {
      toast.error(t('archive.failedToDelete'));
    }
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
        title={`${workspace?.name} - ${t('archive.title')}`}
        description={t('archive.subtitle')}
        actions={
          <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs`)}>
            {t('archive.backToGuides')}
          </Button>
        }
      />

      <PageSurface>

        {archived.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archived.map((walkthrough, index) => (
              <motion.div
                key={walkthrough.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="relative overflow-hidden border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
                  {/* Animated background effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  <CardContent className="relative p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-white text-xl shadow-lg">
                          <Archive className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors mb-1">
                            {walkthrough.title}
                          </h3>
                          <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">
                            {walkthrough.description || t('walkthrough.noDescription')}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm font-medium text-amber-400">
                        Archived
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-slate-400">Steps:</span>
                      <span className="text-white font-medium">{walkthrough.steps?.length || 0}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 transition-all duration-200"
                        onClick={() => handleRestore(walkthrough.id)}
                        data-testid={`restore-walkthrough-${walkthrough.id}`}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('walkthrough.restore')}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDeleteForever(walkthrough.id)}
                        data-testid={`delete-forever-walkthrough-${walkthrough.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Forever
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-white mb-2">{t('archive.empty')}</h3>
            <p className="text-slate-400">{t('archive.emptyDescription')}</p>
          </div>
        )}
      </PageSurface>
    </DashboardLayout>
  );
};

export default ArchivePage;

