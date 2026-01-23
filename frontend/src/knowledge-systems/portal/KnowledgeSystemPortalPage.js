/**
 * Knowledge System Portal Page - Router Component
 *
 * Routes to appropriate specialized portal pages based on content type.
 * Each content type now has its own dedicated, futuristic interface.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import PolicyPortalPage from './PolicyPortalPage';
import ProcedurePortalPage from './ProcedurePortalPage';
import DocumentationPortalPage from './DocumentationPortalPage';
import FAQPortalPage from './FAQPortalPage';
import DecisionTreePortalPage from './DecisionTreePortalPage';

/**
 * Knowledge System Portal Page Router
 *
 * Routes to the appropriate specialized portal page based on system type.
 * Each content type has its own unique, futuristic interface design.
 */
function KnowledgeSystemPortalPage({ systemType }) {
  const { slug } = useParams();

  // Route to appropriate specialized portal page
  switch (systemType) {
    case 'policy':
      return <PolicyPortalPage />;
    case 'procedure':
      return <ProcedurePortalPage />;
    case 'documentation':
      return <DocumentationPortalPage />;
    case 'faq':
      return <FAQPortalPage />;
    case 'decision_tree':
      return <DecisionTreePortalPage />;
    default:
      // Fallback to a generic message for unknown types
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <span className="text-2xl">❓</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent mb-4">
              Unknown Content Type
            </h1>
            <p className="text-slate-100/80 leading-relaxed">
              This content type is not currently supported in the portal.
            </p>
          </div>
        </div>
      );
  }
}

export default KnowledgeSystemPortalPage;