export const FAQ_MODEL_VERSION = '2.0.0';

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
};

export type FAQDraft = {
  version: string;
  title: string;
  description: string;
  items: FAQItem[];
};

export type FAQPublished = FAQDraft;

export type FAQMeta = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  publishedAt: string | null;
};

const createFAQItem = (): FAQItem => ({
  id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  question: '',
  answer: '',
  category: '',
  tags: []
});

export const createFAQDraft = (title = 'Frequently Asked Questions'): FAQDraft => ({
  version: FAQ_MODEL_VERSION,
  title,
  description: '',
  items: [createFAQItem()]
});

export const createFAQMeta = (workspaceId: string, title: string): FAQMeta => {
  const now = new Date().toISOString();
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    title,
    publishedAt: null
  };
};

export const validateFAQDraft = (draft: FAQDraft): boolean => {
  if (!draft || draft.version !== FAQ_MODEL_VERSION) return false;
  if (typeof draft.title !== 'string') return false;
  if (typeof draft.description !== 'string') return false;
  if (!Array.isArray(draft.items)) return false;
  return draft.items.every((item) => (
    typeof item.id === 'string' &&
    typeof item.question === 'string' &&
    typeof item.answer === 'string' &&
    typeof item.category === 'string' &&
    Array.isArray(item.tags)
  ));
};
