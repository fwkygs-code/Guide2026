import React, { useEffect, useMemo, useState } from 'react';
import { faqPortalApiClient } from './portal-api-client';
import sanitizeHtml from './sanitizeHtml';

type FAQPortalRootProps = {
  portalSlug?: string;
};

export const FAQPortalRoot = ({ portalSlug }: FAQPortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [publishedFAQs, setPublishedFAQs] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        const portalResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/api/portal/${portalSlug}`);
        const portalData = await portalResponse.json();
        const workspaceLabel = portalData?.workspace?.name || portalData?.workspace?.slug || 'Workspace';
        
        const faqs = await faqPortalApiClient.getAllByType(portalSlug);
        
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          setPublishedFAQs(Array.isArray(faqs) ? faqs : []);
        }
      } catch (error) {
        console.error('[FAQPortalRoot] Failed to load:', error);
        if (isMounted) {
          setPublishedFAQs([]);
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
    if (!publishedFAQs || publishedFAQs.length === 0) return [];
    const query = search.trim().toLowerCase();
    if (!query) return publishedFAQs;
    return publishedFAQs.filter((faq) => {
      const question = (faq.content?.question || '').toLowerCase();
      const answer = (faq.content?.answer || '').toLowerCase();
      return question.includes(query) || answer.includes(query);
    });
  }, [publishedFAQs, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!publishedFAQs || publishedFAQs.length === 0) {
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
          <h1 className="text-4xl font-semibold">Frequently Asked Questions</h1>
          <p className="text-emerald-200/70">{publishedFAQs.length} published {publishedFAQs.length === 1 ? 'question' : 'questions'}</p>
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
        {filteredItems.map((faq) => {
          const question = faq.content?.question || faq.title || 'Untitled question';
          const answer = faq.content?.answer || '';
          const category = faq.content?.category;
          const faqId = faq.id;
          
          return (
            <div key={faqId} className="border border-emerald-500/20 bg-slate-900/70 rounded-2xl p-6">
              <button
                type="button"
                className="w-full text-left flex items-center justify-between gap-4"
                onClick={() => setOpenId(openId === faqId ? null : faqId)}
              >
                <h2 className="text-lg font-semibold">{question}</h2>
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                  {openId === faqId ? 'Hide' : 'View'}
                </span>
              </button>
              {openId === faqId && answer && (
                <div
                  className="mt-4 text-emerald-100/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(answer) }}
                />
              )}
              {category && (
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                  {category}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default FAQPortalRoot;
