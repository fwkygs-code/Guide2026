/**
 * Decision Tree Model - Isolated Interactive Content
 *
 * No shared abstractions. Decision Trees own their complete data model.
 */

// Decision Tree Data Model
export const DECISION_TREE_MODEL_VERSION = '1.0.0';

// Decision Tree System Types
export const DECISION_TREE_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// Node Types
export const NODE_TYPES = {
  QUESTION: 'question',
  OUTCOME: 'outcome'
};

// Decision Tree Content Schema
export const DECISION_TREE_CONTENT_SCHEMA = {
  version: DECISION_TREE_MODEL_VERSION,
  title: 'string',
  description: 'string',
  trees: [{
    id: 'string',
    title: 'string',
    rootNode: {
      id: 'string',
      type: 'question|outcome',
      question: 'string',
      content: 'richtext',
      answers: [{
        id: 'string',
        text: 'string',
        nextNodeId: 'string'
      }]
    },
    nodes: [{
      id: 'string',
      type: 'question|outcome',
      question: 'string',
      content: 'richtext',
      answers: [{
        id: 'string',
        text: 'string',
        nextNodeId: 'string'
      }]
    }]
  }]
};

/**
 * Decision Tree System Instance
 * @typedef {Object} DecisionTreeSystem
 * @property {string} id - Unique system identifier
 * @property {string} type - Always 'decision_tree'
 * @property {string} workspaceId - Associated workspace
 * @property {boolean} enabled - Portal visibility flag
 * @property {Date|string} createdAt - Creation timestamp
 * @property {Date|string} updatedAt - Last update timestamp
 * @property {Object} draftContent - Working content
 * @property {Object} publishedContent - Live portal content
 */

/**
 * Create new Decision Tree System instance
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {DecisionTreeSystem}
 */
export function createDecisionTreeSystem({ workspaceId, title = 'Decision Support System' }) {
  const now = new Date().toISOString();
  return {
    id: `decision-tree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'decision_tree',
    workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: DECISION_TREE_MODEL_VERSION,
      title,
      description: '',
      trees: [{
        id: `tree-${Date.now()}`,
        title: 'Sample Decision Tree',
        rootNode: {
          id: 'root',
          type: NODE_TYPES.QUESTION,
          question: '',
          content: '',
          answers: []
        },
        nodes: []
      }]
    },
    publishedContent: null
  };
}

/**
 * Validate Decision Tree System object
 * @param {Object} system
 * @returns {boolean}
 */
export function validateDecisionTreeSystem(system) {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'decision_tree' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateDecisionTreeContent(system.draftContent) &&
    (system.publishedContent === null || validateDecisionTreeContent(system.publishedContent))
  );
}

/**
 * Validate Decision Tree Content structure
 * @param {Object} content
 * @returns {boolean}
 */
export function validateDecisionTreeContent(content) {
  return (
    content &&
    content.version === DECISION_TREE_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.trees) &&
    content.trees.every(tree =>
      typeof tree.id === 'string' &&
      typeof tree.title === 'string' &&
      tree.rootNode &&
      validateNode(tree.rootNode) &&
      Array.isArray(tree.nodes) &&
      tree.nodes.every(validateNode)
    )
  );
}

/**
 * Validate individual node structure
 * @param {Object} node
 * @returns {boolean}
 */
function validateNode(node) {
  return (
    node &&
    typeof node.id === 'string' &&
    Object.values(NODE_TYPES).includes(node.type) &&
    typeof node.question === 'string' &&
    typeof node.content === 'string' &&
    Array.isArray(node.answers) &&
    node.answers.every(answer =>
      typeof answer.id === 'string' &&
      typeof answer.text === 'string' &&
      (answer.nextNodeId === null || typeof answer.nextNodeId === 'string')
    )
  );
}

/**
 * Check if node is terminal (no further answers or all answers lead nowhere)
 * @param {Object} node
 * @returns {boolean}
 */
export function isTerminalNode(node) {
  return node.type === NODE_TYPES.OUTCOME ||
         node.answers.length === 0 ||
         node.answers.every(answer => answer.nextNodeId === null);
}

/**
 * Publish draft content to live portal
 * @param {DecisionTreeSystem} system
 * @returns {DecisionTreeSystem} Updated system with published content
 */
export function publishDecisionTreeSystem(system) {
  if (!validateDecisionTreeContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)), // Deep copy
    updatedAt: new Date().toISOString()
  };
}