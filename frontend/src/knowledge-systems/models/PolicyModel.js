/**
 * Policy Model - Isolated Authoritative Content
 *
 * No shared abstractions. Policies own their complete data model.
 */

// Policy Data Model
export const POLICY_MODEL_VERSION = '1.0.0';

// Policy System Types
export const POLICY_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// Policy Content Schema
export const POLICY_CONTENT_SCHEMA = {
  version: POLICY_MODEL_VERSION,
  title: 'string',
  description: 'string',
  effectiveDate: 'date',
  jurisdiction: 'string',
  policies: [{
    id: 'string',
    title: 'string',
    content: 'richtext',
    category: 'string',
    lastUpdated: 'date'
  }]
};

/**
 * Policy System Instance
 * @typedef {Object} PolicySystem
 * @property {string} id - Unique system identifier
 * @property {string} type - Always 'policy'
 * @property {string} workspaceId - Associated workspace
 * @property {boolean} enabled - Portal visibility flag
 * @property {Date|string} createdAt - Creation timestamp
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {Object} draftContent - Working content
 * @property {Object} publishedContent - Live portal content
 */

/**
 * Create new Policy System instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {PolicySystem}
 */
export function createPolicySystem({ workspaceId, title = 'Company Policies' }) {
  const now = new Date().toISOString();
  return {
    id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'policy',
    workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: POLICY_MODEL_VERSION,
      title,
      description: '',
      effectiveDate: '',
      jurisdiction: '',
      policies: [{
        id: `policy-section-${Date.now()}`,
        title: '',
        content: '',
        category: '',
        lastUpdated: now
      }]
    },
    publishedContent: null
  };
}

/**
 * Validate Policy System object
 * @param {Object} system
 * @returns {boolean}
 */
export function validatePolicySystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'policy' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validatePolicyContent(system.draftContent) &&
    (system.publishedContent === null || validatePolicyContent(system.publishedContent))
  );
}

/**
 * Validate Policy Content structure
 * @param {Object} content
 * @returns {boolean}
 */
export function validatePolicyContent(content) {
  return (
    content &&
    content.version === POLICY_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    (content.effectiveDate === '' || typeof content.effectiveDate === 'string') &&
    typeof content.jurisdiction === 'string' &&
    Array.isArray(content.policies) &&
    content.policies.every(policy =>
      typeof policy.id === 'string' &&
      typeof policy.title === 'string' &&
      typeof policy.content === 'string' &&
      typeof policy.category === 'string'
    )
  );
}

/**
 * Publish draft content to live portal
 * @param {PolicySystem} system
 * @returns {PolicySystem} Updated system with published content
 */
export function publishPolicySystem(system) {
  if (!validatePolicyContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)), // Deep copy
    updatedAt: new Date().toISOString()
  };
}