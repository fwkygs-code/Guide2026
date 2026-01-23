// Policy Service - Isolated ID-Addressable Persistence
// No shared abstractions, no array filtering

import { PolicySystem, createPolicySystem, validatePolicySystem, publishPolicySystem } from './model';

/**
 * Load draft policy system by ID
 * @param {string} systemId
 * @returns {PolicySystem|null}
 */
export function loadDraft(systemId: string): PolicySystem | null {
  try {
    const key = `policy:draft:${systemId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const system = JSON.parse(stored);
    return validatePolicySystem(system) ? system : null;
  } catch (error) {
    console.warn('Failed to load policy draft:', error);
    return null;
  }
}

/**
 * Save draft policy system by ID
 * @param {string} systemId
 * @param {PolicySystem} system
 */
export function saveDraft(systemId: string, system: PolicySystem): void {
  try {
    const key = `policy:draft:${systemId}`;
    localStorage.setItem(key, JSON.stringify(system));
  } catch (error) {
    console.error('Failed to save policy draft:', error);
  }
}

/**
 * Load published policy system by ID
 * @param {string} systemId
 * @returns {PolicySystem|null}
 */
export function loadPublished(systemId: string): PolicySystem | null {
  try {
    const key = `policy:published:${systemId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const system = JSON.parse(stored);
    if (!validatePolicySystem(system)) {
      throw new Error('Invalid published policy system data');
    }
    return system;
  } catch (error) {
    console.warn('Failed to load published policy:', error);
    return null;
  }
}

/**
 * Publish draft to published
 * @param {string} systemId
 */
export function publish(systemId: string): PolicySystem | null {
  const draft = loadDraft(systemId);
  if (!draft) {
    console.warn('No draft found to publish');
    return null;
  }

  const publishedSystem = publishPolicySystem(draft);

  try {
    const key = `policy:published:${systemId}`;
    localStorage.setItem(key, JSON.stringify(publishedSystem));
    return publishedSystem;
  } catch (error) {
    console.error('Failed to publish policy:', error);
    return null;
  }
}

/**
 * Create new policy system
 * @param {Object} params
 * @returns {PolicySystem}
 */
export function createPolicySystemEntry(params: { workspaceId: string; title?: string }): PolicySystem {
  const system = createPolicySystem(params);
  saveDraft(system.id, system);
  return system;
}

/**
 * Update draft policy system
 * @param {string} systemId
 * @param {Partial<PolicySystem>} updates
 * @returns {PolicySystem|null}
 */
export function updateDraft(systemId: string, updates: Partial<PolicySystem>): PolicySystem | null {
  const current = loadDraft(systemId);
  if (!current) return null;

  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (!validatePolicySystem(updated)) {
    console.warn('Invalid policy system update');
    return null;
  }

  saveDraft(systemId, updated);
  return updated;
}

/**
 * Check if system exists (draft or published)
 * @param {string} systemId
 * @returns {boolean}
 */
export function systemExists(systemId: string): boolean {
  return loadDraft(systemId) !== null || loadPublished(systemId) !== null;
}