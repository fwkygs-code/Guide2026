/**
 * Knowledge System Registry
 *
 * Defines available knowledge system types and their configurations.
 * Isolated from all existing application logic.
 */

import { KNOWLEDGE_SYSTEM_TYPES } from '../models/KnowledgeSystem.js';

/**
 * Registry of available knowledge systems
 * Each system defines its display properties and behavior
 */
export const KNOWLEDGE_SYSTEM_REGISTRY = {
  [KNOWLEDGE_SYSTEM_TYPES.POLICY]: {
    type: KNOWLEDGE_SYSTEM_TYPES.POLICY,
    displayName: 'Policies',
    description: 'HR, security, legal, and compliance policies',
    icon: '📋',
    defaultTitle: 'Policies',
    portalPath: 'policies',
    supportsEditing: true,
    supportsPortal: true,
    contentSchema: {
      policies: [
        {
          id: 'string',
          title: 'string',
          content: 'string',
          category: 'string',
          lastUpdated: 'date'
        }
      ]
    }
  },

  [KNOWLEDGE_SYSTEM_TYPES.PROCEDURE]: {
    type: KNOWLEDGE_SYSTEM_TYPES.PROCEDURE,
    displayName: 'Procedures',
    description: 'SOPs and step-by-step procedures',
    icon: '📝',
    defaultTitle: 'Procedures',
    portalPath: 'procedures',
    supportsEditing: true,
    supportsPortal: true,
    contentSchema: {
      procedures: [
        {
          id: 'string',
          title: 'string',
          steps: [
            {
              id: 'string',
              title: 'string',
              description: 'string',
              order: 'number'
            }
          ],
          category: 'string',
          lastUpdated: 'date'
        }
      ]
    }
  },

  [KNOWLEDGE_SYSTEM_TYPES.DOCUMENTATION]: {
    type: KNOWLEDGE_SYSTEM_TYPES.DOCUMENTATION,
    displayName: 'Documentation',
    description: 'Product and technical documentation',
    icon: '📚',
    defaultTitle: 'Documentation',
    portalPath: 'documentation',
    supportsEditing: true,
    supportsPortal: true,
    contentSchema: {
      sections: [
        {
          id: 'string',
          title: 'string',
          content: 'string',
          subsections: [
            {
              id: 'string',
              title: 'string',
              content: 'string',
              order: 'number'
            }
          ],
          order: 'number'
        }
      ]
    }
  },

  [KNOWLEDGE_SYSTEM_TYPES.FAQ]: {
    type: KNOWLEDGE_SYSTEM_TYPES.FAQ,
    displayName: 'FAQs',
    description: 'Frequently asked questions and answers',
    icon: '❓',
    defaultTitle: 'FAQs',
    portalPath: 'faqs',
    supportsEditing: true,
    supportsPortal: true,
    contentSchema: {
      faqs: [
        {
          id: 'string',
          question: 'string',
          answer: 'string',
          category: 'string',
          tags: ['string']
        }
      ]
    }
  },

  [KNOWLEDGE_SYSTEM_TYPES.DECISION_TREE]: {
    type: KNOWLEDGE_SYSTEM_TYPES.DECISION_TREE,
    displayName: 'Decision Trees',
    description: 'Interactive decision-making guides',
    icon: '🌳',
    defaultTitle: 'Decision Trees',
    portalPath: 'decisions',
    supportsEditing: true,
    supportsPortal: true,
    contentSchema: {
      trees: [
        {
          id: 'string',
          title: 'string',
          rootNode: {
            id: 'string',
            question: 'string',
            answers: [
              {
                id: 'string',
                text: 'string',
                nextNodeId: 'string'
              }
            ]
          },
          nodes: [
            {
              id: 'string',
              question: 'string',
              answers: [
                {
                  id: 'string',
                  text: 'string',
                  nextNodeId: 'string'
                }
              ]
            }
          ]
        }
      ]
    }
  }
};

/**
 * Get registry entry for a knowledge system type
 * @param {string} type
 * @returns {Object|null}
 */
export function getKnowledgeSystemConfig(type) {
  return KNOWLEDGE_SYSTEM_REGISTRY[type] || null;
}

/**
 * Get all available knowledge system types
 * @returns {Array}
 */
export function getAvailableKnowledgeSystemTypes() {
  return Object.values(KNOWLEDGE_SYSTEM_REGISTRY);
}

/**
 * Check if a knowledge system type is valid
 * @param {string} type
 * @returns {boolean}
 */
export function isValidKnowledgeSystemType(type) {
  return type in KNOWLEDGE_SYSTEM_REGISTRY;
}