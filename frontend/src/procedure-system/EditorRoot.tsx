import React, { useEffect, useRef, useState } from 'react';
import { ProcedureDraft, ProcedureMeta, ProcedureStep } from './model';
import { createProcedureEntry, loadProcedureDraft, loadProcedureMeta, publishProcedure, saveProcedureDraft } from './service';
import WorkspaceLoader from '../components/WorkspaceLoader';

type ProcedureEditorRootProps = {
  workspaceId?: string;
  itemId?: string;
  closeHref?: string;
};

const ProcedureRichTextEditor = ({
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
    <div className="border border-cyan-500/20 bg-slate-900/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-cyan-500/20 bg-slate-900/80 p-2">
        <button type="button" className="px-2 py-1 text-xs text-cyan-200 hover:text-white" onClick={() => exec('bold')}>
          Bold
        </button>
        <button type="button" className="px-2 py-1 text-xs text-cyan-200 hover:text-white" onClick={() => exec('italic')}>
          Italic
        </button>
        <button type="button" className="px-2 py-1 text-xs text-cyan-200 hover:text-white" onClick={() => exec('insertOrderedList')}>
          Steps
        </button>
        <button type="button" className="px-2 py-1 text-xs text-cyan-200 hover:text-white" onClick={() => exec('insertUnorderedList')}>
          Checklist
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder={placeholder}
        className="min-h-[120px] p-4 text-cyan-50/90 focus:outline-none"
      />
    </div>
  );
};

