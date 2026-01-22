/**
 * Knowledge Systems Workspace Settings Page
 *
 * Isolated page for managing workspace knowledge systems.
 * Allows enabling/disabling systems and editing their content.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import {
  getKnowledgeSystems,
  updateKnowledgeSystem,
  initializeWorkspaceKnowledgeSystems
} from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig, getAvailableKnowledgeSystemTypes } from '../registry/KnowledgeSystemRegistry';
import KnowledgeSystemEditor from './KnowledgeSystemEditor';

/**
 * Main Knowledge Systems Settings Page
 */
function KnowledgeSystemsPage() {
  const { workspaceSlug } = useParams();
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
    // All changes are already saved to the service
    // Just reset the unsaved changes flag
    setHasUnsavedChanges(false);
  };

  const handleDiscardChanges = () => {
    // Reload from storage to discard unsaved changes
    loadKnowledgeSystems();
    setHasUnsavedChanges(false);
  };

  if (workspaceLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Systems</h1>
          <p className="text-muted-foreground">
            Configure knowledge content for your workspace portal
          </p>
        </div>

        {hasUnsavedChanges && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDiscardChanges}>
              Discard Changes
            </Button>
            <Button onClick={handleSaveAll}>
              Save All Changes
            </Button>
          </div>
        )}
      </div>

      {hasUnsavedChanges && (
        <Alert>
          <AlertDescription>
            You have unsaved changes. Click "Save All Changes" to apply them, or "Discard Changes" to revert.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {systems.map(system => (
          <KnowledgeSystemCard
            key={system.id}
            system={system}
            onToggle={handleSystemToggle}
            onEdit={handleSystemEdit}
          />
        ))}
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
 * Individual Knowledge System Card
 */
function KnowledgeSystemCard({ system, onToggle, onEdit }) {
  const config = getKnowledgeSystemConfig(system.type);

  if (!config) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.displayName}
                {system.enabled && (
                  <Badge variant="secondary">Enabled</Badge>
                )}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor={`toggle-${system.id}`} className="text-sm">
                Enable
              </label>
              <Switch
                id={`toggle-${system.id}`}
                checked={system.enabled}
                onCheckedChange={(checked) => onToggle(system.id, checked)}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => onEdit(system)}
              disabled={!system.enabled}
            >
              Configure
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Title:</span>
            <span className="font-medium">{system.title}</span>
          </div>

          {system.description && (
            <div className="flex justify-between text-sm">
              <span>Description:</span>
              <span className="text-muted-foreground">{system.description}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span>Visibility:</span>
            <span className="capitalize">{system.visibility}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Last Updated:</span>
            <span className="text-muted-foreground">
              {new Date(system.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default KnowledgeSystemsPage;