import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import { POLICY_ROUTES } from '../../policy-system/routes';
import { PROCEDURE_ROUTES } from '../../procedure-system/routes';
import { DOCUMENTATION_ROUTES } from '../../documentation-system/routes';
import { FAQ_ROUTES } from '../../faq-system/routes';
import { DECISION_TREE_ROUTES } from '../../decision-tree-system/routes';
import { listPolicyMeta, listPublishedPolicies } from '../../policy-system/service';
import { listProcedureMeta, listPublishedProcedures } from '../../procedure-system/service';
import { listDocumentationMeta, listPublishedDocumentation } from '../../documentation-system/service';
import { listFAQMeta, listPublishedFAQs } from '../../faq-system/service';
import { listDecisionTreeMeta, listPublishedDecisionTrees } from '../../decision-tree-system/service';

const SYSTEM_DEFINITIONS = [
  {
    id: 'policy',
    title: 'Policies',
    description: 'Authority, compliance, and legal governance.',
    accent: '#f59e0b',
    routes: POLICY_ROUTES,
    listMeta: listPolicyMeta,
    listPublished: listPublishedPolicies
  },
  {
    id: 'procedure',
    title: 'Procedures',
    description: 'Operational playbooks and step execution.',
    accent: '#22d3ee',
    routes: PROCEDURE_ROUTES,
    listMeta: listProcedureMeta,
    listPublished: listPublishedProcedures
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Technical knowledge base with live preview.',
    accent: '#a855f7',
    routes: DOCUMENTATION_ROUTES,
    listMeta: listDocumentationMeta,
    listPublished: listPublishedDocumentation
  },
  {
    id: 'faq',
    title: 'FAQs',
    description: 'Fast answers with question-first layout.',
    accent: '#34d399',
    routes: FAQ_ROUTES,
    listMeta: listFAQMeta,
    listPublished: listPublishedFAQs
  },
  {
    id: 'decision-tree',
    title: 'Decision Trees',
    description: 'Guided outcomes with branching logic.',
    accent: '#6366f1',
    routes: DECISION_TREE_ROUTES,
    listMeta: listDecisionTreeMeta,
    listPublished: listPublishedDecisionTrees
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
    const cards = SYSTEM_DEFINITIONS.map((system) => {
      const meta = system.listMeta(workspaceId);
      const published = system.listPublished(workspaceId);
      const latest = meta
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      return {
        ...system,
        totalCount: meta.length,
        publishedCount: published.length,
        latestId: latest?.id || null
      };
    });
    setSystemCards(cards);
    setLoading(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceSlug}/settings`)}
                className="text-slate-200 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('knowledgeSystems.backToSettings')}
              </Button>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('knowledgeSystems.title')}
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              {t('knowledgeSystems.description')}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <CardTitle className="text-white text-2xl">{system.title}</CardTitle>
                    <p className="text-slate-400 text-sm mt-2">{system.description}</p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium border"
                    style={{
                      color: system.accent,
                      borderColor: `${system.accent}55`,
                      background: `${system.accent}22`
                    }}
                  >
                    {system.publishedCount > 0 ? 'Published' : 'Draft'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {system.totalCount} draft{system.totalCount === 1 ? '' : 's'}
                  </Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {system.publishedCount} published
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
                  {system.latestId ? 'Open Editor' : 'Create First'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default KnowledgeSystemsPage;