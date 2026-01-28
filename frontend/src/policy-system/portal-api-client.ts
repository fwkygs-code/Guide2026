/**
 * Policy Portal API Client
 * Handles portal (public) API calls for policies
 * Must be local to policy-system to comply with ImportFirewall
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

export interface PortalPolicySystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: {
    effectiveDate?: string;
    jurisdiction?: string;
    sections?: Array<{
      id: string;
      title: string;
      category?: string;
      content: string;
      lastUpdated: string;
    }>;
  };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export const policyPortalApiClient = {
  async getAllByType(portalSlug: string): Promise<PortalPolicySystem[]> {
    const data = await request(
      `/portal/${portalSlug}/knowledge-systems${buildQuery({ system_type: 'policy' })}`
    );
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
