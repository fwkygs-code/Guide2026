import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const StepTimeline = ({ steps, currentStepIndex, onStepClick, onDeleteStep }) => {
  if (steps.length === 0) return null;

  return (
    <div className="h-20 border-b border-slate-200 bg-white px-6 flex items-center overflow-x-auto">
      <div className="flex items-center gap-3">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => onStepClick(index)}
              className={`group relative flex flex-col items-center justify-center p-4 rounded-xl transition-all min-w-[120px] ${
                currentStepIndex === index
                  ? 'bg-primary text-white shadow-lg scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-testid={`timeline-step-${index}`}
            >
              <div className="text-xs font-medium mb-1">Step {index + 1}</div>
              <div className="text-sm font-semibold truncate max-w-[100px]">
                {step.title}
              </div>

              {currentStepIndex === index && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full"
                />
              )}

              {steps.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this step?')) {
                      onDeleteStep(step.id);
                    }
                  }}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
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