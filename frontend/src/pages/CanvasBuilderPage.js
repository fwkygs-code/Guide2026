import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Eye, Play, ArrowLeft, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';
import LeftSidebar from '../components/canvas-builder/LeftSidebar';
import LiveCanvas from '../components/canvas-builder/LiveCanvas';
import RightInspector from '../components/canvas-builder/RightInspector';
import StepTimeline from '../components/canvas-builder/StepTimeline';
import PreviewMode from '../components/canvas-builder/PreviewMode';

const CanvasBuilderPage = () => {
  const { workspaceId, walkthroughId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!walkthroughId;
  const draftKey = `interguide:draft:${workspaceId}`;
  const isCreatingRef = useRef(false);

  // Core state
  const [walkthrough, setWalkthrough] = useState({
    title: 'Untitled Walkthrough',
    description: '',
    status: 'draft',
    privacy: 'public',
    steps: [],
    category_ids: [],
    navigation_type: 'next_prev',
    navigation_placement: 'bottom'
  });

  const [selectedElement, setSelectedElement] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [categories, setCategories] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(isEditing);

  // Auto-save timer
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, [workspaceId, walkthroughId]);

  // Restore draft for new walkthroughs (prevents losing long edits on refresh)
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return;
      setWalkthrough((prev) => ({ ...prev, ...parsed.data }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, isEditing]);

  // Auto-save on changes
  useEffect(() => {
    if (!isEditing || loading) return;

    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 3000);

    setAutoSaveTimer(timer);

    return () => clearTimeout(timer);
  }, [walkthrough]);

  // Always keep a local draft, and auto-create draft walkthrough on first changes.
  useEffect(() => {
    if (loading) return;

    // Save local draft (both new + edit)
    try {
      localStorage.setItem(draftKey, JSON.stringify({ updatedAt: Date.now(), data: walkthrough }));
    } catch {
      // ignore
    }

    // If it's a new walkthrough, auto-create on first meaningful edits (so uploads/steps don't get lost)
    if (isEditing) return;
    const hasMeaningfulContent =
      (walkthrough.title && walkthrough.title !== 'Untitled Walkthrough') ||
      (walkthrough.description && walkthrough.description.trim().length > 0) ||
      (walkthrough.steps && walkthrough.steps.length > 0);
    if (!hasMeaningfulContent) return;
    if (isCreatingRef.current || isSaving) return;

    const timer = setTimeout(async () => {
      try {
        isCreatingRef.current = true;
        setIsSaving(true);
        await saveWalkthrough(false);
        setLastSaved(new Date());
      } catch (e) {
        // keep local draft; user can still manually save later
        console.error('Auto-create failed:', e);
      } finally {
        setIsSaving(false);
        isCreatingRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [walkthrough, isEditing, loading]);

  const fetchData = async () => {
    try {
      const [wsResponse, catResponse] = await Promise.all([
        api.getWorkspace(workspaceId),
        api.getCategories(workspaceId)
      ]);

      setWorkspace(wsResponse.data);
      setCategories(catResponse.data);

      if (isEditing) {
        const wtResponse = await api.getWalkthrough(workspaceId, walkthroughId);
        setWalkthrough(wtResponse.data);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = useCallback(async () => {
    if (!isEditing || isSaving) return;

    try {
      setIsSaving(true);
      await saveWalkthrough(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [walkthrough, isEditing]);

  const saveWalkthrough = async (showToast = true) => {
    if (isSaving) return;
    setIsSaving(true);
    const data = {
      title: walkthrough.title,
      description: walkthrough.description,
      privacy: walkthrough.privacy,
      category_ids: walkthrough.category_ids,
      navigation_type: walkthrough.navigation_type,
      navigation_placement: walkthrough.navigation_placement,
      status: walkthrough.status
    };

    try {
      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, data);

        // Update steps
        for (const step of walkthrough.steps) {
          if (step.id && !step.isNew) {
            await api.updateStep(workspaceId, walkthroughId, step.id, {
              title: step.title,
              content: step.content,
              media_url: step.media_url,
              media_type: step.media_type,
              common_problems: step.common_problems || [],
              blocks: step.blocks || []
            });
          } else if (step.isNew) {
            await api.addStep(workspaceId, walkthroughId, {
              title: step.title,
              content: step.content,
              media_url: step.media_url,
              media_type: step.media_type,
              common_problems: step.common_problems || [],
              blocks: step.blocks || []
            });
          }
        }

        if (showToast) toast.success('Saved!');
      } else {
        // IMPORTANT: prevent creating multiple empty walkthroughs on repeated clicks
        const response = await api.createWalkthrough(workspaceId, data);
        const newId = response.data.id;

        for (const step of walkthrough.steps) {
          await api.addStep(workspaceId, newId, {
            title: step.title,
            content: step.content,
            media_url: step.media_url,
            media_type: step.media_type,
            common_problems: step.common_problems || [],
            blocks: step.blocks || []
          });
        }

        if (showToast) toast.success('Created!');
        // Once created, clear local draft so refresh doesn't duplicate work
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        navigate(`/workspace/${workspaceId}/walkthroughs/${newId}/edit`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      // IMPORTANT: setState is async; save using the intended status immediately
      const next = { ...walkthrough, status: 'published' };
      setWalkthrough(next);
      await (async () => {
        const data = {
          title: next.title,
          description: next.description,
          privacy: next.privacy,
          category_ids: next.category_ids,
          navigation_type: next.navigation_type,
          navigation_placement: next.navigation_placement,
          status: next.status,
        };

        if (isEditing) {
          await api.updateWalkthrough(workspaceId, walkthroughId, data);

          for (const step of next.steps) {
            if (step.id && !step.isNew) {
              await api.updateStep(workspaceId, walkthroughId, step.id, {
                title: step.title,
                content: step.content,
                media_url: step.media_url,
                media_type: step.media_type,
                common_problems: step.common_problems || [],
                blocks: step.blocks || []
              });
            } else if (step.isNew) {
              await api.addStep(workspaceId, walkthroughId, {
                title: step.title,
                content: step.content,
                media_url: step.media_url,
                media_type: step.media_type,
                common_problems: step.common_problems || [],
                blocks: step.blocks || []
              });
            }
          }
        } else {
          const response = await api.createWalkthrough(workspaceId, data);
          const newId = response.data.id;

          for (const step of next.steps) {
            await api.addStep(workspaceId, newId, {
              title: step.title,
              content: step.content,
              media_url: step.media_url,
              media_type: step.media_type,
              common_problems: step.common_problems || [],
              blocks: step.blocks || []
            });
          }

          navigate(`/workspace/${workspaceId}/walkthroughs/${newId}/edit`);
        }
      })();
      toast.success('Published successfully!');
    } catch (error) {
      toast.error('Failed to publish');
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setWalkthrough((prev) => {
        const oldIndex = prev.steps.findIndex((s) => s.id === active.id);
        const newIndex = prev.steps.findIndex((s) => s.id === over.id);
        return {
          ...prev,
          steps: arrayMove(prev.steps, oldIndex, newIndex).map((s, i) => ({
            ...s,
            order: i
          }))
        };
      });
    }
  };

  const addStep = () => {
    const newStep = {
      id: `temp-${Date.now()}`,
      title: `Step ${walkthrough.steps.length + 1}`,
      content: '<p>Click to edit...</p>',
      media_url: null,
      media_type: null,
      common_problems: [],
      order: walkthrough.steps.length,
      isNew: true
    };

    setWalkthrough({
      ...walkthrough,
      steps: [...walkthrough.steps, newStep]
    });
    setCurrentStepIndex(walkthrough.steps.length);
  };

  const updateStep = (stepId, updates) => {
    setWalkthrough((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      )
    }));
  };

  const deleteStep = async (stepId) => {
    if (walkthrough.steps.length === 1) {
      toast.error('Cannot delete the last step');
      return;
    }

    try {
      // If editing existing walkthrough, delete from server
      if (isEditing && !stepId.startsWith('temp-')) {
        await api.deleteStep(workspaceId, walkthroughId, stepId);
      }

      setWalkthrough((prev) => ({
        ...prev,
        steps: prev.steps.filter((s) => s.id !== stepId)
      }));
      
      if (currentStepIndex >= walkthrough.steps.length - 1) {
        setCurrentStepIndex(Math.max(0, walkthrough.steps.length - 2));
      }
      
      toast.success('Step deleted');
    } catch (error) {
      console.error('Failed to delete step:', error);
      toast.error('Failed to delete step');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (isPreviewMode) {
    return (
      <PreviewMode
        walkthrough={walkthrough}
        onExit={() => setIsPreviewMode(false)}
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col bg-slate-50">
        {/* Top Bar */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs`)}
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              {isSaving && <Clock className="w-4 h-4 text-slate-400 animate-spin" />}
              {lastSaved && !isSaving && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Check className="w-4 h-4 text-success" />
                  Saved {Math.round((new Date() - lastSaved) / 1000)}s ago
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(true)}
              data-testid="preview-button"
            >
              <Play className="w-4 h-4 mr-2" />
              Test Mode
            </Button>

            {walkthrough.status === 'published' && workspace && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/portal/${workspace.slug}`, '_blank')}
                data-testid="view-portal-button"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Portal
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => saveWalkthrough(true)}
              disabled={isSaving}
              data-testid="save-button"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>

            <Button
              size="sm"
              onClick={handlePublish}
              data-testid="publish-button"
              className="bg-success hover:bg-success/90"
            >
              Publish
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <StepTimeline
          steps={walkthrough.steps}
          currentStepIndex={currentStepIndex}
          onStepClick={setCurrentStepIndex}
          onDeleteStep={deleteStep}
        />

        {/* Main Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* Left Sidebar */}
            <LeftSidebar
              walkthrough={walkthrough}
              categories={categories}
              onUpdate={setWalkthrough}
              onAddStep={addStep}
              onStepClick={setCurrentStepIndex}
              onDeleteStep={deleteStep}
              currentStepIndex={currentStepIndex}
            />

            {/* Live Canvas */}
            <LiveCanvas
              walkthrough={walkthrough}
              currentStepIndex={currentStepIndex}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateStep={updateStep}
            />

            {/* Right Inspector */}
            <RightInspector
              selectedElement={selectedElement}
              currentStep={walkthrough.steps[currentStepIndex]}
              onUpdate={(updates) => {
                if (walkthrough.steps[currentStepIndex]) {
                  updateStep(walkthrough.steps[currentStepIndex].id, updates);
                }
              }}
              onDeleteStep={() => {
                if (walkthrough.steps[currentStepIndex]) {
                  deleteStep(walkthrough.steps[currentStepIndex].id);
                }
              }}
            />
          </DndContext>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CanvasBuilderPage;