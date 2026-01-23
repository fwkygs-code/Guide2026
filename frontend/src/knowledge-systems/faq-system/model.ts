export const FAQ_MODEL_VERSION = '1.0.0';
export const FAQ_TYPES = { DRAFT: 'draft', PUBLISHED: 'published' };
export const FAQ_CONTENT_SCHEMA = {
  version: FAQ_MODEL_VERSION,
  title: 'string',
  description: 'string',
  faqs: [{
    id: 'string',
    question: 'string',
    answer: 'richtext',
    category: 'string',
    tags: ['string']
  }]
};

export interface FAQSystem {
  id: string;
  type: 'faq';
  workspaceId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  draftContent: FAQContent;
  publishedContent: FAQContent | null;
}

export interface FAQContent {
  version: string;
  title: string;
  description: string;
  faqs: FAQItem[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

export function createFAQSystem(params: { workspaceId: string; title?: string }): FAQSystem {
  const now = new Date().toISOString();
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'faq',
    workspaceId: params.workspaceId,
    enabled: false,
    createdAt: now,
    updatedAt: now,
    draftContent: {
      version: FAQ_MODEL_VERSION,
      title: params.title || 'Frequently Asked Questions',
      description: '',
      faqs: []
    },
    publishedContent: null
  };
}

export function validateFAQSystem(system: FAQSystem): boolean {
  return (
    system &&
    typeof system.id === 'string' &&
    system.type === 'faq' &&
    typeof system.workspaceId === 'string' &&
    typeof system.enabled === 'boolean' &&
    system.draftContent &&
    validateFAQContent(system.draftContent) &&
    (system.publishedContent === null || validateFAQContent(system.publishedContent))
  );
}

export function validateFAQContent(content: FAQContent): boolean {
  return (
    content &&
    content.version === FAQ_MODEL_VERSION &&
    typeof content.title === 'string' &&
    typeof content.description === 'string' &&
    Array.isArray(content.faqs) &&
    content.faqs.every(faq =>
      typeof faq.id === 'string' &&
      typeof faq.question === 'string' &&
      typeof faq.answer === 'string' &&
      typeof faq.category === 'string' &&
      Array.isArray(faq.tags) &&
      faq.tags.every(tag => typeof tag === 'string')
    )
  );
}

export function publishFAQSystem(system: FAQSystem): FAQSystem {
  if (!validateFAQContent(system.draftContent)) {
    throw new Error('Invalid draft content cannot be published');
  }
  return {
    ...system,
    publishedContent: JSON.parse(JSON.stringify(system.draftContent)),
    updatedAt: new Date().toISOString()
  };
}