/**
 * Procedure System API Client
 * Handles all backend communication for procedure management
 */

import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

export interface ProcedureContent {
  overview?: string;
  category?: string;
  steps?: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
  }>;
}

export interface ProcedureSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: ProcedureContent;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const procedureApiClient = {
  async create(workspaceId: string, title: string, description: string = ''): Promise<ProcedureSystem> {
    const response = await axios.post(`${API}/workspaces/${workspaceId}/knowledge-systems`, {
      title,
      description,
      system_type: 'procedure',
      content: { overview: '', steps: [] },
      status: 'draft'
    });
    return response.data;
  },

  async getById(workspaceId: string, systemId: string): Promise<ProcedureSystem> {
    const response = await axios.get(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
    return response.data;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: ProcedureContent }): Promise<ProcedureSystem> {
    const response = await axios.put(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`, data);
    return response.data;
  },

  async publish(workspaceId: string, systemId: string): Promise<ProcedureSystem> {
    const response = await axios.put(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`, { status: 'published' });
    return response.data;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await axios.delete(`${API}/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
  }
};
