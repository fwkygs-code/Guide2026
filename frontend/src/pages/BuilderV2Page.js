import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Eye, Clock, Check, ArrowLeft, Undo2, Redo2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Builder V2 - Clean, stable, creation-first walkthrough builder
 * 
 * LAYOUT CONTRACT:
 * - 100vw × 100vh viewport, no page scroll
 * - Top Command Bar (fixed height, never scrolls)
 * - Step Navigator (left, fixed width, no scroll)
 * - Canvas Stage (center, ONLY scrollable area)
 * - Inspector Panel (right, fixed width, no scroll)
 */
const BuilderV2Page = () => {
  const { t } = useTranslation();
  const { workspaceId, walkthroughId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!walkthroughId;

  // Core state
  const [walkthrough, setWalkthrough] = useState({
    title: 'Untitled Walkthrough',
    description: '',
    status: 'draft',
    privacy: 'public',
    steps: [],
    category_ids: [],
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [loading, setLoading] = useState(isEditing);

  // Load walkthrough if editing
  useEffect(() => {
    if (isEditing && walkthroughId) {
      const loadWalkthrough = async () => {
        try {
          setLoading(true);
          const response = await api.getWalkthrough(workspaceId, walkthroughId);
          setWalkthrough(response.data);
          if (response.data.steps && response.data.steps.length > 0) {
            setCurrentStepIndex(0);
          }
        } catch (error) {
          toast.error('Failed to load walkthrough');
          navigate(`/workspace/${workspaceId}/walkthroughs`);
        } finally {
          setLoading(false);
        }
      };
      loadWalkthrough();
    }
  }, [isEditing, walkthroughId, workspaceId, navigate]);

  // Save walkthrough
  const saveWalkthrough = async () => {
    try {
      setIsSaving(true);
      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, walkthrough);
      } else {
        const response = await api.createWalkthrough(workspaceId, walkthrough);
        navigate(`/workspace/${workspaceId}/walkthroughs/${response.data.id}/edit`);
        toast.success('Walkthrough created');
      }
      setLastSaved(new Date());
      toast.success(t('builder.saved'));
    } catch (error) {
      toast.error('Failed to save walkthrough');
    } finally {
      setIsSaving(false);
    }
  };

  // Switch to classic builder
  const switchToClassic = () => {
    if (walkthroughId) {
      navigate(`/workspace/${workspaceId}/walkthroughs/${walkthroughId}/edit`);
    } else {
      navigate(`/workspace/${workspaceId}/walkthroughs/new`);
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentStep = walkthrough.steps[currentStepIndex] || null;

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Zone 1: Top Command Bar (Fixed Height) */}
      <div className="h-14 flex-shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          
          <div className="h-6 w-px bg-slate-200" />
          
          <div className="flex items-center gap-2">
            {isSaving && <Clock className="w-4 h-4 text-slate-400 animate-spin" />}
            {lastSaved && !isSaving && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Check className="w-4 h-4 text-green-600" />
                Saved {Math.round((new Date() - lastSaved) / 1000)}s ago
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled
            title="Undo (coming soon)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            disabled
            title="Redo (coming soon)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/portal/${workspaceId}/${walkthroughId || 'preview'}`)}
            target="_blank"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>

          <Button
            size="sm"
            onClick={saveWalkthrough}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {t('common.save')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={switchToClassic}
          >
            Classic Builder
          </Button>
        </div>
      </div>

      {/* Main Layout: 3 Zones */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Zone 2: Step Navigator (Left - Fixed Width, No Scroll) */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Steps</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            {walkthrough.steps.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                No steps yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {walkthrough.steps.map((step, index) => (
                  <div
                    key={step.id || index}
                    className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                      currentStepIndex === index ? 'bg-slate-100 border-l-2 border-primary' : ''
                    }`}
                    onClick={() => setCurrentStepIndex(index)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-slate-500 w-6 flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {step.title || `Step ${index + 1}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zone 3: Canvas Stage (Center - ONLY Scrollable Area) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 min-w-0">
          <div className="min-h-full flex items-start justify-center py-16 px-8">
            <div className="w-full max-w-[920px] bg-white rounded-lg shadow-sm border border-slate-200 min-h-[600px] p-12">
              {currentStep ? (
                <div className="space-y-6">
                  <h1 className="text-3xl font-heading font-bold text-slate-900">
                    {currentStep.title || 'Untitled Step'}
                  </h1>
                  
                  {currentStep.blocks && currentStep.blocks.length > 0 ? (
                    <div className="space-y-4">
                      {currentStep.blocks.map((block, blockIndex) => (
                        <div key={block.id || blockIndex} className="relative group">
                          <div
                            className={`p-4 rounded-lg border-2 transition-colors ${
                              selectedBlockId === block.id
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent hover:border-slate-200'
                            }`}
                            onClick={() => setSelectedBlockId(block.id)}
                          >
                            <div className="text-slate-600">
                              {block.type}: {JSON.stringify(block.data).substring(0, 50)}...
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-sm">Add blocks to start building</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-sm">Select a step or create a new one</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zone 4: Inspector Panel (Right - Fixed Width, No Scroll) */}
        <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedBlockId ? 'Block Settings' : currentStep ? 'Step Settings' : 'Inspector'}
            </h2>
          </div>
          <div className="flex-1 p-4">
            {selectedBlockId ? (
              <div className="text-sm text-slate-600">
                Block inspector (coming soon)
              </div>
            ) : currentStep ? (
              <div className="text-sm text-slate-600">
                Step inspector (coming soon)
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">
                Select a step or block to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuilderV2Page;
