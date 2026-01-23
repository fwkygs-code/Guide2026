import { DocumentationSystem, createDocumentationSystem, validateDocumentationSystem, publishDocumentationSystem } from './model';

const DOCUMENTATION_DRAFT_KEY = 'documentation:draft';
const DOCUMENTATION_PUBLISHED_KEY = 'documentation:published';
let documentationCache: DocumentationSystem[] | null = null;

function loadFromStorage(): DocumentationSystem[] {
  if (documentationCache !== null) return documentationCache;
  try {
    const draftStored = localStorage.getItem(DOCUMENTATION_DRAFT_KEY);
    const publishedStored = localStorage.getItem(DOCUMENTATION_PUBLISHED_KEY);
    const draftSystems = draftStored ? JSON.parse(draftStored) : [];
    const publishedSystems = publishedStored ? JSON.parse(publishedStored) : [];
    const validDraftSystems = draftSystems.filter((system: DocumentationSystem) => validateDocumentationSystem(system));
    const validPublishedSystems = publishedSystems.filter((system: DocumentationSystem) => validateDocumentationSystem(system));
    documentationCache = [...validDraftSystems, ...validPublishedSystems];
    return documentationCache;
  } catch (error) {
    console.warn('Failed to load documentation systems from storage:', error);
    documentationCache = [];
    return documentationCache;
  }
}

function saveToStorage(systems: DocumentationSystem[]): void {
  try {
    const draftSystems = systems.filter(s => s.publishedContent === null);
    const publishedSystems = systems.filter(s => s.publishedContent !== null);
    localStorage.setItem(DOCUMENTATION_DRAFT_KEY, JSON.stringify(draftSystems));
    localStorage.setItem(DOCUMENTATION_PUBLISHED_KEY, JSON.stringify(publishedSystems));
    documentationCache = systems;
  } catch (error) {
    console.error('Failed to save documentation systems to storage:', error);
  }
}

export function getDocumentationSystems(workspaceId: string): DocumentationSystem[] {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

export function getDocumentationSystem(systemId: string): DocumentationSystem | null {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

export function createDocumentationSystemEntry(params: { workspaceId: string; title?: string }): DocumentationSystem {
  const system = createDocumentationSystem(params);
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

export function updateDocumentationSystem(systemId: string, updates: Partial<DocumentationSystem>): DocumentationSystem | null {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);
  if (index === -1) return null;
  const updatedSystem = { ...allSystems[index], ...updates, updatedAt: new Date().toISOString() };
  if (!validateDocumentationSystem(updatedSystem)) return null;
  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

export function publishDocumentationSystemEntry(systemId: string): DocumentationSystem | null {
  const system = getDocumentationSystem(systemId);
  if (!system) return null;
  const publishedSystem = publishDocumentationSystem(system);
  return updateDocumentationSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

export function deleteDocumentationSystem(systemId: string): boolean {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);
  if (filteredSystems.length === allSystems.length) return false;
  saveToStorage(filteredSystems);
  return true;
}

export function initializeWorkspaceDocumentationSystem(workspaceId: string): void {
  const existingSystems = getDocumentationSystems(workspaceId);
  if (existingSystems.length > 0) return;
  createDocumentationSystemEntry({ workspaceId, title: 'Product Documentation' });
}

export function getPublishedDocumentationSystems(workspaceId: string): DocumentationSystem[] {
  return getDocumentationSystems(workspaceId).filter(system => system.enabled && system.publishedContent !== null);
}