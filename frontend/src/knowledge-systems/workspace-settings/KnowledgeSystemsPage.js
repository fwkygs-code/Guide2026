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
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';
import KnowledgeSystemEditor from './KnowledgeSystemEditor';

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
    setEditingSystem(system);
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

  // Type-specific visual styling
  const getTypeStyling = (type) => {
    switch (type) {
      case 'policy':
        return {
          gradient: 'from-amber-500/20 via-red-500/10 to-slate-800',
          border: 'border-amber-500/30',
          glow: 'shadow-amber-500/20',
          iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
      case 'procedure':
        return {
          gradient: 'from-blue-500/20 via-cyan-500/10 to-slate-800',
          border: 'border-blue-500/30',
          glow: 'shadow-blue-500/20',
          iconBg: 'bg-gradient-to-br from-blue-400 to-cyan-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
      case 'documentation':
        return {
          gradient: 'from-purple-500/20 via-pink-500/10 to-slate-800',
          border: 'border-purple-500/30',
          glow: 'shadow-purple-500/20',
          iconBg: 'bg-gradient-to-br from-purple-400 to-pink-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
      case 'faq':
        return {
          gradient: 'from-green-500/20 via-emerald-500/10 to-slate-800',
          border: 'border-green-500/30',
          glow: 'shadow-green-500/20',
          iconBg: 'bg-gradient-to-br from-green-400 to-emerald-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
      case 'decision_tree':
        return {
          gradient: 'from-indigo-500/20 via-violet-500/10 to-slate-800',
          border: 'border-indigo-500/30',
          glow: 'shadow-indigo-500/20',
          iconBg: 'bg-gradient-to-br from-indigo-400 to-violet-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
      default:
        return {
          gradient: 'from-slate-500/20 to-slate-800',
          border: 'border-slate-500/30',
          glow: 'shadow-slate-500/20',
          iconBg: 'bg-slate-500',
          statusColor: system.enabled ? 'text-green-400' : 'text-slate-500'
        };
    }
  };

  const styling = getTypeStyling(system.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className={`relative overflow-hidden border ${styling.border} bg-gradient-to-br ${styling.gradient} backdrop-blur-sm ${styling.glow} hover:shadow-2xl transition-all duration-300 group`}>
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        <CardContent className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${styling.iconBg} flex items-center justify-center text-white text-xl shadow-lg`}>
                {config.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{config.displayName}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{config.description}</p>
              </div>
            </div>

            <div className={`text-sm font-medium ${styling.statusColor}`}>
              {system.enabled ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-300 text-sm">Enable in Portal</span>
            <Switch
              checked={system.enabled}
              onCheckedChange={(checked) => onToggle(system.id, checked)}
              className="data-[state=checked]:bg-white data-[state=checked]:border-white"
            />
          </div>

          {/* System Stats */}
          {system.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 mb-4 pt-4 border-t border-white/20"
            >
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Title:</span>
                <span className="text-white font-medium truncate ml-2">{system.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Last Updated:</span>
                <span className="text-slate-300">{new Date(system.updatedAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          )}

          {/* Action Button */}
          <Button
            onClick={() => onEdit(system)}
            disabled={!system.enabled}
            className={`w-full ${system.enabled
              ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            } transition-all duration-200`}
            variant="outline"
          >
            {system.enabled ? 'Configure System' : 'Enable to Configure'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default KnowledgeSystemsPage;