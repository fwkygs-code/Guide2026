import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow, FileText, Plus, Trash2, GripVertical, CheckSquare, AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { useWorkspaceSlug } from '../../../hooks/useWorkspaceSlug';
import { ProcedureSystem, createProcedureSystem, ProcedureContent } from './model';
import { getProcedureSystem, updateProcedureSystem, createProcedureSystemEntry, publishProcedureSystemEntry } from './service';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

function ProcedureRichTextEditor({ content, onChange, placeholder }: {
  content: string;
  onChange: (content: string) => void;
  placeholder: string;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content || '';
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertCallout = (type: string, defaultText: string) => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const callout = document.createElement('div');
    callout.className = `flex items-start gap-3 p-3 rounded-lg border my-3 ${
      type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' :
      type === 'warning' ? 'bg-red-500/10 border-red-500/30 text-red-200' :
      'bg-yellow-500/10 border-yellow-500/30 text-yellow-200'
    }`;

    callout.innerHTML = `
      <div class="flex-shrink-0 mt-0.5">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '⚡'}</div>
      <div class="flex-1">${defaultText}</div>
    `;

    range.deleteContents();
    range.insertNode(callout);
    handleInput();
  };

  return (
    <div className="border border-slate-600/50 rounded-lg overflow-hidden">
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => execCommand('bold')} className="h-8 w-8 p-0">
          <strong>B</strong>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('italic')} className="h-8 w-8 p-0">
          <em>I</em>
        </Button>
        <div className="w-px h-6 bg-slate-600/50 mx-1" />
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} className="h-8 w-8 p-0">
          1.
        </Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} className="h-8 w-8 p-0">
          •
        </Button>
        <div className="w-px h-6 bg-slate-600/50 mx-1" />
        <Button variant="ghost" size="sm" onClick={() => insertCallout('success', 'Verification step: Confirm completion before proceeding.')} className="h-8 w-8 p-0">
          <CheckSquare className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => insertCallout('warning', 'Caution: Ensure safety protocols are followed.')} className="h-8 w-8 p-0">
          <AlertTriangle className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => insertCallout('important', 'Important: This step is critical for success.')} className="h-8 w-8 p-0">
          <Zap className="w-4 h-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-4 text-slate-200 focus:outline-none prose prose-invert max-w-none"
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      />
    </div>
  );
}

