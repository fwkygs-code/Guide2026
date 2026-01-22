/**
 * Knowledge System Editor Router
 *
 * Routes to type-specific builders instead of generic modal.
 * This component is now used for editing individual content items.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PolicyBuilder from './builders/PolicyBuilder';
import KnowledgeSystemPlaceholderPage from './KnowledgeSystemPlaceholderPage';

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
    case 'documentation':
    case 'faq':
    case 'decision_tree':
    default:
      // Show placeholder for unimplemented builders
      return <KnowledgeSystemPlaceholderPage />;
  }
}

export default KnowledgeSystemEditor;