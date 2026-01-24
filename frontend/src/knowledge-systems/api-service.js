/**
 * Knowledge Systems API Service
 * 
 * This service provides a unified interface for interacting with the backend
 * Knowledge Systems API. It replaces the localStorage-based services.
 * 
 * ARCHITECTURE:
 * - Single source of truth: Backend database
 * - localStorage used ONLY for temporary draft caching (optional)
 * - All published content comes from backend
 * - Portal reads ONLY from backend (never localStorage)
 */

import { api } from '../lib/api';
import axios from 'axios';

// Set auth token for all requests
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

// Initialize auth token from localStorage
const token = localStorage.getItem('token');
if (token) {
  setAuthToken(token);
}

// ==========================================
// POLICY SYSTEM
// ==========================================

export const policyService = {
  async create(workspaceId, title, description = '') {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'policy',
      content: {
        effectiveDate: '',
        jurisdiction: '',
        sections: []
      },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId, status = null) {
    const response = await api.getKnowledgeSystems(workspaceId, 'policy', status);
    return response.data;
  },

  async getById(workspaceId, systemId) {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId, systemId, updates) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, updates);
    return response.data;
  },

  async publish(workspaceId, systemId, content) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, {
      content,
      status: 'published'
    });
    return response.data;
  },

  async delete(workspaceId, systemId) {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  },

  async getPublished(workspaceId) {
    const response = await api.getKnowledgeSystems(workspaceId, 'policy', 'published');
    return response.data;
  }
};

// ==========================================
// PROCEDURE SYSTEM
// ==========================================

export const procedureService = {
  async create(workspaceId, title, description = '') {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'procedure',
      content: {
        overview: '',
        steps: []
      },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId, status = null) {
    const response = await api.getKnowledgeSystems(workspaceId, 'procedure', status);
    return response.data;
  },

  async getById(workspaceId, systemId) {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId, systemId, updates) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, updates);
    return response.data;
  },

  async publish(workspaceId, systemId, content) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, {
      content,
      status: 'published'
    });
    return response.data;
  },

  async delete(workspaceId, systemId) {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  },

  async getPublished(workspaceId) {
    const response = await api.getKnowledgeSystems(workspaceId, 'procedure', 'published');
    return response.data;
  }
};

// ==========================================
// DOCUMENTATION SYSTEM
// ==========================================

export const documentationService = {
  async create(workspaceId, title, description = '') {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'documentation',
      content: {
        sections: []
      },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId, status = null) {
    const response = await api.getKnowledgeSystems(workspaceId, 'documentation', status);
    return response.data;
  },

  async getById(workspaceId, systemId) {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId, systemId, updates) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, updates);
    return response.data;
  },

  async publish(workspaceId, systemId, content) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, {
      content,
      status: 'published'
    });
    return response.data;
  },

  async delete(workspaceId, systemId) {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  },

  async getPublished(workspaceId) {
    const response = await api.getKnowledgeSystems(workspaceId, 'documentation', 'published');
    return response.data;
  }
};

// ==========================================
// FAQ SYSTEM
// ==========================================

export const faqService = {
  async create(workspaceId, title, description = '') {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'faq',
      content: {
        questions: []
      },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId, status = null) {
    const response = await api.getKnowledgeSystems(workspaceId, 'faq', status);
    return response.data;
  },

  async getById(workspaceId, systemId) {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId, systemId, updates) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, updates);
    return response.data;
  },

  async publish(workspaceId, systemId, content) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, {
      content,
      status: 'published'
    });
    return response.data;
  },

  async delete(workspaceId, systemId) {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  },

  async getPublished(workspaceId) {
    const response = await api.getKnowledgeSystems(workspaceId, 'faq', 'published');
    return response.data;
  }
};

// ==========================================
// DECISION TREE SYSTEM
// ==========================================

