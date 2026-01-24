/**
 * Policy System API Client
 * Handles all backend communication for policy management
 */

import { api } from '../lib/api';

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
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'policy',
      content: { effectiveDate: '', jurisdiction: '', sections: [] },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: PolicyContent }): Promise<PolicySystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  }
};
