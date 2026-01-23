/**
 * FAQ Service - Isolated Persistence Layer
 *
 * No shared abstractions. FAQs own their complete persistence.
 */

import { createFAQSystem, validateFAQSystem, publishFAQSystem } from './FAQModel.js';

// Storage key for FAQ systems
const FAQ_STORAGE_KEY = 'faq-systems';

// In-memory cache
let faqCache = null;

/**
 * Load FAQ systems from storage
 * @returns {Array} Array of FAQSystem objects
 */
function loadFromStorage() {
  if (faqCache !== null) {
    return faqCache;
  }

  try {
    const stored = localStorage.getItem(FAQ_STORAGE_KEY);
    if (!stored) {
      faqCache = [];
      saveToStorage(faqCache);
      return faqCache;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid FAQ systems data in storage');
      faqCache = [];
      return faqCache;
    }

    // Validate each system
    const validSystems = parsed.filter(system => {
      if (!validateFAQSystem(system)) {
        console.warn('Invalid FAQ system found:', system);
        return false;
      }
      return true;
    });

    faqCache = validSystems;
    return faqCache;
  } catch (error) {
    console.warn('Failed to load FAQ systems from storage:', error);
    faqCache = [];
    return faqCache;
  }
}

/**
 * Save FAQ systems to storage
 * @param {Array} systems
 */
function saveToStorage(systems) {
  try {
    localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(systems));
    faqCache = systems;
  } catch (error) {
    console.error('Failed to save FAQ systems to storage:', error);
  }
}

/**
 * Get all FAQ systems for a workspace
 * @param {string} workspaceId
 * @returns {Array} Array of FAQSystem objects
 */
export function getFAQSystems(workspaceId) {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

/**
 * Get a specific FAQ system
 * @param {string} systemId
 * @returns {Object|null} FAQSystem object or null
 */
export function getFAQSystem(systemId) {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

/**
 * Create a new FAQ system
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title - Optional initial title
 * @returns {Object} Created FAQSystem
 */
export function createFAQSystemEntry({ workspaceId, title }) {
  const system = createFAQSystem({ workspaceId, title });
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

/**
 * Update a FAQ system
 * @param {string} systemId
 * @param {Object} updates
 * @returns {Object|null} Updated FAQSystem or null if not found
 */
export function updateFAQSystem(systemId, updates) {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('FAQ system not found:', systemId);
    return null;
  }

  // Update the system
  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Validate the update
  if (!validateFAQSystem(updatedSystem)) {
    console.warn('Invalid FAQ system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

/**
 * Publish a FAQ system's draft content
 * @param {string} systemId
 * @returns {Object|null} Updated FAQSystem or null if not found
 */
export function publishFAQSystemEntry(systemId) {
  const system = getFAQSystem(systemId);
  if (!system) {
    console.warn('FAQ system not found for publishing:', systemId);
    return null;
  }

  const publishedSystem = publishFAQSystem(system);
  return updateFAQSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

/**
 * Delete a FAQ system
 * @param {string} systemId
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteFAQSystem(systemId) {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('FAQ system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

/**
 * Initialize default FAQ system for a workspace
 * @param {string} workspaceId
 */
export function initializeWorkspaceFAQSystem(workspaceId) {
  const existingSystems = getFAQSystems(workspaceId);

  // Don't initialize if system already exists
  if (existingSystems.length > 0) {
    return;
  }

  // Create default disabled FAQ system
  createFAQSystemEntry({
    workspaceId,
    title: 'Frequently Asked Questions'
  });
}

/**
 * Get published FAQ systems for portal display
 * @param {string} workspaceId
 * @returns {Array} Array of enabled FAQSystem objects with published content
 */
export function getPublishedFAQSystems(workspaceId) {
  return getFAQSystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}