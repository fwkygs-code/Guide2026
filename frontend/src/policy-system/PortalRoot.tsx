import React, { useEffect, useState } from 'react';
import { PolicyDraft, POLICY_MODEL_VERSION } from './model';
import { policyPortalApiClient } from './portal-api-client';
import sanitizeHtml from './sanitizeHtml';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

type PolicyPortalRootProps = {
  portalSlug?: string;
};

const normalizePolicyDraft = (system: any): PolicyDraft => ({
  version: POLICY_MODEL_VERSION,
  title: system.title || '',
  description: system.description || '',
  effectiveDate: system.content?.effectiveDate || '',
  jurisdiction: system.content?.jurisdiction || '',
  sections: system.content?.sections || []
});

export const PolicyPortalRoot = ({ portalSlug }: PolicyPortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [publishedPolicies, setPublishedPolicies] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        console.log('[PolicyPortalRoot] Loading portal for slug:', portalSlug);
        
        // Get workspace info
        const portalResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/api/portal/${portalSlug}`);
        const portalData = await portalResponse.json();
        const workspaceLabel = portalData?.workspace?.name || portalData?.workspace?.slug || 'Workspace';
        
        // Get published policies from backend
        const policies = await policyPortalApiClient.getAllByType(portalSlug);
        console.log('[PolicyPortalRoot] Loaded policies:', policies);
        
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          setPublishedPolicies(Array.isArray(policies) ? policies : []);
        }
      } catch (error) {
        console.error('[PolicyPortalRoot] Failed to load:', error);
        if (isMounted) {
          setPublishedPolicies([]);
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

  if (!publishedPolicies || publishedPolicies.length === 0) {
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
              <h1 className="text-4xl font-semibold">Policy Documentation</h1>
              <p className="text-amber-200/70 mt-2">{publishedPolicies.length} published {publishedPolicies.length === 1 ? 'policy' : 'policies'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        {publishedPolicies.map((policySystem) => {
          const published = normalizePolicyDraft(policySystem);
          return (
            <div key={policySystem.id} className="space-y-8">
              <div className="border-b border-amber-500/20 pb-6">
                <h2 className="text-3xl font-semibold">{published.title}</h2>
                {published.description && <p className="text-amber-200/70 mt-2">{published.description}</p>}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-amber-200/70">
                  {published.effectiveDate && <span>Effective: {published.effectiveDate}</span>}
                  {published.jurisdiction && <span>Jurisdiction: {published.jurisdiction}</span>}
                  {policySystem.updated_at && <span>Updated: {new Date(policySystem.updated_at).toLocaleDateString()}</span>}
                </div>
              </div>
              
              {published.sections && published.sections.length > 0 ? (
                published.sections.map((section, index) => (
                  <article key={section.id} className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/60">Section {index + 1}</p>
                        <h3 className="text-2xl font-semibold">{section.title || 'Untitled Section'}</h3>
                        {section.category && <p className="text-sm text-amber-200/70 mt-1">Category: {section.category}</p>}
                      </div>
                      <span className="text-xs text-amber-200/60">{new Date(section.lastUpdated).toLocaleDateString()}</span>
                    </div>
                    <div
                      className="mt-6 space-y-4 text-amber-50/90 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content || '<p>No content provided.</p>') }}
                    />
                  </article>
                ))
              ) : (
                <article className="border border-amber-500/20 bg-slate-900/70 rounded-2xl p-8">
                  <p className="text-amber-200/70">No sections available for this policy.</p>
                </article>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default PolicyPortalRoot;
