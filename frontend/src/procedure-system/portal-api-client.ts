/**
 * Procedure Portal API Client
 * Handles portal (public) API calls for procedures
 * Must be local to procedure-system to comply with ImportFirewall
 */

import axios from 'axios';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
const API = `${API_BASE.replace(/\/$/, '')}/api`;

export interface PortalProcedureSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: {
    steps?: Array<{
      id: string;
      title: string;
      description: string;
    }>;
    overview?: string;
  };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export const procedurePortalApiClient = {
  async getAllByType(portalSlug: string): Promise<PortalProcedureSystem[]> {
    const response = await axios.get(`${API}/portal/${portalSlug}/knowledge-systems`, {
      params: { system_type: 'procedure' }
    });
    const data = response.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
