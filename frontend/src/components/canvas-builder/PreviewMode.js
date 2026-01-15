import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const PreviewMode = ({ walkthrough, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const step = walkthrough.steps[currentStep];
  const progress = ((currentStep + 1) / walkthrough.steps.length) * 100;

  const handleNext = () => {
    if (currentStep < walkthrough.steps.length - 1) {
      setCompletedSteps(new Set([...completedSteps, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Preview Header */}
      <div className="h-16 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">🎭 Test Mode</span>
          <div className="text-sm text-slate-400">
            Step {currentStep + 1} of {walkthrough.steps.length}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-white hover:bg-slate-700"
          data-testid="exit-preview"
        >
          <X className="w-4 h-4 mr-2" />
          Exit Test Mode
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-800">
        <Progress value={progress} className="h-full" />
      </div>

      {/* Preview Canvas */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-2xl p-12"
            >
              <h1 className="text-4xl font-heading font-bold text-slate-900 mb-8">
                {step?.title}
              </h1>

              {step?.media_url && (
                <div className="mb-8 rounded-lg overflow-hidden">
                  {step.media_type === 'image' && (
                    <img src={step.media_url} alt={step.title} className="w-full rounded-lg" />
                  )}
                  {step.media_type === 'video' && (
                    <video src={step.media_url} controls className="w-full rounded-lg" />
                  )}
                  {step.media_type === 'youtube' && (
                    <div className="aspect-video">
                      <iframe
                        src={step.media_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              <div
                className="prose prose-lg max-w-none text-slate-700 mb-8"
                dangerouslySetInnerHTML={{ __html: step?.content }}
              />

              {step?.common_problems && step.common_problems.length > 0 && (
                <div className="mt-8 space-y-3">
                  <h3 className="text-sm font-medium text-slate-500">Common Problems</h3>
                  {step.common_problems.map((problem, index) => (
                    <div
                      key={index}
                      className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <h4 className="font-medium text-amber-900 mb-1">{problem.title}</h4>
                      <p className="text-sm text-amber-700">{problem.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-8 border-t border-slate-200 mt-8">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  data-testid="preview-previous"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={currentStep === walkthrough.steps.length - 1}
                  data-testid="preview-next"
                >
                  {currentStep === walkthrough.steps.length - 1 ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PreviewMode;
