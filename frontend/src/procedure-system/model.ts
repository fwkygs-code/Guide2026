export const PROCEDURE_MODEL_VERSION = '2.0.0';

export type ProcedureStep = {
  id: string;
  title: string;
  instruction: string;
  duration: string;
  attachmentName: string;
  attachmentUrl: string;
  notes: string;
};

export type ProcedureDraft = {
  version: string;
  title: string;
  objective: string;
  steps: ProcedureStep[];
};

export type ProcedurePublished = ProcedureDraft;

export type ProcedureMeta = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  publishedAt: string | null;
};

const createProcedureStep = (title = ''): ProcedureStep => ({
  id: `procedure-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  instruction: '',
  duration: '',
  attachmentName: '',
  attachmentUrl: '',
  notes: ''
});

export const createProcedureDraft = (title = 'Standard Operating Procedure'): ProcedureDraft => ({
  version: PROCEDURE_MODEL_VERSION,
  title,
  objective: '',
  steps: [createProcedureStep('Step 1')]
});

export const createProcedureMeta = (workspaceId: string, title: string): ProcedureMeta => {
  const now = new Date().toISOString();
  return {
    id: `procedure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    title,
    publishedAt: null
  };
};

export const validateProcedureDraft = (draft: ProcedureDraft): boolean => {
  if (!draft || draft.version !== PROCEDURE_MODEL_VERSION) return false;
  if (typeof draft.title !== 'string') return false;
  if (typeof draft.objective !== 'string') return false;
  if (!Array.isArray(draft.steps)) return false;
  return draft.steps.every((step) => (
    typeof step.id === 'string' &&
    typeof step.title === 'string' &&
    typeof step.instruction === 'string' &&
    typeof step.duration === 'string' &&
    typeof step.attachmentName === 'string' &&
    typeof step.attachmentUrl === 'string' &&
    typeof step.notes === 'string'
  ));
};