export const decisionTreeService = {
  async create(workspaceId, title, description = '') {
    const response = await api.createKnowledgeSystem(workspaceId, {
      title,
      description,
      system_type: 'decision_tree',
      content: {
        rootNodeId: null,
        nodes: []
      },
      status: 'draft'
    });
    return response.data;
  },

  async getAll(workspaceId, status = null) {
    const response = await api.getKnowledgeSystems(workspaceId, 'decision_tree', status);
    return response.data;
  },

  async getById(workspaceId, systemId) {
    const response = await api.getKnowledgeSystem(workspaceId, systemId);
    return response.data;
  },

  async update(workspaceId, systemId, updates) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, updates);
    return response.data;
  },

  async publish(workspaceId, systemId, content) {
    const response = await api.updateKnowledgeSystem(workspaceId, systemId, {
      content,
      status: 'published'
    });
    return response.data;
  },

  async delete(workspaceId, systemId) {
    await api.deleteKnowledgeSystem(workspaceId, systemId);
  },

  async getPublished(workspaceId) {
    const response = await api.getKnowledgeSystems(workspaceId, 'decision_tree', 'published');
    return response.data;
  }
};

// ==========================================
// PORTAL PUBLIC API (NO AUTH)
// ==========================================

export const portalKnowledgeSystemsService = {
  async getAll(portalSlug, systemType = null) {
    const response = await api.getPortalKnowledgeSystems(portalSlug, systemType);
    return response.data;
  },

  async getById(portalSlug, systemId) {
    const response = await api.getPortalKnowledgeSystem(portalSlug, systemId);
    return response.data;
  },

  async getAllByType(portalSlug, systemType) {
    try {
      console.log(`[PortalAPI] Fetching ${systemType} for slug: ${portalSlug}`);
      const response = await api.getPortalKnowledgeSystems(portalSlug, systemType);
      console.log(`[PortalAPI] Response status: ${response.status}`);
      console.log(`[PortalAPI] Response data:`, response.data);
      console.log(`[PortalAPI] Response data type:`, typeof response.data);
      console.log(`[PortalAPI] Is array:`, Array.isArray(response.data));
      
      const data = response.data;
      if (!data) {
        console.warn(`[PortalAPI] No data in response for ${systemType}`);
        return [];
      }
      
      if (Array.isArray(data)) {
        console.log(`[PortalAPI] Returning ${data.length} ${systemType} systems`);
        return data;
      }
      
      // Handle case where data might be wrapped
      if (data.data && Array.isArray(data.data)) {
        console.log(`[PortalAPI] Data wrapped, returning ${data.data.length} systems`);
        return data.data;
      }
      
      console.warn(`[PortalAPI] Unexpected data format for ${systemType}:`, data);
      return [];
    } catch (error) {
      console.error(`[PortalAPI] Error fetching ${systemType}:`, error);
      console.error(`[PortalAPI] Error response:`, error.response?.data);
      throw error;
    }
  }
};

// ==========================================
// MIGRATION HELPER (ONE-TIME USE)
// ==========================================

export const migrationHelper = {
  /**
   * Detects if there's localStorage data that needs migration
   */
  hasLocalStorageData(systemType) {
    const prefixes = {
      policy: 'policy:',
      procedure: 'procedure:',
      documentation: 'documentation:',
      faq: 'faq:',
      decision_tree: 'decision-tree:'
    };
    
    const prefix = prefixes[systemType];
    if (!prefix) return false;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  },

  /**
   * Migrates localStorage data to backend
   * Returns array of created systems
   */
  async migrateToBackend(workspaceId, systemType) {
    // This would need implementation specific to each system type
    // For now, just return empty array (migration can be done manually)
    console.warn('Migration from localStorage to backend not yet implemented');
    console.warn('Please recreate your knowledge systems in the editor');
    return [];
  },

  /**
   * Clears localStorage data after successful migration
   */
  clearLocalStorage(systemType) {
    const prefixes = {
      policy: 'policy:',
      procedure: 'procedure:',
      documentation: 'documentation:',
      faq: 'faq:',
      decision_tree: 'decision-tree:'
    };
    
    const prefix = prefixes[systemType];
    if (!prefix) return;

    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToDelete.length} localStorage entries for ${systemType}`);
  }
};
