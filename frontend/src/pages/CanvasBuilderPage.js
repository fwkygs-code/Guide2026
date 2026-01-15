import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Eye, Play, ArrowLeft, Clock, Check, History, Trash2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectStepsMode, setSelectStepsMode] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState(new Set());
  const [isPublishing, setIsPublishing] = useState(false);

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

  // Always keep a local draft, and auto-create draft walkthrough on first changes.
  useEffect(() => {
    if (loading) return;

    // Save local draft (both new + edit)
    try {
      // Never persist portal passwords into localStorage drafts
      const { password, ...draftWalkthrough } = walkthrough;
      localStorage.setItem(draftKey, JSON.stringify({ updatedAt: Date.now(), data: draftWalkthrough }));
    } catch {
      // ignore
    }
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

  const saveWalkthrough = async (showToast = true) => {
    if (isSaving || isPublishing) return;
    setIsSaving(true);
    const data = {
      title: walkthrough.title,
      description: walkthrough.description,
      privacy: walkthrough.privacy,
      password: walkthrough.privacy === 'password' ? walkthrough.password : undefined,
      category_ids: walkthrough.category_ids,
      navigation_type: walkthrough.navigation_type,
      navigation_placement: walkthrough.navigation_placement,
      status: walkthrough.status
    };

    try {
      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, data);

        // Update steps
        const nextSteps = [...(walkthrough.steps || [])];
        for (let i = 0; i < nextSteps.length; i++) {
          const step = nextSteps[i];
          if (step.id && !step.isNew) {
            await api.updateStep(workspaceId, walkthroughId, step.id, {
              title: step.title,
              content: step.content,
              media_url: step.media_url,
              media_type: step.media_type,
              navigation_type: step.navigation_type || 'next_prev',
              common_problems: step.common_problems || [],
              blocks: step.blocks || []
            });
          } else if (step.isNew) {
            const res = await api.addStep(workspaceId, walkthroughId, {
              title: step.title,
              content: step.content,
              media_url: step.media_url,
              media_type: step.media_type,
              navigation_type: step.navigation_type || 'next_prev',
              order: step.order,
              common_problems: step.common_problems || [],
              blocks: step.blocks || []
            });
            // IMPORTANT: mark as persisted so future saves don't re-add duplicates
            nextSteps[i] = { ...step, id: res.data.id, isNew: false };
          }
        }
        // If we persisted any new steps, update local state to prevent duplicates.
        setWalkthrough((prev) => ({ ...prev, steps: nextSteps }));

        // Persist step ordering (only after all steps have real IDs)
        const persistedIds = nextSteps.map((s) => s.id).filter((id) => id && !id.startsWith('temp-'));
        if (persistedIds.length === nextSteps.length) {
          await api.reorderSteps(workspaceId, walkthroughId, persistedIds);
        }

        if (showToast) toast.success('Saved!');
        setLastSaved(new Date());
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
            navigation_type: step.navigation_type || 'next_prev',
            common_problems: step.common_problems || [],
            blocks: step.blocks || []
          });
        }

        if (showToast) toast.success('Created!');
        setLastSaved(new Date());
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

  const openVersions = async () => {
    if (!isEditing) return;
    setShowVersions(true);
    setVersionsLoading(true);
    try {
      const res = await api.getWalkthroughVersions(workspaceId, walkthroughId);
      setVersions(res.data || []);
    } catch (e) {
      toast.error('Failed to load versions');
    } finally {
      setVersionsLoading(false);
    }
  };

  const rollbackToVersion = async (versionNumber) => {
    const ok = window.confirm(`Rollback to version ${versionNumber}? This will overwrite the current draft.`);
    if (!ok) return;
    try {
      const res = await api.rollbackWalkthrough(workspaceId, walkthroughId, versionNumber);
      setWalkthrough(res.data);
      toast.success(`Rolled back to version ${versionNumber}`);
      setShowVersions(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Rollback failed');
    }
  };

  const handlePublish = async () => {
    if (isSaving || isPublishing) return;
    try {
      setIsPublishing(true);
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
    } finally {
      setIsPublishing(false);
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

  // Insert a step at a specific position (e.g. between two steps)
  const insertStepAt = (index) => {
    const clamped = Math.max(0, Math.min(index, walkthrough.steps.length));
    const newStep = {
      id: `temp-${Date.now()}`,
      title: `Step ${walkthrough.steps.length + 1}`,
      content: '<p>Click to edit...</p>',
      media_url: null,
      media_type: null,
      navigation_type: 'next_prev',
      common_problems: [],
      order: clamped,
      isNew: true
    };

    const nextSteps = [
      ...walkthrough.steps.slice(0, clamped),
      newStep,
      ...walkthrough.steps.slice(clamped)
    ].map((s, i) => ({ ...s, order: i }));

    setWalkthrough((prev) => ({ ...prev, steps: nextSteps }));
    setCurrentStepIndex(clamped);
  };

  const addStep = () => {
    const newStep = {
      id: `temp-${Date.now()}`,
      title: `Step ${walkthrough.steps.length + 1}`,
      content: '<p>Click to edit...</p>',
      media_url: null,
      media_type: null,
      navigation_type: 'next_prev',
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

  const deleteSteps = async (stepIds) => {
    const unique = Array.from(new Set(stepIds || []));
    if (unique.length === 0) return;

    if (walkthrough.steps.length - unique.length < 1) {
      toast.error('Cannot delete all steps');
      return;
    }

    try {
      // Delete persisted steps from server first
      for (const id of unique) {
        if (isEditing && id && !id.startsWith('temp-')) {
          await api.deleteStep(workspaceId, walkthroughId, id);
        }
      }

      setWalkthrough((prev) => ({
        ...prev,
        steps: prev.steps.filter((s) => !unique.includes(s.id))
      }));

      // Keep the current step index in range
      setCurrentStepIndex((prevIdx) => {
        const remaining = walkthrough.steps.filter((s) => !unique.includes(s.id));
        if (remaining.length === 0) return 0;
        return Math.min(prevIdx, remaining.length - 1);
      });

      toast.success(`Deleted ${unique.length} steps`);
    } catch (e) {
      console.error('Failed to delete steps:', e);
      toast.error('Failed to delete selected steps');
    }
  };

  const toggleStepSelected = (id) => {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSteps = () => setSelectedStepIds(new Set((walkthrough.steps || []).map((s) => s.id)));
  const clearSelectedSteps = () => setSelectedStepIds(new Set());

  const deleteSelectedSteps = async () => {
    const ids = Array.from(selectedStepIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected steps?`)) return;
    await deleteSteps(ids);
    clearSelectedSteps();
    setSelectStepsMode(false);
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
        {(isSaving || isPublishing) && (
          <div className="fixed inset-0 z-[200] bg-black/20 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-soft-lg px-6 py-5 flex items-center gap-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <div className="text-sm text-slate-700">
                {isPublishing ? 'Publishing…' : 'Saving…'} Please wait.
              </div>
            </div>
          </div>
        )}
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
            {/* Step selection actions */}
            <Button
              variant={selectStepsMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectStepsMode((v) => !v);
                clearSelectedSteps();
              }}
              disabled={isSaving || isPublishing}
              data-testid="select-steps-button"
            >
              {selectStepsMode ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
              {selectStepsMode ? 'Selecting' : 'Select steps'}
            </Button>
            {selectStepsMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedStepIds.size === (walkthrough.steps || []).length) clearSelectedSteps();
                    else selectAllSteps();
                  }}
                  disabled={isSaving || isPublishing}
                  data-testid="select-all-steps-button"
                >
                  {selectedStepIds.size === (walkthrough.steps || []).length ? 'Unselect all' : 'Select all'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelectedSteps}
                  disabled={selectedStepIds.size === 0 || isSaving || isPublishing}
                  data-testid="delete-selected-steps-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete selected
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => insertStepAt(currentStepIndex + 1)}
              disabled={isSaving || isPublishing}
              data-testid="insert-step-after-button"
            >
              Add step below
            </Button>

            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={openVersions}
                disabled={isSaving || isPublishing}
                data-testid="versions-button"
              >
                <History className="w-4 h-4 mr-2" />
                Versions
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(true)}
              disabled={isSaving || isPublishing}
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
              disabled={isSaving || isPublishing}
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
              disabled={isSaving || isPublishing}
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
          selectMode={selectStepsMode}
          selectedIds={selectedStepIds}
          onToggleSelect={toggleStepSelected}
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

      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
          </DialogHeader>
          {versionsLoading ? (
            <div className="py-8 text-center text-slate-500">Loading…</div>
          ) : versions.length > 0 ? (
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">Version {v.version}</div>
                    <div className="text-xs text-slate-500 truncate">{v.created_at}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => rollbackToVersion(v.version)}>
                    Rollback
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              No versions yet. A version is created each time you publish.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CanvasBuilderPage;