import React, { useEffect, useRef, useState } from 'react';
import { DocumentationDraft, DocumentationMeta, DocumentationSection } from './model';
import { createDocumentationEntry, loadDocumentationDraft, loadDocumentationMeta, publishDocumentation, saveDocumentationDraft } from './service';
import sanitizeHtml from './sanitizeHtml';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

type DocumentationEditorRootProps = {
  workspaceId?: string;
  itemId?: string;
  closeHref?: string;
};

const DocumentationRichTextEditor = ({
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
    <div className="border border-purple-500/20 bg-slate-900/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-purple-500/20 bg-slate-900/80 p-2">
        <button type="button" className="px-2 py-1 text-xs text-purple-200 hover:text-white" onClick={() => exec('bold')}>
          Bold
        </button>
        <button type="button" className="px-2 py-1 text-xs text-purple-200 hover:text-white" onClick={() => exec('italic')}>
          Italic
        </button>
        <button type="button" className="px-2 py-1 text-xs text-purple-200 hover:text-white" onClick={() => exec('formatBlock', 'h3')}>
          Heading
        </button>
        <button type="button" className="px-2 py-1 text-xs text-purple-200 hover:text-white" onClick={insertLink}>
          Link
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder={placeholder}
        className="min-h-[120px] p-4 text-purple-50/90 focus:outline-none"
      />
    </div>
  );
};

const renderPreviewSection = (section: DocumentationSection, depth: number) => (
  <div key={section.id} className={depth === 0 ? 'mb-8' : 'mb-6'}>
    <h3 className={`font-semibold text-purple-50 ${depth === 0 ? 'text-2xl' : 'text-xl'}`}>
      {section.title || 'Untitled Section'}
    </h3>
    <div
      className="mt-2 text-purple-100/80 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content || '<p>No content provided.</p>') }}
    />
    {section.codeBlock && (
      <pre className="mt-4 bg-slate-950/80 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-100 overflow-x-auto">
        <code>{section.codeBlock}</code>
      </pre>
    )}
    {section.children.map((child) => renderPreviewSection(child, depth + 1))}
  </div>
);

