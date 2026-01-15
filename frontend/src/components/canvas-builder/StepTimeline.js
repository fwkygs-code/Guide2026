import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckSquare, Square } from 'lucide-react';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableStepChip = ({
  id,
  index,
  title,
  active,
  selectMode,
  selected,
  onClick,
  onToggleSelect,
  onDelete,
  canDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`relative z-50 ${isDragging ? 'opacity-60' : ''}`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`group relative z-50 flex flex-col items-center justify-center p-4 rounded-xl transition-all min-w-[180px] select-none ${
          active ? 'bg-primary text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
        data-testid={`timeline-step-${index}`}
      >
        {/* Drag handle area (whole chip) */}
        <div
          className="absolute inset-0 rounded-xl"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        />

        <div className="text-xs font-medium mb-1 pointer-events-none">Step {index + 1}</div>
        <div className="text-sm font-semibold max-w-[140px] text-center line-clamp-2 pointer-events-none" title={title}>
          {title}
        </div>

        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full pointer-events-none"
          />
        )}

        {selectMode && (
          <div
            className="absolute -top-2 -left-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(id);
            }}
          >
            {selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
          </div>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-50"
            data-testid={`timeline-delete-${index}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </button>
    </motion.div>
  );
};

const StepTimeline = ({
  steps,
  currentStepIndex,
  onStepClick,
  onDeleteStep,
  selectMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) => {

  if (steps.length === 0) return null;

  const ids = steps.map((s) => s.id);

  return (
    <div className="relative z-40 bg-transparent px-4 py-3">
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-3 overflow-x-auto overflow-y-visible min-h-[72px] px-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <SortableStepChip
                id={step.id}
                index={index}
                title={step.title}
                active={currentStepIndex === index}
                selectMode={selectMode}
                selected={selectedIds.has(step.id)}
                onToggleSelect={onToggleSelect}
                onClick={() => {
                  if (selectMode) onToggleSelect?.(step.id);
                  else onStepClick(index);
                }}
                canDelete={steps.length > 1}
                onDelete={() => {
                  if (window.confirm('Delete this step?')) {
                    onDeleteStep(step.id);
                  }
                }}
              />
              {index < steps.length - 1 && <div className="w-8 h-px bg-slate-300 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default StepTimeline;