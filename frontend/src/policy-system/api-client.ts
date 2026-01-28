/**
 * Policy System API Client
 * Handles all backend communication for policy management
 */

import { getApiClient } from 'shared-http';

const apiClient = getApiClient();

export interface PolicyContent {
  effectiveDate?: string;
  jurisdiction?: string;
  sections?: Array<{
    id: string;
    title: string;
    category?: string;
    content: string;
    lastUpdated: string;
  }>;
}

export interface PolicySystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: PolicyContent;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const policyApiClient = {
  async create(workspaceId: string, title: string, description: string = ''): Promise<PolicySystem> {
    const response = await apiClient.post(`/workspaces/${workspaceId}/knowledge-systems`, {
      title,
      description,
      system_type: 'policy',
      content: { effectiveDate: '', jurisdiction: '', sections: [] },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId: string): Promise<PolicySystem[]> {
    const response = await apiClient.get(`/workspaces/${workspaceId}/knowledge-systems`, {
      params: { system_type: 'policy' }
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await apiClient.get(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: PolicyContent }): Promise<PolicySystem> {
    const response = await apiClient.put(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await apiClient.put(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
  }
};
