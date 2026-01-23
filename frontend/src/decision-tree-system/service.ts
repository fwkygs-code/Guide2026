import {
  DecisionTreeDraft,
  DecisionTreeMeta,
  DecisionTreePublished,
  createDecisionTreeDraft,
  createDecisionTreeMeta,
  getDecisionTreeErrors,
  validateDecisionTreeDraft
} from './model';

const DECISION_TREE_PREFIX = 'decision-tree';
const draftKey = (id: string) => `${DECISION_TREE_PREFIX}:draft:${id}`;
const publishedKey = (id: string) => `${DECISION_TREE_PREFIX}:published:${id}`;
const metaKey = (id: string) => `${DECISION_TREE_PREFIX}:meta:${id}`;
const indexKey = (workspaceId: string) => `${DECISION_TREE_PREFIX}:index:${workspaceId}`;

let portalReadOnly = false;

export const enableDecisionTreePortalReadOnly = () => {
  portalReadOnly = true;
};

export const disableDecisionTreePortalReadOnly = () => {
  portalReadOnly = false;
};

const assertDraftAllowed = () => {
  if (portalReadOnly) {
    throw new Error('Decision tree draft access is blocked in portal mode.');
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
    if (!key || !key.startsWith(`${DECISION_TREE_PREFIX}:meta:`)) continue;
    const meta = readJson<DecisionTreeMeta>(key);
    if (meta?.workspaceId === workspaceId) {
      ids.push(meta.id);
    }
  }
  if (ids.length > 0) {
    saveIndex(workspaceId, ids);
  }
  return ids;
};

export const createDecisionTreeEntry = (workspaceId: string, forcedId?: string) => {
  const draft = createDecisionTreeDraft();
  const meta = createDecisionTreeMeta(workspaceId, draft.title);
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

export const loadDecisionTreeMeta = (id: string): DecisionTreeMeta | null => readJson<DecisionTreeMeta>(metaKey(id));

export const loadDecisionTreeDraft = (id: string): DecisionTreeDraft | null => {
  assertDraftAllowed();
  return readJson<DecisionTreeDraft>(draftKey(id));
};

export const saveDecisionTreeDraft = (id: string, draft: DecisionTreeDraft) => {
  assertDraftAllowed();
  if (!validateDecisionTreeDraft(draft)) {
    throw new Error('Invalid decision tree draft.');
  }

  const meta = loadDecisionTreeMeta(id);
  const updatedMeta: DecisionTreeMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createDecisionTreeMeta('unknown', draft.title),
        id
      };

  writeJson(draftKey(id), draft);
  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, draft };
};

export const publishDecisionTree = (id: string) => {
  const draft = loadDecisionTreeDraft(id);
  if (!draft) throw new Error('Decision tree draft not found.');
  const errors = getDecisionTreeErrors(draft);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const published: DecisionTreePublished = JSON.parse(JSON.stringify(draft));
  writeJson(publishedKey(id), published);

  const meta = loadDecisionTreeMeta(id);
  const updatedMeta: DecisionTreeMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createDecisionTreeMeta('unknown', draft.title),
        id,
        publishedAt: new Date().toISOString()
      };

  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, published };
};

export const loadDecisionTreePublished = (id: string): DecisionTreePublished | null =>
  readJson<DecisionTreePublished>(publishedKey(id));

export const listDecisionTreeMeta = (workspaceId: string): DecisionTreeMeta[] => {
  const ids = getWorkspaceIds(workspaceId);
  return ids.map((id) => loadDecisionTreeMeta(id)).filter(Boolean) as DecisionTreeMeta[];
};

export const listPublishedDecisionTrees = (workspaceId: string) => {
  const ids = getWorkspaceIds(workspaceId);
  return ids
    .map((id) => {
      const meta = loadDecisionTreeMeta(id);
      const published = loadDecisionTreePublished(id);
      if (!meta || !published) return null;
      return { meta, published };
    })
    .filter(Boolean) as { meta: DecisionTreeMeta; published: DecisionTreePublished }[];
};

export const getLatestPublishedDecisionTree = (workspaceId: string) => {
  const published = listPublishedDecisionTrees(workspaceId);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = new Date(a.meta.publishedAt || a.meta.updatedAt).getTime();
    const bTime = new Date(b.meta.publishedAt || b.meta.updatedAt).getTime();
    return bTime - aTime;
  })[0];
};
