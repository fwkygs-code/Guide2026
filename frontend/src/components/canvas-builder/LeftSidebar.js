import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LeftSidebar = ({ walkthrough, categories, onUpdate, onAddStep, onStepClick, currentStepIndex, onDeleteStep }) => {
  return (
    <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
      {/* Walkthrough Info */}
      <div className="p-6 border-b border-slate-200">
        <Input
          value={walkthrough.title}
          onChange={(e) => onUpdate({ ...walkthrough, title: e.target.value })}
          className="text-lg font-heading font-semibold mb-3 border-0 px-0 focus-visible:ring-0"
          placeholder="Walkthrough title"
          data-testid="walkthrough-title"
        />
        
        <textarea
          value={walkthrough.description || ''}
          onChange={(e) => onUpdate({ ...walkthrough, description: e.target.value })}
          className="w-full text-sm text-slate-600 resize-none border-0 px-0 focus:outline-none"
          placeholder="Add description..."
          rows={2}
          data-testid="walkthrough-description"
        />

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Privacy</label>
            <Select
              value={walkthrough.privacy}
              onValueChange={(value) => onUpdate({ ...walkthrough, privacy: value })}
            >
              <SelectTrigger className="h-9" data-testid="privacy-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="password">Password Protected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Status</label>
            <Badge variant={walkthrough.status === 'published' ? 'default' : 'secondary'}>
              {walkthrough.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-700">Steps</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={onAddStep}
              data-testid="add-step-sidebar"
              className="h-7 px-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {walkthrough.steps.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                isActive={currentStepIndex === index}
                onClick={() => onStepClick(index)}
                onDelete={() => onDeleteStep(step.id)}
              />
            ))}

            {walkthrough.steps.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No steps yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StepItem = ({ step, index, isActive, onClick, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-primary/10 border-2 border-primary'
          : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
      }`}
      data-testid={`step-item-${index}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      <div className="flex-1 min-w-0" onClick={onClick}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
          <span className="text-sm font-medium text-slate-900 truncate">
            {step.title}
          </span>
        </div>
        {step.blocks && step.blocks.length > 0 && (
          <span className="text-xs text-slate-400">{step.blocks.length} blocks</span>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Delete this step?')) {
            onDelete();
          }
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
        data-testid={`delete-step-${index}`}
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    </div>
  );
};

export default LeftSidebar;