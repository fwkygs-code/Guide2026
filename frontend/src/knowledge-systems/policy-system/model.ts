// Policy System Model - Complete Isolation
// No shared abstractions, no imports from other systems

export const POLICY_MODEL_VERSION = '1.0.0';

export const POLICY_TYPES = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

export const POLICY_CONTENT_SCHEMA = {
  version: POLICY_MODEL_VERSION,
  title: 'string',
  description: 'string',
  effectiveDate: 'date',
  jurisdiction: 'string',
  policies: [{
    id: 'string',
    title: 'string',
    content: 'richtext',
    category: 'string',
    lastUpdated: 'date'
  }]
};

export interface PolicySystem {
  id: string;
  type: 'policy';
  workspaceId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  draftContent: PolicyContent;
  publishedContent: PolicyContent | null;
}

export interface PolicyContent {
  version: string;
  title: string;
  description: string;
  effectiveDate: string;
  jurisdiction: string;
  policies: PolicyItem[];
}

export interface PolicyItem {
  id: string;
  title: string;
  content: string;
  category: string;
  lastUpdated: string;
}

export function createPolicySystem(params: { workspaceId: string; title?: string }): PolicySystem {
  const now = new Date().toISOString();
  return {
    id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'policy',
    workspaceId: params.workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: POLICY_MODEL_VERSION,
      title: params.title || 'Company Policies',
      description: '',
      effectiveDate: '',
      jurisdiction: '',
      policies: [{
        id: `policy-section-${Date.now()}`,
        title: '',
        content: '',
        category: '',
        lastUpdated: now
      }]
    },
    publishedContent: null
  };
}

export function validatePolicySystem(system: PolicySystem): boolean {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'policy' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validatePolicyContent(system.draftContent) &&
    (system.publishedContent === null || validatePolicyContent(system.publishedContent))
  );
}

export function validatePolicyContent(content: PolicyContent): boolean {
  return (
    content &&
    content.version === POLICY_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    (content.effectiveDate === '' || typeof content.effectiveDate === 'string') &&
    typeof content.jurisdiction === 'string' &&
    Array.isArray(content.policies) &&
    content.policies.every(policy =>
      typeof policy.id === 'string' &&
      typeof policy.title === 'string' &&
      typeof policy.content === 'string' &&
      typeof policy.category === 'string'
    )
  );
}

export function publishPolicySystem(system: PolicySystem): PolicySystem {
  if (!validatePolicyContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }

  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)),
    updatedAt: new Date().toISOString()
  };
}