/**
 * Policy System API Client
 * Handles all backend communication for policy management
 */

import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

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
    const response = await axios.post(`${API}/workspaces/${workspaceId}/knowledge-systems`, {
      title,
      description,
      system_type: 'policy',
      content: { effectiveDate: '', jurisdiction: '', sections: [] },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await axios.get(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: PolicyContent }): Promise<PolicySystem> {
    const response = await axios.put(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<PolicySystem> {
    const response = await axios.put(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await axios.delete(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
  }
};
