import React, { useEffect, useMemo, useState } from 'react';
import { FAQDraft } from './model';
import { disableFAQPortalReadOnly, enableFAQPortalReadOnly, getLatestPublishedFAQ } from './service';

type FAQPortalRootProps = {
  portalSlug?: string;
};

export const FAQPortalRoot = ({ portalSlug }: FAQPortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<FAQDraft | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    enableFAQPortalReadOnly();
    return () => disableFAQPortalReadOnly();
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
        const latest = getLatestPublishedFAQ(String(workspaceId));
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

  const filteredItems = useMemo(() => {
    if (!published) return [];
    const query = search.trim().toLowerCase();
    if (!query) return published.items;
    return published.items.filter((item) =>
      item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)
    );
  }, [published, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-emerald-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">FAQs</p>
          <h1 className="text-3xl font-semibold">No Published FAQs</h1>
          <p className="text-emerald-200/70">
            {workspaceName} has not published FAQs yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-emerald-50">
      <header className="border-b border-emerald-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">FAQs</p>
          <h1 className="text-4xl font-semibold">{published.title}</h1>
          <p className="text-emerald-200/70">{published.description}</p>
          <div className="mt-6">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-slate-950/70 border border-emerald-500/20 rounded-full px-4 py-3 text-emerald-50 focus:outline-none focus:border-emerald-400/50"
              placeholder="Search questions"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-4">
        {filteredItems.length === 0 && (
          <div className="border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-10 text-center text-emerald-200/70">
            No matching questions found.
          </div>
        )}
        {filteredItems.map((item) => (
          <div key={item.id} className="border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-6">
            <button
              type="button"
              className="w-full text-left flex items-center justify-between gap-4"
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
            >
              <h2 className="text-lg font-semibold">{item.question || 'Untitled question'}</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                {openId === item.id ? 'Hide' : 'View'}
              </span>
            </button>
            {openId === item.id && (
              <div
                className="mt-4 text-emerald-100/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: item.answer || '<p>No answer provided.</p>' }}
              />
            )}
            {item.category && (
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                {item.category}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
};

export default FAQPortalRoot;
