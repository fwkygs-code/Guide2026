/**
 * Decision Tree Service - Isolated Persistence Layer
 *
 * No shared abstractions. Decision Trees own their complete persistence.
 */

import { createDecisionTreeSystem, validateDecisionTreeSystem, publishDecisionTreeSystem, isTerminalNode, NODE_TYPES } from './DecisionTreeModel.js';

// Storage key for decision tree systems
const DECISION_TREE_STORAGE_KEY = 'decision-tree-systems';

// In-memory cache
let decisionTreeCache = null;

/**
 * Load decision tree systems from storage
 * @returns {Array} Array of DecisionTreeSystem objects
 */
function loadFromStorage() {
  if (decisionTreeCache !== null) {
    return decisionTreeCache;
  }

  try {
    const stored = localStorage.getItem(DECISION_TREE_STORAGE_KEY);
    if (!stored) {
      decisionTreeCache = [];
      saveToStorage(decisionTreeCache);
      return decisionTreeCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid decision tree systems data in storage');
      decisionTreeCache = [];
      return decisionTreeCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validateDecisionTreeSystem(system)) {
        console.warn('Invalid decision tree system found:', system);
        return false;
      }
      return true;
    });

    decisionTreeCache = validSystems;
    return decisionTreeCache;
  } catch (error) {
    console.warn('Failed to load decision tree systems from storage:', error);
    decisionTreeCache = [];
    return decisionTreeCache;
  }
}

/**
 * Save decision tree systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(DECISION_TREE_STORAGE_KEY, JSON.stringify(systems));
    decisionTreeCache = systems;
  } catch (error) {
    console.error('Failed to save decision tree systems to storage:', error);
  }
}

/**
 * Get all decision tree systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of DecisionTreeSystem objects
 */
export function getDecisionTreeSystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific decision tree system
 * @param {string} systemId
 * @returns {Object|null} DecisionTreeSystem object or null
 */
export function getDecisionTreeSystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new decision tree system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {Object} Created DecisionTreeSystem
 */
export function createDecisionTreeSystemEntry({ workspaceId, title }) {
  const system = createDecisionTreeSystem({ workspaceId, title });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a decision tree system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated DecisionTreeSystem or null if not found
 */
export function updateDecisionTreeSystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Decision tree system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validateDecisionTreeSystem(updatedSystem)) {
    console.warn('Invalid decision tree system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Publish a decision tree system's draft content
 * @param {string} systemId
 * @returns {Object|null} Updated DecisionTreeSystem or null if not found
 */
export function publishDecisionTreeSystemEntry(systemId) {
  const system = getDecisionTreeSystem(systemId);
  if (!system) {
    console.warn('Decision tree system not found for publishing:', systemId);
    return null;
  }

  const publishedSystem = publishDecisionTreeSystem(system);
  return updateDecisionTreeSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

/**
 * Delete a decision tree system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteDecisionTreeSystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Decision tree system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default decision tree system for a workspace
 * @param {string} workspaceId
 */
export function initializeWorkspaceDecisionTreeSystem(workspaceId) {
  const existingSystems = getDecisionTreeSystems(workspaceId);

  // Don't initialize if system already exists
  if (existingSystems.length > 0) {
    return;
  }

  // Create default disabled decision tree system
  createDecisionTreeSystemEntry({
    workspaceId,
    title: 'Decision Support System'
  });
}

/**
 * Get published decision tree systems for portal display
 * @param {string} workspaceId
 * @returns {Array} Array of enabled DecisionTreeSystem objects with published content
 */
export function getPublishedDecisionTreeSystems(workspaceId) {
  return getDecisionTreeSystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}