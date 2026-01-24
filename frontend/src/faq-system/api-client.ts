/**
 * FAQ System API Client
 * Handles all backend communication for FAQ management
 */

import { api } from '../lib/api';

export interface FAQContent {
  question?: string;
  answer?: string;
  category?: string;
}

export interface FAQSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: FAQContent;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const faqApiClient = {
  async create(workspaceId: string, title: string, description: string = ''): Promise<FAQSystem> {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'faq',
      content: { question: '', answer: '' },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<FAQSystem> {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: FAQContent }): Promise<FAQSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<FAQSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  }
};
