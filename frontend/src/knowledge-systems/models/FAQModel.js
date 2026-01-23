/**
 * FAQ Model - Isolated Help Content
 *
 * No shared abstractions. FAQs own their complete data model.
 */

// FAQ Data Model
export const FAQ_MODEL_VERSION = '1.0.0';

// FAQ System Types
export const FAQ_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// FAQ Content Schema
export const FAQ_CONTENT_SCHEMA = {
  version: FAQ_MODEL_VERSION,
  title: 'string',
  description: 'string',
  faqs: [{
    id: 'string',
    question: 'string',
    answer: 'richtext',
    category: 'string',
    tags: ['string']
  }]
};

/**
 * FAQ System Instance
 * @typedef {Object} FAQSystem
 * @property {string} id - Unique system identifier
 * @property {string} type - Always 'faq'
 * @property {string} workspaceId - Associated workspace
 * @property {boolean} enabled - Portal visibility flag
 * @property {Date|string} createdAt - Creation timestamp
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {Object} draftContent - Working content
 * @property {Object} publishedContent - Live portal content
 */

/**
 * Create new FAQ System instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {FAQSystem}
 */
export function createFAQSystem({ workspaceId, title = 'Frequently Asked Questions' }) {
  const now = new Date().toISOString();
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'faq',
    workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: FAQ_MODEL_VERSION,
      title,
      description: '',
      faqs: []
    },
    publishedContent: null
  };
}

/**
 * Validate FAQ System object
 * @param {Object} system
 * @returns {boolean}
 */
export function validateFAQSystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'faq' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateFAQContent(system.draftContent) &&
    (system.publishedContent === null || validateFAQContent(system.publishedContent))
  );
}

/**
 * Validate FAQ Content structure
 * @param {Object} content
 * @returns {boolean}
 */
export function validateFAQContent(content) {
  return (
    content &&
    content.version === FAQ_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.faqs) &&
    content.faqs.every(faq =>
      typeof faq.id === 'string' &&
      typeof faq.question === 'string' &&
      typeof faq.answer === 'string' &&
      typeof faq.category === 'string' &&
      Array.isArray(faq.tags) &&
      faq.tags.every(tag => typeof tag === 'string')
    )
  );
}

/**
 * Publish draft content to live portal
 * @param {FAQSystem} system
 * @returns {FAQSystem} Updated system with published content
 */
export function publishFAQSystem(system) {
  if (!validateFAQContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)), // Deep copy
    updatedAt: new Date().toISOString()
  };
}