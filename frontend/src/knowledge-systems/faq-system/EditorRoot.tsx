import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceSlug } from '../../../hooks/useWorkspaceSlug';
import { FAQSystem, createFAQSystem } from './model';
import { getFAQSystem, updateFAQSystem, createFAQSystemEntry, publishFAQSystemEntry } from './service';

function FAQRichTextEditor({ content, onChange, placeholder }: { content: string; onChange: (content: string) => void; placeholder: string }) {
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

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) execCommand('createLink', url);
  };

  return (
    <div className="border border-slate-600/50 rounded-lg overflow-hidden">
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => execCommand('bold')} className="h-8 w-8 p-0"><strong>B</strong></Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('italic')} className="h-8 w-8 p-0"><em>I</em></Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} className="h-8 w-8 p-0">•</Button>
        <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} className="h-8 w-8 p-0">1.</Button>
        <Button variant="ghost" size="sm" onClick={insertLink} className="h-8 w-8 p-0"><span>🔗</span></Button>
      </div>
      <div ref={editorRef} contentEditable className="min-h-[120px] p-4 text-slate-200 focus:outline-none prose prose-invert max-w-none" onInput={handleInput} data-placeholder={placeholder} suppressContentEditableWarning={true} style={{ fontFamily: 'system-ui, sans-serif' }} />
    </div>
  );
}

export function FAQEditorRoot() {
  const { workspaceSlug, itemId } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [system, setSystem] = useState<FAQSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (workspaceId && itemId) loadSystem();
    else if (workspaceId) setLoading(false);
  }, [workspaceId, itemId]);

  const loadSystem = async () => {
    try {
      const systemData = getFAQSystem(itemId!);
      if (systemData) setSystem(systemData);
    } catch (error) {
      console.error('Failed to load FAQ system:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDraftContent = (updates: any) => {
    if (!system) return;
    const updatedSystem = { ...system, draftContent: { ...system.draftContent, ...updates } };
    updateFAQSystem(system.id, { draftContent: updatedSystem.draftContent });
    setSystem(updatedSystem);
  };

  const updateFAQ = (index: number, field: string, value: any) => {
    const updatedFAQs = [...system!.draftContent.faqs];
    updatedFAQs[index] = { ...updatedFAQs[index], [field]: value };
    updateDraftContent({ faqs: updatedFAQs });
  };

  const addFAQ = () => {
    const newFAQ = { id: `faq-${Date.now()}`, question: '', answer: '', category: '', tags: [] };
    const updatedFAQs = [...system!.draftContent.faqs, newFAQ];
    updateDraftContent({ faqs: updatedFAQs });
  };

  const removeFAQ = (index: number) => {
    const updatedFAQs = system!.draftContent.faqs.filter((_, i) => i !== index);
    updateDraftContent({ faqs: updatedFAQs });
  };

  const handlePublish = async () => {
    if (!system) return;
    setPublishing(true);
    try {
      const publishedSystem = publishFAQSystemEntry(system.id);
      if (publishedSystem) setSystem(publishedSystem);
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  if (workspaceLoading || loading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full" />
    </div>;
  }

  if (!system) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-8 text-center space-y-6">
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Create FAQ System</h1>
        <Button onClick={() => {
          const newSystem = createFAQSystemEntry({ workspaceId: workspaceId! });
          setSystem(newSystem);
        }} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
          <Plus className="w-4 h-4 mr-2" /> Create FAQ System
        </Button>
      </div>
    </div>;
  }

  const draftContent = system.draftContent;
  const hasPublishedContent = system.publishedContent !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-10 border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">FAQ Builder</h1>
                <p className="text-slate-400 text-sm">Create helpful Q&A content with instant preview</p>
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
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-slate-800 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><HelpCircle className="w-5 h-5" /> FAQ Information</CardTitle>
                <Badge className={hasPublishedContent ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                  {hasPublishedContent ? 'Published' : 'Draft'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">FAQ Title</Label>
                <Input value={draftContent.title} onChange={(e) => updateDraftContent({ title: e.target.value })} className="bg-slate-800/50 border-slate-600 text-white" placeholder="Enter FAQ collection title" />
              </div>
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea value={draftContent.description} onChange={(e) => updateDraftContent({ description: e.target.value })} className="bg-slate-800/50 border-slate-600 text-white" placeholder="Brief description of this FAQ collection" rows={3} />
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">FAQ Editor</h2>
              <p className="text-slate-400">Create Q&A pairs with drag-to-reorder functionality</p>
            </div>
            <Button onClick={addFAQ} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
              <Plus className="w-4 h-4 mr-2" /> Add FAQ
            </Button>
          </div>
          <div className="space-y-4">
            {draftContent.faqs.map((faq, index) => (
              <Card key={faq.id} className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-slate-800/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <CardTitle className="text-white">FAQ {index + 1}</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFAQ(index)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Question</Label>
                    <Input value={faq.question} onChange={(e) => updateFAQ(index, 'question', e.target.value)} className="bg-slate-800/50 border-slate-600 text-white" placeholder="What question are users asking?" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Answer</Label>
                    <FAQRichTextEditor content={faq.answer} onChange={(content) => updateFAQ(index, 'answer', content)} placeholder="Provide a clear, helpful answer..." />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-slate-300">Category (Optional)</Label>
                      <Input value={faq.category} onChange={(e) => updateFAQ(index, 'category', e.target.value)} className="bg-slate-800/50 border-slate-600 text-white" placeholder="e.g., Getting Started, Billing, Technical" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}