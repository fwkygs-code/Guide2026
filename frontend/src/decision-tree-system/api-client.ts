/**
 * Decision Tree System API Client
 * Handles all backend communication for decision tree management
 */

import { api } from '../lib/api';

export interface DecisionTreeContent {
  nodes?: Array<{
    id: string;
    type: 'root' | 'question' | 'outcome';
    content: string;
    answers?: Array<{
      id: string;
      text: string;
      nextNodeId?: string;
    }>;
  }>;
  rootNodeId?: string;
}

export interface DecisionTreeSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: DecisionTreeContent;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const decisionTreeApiClient = {
  async create(workspaceId: string, title: string, description: string = ''): Promise<DecisionTreeSystem> {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'decision_tree',
      content: { nodes: [], rootNodeId: null },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<DecisionTreeSystem> {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: DecisionTreeContent }): Promise<DecisionTreeSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<DecisionTreeSystem> {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  }
};
