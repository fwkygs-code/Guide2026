export const POLICY_MODEL_VERSION = '2.0.0';

export type PolicySection = {
  id: string;
  title: string;
  category: string;
  content: string;
  lastUpdated: string;
};

export type PolicyDraft = {
  version: string;
  title: string;
  description: string;
  effectiveDate: string;
  jurisdiction: string;
  sections: PolicySection[];
};

export type PolicyPublished = PolicyDraft;

export type PolicyMeta = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  publishedAt: string | null;
};

const createPolicySection = (title = ''): PolicySection => {
  const now = new Date().toISOString();
  return {
    id: `policy-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    category: '',
    content: '',
    lastUpdated: now
  };
};

export const createPolicyDraft = (title = 'Company Policies'): PolicyDraft => ({
  version: POLICY_MODEL_VERSION,
  title,
  description: '',
  effectiveDate: '',
  jurisdiction: '',
  sections: [createPolicySection('Purpose')]
});

export const createPolicyMeta = (workspaceId: string, title: string): PolicyMeta => {
  const now = new Date().toISOString();
  return {
    id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    title,
    publishedAt: null
  };
};

export const validatePolicyDraft = (draft: PolicyDraft): boolean => {
  if (!draft || draft.version !== POLICY_MODEL_VERSION) return false;
  if (typeof draft.title !== 'string') return false;
  if (typeof draft.description !== 'string') return false;
  if (typeof draft.effectiveDate !== 'string') return false;
  if (typeof draft.jurisdiction !== 'string') return false;
  if (!Array.isArray(draft.sections)) return false;
  return draft.sections.every((section) => (
    typeof section.id === 'string' &&
    typeof section.title === 'string' &&
    typeof section.category === 'string' &&
    typeof section.content === 'string' &&
    typeof section.lastUpdated === 'string'
  ));
};
