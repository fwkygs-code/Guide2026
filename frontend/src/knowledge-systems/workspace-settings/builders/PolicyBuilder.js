/**
 * Policy Builder - Authoritative & Formal
 *
 * Structured rich text editor for legal/compliance content.
 * Emphasizes trust, clarity, and official presentation.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, Calendar, Plus, Trash2 } from 'lucide-react';
import RichTextEditor from '../../../components/canvas-builder/RichTextEditor';

/**
 * Policy Builder Interface
 */
function PolicyBuilder({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title || 'Company Policy',
    description: system.description || '',
    effectiveDate: system.content?.effectiveDate || '',
    jurisdiction: system.content?.jurisdiction || '',
    policies: system.content?.policies || []
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updatePolicy = (index, field, value) => {
    const updatedPolicies = [...formData.policies];
    updatedPolicies[index] = {
      ...updatedPolicies[index],
      [field]: value
    };
    updateFormData('policies', updatedPolicies);
  };

  const addPolicy = () => {
    const newPolicy = {
      id: `policy-${Date.now()}`,
      title: '',
      content: '',
      category: '',
      lastUpdated: new Date().toISOString()
    };
    updateFormData('policies', [...formData.policies, newPolicy]);
  };

  const removePolicy = (index) => {
    const updatedPolicies = formData.policies.filter((_, i) => i !== index);
    updateFormData('policies', updatedPolicies);
  };

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      content: {
        effectiveDate: formData.effectiveDate,
        jurisdiction: formData.jurisdiction,
        policies: formData.policies
      }
    });
  };

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
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Save Policy
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
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5" />
                  Policy Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Policy Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter official policy title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
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
                      value={formData.effectiveDate}
                      onChange={(e) => updateFormData('effectiveDate', e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Jurisdiction</Label>
                    <Input
                      value={formData.jurisdiction}
                      onChange={(e) => updateFormData('jurisdiction', e.target.value)}
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
              {formData.policies.length === 0 ? (
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
                formData.policies.map((policy, index) => (
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
            <div className="min-h-[200px] bg-slate-800/30 rounded-md border border-slate-600">
              <RichTextEditor
                content={policy.content}
                onChange={(content) => onUpdate('content', content)}
                placeholder="Enter policy content with clear, authoritative language..."
                className="text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default PolicyBuilder;