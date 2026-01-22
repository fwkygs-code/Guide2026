/**
 * Knowledge System Configuration Page
 *
 * System-level configuration for knowledge systems.
 * NOT for content editing - only for system settings.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Settings, Eye, EyeOff, Users, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import {
  getKnowledgeSystems,
  updateKnowledgeSystem
} from '../models/KnowledgeSystemService';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge System Configuration Page
 */
function KnowledgeSystemConfigPage() {
  const { workspaceSlug, systemType } = useParams();
  const navigate = useNavigate();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  const [system, setSystem] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [accessLevel, setAccessLevel] = useState('all_users');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (workspaceId && systemType) {
      loadSystemData();
    }
  }, [workspaceId, systemType]);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const systems = getKnowledgeSystems(workspaceId);
      const systemData = systems.find(s => s.type === systemType);

      if (!systemData) {
        // System doesn't exist yet, create a default one
        const defaultSystem = {
          id: `${systemType}-${Date.now()}`,
          type: systemType,
          enabled: false,
          title: getDefaultTitle(systemType),
          description: '',
          content: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setSystem(defaultSystem);
        setEnabled(false);
        setVisibility('public');
        setAccessLevel('all_users');
        setDescription('');
      } else {
        setSystem(systemData);
        setEnabled(systemData.enabled || false);
        setVisibility(systemData.visibility || 'public');
        setAccessLevel(systemData.accessLevel || 'all_users');
        setDescription(systemData.description || '');
      }

      const systemConfig = getKnowledgeSystemConfig(systemType);
      setConfig(systemConfig);
    } catch (error) {
      console.error('Failed to load system data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultTitle = (type) => {
    const titles = {
      policy: 'Company Policies',
      procedure: 'Standard Procedures',
      documentation: 'Product Documentation',
      faq: 'Frequently Asked Questions',
      decision_tree: 'Decision Support'
    };
    return titles[type] || `${type.charAt(0).toUpperCase() + type.slice(1)} System`;
  };

  const handleSave = async () => {
    if (!system) return;

    setSaving(true);
    try {
      const updatedSystem = {
        ...system,
        enabled,
        visibility,
        accessLevel,
        description,
        updatedAt: new Date().toISOString()
      };

      updateKnowledgeSystem(workspaceId, system.id, updatedSystem);
      setSystem(updatedSystem);

      // Navigate back to knowledge systems page
      navigate(`/workspace/${workspaceSlug}/knowledge-systems`);
    } catch (error) {
      console.error('Failed to save system configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">System Not Found</h1>
            <p className="text-slate-400 mb-4">
              The knowledge system "{systemType}" is not recognized.
            </p>
            <Button onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}>
              Back to Knowledge Systems
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}
                className="text-slate-200 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Systems
              </Button>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl ${config.iconBg || 'bg-slate-600'}`}>
                  {config.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{config.displayName}</h1>
                  <p className="text-slate-400 text-sm">System Configuration</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/workspace/${workspaceSlug}/knowledge-systems`)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">

          {/* System Status */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings className="w-5 h-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white text-base">Enable System</Label>
                  <p className="text-slate-400 text-sm mt-1">
                    When enabled, this system will be available in your portal and content can be created.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>

              {/* System Health */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div>
                  <Label className="text-white text-base">System Health</Label>
                  <p className="text-slate-400 text-sm mt-1">
                    Current operational status of this knowledge system.
                  </p>
                </div>
                <Badge variant={enabled ? 'default' : 'secondary'} className={enabled ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}>
                  {enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Visibility Settings */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Eye className="w-5 h-5" />
                Visibility & Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Visibility Level */}
              <div>
                <Label className="text-white text-base">Visibility</Label>
                <p className="text-slate-400 text-sm mt-1 mb-3">
                  Control who can see this system in the portal.
                </p>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Public - Visible to everyone
                      </div>
                    </SelectItem>
                    <SelectItem value="authenticated">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Authenticated - Only logged-in users
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4" />
                        Private - Hidden from portal
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Access Level */}
              <div>
                <Label className="text-white text-base">Access Level</Label>
                <p className="text-slate-400 text-sm mt-1 mb-3">
                  Control who can create and edit content in this system.
                </p>
                <Select value={accessLevel} onValueChange={setAccessLevel}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_users">All Users</SelectItem>
                    <SelectItem value="editors_only">Editors Only</SelectItem>
                    <SelectItem value="admins_only">Admins Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* System Description */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5" />
                System Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-white text-base">Description</Label>
                <p className="text-slate-400 text-sm mt-1 mb-3">
                  Provide a description for this knowledge system that will help users understand its purpose.
                </p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Describe the purpose and scope of your ${config.displayName.toLowerCase()}...`}
                  rows={4}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">System Type:</span>
                  <div className="text-white font-medium">{config.displayName}</div>
                </div>
                <div>
                  <span className="text-slate-400">Last Updated:</span>
                  <div className="text-white font-medium">
                    {system ? new Date(system.updatedAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm">
                  {config.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default KnowledgeSystemConfigPage;