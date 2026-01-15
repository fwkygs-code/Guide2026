import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckSquare, Square } from 'lucide-react';

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

  return (
    <div className="relative z-40 border-b border-slate-200 bg-white px-6 py-2">
      <div className="flex items-center gap-3 overflow-x-auto overflow-y-visible min-h-[72px]">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => {
                if (selectMode) onToggleSelect?.(step.id);
                else onStepClick(index);
              }}
              className={`group relative z-50 flex flex-col items-center justify-center p-4 rounded-xl transition-all min-w-[180px] ${
                currentStepIndex === index
                  ? 'bg-primary text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-testid={`timeline-step-${index}`}
            >
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

              {steps.length > 1 && (
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

            {index < steps.length - 1 && (
              <div className="w-8 h-px bg-slate-300" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepTimeline;