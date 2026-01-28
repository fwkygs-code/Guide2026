/**
 * FAQ System API Client
 * Handles all backend communication for FAQ management
 */

import { getApiClient } from 'shared-http';

const apiClient = getApiClient();

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
    const response = await apiClient.post(`/workspaces/${workspaceId}/knowledge-systems`, {
      title,
      description,
      system_type: 'faq',
      content: { question: '', answer: '' },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<FAQSystem> {
    const response = await apiClient.get(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: FAQContent }): Promise<FAQSystem> {
    const response = await apiClient.put(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<FAQSystem> {
    const response = await apiClient.put(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
  }
};
