import React, { useState } from 'react';
import { Trash2, Upload, Link as LinkIcon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const API_BASE =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const RightInspector = ({ selectedElement, currentStep, onUpdate, onDeleteStep }) => {
  const [mediaUrl, setMediaUrl] = useState('');
  const [newProblem, setNewProblem] = useState({ title: '', explanation: '' });

  if (!selectedElement || !currentStep) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white p-6">
        <div className="text-center text-slate-400 mt-12">
          <p className="text-sm">Select an element</p>
          <p className="text-xs mt-2">Click on any element in the canvas to edit</p>
        </div>
      </div>
    );
  }

  const handleMediaUpload = async (file) => {
    try {
      const fileType = file.type.split('/')[0];
      const fileName = file.name.toLowerCase();

      let mediaType = 'image';
      if (fileType === 'image' || fileName.endsWith('.gif')) {
        mediaType = 'image';
      } else if (fileType === 'video') {
        mediaType = 'video';
      }

      const response = await api.uploadFile(file);
      const fullUrl = `${API_BASE.replace(/\/$/, '')}${response.data.url}`;

      onUpdate({
        media_url: fullUrl,
        media_type: mediaType
      });

      toast.success('Media uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    }
  };

  const handleMediaUrlSubmit = () => {
    if (!mediaUrl.trim()) return;

    const lowerUrl = mediaUrl.toLowerCase();
    let mediaType = 'image';

    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
      mediaType = 'image';
    } else if (lowerUrl.match(/\.(mp4|webm|mov|avi)$/)) {
      mediaType = 'video';
    } else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      mediaType = 'youtube';
    }

    onUpdate({
      media_url: mediaUrl,
      media_type: mediaType
    });

    setMediaUrl('');
    toast.success('Media added!');
  };

  const addProblem = () => {
    if (!newProblem.title.trim() || !newProblem.explanation.trim()) {
      toast.error('Please fill in both fields');
      return;
    }

    const problems = currentStep.common_problems || [];
    onUpdate({
      common_problems: [...problems, newProblem]
    });

    setNewProblem({ title: '', explanation: '' });
    toast.success('Problem added!');
  };

  const removeProblem = (index) => {
    const problems = currentStep.common_problems || [];
    onUpdate({
      common_problems: problems.filter((_, i) => i !== index)
    });
  };

  // Step-level controls
  if (selectedElement.type === 'step') {
    return (
      <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Step Settings</h3>
          <p className="text-xs text-slate-500">Configure this step</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Navigation */}
          <div>
            <Label className="text-xs text-slate-500 mb-2">Navigation Type</Label>
            <Select
              value={currentStep.navigation_type || 'next_prev'}
              onValueChange={(value) => onUpdate({ navigation_type: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_prev">Next / Previous</SelectItem>
                <SelectItem value="checkoff">Check-off Required</SelectItem>
                <SelectItem value="auto">Auto Advance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delete Step */}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteStep}
            className="w-full"
            data-testid="delete-step-button"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Step
          </Button>
        </div>
      </div>
    );
  }

  // Media controls
  if (selectedElement.type === 'media') {
    return (
      <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Media</h3>
          <p className="text-xs text-slate-500">Replace or remove media</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <Label className="mb-2">Upload New</Label>
            <Input
              type="file"
              accept="image/*,video/*,.gif"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) handleMediaUpload(file);
              }}
              className="text-sm"
            />
          </div>

          <div className="text-center text-xs text-slate-500">or</div>

          <div>
            <Label className="mb-2">URL</Label>
            <div className="flex gap-2">
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
              <Button size="sm" onClick={handleMediaUrlSubmit}>
                <LinkIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate({ media_url: null, media_type: null })}
            className="w-full"
          >
            Remove Media
          </Button>
        </div>
      </div>
    );
  }

  // Content controls
  if (selectedElement.type === 'content') {
    return (
      <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Content</h3>
          <p className="text-xs text-slate-500">Text formatting options</p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Edit text directly in the canvas. Use keyboard shortcuts:
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <div><kbd className="px-2 py-1 bg-slate-100 rounded">Ctrl+B</kbd> Bold</div>
            <div><kbd className="px-2 py-1 bg-slate-100 rounded">Ctrl+I</kbd> Italic</div>
            <div><kbd className="px-2 py-1 bg-slate-100 rounded">Ctrl+U</kbd> Underline</div>
          </div>

          <div className="pt-4 border-t">
            <Label className="mb-2">Add Media Above</Label>
            <Input
              type="file"
              accept="image/*,video/*,.gif"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) handleMediaUpload(file);
              }}
              className="text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  // Problem controls
  if (selectedElement.type === 'problem') {
    return (
      <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Common Problems</h3>
          <p className="text-xs text-slate-500">Help users troubleshoot</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Existing Problems */}
          {currentStep.common_problems && currentStep.common_problems.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs">Existing Problems</Label>
              {currentStep.common_problems.map((problem, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{problem.title}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProblem(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">{problem.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add New Problem */}
          <div className="space-y-3">
            <Label className="text-xs">Add New Problem</Label>
            <Input
              value={newProblem.title}
              onChange={(e) => setNewProblem({ ...newProblem, title: e.target.value })}
              placeholder="Problem title"
              className="text-sm"
            />
            <Textarea
              value={newProblem.explanation}
              onChange={(e) => setNewProblem({ ...newProblem, explanation: e.target.value })}
              placeholder="Solution or explanation"
              rows={3}
              className="text-sm"
            />
            <Button size="sm" onClick={addProblem} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Problem
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default RightInspector;