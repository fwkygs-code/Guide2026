/**
 * Procedure Portal Page - Structured Workflow Guidance
 *
 * Cyan-themed portal emphasizing precision, sequence, and operational efficiency.
 * Interactive step-by-step procedures with visual flow indicators.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Workflow, CheckCircle2, ArrowRight, Clock, User, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import axios from 'axios';

/**
 * Procedure Portal Page - Workflow-Focused Design
 */
function ProcedurePortalPage() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      // Get workspace data from portal API
      const portalResponse = await axios.get(`/api/portal/${slug}`);
      const workspaceId = portalResponse.data.workspace.id;

      const systems = getKnowledgeSystems(workspaceId);
      const procedureSystem = systems.find(s => s.type === 'procedure' && s.enabled);
      setSystem(procedureSystem);
    } catch (error) {
      console.error('Failed to load procedure system:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8 max-w-md"
        >
          <Surface variant="glass-accent" className="p-8 rounded-2xl">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Workflow className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4">
              Procedures Not Available
            </h1>
            <p className="text-cyan-100/80 leading-relaxed mb-6">
              Procedure documentation is not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </Surface>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header - Cyan workflow theming */}
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
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/10 mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </motion.div>

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
                {system.title}
              </h1>
              <p className="text-cyan-100/80 text-xl leading-relaxed">{system.description}</p>
            </div>
          </motion.div>

          {/* Workflow Stats - Interactive badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-100 text-sm font-medium">
                {(system.content?.procedures || []).length} Procedures Available
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-100 text-sm font-medium">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-100 text-sm font-medium">
                Operational Efficiency
              </span>
            </div>
          </motion.div>

          {/* Workflow Guidance Notice */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-cyan-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-cyan-100 mb-2 text-lg">Structured Procedure Guidance</h3>
                  <p className="text-cyan-200/80 leading-relaxed">
                    Follow these step-by-step procedures to ensure consistent, efficient, and safe operations. Each procedure is designed for clarity and precision in execution.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <User className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300/60 text-sm">Designed for Operational Excellence</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Workflow layout */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {(system.content?.procedures || []).length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-cyan-500/30">
                <Workflow className="w-16 h-16 text-cyan-400/50 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-cyan-100 mb-4">No Procedures Published</h3>
                <p className="text-cyan-200/70">
                  Procedure documentation has not been published yet. Check back for operational guidance.
                </p>
              </Surface>
            </motion.div>
          ) : (
            (system.content?.procedures || []).map((procedure, index) => (
              <ProcedureRenderer key={procedure.id} procedure={procedure} index={index} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Procedure Renderer - Interactive Step-by-Step Display
 */
function ProcedureRenderer({ procedure, index }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set([0])); // First step expanded by default

  const toggleStep = (stepId) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
    >
      <Card system="procedure" animated={false} className="overflow-hidden">
        <CardHeader system="procedure">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-white font-bold text-lg">{index + 1}</span>
              </motion.div>
              <div>
                <CardTitle system="procedure" className="text-2xl mb-2">{procedure.title}</CardTitle>
                {procedure.category && (
                  <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30 px-3 py-1">
                    {procedure.category}
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-sm text-cyan-200/60 font-medium">
              Updated {new Date(procedure.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        </CardHeader>

        <CardContent system="procedure" className="px-8 pb-8">
          {/* Step-by-step workflow */}
          <div className="space-y-4">
            {(procedure.steps || []).map((step, stepIndex) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: stepIndex * 0.1 }}
                className="relative"
              >
                {/* Connection line (except for first step) */}
                {stepIndex > 0 && (
                  <div className="absolute -top-4 left-6 w-0.5 h-8 bg-gradient-to-b from-cyan-500/50 to-transparent" />
                )}

                <div className="border border-cyan-500/30 rounded-xl overflow-hidden bg-cyan-500/5 backdrop-blur-sm">
                  <motion.button
                    onClick={() => toggleStep(step.id)}
                    className="w-full text-left p-6 hover:bg-cyan-500/10 transition-all duration-200 group"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <motion.div
                          className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-md"
                          whileHover={{ rotate: 10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className="text-white font-bold">{stepIndex + 1}</span>
                        </motion.div>
                        <div>
                          <span className="font-semibold text-cyan-100 text-lg group-hover:text-cyan-50 transition-colors">
                            {step.title}
                          </span>
                          {stepIndex < (procedure.steps || []).length - 1 && (
                            <div className="flex items-center gap-1 mt-1">
                              <ArrowRight className="w-3 h-3 text-cyan-400" />
                              <span className="text-cyan-300/60 text-xs">Continue to next step</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <motion.span
                        className="text-cyan-400 transition-transform duration-200"
                        animate={{ rotate: expandedSteps.has(step.id) ? 90 : 0 }}
                      >
                        ▶
                      </motion.span>
                    </div>
                  </motion.button>

                  {expandedSteps.has(step.id) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-6"
                    >
                      <div className="pl-14">
                        <p className="text-cyan-50/90 leading-relaxed text-base">
                          {step.description}
                        </p>
                        {stepIndex === (procedure.steps || []).length - 1 && (
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-cyan-500/20">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <span className="text-cyan-200/80 text-sm">Procedure Complete</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ProcedurePortalPage;