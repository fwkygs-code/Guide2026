import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { documentationPortalApiClient } from './portal-api-client';
import sanitizeHtml from './sanitizeHtml';

const ANIMATIONX_URL = 'https://res.cloudinary.com/ds1dgifj8/video/upload/q_auto,f_auto/interguide-static/animationx';

type DocumentationPortalRootProps = {
  portalSlug?: string;
};

export const DocumentationPortalRoot = ({ portalSlug }: DocumentationPortalRootProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [publishedDocs, setPublishedDocs] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (!portalSlug) return;
    let isMounted = true;
    const loadPortal = async () => {
      setLoading(true);
      try {
        const portalResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/api/portal/${portalSlug}`);
        const portalData = await portalResponse.json();
        const workspaceLabel = portalData?.workspace?.name || portalData?.workspace?.slug || 'Workspace';
        
        const docs = await documentationPortalApiClient.getAllByType(portalSlug);
        
        if (isMounted) {
          setWorkspaceName(workspaceLabel);
          setPublishedDocs(Array.isArray(docs) ? docs : []);
        }
      } catch (error) {
        console.error('[DocumentationPortalRoot] Failed to load:', error);
        if (isMounted) {
          setPublishedDocs([]);
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

  if (!publishedDocs || publishedDocs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-purple-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-purple-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">{t('documentation.title')}</p>
          <h1 className="text-3xl font-semibold">{t('documentation.portal.title')}</h1>
          <p className="text-purple-200/70">
            {t('documentation.portal.description')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-purple-50">
      <header className="border-b border-purple-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">{t('documentation.title')}</p>
          <h1 className="text-4xl font-semibold">{t('documentation.portal.title')}</h1>
          <p className="text-purple-200/70 mt-2">{t('portal.available', { count: publishedDocs.length })}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {publishedDocs.map((docSystem) => {
          const content = docSystem.content?.content || '';
          const subsections = docSystem.content?.subsections || [];
          const safeContent = sanitizeHtml(
            content.split('\n\n').map((p) => `<p>${p}</p>`).join('')
          );
          
          return (
            <div key={docSystem.id} className="space-y-8">
              <div className="border-b border-purple-500/20 pb-6">
                <h2 className="text-3xl font-semibold">{docSystem.title}</h2>
                {docSystem.description && <p className="text-purple-200/70 mt-2">{docSystem.description}</p>}
              </div>
              
              {content && (
                <section className="prose prose-lg max-w-none">
                  <div
                    className="text-purple-100/80 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: safeContent }}
                  />
                </section>
              )}
              
              {subsections.length > 0 && (
                <div className="space-y-6">
                  {subsections.map((subsection) => (
                    <section key={subsection.id} className="border border-purple-500/20 bg-slate-900/70 rounded-2xl p-6">
                      <h3 className="text-2xl font-semibold text-purple-50 mb-3">{subsection.title || 'Untitled Section'}</h3>
                      <div
                        className="text-purple-100/80 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(subsection.content || '<p>No content provided.</p>') }}
                      />
                    </section>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default DocumentationPortalRoot;
