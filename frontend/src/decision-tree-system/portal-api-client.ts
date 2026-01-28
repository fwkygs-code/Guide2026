/**
 * Decision Tree Portal API Client
 * Handles portal (public) API calls for decision trees
 * Must be local to decision-tree-system to comply with ImportFirewall
 */

import { getApiClient } from 'shared-http';

const apiClient = getApiClient();

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
    const response = await apiClient.get(`/portal/${portalSlug}/knowledge-systems`, {
      params: { system_type: 'decision_tree' }
    });
    const data = response.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
};
