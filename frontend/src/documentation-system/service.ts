import { DocumentationDraft, DocumentationMeta, DocumentationPublished, createDocumentationDraft, createDocumentationMeta, validateDocumentationDraft } from './model';

const DOCUMENTATION_PREFIX = 'documentation';
const draftKey = (id: string) => `${DOCUMENTATION_PREFIX}:draft:${id}`;
const publishedKey = (id: string) => `${DOCUMENTATION_PREFIX}:published:${id}`;
const metaKey = (id: string) => `${DOCUMENTATION_PREFIX}:meta:${id}`;
const indexKey = (workspaceId: string) => `${DOCUMENTATION_PREFIX}:index:${workspaceId}`;

let portalReadOnly = false;

export const enableDocumentationPortalReadOnly = () => {
  portalReadOnly = true;
};

export const disableDocumentationPortalReadOnly = () => {
  portalReadOnly = false;
};

const assertDraftAllowed = () => {
  if (portalReadOnly) {
    throw new Error('Documentation draft access is blocked in portal mode.');
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
    if (!key || !key.startsWith(`${DOCUMENTATION_PREFIX}:meta:`)) continue;
    const meta = readJson<DocumentationMeta>(key);
    if (meta?.workspaceId === workspaceId) {
      ids.push(meta.id);
    }
  }
  if (ids.length > 0) {
    saveIndex(workspaceId, ids);
  }
  return ids;
};

export const createDocumentationEntry = (workspaceId: string, forcedId?: string) => {
  const draft = createDocumentationDraft();
  const meta = createDocumentationMeta(workspaceId, draft.title);
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

export const loadDocumentationMeta = (id: string): DocumentationMeta | null => readJson<DocumentationMeta>(metaKey(id));

export const loadDocumentationDraft = (id: string): DocumentationDraft | null => {
  assertDraftAllowed();
  return readJson<DocumentationDraft>(draftKey(id));
};

export const saveDocumentationDraft = (id: string, draft: DocumentationDraft) => {
  assertDraftAllowed();
  if (!validateDocumentationDraft(draft)) {
    throw new Error('Invalid documentation draft.');
  }

  const meta = loadDocumentationMeta(id);
  const updatedMeta: DocumentationMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createDocumentationMeta('unknown', draft.title),
        id
      };

  writeJson(draftKey(id), draft);
  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, draft };
};

export const publishDocumentation = (id: string) => {
  const draft = loadDocumentationDraft(id);
  if (!draft) throw new Error('Documentation draft not found.');
  if (!validateDocumentationDraft(draft)) throw new Error('Invalid documentation draft.');

  const published: DocumentationPublished = JSON.parse(JSON.stringify(draft));
  writeJson(publishedKey(id), published);

  const meta = loadDocumentationMeta(id);
  const updatedMeta: DocumentationMeta = meta
    ? {
        ...meta,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        title: draft.title
      }
    : {
        ...createDocumentationMeta('unknown', draft.title),
        id,
        publishedAt: new Date().toISOString()
      };

  writeJson(metaKey(id), updatedMeta);
  return { meta: updatedMeta, published };
};

export const loadDocumentationPublished = (id: string): DocumentationPublished | null => readJson<DocumentationPublished>(publishedKey(id));

export const listDocumentationMeta = (workspaceId: string): DocumentationMeta[] => {
  const ids = getWorkspaceIds(workspaceId);
  return ids.map((id) => loadDocumentationMeta(id)).filter(Boolean) as DocumentationMeta[];
};

export const listPublishedDocumentation = (workspaceId: string) => {
  const ids = getWorkspaceIds(workspaceId);
  return ids
    .map((id) => {
      const meta = loadDocumentationMeta(id);
      const published = loadDocumentationPublished(id);
      if (!meta || !published) return null;
      return { meta, published };
    })
    .filter(Boolean) as { meta: DocumentationMeta; published: DocumentationPublished }[];
};

export const getLatestPublishedDocumentation = (workspaceId: string) => {
  const published = listPublishedDocumentation(workspaceId);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = new Date(a.meta.publishedAt || a.meta.updatedAt).getTime();
    const bTime = new Date(b.meta.publishedAt || b.meta.updatedAt).getTime();
    return bTime - aTime;
  })[0];
};