export const ProcedureEditorRoot = ({ workspaceId, itemId, closeHref }: ProcedureEditorRootProps) => {
  const [draft, setDraft] = useState<ProcedureDraft | null>(null);
  const [meta, setMeta] = useState<ProcedureMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    if (itemId) {
      const existingDraft = loadProcedureDraft(itemId);
      const existingMeta = loadProcedureMeta(itemId);
      if (existingDraft && existingMeta) {
        setDraft(existingDraft);
        setMeta(existingMeta);
        setLoading(false);
        return;
      }
      const created = createProcedureEntry(workspaceId, itemId);
      setDraft(created.draft);
      setMeta(created.meta);
      setLoading(false);
      return;
    }

    const created = createProcedureEntry(workspaceId);
    setDraft(created.draft);
    setMeta(created.meta);
    setLoading(false);
  }, [workspaceId, itemId]);

  const persistDraft = (nextDraft: ProcedureDraft) => {
    if (!meta) return;
    const saved = saveProcedureDraft(meta.id, nextDraft);
    setDraft(saved.draft);
    setMeta(saved.meta);
  };

  const updateDraft = (updates: Partial<ProcedureDraft>) => {
    if (!draft) return;
    persistDraft({ ...draft, ...updates });
  };

  const updateStep = (index: number, updates: Partial<ProcedureStep>) => {
    if (!draft) return;
    const updatedSteps = draft.steps.map((step, idx) => (
      idx === index ? { ...step, ...updates } : step
    ));
    updateDraft({ steps: updatedSteps });
  };

  const addStep = () => {
    if (!draft) return;
    const newStep: ProcedureStep = {
      id: `procedure-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      instruction: '',
      duration: '',
      attachmentName: '',
      attachmentUrl: '',
      notes: ''
    };
    updateDraft({ steps: [...draft.steps, newStep] });
  };

  const moveStep = (from: number, to: number) => {
    if (!draft) return;
    const updated = [...draft.steps];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    updateDraft({ steps: updated });
  };

  const removeStep = (index: number) => {
    if (!draft) return;
    const updated = draft.steps.filter((_, idx) => idx !== index);
    updateDraft({ steps: updated.length ? updated : draft.steps });
  };

  const handlePublish = () => {
    if (!meta) return;
    try {
      const result = publishProcedure(meta.id);
      setMeta(result.meta);
      setPublishError('');
    } catch (error) {
      setPublishError('Publish failed. Check step structure before publishing.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-cyan-50">
      <header className="sticky top-0 z-20 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Procedures</p>
            <h1 className="text-3xl font-semibold tracking-wide">{draft.title || 'Untitled Procedure'}</h1>
            <p className="text-sm text-cyan-200/70">Step-by-step execution builder</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.2em] rounded-full border border-cyan-400/40 text-cyan-200">
              {statusLabel}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-50 hover:bg-cyan-500/40 transition"
              onClick={handlePublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-200 hover:text-white hover:border-cyan-400 transition"
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

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <section className="border border-cyan-500/20 bg-slate-900/60 rounded-2xl p-6 shadow-xl space-y-4">
          <label className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Procedure Title</label>
          <input
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="bg-transparent border-b border-cyan-400/30 text-2xl font-semibold focus:outline-none focus:border-cyan-400"
            placeholder="Procedure Name"
          />
          <label className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Objective</label>
          <textarea
            value={draft.objective}
            onChange={(event) => updateDraft({ objective: event.target.value })}
            className="min-h-[80px] bg-slate-950/60 border border-cyan-500/20 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400/50"
            placeholder="Describe the outcome this procedure achieves"
          />
        </section>

        <section className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Execution Steps</h2>
            <p className="text-sm text-cyan-200/70">Ordered sequence with motion on reorder</p>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-50 hover:bg-cyan-500/40 transition"
            onClick={addStep}
          >
            Add Step
          </button>
        </section>

        <section className="space-y-6">
          {draft.steps.map((step, index) => (
            <div key={step.id} className="relative border border-cyan-500/20 bg-slate-900/70 rounded-2xl p-6 transition-transform duration-300">
              <div className="absolute left-6 top-6 bottom-6 w-px bg-cyan-500/30" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative z-10 h-10 w-10 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/60">Step {index + 1}</p>
                    <input
                      value={step.title}
                      onChange={(event) => updateStep(index, { title: event.target.value })}
                      className="bg-transparent text-xl font-semibold border-b border-cyan-400/30 focus:outline-none focus:border-cyan-400"
                      placeholder="Step title"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveStep(index, Math.max(0, index - 1))}
                    className="px-3 py-1 text-xs border border-cyan-400/30 rounded-full text-cyan-200 hover:text-white"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, Math.min(draft.steps.length - 1, index + 1))}
                    className="px-3 py-1 text-xs border border-cyan-400/30 rounded-full text-cyan-200 hover:text-white"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="px-3 py-1 text-xs border border-cyan-400/30 rounded-full text-cyan-200 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <ProcedureRichTextEditor
                  value={step.instruction}
                  onChange={(instruction) => updateStep(index, { instruction })}
                  placeholder="Describe the exact actions to execute this step."
                />
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Duration</label>
                    <input
                      value={step.duration}
                      onChange={(event) => updateStep(index, { duration: event.target.value })}
                      className="w-full bg-slate-950/60 border border-cyan-500/20 rounded-lg p-2 text-cyan-50 focus:outline-none focus:border-cyan-400/50"
                      placeholder="e.g., 10 minutes"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Attachment Name</label>
                    <input
                      value={step.attachmentName}
                      onChange={(event) => updateStep(index, { attachmentName: event.target.value })}
                      className="w-full bg-slate-950/60 border border-cyan-500/20 rounded-lg p-2 text-cyan-50 focus:outline-none focus:border-cyan-400/50"
                      placeholder="Checklist, form, or SOP"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Attachment URL</label>
                    <input
                      value={step.attachmentUrl}
                      onChange={(event) => updateStep(index, { attachmentUrl: event.target.value })}
                      className="w-full bg-slate-950/60 border border-cyan-500/20 rounded-lg p-2 text-cyan-50 focus:outline-none focus:border-cyan-400/50"
                      placeholder="https://"
                    />
                  </div>
                </div>
                <textarea
                  value={step.notes}
                  onChange={(event) => updateStep(index, { notes: event.target.value })}
                  className="min-h-[80px] bg-slate-950/60 border border-cyan-500/20 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400/50"
                  placeholder="Notes, safety checks, or escalation guidance"
                />
              </div>
            </div>
          ))}
        </section>

        {publishError && (
          <div className="text-sm text-red-300 border border-red-500/40 rounded-lg p-3 bg-red-500/10">
            {publishError}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProcedureEditorRoot;
