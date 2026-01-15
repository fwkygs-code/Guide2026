import React from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, CheckSquare, Square } from 'lucide-react';

const StepTimeline = ({ steps, currentStepIndex, onStepClick, onDeleteStep, onDeleteSteps }) => {
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());

  React.useEffect(() => {
    // If steps change (deleted), remove stale selections
    setSelected((prev) => {
      const ids = new Set(steps.map((s) => s.id));
      const next = new Set();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next;
    });
  }, [steps]);

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(steps.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected steps?`)) return;
    await onDeleteSteps?.(ids);
    clearAll();
    setSelectMode(false);
  };

  if (steps.length === 0) return null;

  return (
    <div className="h-20 border-b border-slate-200 bg-white px-6 flex items-center gap-4 overflow-x-auto overflow-y-visible">
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setSelectMode((v) => !v);
            clearAll();
          }}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700"
          data-testid="timeline-select-toggle"
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
        {selectMode && (
          <>
            <button
              type="button"
              onClick={selected.size === steps.length ? clearAll : selectAll}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 flex items-center gap-2"
              data-testid="timeline-select-all"
            >
              {selected.size === steps.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selected.size === steps.length ? 'Unselect all' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className={`text-sm px-3 py-2 rounded-lg border flex items-center gap-2 ${
                selected.size === 0
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-red-200 text-red-700 hover:border-red-300'
              }`}
              data-testid="timeline-delete-selected"
            >
              <Trash2 className="w-4 h-4" />
              Delete selected
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => {
                if (selectMode) toggleSelected(step.id);
                else onStepClick(index);
              }}
              className={`group relative flex flex-col items-center justify-center p-4 rounded-xl transition-all min-w-[160px] ${
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
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center">
                  {selected.has(step.id) ? (
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
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10"
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