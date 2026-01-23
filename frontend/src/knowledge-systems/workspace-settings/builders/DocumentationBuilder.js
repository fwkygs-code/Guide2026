/**
 * Documentation Builder - Knowledge & Reference
 *
 * Hierarchical documentation editor with sections and subsections.
 * Regal purple theming represents wisdom and comprehensive knowledge.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import RichTextEditor from '../../../components/canvas-builder/RichTextEditor';

/**
 * Documentation Builder Interface
 */
function DocumentationBuilder({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title || 'Product Documentation',
    description: system.description || '',
    sections: system.content?.sections || []
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateSection = (index, field, value) => {
    const updatedSections = [...formData.sections];
    updatedSections[index] = {
      ...updatedSections[index],
      [field]: value
    };
    updateFormData('sections', updatedSections);
  };

  const addSection = () => {
    const newSection = {
      id: `section-${Date.now()}`,
      title: '',
      content: '',
      subsections: [],
      order: formData.sections.length + 1
    };
    updateFormData('sections', [...formData.sections, newSection]);
  };

  const removeSection = (index) => {
    const updatedSections = formData.sections.filter((_, i) => i !== index);
    // Reorder remaining sections
    updatedSections.forEach((section, i) => section.order = i + 1);
    updateFormData('sections', updatedSections);
  };

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      content: {
        sections: formData.sections
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Documentation Builder</h1>
                <p className="text-slate-400 text-sm">Create comprehensive technical documentation</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                Save Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">

          {/* Basic Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5" />
                  Documentation Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Documentation Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter documentation title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this documentation"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Documentation Sections */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Documentation Structure</h2>
                <p className="text-slate-400">Hierarchical sections with subsections for comprehensive knowledge organization</p>
              </div>
              <Button onClick={addSection} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>

            <div className="space-y-6">
              {formData.sections.length === 0 ? (
                <Card className="border-dashed border-slate-600 bg-slate-800/30">
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300 mb-2">No Documentation Sections</h3>
                    <p className="text-slate-500 mb-4">Add structured documentation with hierarchical sections</p>
                    <Button onClick={addSection} variant="outline" className="border-slate-600 text-slate-300">
                      Add First Section
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                formData.sections.map((section, index) => (
                  <DocumentationSection
                    key={section.id}
                    section={section}
                    index={index}
                    onUpdate={(field, value) => updateSection(index, field, value)}
                    onRemove={() => removeSection(index)}
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
 * Individual Documentation Section with Subsections
 */
function DocumentationSection({ section, index, onUpdate, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateSubsection = (subIndex, field, value) => {
    const updatedSubsections = [...section.subsections];
    updatedSubsections[subIndex] = {
      ...updatedSubsections[subIndex],
      [field]: value
    };
    onUpdate('subsections', updatedSubsections);
  };

  const addSubsection = () => {
    const newSubsection = {
      id: `subsection-${Date.now()}`,
      title: '',
      content: '',
      order: section.subsections.length + 1
    };
    onUpdate('subsections', [...section.subsections, newSubsection]);
  };

  const removeSubsection = (subIndex) => {
    const updatedSubsections = section.subsections.filter((_, i) => i !== subIndex);
    // Reorder remaining subsections
    updatedSubsections.forEach((sub, i) => sub.order = i + 1);
    onUpdate('subsections', updatedSubsections);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-slate-800/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 p-0 text-purple-400 hover:bg-purple-500/10"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <CardTitle className="text-white">Section {index + 1}</CardTitle>
                <Badge variant="secondary" className="mt-1 bg-purple-500/20 text-purple-300">
                  Documentation Section
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
              value={section.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="e.g., Getting Started, API Reference, Troubleshooting"
            />
          </div>

          <div>
            <Label className="text-slate-300">Section Content</Label>
            <div className="min-h-[150px] bg-slate-800/30 rounded-md border border-slate-600">
              <RichTextEditor
                content={section.content}
                onChange={(content) => onUpdate('content', content)}
                placeholder="Main content for this section..."
                className="text-white"
              />
            </div>
          </div>

          {/* Subsections */}
          <motion.div
            initial={false}
            animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-purple-500/20 pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-purple-100">Subsections</h4>
                <Button onClick={addSubsection} size="sm" className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-100">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subsection
                </Button>
              </div>

              <div className="space-y-4 ml-6">
                {section.subsections.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-600 rounded-lg">
                    <BookOpen className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No subsections</p>
                    <Button onClick={addSubsection} variant="ghost" size="sm" className="mt-2 text-purple-400">
                      Add Subsection
                    </Button>
                  </div>
                ) : (
                  section.subsections.map((subsection, subIndex) => (
                    <SubsectionItem
                      key={subsection.id}
                      subsection={subsection}
                      index={subIndex}
                      onUpdate={(field, value) => updateSubsection(subIndex, field, value)}
                      onRemove={() => removeSubsection(subIndex)}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Individual Subsection Item
 */
function SubsectionItem({ subsection, index, onUpdate, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-l-2 border-purple-500/30 pl-4 py-2"
    >
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400/50 to-pink-500/50 flex items-center justify-center text-purple-200 font-bold text-xs mt-1">
          {subsection.order}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm">Subsection Title</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-6 w-6 p-0"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <Input
            value={subsection.title}
            onChange={(e) => onUpdate('title', e.target.value)}
            className="bg-slate-800/50 border-slate-600 text-white text-sm"
            placeholder="Subsection title"
          />

          <div>
            <Label className="text-slate-300 text-sm">Content</Label>
            <div className="min-h-[100px] bg-slate-800/30 rounded-md border border-slate-600">
              <RichTextEditor
                content={subsection.content}
                onChange={(content) => onUpdate('content', content)}
                placeholder="Subsection content..."
                className="text-white text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default DocumentationBuilder;