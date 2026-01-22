/**
 * Knowledge System Editor
 *
 * Modal dialog for editing individual knowledge system content.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VISIBILITY_OPTIONS } from '../models/KnowledgeSystem';
import { getKnowledgeSystemConfig } from '../registry/KnowledgeSystemRegistry';

/**
 * Knowledge System Editor Modal
 */
function KnowledgeSystemEditor({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title,
    description: system.description,
    visibility: system.visibility,
    content: { ...system.content }
  });

  const config = getKnowledgeSystemConfig(system.type);

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      visibility: formData.visibility,
      content: formData.content
    });
    onClose();
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateContent = (contentField, value) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [contentField]: value
      }
    }));
  };

  if (!config) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            Edit {config.displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                  placeholder={`Enter ${config.displayName.toLowerCase()} title`}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder={`Describe your ${config.displayName.toLowerCase()}`}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => updateFormData('visibility', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VISIBILITY_OPTIONS.INTERNAL}>
                      Internal Only
                    </SelectItem>
                    <SelectItem value={VISIBILITY_OPTIONS.PORTAL}>
                      Portal + Internal
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <KnowledgeSystemContentEditor
            systemType={system.type}
            content={formData.content}
            onChange={updateContent}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Content Editor for different knowledge system types
 */
function KnowledgeSystemContentEditor({ systemType, content, onChange }) {
  switch (systemType) {
    case 'policy':
      return <PolicyContentEditor content={content} onChange={onChange} />;
    case 'procedure':
      return <ProcedureContentEditor content={content} onChange={onChange} />;
    case 'documentation':
      return <DocumentationContentEditor content={content} onChange={onChange} />;
    case 'faq':
      return <FAQContentEditor content={content} onChange={onChange} />;
    case 'decision_tree':
      return <DecisionTreeContentEditor content={content} onChange={onChange} />;
    default:
      return (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Content editor not available for this system type.
          </CardContent>
        </Card>
      );
  }
}

/**
 * Policy Content Editor
 */
function PolicyContentEditor({ content, onChange }) {
  const policies = content.policies || [];

  const addPolicy = () => {
    const newPolicy = {
      id: `policy-${Date.now()}`,
      title: '',
      content: '',
      category: '',
      lastUpdated: new Date().toISOString()
    };
    onChange('policies', [...policies, newPolicy]);
  };

  const updatePolicy = (index, field, value) => {
    const updatedPolicies = [...policies];
    updatedPolicies[index] = {
      ...updatedPolicies[index],
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    onChange('policies', updatedPolicies);
  };

  const removePolicy = (index) => {
    const updatedPolicies = policies.filter((_, i) => i !== index);
    onChange('policies', updatedPolicies);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Policies</CardTitle>
          <Button onClick={addPolicy}>Add Policy</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {policies.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No policies added yet. Click "Add Policy" to get started.
          </p>
        ) : (
          policies.map((policy, index) => (
            <div key={policy.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Policy {index + 1}</h4>
                <Button variant="outline" size="sm" onClick={() => removePolicy(index)}>
                  Remove
                </Button>
              </div>

              <div>
                <Label>Title</Label>
                <Input
                  value={policy.title}
                  onChange={(e) => updatePolicy(index, 'title', e.target.value)}
                  placeholder="Policy title"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={policy.category}
                  onChange={(e) => updatePolicy(index, 'category', e.target.value)}
                  placeholder="e.g., HR, Security, Legal"
                />
              </div>

              <div>
                <Label>Content</Label>
                <Textarea
                  value={policy.content}
                  onChange={(e) => updatePolicy(index, 'content', e.target.value)}
                  placeholder="Policy content and requirements"
                  rows={4}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Procedure Content Editor
 */
function ProcedureContentEditor({ content, onChange }) {
  const procedures = content.procedures || [];

  const addProcedure = () => {
    const newProcedure = {
      id: `procedure-${Date.now()}`,
      title: '',
      steps: [],
      category: '',
      lastUpdated: new Date().toISOString()
    };
    onChange('procedures', [...procedures, newProcedure]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Procedures</CardTitle>
          <Button onClick={addProcedure}>Add Procedure</Button>
        </div>
      </CardHeader>
      <CardContent>
        {procedures.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No procedures added yet. Click "Add Procedure" to get started.
          </p>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Procedure editor coming soon...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Documentation Content Editor
 */
function DocumentationContentEditor({ content, onChange }) {
  const sections = content.sections || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Documentation</CardTitle>
      </CardHeader>
      <CardContent>
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No documentation sections added yet.
          </p>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Documentation editor coming soon...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * FAQ Content Editor
 */
function FAQContentEditor({ content, onChange }) {
  const faqs = content.faqs || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">FAQs</CardTitle>
      </CardHeader>
      <CardContent>
        {faqs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No FAQs added yet.
          </p>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            FAQ editor coming soon...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Decision Tree Content Editor
 */
function DecisionTreeContentEditor({ content, onChange }) {
  const trees = content.trees || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Decision Trees</CardTitle>
      </CardHeader>
      <CardContent>
        {trees.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No decision trees added yet.
          </p>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Decision tree editor coming soon...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default KnowledgeSystemEditor;