/**
 * Procedure Service - Isolated Persistence Layer
 *
 * No shared abstractions. Procedures own their complete persistence.
 */

import { createProcedureSystem, validateProcedureSystem, publishProcedureSystem } from './ProcedureModel.js';

// Storage key for procedure systems
const PROCEDURE_STORAGE_KEY = 'procedure-systems';

// In-memory cache
let procedureCache = null;

/**
 * Load procedure systems from storage
 * @returns {Array} Array of ProcedureSystem objects
 */
function loadFromStorage() {
  if (procedureCache !== null) {
    return procedureCache;
  }

  try {
    const stored = localStorage.getItem(PROCEDURE_STORAGE_KEY);
    if (!stored) {
      procedureCache = [];
      saveToStorage(procedureCache);
      return procedureCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid procedure systems data in storage');
      procedureCache = [];
      return procedureCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validateProcedureSystem(system)) {
        console.warn('Invalid procedure system found:', system);
        return false;
      }
      return true;
    });

    procedureCache = validSystems;
    return procedureCache;
  } catch (error) {
    console.warn('Failed to load procedure systems from storage:', error);
    procedureCache = [];
    return procedureCache;
  }
}

/**
 * Save procedure systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(PROCEDURE_STORAGE_KEY, JSON.stringify(systems));
    procedureCache = systems;
  } catch (error) {
    console.error('Failed to save procedure systems to storage:', error);
  }
}

/**
 * Get all procedure systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of ProcedureSystem objects
 */
export function getProcedureSystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific procedure system
 * @param {string} systemId
 * @returns {Object|null} ProcedureSystem object or null
 */
export function getProcedureSystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new procedure system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {Object} Created ProcedureSystem
 */
export function createProcedureSystemEntry({ workspaceId, title }) {
  const system = createProcedureSystem({ workspaceId, title });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a procedure system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated ProcedureSystem or null if not found
 */
export function updateProcedureSystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Procedure system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validateProcedureSystem(updatedSystem)) {
    console.warn('Invalid procedure system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Publish a procedure system's draft content
 * @param {string} systemId
 * @returns {Object|null} Updated ProcedureSystem or null if not found
 */
export function publishProcedureSystemEntry(systemId) {
  const system = getProcedureSystem(systemId);
  if (!system) {
    console.warn('Procedure system not found for publishing:', systemId);
    return null;
  }

  const publishedSystem = publishProcedureSystem(system);
  return updateProcedureSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

/**
 * Delete a procedure system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteProcedureSystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Procedure system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default procedure system for a workspace
 * @param {string} workspaceId
 */
export function initializeWorkspaceProcedureSystem(workspaceId) {
  const existingSystems = getProcedureSystems(workspaceId);

  // Don't initialize if system already exists
  if (existingSystems.length > 0) {
    return;
  }

  // Create default disabled procedure system
  createProcedureSystemEntry({
    workspaceId,
    title: 'Standard Procedures'
  });
}

/**
 * Get published procedure systems for portal display
 * @param {string} workspaceId
 * @returns {Array} Array of enabled ProcedureSystem objects with published content
 */
export function getPublishedProcedureSystems(workspaceId) {
  return getProcedureSystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}