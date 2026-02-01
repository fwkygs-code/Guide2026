/**
 * Policy Builder - Authoritative & Formal
 *
 * Structured rich text editor for legal/compliance content.
 * Emphasizes trust, clarity, and official presentation.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, Label, Textarea, Card, CardContent, CardHeader, CardTitle, Badge } from '../../../components/ui';
import { Shield, FileText, Calendar, Plus, Trash2, Save, Upload } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useWorkspaceSlug } from '../../hooks/useWorkspaceSlug';
import { getPolicySystem, updatePolicySystem, publishPolicySystemEntry } from '../../models/PolicyService';
import PolicyRichTextEditor from '../../../components/canvas-builder/PolicyRichTextEditor';
import WorkspaceLoader from '../../../components/WorkspaceLoader';

/**
 * Policy Builder Interface - Isolated Draft/Publish System
 */
function PolicyBuilder({ onClose }) {
  const { workspaceSlug, systemType, itemId } = useParams();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);

  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Load system data
  useEffect(() => {
    if (workspaceId && itemId) {
      loadSystem();
    } else if (workspaceId) {
      // Create new system if no itemId
      createNewSystem();
    }
  }, [workspaceId, itemId]);

  const loadSystem = async () => {
    try {
      const systemData = getPolicySystem(itemId);
      if (systemData) {
        setSystem(systemData);
      }
    } catch (error) {
      console.error('Failed to load policy system:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSystem = async () => {
    // For new systems, we'll create them when first saved
    setSystem(null);
    setLoading(false);
  };

  // Draft content management
  const updateDraftContent = (updates) => {
    if (!system) return;

    const updatedSystem = {
      ...system,
      draftContent: {
        ...system.draftContent,
        ...updates
      }
    };

    updatePolicySystem(system.id, { draftContent: updatedSystem.draftContent });
    setSystem(updatedSystem);
  };

  const updatePolicy = (index, field, value) => {
    const updatedPolicies = [...system.draftContent.policies];
    updatedPolicies[index] = {
      ...updatedPolicies[index],
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    updateDraftContent({ policies: updatedPolicies });
  };

  const addPolicy = () => {
    const newPolicy = {
      id: `policy-${Date.now()}`,
      title: '',
      content: '',
      category: '',
      lastUpdated: new Date().toISOString()
    };
    const updatedPolicies = [...system.draftContent.policies, newPolicy];
    updateDraftContent({ policies: updatedPolicies });
  };

  const removePolicy = (index) => {
    const updatedPolicies = system.draftContent.policies.filter((_, i) => i !== index);
    updateDraftContent({ policies: updatedPolicies });
  };

  const handleSaveDraft = async () => {
    if (!system) {
      // Create new system
      const newSystemData = {
        workspaceId,
        title: 'Company Policies'
      };
      const createdSystem = createPolicySystemEntry(newSystemData);
      setSystem(createdSystem);
    }
    // Draft is auto-saved
  };

  const handlePublish = async () => {
    if (!system) return;

    setPublishing(true);
    try {
      const publishedSystem = publishPolicySystemEntry(system.id);
      if (publishedSystem) {
        setSystem(publishedSystem);
        // Could show success message here
      }
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  // For new systems, show initial form
  if (!system) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">Create Policy System</h1>
              <p className="text-slate-400">Set up your authoritative policy documentation system</p>
            </div>
            <Button onClick={handleSaveDraft} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Policy System
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const draftContent = system.draftContent;
  const hasPublishedContent = system.publishedContent !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-amber-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Policy Builder</h1>
                <p className="text-slate-400 text-sm">Create authoritative policy documents</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Close
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <Upload className="w-4 h-4 mr-2" />
                {publishing ? 'Publishing...' : 'Publish to Portal'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">

          {/* Basic Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5" />
                    Policy Information
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {hasPublishedContent ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        Published
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                        Draft
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Policy Title</Label>
                  <Input
                    value={draftContent.title}
                    onChange={(e) => updateDraftContent({ title: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter official policy title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={draftContent.description}
                    onChange={(e) => updateDraftContent({ description: e.target.value })}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this policy"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Effective Date
                    </Label>
                    <Input
                      type="date"
                      value={draftContent.effectiveDate}
                      onChange={(e) => updateDraftContent({ effectiveDate: e.target.value })}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Jurisdiction</Label>
                    <Input
                      value={draftContent.jurisdiction}
                      onChange={(e) => updateDraftContent({ jurisdiction: e.target.value })}
                      className="bg-slate-800/50 border-slate-600 text-white"
                      placeholder="e.g., Global, United States"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Policy Sections */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Policy Sections</h2>
                <p className="text-slate-400">Structured legal content with clear sections</p>
              </div>
              <Button onClick={addPolicy} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>

            <div className="space-y-6">
              {draftContent.policies.length === 0 ? (
                <Card className="border-dashed border-slate-600 bg-slate-800/30">
                  <CardContent className="p-8 text-center">
                    <Shield className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300 mb-2">No Policy Sections</h3>
                    <p className="text-slate-500 mb-4">Add structured policy content to establish clear guidelines</p>
                    <Button onClick={addPolicy} variant="outline" className="border-slate-600 text-slate-300">
                      Add First Section
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                draftContent.policies.map((policy, index) => (
                  <PolicySectionCard
                    key={policy.id}
                    policy={policy}
                    index={index}
                    onUpdate={(field, value) => updatePolicy(index, field, value)}
                    onRemove={() => removePolicy(index)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Policy Section Card
 */
function PolicySectionCard({ policy, index, onUpdate, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-slate-800/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <CardTitle className="text-white">Section {index + 1}</CardTitle>
                <Badge variant="secondary" className="mt-1 bg-amber-500/20 text-amber-300">
                  Policy Content
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-300">Section Title</Label>
            <Input
              value={policy.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="e.g., Purpose, Scope, Definitions"
            />
          </div>

          <div>
            <Label className="text-slate-300">Category (Optional)</Label>
            <Input
              value={policy.category}
              onChange={(e) => onUpdate('category', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="e.g., HR, Security, Compliance"
            />
          </div>

          <div>
            <Label className="text-slate-300">Content</Label>
            <PolicyRichTextEditor
              content={policy.content}
              onChange={(content) => onUpdate('content', content)}
              placeholder="Enter policy content with clear, authoritative language..."
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default PolicyBuilder;