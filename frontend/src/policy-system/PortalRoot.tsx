import React, { useEffect, useState } from 'react';
import { PolicyDraft } from './model';
import { disablePolicyPortalReadOnly, enablePolicyPortalReadOnly, getLatestPublishedPolicy } from './service';

type PolicyPortalRootProps = {
  portalSlug?: string;
};

export const PolicyPortalRoot = ({ portalSlug }: PolicyPortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<PolicyDraft | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Workspace');

  useEffect(() => {
    enablePolicyPortalReadOnly();
    return () => disablePolicyPortalReadOnly();
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
        const latest = getLatestPublishedPolicy(String(workspaceId));
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
        <div className="h-10 w-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-amber-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-amber-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Policies</p>
          <h1 className="text-3xl font-semibold">No Published Policies</h1>
          <p className="text-amber-200/70">
            {workspaceName} has not published official policy documentation yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-amber-50">
      <header className="border-b border-amber-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Official Policies</p>
              <h1 className="text-4xl font-semibold">{published.title}</h1>
              <p className="text-amber-200/70 mt-2">{published.description}</p>
            </div>
            <div className="px-4 py-2 border border-amber-400/40 rounded-full text-xs uppercase tracking-[0.2em]">
              Version badge
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-amber-200/70">
            {published.effectiveDate && <span>Effective: {published.effectiveDate}</span>}
            {published.jurisdiction && <span>Jurisdiction: {published.jurisdiction}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        {published.sections.map((section, index) => (
          <article key={section.id} className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/60">Section {index + 1}</p>
                <h2 className="text-2xl font-semibold">{section.title || 'Untitled Section'}</h2>
                {section.category && <p className="text-sm text-amber-200/70 mt-1">Category: {section.category}</p>}
              </div>
              <span className="text-xs text-amber-200/60">{new Date(section.lastUpdated).toLocaleDateString()}</span>
            </div>
            <div
              className="mt-6 space-y-4 text-amber-50/90 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: section.content || '<p>No content provided.</p>' }}
            />
          </article>
        ))}
      </main>
    </div>
  );
};

export default PolicyPortalRoot;
