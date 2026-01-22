/**
 * Knowledge System Editor Router
 *
 * Routes to type-specific builders instead of generic modal.
 */

import React from 'react';
import PolicyBuilder from './builders/PolicyBuilder';

/**
 * Knowledge System Editor - Routes to Type-Specific Builders
 */
function KnowledgeSystemEditor({ system, onSave, onClose }) {
  // Route to type-specific builder
  switch (system.type) {
    case 'policy':
      return <PolicyBuilder system={system} onSave={onSave} onClose={onClose} />;
    case 'procedure':
    case 'documentation':
    case 'faq':
    case 'decision_tree':
    default:
      // Placeholder for unimplemented builders
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-6xl">🚧</div>
            <h1 className="text-2xl font-bold text-white">Builder Coming Soon</h1>
            <p className="text-slate-400 max-w-md">
              The {system.type} builder is under development. This will be a specialized interface designed specifically for {system.type} content.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      );
  }
}

export default KnowledgeSystemEditor;