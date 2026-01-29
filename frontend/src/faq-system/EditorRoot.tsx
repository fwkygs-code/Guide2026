import React, { useEffect, useRef, useState } from 'react';
import { FAQDraft, FAQItem, FAQMeta } from './model';
import { createFAQEntry, loadFAQDraft, loadFAQMeta, publishFAQ, saveFAQDraft } from './service';
import sanitizeHtml from './sanitizeHtml';
import WorkspaceLoader from '../components/WorkspaceLoader';

type FAQEditorRootProps = {
  workspaceId?: string;
  itemId?: string;
  closeHref?: string;
};

const FAQRichTextEditor = ({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, commandValue?: string) => {
    document.execCommand(command, false, commandValue);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const url = window.prompt('Link URL');
    if (url) {
      exec('createLink', url);
    }
  };

  return (
    <div className="border border-emerald-500/20 bg-slate-900/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-emerald-500/20 bg-slate-900/80 p-2">
        <button type="button" className="px-2 py-1 text-xs text-emerald-200 hover:text-white" onClick={() => exec('bold')}>
          Bold
        </button>
        <button type="button" className="px-2 py-1 text-xs text-emerald-200 hover:text-white" onClick={() => exec('italic')}>
          Italic
        </button>
        <button type="button" className="px-2 py-1 text-xs text-emerald-200 hover:text-white" onClick={() => exec('insertUnorderedList')}>
          Bullets
        </button>
        <button type="button" className="px-2 py-1 text-xs text-emerald-200 hover:text-white" onClick={insertLink}>
          Link
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder={placeholder}
        className="min-h-[110px] p-4 text-emerald-50/90 focus:outline-none"
      />
    </div>
  );
};

