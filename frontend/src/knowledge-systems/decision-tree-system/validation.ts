// Decision Tree Validation - Hard Rules Enforcement
// No shared abstractions, no imports from other systems

import { DecisionTree, DecisionNode, NODE_TYPES } from './model';

export function validateDecisionTreeStructure(tree: DecisionTree): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: Root node must exist and be a question
  if (!tree.rootNode) {
    errors.push('Decision tree must have a root node');
  } else {
    if (tree.rootNode.type !== NODE_TYPES.QUESTION) {
      errors.push('Root node must be a question type');
    }
    if (!tree.rootNode.question || tree.rootNode.question.trim() === '') {
      errors.push('Root node must have a question');
    }
    if (tree.rootNode.answers.length === 0) {
      errors.push('Root node must have at least one answer');
    }
  }

  // Rule 2: All question nodes must have ≥1 answer
  const validateNode = (node: DecisionNode, nodeId: string): void => {
    if (node.type === NODE_TYPES.QUESTION) {
      if (node.answers.length === 0) {
        errors.push(`Question node "${node.question}" must have at least one answer`);
      }

      // Check for cycles and valid references
      for (const answer of node.answers) {
        if (answer.nextNodeId) {
          const nextNode = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === answer.nextNodeId);
          if (!nextNode) {
            errors.push(`Answer "${answer.text}" references non-existent node "${answer.nextNodeId}"`);
          }
        }
      }
    } else if (node.type === NODE_TYPES.OUTCOME) {
      // Rule 3: Outcome nodes must have 0 answers
      if (node.answers.length > 0) {
        errors.push(`Outcome node "${node.question}" cannot have answers`);
      }
    }
  };

  // Validate root node
  if (tree.rootNode) {
    validateNode(tree.rootNode, 'root');
  }

  // Validate all other nodes
  for (const node of tree.nodes) {
    validateNode(node, node.id);
  }

  // Rule 4: Detect cycles
  const cycleErrors = detectCycles(tree);
  errors.push(...cycleErrors);

  return {
    isValid: errors.length === 0,
    errors
  };
}

function detectCycles(tree: DecisionTree): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);
    if (node && node.type === NODE_TYPES.QUESTION) {
      for (const answer of node.answers) {
        if (answer.nextNodeId && hasCycle(answer.nextNodeId)) {
          errors.push(`Cycle detected involving node "${nodeId}"`);
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  hasCycle('root');
  return errors;
}

export function enforceNodeTypeRules(node: DecisionNode): DecisionNode {
  if (node.type === NODE_TYPES.OUTCOME) {
    // Force outcome nodes to have no answers
    return {
      ...node,
      answers: []
    };
  }

  // Question nodes must have at least one answer if they have any
  if (node.type === NODE_TYPES.QUESTION && node.answers.length === 0) {
    return {
      ...node,
      answers: [{
        id: `answer-${Date.now()}`,
        text: 'Continue',
        nextNodeId: null
      }]
    };
  }

  return node;
}

export function validateDecisionTraversal(tree: DecisionTree, path: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const node = nodeId === 'root' ? tree.rootNode : tree.nodes.find(n => n.id === nodeId);

    if (!node) {
      errors.push(`Node "${nodeId}" not found in decision tree`);
      continue;
    }

    if (node.type === NODE_TYPES.OUTCOME) {
      if (i < path.length - 1) {
        errors.push(`Cannot traverse beyond outcome node "${nodeId}"`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}