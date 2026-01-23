export const DOCUMENTATION_MODEL_VERSION = '2.0.0';

export type DocumentationSection = {
  id: string;
  title: string;
  content: string;
  codeBlock: string;
  children: DocumentationSection[];
};

export type DocumentationDraft = {
  version: string;
  title: string;
  description: string;
  sections: DocumentationSection[];
};

export type DocumentationPublished = DocumentationDraft;

export type DocumentationMeta = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  publishedAt: string | null;
};

const createSection = (title = ''): DocumentationSection => ({
  id: `doc-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  content: '',
  codeBlock: '',
  children: []
});

export const createDocumentationDraft = (title = 'Product Documentation'): DocumentationDraft => ({
  version: DOCUMENTATION_MODEL_VERSION,
  title,
  description: '',
  sections: [createSection('Overview')]
});

export const createDocumentationMeta = (workspaceId: string, title: string): DocumentationMeta => {
  const now = new Date().toISOString();
  return {
    id: `documentation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    title,
    publishedAt: null
  };
};

export const validateDocumentationDraft = (draft: DocumentationDraft): boolean => {
  if (!draft || draft.version !== DOCUMENTATION_MODEL_VERSION) return false;
  if (typeof draft.title !== 'string') return false;
  if (typeof draft.description !== 'string') return false;
  if (!Array.isArray(draft.sections)) return false;

  const validateSection = (section: DocumentationSection): boolean => {
    if (!section || typeof section.id !== 'string') return false;
    if (typeof section.title !== 'string') return false;
    if (typeof section.content !== 'string') return false;
    if (typeof section.codeBlock !== 'string') return false;
    if (!Array.isArray(section.children)) return false;
    return section.children.every(validateSection);
  };

  return draft.sections.every(validateSection);
};
