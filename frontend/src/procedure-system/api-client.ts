/**
 * Procedure System API Client
 * Handles all backend communication for procedure management
 */

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.detail || 'Request failed');
  }
  return data;
};

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
    const response = await request(`/workspaces/${workspaceId}/knowledge-systems`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        system_type: 'procedure',
        content: { overview: '', steps: [] },
        status: 'draft'
      })
    });
    return response;
  },

  async getById(workspaceId: string, systemId: string): Promise<ProcedureSystem> {
    const response = await request(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`);
    return response;
  },

  async update(workspaceId: string, systemId: string, data: { title: string; description: string; content: ProcedureContent }): Promise<ProcedureSystem> {
    const response = await request(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response;
  },

  async publish(workspaceId: string, systemId: string): Promise<ProcedureSystem> {
    const response = await request(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'published' })
    });
    return response;
  },

  async delete(workspaceId: string, systemId: string): Promise<void> {
    await request(`/workspaces/${workspaceId}/knowledge-systems/${systemId}`, {
      method: 'DELETE'
    });
  }
};
