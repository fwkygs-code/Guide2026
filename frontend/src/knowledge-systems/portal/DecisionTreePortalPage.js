/**
 * Decision Tree Portal Page - Interactive Logic Flow
 *
 * Indigo-themed portal emphasizing intelligent decision-making, branching logic,
 * and interactive problem-solving through visual flowcharts.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GitBranch, Brain, Target, Sparkles, ArrowRight, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import axios from 'axios';

/**
 * Decision Tree Portal Page - Interactive Logic Interface
 */
function DecisionTreePortalPage() {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTree, setActiveTree] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [decisionPath, setDecisionPath] = useState([]);
  const [completed, setCompleted] = useState(false);

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
      const decisionTreeSystem = systems.find(s => s.type === 'decision_tree' && s.enabled);
      setSystem(decisionTreeSystem);

      // Auto-select first tree if available
      if (decisionTreeSystem?.content?.trees?.length > 0) {
        const firstTree = decisionTreeSystem.content.trees[0];
        setActiveTree(firstTree);
        setCurrentNode(firstTree.rootNode);
      }
    } catch (error) {
      console.error('Failed to load decision tree system:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTree = (tree) => {
    setActiveTree(tree);
    setCurrentNode(tree.rootNode);
    setDecisionPath([]);
    setCompleted(false);
  };

  const makeChoice = (answer) => {
    if (!currentNode || completed) return;

    const newPath = [...decisionPath, {
      node: currentNode,
      choice: answer
    }];
    setDecisionPath(newPath);

    if (answer.nextNodeId) {
      // Find next node
      const nextNode = findNodeById(activeTree, answer.nextNodeId);
      if (nextNode) {
        setCurrentNode(nextNode);
      } else {
        // End of tree
        setCompleted(true);
      }
    } else {
      // End of tree
      setCompleted(true);
    }
  };

  const findNodeById = (tree, nodeId) => {
    if (tree.rootNode.id === nodeId) return tree.rootNode;
    return tree.nodes?.find(node => node.id === nodeId);
  };

  const resetTree = () => {
    setCurrentNode(activeTree?.rootNode);
    setDecisionPath([]);
    setCompleted(false);
  };

  const goBack = () => {
    if (decisionPath.length > 0) {
      const newPath = [...decisionPath];
      newPath.pop();
      setDecisionPath(newPath);

      if (newPath.length === 0) {
        setCurrentNode(activeTree?.rootNode);
      } else {
        const lastChoice = newPath[newPath.length - 1];
        const previousNode = findNodeById(activeTree, lastChoice.choice.nextNodeId);
        setCurrentNode(previousNode);
      }
      setCompleted(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-indigo-400 border-t-transparent rounded-full"
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
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <GitBranch className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent mb-4">
              Decision Trees Not Available
            </h1>
            <p className="text-indigo-100/80 leading-relaxed mb-6">
              Interactive decision-making guides are not currently published for this workspace.
            </p>
            <Link to={`/portal/${slug}`}>
              <Button className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-lg">
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
      {/* Header - Indigo logic theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" className="text-indigo-200/80 hover:text-indigo-100 hover:bg-indigo-500/10 mb-6">
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
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/25">
              <GitBranch className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent mb-2">
                {system.title}
              </h1>
              <p className="text-indigo-100/80 text-xl leading-relaxed">{system.description}</p>
            </div>
          </motion.div>

          {/* Decision Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 rounded-xl">
              <GitBranch className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-100 text-sm font-medium">
                {(system.content?.trees || []).length} Decision Trees
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 rounded-xl">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-100 text-sm font-medium">
                Updated: {new Date(system.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 rounded-xl">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-100 text-sm font-medium">
                Intelligent Guidance
              </span>
            </div>
          </motion.div>

          {/* Intelligence Notice */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-indigo-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-100 mb-2 text-lg">Intelligent Decision Support</h3>
                  <p className="text-indigo-200/80 leading-relaxed">
                    Navigate complex decisions with our interactive decision trees. Each path is carefully designed to guide you through logical problem-solving and help you reach the best outcome for your situation.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Target className="w-4 h-4 text-indigo-400" />
                    <span className="text-indigo-300/60 text-sm">Precision Decision Making</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Content - Interactive decision flow */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Tree Selection Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Surface variant="glass-secondary" className="p-6 rounded-xl border-indigo-500/30">
                <h3 className="text-indigo-100 font-semibold mb-4 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  Available Trees
                </h3>
                <div className="space-y-2">
                  {(system.content?.trees || []).map((tree, index) => (
                    <motion.button
                      key={tree.id}
                      onClick={() => selectTree(tree)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        activeTree?.id === tree.id
                          ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-100'
                          : 'hover:bg-indigo-500/10 text-indigo-200/80 hover:text-indigo-100'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="font-medium text-sm">{tree.title}</div>
                    </motion.button>
                  ))}
                </div>
              </Surface>
            </motion.div>
          </div>

          {/* Main Decision Interface */}
          <div className="lg:col-span-3">
            {activeTree ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="space-y-6"
              >
                {/* Current Question Node */}
                {currentNode && !completed && (
                  <Card system="decisionTree" animated={false} className="overflow-hidden">
                    <CardHeader system="decisionTree">
                      <div className="flex items-center gap-4">
                        <motion.div
                          className="w-12 h-12 bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg"
                          whileHover={{ scale: 1.05, rotate: 5 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Brain className="w-6 h-6 text-white" />
                        </motion.div>
                        <div>
                          <CardTitle system="decisionTree" className="text-2xl mb-1">
                            {activeTree.title}
                          </CardTitle>
                          <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">
                            Decision Point
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent system="decisionTree" className="px-8 pb-8">
                      <div className="mb-8">
                        <h3 className="text-xl font-semibold text-indigo-100 mb-4">
                          {currentNode.question}
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {(currentNode.answers || []).map((answer, index) => (
                          <motion.button
                            key={answer.id}
                            onClick={() => makeChoice(answer)}
                            className="w-full text-left p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl transition-all group"
                            whileHover={{ scale: 1.02, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center shadow-md">
                                  <ArrowRight className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-indigo-100 group-hover:text-indigo-50 transition-colors">
                                  {answer.text}
                                </span>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      {/* Navigation */}
                      {decisionPath.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-indigo-500/20">
                          <Button
                            onClick={goBack}
                            variant="ghost"
                            className="text-indigo-200/80 hover:text-indigo-100 hover:bg-indigo-500/10"
                          >
                            ← Go Back
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Completion State */}
                {completed && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Surface variant="glass-secondary" className="p-8 rounded-xl border-indigo-500/30 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
                      >
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-indigo-100 mb-4">
                        Decision Complete
                      </h3>
                      <p className="text-indigo-200/80 mb-6">
                        You've reached a conclusion through this decision tree. The path you chose represents your optimal course of action.
                      </p>
                      <div className="flex justify-center gap-4">
                        <Button
                          onClick={resetTree}
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Start Over
                        </Button>
                        <Button
                          onClick={() => selectTree(activeTree)}
                          variant="outline"
                          className="border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10"
                        >
                          Try Different Path
                        </Button>
                      </div>
                    </Surface>
                  </motion.div>
                )}

                {/* Decision Path Summary */}
                {decisionPath.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    <Surface variant="glass-secondary" className="p-6 rounded-xl border-indigo-500/30">
                      <h4 className="text-indigo-100 font-semibold mb-4 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-400" />
                        Your Decision Path
                      </h4>
                      <div className="space-y-3">
                        {decisionPath.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-indigo-200/60 text-sm mb-1">
                                {step.node.question}
                              </div>
                              <div className="text-indigo-100 text-sm font-medium">
                                → {step.choice.text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Surface>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Surface variant="glass-secondary" className="p-12 text-center rounded-xl border-dashed border-indigo-500/30">
                  <GitBranch className="w-16 h-16 text-indigo-400/50 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-indigo-100 mb-4">Select a Decision Tree</h3>
                  <p className="text-indigo-200/70">
                    Choose a decision tree from the sidebar to begin your interactive problem-solving journey.
                  </p>
                </Surface>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DecisionTreePortalPage;