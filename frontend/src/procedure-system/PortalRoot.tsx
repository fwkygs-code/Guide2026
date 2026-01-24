import React, { useEffect, useState } from 'react';
import { portalKnowledgeSystemsService } from '../knowledge-systems/api-service';

type ProcedurePortalRootProps = {
  portalSlug?: string;
};

export const ProcedurePortalRoot = ({ portalSlug }: ProcedurePortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [publishedProcedures, setPublishedProcedures] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        const portalResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/api/portal/${portalSlug}`);
        const portalData = await portalResponse.json();
        const workspaceLabel = portalData?.workspace?.name || portalData?.workspace?.slug || 'Workspace';
        
        const procedures = await portalKnowledgeSystemsService.getAllByType(portalSlug, 'procedure');
        
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          setPublishedProcedures(Array.isArray(procedures) ? procedures : []);
        }
      } catch (error) {
        console.error('[ProcedurePortalRoot] Failed to load:', error);
        if (isMounted) {
          setPublishedProcedures([]);
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

  if (!publishedProcedures || publishedProcedures.length === 0) {
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
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Operational Procedures</p>
          <h1 className="text-4xl font-semibold">Procedure Documentation</h1>
          <p className="text-cyan-200/70 mt-2">{publishedProcedures.length} published {publishedProcedures.length === 1 ? 'procedure' : 'procedures'}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {publishedProcedures.map((procedureSystem) => {
          const steps = procedureSystem.content?.steps || [];
          return (
            <div key={procedureSystem.id} className="space-y-8">
              <div className="border-b border-cyan-500/20 pb-6">
                <h2 className="text-3xl font-semibold">{procedureSystem.title}</h2>
                {procedureSystem.description && <p className="text-cyan-200/70 mt-2">{procedureSystem.description}</p>}
                {procedureSystem.content?.overview && <p className="text-cyan-200/60 mt-2 italic">{procedureSystem.content.overview}</p>}
              </div>
              
              {steps.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-cyan-500/30" />
                  <div className="space-y-8">
                    {steps.map((step, index) => (
                      <div key={step.id} className="relative pl-14">
                        <div className="absolute left-0 top-2 h-9 w-9 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="border border-cyan-500/20 bg-slate-900/70 rounded-2xl p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-2xl font-semibold">{step.title || `Step ${index + 1}`}</h3>
                            </div>
                          </div>
                          <div
                            className="mt-4 text-cyan-50/90 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: step.description || '<p>No instructions provided.</p>' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-cyan-500/20 bg-slate-900/70 rounded-2xl p-6">
                  <p className="text-cyan-200/70">No steps available for this procedure.</p>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default ProcedurePortalRoot;