export const DocumentationEditorRoot = ({ workspaceId, itemId, closeHref }: DocumentationEditorRootProps) => {
  const [draft, setDraft] = useState<DocumentationDraft | null>(null);
  const [meta, setMeta] = useState<DocumentationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    if (itemId) {
      const existingDraft = loadDocumentationDraft(itemId);
      const existingMeta = loadDocumentationMeta(itemId);
      if (existingDraft && existingMeta) {
        setDraft(existingDraft);
        setMeta(existingMeta);
        setLoading(false);
        return;
      }
      const created = createDocumentationEntry(workspaceId, itemId);
      setDraft(created.draft);
      setMeta(created.meta);
      setLoading(false);
      return;
    }

    const created = createDocumentationEntry(workspaceId);
    setDraft(created.draft);
    setMeta(created.meta);
    setLoading(false);
  }, [workspaceId, itemId]);

  const persistDraft = (nextDraft: DocumentationDraft) => {
    if (!meta) return;
    const saved = saveDocumentationDraft(meta.id, nextDraft);
    setDraft(saved.draft);
    setMeta(saved.meta);
  };

  const updateDraft = (updates: Partial<DocumentationDraft>) => {
    if (!draft) return;
    persistDraft({ ...draft, ...updates });
  };

  const updateSection = (index: number, updates: Partial<DocumentationSection>) => {
    if (!draft) return;
    const updated = draft.sections.map((section, idx) => (
      idx === index ? { ...section, ...updates } : section
    ));
    updateDraft({ sections: updated });
  };

  const updateSubsection = (parentIndex: number, childIndex: number, updates: Partial<DocumentationSection>) => {
    if (!draft) return;
    const updated = draft.sections.map((section, idx) => {
      if (idx !== parentIndex) return section;
      const children = section.children.map((child, cIdx) => (
        cIdx === childIndex ? { ...child, ...updates } : child
      ));
      return { ...section, children };
    });
    updateDraft({ sections: updated });
  };

  const addSection = () => {
    if (!draft) return;
    const newSection: DocumentationSection = {
      id: `doc-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      content: '',
      codeBlock: '',
      children: []
    };
    updateDraft({ sections: [...draft.sections, newSection] });
  };

  const addSubsection = (parentIndex: number) => {
    if (!draft) return;
    const newSub: DocumentationSection = {
      id: `doc-subsection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      content: '',
      codeBlock: '',
      children: []
    };
    const updated = draft.sections.map((section, idx) => (
      idx === parentIndex ? { ...section, children: [...section.children, newSub] } : section
    ));
    updateDraft({ sections: updated });
  };

  const removeSection = (index: number) => {
    if (!draft) return;
    const updated = draft.sections.filter((_, idx) => idx !== index);
    updateDraft({ sections: updated.length ? updated : draft.sections });
  };

  const removeSubsection = (parentIndex: number, childIndex: number) => {
    if (!draft) return;
    const updated = draft.sections.map((section, idx) => {
      if (idx !== parentIndex) return section;
      const children = section.children.filter((_, cIdx) => cIdx !== childIndex);
      return { ...section, children };
    });
    updateDraft({ sections: updated });
  };

  const handlePublish = () => {
    if (!meta) return;
    try {
      const result = publishDocumentation(meta.id);
      setMeta(result.meta);
      setPublishError('');
    } catch (error) {
      setPublishError('Publish failed. Fix structure before publishing.');
    }
  };

  if (loading || !draft || !meta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
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

  const statusLabel = meta.publishedAt ? 'Published' : 'Draft';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-purple-50">
      <header className="sticky top-0 z-20 border-b border-purple-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Documentation</p>
            <h1 className="text-3xl font-semibold tracking-wide">{draft.title || 'Untitled Documentation'}</h1>
            <p className="text-sm text-purple-200/70">Sectioned knowledge base editor</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.2em] rounded-full border border-purple-400/40 text-purple-200">
              {statusLabel}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-50 hover:bg-purple-500/40 transition"
              onClick={handlePublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-purple-500/30 text-purple-200 hover:text-white hover:border-purple-400 transition"
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
          <div className="border border-purple-500/20 bg-slate-900/60 rounded-2xl p-6 shadow-xl space-y-4">
            <label className="text-xs uppercase tracking-[0.25em] text-purple-200/70">Documentation Title</label>
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="bg-transparent border-b border-purple-400/30 text-2xl font-semibold focus:outline-none focus:border-purple-400"
              placeholder="Documentation Hub Name"
            />
            <label className="text-xs uppercase tracking-[0.25em] text-purple-200/70">Overview</label>
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              className="min-h-[80px] bg-slate-950/60 border border-purple-500/20 rounded-lg p-3 text-purple-50 focus:outline-none focus:border-purple-400/50"
              placeholder="Explain scope and audience"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sections</h2>
              <p className="text-sm text-purple-200/70">Hierarchical structure with code examples</p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-50 hover:bg-purple-500/40 transition"
              onClick={addSection}
            >
              Add Section
            </button>
          </div>

          <div className="space-y-6">
            {draft.sections.map((section, index) => (
              <div key={section.id} className="border border-purple-500/20 bg-slate-900/70 rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-purple-200/60">Section {index + 1}</p>
                    <input
                      value={section.title}
                      onChange={(event) => updateSection(index, { title: event.target.value })}
                      className="bg-transparent text-xl font-semibold border-b border-purple-400/30 focus:outline-none focus:border-purple-400"
                      placeholder="Section Title"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addSubsection(index)}
                      className="px-3 py-1 text-xs border border-purple-400/30 rounded-full text-purple-200 hover:text-white"
                    >
                      Add Subsection
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      className="px-3 py-1 text-xs border border-purple-400/30 rounded-full text-purple-200 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <DocumentationRichTextEditor
                  value={section.content}
                  onChange={(content) => updateSection(index, { content })}
                  placeholder="Explain concepts, architecture, and usage."
                />
                <textarea
                  value={section.codeBlock}
                  onChange={(event) => updateSection(index, { codeBlock: event.target.value })}
                  className="min-h-[120px] bg-slate-950/80 border border-purple-500/20 rounded-lg p-3 text-purple-100 font-mono text-sm focus:outline-none focus:border-purple-400/50"
                  placeholder="Code block or API example"
                />

                {section.children.length > 0 && (
                  <div className="space-y-4 border-l border-purple-500/20 pl-6">
                    {section.children.map((child, childIndex) => (
                      <div key={child.id} className="border border-purple-500/20 bg-slate-950/60 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <input
                            value={child.title}
                            onChange={(event) => updateSubsection(index, childIndex, { title: event.target.value })}
                            className="bg-transparent text-lg font-semibold border-b border-purple-400/30 focus:outline-none focus:border-purple-400"
                            placeholder="Subsection Title"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubsection(index, childIndex)}
                            className="px-3 py-1 text-xs border border-purple-400/30 rounded-full text-purple-200 hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                        <DocumentationRichTextEditor
                          value={child.content}
                          onChange={(content) => updateSubsection(index, childIndex, { content })}
                          placeholder="Details, constraints, and tips."
                        />
                        <textarea
                          value={child.codeBlock}
                          onChange={(event) => updateSubsection(index, childIndex, { codeBlock: event.target.value })}
                          className="min-h-[100px] bg-slate-950/80 border border-purple-500/20 rounded-lg p-3 text-purple-100 font-mono text-sm focus:outline-none focus:border-purple-400/50"
                          placeholder="Subsection code block"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {publishError && (
            <div className="text-sm text-red-300 border border-red-500/40 rounded-lg p-3 bg-red-500/10">
              {publishError}
            </div>
          )}
        </section>

        <aside className="border border-purple-500/20 bg-slate-900/70 rounded-2xl p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Live Preview</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-purple-200/60">Portal View</span>
          </div>
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold">{draft.title || 'Documentation'}</h1>
            <p className="text-purple-200/70">{draft.description || 'Overview content pending.'}</p>
            {draft.sections.map((section) => renderPreviewSection(section, 0))}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default DocumentationEditorRoot;
