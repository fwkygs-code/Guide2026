/**
 * Knowledge System Editor Router
 *
 * Routes to type-specific builders for full knowledge system editing.
 * Each system has its own dedicated, purpose-built editor.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PolicyBuilder from './builders/PolicyBuilder';
import ProcedureBuilder from './builders/ProcedureBuilder';
import DocumentationBuilder from './builders/DocumentationBuilder';
import FAQBuilder from './builders/FAQBuilder';
import DecisionTreeBuilder from './builders/DecisionTreeBuilder';

/**
 * Knowledge System Editor - Routes to Type-Specific Builders
 */
function KnowledgeSystemEditor({ system, onSave, onClose }) {
  const { workspaceSlug, systemType, itemId } = useParams();
  const navigate = useNavigate();

  // Enhanced close handler that navigates back to content list
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(`/workspace/${workspaceSlug}/knowledge/${systemType}`);
    }
  };

  // Enhanced save handler
  const handleSave = (data) => {
    if (onSave) {
      onSave(data);
    }
    handleClose();
  };

  // Route to type-specific builder
  switch (system?.type || systemType) {
    case 'policy':
      return <PolicyBuilder system={system} onSave={handleSave} onClose={handleClose} />;
    case 'procedure':
      return <ProcedureBuilder system={system} onSave={handleSave} onClose={handleClose} />;
    case 'documentation':
      return <DocumentationBuilder system={system} onSave={handleSave} onClose={handleClose} />;
    case 'faq':
      return <FAQBuilder system={system} onSave={handleSave} onClose={handleClose} />;
    case 'decision_tree':
      return <DecisionTreeBuilder system={system} onSave={handleSave} onClose={handleClose} />;
    default:
      // This should never happen with proper routing
      return null;
  }
}

export default KnowledgeSystemEditor;