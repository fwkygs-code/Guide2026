/**
 * Decision Tree Portal API Client
 * Handles portal (public) API calls for decision trees
 * Must be local to decision-tree-system to comply with ImportFirewall
 */

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

const buildQuery = (params: Record<string, string>) => {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return query ? `?${query}` : '';
};

const request = async (path: string) => {
  const response = await fetch(`${API}${path}`, { credentials: 'include' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.detail || 'Request failed');
  }
  return data;
};

export interface PortalDecisionTreeSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: {
    rootNodeId?: string;
    nodes?: Array<{
      id: string;
      type: string;
      content: string;
      answers?: Array<{
        id: string;
        text: string;
        nextNodeId: string;
      }>;
    }>;
  };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export const decisionTreePortalApiClient = {
  async getAllByType(portalSlug: string): Promise<PortalDecisionTreeSystem[]> {
    const data = await request(
      `/portal/${portalSlug}/knowledge-systems${buildQuery({ system_type: 'decision_tree' })}`
    );
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
