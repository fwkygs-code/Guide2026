import { PolicyDraft, PolicyMeta, PolicyPublished, createPolicyDraft, createPolicyMeta, validatePolicyDraft } from './model';

const POLICY_PREFIX = 'policy';
const draftKey = (id: string) => `${POLICY_PREFIX}:draft:${id}`;
const publishedKey = (id: string) => `${POLICY_PREFIX}:published:${id}`;
const metaKey = (id: string) => `${POLICY_PREFIX}:meta:${id}`;
const indexKey = (workspaceId: string) => `${POLICY_PREFIX}:index:${workspaceId}`;

let portalReadOnly = false;

export const enablePolicyPortalReadOnly = () => {
  portalReadOnly = true;
};

export const disablePolicyPortalReadOnly = () => {
  portalReadOnly = false;
};

const assertDraftAllowed = () => {
  if (portalReadOnly) {
    throw new Error('Policy draft access is blocked in portal mode.');
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
  writeJson(indexKey(workspaceId), []);
  return [];
};

const saveIndex = (workspaceId: string, ids: string[]) => {
  writeJson(indexKey(workspaceId), ids);
};

export const createPolicyEntry = (workspaceId: string, forcedId?: string) => {
  const draft = createPolicyDraft();
  const meta = createPolicyMeta(workspaceId, draft.title);
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

export const loadPolicyMeta = (id: string): PolicyMeta | null => readJson<PolicyMeta>(metaKey(id));

export const loadPolicyDraft = (id: string): PolicyDraft | null => {
  assertDraftAllowed();
  return readJson<PolicyDraft>(draftKey(id));
};

export const savePolicyDraft = (id: string, draft: PolicyDraft) => {
  assertDraftAllowed();
  if (!validatePolicyDraft(draft)) {
    throw new Error('Invalid policy draft.');
  }

  const meta = loadPolicyMeta(id);
  const updatedMeta: PolicyMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createPolicyMeta('unknown', draft.title),
        id
      };

  writeJson(draftKey(id), draft);
  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, draft };
};

export const publishPolicy = (id: string) => {
  const draft = loadPolicyDraft(id);
  if (!draft) throw new Error('Policy draft not found.');
  if (!validatePolicyDraft(draft)) throw new Error('Invalid policy draft.');

  const published: PolicyPublished = JSON.parse(JSON.stringify(draft));
  writeJson(publishedKey(id), published);

  const meta = loadPolicyMeta(id);
  const updatedMeta: PolicyMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createPolicyMeta('unknown', draft.title),
        id,
        publishedAt: new Date().toISOString()
      };

  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, published };
};

export const loadPolicyPublished = (id: string): PolicyPublished | null => readJson<PolicyPublished>(publishedKey(id));

export const listPolicyMeta = (workspaceId: string): PolicyMeta[] => {
  const ids = loadIndex(workspaceId);
  return ids.map((id) => loadPolicyMeta(id)).filter(Boolean) as PolicyMeta[];
};

export const listPublishedPolicies = (workspaceId: string) => {
  const ids = loadIndex(workspaceId);
  return ids
    .map((id) => {
      const meta = loadPolicyMeta(id);
      const published = loadPolicyPublished(id);
      if (!meta || !published) return null;
      return { meta, published };
    })
    .filter(Boolean) as { meta: PolicyMeta; published: PolicyPublished }[];
};

export const getLatestPublishedPolicy = (workspaceId: string) => {
  const published = listPublishedPolicies(workspaceId);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = new Date(a.meta.publishedAt || a.meta.updatedAt).getTime();
    const bTime = new Date(b.meta.publishedAt || b.meta.updatedAt).getTime();
    return bTime - aTime;
  })[0];
};
