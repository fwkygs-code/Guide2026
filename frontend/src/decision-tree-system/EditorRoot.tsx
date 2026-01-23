import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DecisionAnswer,
  DecisionNode,
  DecisionTreeDraft,
  DecisionTreeMeta,
  getDecisionTreeErrors
} from './model';
import { createDecisionTreeEntry, loadDecisionTreeDraft, loadDecisionTreeMeta, publishDecisionTree, saveDecisionTreeDraft } from './service';

type DecisionTreeEditorRootProps = {
  workspaceId?: string;
  itemId?: string;
  closeHref?: string;
};

const DecisionRichTextEditor = ({
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
    <div className="border border-indigo-500/20 bg-slate-900/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-indigo-500/20 bg-slate-900/80 p-2">
        <button type="button" className="px-2 py-1 text-xs text-indigo-200 hover:text-white" onClick={() => exec('bold')}>
          Bold
        </button>
        <button type="button" className="px-2 py-1 text-xs text-indigo-200 hover:text-white" onClick={() => exec('italic')}>
          Italic
        </button>
        <button type="button" className="px-2 py-1 text-xs text-indigo-200 hover:text-white" onClick={() => exec('insertUnorderedList')}>
          Bullets
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder={placeholder}
        className="min-h-[100px] p-4 text-indigo-50/90 focus:outline-none"
      />
    </div>
  );
};

const createOutcomeNode = (title = 'Outcome'): DecisionNode => ({
  id: `decision-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'outcome',
  title,
  prompt: '',
  content: '',
  answers: []
});

const createQuestionNode = (title = 'Question', nextNodeId = ''): DecisionNode => ({
  id: `decision-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'question',
  title,
  prompt: '',
  content: '',
  answers: [
    {
      id: `decision-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: 'Answer option',
      nextNodeId
    }
  ]
});

const ensureValidNodes = (nodes: DecisionNode[]): DecisionNode[] => {
  const updatedNodes = [...nodes];
  const nodeIds = new Set(updatedNodes.map((node) => node.id));
  const addOutcome = (label: string) => {
    const outcome = createOutcomeNode(label);
    updatedNodes.push(outcome);
    nodeIds.add(outcome.id);
    return outcome.id;
  };

  const normalized = updatedNodes.map((node) => {
    if (node.type === 'outcome') {
      return { ...node, answers: [] };
    }
    let answers = node.answers;
    if (!answers.length) {
      answers = [{
        id: `decision-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: 'Answer option',
        nextNodeId: addOutcome('Auto Outcome')
      }];
    } else {
      answers = answers.map((answer) => {
        if (!answer.nextNodeId || !nodeIds.has(answer.nextNodeId)) {
          return { ...answer, nextNodeId: addOutcome('Auto Outcome') };
        }
        return answer;
      });
    }
    return { ...node, answers };
  });

  const normalizedIds = new Set(normalized.map((node) => node.id));
  const appended = updatedNodes.filter((node) => !normalizedIds.has(node.id));
  return [...normalized, ...appended];
};

