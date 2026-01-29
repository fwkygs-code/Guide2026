import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Plus, Trash2, Code, Link, ExternalLink } from 'lucide-react';
import { useWorkspaceSlug } from '../../../hooks/useWorkspaceSlug';
import { DocumentationSystem, createDocumentationSystem } from './model';
import { getDocumentationSystem, updateDocumentationSystem, createDocumentationSystemEntry, publishDocumentationSystemEntry } from './service';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

function DocumentationRichTextEditor({ content, onChange, placeholder }: { content: string; onChange: (content: string) => void; placeholder: string }) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content || '';
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertCodeBlock = () => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const codeBlock = document.createElement('pre');
    codeBlock.className = 'bg-slate-800 border border-slate-600 rounded p-3 my-3 overflow-x-auto';
    const code = document.createElement('code');
    code.className = 'text-green-400 font-mono text-sm';
    code.textContent = '// Enter code here...';
    codeBlock.appendChild(code);
    range.deleteContents();
    range.insertNode(codeBlock);
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) execCommand('createLink', url);
  };

  return (
    <div className="border border-slate-600/50 rounded-lg overflow-hidden">
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => execCommand('bold')} className="h-8 w-8 p-0"><strong>B</strong></Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('italic')} className="h-8 w-8 p-0"><em>I</em></Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'code')} className="h-8 w-8 p-0"><Code className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} className="h-8 w-8 p-0">•</Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} className="h-8 w-8 p-0">1.</Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'blockquote')} className="h-8 w-8 p-0">"</Button>
        <Button variant="ghost" size="sm" onClick={insertCodeBlock} className="h-8 w-8 p-0"><FileCode className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertLink} className="h-8 w-8 p-0"><ExternalLink className="w-4 h-4" /></Button>
      </div>
      <div ref={editorRef} contentEditable className="min-h-[120px] p-4 text-slate-200 focus:outline-none prose prose-invert max-w-none" onInput={handleInput} data-placeholder={placeholder} suppressContentEditableWarning={true} style={{ fontFamily: 'system-ui, sans-serif' }} />
    </div>
  );
}

export function DocumentationEditorRoot() {
  const { workspaceSlug, itemId } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [system, setSystem] = useState<DocumentationSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (workspaceId && itemId) loadSystem();
    else if (workspaceId) setLoading(false);
  }, [workspaceId, itemId]);

  const loadSystem = async () => {
    try {
      const systemData = getDocumentationSystem(itemId!);
      if (systemData) setSystem(systemData);
    } catch (error) {
      console.error('Failed to load documentation system:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDraftContent = (updates: any) => {
    if (!system) return;
    const updatedSystem = { ...system, draftContent: { ...system.draftContent, ...updates } };
    updateDocumentationSystem(system.id, { draftContent: updatedSystem.draftContent });
    setSystem(updatedSystem);
  };

  const handlePublish = async () => {
    if (!system) return;
    setPublishing(true);
    try {
      const publishedSystem = publishDocumentationSystemEntry(system.id);
      if (publishedSystem) setSystem(publishedSystem);
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
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-8 text-center space-y-6">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Create Documentation System</h1>
        <Button onClick={() => {
          const newSystem = createDocumentationSystemEntry({ workspaceId: workspaceId! });
          setSystem(newSystem);
        }} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
          <Plus className="w-4 h-4 mr-2" /> Create Documentation System
        </Button>
      </div>
    </div>;
  }

  const draftContent = system.draftContent;
  const hasPublishedContent = system.publishedContent !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-10 border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Documentation Builder</h1>
                <p className="text-slate-400 text-sm">Create comprehensive technical documentation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)} className="border-slate-600 text-slate-300">Close</Button>
              <Button onClick={handlePublish} disabled={publishing} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                Publish to Portal
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-slate-800 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><FileText className="w-5 h-5" /> Documentation Information</CardTitle>
                <Badge className={hasPublishedContent ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                  {hasPublishedContent ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Documentation Title</Label>
                <Input value={draftContent.title} onChange={(e) => updateDraftContent({ title: e.target.value })} className="bg-slate-800/50 border-slate-600 text-white" placeholder="Enter documentation title" />
              </div>
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea value={draftContent.description} onChange={(e) => updateDraftContent({ description: e.target.value })} className="bg-slate-800/50 border-slate-600 text-white" placeholder="Brief description of this documentation" rows={3} />
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Documentation Structure</h2>
              <p className="text-slate-400">Hierarchical sections with subsections for comprehensive knowledge organization</p>
            </div>
            <Button onClick={() => {
              const newSection = { id: `section-${Date.now()}`, title: '', content: '', subsections: [], order: draftContent.sections.length + 1 };
              updateDraftContent({ sections: [...draftContent.sections, newSection] });
            }} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Plus className="w-4 h-4 mr-2" /> Add Section
            </Button>
          </div>
          <div className="space-y-6">
            {draftContent.sections.map((section, index) => (
              <Card key={section.id} className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-slate-800/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Section {section.order}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const updatedSections = draftContent.sections.filter((_, i) => i !== index);
                      updateDraftContent({ sections: updatedSections });
                    }} className="text-slate-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input value={section.title} onChange={(e) => {
                    const updatedSections = [...draftContent.sections];
                    updatedSections[index].title = e.target.value;
                    updateDraftContent({ sections: updatedSections });
                  }} className="bg-slate-800/50 border-slate-600 text-white" placeholder="Section title" />
                  <DocumentationRichTextEditor content={section.content} onChange={(content) => {
                    const updatedSections = [...draftContent.sections];
                    updatedSections[index].content = content;
                    updateDraftContent({ sections: updatedSections });
                  }} placeholder="Section content..." />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}