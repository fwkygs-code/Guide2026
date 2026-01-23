import { ProcedureDraft, ProcedureMeta, ProcedurePublished, createProcedureDraft, createProcedureMeta, validateProcedureDraft } from './model';

const PROCEDURE_PREFIX = 'procedure';
const draftKey = (id: string) => `${PROCEDURE_PREFIX}:draft:${id}`;
const publishedKey = (id: string) => `${PROCEDURE_PREFIX}:published:${id}`;
const metaKey = (id: string) => `${PROCEDURE_PREFIX}:meta:${id}`;
const indexKey = (workspaceId: string) => `${PROCEDURE_PREFIX}:index:${workspaceId}`;

let portalReadOnly = false;

export const enableProcedurePortalReadOnly = () => {
  portalReadOnly = true;
};

export const disableProcedurePortalReadOnly = () => {
  portalReadOnly = false;
};

const assertDraftAllowed = () => {
  if (portalReadOnly) {
    throw new Error('Procedure draft access is blocked in portal mode.');
  }
};

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const loadIndex = (workspaceId: string): string[] => {
  const stored = readJson<string[]>(indexKey(workspaceId));
  if (Array.isArray(stored)) return stored;
  return [];
};

const saveIndex = (workspaceId: string, ids: string[]) => {
  writeJson(indexKey(workspaceId), ids);
};

const getWorkspaceIds = (workspaceId: string): string[] => {
  if (!workspaceId) return [];
  const stored = loadIndex(workspaceId);
  if (stored.length > 0) return stored;
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(`${PROCEDURE_PREFIX}:meta:`)) continue;
    const meta = readJson<ProcedureMeta>(key);
    if (meta?.workspaceId === workspaceId) {
      ids.push(meta.id);
    }
  }
  if (ids.length > 0) {
    saveIndex(workspaceId, ids);
  }
  return ids;
};

export const createProcedureEntry = (workspaceId: string, forcedId?: string) => {
  const draft = createProcedureDraft();
  const meta = createProcedureMeta(workspaceId, draft.title);
  const finalMeta = forcedId ? { ...meta, id: forcedId } : meta;
  const finalDraft = { ...draft };

  writeJson(metaKey(finalMeta.id), finalMeta);
  writeJson(draftKey(finalMeta.id), finalDraft);

  const ids = loadIndex(workspaceId);
  if (!ids.includes(finalMeta.id)) {
    saveIndex(workspaceId, [...ids, finalMeta.id]);
  }

  return { meta: finalMeta, draft: finalDraft };
};

export const loadProcedureMeta = (id: string): ProcedureMeta | null => readJson<ProcedureMeta>(metaKey(id));

export const loadProcedureDraft = (id: string): ProcedureDraft | null => {
  assertDraftAllowed();
  return readJson<ProcedureDraft>(draftKey(id));
};

export const saveProcedureDraft = (id: string, draft: ProcedureDraft) => {
  assertDraftAllowed();
  if (!validateProcedureDraft(draft)) {
    throw new Error('Invalid procedure draft.');
  }

  const meta = loadProcedureMeta(id);
  const updatedMeta: ProcedureMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createProcedureMeta('unknown', draft.title),
        id
      };

  writeJson(draftKey(id), draft);
  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, draft };
};

export const publishProcedure = (id: string) => {
  const draft = loadProcedureDraft(id);
  if (!draft) throw new Error('Procedure draft not found.');
  if (!validateProcedureDraft(draft)) throw new Error('Invalid procedure draft.');

  const published: ProcedurePublished = JSON.parse(JSON.stringify(draft));
  writeJson(publishedKey(id), published);

  const meta = loadProcedureMeta(id);
  const updatedMeta: ProcedureMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createProcedureMeta('unknown', draft.title),
        id,
        publishedAt: new Date().toISOString()
      };

  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, published };
};

export const loadProcedurePublished = (id: string): ProcedurePublished | null => readJson<ProcedurePublished>(publishedKey(id));

export const listProcedureMeta = (workspaceId: string): ProcedureMeta[] => {
  const ids = getWorkspaceIds(workspaceId);
  return ids.map((id) => loadProcedureMeta(id)).filter(Boolean) as ProcedureMeta[];
};

export const listPublishedProcedures = (workspaceId: string) => {
  const ids = getWorkspaceIds(workspaceId);
  return ids
    .map((id) => {
      const meta = loadProcedureMeta(id);
      const published = loadProcedurePublished(id);
      if (!meta || !published) return null;
      return { meta, published };
    })
    .filter(Boolean) as { meta: ProcedureMeta; published: ProcedurePublished }[];
};

export const getLatestPublishedProcedure = (workspaceId: string) => {
  const published = listPublishedProcedures(workspaceId);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = new Date(a.meta.publishedAt || a.meta.updatedAt).getTime();
    const bTime = new Date(b.meta.publishedAt || b.meta.updatedAt).getTime();
    return bTime - aTime;
  })[0];
};
