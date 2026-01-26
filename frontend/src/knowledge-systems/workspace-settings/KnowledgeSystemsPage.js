import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '../../components/DashboardLayout';
import { PageHeader, PageSurface } from '../../components/ui/design-system';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import { POLICY_ROUTES } from '../../policy-system/routes';
import { PROCEDURE_ROUTES } from '../../procedure-system/routes';
import { DOCUMENTATION_ROUTES } from '../../documentation-system/routes';
import { FAQ_ROUTES } from '../../faq-system/routes';
import { DECISION_TREE_ROUTES } from '../../decision-tree-system/routes';
import { api } from '../../lib/api';

const SYSTEM_DEFINITIONS = [
  {
    id: 'policy',
    systemType: 'policy',
    titleKey: 'knowledgeSystems.types.policies.name',
    descriptionKey: 'knowledgeSystems.types.policies.description',
    accent: '#f59e0b',
    routes: POLICY_ROUTES
  },
  {
    id: 'procedure',
    systemType: 'procedure',
    titleKey: 'knowledgeSystems.types.procedures.name',
    descriptionKey: 'knowledgeSystems.types.procedures.description',
    accent: '#22d3ee',
    routes: PROCEDURE_ROUTES
  },
  {
    id: 'documentation',
    systemType: 'documentation',
    titleKey: 'knowledgeSystems.types.documentation.name',
    descriptionKey: 'knowledgeSystems.types.documentation.description',
    accent: '#a855f7',
    routes: DOCUMENTATION_ROUTES
  },
  {
    id: 'faq',
    systemType: 'faq',
    titleKey: 'knowledgeSystems.types.faqs.name',
    descriptionKey: 'knowledgeSystems.types.faqs.description',
    accent: '#34d399',
    routes: FAQ_ROUTES
  },
  {
    id: 'decision-tree',
    systemType: 'decision_tree',
    titleKey: 'knowledgeSystems.types.decisionTrees.name',
    descriptionKey: 'knowledgeSystems.types.decisionTrees.description',
    accent: '#6366f1',
    routes: DECISION_TREE_ROUTES
  }
];

function KnowledgeSystemsPage() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [systemCards, setSystemCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    
    const loadSystems = async () => {
      const cards = await Promise.all(
        SYSTEM_DEFINITIONS.map(async (system) => {
          try {
            const response = await api.getKnowledgeSystems(workspaceId, system.systemType);
            const allSystems = response.data || [];
            const published = allSystems.filter(s => s.status === 'published');
            const latest = allSystems
              .slice()
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
            
            return {
              ...system,
              totalCount: allSystems.length,
              publishedCount: published.length,
              latestId: latest?.id || null
            };
          } catch (error) {
            console.error(`Failed to load ${system.systemType}:`, error);
            return {
              ...system,
              totalCount: 0,
              publishedCount: 0,
              latestId: null
            };
          }
        })
      );
      setSystemCards(cards);
      setLoading(false);
    };
    
    loadSystems();
  }, [workspaceId]);

  const handleOpen = (system) => {
    if (!workspaceSlug) return;
    if (system.latestId) {
      const editPath = system.routes.edit
        .replace(':workspaceSlug', workspaceSlug)
        .replace(':itemId', system.latestId);
      navigate(editPath);
    } else {
      const createPath = system.routes.create.replace(':workspaceSlug', workspaceSlug);
      navigate(createPath);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={t('knowledgeSystems.title')}
        description={t('knowledgeSystems.description')}
      />

      <PageSurface>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemCards.map((system, index) => (
            <motion.div
              key={system.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border border-slate-700/50 bg-slate-900/60">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-white text-2xl">{t(system.titleKey)}</CardTitle>
                      <p className="text-slate-400 text-sm mt-2">{t(system.descriptionKey)}</p>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{
                        color: system.accent,
                        borderColor: `${system.accent}55`,
                        background: `${system.accent}22`
                      }}
                    >
                      {system.publishedCount > 0 ? t('knowledgeSystems.status.published') : t('knowledgeSystems.status.draft')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {t('knowledgeSystems.counts.drafts', { count: system.totalCount })}
                    </Badge>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {t('knowledgeSystems.counts.published', { count: system.publishedCount })}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => handleOpen(system)}
                    className="w-full"
                    style={{
                      background: `${system.accent}33`,
                      borderColor: `${system.accent}55`,
                      color: '#ffffff'
                    }}
                    variant="outline"
                  >
                    {system.latestId ? t('knowledgeSystems.actions.openEditor') : t('knowledgeSystems.actions.createFirst')}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </PageSurface>
    </DashboardLayout>
  );
}

export default KnowledgeSystemsPage;