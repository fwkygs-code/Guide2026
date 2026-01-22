/**
 * Knowledge System Service - Mock Persistence
 *
 * Isolated mock service for managing knowledge systems.
 * Uses localStorage for persistence (acceptable for this implementation).
 */

import { createKnowledgeSystem, validateKnowledgeSystem, KNOWLEDGE_SYSTEM_TYPES } from './KnowledgeSystem.js';

// Storage key for localStorage
const STORAGE_KEY = 'knowledge-systems';

// In-memory cache for current session
let memoryCache = null;

/**
 * Load knowledge systems from storage
 * @returns {Array} Array of KnowledgeSystem objects
 */
function loadFromStorage() {
  if (memoryCache !== null) {
    return memoryCache;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialize with empty array if nothing stored
      memoryCache = [];
      saveToStorage(memoryCache);
      return memoryCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid knowledge systems data in storage');
      memoryCache = [];
      return memoryCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validateKnowledgeSystem(system)) {
        console.warn('Invalid knowledge system found:', system);
        return false;
      }
      return true;
    });

    memoryCache = validSystems;
    return memoryCache;
  } catch (error) {
    console.warn('Failed to load knowledge systems from storage:', error);
    memoryCache = [];
    return memoryCache;
  }
}

/**
 * Save knowledge systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(systems));
    memoryCache = systems;
  } catch (error) {
    console.error('Failed to save knowledge systems to storage:', error);
  }
}

/**
 * Get all knowledge systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of KnowledgeSystem objects
 */
export function getKnowledgeSystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific knowledge system
 * @param {string} systemId
 * @returns {Object|null} KnowledgeSystem object or null
 */
export function getKnowledgeSystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new knowledge system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.description
 * @returns {Object} Created KnowledgeSystem
 */
export function createKnowledgeSystemEntry({ workspaceId, type, title, description }) {
  const system = createKnowledgeSystem({ workspaceId, type, title, description });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a knowledge system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated KnowledgeSystem or null if not found
 */
export function updateKnowledgeSystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Knowledge system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validateKnowledgeSystem(updatedSystem)) {
    console.warn('Invalid knowledge system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Delete a knowledge system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteKnowledgeSystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Knowledge system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default knowledge systems for a workspace
 * Creates one disabled system of each type
 * @param {string} workspaceId
 */
export function initializeWorkspaceKnowledgeSystems(workspaceId) {
  const existingSystems = getKnowledgeSystems(workspaceId);

  // Don't initialize if systems already exist
  if (existingSystems.length > 0) {
    return;
  }

  // Create one of each type (all disabled by default)
  Object.values(KNOWLEDGE_SYSTEM_TYPES).forEach(type => {
    createKnowledgeSystemEntry({
      workspaceId,
      type,
      title: null, // Will use default title
      description: ''
    });
  });
}

/**
 * Get enabled knowledge systems for a workspace (for portal display)
 * @param {string} workspaceId
 * @returns {Array} Array of enabled KnowledgeSystem objects
 */
export function getEnabledKnowledgeSystems(workspaceId) {
  return getKnowledgeSystems(workspaceId).filter(system =>
    system.enabled && system.visibility === 'portal'
  );
}