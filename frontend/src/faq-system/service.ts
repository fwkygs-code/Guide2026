import { FAQDraft, FAQMeta, FAQPublished, createFAQDraft, createFAQMeta, validateFAQDraft } from './model';

const FAQ_PREFIX = 'faq';
const draftKey = (id: string) => `${FAQ_PREFIX}:draft:${id}`;
const publishedKey = (id: string) => `${FAQ_PREFIX}:published:${id}`;
const metaKey = (id: string) => `${FAQ_PREFIX}:meta:${id}`;
const indexKey = (workspaceId: string) => `${FAQ_PREFIX}:index:${workspaceId}`;

let portalReadOnly = false;

export const enableFAQPortalReadOnly = () => {
  portalReadOnly = true;
};

export const disableFAQPortalReadOnly = () => {
  portalReadOnly = false;
};

const assertDraftAllowed = () => {
  if (portalReadOnly) {
    throw new Error('FAQ draft access is blocked in portal mode.');
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
    if (!key || !key.startsWith(`${FAQ_PREFIX}:meta:`)) continue;
    const meta = readJson<FAQMeta>(key);
    if (meta?.workspaceId === workspaceId) {
      ids.push(meta.id);
    }
  }
  if (ids.length > 0) {
    saveIndex(workspaceId, ids);
  }
  return ids;
};

export const createFAQEntry = (workspaceId: string, forcedId?: string) => {
  const draft = createFAQDraft();
  const meta = createFAQMeta(workspaceId, draft.title);
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

export const loadFAQMeta = (id: string): FAQMeta | null => readJson<FAQMeta>(metaKey(id));

export const loadFAQDraft = (id: string): FAQDraft | null => {
  assertDraftAllowed();
  return readJson<FAQDraft>(draftKey(id));
};

export const saveFAQDraft = (id: string, draft: FAQDraft) => {
  assertDraftAllowed();
  if (!validateFAQDraft(draft)) {
    throw new Error('Invalid FAQ draft.');
  }

  const meta = loadFAQMeta(id);
  const updatedMeta: FAQMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createFAQMeta('unknown', draft.title),
        id
      };

  writeJson(draftKey(id), draft);
  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, draft };
};

export const publishFAQ = (id: string) => {
  const draft = loadFAQDraft(id);
  if (!draft) throw new Error('FAQ draft not found.');
  if (!validateFAQDraft(draft)) throw new Error('Invalid FAQ draft.');

  const published: FAQPublished = JSON.parse(JSON.stringify(draft));
  writeJson(publishedKey(id), published);

  const meta = loadFAQMeta(id);
  const updatedMeta: FAQMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createFAQMeta('unknown', draft.title),
        id,
        publishedAt: new Date().toISOString()
      };

  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, published };
};

export const loadFAQPublished = (id: string): FAQPublished | null => readJson<FAQPublished>(publishedKey(id));

export const listFAQMeta = (workspaceId: string): FAQMeta[] => {
  const ids = getWorkspaceIds(workspaceId);
  return ids.map((id) => loadFAQMeta(id)).filter(Boolean) as FAQMeta[];
};

export const listPublishedFAQs = (workspaceId: string) => {
  const ids = getWorkspaceIds(workspaceId);
  return ids
    .map((id) => {
      const meta = loadFAQMeta(id);
      const published = loadFAQPublished(id);
      if (!meta || !published) return null;
      return { meta, published };
    })
    .filter(Boolean) as { meta: FAQMeta; published: FAQPublished }[];
};

export const getLatestPublishedFAQ = (workspaceId: string) => {
  const published = listPublishedFAQs(workspaceId);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = new Date(a.meta.publishedAt || a.meta.updatedAt).getTime();
    const bTime = new Date(b.meta.publishedAt || b.meta.updatedAt).getTime();
    return bTime - aTime;
  })[0];
};
