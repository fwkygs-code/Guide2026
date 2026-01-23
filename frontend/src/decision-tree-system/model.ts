export const DECISION_TREE_MODEL_VERSION = '2.0.0';

export type DecisionNodeType = 'question' | 'outcome';

export type DecisionAnswer = {
  id: string;
  text: string;
  nextNodeId: string;
};

export type DecisionNode = {
  id: string;
  type: DecisionNodeType;
  title: string;
  prompt: string;
  content: string;
  answers: DecisionAnswer[];
};

export type DecisionTreeDraft = {
  version: string;
  title: string;
  description: string;
  nodes: DecisionNode[];
  rootNodeId: string;
};

export type DecisionTreePublished = DecisionTreeDraft;

export type DecisionTreeMeta = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  publishedAt: string | null;
};

const createOutcomeNode = (title = 'Outcome'): DecisionNode => ({
  id: `decision-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'outcome',
  title,
  prompt: '',
  content: '',
  answers: []
});

const createQuestionNode = (title = 'Question', nextNodeId?: string): DecisionNode => ({
  id: `decision-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'question',
  title,
  prompt: '',
  content: '',
  answers: [
    {
      id: `decision-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: 'Answer option',
      nextNodeId: nextNodeId || ''
    }
  ]
});

export const createDecisionTreeDraft = (title = 'Decision Guidance'): DecisionTreeDraft => {
  const outcome = createOutcomeNode('Initial Outcome');
  const root = createQuestionNode('Start Here', outcome.id);
  return {
    version: DECISION_TREE_MODEL_VERSION,
    title,
    description: '',
    nodes: [root, outcome],
    rootNodeId: root.id
  };
};

export const createDecisionTreeMeta = (workspaceId: string, title: string): DecisionTreeMeta => {
  const now = new Date().toISOString();
  return {
    id: `decision-tree-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    title,
    publishedAt: null
  };
};

const getNodeMap = (nodes: DecisionNode[]) => {
  const map = new Map<string, DecisionNode>();
  nodes.forEach((node) => map.set(node.id, node));
  return map;
};

export const detectDecisionTreeCycles = (draft: DecisionTreeDraft): string[] => {
  const errors: string[] = [];
  const nodeMap = getNodeMap(draft.nodes);
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (nodeId: string) => {
    if (stack.has(nodeId)) {
      errors.push(`Cycle detected at node ${nodeId}`);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node && node.type === 'question') {
      node.answers.forEach((answer) => {
        if (answer.nextNodeId && nodeMap.has(answer.nextNodeId)) {
          visit(answer.nextNodeId);
        }
      });
    }

    stack.delete(nodeId);
  };

  if (draft.rootNodeId) {
    visit(draft.rootNodeId);
  }

  return errors;
};

export const getDecisionTreeErrors = (draft: DecisionTreeDraft): string[] => {
  const errors: string[] = [];
  if (!draft || draft.version !== DECISION_TREE_MODEL_VERSION) {
    errors.push('Invalid decision tree version.');
    return errors;
  }
  const nodeMap = getNodeMap(draft.nodes);
  const rootNode = nodeMap.get(draft.rootNodeId);
  if (!rootNode) {
    errors.push('Root node is missing.');
  } else if (rootNode.type !== 'question') {
    errors.push('Root node must be a question.');
  }

  draft.nodes.forEach((node) => {
    if (node.type === 'question') {
      if (!node.answers.length) {
        errors.push(`Question node "${node.title}" must have at least one answer.`);
      }
      node.answers.forEach((answer) => {
        if (!answer.nextNodeId) {
          errors.push(`Answer "${answer.text}" in "${node.title}" must point to another node.`);
        } else if (!nodeMap.has(answer.nextNodeId)) {
          errors.push(`Answer "${answer.text}" points to a missing node.`);
        }
      });
    } else if (node.type === 'outcome') {
      if (node.answers.length > 0) {
        errors.push(`Outcome node "${node.title}" cannot have answers.`);
      }
    }
  });

  errors.push(...detectDecisionTreeCycles(draft));
  return errors;
};

export const validateDecisionTreeDraft = (draft: DecisionTreeDraft): boolean => getDecisionTreeErrors(draft).length === 0;
