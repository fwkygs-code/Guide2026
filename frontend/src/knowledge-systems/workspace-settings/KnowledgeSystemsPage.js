/**
 * Knowledge Systems Workspace Settings Page
 *
 * Futuristic, type-specific interface for managing workspace knowledge systems.
 * Each content type has distinct visual identity and minimal configuration.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import {
  getKnowledgeSystems,
  updateKnowledgeSystem,
  initializeWorkspaceKnowledgeSystems
} from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig, ICONOGRAPHY } from '../registry/KnowledgeSystemRegistry';
import KnowledgeSystemEditor from './KnowledgeSystemEditor';
import { Surface, MOTION } from '@/components/ui/design-system';

/**
 * Main Knowledge Systems Settings Page - Futuristic Design
 */
function KnowledgeSystemsPage() {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  const [systems, setSystems] = useState([]);
  const [editingSystem, setEditingSystem] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load knowledge systems for this workspace
  useEffect(() => {
    if (workspaceId) {
      loadKnowledgeSystems();
    }
  }, [workspaceId]);

  const loadKnowledgeSystems = async () => {
    setLoading(true);
    try {
      let workspaceSystems = getKnowledgeSystems(workspaceId);

      // Initialize default systems if none exist
      if (workspaceSystems.length === 0) {
        initializeWorkspaceKnowledgeSystems(workspaceId);
        workspaceSystems = getKnowledgeSystems(workspaceId);
      }

      setSystems(workspaceSystems);
    } catch (error) {
      console.error('Failed to load knowledge systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSystemToggle = (systemId, enabled) => {
    const updatedSystems = systems.map(system =>
      system.id === systemId
        ? { ...system, enabled }
        : system
    );
    setSystems(updatedSystems);
    setHasUnsavedChanges(true);
  };

  const handleSystemEdit = (system) => {
    navigate(`/workspace/${workspaceSlug}/knowledge/${system.type}/configure`);
  };

  const handleSystemSave = (systemId, updates) => {
    const updatedSystem = updateKnowledgeSystem(systemId, updates);
    if (updatedSystem) {
      setSystems(systems.map(system =>
        system.id === systemId ? updatedSystem : system
      ));
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveAll = () => {
    setHasUnsavedChanges(false);
  };

  const handleDiscardChanges = () => {
    loadKnowledgeSystems();
    setHasUnsavedChanges(false);
  };

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceSlug}/settings`)}
                className="text-slate-200 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </Button>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Knowledge Systems
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              Configure structured knowledge content for your workspace portal
            </p>
          </motion.div>

          {hasUnsavedChanges && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex gap-3"
            >
              <Button variant="outline" onClick={handleDiscardChanges} className="border-slate-600 text-slate-300 hover:bg-slate-800">
                Reset Changes
              </Button>
              <Button onClick={handleSaveAll} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Save All Changes
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Systems Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {systems.map((system, index) => (
            <KnowledgeSystemCard
              key={system.id}
              system={system}
              onToggle={handleSystemToggle}
              onEdit={handleSystemEdit}
              index={index}
            />
          ))}
        </motion.div>

        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertDescription className="text-yellow-200">
                You have unsaved changes. Changes are applied immediately but can be discarded.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </div>

      {editingSystem && (
        <KnowledgeSystemEditor
          system={editingSystem}
          onSave={handleSystemSave}
          onClose={() => setEditingSystem(null)}
        />
      )}
    </div>
  );
}

/**
 * Individual Knowledge System Card - Futuristic Design
 */
function KnowledgeSystemCard({ system, onToggle, onEdit, index }) {
  const config = getKnowledgeSystemConfig(system.type);

  if (!config) {
    return null;
  }

  // Enhanced type-specific visual identity with purpose-driven design
  const getTypeIdentity = (type) => {
    const identities = {
      policy: {
        purpose: 'Authority & Compliance',
        visualTheme: 'Warm Authority',
        accentColor: 'amber',
        description: 'Establish official guidelines and legal requirements'
      },
      procedure: {
        purpose: 'Precision & Workflow',
        visualTheme: 'Cool Structure',
        accentColor: 'cyan',
        description: 'Guide systematic processes and operational excellence'
      },
      documentation: {
        purpose: 'Knowledge & Reference',
        visualTheme: 'Regal Wisdom',
        accentColor: 'purple',
        description: 'Provide comprehensive technical knowledge and insights'
      },
      faq: {
        purpose: 'Help & Accessibility',
        visualTheme: 'Warm Approachable',
        accentColor: 'emerald',
        description: 'Offer clear answers to common questions and concerns'
      },
      decision_tree: {
        purpose: 'Logic & Intelligence',
        visualTheme: 'Electric Analysis',
        accentColor: 'indigo',
        description: 'Navigate complex decisions with structured guidance'
      }
    };
    return identities[type] || {
      purpose: 'Content System',
      visualTheme: 'Neutral',
      accentColor: 'slate',
      description: 'Organized content delivery'
    };
  };

  const identity = getTypeIdentity(system.type);

  // Get appropriate icon from iconography system
  const getPrimaryIcon = (type) => {
    const icons = {
      policy: 'Shield',
      procedure: 'Workflow',
      documentation: 'BookOpen',
      faq: 'MessageCircle',
      decision_tree: 'GitBranch'
    };
    return icons[type] || 'FileText';
  };

  const IconComponent = getPrimaryIcon(system.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: 'easeOut' }}
    >
      <Card system={system.type} animated={false} interactive={true} className="h-full">
        <CardHeader system={system.type} className="pb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <motion.div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${identity.accentColor}-400 to-${identity.accentColor === 'amber' ? 'orange' : identity.accentColor === 'cyan' ? 'blue' : identity.accentColor === 'purple' ? 'violet' : identity.accentColor === 'emerald' ? 'green' : 'purple'}-500 flex items-center justify-center shadow-xl`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-2xl">{config.icon}</span>
              </motion.div>
              <div>
                <h3 className={`text-2xl font-bold mb-1 bg-gradient-to-r from-${identity.accentColor}-100 to-white bg-clip-text text-transparent`}>
                  {config.displayName}
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full bg-${identity.accentColor}-500/20 text-${identity.accentColor}-200 border border-${identity.accentColor}-500/30`}>
                    {identity.purpose}
                  </span>
                </div>
                <p className={`text-${identity.accentColor}-100/80 text-sm leading-relaxed`}>
                  {identity.description}
                </p>
              </div>
            </div>

            <motion.div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                system.enabled
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-slate-600/50 text-slate-400 border border-slate-500/30'
              }`}
              whileHover={{ scale: 1.05 }}
            >
              {system.enabled ? '● Active' : '○ Inactive'}
            </motion.div>
          </div>

          {/* Purpose statement */}
          <div className={`p-4 rounded-xl bg-${identity.accentColor}-500/10 border border-${identity.accentColor}-500/20`}>
            <p className={`text-${identity.accentColor}-100/90 text-sm italic`}>
              "{identity.visualTheme} design for {config.description.toLowerCase()}"
            </p>
          </div>
        </CardHeader>

        <CardContent system={system.type} className="flex-1 flex flex-col">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between mb-6">
            <span className={`text-${identity.accentColor}-100/80 text-sm font-medium`}>
              Enable in Portal
            </span>
            <Switch
              checked={system.enabled}
              onCheckedChange={(checked) => onToggle(system.id, checked)}
              className="data-[state=checked]:bg-white data-[state=checked]:border-white"
            />
          </div>

          {/* System Stats - Enhanced with glass effect */}
          {system.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6"
            >
              <Surface variant="glass-secondary" className="p-4 rounded-lg">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-${identity.accentColor}-200/60 text-sm`}>Title:</span>
                    <span className={`text-${identity.accentColor}-100 font-medium text-sm truncate ml-2`}>
                      {system.title}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-${identity.accentColor}-200/60 text-sm`}>Last Updated:</span>
                    <span className={`text-${identity.accentColor}-200/80 text-sm`}>
                      {new Date(system.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Surface>
            </motion.div>
          )}

          {/* Action Button - Enhanced with type-specific styling */}
          <div className="mt-auto">
            <Button
              onClick={() => onEdit(system)}
              disabled={!system.enabled}
              className={`w-full h-12 text-sm font-medium transition-all duration-300 ${
                system.enabled
                  ? `bg-${identity.accentColor}-500/20 hover:bg-${identity.accentColor}-500/30 text-${identity.accentColor}-100 border border-${identity.accentColor}-500/40 hover:border-${identity.accentColor}-500/60`
                  : 'bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-600/50'
              } backdrop-blur-sm`}
              variant="outline"
            >
              {system.enabled ? '⚙️ Configure System' : '🔒 Enable to Configure'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default KnowledgeSystemsPage;