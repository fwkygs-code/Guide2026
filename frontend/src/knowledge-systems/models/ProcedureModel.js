/**
 * Procedure Model - Isolated Workflow Content
 *
 * No shared abstractions. Procedures own their complete data model.
 */

// Procedure Data Model
export const PROCEDURE_MODEL_VERSION = '1.0.0';

// Procedure System Types
export const PROCEDURE_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// Procedure Content Schema
export const PROCEDURE_CONTENT_SCHEMA = {
  version: PROCEDURE_MODEL_VERSION,
  title: 'string',
  description: 'string',
  procedures: [{
    id: 'string',
    title: 'string',
    description: 'string',
    steps: [{
      id: 'string',
      title: 'string',
      description: 'richtext',
      order: 'number'
    }],
    category: 'string',
    lastUpdated: 'date'
  }]
};

/**
 * Procedure System Instance
 * @typedef {Object} ProcedureSystem
 * @property {string} id - Unique system identifier
 * @property {string} type - Always 'procedure'
 * @property {string} workspaceId - Associated workspace
 * @property {boolean} enabled - Portal visibility flag
 * @property {Date|string} createdAt - Creation timestamp
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {Object} draftContent - Working content
 * @property {Object} publishedContent - Live portal content
 */

/**
 * Create new Procedure System instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {ProcedureSystem}
 */
export function createProcedureSystem({ workspaceId, title = 'Standard Procedures' }) {
  const now = new Date().toISOString();
  return {
    id: `procedure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'procedure',
    workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: PROCEDURE_MODEL_VERSION,
      title,
      description: '',
      procedures: [{
        id: `procedure-${Date.now()}`,
        title: '',
        description: '',
        steps: [],
        category: '',
        lastUpdated: now
      }]
    },
    publishedContent: null
  };
}

/**
 * Validate Procedure System object
 * @param {Object} system
 * @returns {boolean}
 */
export function validateProcedureSystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'procedure' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateProcedureContent(system.draftContent) &&
    (system.publishedContent === null || validateProcedureContent(system.publishedContent))
  );
}

/**
 * Validate Procedure Content structure
 * @param {Object} content
 * @returns {boolean}
 */
export function validateProcedureContent(content) {
  return (
    content &&
    content.version === PROCEDURE_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.procedures) &&
    content.procedures.every(procedure =>
      typeof procedure.id === 'string' &&
      typeof procedure.title === 'string' &&
      typeof procedure.description === 'string' &&
      typeof procedure.category === 'string' &&
      Array.isArray(procedure.steps) &&
      procedure.steps.every(step =>
        typeof step.id === 'string' &&
        typeof step.title === 'string' &&
        typeof step.description === 'string' &&
        typeof step.order === 'number'
      )
    )
  );
}

/**
 * Publish draft content to live portal
 * @param {ProcedureSystem} system
 * @returns {ProcedureSystem} Updated system with published content
 */
export function publishProcedureSystem(system) {
  if (!validateProcedureContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)), // Deep copy
    updatedAt: new Date().toISOString()
  };
}