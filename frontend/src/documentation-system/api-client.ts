/**
 * Documentation System API Client
 * Handles all backend communication for documentation management
 */

import { api } from '../lib/api';

export interface DocumentationContent {
  content?: string;
  subsections?: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
}

export interface DocumentationSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: DocumentationContent;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const documentationApiClient = {
  async create(workspaceId: string, title: string, description: string = ''): Promise<DocumentationSystem> {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'documentation',
      content: { content: '', subsections: [] },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<DocumentationSystem> {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: DocumentationContent }): Promise<DocumentationSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<DocumentationSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  }
};
