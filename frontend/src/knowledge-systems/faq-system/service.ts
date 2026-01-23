import { FAQSystem, createFAQSystem, validateFAQSystem, publishFAQSystem } from './model';

const FAQ_DRAFT_KEY = 'faq:draft';
const FAQ_PUBLISHED_KEY = 'faq:published';
let faqCache: FAQSystem[] | null = null;

function loadFromStorage(): FAQSystem[] {
  if (faqCache !== null) return faqCache;
  try {
    const draftStored = localStorage.getItem(FAQ_DRAFT_KEY);
    const publishedStored = localStorage.getItem(FAQ_PUBLISHED_KEY);
    const draftSystems = draftStored ? JSON.parse(draftStored) : [];
    const publishedSystems = publishedStored ? JSON.parse(publishedStored) : [];
    const validDraftSystems = draftSystems.filter((system: FAQSystem) => validateFAQSystem(system));
    const validPublishedSystems = publishedSystems.filter((system: FAQSystem) => validateFAQSystem(system));
    faqCache = [...validDraftSystems, ...validPublishedSystems];
    return faqCache;
  } catch (error) {
    console.warn('Failed to load FAQ systems from storage:', error);
    faqCache = [];
    return faqCache;
  }
}

function saveToStorage(systems: FAQSystem[]): void {
  try {
    const draftSystems = systems.filter(s => s.publishedContent === null);
    const publishedSystems = systems.filter(s => s.publishedContent !== null);
    localStorage.setItem(FAQ_DRAFT_KEY, JSON.stringify(draftSystems));
    localStorage.setItem(FAQ_PUBLISHED_KEY, JSON.stringify(publishedSystems));
    faqCache = systems;
  } catch (error) {
    console.error('Failed to save FAQ systems to storage:', error);
  }
}

export function getFAQSystems(workspaceId: string): FAQSystem[] {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

export function getFAQSystem(systemId: string): FAQSystem | null {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

export function createFAQSystemEntry(params: { workspaceId: string; title?: string }): FAQSystem {
  const system = createFAQSystem(params);
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

export function updateFAQSystem(systemId: string, updates: Partial<FAQSystem>): FAQSystem | null {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);
  if (index === -1) return null;
  const updatedSystem = { ...allSystems[index], ...updates, updatedAt: new Date().toISOString() };
  if (!validateFAQSystem(updatedSystem)) return null;
  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

export function publishFAQSystemEntry(systemId: string): FAQSystem | null {
  const system = getFAQSystem(systemId);
  if (!system) return null;
  const publishedSystem = publishFAQSystem(system);
  return updateFAQSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

export function deleteFAQSystem(systemId: string): boolean {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);
  if (filteredSystems.length === allSystems.length) return false;
  saveToStorage(filteredSystems);
  return true;
}

export function initializeWorkspaceFAQSystem(workspaceId: string): void {
  const existingSystems = getFAQSystems(workspaceId);
  if (existingSystems.length > 0) return;
  createFAQSystemEntry({ workspaceId, title: 'Frequently Asked Questions' });
}

export function getPublishedFAQSystems(workspaceId: string): FAQSystem[] {
  return getFAQSystems(workspaceId).filter(system => system.enabled && system.publishedContent !== null);
}