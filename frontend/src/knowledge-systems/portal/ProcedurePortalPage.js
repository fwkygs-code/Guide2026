import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Workflow, CheckCircle, Clock, ArrowRight, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/design-system';
import { portalKnowledgeSystemsService } from '../api-service';
import sanitizeHtml from '../../lib/sanitizeHtml';
import WorkspaceLoader from '../../components/WorkspaceLoader';
import { useKnowledgeRoute } from '../KnowledgeRouteContext';

/**
 * Procedure Portal Page - Systematic Display
 */
function ProcedurePortalPage() {
  const { slug } = useKnowledgeRoute();
  const { t, ready } = useTranslation(['knowledgeSystems', 'portal']);
  const [publishedProcedures, setPublishedProcedures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setPublishedProcedures([]);
      setLoading(false);
      return;
    }
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      if (!slug) return;
      const procedures = await portalKnowledgeSystemsService.getAllByType(slug, 'procedure');
      setPublishedProcedures(procedures);
    } catch (error) {
      console.error('Failed to load procedure system:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header - Glass morphism with cyan theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-6 mb-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/25">
              <Workflow className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                {t('procedure.title')}
              </h1>
              <p className="text-cyan-100/80 text-xl leading-relaxed">{t('procedure.description')}</p>
            </div>
          </motion.div>

          {/* Trust Indicators - Glass morphism badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl">
              <Workflow className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-100 text-sm font-medium">
                {publishedProcedures.length} Procedures Available
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-100 text-sm font-medium">
              </span>
            </div>
          </motion.div>

          {/* Operational Excellence Notice - Enhanced glass card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-cyan-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-cyan-100 mb-2 text-lg">{t('procedure.standardTitle')}</h3>
                  <p className="text-cyan-200/80 leading-relaxed">
                    {t('procedure.standardDescription')}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Play className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300/60 text-sm">Operational Excellence Framework</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Systematic workflow layout */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {publishedProcedures.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-cyan-500/30">
                <Workflow className="w-16 h-16 text-cyan-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-cyan-100 mb-4">{t('procedure.noProcedures')}</h3>
                <p className="text-cyan-200/70">
                  {t('procedure.noProceduresDescription')}
                </p>
              </Surface>
            </motion.div>
          ) : (
            publishedProcedures.map((procedureData, index) => (
              <ProcedureWorkflow key={procedureData.meta.id} procedure={procedureData} index={index} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Individual Procedure Workflow - Systematic Display
 */
function ProcedureWorkflow({ procedure, index }) {
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const toggleStep = (stepIndex) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepIndex)) {
      newCompleted.delete(stepIndex);
    } else {
      newCompleted.add(stepIndex);
    }
    setCompletedSteps(newCompleted);
  };

  const progress = procedure.published.steps ? (completedSteps.size / procedure.published.steps.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card system="procedure" animated={false} className="overflow-hidden">
        <CardHeader system="procedure" className="pb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-xl"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-2xl font-bold text-white">{index + 1}</span>
              </motion.div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-100 to-white bg-clip-text text-transparent mb-1">
                  {procedure.title}
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30 px-3 py-1">
                    {procedure.content?.category || 'Procedure'}
                  </Badge>
                  <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30 px-3 py-1">
                    {procedure.content?.steps?.length || 0} Steps
                  </Badge>
                </div>
                {procedure.description && (
                  <p className="text-cyan-100/80 text-sm leading-relaxed max-w-2xl">
                    {procedure.description}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="text-right">
              <div className="text-sm text-cyan-200/60 mb-1">Progress</div>
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-xs text-cyan-300/60 mt-1">
                {completedSteps.size} of {procedure.content?.steps?.length || 0} complete
              </div>
            </div>
          </div>

          {/* Overview */}
          {procedure.content?.overview && (
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <p className="text-cyan-100/90 text-sm italic">
                "{procedure.content.overview}"
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent system="procedure" className="px-8 pb-8">
          {procedure.content?.steps && procedure.content.steps.length > 0 ? (
            <div className="space-y-4">
              {procedure.content.steps.map((step, stepIndex) => (
                <ProcedureStep
                  key={step.id}
                  step={step}
                  stepIndex={stepIndex}
                  isCompleted={completedSteps.has(stepIndex)}
                  onToggle={() => toggleStep(stepIndex)}
                  isLast={stepIndex === procedure.content.steps.length - 1}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Workflow className="w-12 h-12 text-cyan-400/50 mx-auto mb-4" />
              <p className="text-cyan-200/70">No steps defined for this procedure.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Individual Procedure Step - Interactive Execution
 */
function ProcedureStep({ step, stepIndex, isCompleted, onToggle, isLast }) {
  return (
    <>
      <motion.div
        className={`flex gap-4 p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
          isCompleted
            ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10'
            : 'bg-slate-800/40 border-slate-700/50 hover:border-cyan-500/30 hover:bg-cyan-500/5'
        }`}
        onClick={onToggle}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex flex-col items-center gap-2">
          <motion.div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${
              isCompleted
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg'
            }`}
            whileHover={{ scale: 1.1 }}
            animate={isCompleted ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {isCompleted ? <CheckCircle className="w-6 h-6" /> : stepIndex + 1}
          </motion.div>
          {!isLast && (
            <ArrowRight className={`w-4 h-4 ${isCompleted ? 'text-green-400' : 'text-cyan-400/60'}`} />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <h4 className={`font-semibold text-lg ${
              isCompleted ? 'text-green-100' : 'text-cyan-100'
            }`}>
              {step.title || `Step ${stepIndex + 1}`}
            </h4>
            <Badge
              className={`text-xs ${
                isCompleted
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {isCompleted ? 'Complete' : 'Pending'}
            </Badge>
          </div>

          {step.description && (
            <div className="prose prose-sm max-w-none">
              <div
                className={`leading-relaxed ${isCompleted ? 'text-green-50/80' : 'text-cyan-50/80'}`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(step.description || '') }}
              />
            </div>
          )}
        </div>
      </motion.div>

      {!isLast && (
        <div className="flex justify-center py-4">
          <div className="w-px h-8 bg-gradient-to-b from-cyan-400/60 to-transparent"></div>
        </div>
      )}
    </>
  );
}

export default ProcedurePortalPage;