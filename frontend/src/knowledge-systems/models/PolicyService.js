/**
 * Policy Service - Isolated Persistence Layer
 *
 * No shared abstractions. Policies own their complete persistence.
 */

import { createPolicySystem, validatePolicySystem, publishPolicySystem } from './PolicyModel.js';

// Storage key for policy systems
const POLICY_STORAGE_KEY = 'policy-systems';

// In-memory cache
let policyCache = null;

/**
 * Load policy systems from storage
 * @returns {Array} Array of PolicySystem objects
 */
function loadFromStorage() {
  if (policyCache !== null) {
    return policyCache;
  }

  try {
    const stored = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!stored) {
      policyCache = [];
      saveToStorage(policyCache);
      return policyCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid policy systems data in storage');
      policyCache = [];
      return policyCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validatePolicySystem(system)) {
        console.warn('Invalid policy system found:', system);
        return false;
      }
      return true;
    });

    policyCache = validSystems;
    return policyCache;
  } catch (error) {
    console.warn('Failed to load policy systems from storage:', error);
    policyCache = [];
    return policyCache;
  }
}

/**
 * Save policy systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(systems));
    policyCache = systems;
  } catch (error) {
    console.error('Failed to save policy systems to storage:', error);
  }
}

/**
 * Get all policy systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of PolicySystem objects
 */
export function getPolicySystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific policy system
 * @param {string} systemId
 * @returns {Object|null} PolicySystem object or null
 */
export function getPolicySystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new policy system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {Object} Created PolicySystem
 */
export function createPolicySystemEntry({ workspaceId, title }) {
  const system = createPolicySystem({ workspaceId, title });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a policy system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated PolicySystem or null if not found
 */
export function updatePolicySystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Policy system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validatePolicySystem(updatedSystem)) {
    console.warn('Invalid policy system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Publish a policy system's draft content
 * @param {string} systemId
 * @returns {Object|null} Updated PolicySystem or null if not found
 */
export function publishPolicySystemEntry(systemId) {
  const system = getPolicySystem(systemId);
  if (!system) {
    console.warn('Policy system not found for publishing:', systemId);
    return null;
  }

  const publishedSystem = publishPolicySystem(system);
  return updatePolicySystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

/**
 * Delete a policy system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deletePolicySystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Policy system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default policy system for a workspace
 * @param {string} workspaceId
 */
export function initializeWorkspacePolicySystem(workspaceId) {
  const existingSystems = getPolicySystems(workspaceId);

  // Don't initialize if system already exists
  if (existingSystems.length > 0) {
    return;
  }

  // Create default disabled policy system
  createPolicySystemEntry({
    workspaceId,
    title: 'Company Policies'
  });
}

/**
 * Get published policy systems for portal display
 * @param {string} workspaceId
 * @returns {Array} Array of enabled PolicySystem objects with published content
 */
export function getPublishedPolicySystems(workspaceId) {
  return getPolicySystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}