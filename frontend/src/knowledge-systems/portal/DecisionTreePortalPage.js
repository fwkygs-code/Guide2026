import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, GitBranch, ArrowRight, RotateCcw, CheckCircle, Brain, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/design-system';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/design-system';
import { portalKnowledgeSystemsService } from '../api-service';

/**
 * Decision Tree Portal Page - Interactive Guidance
 */
function DecisionTreePortalPage() {
  const { slug } = useParams();
  const [publishedTrees, setPublishedTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTree, setCurrentTree] = useState(null);
  const [currentNode, setCurrentNode] = useState(null);
  const [decisionPath, setDecisionPath] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    loadSystem();
  }, [slug]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      const trees = await portalKnowledgeSystemsService.getAllByType(slug, 'decision_tree');
      setPublishedTrees(trees);
    } catch (error) {
      console.error('Failed to load decision tree system:', error);
    } finally {
      setLoading(false);
    }
  };

      // Auto-select first tree if available
      if (trees.length > 0) {
        selectTree(trees[0]);
      }
    } catch (error) {
      console.error('Failed to load decision tree system:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTree = (treeData) => {
    const tree = treeData.content;
    setCurrentTree(tree);
    setCurrentNode(tree.nodes.find(n => n.id === tree.rootNodeId));
    setDecisionPath([]);
    setIsComplete(false);
  };

  const makeChoice = (answer) => {
    const newPath = [...decisionPath, {
      node: currentNode,
      chosenAnswer: answer,
      timestamp: new Date()
    }];
    setDecisionPath(newPath);

    if (answer.nextNodeId) {
      const nextNode = currentTree.nodes.find(n => n.id === answer.nextNodeId);
      if (nextNode) {
        setCurrentNode(nextNode);
      } else {
        console.error('Next node not found:', answer.nextNodeId);
      }
    } else {
      // End of decision tree
      setIsComplete(true);
    }
  };

  const resetDecision = () => {
    setCurrentNode(currentTree.rootNode);
    setDecisionPath([]);
    setIsComplete(false);
  };

  const goBack = () => {
    if (decisionPath.length > 0) {
      const previousPath = decisionPath.slice(0, -1);
      setDecisionPath(previousPath);

      if (previousPath.length > 0) {
        setCurrentNode(previousPath[previousPath.length - 1].node);
      } else {
        setCurrentNode(currentTree.rootNode);
      }
      setIsComplete(false);
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
              Interactive decision guidance is not currently published for this workspace.
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
      {/* Header - Glass morphism with indigo theming */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden"
      >
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6 py-12">
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
                Decision Trees
              </h1>
              <p className="text-indigo-100/80 text-xl leading-relaxed">Navigate complex decisions with structured guidance and logical branching.</p>
            </div>
          </motion.div>

          {/* Trust Indicators - Glass morphism badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 rounded-xl">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-100 text-sm font-medium">
                {publishedTrees.length} Decision Trees Available
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 backdrop-blur-sm border border-indigo-500/20 rounded-xl">
              <Target className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-100 text-sm font-medium">
                Guided Decision Making
              </span>
            </div>
          </motion.div>

          {/* Intelligence Hub Notice - Enhanced glass card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Surface variant="glass-secondary" className="p-6 rounded-xl border-indigo-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <GitBranch className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-100 mb-2 text-lg">Intelligent Decision Support</h3>
                  <p className="text-indigo-200/80 leading-relaxed">
                    Navigate complex decisions with structured guidance. Our decision trees use logical branching to help you reach the best outcome based on your specific situation.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    <span className="text-indigo-300/60 text-sm">Smart Guidance System</span>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.div>
        </div>
      </motion.header>

      {/* Tree Selection and Decision Flow */}
      <main className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Tree Selection Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="lg:col-span-1"
          >
            <Card className="border-indigo-500/20 bg-slate-800/50 backdrop-blur-sm sticky top-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Decision Trees
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {publishedTrees.map((treeData, index) => (
                  <motion.div
                    key={treeData.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant={currentTree?.id === treeData.content?.id ? "default" : "ghost"}
                      className={`w-full justify-start text-left ${
                        currentTree?.id === treeData.content?.id
                          ? 'bg-indigo-500/20 text-indigo-100 border-indigo-500/30'
                          : 'text-indigo-200/80 hover:bg-slate-700/50'
                      }`}
                      onClick={() => selectTree(treeData)}
                    >
                      <GitBranch className="w-4 h-4 mr-2" />
                      <span className="truncate">{treeData.title || `Tree ${index + 1}`}</span>
                    </Button>
                  </motion.div>
                ))}

                {publishedTrees.length === 0 && (
                  <div className="text-center py-8">
                    <GitBranch className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No decision trees available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Decision Flow Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="lg:col-span-3"
          >
            {!currentTree ? (
              <Card className="border-slate-600 bg-slate-800/30">
                <CardContent className="p-12 text-center">
                  <Brain className="w-16 h-16 text-slate-500 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-slate-300 mb-4">Select a Decision Tree</h3>
                  <p className="text-slate-500">
                    Choose a decision tree from the sidebar to begin your guided decision-making process.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <DecisionFlowInterface
                tree={currentTree}
                currentNode={currentNode}
                decisionPath={decisionPath}
                isComplete={isComplete}
                onChoice={makeChoice}
                onReset={resetDecision}
                onGoBack={goBack}
              />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/**
 * Decision Flow Interface - Interactive Navigation
 */
function DecisionFlowInterface({ tree, currentNode, decisionPath, isComplete, onChoice, onReset, onGoBack }) {
  return (
    <div className="space-y-6">

      {/* Current Tree Header */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                {tree.title}
              </CardTitle>
              <Badge className="mt-1 bg-indigo-500/20 text-indigo-300">
                Interactive Decision Guide
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {decisionPath.length > 0 && (
                <Button onClick={onGoBack} variant="outline" size="sm" className="border-slate-600 text-slate-300">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button onClick={onReset} variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-indigo-200/60">Decision Path:</span>
            <div className="flex items-center gap-1">
              {decisionPath.map((step, index) => (
                <React.Fragment key={index}>
                  <span className="text-indigo-300/60">Step {index + 1}</span>
                  {index < decisionPath.length - 1 && <ArrowRight className="w-3 h-3 text-indigo-400/60" />}
                </React.Fragment>
              ))}
              {!isComplete && <span className="text-indigo-400">Current</span>}
              {isComplete && <span className="text-green-400">Complete</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decision Flow Display */}
      <AnimatePresence mode="wait">
        {isComplete ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <DecisionComplete path={decisionPath} finalNode={currentNode} onReset={onReset} />
          </motion.div>
        ) : (
          <motion.div
            key={currentNode?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <DecisionNode node={currentNode} onChoice={onChoice} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual Decision Node - Interactive Question
 */
function DecisionNode({ node, onChoice }) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  if (!node) return null;

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-slate-800/50 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="text-center space-y-8">

          {/* Question Display */}
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
              <Brain className="w-8 h-8 text-white" />
            </div>

            <div>
              <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                {node.question || 'What is your decision?'}
              </h2>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                Decision Point
              </Badge>
            </div>
          </div>

          {/* Answer Options */}
          {node.answers && node.answers.length > 0 ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {node.answers.map((answer, index) => (
                <motion.div
                  key={answer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => onChoice(answer)}
                    className="w-full justify-start text-left bg-slate-800/50 hover:bg-indigo-500/20 border border-slate-700 hover:border-indigo-500/50 text-white p-6 h-auto"
                    variant="outline"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-lg mb-1">{answer.text || 'Option'}</div>
                        {answer.nextNodeId && (
                          <div className="text-indigo-300/60 text-sm">
                            Continue to next decision
                          </div>
                        )}
                        {!answer.nextNodeId && (
                          <div className="text-green-400/80 text-sm font-medium">
                            Reach conclusion
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <GitBranch className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No decision options available for this node.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Decision Complete Display
 */
function DecisionComplete({ path, finalNode, onReset }) {
  return (
    <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-slate-800/50 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="text-center space-y-6">

          {/* Completion Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>

          {/* Completion Message */}
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-4">
              Decision Complete!
            </h2>
            <p className="text-green-100/80 text-lg">
              Based on your choices, here's your recommended path forward.
            </p>
          </div>

          {/* Final Decision Summary */}
          <Card className="border-green-500/20 bg-green-500/5 max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="text-white font-semibold mb-4">Your Decision Path:</h3>
              <div className="space-y-3">
                {path.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                      {index + 1}
                    </div>
                    <span className="text-green-100">{step.chosenAnswer.text}</span>
                  </div>
                ))}
              </div>

              {finalNode?.question && (
                <div className="mt-6 pt-4 border-t border-green-500/20">
                  <h4 className="text-green-200 font-semibold mb-2">Final Result:</h4>
                  <p className="text-green-50/90">{finalNode.question}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Button onClick={onReset} className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600">
              <RotateCcw className="w-4 h-4 mr-2" />
              Make Another Decision
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DecisionTreePortalPage;