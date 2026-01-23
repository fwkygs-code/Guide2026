import { ProcedureSystem, createProcedureSystem, validateProcedureSystem, publishProcedureSystem } from './model';

const PROCEDURE_DRAFT_KEY = 'procedure:draft';
const PROCEDURE_PUBLISHED_KEY = 'procedure:published';

let procedureCache: ProcedureSystem[] | null = null;

function loadFromStorage(): ProcedureSystem[] {
  if (procedureCache !== null) {
    return procedureCache;
  }

  try {
    const draftStored = localStorage.getItem(PROCEDURE_DRAFT_KEY);
    const publishedStored = localStorage.getItem(PROCEDURE_PUBLISHED_KEY);

    const draftSystems = draftStored ? JSON.parse(draftStored) : [];
    const publishedSystems = publishedStored ? JSON.parse(publishedStored) : [];

    const validDraftSystems = draftSystems.filter((system: ProcedureSystem) => {
      if (!validateProcedureSystem(system)) {
        console.warn('Invalid procedure system found in draft storage:', system);
        return false;
      }
      return true;
    });

    const validPublishedSystems = publishedSystems.filter((system: ProcedureSystem) => {
      if (!validateProcedureSystem(system)) {
        console.warn('Invalid procedure system found in published storage:', system);
        return false;
      }
      return true;
    });

    procedureCache = [...validDraftSystems, ...validPublishedSystems];
    return procedureCache;
  } catch (error) {
    console.warn('Failed to load procedure systems from storage:', error);
    procedureCache = [];
    return procedureCache;
  }
}

function saveToStorage(systems: ProcedureSystem[]): void {
  try {
    const draftSystems = systems.filter(s => s.publishedContent === null);
    const publishedSystems = systems.filter(s => s.publishedContent !== null);

    localStorage.setItem(PROCEDURE_DRAFT_KEY, JSON.stringify(draftSystems));
    localStorage.setItem(PROCEDURE_PUBLISHED_KEY, JSON.stringify(publishedSystems));
    procedureCache = systems;
  } catch (error) {
    console.error('Failed to save procedure systems to storage:', error);
  }
}

export function getProcedureSystems(workspaceId: string): ProcedureSystem[] {
  const allSystems = loadFromStorage();
  return allSystems.filter(system => system.workspaceId === workspaceId);
}

export function getProcedureSystem(systemId: string): ProcedureSystem | null {
  const allSystems = loadFromStorage();
  return allSystems.find(system => system.id === systemId) || null;
}

export function createProcedureSystemEntry(params: { workspaceId: string; title?: string }): ProcedureSystem {
  const system = createProcedureSystem(params);
  const allSystems = loadFromStorage();
  allSystems.push(system);
  saveToStorage(allSystems);
  return system;
}

export function updateProcedureSystem(systemId: string, updates: Partial<ProcedureSystem>): ProcedureSystem | null {
  const allSystems = loadFromStorage();
  const index = allSystems.findIndex(system => system.id === systemId);

  if (index === -1) {
    console.warn('Procedure system not found:', systemId);
    return null;
  }

  const updatedSystem = {
    ...allSystems[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (!validateProcedureSystem(updatedSystem)) {
    console.warn('Invalid procedure system update:', updatedSystem);
    return null;
  }

  allSystems[index] = updatedSystem;
  saveToStorage(allSystems);
  return updatedSystem;
}

export function publishProcedureSystemEntry(systemId: string): ProcedureSystem | null {
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

export function deleteProcedureSystem(systemId: string): boolean {
  const allSystems = loadFromStorage();
  const filteredSystems = allSystems.filter(system => system.id !== systemId);

  if (filteredSystems.length === allSystems.length) {
    console.warn('Procedure system not found for deletion:', systemId);
    return false;
  }

  saveToStorage(filteredSystems);
  return true;
}

export function initializeWorkspaceProcedureSystem(workspaceId: string): void {
  const existingSystems = getProcedureSystems(workspaceId);

  if (existingSystems.length > 0) {
    return;
  }

  createProcedureSystemEntry({
    workspaceId,
    title: 'Standard Procedures'
  });
}

export function getPublishedProcedureSystems(workspaceId: string): ProcedureSystem[] {
  return getProcedureSystems(workspaceId).filter(system =>
    system.enabled && system.publishedContent !== null
  );
}