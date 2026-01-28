/**
 * Policy Portal API Client
 * Handles portal (public) API calls for policies
 * Must be local to policy-system to comply with ImportFirewall
 */

import { getApiClient } from 'shared-http';

const apiClient = getApiClient();

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
    const response = await apiClient.get(`/portal/${portalSlug}/knowledge-systems`, {
      params: { system_type: 'policy' }
    });
    const data = response.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
