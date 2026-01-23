export const DECISION_TREE_MODEL_VERSION = '1.0.0';
export const DECISION_TREE_TYPES = { DRAFT: 'draft', PUBLISHED: 'published' };
export const NODE_TYPES = { QUESTION: 'question', OUTCOME: 'outcome' };

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

export interface DecisionTreeSystem {
  id: string;
  type: 'decision_tree';
  workspaceId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  draftContent: DecisionTreeContent;
  publishedContent: DecisionTreeContent | null;
}

export interface DecisionTreeContent {
  version: string;
  title: string;
  description: string;
  trees: DecisionTree[];
}

export interface DecisionTree {
  id: string;
  title: string;
  rootNode: DecisionNode;
  nodes: DecisionNode[];
}

export interface DecisionNode {
  id: string;
  type: 'question' | 'outcome';
  question: string;
  content: string;
  answers: DecisionAnswer[];
}

export interface DecisionAnswer {
  id: string;
  text: string;
  nextNodeId: string | null;
}

export function createDecisionTreeSystem(params: { workspaceId: string; title?: string }): DecisionTreeSystem {
  const now = new Date().toISOString();
  return {
    id: `decision-tree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'decision_tree',
    workspaceId: params.workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: DECISION_TREE_MODEL_VERSION,
      title: params.title || 'Decision Support System',
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

export function validateDecisionTreeSystem(system: DecisionTreeSystem): boolean {
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

export function validateDecisionTreeContent(content: DecisionTreeContent): boolean {
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

function validateNode(node: DecisionNode): boolean {
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

export function isTerminalNode(node: DecisionNode): boolean {
  return node.type === NODE_TYPES.OUTCOME ||
         node.answers.length === 0 ||
         node.answers.every(answer => answer.nextNodeId === null);
}

export function detectCycles(tree: DecisionTree): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);
    if (node && node.type === NODE_TYPES.QUESTION) {
      for (const answer of node.answers) {
        if (answer.nextNodeId && hasCycle(answer.nextNodeId)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  return hasCycle('root');
}

export function publishDecisionTreeSystem(system: DecisionTreeSystem): DecisionTreeSystem {
  if (!validateDecisionTreeContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  // Check for cycles in all trees
  for (const tree of system.draftContent.trees) {
    if (detectCycles(tree)) {
      throw new Error(`Decision tree "${tree.title}" contains cycles and cannot be published`);
    }
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)),
    updatedAt: new Date().toISOString()
  };
}