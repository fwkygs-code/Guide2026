/**
 * Procedure Builder - Precision & Workflow
 *
 * Structured step-by-step procedure editor with workflow visualization.
 * Cool cyan theming represents systematic precision and operational excellence.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow, FileText, Plus, Trash2, GripVertical, ArrowDown } from 'lucide-react';
import RichTextEditor from '../../../components/canvas-builder/RichTextEditor';

/**
 * Procedure Builder Interface
 */
function ProcedureBuilder({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title || 'Standard Procedures',
    description: system.description || '',
    procedures: system.content?.procedures || []
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateProcedure = (index, field, value) => {
    const updatedProcedures = [...formData.procedures];
    updatedProcedures[index] = {
      ...updatedProcedures[index],
      [field]: value
    };
    updateFormData('procedures', updatedProcedures);
  };

  const addProcedure = () => {
    const newProcedure = {
      id: `procedure-${Date.now()}`,
      title: '',
      description: '',
      steps: [],
      category: '',
      lastUpdated: new Date().toISOString()
    };
    updateFormData('procedures', [...formData.procedures, newProcedure]);
  };

  const removeProcedure = (index) => {
    const updatedProcedures = formData.procedures.filter((_, i) => i !== index);
    updateFormData('procedures', updatedProcedures);
  };

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      content: {
        procedures: formData.procedures
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-cyan-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Workflow className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Procedure Builder</h1>
                <p className="text-slate-400 text-sm">Create systematic step-by-step procedures</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Save Procedures
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-8">

          {/* Basic Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5" />
                  Procedure Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Procedure Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter procedure collection title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this procedure collection"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Procedures */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Procedure Documents</h2>
                <p className="text-slate-400">Structured procedures with ordered steps and workflow visualization</p>
              </div>
              <Button onClick={addProcedure} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Procedure
              </Button>
            </div>

            <div className="space-y-6">
              {formData.procedures.length === 0 ? (
                <Card className="border-dashed border-slate-600 bg-slate-800/30">
                  <CardContent className="p-8 text-center">
                    <Workflow className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300 mb-2">No Procedures</h3>
                    <p className="text-slate-500 mb-4">Add structured procedures with step-by-step workflows</p>
                    <Button onClick={addProcedure} variant="outline" className="border-slate-600 text-slate-300">
                      Add First Procedure
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                formData.procedures.map((procedure, index) => (
                  <ProcedureCard
                    key={procedure.id}
                    procedure={procedure}
                    index={index}
                    onUpdate={(field, value) => updateProcedure(index, field, value)}
                    onRemove={() => removeProcedure(index)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Procedure Card with Steps
 */
function ProcedureCard({ procedure, index, onUpdate, onRemove }) {
  const [draggedStep, setDraggedStep] = useState(null);

  const updateStep = (stepIndex, field, value) => {
    const updatedSteps = [...procedure.steps];
    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      [field]: value
    };
    onUpdate('steps', updatedSteps);
  };

  const addStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      title: '',
      description: '',
      order: procedure.steps.length + 1
    };
    onUpdate('steps', [...procedure.steps, newStep]);
  };

  const removeStep = (stepIndex) => {
    const updatedSteps = procedure.steps.filter((_, i) => i !== stepIndex);
    // Reorder remaining steps
    updatedSteps.forEach((step, i) => step.order = i + 1);
    onUpdate('steps', updatedSteps);
  };

  const handleDragStart = (e, stepIndex) => {
    setDraggedStep(stepIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedStep === null || draggedStep === dropIndex) return;

    const updatedSteps = [...procedure.steps];
    const [removed] = updatedSteps.splice(draggedStep, 1);
    updatedSteps.splice(dropIndex, 0, removed);

    // Update order numbers
    updatedSteps.forEach((step, i) => step.order = i + 1);
    onUpdate('steps', updatedSteps);
    setDraggedStep(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-slate-800/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <CardTitle className="text-white">Procedure {index + 1}</CardTitle>
                <Badge variant="secondary" className="mt-1 bg-cyan-500/20 text-cyan-300">
                  Workflow Process
                </Badge>
              </div>
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

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Procedure Title</Label>
              <Input
                value={procedure.title}
                onChange={(e) => onUpdate('title', e.target.value)}
                className="bg-slate-800/50 border-slate-600 text-white"
                placeholder="e.g., User Onboarding Process"
              />
            </div>

            <div>
              <Label className="text-slate-300">Category (Optional)</Label>
              <Input
                value={procedure.category}
                onChange={(e) => onUpdate('category', e.target.value)}
                className="bg-slate-800/50 border-slate-600 text-white"
                placeholder="e.g., HR, Operations, IT"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Overview</Label>
            <Textarea
              value={procedure.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="Brief overview of this procedure and its purpose"
              rows={2}
            />
          </div>

          {/* Steps Section */}
          <div className="border-t border-cyan-500/20 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-cyan-100">Procedure Steps</h4>
              <Button onClick={addStep} size="sm" className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100">
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>

            <div className="space-y-3">
              {procedure.steps.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-lg">
                  <Workflow className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No steps defined yet</p>
                  <Button onClick={addStep} variant="ghost" size="sm" className="mt-2 text-cyan-400">
                    Add First Step
                  </Button>
                </div>
              ) : (
                procedure.steps.map((step, stepIndex) => (
                  <StepItem
                    key={step.id}
                    step={step}
                    index={stepIndex}
                    onUpdate={(field, value) => updateStep(stepIndex, field, value)}
                    onRemove={() => removeStep(stepIndex)}
                    onDragStart={(e) => handleDragStart(e, stepIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stepIndex)}
                    isLast={stepIndex === procedure.steps.length - 1}
                  />
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Individual Step Item with Drag Support
 */
function StepItem({ step, index, onUpdate, onRemove, onDragStart, onDragOver, onDrop, isLast }) {
  return (
    <>
      <motion.div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="group flex gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-colors cursor-move"
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex items-center gap-3">
          <div className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {step.order}
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <Label className="text-slate-300 text-sm">Step Title</Label>
            <Input
              value={step.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white text-sm"
              placeholder="Brief step title"
            />
          </div>

          <div>
            <Label className="text-slate-300 text-sm">Description</Label>
            <div className="min-h-[80px] bg-slate-800/30 rounded-md border border-slate-600">
              <RichTextEditor
                content={step.description}
                onChange={(content) => onUpdate('description', content)}
                placeholder="Detailed step instructions..."
                className="text-white text-sm"
              />
            </div>
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
      </motion.div>

      {!isLast && (
        <div className="flex justify-center py-2">
          <ArrowDown className="w-4 h-4 text-cyan-400/60" />
        </div>
      )}
    </>
  );
}

export default ProcedureBuilder;