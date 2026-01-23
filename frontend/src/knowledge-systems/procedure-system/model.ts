export const PROCEDURE_MODEL_VERSION = '1.0.0';

export const PROCEDURE_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

export const PROCEDURE_CONTENT_SCHEMA = {
  version: PROCEDURE_MODEL_VERSION,
  title: 'string',
  description: 'string',
  procedures: [{
    id: 'string',
    title: 'string',
    description: 'string',
    steps: [{
      id: 'string',
      title: 'string',
      description: 'richtext',
      order: 'number'
    }],
    category: 'string',
    lastUpdated: 'date'
  }]
};

export interface ProcedureSystem {
  id: string;
  type: 'procedure';
  workspaceId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  draftContent: ProcedureContent;
  publishedContent: ProcedureContent | null;
}

export interface ProcedureContent {
  version: string;
  title: string;
  description: string;
  procedures: ProcedureItem[];
}

export interface ProcedureItem {
  id: string;
  title: string;
  description: string;
  steps: ProcedureStep[];
  category: string;
  lastUpdated: string;
}

export interface ProcedureStep {
  id: string;
  title: string;
  description: string;
  order: number;
}

export function createProcedureSystem(params: { workspaceId: string; title?: string }): ProcedureSystem {
  const now = new Date().toISOString();
  return {
    id: `procedure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'procedure',
    workspaceId: params.workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: PROCEDURE_MODEL_VERSION,
      title: params.title || 'Standard Procedures',
      description: '',
      procedures: [{
        id: `procedure-${Date.now()}`,
        title: '',
        description: '',
        steps: [],
        category: '',
        lastUpdated: now
      }]
    },
    publishedContent: null
  };
}

export function validateProcedureSystem(system: ProcedureSystem): boolean {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'procedure' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateProcedureContent(system.draftContent) &&
    (system.publishedContent === null || validateProcedureContent(system.publishedContent))
  );
}

export function validateProcedureContent(content: ProcedureContent): boolean {
  return (
    content &&
    content.version === PROCEDURE_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.procedures) &&
    content.procedures.every(procedure =>
      typeof procedure.id === 'string' &&
      typeof procedure.title === 'string' &&
      typeof procedure.description === 'string' &&
      typeof procedure.category === 'string' &&
      Array.isArray(procedure.steps) &&
      procedure.steps.every(step =>
        typeof step.id === 'string' &&
        typeof step.title === 'string' &&
        typeof step.description === 'string' &&
        typeof step.order === 'number'
      )
    )
  );
}

export function publishProcedureSystem(system: ProcedureSystem): ProcedureSystem {
  if (!validateProcedureContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)),
    updatedAt: new Date().toISOString()
  };
}