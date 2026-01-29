// Policy Editor Root - Complete Isolation
// No shared components, no imports from other systems

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Label, Textarea, Card, CardContent, CardHeader, CardTitle, Badge, FadeIn } from './ui';
import { PolicySystem, createPolicySystem, PolicyContent } from './model';
import { loadDraft, saveDraft, createPolicySystemEntry, updateDraft, publish } from './service';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

// Policy-specific Rich Text Editor - No shared editors
function PolicyRichTextEditor({ content, onChange, placeholder }: {
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
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} className="h-8 w-8 p-0">
          •
        </Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} className="h-8 w-8 p-0">
          1.
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-4 text-slate-200 focus:outline-none prose prose-invert max-w-none"
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        style={{ fontFamily: 'Georgia, serif' }}
      />
    </div>
  );
}

export function PolicyEditorRoot() {
  const { itemId } = useParams();

  const [system, setSystem] = useState<PolicySystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (itemId) {
      loadSystem();
    } else {
      createNewSystem();
    }
  }, [itemId]);

  const loadSystem = async () => {
    try {
      const systemData = loadDraft(itemId!);
      if (systemData) {
        setSystem(systemData);
      }
    } catch (error) {
      console.error('Failed to load policy system:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSystem = async () => {
    const newSystem = createPolicySystemEntry({ workspaceId: 'default' });
    setSystem(newSystem);
    setLoading(false);
  };

  const updateDraftContent = (updates: Partial<PolicyContent>) => {
    if (!system) return;

    const updatedSystem = {
      ...system,
      draftContent: {
        ...system.draftContent,
        ...updates
      }
    };

    saveDraft(system.id, updatedSystem);
    setSystem(updatedSystem);
  };

  const updatePolicy = (index: number, field: string, value: string) => {
    const updatedPolicies = [...system!.draftContent.policies];
    updatedPolicies[index] = {
      ...updatedPolicies[index],
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    updateDraftContent({ policies: updatedPolicies });
  };

  const addPolicy = () => {
    const newPolicy = {
      id: `policy-section-${Date.now()}`,
      title: '',
      content: '',
      category: '',
      lastUpdated: new Date().toISOString()
    };
    const updatedPolicies = [...system!.draftContent.policies, newPolicy];
    updateDraftContent({ policies: updatedPolicies });
  };

  const removePolicy = (index: number) => {
    const updatedPolicies = system!.draftContent.policies.filter((_, i) => i !== index);
    updateDraftContent({ policies: updatedPolicies });
  };

  const handlePublish = async () => {
    if (!system) return;

    setPublishing(true);
    try {
      const publishedSystem = publish(system.id);
      if (publishedSystem) {
        setSystem(publishedSystem);
      }
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
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
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">Create Policy System</h1>
              <p className="text-slate-400">Set up your authoritative policy documentation system</p>
            </div>
            <Button onClick={() => {
              const newSystem = createPolicySystemEntry({ workspaceId: workspaceId! });
              setSystem(newSystem);
            }} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Policy System
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
      <div className="sticky top-0 z-10 border-b border-amber-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Policy Builder</h1>
                <p className="text-slate-400 text-sm">Create authoritative policy documents</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)} className="border-slate-600 text-slate-300">
                Close
              </Button>
              <Button onClick={handlePublish} disabled={publishing} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                <Upload className="w-4 h-4 mr-2" />
                {publishing ? 'Publishing...' : 'Publish to Portal'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <FadeIn><div className="space-y-6">
            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5" />
                    Policy Information
                  </CardTitle>
                  <Badge className={hasPublishedContent ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                    {hasPublishedContent ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Policy Title</Label>
                  <Input
                    value={draftContent.title}
                    onChange={(e) => updateDraftContent({ title: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter official policy title"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={draftContent.description}
                    onChange={(e) => updateDraftContent({ description: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this policy"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Effective Date
                    </Label>
                    <Input
                      type="date"
                      value={draftContent.effectiveDate}
                      onChange={(e) => updateDraftContent({ effectiveDate: e.target.value })}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Jurisdiction</Label>
                    <Input
                      value={draftContent.jurisdiction}
                      onChange={(e) => updateDraftContent({ jurisdiction: e.target.value })}
                      className="bg-slate-800/50 border-slate-600 text-white"
                      placeholder="e.g., Global, United States"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div></FadeIn>

          <FadeIn><div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Policy Sections</h2>
                <p className="text-slate-400">Structured legal content with clear sections</p>
              </div>
              <Button onClick={addPolicy} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>
            <div className="space-y-6">
              {draftContent.policies.map((policy, index) => (
                <Card key={policy.id} className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-slate-800/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <CardTitle className="text-white">Section {index + 1}</CardTitle>
                          <Badge variant="secondary" className="mt-1 bg-amber-500/20 text-amber-300">
                            Policy Content
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePolicy(index)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Section Title</Label>
                      <Input
                        value={policy.title}
                        onChange={(e) => updatePolicy(index, 'title', e.target.value)}
                        className="bg-slate-800/50 border-slate-600 text-white"
                        placeholder="e.g., Purpose, Scope, Definitions"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Category (Optional)</Label>
                      <Input
                        value={policy.category}
                        onChange={(e) => updatePolicy(index, 'category', e.target.value)}
                        className="bg-slate-800/50 border-slate-600 text-white"
                        placeholder="e.g., HR, Security, Compliance"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Content</Label>
                      <PolicyRichTextEditor
                        content={policy.content}
                        onChange={(content) => updatePolicy(index, 'content', content)}
                        placeholder="Enter policy content with clear, authoritative language..."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div></FadeIn>
        </div>
      </div>
    </div>
  );
}