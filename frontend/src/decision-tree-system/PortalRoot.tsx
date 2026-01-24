import React, { useEffect, useMemo, useState } from 'react';
import { portalKnowledgeSystemsService } from '../knowledge-systems/api-service';

type DecisionTreePortalRootProps = {
  portalSlug?: string;
};

export const DecisionTreePortalRoot = ({ portalSlug }: DecisionTreePortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [publishedTrees, setPublishedTrees] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        const portalResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/api/portal/${portalSlug}`);
        const portalData = await portalResponse.json();
        const workspaceLabel = portalData?.workspace?.name || portalData?.workspace?.slug || 'Workspace';
        
        const trees = await portalKnowledgeSystemsService.getAllByType(portalSlug, 'decision_tree');
        
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          const treesArray = Array.isArray(trees) ? trees : [];
          setPublishedTrees(treesArray);
          if (treesArray.length > 0) {
            setSelectedTreeId(treesArray[0].id);
            const rootNode = treesArray[0].content?.nodes?.find((n: any) => n.type === 'root' || n.id === treesArray[0].content?.rootNodeId);
            if (rootNode) {
              setCurrentNodeId(rootNode.id);
            }
          }
        }
      } catch (error) {
        console.error('[DecisionTreePortalRoot] Failed to load:', error);
        if (isMounted) {
          setPublishedTrees([]);
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

  const selectedTree = useMemo(() => {
    return publishedTrees.find(t => t.id === selectedTreeId);
  }, [publishedTrees, selectedTreeId]);

  const nodeMap = useMemo(() => {
    if (!selectedTree?.content?.nodes) return new Map();
    return new Map(selectedTree.content.nodes.map((node: any) => [node.id, node]));
  }, [selectedTree]);

  useEffect(() => {
    if (!selectedTree?.content?.rootNodeId) return;
    setCurrentNodeId(selectedTree.content.rootNodeId);
    setPath([selectedTree.content.rootNodeId]);
    setError('');
  }, [selectedTree]);

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
    if (!selectedTree?.content?.rootNodeId) return;
    setCurrentNodeId(selectedTree.content.rootNodeId);
    setPath([selectedTree.content.rootNodeId]);
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!publishedTrees || publishedTrees.length === 0) {
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

  if (!currentNode || !selectedTree) {
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
  const answers = currentNode.answers || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-indigo-50">
      <header className="border-b border-indigo-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Decision Guide</p>
          <h1 className="text-4xl font-semibold">{selectedTree.title}</h1>
          {selectedTree.description && <p className="text-indigo-200/70 mt-2">{selectedTree.description}</p>}
          {publishedTrees.length > 1 && (
            <div className="mt-4">
              <select
                value={selectedTreeId || ''}
                onChange={(e) => {
                  setSelectedTreeId(e.target.value);
                  const tree = publishedTrees.find(t => t.id === e.target.value);
                  if (tree?.content?.rootNodeId) {
                    setCurrentNodeId(tree.content.rootNodeId);
                    setPath([tree.content.rootNodeId]);
                  }
                }}
                className="bg-slate-900/70 border border-indigo-500/20 rounded-lg px-4 py-2 text-indigo-50"
              >
                {publishedTrees.map(tree => (
                  <option key={tree.id} value={tree.id}>{tree.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="border border-indigo-500/20 bg-slate-900/70 rounded-3xl p-8 text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/60">
            {isOutcome ? 'Outcome' : 'Decision'}
          </p>
          <h2 className="text-3xl font-semibold">{currentNode.content || 'Decision Point'}</h2>

          {!isOutcome && answers.length === 0 && (
            <div className="text-red-300 border border-red-500/40 rounded-xl p-4 bg-red-500/10">
              Question nodes must include at least one answer.
            </div>
          )}

          {!isOutcome && answers.length > 0 && (
            <div className="grid gap-3">
              {answers.map((answer: any) => (
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
