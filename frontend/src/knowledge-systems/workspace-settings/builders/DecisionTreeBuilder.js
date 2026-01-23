/**
 * Decision Tree Builder - Logic & Intelligence
 *
 * Visual node-based decision tree editor with branching logic.
 * Electric indigo theming represents analytical intelligence and structured thinking.
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Trash2, Play, Eye, EyeOff, ArrowRight } from 'lucide-react';
import RichTextEditor from '../../../components/canvas-builder/RichTextEditor';

/**
 * Decision Tree Builder Interface
 */
function DecisionTreeBuilder({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title || 'Decision Support System',
    description: system.description || '',
    trees: system.content?.trees || []
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTree, setSelectedTree] = useState(null);
  const canvasRef = useRef(null);

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateTree = (index, field, value) => {
    const updatedTrees = [...formData.trees];
    updatedTrees[index] = {
      ...updatedTrees[index],
      [field]: value
    };
    updateFormData('trees', updatedTrees);
  };

  const addTree = () => {
    const newTree = {
      id: `tree-${Date.now()}`,
      title: '',
      rootNode: {
        id: 'root',
        question: '',
        answers: []
      },
      nodes: []
    };
    updateFormData('trees', [...formData.trees, newTree]);
    setSelectedTree(formData.trees.length);
  };

  const removeTree = (index) => {
    const updatedTrees = formData.trees.filter((_, i) => i !== index);
    updateFormData('trees', updatedTrees);
    if (selectedTree === index) {
      setSelectedTree(null);
    } else if (selectedTree > index) {
      setSelectedTree(selectedTree - 1);
    }
  };

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      content: {
        trees: formData.trees
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-indigo-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Decision Tree Builder</h1>
                <p className="text-slate-400 text-sm">Create interactive decision-making guides</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
                className="border-slate-600 text-slate-300"
              >
                {previewMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {previewMode ? 'Edit Mode' : 'Preview'}
              </Button>
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600">
                Save Decision Trees
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">

          {/* Basic Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <GitBranch className="w-5 h-5" />
                  Decision Tree Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Decision System Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter decision tree collection title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this decision support system"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Decision Trees */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {previewMode ? 'Decision Tree Preview' : 'Decision Tree Editor'}
                </h2>
                <p className="text-slate-400">
                  {previewMode
                    ? 'Test how users will navigate your decision trees'
                    : 'Create interactive decision trees with branching logic'
                  }
                </p>
              </div>
              {!previewMode && (
                <Button onClick={addTree} className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Decision Tree
                </Button>
              )}
            </div>

            {formData.trees.length === 0 ? (
              <Card className="border-dashed border-slate-600 bg-slate-800/30">
                <CardContent className="p-8 text-center">
                  <GitBranch className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Decision Trees</h3>
                  <p className="text-slate-500 mb-4">Create interactive decision-making guides for users</p>
                  <Button onClick={addTree} variant="outline" className="border-slate-600 text-slate-300">
                    Create First Decision Tree
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Tree List */}
                <div className="lg:col-span-1">
                  <Card className="border-indigo-500/20 bg-slate-800/50">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Decision Trees</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {formData.trees.map((tree, index) => (
                        <motion.div
                          key={tree.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant={selectedTree === index ? "default" : "ghost"}
                            className={`w-full justify-start text-left ${
                              selectedTree === index
                                ? 'bg-indigo-500/20 text-indigo-100 border-indigo-500/30'
                                : 'text-slate-300 hover:bg-slate-700/50'
                            }`}
                            onClick={() => setSelectedTree(index)}
                          >
                            <GitBranch className="w-4 h-4 mr-2" />
                            {tree.title || `Tree ${index + 1}`}
                          </Button>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Tree Editor/Preview */}
                <div className="lg:col-span-3">
                  {selectedTree !== null && formData.trees[selectedTree] ? (
                    previewMode ? (
                      <DecisionTreePreview tree={formData.trees[selectedTree]} />
                    ) : (
                      <DecisionTreeEditor
                        tree={formData.trees[selectedTree]}
                        onUpdate={(field, value) => updateTree(selectedTree, field, value)}
                        onRemove={() => removeTree(selectedTree)}
                      />
                    )
                  ) : (
                    <Card className="border-slate-600 bg-slate-800/30">
                      <CardContent className="p-8 text-center">
                        <GitBranch className="w-8 h-8 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-500">Select a decision tree to edit</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Decision Tree Editor Component
 */
function DecisionTreeEditor({ tree, onUpdate, onRemove }) {
  const [selectedNode, setSelectedNode] = useState('root');

  const updateNode = (nodeId, field, value) => {
    if (nodeId === 'root') {
      onUpdate('rootNode', { ...tree.rootNode, [field]: value });
    } else {
      const updatedNodes = tree.nodes.map(node =>
        node.id === nodeId ? { ...node, [field]: value } : node
      );
      onUpdate('nodes', updatedNodes);
    }
  };

  const addAnswer = (nodeId) => {
    const newAnswer = {
      id: `answer-${Date.now()}`,
      text: '',
      nextNodeId: null
    };

    const currentNode = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);
    const updatedAnswers = [...(currentNode.answers || []), newAnswer];

    updateNode(nodeId, 'answers', updatedAnswers);
  };

  const updateAnswer = (nodeId, answerIndex, field, value) => {
    const currentNode = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);
    const updatedAnswers = [...currentNode.answers];
    updatedAnswers[answerIndex] = { ...updatedAnswers[answerIndex], [field]: value };

    updateNode(nodeId, 'answers', updatedAnswers);
  };

  const removeAnswer = (nodeId, answerIndex) => {
    const currentNode = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);
    const updatedAnswers = currentNode.answers.filter((_, i) => i !== answerIndex);

    updateNode(nodeId, 'answers', updatedAnswers);
  };

  const addNode = (parentNodeId, answerIndex) => {
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      question: '',
      answers: []
    };

    // Add to nodes array
    const updatedNodes = [...tree.nodes, newNode];
    onUpdate('nodes', updatedNodes);

    // Update the answer to point to this new node
    updateAnswer(parentNodeId, answerIndex, 'nextNodeId', newNodeId);

    setSelectedNode(newNodeId);
  };

  const currentNode = selectedNode === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === selectedNode);

  return (
    <div className="space-y-6">
      {/* Tree Header */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                {tree.title || 'Untitled Decision Tree'}
              </CardTitle>
              <Badge className="mt-1 bg-indigo-500/20 text-indigo-300">
                Decision Support System
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-slate-300">Tree Title</Label>
            <Input
              value={tree.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="e.g., Product Selection Guide"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visual Canvas (Simplified) */}
      <Card className="border-indigo-500/20 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">Decision Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <DecisionTreeCanvas
            tree={tree}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
          />
        </CardContent>
      </Card>

      {/* Node Editor */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">
            {selectedNode === 'root' ? 'Starting Question' : 'Decision Node'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-slate-300">Question</Label>
            <Textarea
              value={currentNode?.question || ''}
              onChange={(e) => updateNode(selectedNode, 'question', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="What decision does the user need to make?"
              rows={3}
            />
          </div>

          {/* Answers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-slate-300">Possible Answers</Label>
              <Button
                onClick={() => addAnswer(selectedNode)}
                size="sm"
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Answer
              </Button>
            </div>

            <div className="space-y-4">
              {(currentNode?.answers || []).map((answer, index) => (
                <AnswerEditor
                  key={answer.id}
                  answer={answer}
                  index={index}
                  nodeId={selectedNode}
                  tree={tree}
                  onUpdate={(field, value) => updateAnswer(selectedNode, index, field, value)}
                  onRemove={() => removeAnswer(selectedNode, index)}
                  onAddNode={() => addNode(selectedNode, index)}
                  onNodeSelect={setSelectedNode}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Answer Editor Component
 */
function AnswerEditor({ answer, index, nodeId, tree, onUpdate, onRemove, onAddNode, onNodeSelect }) {
  const nextNode = tree.nodes.find(n => n.id === answer.nextNodeId);

  return (
    <div className="flex gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <Label className="text-slate-300 text-sm">Answer Text</Label>
          <Input
            value={answer.text}
            onChange={(e) => onUpdate('text', e.target.value)}
            className="bg-slate-800/50 border-slate-600 text-white"
            placeholder="User's choice"
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-slate-300 text-sm">Leads to:</Label>
          {answer.nextNodeId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNodeSelect(answer.nextNodeId)}
                className="border-indigo-500/30 text-indigo-300"
              >
                Node: {nextNode?.question?.substring(0, 30) || 'Unnamed'}...
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdate('nextNodeId', null)}
                className="text-slate-400"
              >
                Clear
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={onAddNode}
                size="sm"
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Follow-up Question
              </Button>
              <span className="text-slate-500 text-sm self-center">or leave as end point</span>
            </div>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

/**
 * Simplified Decision Tree Canvas
 */
function DecisionTreeCanvas({ tree, selectedNode, onNodeSelect }) {
  const nodes = [
    { id: 'root', ...tree.rootNode, x: 300, y: 50 },
    ...tree.nodes.map((node, index) => ({
      ...node,
      x: 200 + (index * 200),
      y: 200 + (index * 150)
    }))
  ];

  return (
    <div className="relative h-96 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
      <svg className="w-full h-full">
        {/* Draw connections */}
        {nodes.map(node =>
          node.answers?.map(answer => {
            if (answer.nextNodeId) {
              const targetNode = nodes.find(n => n.id === answer.nextNodeId);
              if (targetNode) {
                return (
                  <line
                    key={`${node.id}-${answer.id}`}
                    x1={node.x + 100}
                    y1={node.y + 50}
                    x2={targetNode.x + 100}
                    y2={targetNode.y + 50}
                    stroke="#6366f1"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              }
            }
            return null;
          })
        )}

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>
      </svg>

      {/* Render nodes */}
      {nodes.map(node => (
        <motion.div
          key={node.id}
          className={`absolute w-48 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            selectedNode === node.id
              ? 'border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/25'
              : 'border-slate-600 bg-slate-800/80 hover:border-indigo-500/50'
          }`}
          style={{ left: node.x, top: node.y }}
          onClick={() => onNodeSelect(node.id)}
          whileHover={{ scale: 1.05 }}
        >
          <div className="text-white font-medium text-sm mb-2">
            {node.question || 'Question...'}
          </div>
          <div className="text-slate-400 text-xs">
            {node.answers?.length || 0} answers
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Decision Tree Preview Component
 */
function DecisionTreePreview({ tree }) {
  const [currentNode, setCurrentNode] = useState(tree.rootNode);
  const [path, setPath] = useState([]);

  const handleAnswer = (answer) => {
    if (answer.nextNodeId) {
      const nextNode = tree.nodes.find(n => n.id === answer.nextNodeId);
      if (nextNode) {
        setPath([...path, { node: currentNode, answer }]);
        setCurrentNode(nextNode);
      }
    } else {
      // End of decision tree
      setPath([...path, { node: currentNode, answer, isEnd: true }]);
    }
  };

  const reset = () => {
    setCurrentNode(tree.rootNode);
    setPath([]);
  };

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-slate-800/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Play className="w-5 h-5" />
            Decision Tree Preview
          </CardTitle>
          <Button onClick={reset} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Path History */}
        {path.length > 0 && (
          <div className="space-y-2">
            <Label className="text-slate-300">Decision Path:</Label>
            <div className="flex flex-wrap gap-2">
              {path.map((step, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Q{index + 1}:</span>
                  <Badge className="bg-indigo-500/20 text-indigo-300">
                    {step.answer.text}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Question */}
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center mx-auto">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {currentNode.question || 'No question defined'}
            </h3>

            {currentNode.answers?.length > 0 ? (
              <div className="space-y-3 max-w-md mx-auto">
                {currentNode.answers.map((answer, index) => (
                  <motion.div
                    key={answer.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => handleAnswer(answer)}
                      className="w-full justify-start text-left bg-slate-800/50 hover:bg-indigo-500/20 border border-slate-700 hover:border-indigo-500/50 text-white"
                      variant="outline"
                    >
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </span>
                      {answer.text || 'Answer option'}
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <Badge className="bg-green-500/20 text-green-300 mb-4">
                  Decision Complete
                </Badge>
                <p className="text-slate-400">This is the end of the decision tree.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DecisionTreeBuilder;