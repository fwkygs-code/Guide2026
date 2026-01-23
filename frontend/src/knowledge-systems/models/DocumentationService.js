/**
 * Documentation Service - Isolated Persistence Layer
 *
 * No shared abstractions. Documentation owns their complete persistence.
 */

import { createDocumentationSystem, validateDocumentationSystem, publishDocumentationSystem } from './DocumentationModel.js';

// Storage key for documentation systems
const DOCUMENTATION_STORAGE_KEY = 'documentation-systems';

// In-memory cache
let documentationCache = null;

/**
 * Load documentation systems from storage
 * @returns {Array} Array of DocumentationSystem objects
 */
function loadFromStorage() {
  if (documentationCache !== null) {
    return documentationCache;
  }

  try {
    const stored = localStorage.getItem(DOCUMENTATION_STORAGE_KEY);
    if (!stored) {
      documentationCache = [];
      saveToStorage(documentationCache);
      return documentationCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid documentation systems data in storage');
      documentationCache = [];
      return documentationCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validateDocumentationSystem(system)) {
        console.warn('Invalid documentation system found:', system);
        return false;
      }
      return true;
    });

    documentationCache = validSystems;
    return documentationCache;
  } catch (error) {
    console.warn('Failed to load documentation systems from storage:', error);
    documentationCache = [];
    return documentationCache;
  }
}

/**
 * Save documentation systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(DOCUMENTATION_STORAGE_KEY, JSON.stringify(systems));
    documentationCache = systems;
  } catch (error) {
    console.error('Failed to save documentation systems to storage:', error);
  }
}

/**
 * Get all documentation systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of DocumentationSystem objects
 */
export function getDocumentationSystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific documentation system
 * @param {string} systemId
 * @returns {Object|null} DocumentationSystem object or null
 */
export function getDocumentationSystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new documentation system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {Object} Created DocumentationSystem
 */
export function createDocumentationSystemEntry({ workspaceId, title }) {
  const system = createDocumentationSystem({ workspaceId, title });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a documentation system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated DocumentationSystem or null if not found
 */
export function updateDocumentationSystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Documentation system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validateDocumentationSystem(updatedSystem)) {
    console.warn('Invalid documentation system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Publish a documentation system's draft content
 * @param {string} systemId
 * @returns {Object|null} Updated DocumentationSystem or null if not found
 */
export function publishDocumentationSystemEntry(systemId) {
  const system = getDocumentationSystem(systemId);
  if (!system) {
    console.warn('Documentation system not found for publishing:', systemId);
    return null;
  }

  const publishedSystem = publishDocumentationSystem(system);
  return updateDocumentationSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

/**
 * Delete a documentation system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteDocumentationSystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Documentation system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default documentation system for a workspace
 * @param {string} workspaceId
 */
export function initializeWorkspaceDocumentationSystem(workspaceId) {
  const existingSystems = getDocumentationSystems(workspaceId);

  // Don't initialize if system already exists
  if (existingSystems.length > 0) {
    return;
  }

  // Create default disabled documentation system
  createDocumentationSystemEntry({
    workspaceId,
    title: 'Product Documentation'
  });
}

/**
 * Get published documentation systems for portal display
 * @param {string} workspaceId
 * @returns {Array} Array of enabled DocumentationSystem objects with published content
 */
export function getPublishedDocumentationSystems(workspaceId) {
  return getDocumentationSystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}