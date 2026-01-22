/**
 * Knowledge System Data Model
 *
 * Isolated from all existing application logic.
 * Defines the structure for workspace knowledge systems.
 */

// Knowledge System Types
export const KNOWLEDGE_SYSTEM_TYPES = {
  POLICY: 'policy',
  PROCEDURE: 'procedure',
  DOCUMENTATION: 'documentation',
  FAQ: 'faq',
  DECISION_TREE: 'decision_tree'
};

// Visibility Options
export const VISIBILITY_OPTIONS = {
  INTERNAL: 'internal',
  PORTAL: 'portal'
};

/**
 * KnowledgeSystem Model
 * @typedef {Object} KnowledgeSystem
 * @property {string} id - Unique identifier
 * @property {string} type - One of KNOWLEDGE_SYSTEM_TYPES
 * @property {string} title - Display title
 * @property {string} description - Description text
 * @property {boolean} enabled - Whether this system is active
 * @property {string} workspaceId - Associated workspace ID
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {string} visibility - One of VISIBILITY_OPTIONS
 * @property {Object} content - System-specific content data
 */

/**
 * Create a new KnowledgeSystem instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.description
 * @returns {KnowledgeSystem}
 */
export function createKnowledgeSystem({ workspaceId, type, title, description }) {
  return {
    id: `ks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title: title || getDefaultTitle(type),
    description: description || '',
    enabled: false, // Nothing enabled by default
    workspaceId,
    updatedAt: new Date().toISOString(),
    visibility: VISIBILITY_OPTIONS.INTERNAL,
    content: getDefaultContent(type)
  };
}

/**
 * Get default title for a knowledge system type
 * @param {string} type
 * @returns {string}
 */
function getDefaultTitle(type) {
  const titles = {
    [KNOWLEDGE_SYSTEM_TYPES.POLICY]: 'Policies',
    [KNOWLEDGE_SYSTEM_TYPES.PROCEDURE]: 'Procedures',
    [KNOWLEDGE_SYSTEM_TYPES.DOCUMENTATION]: 'Documentation',
    [KNOWLEDGE_SYSTEM_TYPES.FAQ]: 'FAQs',
    [KNOWLEDGE_SYSTEM_TYPES.DECISION_TREE]: 'Decision Trees'
  };
  return titles[type] || 'Knowledge System';
}

/**
 * Get default content structure for a knowledge system type
 * @param {string} type
 * @returns {Object}
 */
function getDefaultContent(type) {
  switch (type) {
    case KNOWLEDGE_SYSTEM_TYPES.POLICY:
      return {
        policies: []
      };

    case KNOWLEDGE_SYSTEM_TYPES.PROCEDURE:
      return {
        procedures: []
      };

    case KNOWLEDGE_SYSTEM_TYPES.DOCUMENTATION:
      return {
        sections: []
      };

    case KNOWLEDGE_SYSTEM_TYPES.FAQ:
      return {
        faqs: []
      };

    case KNOWLEDGE_SYSTEM_TYPES.DECISION_TREE:
      return {
        trees: []
      };

    default:
      return {};
  }
}

/**
 * Validate a KnowledgeSystem object
 * @param {Object} system
 * @returns {boolean}
 */
export function validateKnowledgeSystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    Object.values(KNOWLEDGE_SYSTEM_TYPES).includes(system.type) &&
    typeof system.title === 'string' &&
    typeof system.description === 'string' &&
    typeof system.enabled === 'boolean' &&
    typeof system.workspaceId === 'string' &&
    Object.values(VISIBILITY_OPTIONS).includes(system.visibility) &&
    system.content !== undefined
  );
}