import React, { useEffect, useMemo, useState } from 'react';
import { DocumentationDraft, DocumentationSection } from './model';
import { disableDocumentationPortalReadOnly, enableDocumentationPortalReadOnly, getLatestPublishedDocumentation } from './service';

type DocumentationPortalRootProps = {
  portalSlug?: string;
};

const flattenSections = (sections: DocumentationSection[], depth = 0) =>
  sections.flatMap((section) => [
    { id: section.id, title: section.title || 'Untitled', depth },
    ...flattenSections(section.children, depth + 1)
  ]);

const renderPortalSection = (section: DocumentationSection, depth: number) => (
  <section key={section.id} id={`doc-${section.id}`} className={depth === 0 ? 'mb-10' : 'mb-8'}>
    <h2 className={`font-semibold ${depth === 0 ? 'text-3xl' : 'text-2xl'} text-purple-50`}>
      {section.title || 'Untitled Section'}
    </h2>
    <div
      className="mt-3 text-purple-100/80 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: section.content || '<p>No content provided.</p>' }}
    />
    {section.codeBlock && (
      <pre className="mt-5 bg-slate-950/80 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-100 overflow-x-auto">
        <code>{section.codeBlock}</code>
      </pre>
    )}
    {section.children.map((child) => renderPortalSection(child, depth + 1))}
  </section>
);

export const DocumentationPortalRoot = ({ portalSlug }: DocumentationPortalRootProps) => {
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState<DocumentationDraft | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    enableDocumentationPortalReadOnly();
    return () => disableDocumentationPortalReadOnly();
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
        const latest = getLatestPublishedDocumentation(String(workspaceId));
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

  const navSections = useMemo(() => (published ? flattenSections(published.sections) : []), [published]);

  useEffect(() => {
    if (!published) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute('id') || null);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 1] }
    );
    published.sections.forEach((section) => {
      const element = document.getElementById(`doc-${section.id}`);
      if (element) observer.observe(element);
      section.children.forEach((child) => {
        const childElement = document.getElementById(`doc-${child.id}`);
        if (childElement) observer.observe(childElement);
      });
    });
    return () => observer.disconnect();
  }, [published]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-purple-50 flex items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-4 border border-purple-500/20 bg-slate-900/70 rounded-2xl p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Documentation</p>
          <h1 className="text-3xl font-semibold">No Published Documentation</h1>
          <p className="text-purple-200/70">
            {workspaceName} has not published documentation yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-purple-50">
      <header className="border-b border-purple-500/20 bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Knowledge Base</p>
          <h1 className="text-4xl font-semibold">{published.title}</h1>
          <p className="text-purple-200/70 mt-2">{published.description}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="sticky top-24 h-fit border border-purple-500/20 bg-slate-900/70 rounded-2xl p-4">
          <h2 className="text-sm uppercase tracking-[0.25em] text-purple-200/70 mb-4">Sections</h2>
          <nav className="space-y-2">
            {navSections.map((section) => {
              const isActive = activeSection === `doc-${section.id}`;
              return (
                <a
                  key={section.id}
                  href={`#doc-${section.id}`}
                  className={`block text-sm transition ${
                    isActive ? 'text-purple-100' : 'text-purple-200/60 hover:text-purple-100'
                  }`}
                  style={{ paddingLeft: `${section.depth * 12}px` }}
                >
                  {section.title}
                </a>
              );
            })}
          </nav>
        </aside>
        <section>
          {published.sections.map((section) => renderPortalSection(section, 0))}
        </section>
      </main>
    </div>
  );
};

export default DocumentationPortalRoot;
