/**
 * FAQ Builder - Help & Accessibility
 *
 * Q&A builder with drag-to-reorder and instant preview.
 * Warm emerald theming represents approachable help and accessibility.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, HelpCircle, Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import RichTextEditor from '../../../components/canvas-builder/RichTextEditor';
import sanitizeHtml from '../../../lib/sanitizeHtml';

/**
 * FAQ Builder Interface
 */
function FAQBuilder({ system, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: system.title || 'Frequently Asked Questions',
    description: system.description || '',
    faqs: system.content?.faqs || []
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [draggedFaq, setDraggedFaq] = useState(null);

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateFaq = (index, field, value) => {
    const updatedFaqs = [...formData.faqs];
    updatedFaqs[index] = {
      ...updatedFaqs[index],
      [field]: value
    };
    updateFormData('faqs', updatedFaqs);
  };

  const addFaq = () => {
    const newFaq = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: '',
      category: '',
      tags: []
    };
    updateFormData('faqs', [...formData.faqs, newFaq]);
  };

  const removeFaq = (index) => {
    const updatedFaqs = formData.faqs.filter((_, i) => i !== index);
    updateFormData('faqs', updatedFaqs);
  };

  const handleDragStart = (e, faqIndex) => {
    setDraggedFaq(faqIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedFaq === null || draggedFaq === dropIndex) return;

    const updatedFaqs = [...formData.faqs];
    const [removed] = updatedFaqs.splice(draggedFaq, 1);
    updatedFaqs.splice(dropIndex, 0, removed);
    updateFormData('faqs', updatedFaqs);
    setDraggedFaq(null);
  };

  const handleSave = () => {
    onSave(system.id, {
      title: formData.title,
      description: formData.description,
      content: {
        faqs: formData.faqs
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">FAQ Builder</h1>
                <p className="text-slate-400 text-sm">Create helpful Q&A content with instant preview</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
                className="border-slate-600 text-slate-300"
              >
                {previewMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {previewMode ? 'Edit Mode' : 'Preview'}
              </Button>
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
                Save FAQs
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
            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <HelpCircle className="w-5 h-5" />
                  FAQ Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">FAQ Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Enter FAQ collection title"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                    placeholder="Brief description of this FAQ collection"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* FAQ Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {previewMode ? 'FAQ Preview' : 'FAQ Editor'}
                </h2>
                <p className="text-slate-400">
                  {previewMode
                    ? 'See how your FAQs will appear to users'
                    : 'Create Q&A pairs with drag-to-reorder functionality'
                  }
                </p>
              </div>
              {!previewMode && (
                <Button onClick={addFaq} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {formData.faqs.length === 0 ? (
                <Card className="border-dashed border-slate-600 bg-slate-800/30">
                  <CardContent className="p-8 text-center">
                    <MessageCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300 mb-2">No FAQs Yet</h3>
                    <p className="text-slate-500 mb-4">Add Q&A pairs to help users find answers quickly</p>
                    <Button onClick={addFaq} variant="outline" className="border-slate-600 text-slate-300">
                      Add First FAQ
                    </Button>
                  </CardContent>
                </Card>
              ) : previewMode ? (
                <FaqPreview faqs={formData.faqs} />
              ) : (
                formData.faqs.map((faq, index) => (
                  <FaqEditorItem
                    key={faq.id}
                    faq={faq}
                    index={index}
                    onUpdate={(field, value) => updateFaq(index, field, value)}
                    onRemove={() => removeFaq(index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
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
 * FAQ Preview Component
 */
function FaqPreview({ faqs }) {
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-slate-800/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border border-emerald-500/20 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full text-left p-4 hover:bg-emerald-500/5 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm font-bold">
                    Q
                  </div>
                  <span className="text-emerald-100 font-medium">
                    {faq.question || `Question ${index + 1}`}
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: expandedFaq === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                </motion.div>
              </button>

              {expandedFaq === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 pb-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                      A
                    </div>
                    <div className="flex-1 text-emerald-50/90 prose prose-sm max-w-none">
                      {faq.answer ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(faq.answer) }} />
                      ) : (
                        <span className="text-slate-500 italic">No answer provided yet</span>
                      )}
                    </div>
                  </div>
                  {faq.category && (
                    <div className="mt-3 ml-9">
                      <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                        {faq.category}
                      </Badge>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual FAQ Editor Item with Drag Support
 */
function FaqEditorItem({ faq, index, onUpdate, onRemove, onDragStart, onDragOver, onDrop }) {
  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group flex gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-emerald-500/30 transition-colors cursor-move"
      whileHover={{ scale: 1.005 }}
    >
      <div className="flex items-center gap-3">
        <div className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div>
          <Label className="text-slate-300 text-sm flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">Q</span>
            </div>
            Question
          </Label>
          <Input
            value={faq.question}
            onChange={(e) => onUpdate('question', e.target.value)}
            className="bg-slate-800/50 border-slate-600 text-white"
            placeholder="What question are users asking?"
          />
        </div>

        <div>
          <Label className="text-slate-300 text-sm flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">A</span>
            </div>
            Answer
          </Label>
          <div className="min-h-[120px] bg-slate-800/30 rounded-md border border-slate-600">
            <RichTextEditor
              content={faq.answer}
              onChange={(content) => onUpdate('answer', content)}
              placeholder="Provide a clear, helpful answer..."
              className="text-white"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label className="text-slate-300 text-sm">Category (Optional)</Label>
            <Input
              value={faq.category}
              onChange={(e) => onUpdate('category', e.target.value)}
              className="bg-slate-800/50 border-slate-600 text-white"
              placeholder="e.g., Getting Started, Billing, Technical"
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default FAQBuilder;