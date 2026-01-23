import React, { useEffect, useState } from 'react';
import { ProcedureDraft } from './model';
import { disableProcedurePortalReadOnly, enableProcedurePortalReadOnly, getLatestPublishedProcedure } from './service';

type ProcedurePortalRootProps = {
  portalSlug?: string;
};

export const ProcedurePortalRoot = ({ portalSlug }: ProcedurePortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<ProcedureDraft | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Workspace');

  useEffect(() => {
    enableProcedurePortalReadOnly();
    return () => disableProcedurePortalReadOnly();
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
        const latest = getLatestPublishedProcedure(String(workspaceId));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-cyan-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-cyan-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Procedures</p>
          <h1 className="text-3xl font-semibold">No Published Procedures</h1>
          <p className="text-cyan-200/70">
            {workspaceName} has not published operational procedures yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-cyan-50">
      <header className="border-b border-cyan-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Execution Procedure</p>
          <h1 className="text-4xl font-semibold">{published.title}</h1>
          <p className="text-cyan-200/70 mt-2">{published.objective}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-cyan-500/30" />
          <div className="space-y-8">
            {published.steps.map((step, index) => (
              <div key={step.id} className="relative pl-14">
                <div className="absolute left-0 top-2 h-9 w-9 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="border border-cyan-500/20 bg-slate-900/70 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">{step.title || `Step ${index + 1}`}</h2>
                      {step.duration && <p className="text-sm text-cyan-200/70 mt-1">Duration: {step.duration}</p>}
                    </div>
                    {step.attachmentUrl && (
                      <a
                        href={step.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs uppercase tracking-[0.2em] border border-cyan-400/30 rounded-full px-3 py-1 text-cyan-200 hover:text-white"
                      >
                        {step.attachmentName || 'Attachment'}
                      </a>
                    )}
                  </div>
                  <div
                    className="mt-4 text-cyan-50/90 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: step.instruction || '<p>No instructions provided.</p>' }}
                  />
                  {step.notes && (
                    <div className="mt-4 border-t border-cyan-500/20 pt-4 text-sm text-cyan-200/70">
                      Notes: {step.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProcedurePortalRoot;
