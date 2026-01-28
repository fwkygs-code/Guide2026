/**
 * FAQ Portal API Client
 * Handles portal (public) API calls for FAQs
 * Must be local to faq-system to comply with ImportFirewall
 */

import { getApiClient } from 'shared-http';

const apiClient = getApiClient();

export interface PortalFAQSystem {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  system_type: string;
  content: {
    question?: string;
    answer?: string;
    category?: string;
  };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export const faqPortalApiClient = {
  async getAllByType(portalSlug: string): Promise<PortalFAQSystem[]> {
    const response = await apiClient.get(`/portal/${portalSlug}/knowledge-systems`, {
      params: { system_type: 'faq' }
    });
    const data = response.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
