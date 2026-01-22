/**
 * Knowledge System Portal Page
 *
 * Base component for rendering knowledge systems in the portal.
 * Read-only interface for end users.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getKnowledgeSystems } from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge System Portal Page
 * Renders specific knowledge system content in read-only mode
 */
function KnowledgeSystemPortalPage({ systemType }) {
  const { slug } = useParams();
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystem();
  }, [slug, systemType]);

  const loadSystem = async () => {
    setLoading(true);
    try {
      // Get workspace data from portal API
      const portalResponse = await fetch(`/api/portal/${slug}`);
      const portalData = await portalResponse.json();
      const workspaceId = portalData.workspace.id;

      const systems = getKnowledgeSystems(workspaceId);
      const targetSystem = systems.find(s => s.type === systemType && s.enabled);

      setSystem(targetSystem);
    } catch (error) {
      console.error('Failed to load knowledge system:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Content Not Available</h1>
          <p className="text-slate-600">
            This knowledge system is not currently available.
          </p>
          <Link to={`/portal/${slug}`}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const config = getKnowledgeSystemConfig(system.type);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Link to={`/portal/${slug}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl">{config?.icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{system.title}</h1>
              <p className="text-slate-600">{system.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last updated {new Date(system.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <KnowledgeSystemContentRenderer system={system} />
      </main>
    </div>
  );
}

/**
 * Content Renderer for different knowledge system types
 */
function KnowledgeSystemContentRenderer({ system }) {
  switch (system.type) {
    case 'policy':
      return <PolicyContentRenderer content={system.content} />;
    case 'procedure':
      return <ProcedureContentRenderer content={system.content} />;
    case 'documentation':
      return <DocumentationContentRenderer content={system.content} />;
    case 'faq':
      return <FAQContentRenderer content={system.content} />;
    case 'decision_tree':
      return <DecisionTreeContentRenderer content={system.content} />;
    default:
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">
              Content renderer not available for this system type.
            </p>
          </CardContent>
        </Card>
      );
  }
}

/**
 * Policy Content Renderer - Read-only
 */
function PolicyContentRenderer({ content }) {
  const policies = content.policies || [];

  if (policies.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-600">No policies have been published yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {policies.map((policy, index) => (
        <Card key={policy.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{policy.title}</CardTitle>
                {policy.category && (
                  <Badge variant="secondary">{policy.category}</Badge>
                )}
              </div>
              <div className="text-sm text-slate-500">
                Updated {new Date(policy.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-slate max-w-none">
              {policy.content.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-4 text-slate-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Procedure Content Renderer - Read-only with collapsible steps
 */
function ProcedureContentRenderer({ content }) {
  const procedures = content.procedures || [];

  return (
    <div className="space-y-6">
      {procedures.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No procedures have been published yet.</p>
          </CardContent>
        </Card>
      ) : (
        procedures.map(procedure => (
          <ProcedureRenderer key={procedure.id} procedure={procedure} />
        ))
      )}
    </div>
  );
}

/**
 * Individual Procedure Renderer
 */
function ProcedureRenderer({ procedure }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  const toggleStep = (stepId) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{procedure.title}</CardTitle>
            {procedure.category && (
              <Badge variant="secondary">{procedure.category}</Badge>
            )}
          </div>
          <div className="text-sm text-slate-500">
            Updated {new Date(procedure.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {(procedure.steps || []).map((step, index) => (
            <div key={step.id} className="border border-slate-200 rounded-lg">
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium text-slate-900">{step.title}</span>
                  </div>
                  <span className={`transform transition-transform ${expandedSteps.has(step.id) ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </div>
              </button>

              {expandedSteps.has(step.id) && (
                <div className="px-4 pb-4">
                  <p className="text-slate-700 leading-relaxed ml-9">
                    {step.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Documentation Content Renderer - Read-only with sections
 */
function DocumentationContentRenderer({ content }) {
  const sections = content.sections || [];

  return (
    <div className="space-y-8">
      {sections.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No documentation has been published yet.</p>
          </CardContent>
        </Card>
      ) : (
        sections
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(section => (
            <DocumentationSectionRenderer key={section.id} section={section} />
          ))
      )}
    </div>
  );
}

/**
 * Documentation Section Renderer
 */
function DocumentationSectionRenderer({ section }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left flex items-center justify-between hover:bg-slate-50 p-2 -m-2 rounded transition-colors"
        >
          <CardTitle className="text-xl">{section.title}</CardTitle>
          <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="prose prose-slate max-w-none mb-6">
            {section.content.split('\n').map((paragraph, i) => (
              <p key={i} className="mb-4 text-slate-700 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="space-y-4">
              {section.subsections
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(subsection => (
                  <div key={subsection.id} className="border-l-4 border-slate-200 pl-4">
                    <h4 className="font-semibold text-lg mb-2">{subsection.title}</h4>
                    <div className="prose prose-slate max-w-none">
                      {subsection.content.split('\n').map((paragraph, i) => (
                        <p key={i} className="mb-3 text-slate-700 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * FAQ Content Renderer - Question/Answer format
 */
function FAQContentRenderer({ content }) {
  const faqs = content.faqs || [];
  const [expandedFaqs, setExpandedFaqs] = useState(new Set());

  const toggleFaq = (faqId) => {
    const newExpanded = new Set(expandedFaqs);
    if (newExpanded.has(faqId)) {
      newExpanded.delete(faqId);
    } else {
      newExpanded.add(faqId);
    }
    setExpandedFaqs(newExpanded);
  };

  if (faqs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-600">No FAQs have been published yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {faqs.map(faq => (
        <Card key={faq.id}>
          <CardHeader>
            <button
              onClick={() => toggleFaq(faq.id)}
              className="w-full text-left flex items-center justify-between hover:bg-slate-50 p-2 -m-2 rounded transition-colors"
            >
              <CardTitle className="text-lg font-medium">{faq.question}</CardTitle>
              <span className={`transform transition-transform ${expandedFaqs.has(faq.id) ? 'rotate-45' : ''}`}>
                +
              </span>
            </button>
            {faq.category && (
              <Badge variant="secondary" className="w-fit">{faq.category}</Badge>
            )}
          </CardHeader>

          {expandedFaqs.has(faq.id) && (
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
              {faq.tags && faq.tags.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {faq.tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

/**
 * Decision Tree Content Renderer - Read-only tree display
 */
function DecisionTreeContentRenderer({ content }) {
  const trees = content.trees || [];

  return (
    <div className="space-y-6">
      {trees.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No decision trees have been published yet.</p>
          </CardContent>
        </Card>
      ) : (
        trees.map(tree => (
          <DecisionTreeRenderer key={tree.id} tree={tree} />
        ))
      )}
    </div>
  );
}

/**
 * Decision Tree Renderer - Simplified read-only view
 */
function DecisionTreeRenderer({ tree }) {
  // For simplicity, just show the tree structure without interactivity
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{tree.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center text-slate-600 py-8">
          <p>Decision tree visualization would appear here.</p>
          <p className="text-sm mt-2">
            This is a read-only portal view. Interactive decision trees are available in the full application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default KnowledgeSystemPortalPage;