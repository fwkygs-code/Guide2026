import React, { useEffect, useMemo, useState } from 'react';
import { DecisionNode, DecisionTreeDraft } from './model';
import { disableDecisionTreePortalReadOnly, enableDecisionTreePortalReadOnly, getLatestPublishedDecisionTree } from './service';

type DecisionTreePortalRootProps = {
  portalSlug?: string;
};

export const DecisionTreePortalRoot = ({ portalSlug }: DecisionTreePortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<DecisionTreeDraft | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    enableDecisionTreePortalReadOnly();
    return () => disableDecisionTreePortalReadOnly();
  }, []);

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/portal/${portalSlug}`);
        const data = await response.json();
        const workspaceId = data?.workspace?.id || data?.workspace_id;
        const workspaceLabel = data?.workspace?.name || data?.workspace?.slug || 'Workspace';
        if (!workspaceId) {
          setPublished(null);
          setWorkspaceName(workspaceLabel);
          return;
        }
        const latest = getLatestPublishedDecisionTree(String(workspaceId));
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          setPublished(latest?.published || null);
        }
      } catch (error) {
        if (isMounted) {
          setPublished(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadPortal();
    return () => {
      isMounted = false;
    };
  }, [portalSlug]);

  const nodeMap = useMemo(() => {
    if (!published) return new Map<string, DecisionNode>();
    return new Map(published.nodes.map((node) => [node.id, node]));
  }, [published]);

  useEffect(() => {
    if (!published) return;
    setCurrentNodeId(published.rootNodeId);
    setPath([published.rootNodeId]);
    setError('');
  }, [published]);

  const currentNode = currentNodeId ? nodeMap.get(currentNodeId) : null;

  const handleAnswer = (nextNodeId: string) => {
    if (!nextNodeId || !nodeMap.has(nextNodeId)) {
      setError('Invalid decision path.');
      return;
    }
    if (path.includes(nextNodeId)) {
      setError('Cycle detected. Decision path blocked.');
      return;
    }
    setError('');
    setCurrentNodeId(nextNodeId);
    setPath((prev) => [...prev, nextNodeId]);
  };

  const restart = () => {
    if (!published) return;
    setCurrentNodeId(published.rootNodeId);
    setPath([published.rootNodeId]);
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-indigo-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-indigo-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Decision Trees</p>
          <h1 className="text-3xl font-semibold">No Published Decision Trees</h1>
          <p className="text-indigo-200/70">
            {workspaceName} has not published decision guidance yet.
          </p>
        </div>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-indigo-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-indigo-500/20 bg-slate-900/70 rounded-2xl p-10">
          <h1 className="text-3xl font-semibold">Decision Path Unavailable</h1>
          <button
            type="button"
            onClick={restart}
            className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-50 hover:bg-indigo-500/40 transition"
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  const isOutcome = currentNode.type === 'outcome';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-indigo-50">
      <header className="border-b border-indigo-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Decision Guide</p>
          <h1 className="text-4xl font-semibold">{published.title}</h1>
          <p className="text-indigo-200/70 mt-2">{published.description}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="border border-indigo-500/20 bg-slate-900/70 rounded-3xl p-8 text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/60">
            {isOutcome ? 'Outcome' : 'Decision'}
          </p>
          <h2 className="text-3xl font-semibold">{currentNode.title || 'Decision Point'}</h2>
          <p className="text-indigo-200/80">{currentNode.prompt || 'Choose the next step.'}</p>
          {currentNode.content && (
            <div
              className="text-indigo-100/80 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentNode.content }}
            />
          )}

          {!isOutcome && currentNode.answers.length === 0 && (
            <div className="text-red-300 border border-red-500/40 rounded-xl p-4 bg-red-500/10">
              Question nodes must include at least one answer.
            </div>
          )}

          {!isOutcome && (
            <div className="grid gap-3">
              {currentNode.answers.map((answer) => (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => handleAnswer(answer.nextNodeId)}
                  className="px-4 py-3 rounded-xl border border-indigo-400/30 text-indigo-50 hover:bg-indigo-500/20 transition"
                >
                  {answer.text || 'Answer option'}
                </button>
              ))}
            </div>
          )}

          {isOutcome && (
            <div className="space-y-3">
              <div className="text-indigo-200/70">Outcome reached. Review the guidance above.</div>
              <button
                type="button"
                onClick={restart}
                className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-50 hover:bg-indigo-500/40 transition"
              >
                Start Over
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-300 border border-red-500/40 rounded-xl p-4 bg-red-500/10">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DecisionTreePortalRoot;
