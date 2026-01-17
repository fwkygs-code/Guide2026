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

const ArchivePage = () => {
  const { t } = useTranslation();
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [archived, setArchived] = useState([]);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    try {
      const [archivedRes, wsRes] = await Promise.all([
        api.getArchivedWalkthroughs(workspaceId),
        api.getWorkspace(workspaceId),
      ]);
      setArchived(archivedRes.data || []);
      setWorkspace(wsRes.data);
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
              {workspace?.name} - {t('archive.title')}
            </h1>
            <p className="text-slate-600 mt-1">{t('archive.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs`)}>
            {t('archive.backToGuides')}
          </Button>
        </div>

        {archived.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archived.map((walkthrough, index) => (
              <motion.div
                key={walkthrough.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-heading font-semibold text-slate-900 mb-1">
                      {walkthrough.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {walkthrough.description || t('walkthrough.noDescription')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">
                    <Archive className="w-3 h-3 mr-1" />
                    {t('walkthrough.archived')}
                  </Badge>
                  <Badge variant="outline">{walkthrough.steps?.length || 0} {t('walkthrough.steps').toLowerCase()}</Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRestore(walkthrough.id)}
                    data-testid={`restore-walkthrough-${walkthrough.id}`}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    {t('walkthrough.restore')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteForever(walkthrough.id)}
                    data-testid={`delete-forever-walkthrough-${walkthrough.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">{t('archive.empty')}</h3>
            <p className="text-slate-600">{t('archive.emptyDescription')}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ArchivePage;