export const DecisionTreeEditorRoot = ({ workspaceId, itemId, closeHref }: DecisionTreeEditorRootProps) => {
  const [draft, setDraft] = useState<DecisionTreeDraft | null>(null);
  const [meta, setMeta] = useState<DecisionTreeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState('');
  const [interactionError, setInteractionError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    if (itemId) {
      const existingDraft = loadDecisionTreeDraft(itemId);
      const existingMeta = loadDecisionTreeMeta(itemId);
      if (existingDraft && existingMeta) {
        setDraft(existingDraft);
        setMeta(existingMeta);
        setSelectedNodeId(existingDraft.rootNodeId);
        setLoading(false);
        return;
      }
      const created = createDecisionTreeEntry(workspaceId, itemId);
      setDraft(created.draft);
      setMeta(created.meta);
      setSelectedNodeId(created.draft.rootNodeId);
      setLoading(false);
      return;
    }

    const created = createDecisionTreeEntry(workspaceId);
    setDraft(created.draft);
    setMeta(created.meta);
    setSelectedNodeId(created.draft.rootNodeId);
    setLoading(false);
  }, [workspaceId, itemId]);

  const nodeMap = useMemo(() => {
    if (!draft) return new Map<string, DecisionNode>();
    return new Map(draft.nodes.map((node) => [node.id, node]));
  }, [draft]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;

  const persistDraft = (nextDraft: DecisionTreeDraft) => {
    if (!meta) return;
    const saved = saveDecisionTreeDraft(meta.id, nextDraft);
    setDraft(saved.draft);
    setMeta(saved.meta);
  };

  const updateDraft = (updates: Partial<DecisionTreeDraft>) => {
    if (!draft) return;
    persistDraft({ ...draft, ...updates });
  };

  const updateNode = (nodeId: string, updates: Partial<DecisionNode>) => {
    if (!draft) return;
    let updated = draft.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const nextNode = { ...node, ...updates };
      if (nextNode.type === 'outcome') {
        nextNode.answers = [];
      }
      return nextNode;
    });
    updateDraft({ nodes: ensureValidNodes(updated) });
  };

  const addQuestionNode = () => {
    if (!draft) return;
    const outcome = createOutcomeNode('New Outcome');
    const question = createQuestionNode('New Question', outcome.id);
    updateDraft({ nodes: [...draft.nodes, question, outcome] });
    setSelectedNodeId(question.id);
  };

  const addOutcomeNode = () => {
    if (!draft) return;
    const outcome = createOutcomeNode('New Outcome');
    updateDraft({ nodes: [...draft.nodes, outcome] });
    setSelectedNodeId(outcome.id);
  };

  const removeNode = (nodeId: string) => {
    if (!draft) return;
    if (nodeId === draft.rootNodeId) {
      setInteractionError('Root node cannot be removed.');
      return;
    }
    const updated = draft.nodes.filter((node) => node.id !== nodeId);
    updateDraft({ nodes: ensureValidNodes(updated) });
    setSelectedNodeId(draft.rootNodeId);
  };

  const wouldCreateCycle = (fromId: string, toId: string) => {
    if (!draft) return false;
    if (fromId === toId) return true;
    const visited = new Set<string>();
    const stack = [toId];
    while (stack.length) {
      const current = stack.pop() as string;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = nodeMap.get(current);
      if (node && node.type === 'question') {
        node.answers.forEach((answer) => {
          if (answer.nextNodeId) stack.push(answer.nextNodeId);
        });
      }
    }
    return false;
  };

  const updateAnswer = (nodeId: string, answerIndex: number, updates: Partial<DecisionAnswer>) => {
    if (!draft) return;
    setInteractionError('');
    const updated = draft.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      if (node.type !== 'question') return node;
      const answers = node.answers.map((answer, index) => {
        if (index !== answerIndex) return answer;
        const nextAnswer = { ...answer, ...updates };
        if (nextAnswer.nextNodeId && wouldCreateCycle(nodeId, nextAnswer.nextNodeId)) {
          setInteractionError('Cycle detected. Choose another node.');
          return answer;
        }
        return nextAnswer;
      });
      return { ...node, answers };
    });
    updateDraft({ nodes: ensureValidNodes(updated) });
  };

  const addAnswer = (nodeId: string) => {
    if (!draft) return;
    const outcome = createOutcomeNode('New Outcome');
    const updated = draft.nodes.map((node) => {
      if (node.id !== nodeId || node.type !== 'question') return node;
      const answers = [
        ...node.answers,
        {
          id: `decision-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: 'Answer option',
          nextNodeId: outcome.id
        }
      ];
      return { ...node, answers };
    });
    updateDraft({ nodes: [...updated, outcome] });
  };

  const removeAnswer = (nodeId: string, answerIndex: number) => {
    if (!draft) return;
    const updated = draft.nodes.map((node) => {
      if (node.id !== nodeId || node.type !== 'question') return node;
      if (node.answers.length <= 1) {
        setInteractionError('Question nodes must have at least one answer.');
        return node;
      }
      const answers = node.answers.filter((_, idx) => idx !== answerIndex);
      return { ...node, answers };
    });
    updateDraft({ nodes: updated });
  };

  const handlePublish = () => {
    if (!meta) return;
    try {
      const result = publishDecisionTree(meta.id);
      setMeta(result.meta);
      setPublishError('');
    } catch (error) {
      setPublishError('Publish failed. Resolve validation errors.');
    }
  };

  if (loading || !draft || !meta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const statusLabel = meta.publishedAt ? 'Published' : 'Draft';
  const validationErrors = getDecisionTreeErrors(draft);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-indigo-50">
      <header className="sticky top-0 z-20 border-b border-indigo-500/20 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Decision Trees</p>
            <h1 className="text-3xl font-semibold tracking-wide">{draft.title || 'Decision Flow'}</h1>
            <p className="text-sm text-indigo-200/70">Node-based logic builder</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs uppercase tracking-[0.2em] rounded-full border border-indigo-400/40 text-indigo-200">
              {statusLabel}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-50 hover:bg-indigo-500/40 transition"
              onClick={handlePublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-indigo-500/30 text-indigo-200 hover:text-white hover:border-indigo-400 transition"
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

      <main className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_1.2fr] gap-8">
        <section className="space-y-6">
          <div className="border border-indigo-500/20 bg-slate-900/60 rounded-2xl p-6 shadow-xl space-y-4">
            <label className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">Decision Title</label>
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="bg-transparent border-b border-indigo-400/30 text-2xl font-semibold focus:outline-none focus:border-indigo-400"
              placeholder="Decision Tree Title"
            />
            <label className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">Description</label>
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              className="min-h-[80px] bg-slate-950/60 border border-indigo-500/20 rounded-lg p-3 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
              placeholder="Summarize the decision path and outcomes"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Node Canvas</h2>
              <p className="text-sm text-indigo-200/70">Create question and outcome nodes</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-50 hover:bg-indigo-500/40 transition text-sm"
                onClick={addQuestionNode}
              >
                Add Question
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-indigo-400/40 text-indigo-50 hover:bg-indigo-500/30 transition text-sm"
                onClick={addOutcomeNode}
              >
                Add Outcome
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {draft.nodes.map((node) => (
              <button
                type="button"
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`text-left border rounded-2xl p-4 transition ${
                  node.id === selectedNodeId ? 'border-indigo-400 bg-indigo-500/20' : 'border-indigo-500/20 bg-slate-900/70'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-200/60">{node.type}</p>
                <h3 className="text-lg font-semibold">{node.title || 'Untitled Node'}</h3>
                <p className="text-sm text-indigo-200/70">{node.prompt || 'No prompt set'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="border border-indigo-500/20 bg-slate-900/70 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Node Editor</h2>
            {selectedNode ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/60">{selectedNode.type} node</span>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs border border-indigo-400/30 rounded-full text-indigo-200 hover:text-white"
                    onClick={() => removeNode(selectedNode.id)}
                  >
                    Remove Node
                  </button>
                </div>
                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">Node Type</label>
                  <select
                    value={selectedNode.type}
                    onChange={(event) => updateNode(selectedNode.id, { type: event.target.value as DecisionNode['type'] })}
                    className="bg-slate-950/70 border border-indigo-500/20 rounded-lg p-2 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
                    disabled={selectedNode.id === draft.rootNodeId}
                  >
                    <option value="question">Question</option>
                    <option value="outcome">Outcome</option>
                  </select>
                  <label className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">Title</label>
                  <input
                    value={selectedNode.title}
                    onChange={(event) => updateNode(selectedNode.id, { title: event.target.value })}
                    className="bg-slate-950/70 border border-indigo-500/20 rounded-lg p-2 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
                    placeholder="Node title"
                  />
                  <label className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">Prompt</label>
                  <input
                    value={selectedNode.prompt}
                    onChange={(event) => updateNode(selectedNode.id, { prompt: event.target.value })}
                    className="bg-slate-950/70 border border-indigo-500/20 rounded-lg p-2 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
                    placeholder="Question or outcome summary"
                  />
                  <DecisionRichTextEditor
                    value={selectedNode.content}
                    onChange={(content) => updateNode(selectedNode.id, { content })}
                    placeholder="Explain context or outcome detail."
                  />
                </div>

                {selectedNode.type === 'question' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm uppercase tracking-[0.25em] text-indigo-200/70">Answers</h3>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs border border-indigo-400/30 rounded-full text-indigo-200 hover:text-white"
                        onClick={() => addAnswer(selectedNode.id)}
                      >
                        Add Answer
                      </button>
                    </div>
                    {selectedNode.answers.map((answer, index) => (
                      <div key={answer.id} className="border border-indigo-500/20 rounded-xl p-3 bg-slate-950/60 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-indigo-200/60">Answer {index + 1}</span>
                          <button
                            type="button"
                            className="px-3 py-1 text-xs border border-indigo-400/30 rounded-full text-indigo-200 hover:text-white"
                            onClick={() => removeAnswer(selectedNode.id, index)}
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          value={answer.text}
                          onChange={(event) => updateAnswer(selectedNode.id, index, { text: event.target.value })}
                          className="w-full bg-slate-950/70 border border-indigo-500/20 rounded-lg p-2 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
                          placeholder="Answer choice"
                        />
                        <select
                          value={answer.nextNodeId}
                          onChange={(event) => updateAnswer(selectedNode.id, index, { nextNodeId: event.target.value })}
                          className="w-full bg-slate-950/70 border border-indigo-500/20 rounded-lg p-2 text-indigo-50 focus:outline-none focus:border-indigo-400/50"
                        >
                          {draft.nodes
                            .filter((node) => node.id !== selectedNode.id)
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title || node.id} ({node.type})
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-indigo-200/70">Select a node to edit its details.</p>
            )}
          </div>

          <div className="border border-indigo-500/20 bg-slate-900/70 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Flow Preview</h2>
            <div className="space-y-4">
              {draft.nodes.map((node) => (
                <div key={node.id} className="border border-indigo-500/20 rounded-xl p-4 bg-slate-950/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/60">{node.type}</p>
                      <h3 className="text-lg font-semibold">{node.title || 'Untitled Node'}</h3>
                    </div>
                    <span className="text-xs text-indigo-200/60">{node.id === draft.rootNodeId ? 'Root' : 'Node'}</span>
                  </div>
                  {node.type === 'question' && (
                    <div className="mt-3 space-y-2 text-sm text-indigo-200/70">
                      {node.answers.map((answer) => (
                        <div key={answer.id}>
                          {answer.text || 'Answer'} → {nodeMap.get(answer.nextNodeId)?.title || 'Unlinked'}
                        </div>
                      ))}
                    </div>
                  )}
                  {node.type === 'outcome' && (
                    <div className="mt-3 text-sm text-indigo-200/70">Outcome node</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(interactionError || publishError || validationErrors.length > 0) && (
            <div className="border border-red-500/40 bg-red-500/10 rounded-2xl p-4 text-sm text-red-200 space-y-2">
              {interactionError && <div>{interactionError}</div>}
              {publishError && <div>{publishError}</div>}
              {validationErrors.length > 0 && (
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DecisionTreeEditorRoot;
