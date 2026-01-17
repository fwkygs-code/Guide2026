import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckSquare, Square, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableStepItem = ({ step, index, currentStepIndex, onStepClick, onDeleteStep, selectMode, selectedIds, onToggleSelect, stepsLength, overStepId, activeStepId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const isOver = overStepId === step.id && activeStepId !== step.id;
  const isActive = activeStepId === step.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : isOver ? 0.8 : 1,
    zIndex: isDragging ? 50 : isOver ? 40 : 1,
  };

  return (
    <motion.button
      ref={setNodeRef}
      style={style}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={() => {
        if (selectMode) onToggleSelect?.(step.id);
        else onStepClick(index);
      }}
      className={`group relative z-50 flex flex-col items-center justify-center p-4 rounded-xl transition-all min-w-[180px] ${
        currentStepIndex === index
          ? 'bg-primary text-white shadow-lg scale-105'
          : 'bg-gray-100/80 backdrop-blur-sm text-gray-700 hover:bg-gray-200/80'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
      data-testid={`timeline-step-${index}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className={`w-4 h-4 ${currentStepIndex === index ? 'text-white' : 'text-slate-400'}`} />
      </div>
      <div className="text-xs font-medium mb-1">Step {index + 1}</div>
      <div
        className="text-sm font-semibold max-w-[140px] text-center line-clamp-2"
        title={step.title}
      >
        {step.title}
      </div>

      {currentStepIndex === index && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full"
        />
      )}

      {selectMode && (
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center pointer-events-none">
          {selectedIds.has(step.id) ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
        </div>
      )}

      {onDeleteStep && stepsLength > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this step?')) {
              onDeleteStep(step.id);
            }
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-50"
          data-testid={`timeline-delete-${index}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.button>
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
  overStepId,
  activeStepId,
  insertAfterIndex,
}) => {

  if (steps.length === 0) return null;

  return (
    <div className="relative z-40 border-b border-slate-200 bg-white px-6 py-2">
      <div className="flex items-center gap-3 overflow-x-auto overflow-y-visible min-h-[72px]">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Insertion indicator before this step */}
            {insertAfterIndex === index - 1 && activeStepId && (
              <div className="relative flex items-center justify-center w-2 h-16 z-50">
                <div className="absolute w-1 h-full bg-primary rounded-full shadow-lg animate-pulse" />
                <div className="absolute w-3 h-3 bg-primary rounded-full border-2 border-white shadow-lg" />
              </div>
            )}
            <SortableStepItem
              step={step}
              index={index}
              currentStepIndex={currentStepIndex}
              onStepClick={onStepClick}
              onDeleteStep={onDeleteStep}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              stepsLength={steps.length}
              overStepId={overStepId}
              activeStepId={activeStepId}
            />
            {/* Insertion indicator after this step */}
            {insertAfterIndex === index && activeStepId && (
              <div className="relative flex items-center justify-center w-2 h-16 z-50">
                <div className="absolute w-1 h-full bg-primary rounded-full shadow-lg animate-pulse" />
                <div className="absolute w-3 h-3 bg-primary rounded-full border-2 border-white shadow-lg" />
              </div>
            )}
            {index < steps.length - 1 && insertAfterIndex !== index && (
              <div className={`w-8 h-px transition-colors ${
                insertAfterIndex === index - 1 ? 'bg-primary' : 'bg-slate-300'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepTimeline;