/**
 * Knowledge System Content Page
 *
 * Content management page for knowledge systems.
 * Lists existing content items and provides creation/editing access.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Edit, Trash2, Settings, FileText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '../../components/DashboardLayout';
import { PageHeader, PageSurface } from '../../components/ui/design-system';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge System Content Page
 */
function KnowledgeSystemContentPage() {
  const { t } = useTranslation('knowledgeSystems');
  const { workspaceSlug, systemType } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contentItems, setContentItems] = useState([]);

  useEffect(() => {
    if (systemType) {
      loadSystemConfig();
      loadContentItems();
    }
  }, [systemType, workspaceId]);

  const loadSystemConfig = () => {
    const systemConfig = getKnowledgeSystemConfig(systemType);
    setConfig(systemConfig);
    setLoading(false);
  };

  const loadContentItems = () => {
    // TODO: Implement content loading from the knowledge system service
    // For now, we'll show an empty state
    setContentItems([]);
  };

  const getItemTypeLabel = (type) => {
    const labels = {
      policy: 'Policy',
      procedure: 'Procedure',
      documentation: 'Document',
      faq: 'FAQ',
      decision_tree: 'Decision Tree'
    };
    return labels[type] || 'Item';
  };

  if (workspaceLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!config) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-white mb-2">System Not Found</h1>
              <p className="text-slate-400 mb-4">
                The knowledge system "{systemType}" is not recognized.
              </p>
              <Button onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}>
                {t('knowledgeSystems.backToSystems')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={t(config.displayNameKey)}
        description="Content Management"
      />

      <PageSurface>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}/configure`)}
              className="border-slate-600 text-slate-300"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure System
            </Button>
            <Button onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}/new`)}>
              <Plus className="w-4 h-4 mr-2" />
              Create {getItemTypeLabel(systemType)}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div>
        {contentItems.length === 0 ? (
          // Empty State
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-white text-4xl mx-auto mb-6 ${config.iconBg || 'bg-slate-600'}`}>
              {config.icon}
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">{t('knowledgeSystems.empty.title', { type: t(config.displayNameKey) })}</h2>
            <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
              Get started by creating your first {getItemTypeLabel(systemType).toLowerCase()}.
              This will help organize and present your knowledge content effectively.
            </p>
            <Button
              onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}/new`)}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First {getItemTypeLabel(systemType)}
            </Button>
          </motion.div>
        ) : (
          // Content List
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {t(config.displayNameKey)} ({contentItems.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contentItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-slate-700/50 bg-slate-800/50 hover:bg-slate-800/70 transition-all cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${config.iconBg || 'bg-slate-600'}`}>
                            {config.icon}
                          </div>
                          <div>
                            <CardTitle className="text-white text-lg">{item.title}</CardTitle>
                            <p className="text-slate-400 text-sm">{getItemTypeLabel(systemType)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 text-sm mb-4 line-clamp-3">
                        {item.description || 'No description available.'}
                      </p>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                        <span>Last updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}/${item.id}/edit`)}
                          className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Edit className="w-3 h-3 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        </div>
      </PageSurface>
    </DashboardLayout>
  );
}

export default KnowledgeSystemContentPage;