export function ProcedureEditorRoot() {
  const { workspaceSlug, itemId } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  const [system, setSystem] = useState<ProcedureSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (workspaceId && itemId) {
      loadSystem();
    } else if (workspaceId) {
      createNewSystem();
    }
  }, [workspaceId, itemId]);

  const loadSystem = async () => {
    try {
      const systemData = getProcedureSystem(itemId!);
      if (systemData) {
        setSystem(systemData);
      }
    } catch (error) {
      console.error('Failed to load procedure system:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSystem = async () => {
    setLoading(false);
  };

  const updateDraftContent = (updates: Partial<ProcedureContent>) => {
    if (!system) return;

    const updatedSystem = {
      ...system,
      draftContent: {
        ...system.draftContent,
        ...updates
      }
    };

    updateProcedureSystem(system.id, { draftContent: updatedSystem.draftContent });
    setSystem(updatedSystem);
  };

  const updateProcedure = (index: number, field: string, value: any) => {
    const updatedProcedures = [...system!.draftContent.procedures];
    updatedProcedures[index] = {
      ...updatedProcedures[index],
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    updateDraftContent({ procedures: updatedProcedures });
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
    const updatedProcedures = [...system!.draftContent.procedures, newProcedure];
    updateDraftContent({ procedures: updatedProcedures });
  };

  const removeProcedure = (index: number) => {
    const updatedProcedures = system!.draftContent.procedures.filter((_, i) => i !== index);
    updateDraftContent({ procedures: updatedProcedures });
  };

  const addStep = (procedureIndex: number) => {
    const procedure = system!.draftContent.procedures[procedureIndex];
    const newStep = {
      id: `step-${Date.now()}`,
      title: '',
      description: '',
      order: procedure.steps.length + 1
    };
    updateProcedure(procedureIndex, 'steps', [...procedure.steps, newStep]);
  };

  const updateStep = (procedureIndex: number, stepIndex: number, field: string, value: any) => {
    const procedure = system!.draftContent.procedures[procedureIndex];
    const updatedSteps = [...procedure.steps];
    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      [field]: value
    };
    updateProcedure(procedureIndex, 'steps', updatedSteps);
  };

  const removeStep = (procedureIndex: number, stepIndex: number) => {
    const procedure = system!.draftContent.procedures[procedureIndex];
    const updatedSteps = procedure.steps.filter((_, i) => i !== stepIndex).map((step, i) => ({ ...step, order: i + 1 }));
    updateProcedure(procedureIndex, 'steps', updatedSteps);
  };

  const handlePublish = async () => {
    if (!system) return;

    setPublishing(true);
    try {
      const publishedSystem = publishProcedureSystemEntry(system.id);
      if (publishedSystem) {
        setSystem(publishedSystem);
      }
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <video
          width={160}
          height={160}
          style={{ width: 160, height: 160 }}
          className="object-contain"
          autoPlay
          muted
          playsInline
          preload="auto"
        >
          <source src={ANIMATIONX_URL} />
        </video>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto">
              <Workflow className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">Create Procedure System</h1>
              <p className="text-slate-400">Set up your workflow documentation system</p>
            </div>
            <Button onClick={() => {
              const newSystem = createProcedureSystemEntry({ workspaceId: workspaceId! });
              setSystem(newSystem);
            }} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Procedure System
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const draftContent = system.draftContent;
  const hasPublishedContent = system.publishedContent !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
              <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)} className="border-slate-600 text-slate-300">
                Close
              </Button>
              <Button onClick={handlePublish} disabled={publishing} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                Publish to Portal
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5" />
                    Procedure Information
                  </CardTitle>
                  <Badge className={hasPublishedContent ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                    {hasPublishedContent ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Procedure Title</Label>
                  <Input
                    value={draftContent.title}
                    onChange={(e) => updateDraftContent({ title: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter procedure collection title"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={draftContent.description}
                    onChange={(e) => updateDraftContent({ description: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this procedure collection"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
              {draftContent.procedures.map((procedure, index) => (
                <Card key={procedure.id} className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-slate-800/50 backdrop-blur-sm">
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
                      <Button variant="ghost" size="sm" onClick={() => removeProcedure(index)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
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
                          onChange={(e) => updateProcedure(index, 'title', e.target.value)}
                          className="bg-slate-800/50 border-slate-600 text-white"
                          placeholder="e.g., User Onboarding Process"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Category (Optional)</Label>
                        <Input
                          value={procedure.category}
                          onChange={(e) => updateProcedure(index, 'category', e.target.value)}
                          className="bg-slate-800/50 border-slate-600 text-white"
                          placeholder="e.g., HR, Operations, IT"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Overview</Label>
                      <Textarea
                        value={procedure.description}
                        onChange={(e) => updateProcedure(index, 'description', e.target.value)}
                        className="bg-slate-800/50 border-slate-600 text-white"
                        placeholder="Brief overview of this procedure and its purpose"
                        rows={2}
                      />
                    </div>

                    <div className="border-t border-cyan-500/20 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-cyan-100">Procedure Steps</h4>
                        <Button onClick={() => addStep(index)} size="sm" className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Step
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {procedure.steps.map((step, stepIndex) => (
                          <div key={step.id} className="flex gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {step.order}
                              </div>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label className="text-slate-300 text-sm">Step Title</Label>
                                <Input
                                  value={step.title}
                                  onChange={(e) => updateStep(index, stepIndex, 'title', e.target.value)}
                                  className="bg-slate-800/50 border-slate-600 text-white text-sm"
                                  placeholder="Brief step title"
                                />
                              </div>
                              <div>
                                <Label className="text-slate-300 text-sm">Description</Label>
                                <ProcedureRichTextEditor
                                  content={step.description}
                                  onChange={(content) => updateStep(index, stepIndex, 'description', content)}
                                  placeholder="Detailed step instructions..."
                                />
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeStep(index, stepIndex)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}