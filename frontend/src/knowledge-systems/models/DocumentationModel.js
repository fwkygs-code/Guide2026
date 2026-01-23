/**
 * Documentation Model - Isolated Knowledge Content
 *
 * No shared abstractions. Documentation owns its complete data model.
 */

// Documentation Data Model
export const DOCUMENTATION_MODEL_VERSION = '1.0.0';

// Documentation System Types
export const DOCUMENTATION_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// Documentation Content Schema
export const DOCUMENTATION_CONTENT_SCHEMA = {
  version: DOCUMENTATION_MODEL_VERSION,
  title: 'string',
  description: 'string',
  sections: [{
    id: 'string',
    title: 'string',
    content: 'richtext',
    subsections: [{
      id: 'string',
      title: 'string',
      content: 'richtext',
      order: 'number'
    }],
    order: 'number'
  }]
};

/**
 * Documentation System Instance
 * @typedef {Object} DocumentationSystem
 * @property {string} id - Unique system identifier
 * @property {string} type - Always 'documentation'
 * @property {string} workspaceId - Associated workspace
 * @property {boolean} enabled - Portal visibility flag
 * @property {Date|string} createdAt - Creation timestamp
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {Object} draftContent - Working content
 * @property {Object} publishedContent - Live portal content
 */

/**
 * Create new Documentation System instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {DocumentationSystem}
 */
export function createDocumentationSystem({ workspaceId, title = 'Product Documentation' }) {
  const now = new Date().toISOString();
  return {
    id: `documentation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'documentation',
    workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: DOCUMENTATION_MODEL_VERSION,
      title,
      description: '',
      sections: [{
        id: `section-${Date.now()}`,
        title: '',
        content: '',
        subsections: [],
        order: 1
      }]
    },
    publishedContent: null
  };
}

/**
 * Validate Documentation System object
 * @param {Object} system
 * @returns {boolean}
 */
export function validateDocumentationSystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'documentation' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateDocumentationContent(system.draftContent) &&
    (system.publishedContent === null || validateDocumentationContent(system.publishedContent))
  );
}

/**
 * Validate Documentation Content structure
 * @param {Object} content
 * @returns {boolean}
 */
export function validateDocumentationContent(content) {
  return (
    content &&
    content.version === DOCUMENTATION_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.sections) &&
    content.sections.every(section =>
      typeof section.id === 'string' &&
      typeof section.title === 'string' &&
      typeof section.content === 'string' &&
      typeof section.order === 'number' &&
      Array.isArray(section.subsections) &&
      section.subsections.every(subsection =>
        typeof subsection.id === 'string' &&
        typeof subsection.title === 'string' &&
        typeof subsection.content === 'string' &&
        typeof subsection.order === 'number'
      )
    )
  );
}

/**
 * Publish draft content to live portal
 * @param {DocumentationSystem} system
 * @returns {DocumentationSystem} Updated system with published content
 */
export function publishDocumentationSystem(system) {
  if (!validateDocumentationContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)), // Deep copy
    updatedAt: new Date().toISOString()
  };
}