export const FAQEditorRoot = ({ workspaceId, itemId, closeHref }: FAQEditorRootProps) => {
  const [draft, setDraft] = useState<FAQDraft | null>(null);
  const [meta, setMeta] = useState<FAQMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    if (itemId) {
      const existingDraft = loadFAQDraft(itemId);
      const existingMeta = loadFAQMeta(itemId);
      if (existingDraft && existingMeta) {
        setDraft(existingDraft);
        setMeta(existingMeta);
        setLoading(false);
        return;
      }
      const created = createFAQEntry(workspaceId, itemId);
      setDraft(created.draft);
      setMeta(created.meta);
      setLoading(false);
      return;
    }

    const created = createFAQEntry(workspaceId);
    setDraft(created.draft);
    setMeta(created.meta);
    setLoading(false);
  }, [workspaceId, itemId]);

  const persistDraft = (nextDraft: FAQDraft) => {
    if (!meta) return;
    const saved = saveFAQDraft(meta.id, nextDraft);
    setDraft(saved.draft);
    setMeta(saved.meta);
  };

  const updateDraft = (updates: Partial<FAQDraft>) => {
    if (!draft) return;
    persistDraft({ ...draft, ...updates });
  };

  const updateItem = (index: number, updates: Partial<FAQItem>) => {
    if (!draft) return;
    const updatedItems = draft.items.map((item, idx) => (
      idx === index ? { ...item, ...updates } : item
    ));
    updateDraft({ items: updatedItems });
  };

  const addItem = () => {
    if (!draft) return;
    const newItem: FAQItem = {
      id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: '',
      answer: '',
      category: '',
      tags: []
    };
    updateDraft({ items: [...draft.items, newItem] });
  };

  const removeItem = (index: number) => {
    if (!draft) return;
    const updated = draft.items.filter((_, idx) => idx !== index);
    updateDraft({ items: updated.length ? updated : draft.items });
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || !draft) return;
    const updated = [...draft.items];
    const [item] = updated.splice(dragIndex, 1);
    updated.splice(targetIndex, 0, item);
    updateDraft({ items: updated });
    setDragIndex(null);
  };

  const handlePublish = () => {
    if (!meta) return;
    try {
      const result = publishFAQ(meta.id);
      setMeta(result.meta);
      setPublishError('');
    } catch (error) {
      setPublishError('Publish failed. Fix FAQ items before publishing.');
    }
  };

  if (loading || !draft || !meta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  const statusLabel = meta.publishedAt ? 'Published' : 'Draft';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-emerald-50">
      <header className="sticky top-0 z-20 border-b border-emerald-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">FAQs</p>
            <h1 className="text-3xl font-semibold tracking-wide">{draft.title || 'FAQ Set'}</h1>
            <p className="text-sm text-emerald-200/70">Question-first knowledge builder</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.2em] rounded-full border border-emerald-400/40 text-emerald-200">
              {statusLabel}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-50 hover:bg-emerald-500/40 transition"
              onClick={handlePublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-400 transition"
              onClick={() => {
                if (closeHref) {
                  window.location.href = closeHref;
                } else {
                  window.history.back();
                }
              }}
            >
              Close
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        <section className="space-y-6">
          <div className="border border-emerald-500/20 bg-slate-900/60 rounded-2xl p-6 shadow-xl space-y-4">
            <label className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">FAQ Title</label>
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="bg-transparent border-b border-emerald-400/30 text-2xl font-semibold focus:outline-none focus:border-emerald-400"
              placeholder="Help Center"
            />
            <label className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Description</label>
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              className="min-h-[80px] bg-slate-950/60 border border-emerald-500/20 rounded-lg p-3 text-emerald-50 focus:outline-none focus:border-emerald-400/50"
              placeholder="Fast answers for common questions"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">FAQ Builder</h2>
              <p className="text-sm text-emerald-200/70">Drag to reorder and preview instantly</p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-50 hover:bg-emerald-500/40 transition"
              onClick={addItem}
            >
              Add Question
            </button>
          </div>

          <div className="space-y-4">
            {draft.items.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
                className={`border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-6 space-y-4 ${
                  dragIndex === index ? 'ring-2 ring-emerald-400/40' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200/60 border border-emerald-400/30 rounded-full">
                      Drag
                    </span>
                    <span className="text-sm text-emerald-200/70">FAQ {index + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="px-3 py-1 text-xs border border-emerald-400/30 rounded-full text-emerald-200 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Question</label>
                  <input
                    value={item.question}
                    onChange={(event) => updateItem(index, { question: event.target.value })}
                    className="w-full bg-slate-950/60 border border-emerald-500/20 rounded-lg p-2 text-emerald-50 focus:outline-none focus:border-emerald-400/50"
                    placeholder="What do users ask?"
                  />
                </div>
                <FAQRichTextEditor
                  value={item.answer}
                  onChange={(answer) => updateItem(index, { answer })}
                  placeholder="Provide a concise, friendly answer."
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Category</label>
                    <input
                      value={item.category}
                      onChange={(event) => updateItem(index, { category: event.target.value })}
                      className="w-full bg-slate-950/60 border border-emerald-500/20 rounded-lg p-2 text-emerald-50 focus:outline-none focus:border-emerald-400/50"
                      placeholder="Getting Started"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-emerald-200/70">Tags</label>
                    <input
                      value={item.tags.join(', ')}
                      onChange={(event) => updateItem(index, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
                      className="w-full bg-slate-950/60 border border-emerald-500/20 rounded-lg p-2 text-emerald-50 focus:outline-none focus:border-emerald-400/50"
                      placeholder="billing, setup, troubleshooting"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {publishError && (
            <div className="text-sm text-red-300 border border-red-500/40 rounded-lg p-3 bg-red-500/10">
              {publishError}
            </div>
          )}
        </section>

        <aside className="border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Instant Preview</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">Portal View</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">{draft.title || 'FAQ'}</h1>
            <p className="text-emerald-200/70">{draft.description || 'Short answers ready for visitors.'}</p>
            {draft.items.map((item) => (
              <div key={item.id} className="border border-emerald-500/20 rounded-xl p-4 bg-slate-950/60">
                <h3 className="text-lg font-semibold">{item.question || 'Untitled question'}</h3>
                <div
                  className="mt-2 text-emerald-100/80"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.answer || '<p>No answer yet.</p>') }}
                />
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default FAQEditorRoot;
