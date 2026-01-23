export const DOCUMENTATION_MODEL_VERSION = '1.0.0';
export const DOCUMENTATION_TYPES = { DRAFT: 'draft', PUBLISHED: 'published' };
export const DOCUMENTATION_CONTENT_SCHEMA = {
  version: DOCUMENTATION_MODEL_VERSION,
  title: 'string',
  description: 'string',
  sections: [{
    id: 'string',
    title: 'string',
    content: 'richtext',
    subsections: [{
      id: 'string',
      title: 'string',
      content: 'richtext',
      order: 'number'
    }],
    order: 'number'
  }]
};

export interface DocumentationSystem {
  id: string;
  type: 'documentation';
  workspaceId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  draftContent: DocumentationContent;
  publishedContent: DocumentationContent | null;
}

export interface DocumentationContent {
  version: string;
  title: string;
  description: string;
  sections: DocumentationSection[];
}

export interface DocumentationSection {
  id: string;
  title: string;
  content: string;
  subsections: DocumentationSubsection[];
  order: number;
}

export interface DocumentationSubsection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export function createDocumentationSystem(params: { workspaceId: string; title?: string }): DocumentationSystem {
  const now = new Date().toISOString();
  return {
    id: `documentation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'documentation',
    workspaceId: params.workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: DOCUMENTATION_MODEL_VERSION,
      title: params.title || 'Product Documentation',
      description: '',
      sections: [{
        id: `section-${Date.now()}`,
        title: '',
        content: '',
        subsections: [],
        order: 1
      }]
    },
    publishedContent: null
  };
}

export function validateDocumentationSystem(system: DocumentationSystem): boolean {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'documentation' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateDocumentationContent(system.draftContent) &&
    (system.publishedContent === null || validateDocumentationContent(system.publishedContent))
  );
}

export function validateDocumentationContent(content: DocumentationContent): boolean {
  return (
    content &&
    content.version === DOCUMENTATION_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.sections) &&
    content.sections.every(section =>
      typeof section.id === 'string' &&
      typeof section.title === 'string' &&
      typeof section.content === 'string' &&
      typeof section.order === 'number' &&
      Array.isArray(section.subsections) &&
      section.subsections.every(subsection =>
        typeof subsection.id === 'string' &&
        typeof subsection.title === 'string' &&
        typeof subsection.content === 'string' &&
        typeof subsection.order === 'number'
      )
    )
  );
}

export function publishDocumentationSystem(system: DocumentationSystem): DocumentationSystem {
  if (!validateDocumentationContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }
  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)),
    updatedAt: new Date().toISOString()
  };
}