import React, { useEffect, useRef, useState } from 'react';
import { PolicyDraft, PolicySection, PolicyMeta, POLICY_MODEL_VERSION } from './model';
import { createPolicyEntry, loadPolicyDraft, loadPolicyMeta, publishPolicy, savePolicyDraft } from './service';
import { policyApiClient, PolicySystem } from './api-client';

type PolicyEditorRootProps = {
  workspaceId?: string;
  itemId?: string;
  closeHref?: string;
};

const normalizePolicyDraft = (system: PolicySystem): PolicyDraft => ({
  version: POLICY_MODEL_VERSION,
  title: system.title || '',
  description: system.description || '',
  effectiveDate: system.content?.effectiveDate || '',
  jurisdiction: system.content?.jurisdiction || '',
  sections: system.content?.sections || []
});

const PolicyRichTextEditor = ({
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

  return (
    <div className="border border-amber-500/20 bg-slate-900/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-amber-500/20 bg-slate-900/80 p-2">
        <button type="button" className="px-2 py-1 text-xs text-amber-200 hover:text-white" onClick={() => exec('bold')}>
          Bold
        </button>
        <button type="button" className="px-2 py-1 text-xs text-amber-200 hover:text-white" onClick={() => exec('italic')}>
          Italic
        </button>
        <button type="button" className="px-2 py-1 text-xs text-amber-200 hover:text-white" onClick={() => exec('formatBlock', 'h3')}>
          Heading
        </button>
        <button type="button" className="px-2 py-1 text-xs text-amber-200 hover:text-white" onClick={() => exec('insertOrderedList')}>
          Numbered
        </button>
        <button type="button" className="px-2 py-1 text-xs text-amber-200 hover:text-white" onClick={() => exec('insertUnorderedList')}>
          Bullets
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder={placeholder}
        className="min-h-[140px] p-4 text-amber-50/90 focus:outline-none"
        style={{ fontFamily: 'Georgia, serif' }}
      />
    </div>
  );
};

export const PolicyEditorRoot = ({ workspaceId, itemId, closeHref }: PolicyEditorRootProps) => {
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [meta, setMeta] = useState<PolicyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishError, setPublishError] = useState('');
  const [backendId, setBackendId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const loadFromBackend = async () => {
      try {
        if (itemId) {
          // Try loading from backend first
          try {
            const system = await policyApiClient.getById(workspaceId, itemId);
            setBackendId(system.id);
            setDraft(normalizePolicyDraft(system));
            setMeta({
              id: system.id,
              workspaceId: system.workspace_id,
              title: system.title,
              createdAt: system.created_at,
              updatedAt: system.updated_at,
              publishedAt: system.status === 'published' ? system.updated_at : null
            });
            setLoading(false);
            return;
          } catch (error) {
            // Fall back to localStorage if not in backend
            console.log('Policy not in backend, checking localStorage...');
          }

          // Try localStorage
          const existingDraft = loadPolicyDraft(itemId);
          const existingMeta = loadPolicyMeta(itemId);
          if (existingDraft && existingMeta) {
            setDraft(existingDraft);
            setMeta(existingMeta);
            setLoading(false);
            return;
          }
        }

        // Create new policy in backend
        const newSystem = await policyApiClient.create(workspaceId, 'New Policy', '');
        setBackendId(newSystem.id);
        setDraft(normalizePolicyDraft(newSystem));
        setMeta({
          id: newSystem.id,
          workspaceId: newSystem.workspace_id,
          title: newSystem.title,
          createdAt: newSystem.created_at,
          updatedAt: newSystem.updated_at,
          publishedAt: null
        });
        setLoading(false);
      } catch (error) {
        console.error('Failed to load policy from backend:', error);
        setLoading(false);
      }
    };

    loadFromBackend();
  }, [workspaceId, itemId]);

  const persistDraft = async (nextDraft: PolicyDraft) => {
    if (!meta || !backendId) return;
    
    // Update UI immediately
    setDraft(nextDraft);
    setMeta({ ...meta, title: nextDraft.title, updatedAt: new Date().toISOString() });
    
    try {
      // Save to backend
      await policyApiClient.update(workspaceId!, backendId, {
        title: nextDraft.title,
        description: nextDraft.description,
        content: {
          effectiveDate: nextDraft.effectiveDate,
          jurisdiction: nextDraft.jurisdiction,
          sections: nextDraft.sections
        }
      });
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const updateDraft = (updates: Partial<PolicyDraft>) => {
    if (!draft) return;
    persistDraft({ ...draft, ...updates });
  };

  const updateSection = (index: number, updates: Partial<PolicySection>) => {
    if (!draft) return;
    const updatedSections = draft.sections.map((section, idx) => (
      idx === index ? { ...section, ...updates, lastUpdated: new Date().toISOString() } : section
    ));
    updateDraft({ sections: updatedSections });
  };

  const addSection = () => {
    if (!draft) return;
    const newSection: PolicySection = {
      id: `policy-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      category: '',
      content: '',
      lastUpdated: new Date().toISOString()
    };
    updateDraft({ sections: [...draft.sections, newSection] });
  };

  const removeSection = (index: number) => {
    if (!draft) return;
    const updated = draft.sections.filter((_, idx) => idx !== index);
    updateDraft({ sections: updated.length ? updated : draft.sections });
  };

  const moveSection = (from: number, to: number) => {
    if (!draft) return;
    const updated = [...draft.sections];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    updateDraft({ sections: updated });
  };

  const handlePublish = async () => {
    if (!meta || !backendId) return;
    try {
      await policyApiClient.publish(workspaceId!, backendId);
      setMeta({ ...meta, publishedAt: new Date().toISOString() });
      setPublishError('');
    } catch (error) {
      setPublishError('Publish failed. Review draft before publishing.');
    }
  };

  if (loading || !draft || !meta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const statusLabel = meta.publishedAt ? 'Published' : 'Draft';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-amber-50">
      <header className="sticky top-0 z-20 border-b border-amber-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">Policies</p>
            <h1 className="text-3xl font-semibold tracking-wide">{draft.title || 'Untitled Policy Set'}</h1>
            <p className="text-sm text-amber-200/70">Document-style policy authoring</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.2em] rounded-full border border-amber-400/40 text-amber-200">
              {statusLabel}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 hover:bg-amber-500/40 transition"
              onClick={handlePublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-amber-500/30 text-amber-200 hover:text-white hover:border-amber-400 transition"
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

      <main className="max-w-6xl mx-auto px-6 py-10 grid gap-8">
        <section className="grid md:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <div className="border border-amber-500/20 bg-slate-900/60 rounded-2xl p-6 shadow-xl">
              <div className="grid gap-4">
                <label className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Policy Title</label>
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  className="bg-transparent border-b border-amber-400/30 text-2xl font-semibold focus:outline-none focus:border-amber-400"
                  placeholder="Official Policy Title"
                />
                <label className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  className="min-h-[80px] bg-slate-950/60 border border-amber-500/20 rounded-lg p-3 text-amber-50 focus:outline-none focus:border-amber-400/50"
                  placeholder="Purpose, scope, and authority statement"
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Effective Date</label>
                    <input
                      type="date"
                      value={draft.effectiveDate}
                      onChange={(event) => updateDraft({ effectiveDate: event.target.value })}
                      className="w-full bg-slate-950/60 border border-amber-500/20 rounded-lg p-2 text-amber-50 focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Jurisdiction</label>
                    <input
                      value={draft.jurisdiction}
                      onChange={(event) => updateDraft({ jurisdiction: event.target.value })}
                      className="w-full bg-slate-950/60 border border-amber-500/20 rounded-lg p-2 text-amber-50 focus:outline-none focus:border-amber-400/50"
                      placeholder="Global, Region, or Entity"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Policy Sections</h2>
                <p className="text-sm text-amber-200/70">Structured legal clauses with clear hierarchy</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 hover:bg-amber-500/40 transition"
                onClick={addSection}
              >
                Add Section
              </button>
            </div>

            <div className="space-y-6">
              {draft.sections.map((section, index) => (
                <div key={section.id} className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-amber-200/60">Section {index + 1}</p>
                      <input
                        value={section.title}
                        onChange={(event) => updateSection(index, { title: event.target.value })}
                        className="bg-transparent text-xl font-semibold border-b border-amber-400/30 focus:outline-none focus:border-amber-400"
                        placeholder="Section Title"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveSection(index, Math.max(0, index - 1))}
                        className="px-3 py-1 text-xs border border-amber-400/30 rounded-full text-amber-200 hover:text-white"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(index, Math.min(draft.sections.length - 1, index + 1))}
                        className="px-3 py-1 text-xs border border-amber-400/30 rounded-full text-amber-200 hover:text-white"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="px-3 py-1 text-xs border border-amber-400/30 rounded-full text-amber-200 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-[0.25em] text-amber-200/70">Category</label>
                      <input
                        value={section.category}
                        onChange={(event) => updateSection(index, { category: event.target.value })}
                        className="w-full bg-slate-950/60 border border-amber-500/20 rounded-lg p-2 text-amber-50 focus:outline-none focus:border-amber-400/50"
                        placeholder="Compliance, HR, Security"
                      />
                    </div>
                    <PolicyRichTextEditor
                      value={section.content}
                      onChange={(content) => updateSection(index, { content })}
                      placeholder="Write the policy clause with formal, authoritative language."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Version History</h3>
              <div className="space-y-3 text-sm text-amber-200/70">
                <div>
                  <p className="uppercase tracking-[0.2em] text-xs text-amber-200/50">Created</p>
                  <p>{new Date(meta.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.2em] text-xs text-amber-200/50">Last Updated</p>
                  <p>{new Date(meta.updatedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.2em] text-xs text-amber-200/50">Published</p>
                  <p>{meta.publishedAt ? new Date(meta.publishedAt).toLocaleString() : 'Not published'}</p>
                </div>
              </div>
            </div>

            <div className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-3">Publish Check</h3>
              <p className="text-sm text-amber-200/70 mb-4">
                Publishing copies the draft into the official portal and locks the version badge.
              </p>
              {publishError && (
                <div className="text-sm text-red-300 border border-red-500/40 rounded-lg p-3 bg-red-500/10">
                  {publishError}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default PolicyEditorRoot;
