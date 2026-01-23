import { DecisionTreeSystem, createDecisionTreeSystem, validateDecisionTreeSystem, publishDecisionTreeSystem, NODE_TYPES } from './model';

const DECISION_TREE_DRAFT_KEY = 'decision-tree:draft';
const DECISION_TREE_PUBLISHED_KEY = 'decision-tree:published';
let decisionTreeCache: DecisionTreeSystem[] | null = null;

function loadFromStorage(): DecisionTreeSystem[] {
  if (decisionTreeCache !== null) return decisionTreeCache;
  try {
    const draftStored = localStorage.getItem(DECISION_TREE_DRAFT_KEY);
    const publishedStored = localStorage.getItem(DECISION_TREE_PUBLISHED_KEY);
    const draftSystems = draftStored ? JSON.parse(draftStored) : [];
    const publishedSystems = publishedStored ? JSON.parse(publishedStored) : [];
    const validDraftSystems = draftSystems.filter((system: DecisionTreeSystem) => validateDecisionTreeSystem(system));
    const validPublishedSystems = publishedSystems.filter((system: DecisionTreeSystem) => validateDecisionTreeSystem(system));
    decisionTreeCache = [...validDraftSystems, ...validPublishedSystems];
    return decisionTreeCache;
  } catch (error) {
    console.warn('Failed to load decision tree systems from storage:', error);
    decisionTreeCache = [];
    return decisionTreeCache;
  }
}

function saveToStorage(systems: DecisionTreeSystem[]): void {
  try {
    const draftSystems = systems.filter(s => s.publishedContent === null);
    const publishedSystems = systems.filter(s => s.publishedContent !== null);
    localStorage.setItem(DECISION_TREE_DRAFT_KEY, JSON.stringify(draftSystems));
    localStorage.setItem(DECISION_TREE_PUBLISHED_KEY, JSON.stringify(publishedSystems));
    decisionTreeCache = systems;
  } catch (error) {
    console.error('Failed to save decision tree systems to storage:', error);
  }
}

export function getDecisionTreeSystems(workspaceId: string): DecisionTreeSystem[] {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

export function getDecisionTreeSystem(systemId: string): DecisionTreeSystem | null {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

export function createDecisionTreeSystemEntry(params: { workspaceId: string; title?: string }): DecisionTreeSystem {
  const system = createDecisionTreeSystem(params);
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

export function updateDecisionTreeSystem(systemId: string, updates: Partial<DecisionTreeSystem>): DecisionTreeSystem | null {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);
  if (index === -1) return null;
  const updatedSystem = { ...allSystems[index], ...updates, updatedAt: new Date().toISOString() };
  if (!validateDecisionTreeSystem(updatedSystem)) return null;
  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

export function publishDecisionTreeSystemEntry(systemId: string): DecisionTreeSystem | null {
  const system = getDecisionTreeSystem(systemId);
  if (!system) return null;
  const publishedSystem = publishDecisionTreeSystem(system);
  return updateDecisionTreeSystem(systemId, {
    publishedContent: publishedSystem.publishedContent,
    updatedAt: publishedSystem.updatedAt
  });
}

export function deleteDecisionTreeSystem(systemId: string): boolean {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);
  if (filteredSystems.length === allSystems.length) return false;
  saveToStorage(filteredSystems);
  return true;
}

export function initializeWorkspaceDecisionTreeSystem(workspaceId: string): void {
  const existingSystems = getDecisionTreeSystems(workspaceId);
  if (existingSystems.length > 0) return;
  createDecisionTreeSystemEntry({ workspaceId, title: 'Decision Support System' });
}

export function getPublishedDecisionTreeSystems(workspaceId: string): DecisionTreeSystem[] {
  return getDecisionTreeSystems(workspaceId).filter(system => system.enabled && system.publishedContent !== null);
}