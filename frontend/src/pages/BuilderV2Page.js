import React, { useState, useEffect, useRef, useCallback } from 'react';
// Updated: Fixed setup form and carousel block - 2024
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, Eye, Clock, Check, ArrowLeft, Undo2, Redo2, Plus, X, GripVertical, Upload, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrl, normalizeImageUrlsInObject } from '../lib/utils';
import { BLOCK_TYPES, createBlock, getBlockLabel, getBlockIcon } from '../utils/blockUtils';
import InlineRichEditor from '../components/canvas-builder/InlineRichEditor';
import RichTextEditor from '../components/canvas-builder/RichTextEditor';
import BuildingTips from '../components/canvas-builder/BuildingTips';
import { useQuota } from '../hooks/useQuota';

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
  const isEditing = !!walkthroughId && walkthroughId !== 'new';
  const { canUploadFile } = useQuota(workspaceId);

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
  const [blockPickerOpen, setBlockPickerOpen] = useState(null); // Track which "+" button opened it
  const [activeBlockId, setActiveBlockId] = useState(null);
  
  // Setup form state for new walkthroughs
  const [setupComplete, setSetupComplete] = useState(isEditing); // If editing, setup is already complete
  const [categories, setCategories] = useState([]);
  const [setupData, setSetupData] = useState({
    title: '',
    description: '',
    icon_url: '',
    category_ids: []
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load categories and walkthrough if editing
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.getCategories(workspaceId);
        setCategories(normalizeImageUrlsInObject(response.data));
      } catch (error) {
        console.error('Failed to load categories');
      }
    };
    
    loadCategories();
    
    if (isEditing && walkthroughId) {
      const loadWalkthrough = async () => {
        try {
          setLoading(true);
          const response = await api.getWalkthrough(workspaceId, walkthroughId);
          const normalized = normalizeImageUrlsInObject(response.data);
          // Ensure blocks array exists and is properly structured
          if (normalized.steps) {
            normalized.steps = normalized.steps.map(step => ({
              ...step,
              blocks: (step.blocks || []).map(block => ({
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: block.data || {},
                settings: block.settings || {}
              }))
            }));
          }
          setWalkthrough(normalized);
          setSetupData({
            title: normalized.title || '',
            description: normalized.description || '',
            icon_url: normalized.icon_url || '',
            category_ids: normalized.category_ids || []
          });
          if (normalized.steps && normalized.steps.length > 0) {
            setCurrentStepIndex(0);
          }
        } catch (error) {
          toast.error('Failed to load walkthrough');
          navigate(`/workspace/${workspaceId}/walkthroughs`.replace(/\/+/g, '/'));
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
      
      // Save walkthrough metadata
      const walkthroughData = {
        title: walkthrough.title || '',
        description: walkthrough.description || '',
        privacy: walkthrough.privacy || 'public',
        category_ids: walkthrough.category_ids || [],
        navigation_type: walkthrough.navigation_type || 'next_prev',
        navigation_placement: walkthrough.navigation_placement || 'bottom',
        status: walkthrough.status || 'draft',
      };

      let finalWalkthroughId = walkthroughId;

      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, walkthroughData);
      } else {
        const response = await api.createWalkthrough(workspaceId, walkthroughData);
        finalWalkthroughId = response.data.id;
        navigate(`/workspace/${workspaceId}/builder-v2/${finalWalkthroughId}`.replace(/\/+/g, '/'), { replace: true });
        toast.success('Walkthrough created');
      }

      // Save all steps with their blocks
      if (finalWalkthroughId && walkthrough.steps) {
        for (const step of walkthrough.steps) {
          const stepData = {
            title: step.title || '',
            content: step.content || '', // Required by backend StepCreate model
            blocks: step.blocks || [],
            navigation_type: step.navigation_type || 'next_prev',
            order: step.order || 0,
            common_problems: step.common_problems || [],
          };

          if (step.id && !step.id.startsWith('step-')) {
            // Existing step - update via API
            await api.updateStep(workspaceId, finalWalkthroughId, step.id, stepData);
          } else {
            // New step - create via API
            const response = await api.addStep(workspaceId, finalWalkthroughId, stepData);
            // Update local step with returned ID
            const newSteps = walkthrough.steps.map(s =>
              s.id === step.id ? { ...s, id: response.data.id } : s
            );
            setWalkthrough({ ...walkthrough, steps: newSteps });
          }
        }
      }

      setLastSaved(new Date());
      toast.success(t('builder.saved'));
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save walkthrough');
    } finally {
      setIsSaving(false);
    }
  };

  // Switch to classic builder
  const switchToClassic = () => {
    if (walkthroughId) {
      navigate(`/workspace/${workspaceId}/walkthroughs/${walkthroughId}/edit`.replace(/\/+/g, '/'));
    } else {
      navigate(`/workspace/${workspaceId}/walkthroughs/new`.replace(/\/+/g, '/'));
    }
  };

  // Handle setup form submission - create walkthrough with metadata
  const handleSetupComplete = async () => {
    if (!setupData.title || !setupData.title.trim()) {
      toast.error('Please enter a walkthrough name');
      return;
    }

    try {
      setLoading(true);
      
      // Create walkthrough with metadata
      const walkthroughData = {
        title: setupData.title.trim(),
        description: setupData.description || '',
        category_ids: setupData.category_ids || [],
        icon_url: setupData.icon_url || null,
        status: 'draft',
        privacy: 'public',
        navigation_type: 'next_prev',
        navigation_placement: 'bottom'
      };

      const response = await api.createWalkthrough(workspaceId, walkthroughData);
      const newWalkthroughId = response.data.id;
      
      // Update local state
      setWalkthrough({
        ...walkthroughData,
        id: newWalkthroughId,
        steps: []
      });
      setSetupComplete(true);
      
      // Navigate to the new walkthrough
      navigate(`/workspace/${workspaceId}/builder-v2/${newWalkthroughId}`.replace(/\/+/g, '/'), { replace: true });
      toast.success('Walkthrough created! Start adding steps.');
    } catch (error) {
      console.error('Failed to create walkthrough:', error);
      toast.error(error.response?.data?.detail || 'Failed to create walkthrough');
    } finally {
      setLoading(false);
    }
  };

  // Handle icon upload for setup form
  const handleSetupIconUpload = async (file) => {
    try {
      setUploadingIcon(true);
      
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
        return;
      }
      
      const idempotencyKey = `setup-icon-${Date.now()}-${file.name}`;
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'walkthrough_icon',
        referenceId: 'setup'
      });
      
      if (response.data.status !== 'active' && response.data.status !== 'existing') {
        toast.error(`Upload not completed (status: ${response.data.status}). Please try again.`);
        return;
      }
      
      if (!response.data.url) {
        toast.error('Upload succeeded but no URL returned.');
        return;
      }
      
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : normalizeImageUrl(uploadedUrl);
      
      setSetupData(prev => ({ ...prev, icon_url: fullUrl }));
      toast.success('Icon uploaded!');
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
    }
  };

  // Update current step - canonical function for all step updates
  const updateCurrentStep = useCallback((updates) => {
    if (!walkthrough.steps || walkthrough.steps.length === 0) return;
    if (currentStepIndex < 0 || currentStepIndex >= walkthrough.steps.length) return;
    
    const newSteps = [...walkthrough.steps];
    if (newSteps[currentStepIndex]) {
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], ...updates };
      setWalkthrough(prev => ({ ...prev, steps: newSteps }));
    }
  }, [walkthrough.steps, currentStepIndex]);

  // Debounced save for step updates
  const saveStepDebounced = useRef(null);
  
  useEffect(() => {
    const currentStep = walkthrough.steps[currentStepIndex] || null;
    if (saveStepDebounced.current) {
      clearTimeout(saveStepDebounced.current);
    }
    if (walkthroughId && currentStep && currentStep.id && !currentStep.id.startsWith('step-')) {
      saveStepDebounced.current = setTimeout(async () => {
        try {
          const stepData = {
            title: currentStep.title || '',
            content: currentStep.content || '', // Required by backend
            blocks: currentStep.blocks || [],
            navigation_type: currentStep.navigation_type || 'next_prev',
            order: currentStep.order || 0,
            common_problems: currentStep.common_problems || [],
          };
          await api.updateStep(workspaceId, walkthroughId, currentStep.id, stepData);
        } catch (error) {
          console.error('Failed to auto-save step:', error);
        }
      }, 1000);
    }
    return () => {
      if (saveStepDebounced.current) {
        clearTimeout(saveStepDebounced.current);
      }
    };
  }, [walkthrough.steps, currentStepIndex, walkthroughId, workspaceId]);

  // Add block at index - index-safe with validation
  const addBlock = useCallback((blockType, insertAfterIndex) => {
    if (!blockType || !BLOCK_TYPES[blockType.toUpperCase()]) {
      console.error('Invalid block type:', blockType);
      return;
    }
    
    if (!walkthrough.steps || walkthrough.steps.length === 0) {
      console.error('Cannot add block: no steps exist');
      return;
    }
    
    if (currentStepIndex < 0 || currentStepIndex >= walkthrough.steps.length) {
      console.error('Invalid step index:', currentStepIndex);
      return;
    }

    try {
      const newBlock = createBlock(blockType);
      if (!newBlock || !newBlock.id) {
        console.error('Failed to create block');
        return;
      }

      const newSteps = [...walkthrough.steps];
      const currentStep = newSteps[currentStepIndex];
      if (!currentStep) {
        console.error('Current step not found');
        return;
      }

      const blocks = currentStep.blocks || [];
      const newBlocks = [...blocks];
      
      // Validate insertAfterIndex
      const safeIndex = Math.max(-1, Math.min(insertAfterIndex, blocks.length - 1));
      
      if (safeIndex === -1) {
        newBlocks.unshift(newBlock);
      } else {
        newBlocks.splice(safeIndex + 1, 0, newBlock);
      }
      
      newSteps[currentStepIndex] = { ...currentStep, blocks: newBlocks };
      setWalkthrough(prev => ({ ...prev, steps: newSteps }));
      setSelectedBlockId(newBlock.id);
      setBlockPickerOpen(null);
    } catch (error) {
      console.error('Error adding block:', error);
      toast.error('Failed to add block');
    }
  }, [walkthrough.steps, currentStepIndex]);

  // Update block
  const updateBlock = (blockId, updates) => {
    const newSteps = [...walkthrough.steps];
    if (newSteps[currentStepIndex]) {
      const blocks = (newSteps[currentStepIndex].blocks || []).map(b =>
        b.id === blockId ? { ...b, ...updates } : b
      );
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], blocks };
      setWalkthrough({ ...walkthrough, steps: newSteps });
    }
  };

  // Delete block
  const deleteBlock = (blockId) => {
    const newSteps = [...walkthrough.steps];
    if (newSteps[currentStepIndex]) {
      const blocks = (newSteps[currentStepIndex].blocks || []).filter(b => b.id !== blockId);
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], blocks };
      setWalkthrough({ ...walkthrough, steps: newSteps });
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveBlockId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveBlockId(null);

    if (over && active.id !== over.id) {
      const newSteps = [...walkthrough.steps];
      if (newSteps[currentStepIndex]) {
        const blocks = newSteps[currentStepIndex].blocks || [];
        const oldIndex = blocks.findIndex(b => b.id === active.id);
        const newIndex = blocks.findIndex(b => b.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newBlocks = arrayMove(blocks, oldIndex, newIndex);
          newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], blocks: newBlocks };
          setWalkthrough({ ...walkthrough, steps: newSteps });
        }
      }
    }
  };

  // Media upload handler
  const handleMediaUpload = async (file, blockId) => {
    try {
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
        return;
      }

      const idempotencyKey = `block-${blockId}-${file.name}-${Date.now()}`;
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'block_image',
        referenceId: blockId
      });

      if (response.data.status !== 'active' && response.data.status !== 'existing') {
        toast.error(`Upload not completed (status: ${response.data.status}). Please try again.`);
        return;
      }

      if (!response.data.url) {
        toast.error('Upload succeeded but no URL returned.');
        return;
      }

      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : normalizeImageUrl(uploadedUrl);

      updateBlock(blockId, {
        data: {
          ...(walkthrough.steps[currentStepIndex]?.blocks?.find(b => b.id === blockId)?.data || {}),
          url: fullUrl,
          file_id: response.data.file_id
        }
      });

      toast.success('File uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      if (error.response?.status === 402) {
        toast.error('Storage quota exceeded. Please upgrade your plan.');
      } else {
        toast.error(error.response?.data?.detail || 'Upload failed');
      }
    }
  };

  // Compute derived state
  const currentStep = walkthrough.steps[currentStepIndex] || null;
  const selectedBlock = currentStep?.blocks?.find(b => b.id === selectedBlockId) || null;
  const blocks = currentStep?.blocks || [];
  const blockItems = blocks.map(b => b.id);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show setup form for new walkthroughs before allowing step creation
  if (!setupComplete && !isEditing) {
    const parentCategories = categories.filter(c => !c.parent_id);
    
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border border-slate-200 p-8 max-h-[90vh] overflow-y-auto">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Create New Walkthrough</h2>
            <p className="text-sm text-slate-500">Set up your walkthrough before adding steps</p>
          </div>

          <div className="space-y-6">
                {/* Walkthrough Name */}
                <div>
                  <Label htmlFor="title" className="text-sm font-medium text-slate-900 mb-2 block">
                    Walkthrough Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={setupData.title}
                    onChange={(e) => setSetupData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter walkthrough name"
                    className="w-full"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-slate-900 mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={setupData.description}
                    onChange={(e) => setSetupData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter description (optional)"
                    rows={3}
                    className="w-full"
                  />
                </div>

                {/* Icon/Photo */}
                <div>
                  <Label className="text-sm font-medium text-slate-900 mb-2 block">
                    Icon/Photo <span className="text-slate-500 font-normal">(Optional)</span>
                  </Label>
                  {setupData.icon_url ? (
                    <div className="space-y-2">
                      <img
                        src={normalizeImageUrl(setupData.icon_url)}
                        alt="Icon preview"
                        className="w-24 h-24 rounded-lg object-cover border border-slate-200"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSetupData(prev => ({ ...prev, icon_url: '' }))}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSetupIconUpload(file);
                          e.target.value = '';
                        }}
                        disabled={uploadingIcon}
                        className="w-full"
                      />
                      <p className="text-sm text-slate-500">or</p>
                      <Input
                        placeholder="Enter image URL"
                        value={setupData.icon_url}
                        onChange={(e) => setSetupData(prev => ({ ...prev, icon_url: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-sm font-medium text-slate-900 mb-2 block">
                    Categories
                  </Label>
                  {parentCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">No categories available. Create categories in the Categories page.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                      {parentCategories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${category.id}`}
                            checked={setupData.category_ids.includes(category.id)}
                            onCheckedChange={(checked) => {
                              setSetupData(prev => ({
                                ...prev,
                                category_ids: checked
                                  ? [...prev.category_ids, category.id]
                                  : prev.category_ids.filter(id => id !== category.id)
                              }));
                            }}
                          />
                          <Label htmlFor={`cat-${category.id}`} className="text-sm cursor-pointer">
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/workspace/${workspaceId}/walkthroughs`.replace(/\/+/g, '/'))}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSetupComplete}
                    disabled={!setupData.title?.trim() || loading || uploadingIcon}
                    className="flex-1"
                  >
                    {loading ? 'Creating...' : 'Create Walkthrough'}
                  </Button>
                </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 overflow-hidden" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh' }}>
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
          <Button variant="ghost" size="sm" disabled title="Undo (coming soon)">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled title="Redo (coming soon)">
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/portal/${workspaceId}/${walkthroughId || 'preview'}`, '_blank')}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={saveWalkthrough} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {t('common.save')}
          </Button>
          <Button variant="outline" size="sm" onClick={switchToClassic}>
            Classic Builder
          </Button>
        </div>
      </div>

      {/* Main Layout: 3 Zones */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Zone 2: Step Navigator (Left - Fixed Width, No Scroll) */}
        <StepNavigator
          steps={walkthrough.steps}
          currentStepIndex={currentStepIndex}
          onStepClick={setCurrentStepIndex}
          onAddStep={async () => {
            try {
              const newStep = {
                id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: `Step ${walkthrough.steps.length + 1}`,
                content: '', // Required by backend
                blocks: [],
                order: walkthrough.steps.length,
                navigation_type: 'next_prev',
                common_problems: []
              };
              
              // Update local state immediately
              const newSteps = [...walkthrough.steps, newStep];
              setWalkthrough(prev => ({ ...prev, steps: newSteps }));
              const newIndex = newSteps.length - 1;
              setCurrentStepIndex(newIndex);
              setSelectedBlockId(null);
              
              // Persist to backend if walkthrough exists
              if (walkthroughId) {
                try {
                  const stepData = {
                    title: newStep.title,
                    content: newStep.content || '', // Required by backend
                    blocks: [],
                    navigation_type: 'next_prev',
                    order: newStep.order,
                    common_problems: []
                  };
                  const response = await api.addStep(workspaceId, walkthroughId, stepData);
                  // Update with real ID
                  setWalkthrough(prev => ({
                    ...prev,
                    steps: prev.steps.map((s, i) => 
                      i === newIndex ? { ...s, id: response.data.id } : s
                    )
                  }));
                } catch (error) {
                  console.error('Failed to persist step:', error);
                  toast.error('Step created locally but failed to save');
                }
              }
            } catch (error) {
              console.error('Error creating step:', error);
              toast.error('Failed to create step');
            }
          }}
          onDeleteStep={(stepIndex) => {
            if (walkthrough.steps.length <= 1) {
              toast.error('Cannot delete the last step');
              return;
            }
            const stepToDelete = walkthrough.steps[stepIndex];
            if (stepToDelete.id && !stepToDelete.id.startsWith('step-')) {
              // Delete via API if it exists in backend
              api.deleteStep(workspaceId, walkthroughId, stepToDelete.id).catch(console.error);
            }
            const newSteps = walkthrough.steps.filter((_, i) => i !== stepIndex);
            setWalkthrough({ ...walkthrough, steps: newSteps });
            if (currentStepIndex >= newSteps.length) {
              setCurrentStepIndex(Math.max(0, newSteps.length - 1));
            }
            setSelectedBlockId(null);
          }}
          workspaceId={workspaceId}
          walkthroughId={walkthroughId}
        />

        {/* Zone 3: Canvas Stage (Center - ONLY Scrollable Area) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 min-w-0">
          <CanvasStage
            currentStep={currentStep}
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            activeBlockId={activeBlockId}
            onBlockSelect={setSelectedBlockId}
            onBlockAdd={addBlock}
            onBlockUpdate={updateBlock}
            onBlockDelete={deleteBlock}
            onStepUpdate={updateCurrentStep}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            blockItems={blockItems}
            sensors={sensors}
            workspaceId={workspaceId}
            walkthroughId={walkthroughId}
            stepId={currentStep?.id}
            onMediaUpload={handleMediaUpload}
            blockPickerOpen={blockPickerOpen}
            onBlockPickerOpen={setBlockPickerOpen}
            isStepLoaded={!loading && !!currentStep}
            canUploadFile={canUploadFile}
          />
        </div>

        {/* Zone 4: Inspector Panel (Right - Fixed Width, No Scroll) */}
        <InspectorPanel
          selectedBlock={selectedBlock}
          currentStep={currentStep}
          onStepUpdate={updateCurrentStep}
          onBlockUpdate={updateBlock}
          onBlockDelete={deleteBlock}
          workspaceId={workspaceId}
          walkthroughId={walkthroughId}
          stepId={currentStep?.id}
          onMediaUpload={handleMediaUpload}
          canUploadFile={canUploadFile}
        />
      </div>
    </div>
  );
};

// Step Navigator Component
const StepNavigator = ({ steps, currentStepIndex, onStepClick, onAddStep, onDeleteStep, workspaceId, walkthroughId }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Steps</h2>
        <Button variant="ghost" size="sm" onClick={onAddStep} className="h-7 w-7 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {steps.length === 0 ? (
          <div className="p-4 text-sm text-slate-500 text-center">
            No steps yet
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {steps.map((step, index) => (
              <div
                key={step.id || index}
                className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors group relative ${
                  currentStepIndex === index ? 'bg-slate-100 border-l-2 border-primary' : ''
                }`}
                onClick={() => onStepClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
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
                  {onDeleteStep && steps.length > 1 && hoveredIndex === index && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete step ${index + 1}?`)) {
                          onDeleteStep(index);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1"
                      title="Delete step"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Canvas Stage Component with Drag and Drop
const CanvasStage = ({
  currentStep,
  blocks,
  selectedBlockId,
  activeBlockId,
  onBlockSelect,
  onBlockAdd,
  onBlockUpdate,
  onBlockDelete,
  onStepUpdate,
  onDragStart,
  onDragEnd,
  blockItems,
  sensors,
  workspaceId,
  walkthroughId,
  stepId,
  onMediaUpload,
  blockPickerOpen,
  onBlockPickerOpen,
  isStepLoaded,
  canUploadFile
}) => {
  if (!currentStep) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p className="text-sm">Select a step or create a new one</p>
        </div>
      </div>
    );
  }

  if (!onStepUpdate) {
    console.error('CanvasStage: onStepUpdate is required but not provided');
  }

  return (
    <div className="min-h-full flex items-start justify-center py-16 px-8">
      <div className="w-full max-w-[920px] bg-white rounded-lg shadow-sm border border-slate-200 min-h-[600px] p-12">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={blockItems} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {/* Step Title */}
              {onStepUpdate && (
                <StepTitleEditor
                  title={currentStep.title || ''}
                  onChange={(title) => {
                    if (onStepUpdate && isStepLoaded) {
                      onStepUpdate({ title });
                    }
                  }}
                  isStepLoaded={isStepLoaded}
                />
              )}

              {/* Blocks with inline "+" buttons */}
              {blocks.length === 0 ? (
                <AddBlockButton insertAfterIndex={-1} onAdd={onBlockAdd} />
              ) : (
                <>
                  {blocks.map((block, index) => (
                    <React.Fragment key={block.id}>
                      <BlockRenderer
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        isDragging={activeBlockId === block.id}
                        onSelect={() => onBlockSelect(block.id)}
                        onUpdate={(updates) => onBlockUpdate(block.id, updates)}
                        onDelete={() => onBlockDelete(block.id)}
                        workspaceId={workspaceId}
                        walkthroughId={walkthroughId}
                        stepId={stepId}
                        onMediaUpload={onMediaUpload}
                        canUploadFile={canUploadFile}
                      />
                      <AddBlockButton
                        insertAfterIndex={index}
                        onAdd={onBlockAdd}
                        isOpen={blockPickerOpen === index}
                        onOpenChange={(open) => onBlockPickerOpen(open ? index : null)}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeBlockId ? (
              <div className="bg-white border-2 border-primary rounded-lg p-4 shadow-lg opacity-90">
                {blocks.find(b => b.id === activeBlockId)?.type || 'Block'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

// Step Title Editor with guards
const StepTitleEditor = ({ title, onChange, isStepLoaded }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isStepLoaded && !isInitialized) {
      // Small delay to ensure editor is fully hydrated
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStepLoaded, isInitialized]);

  const handleChange = useCallback((content) => {
    if (isInitialized && isStepLoaded && onChange) {
      onChange(content);
    }
  }, [isInitialized, isStepLoaded, onChange]);

  if (!onChange) {
    console.error('StepTitleEditor: onChange is required');
    return null;
  }

  return (
    <InlineRichEditor
      content={title || ''}
      onChange={handleChange}
      placeholder="Step title..."
      isRTL={false}
      textSize="text-3xl"
      isBold={true}
      align="left"
      className="text-slate-900 font-heading"
    />
  );
};

// Add Block Button with Popover - Always visible, keyboard accessible
const AddBlockButton = ({ insertAfterIndex, onAdd, isOpen, onOpenChange }) => {
  const blockTypes = [
    BLOCK_TYPES.HEADING,
    BLOCK_TYPES.TEXT,
    BLOCK_TYPES.IMAGE,
    BLOCK_TYPES.VIDEO,
    BLOCK_TYPES.CAROUSEL,
    BLOCK_TYPES.BUTTON,
    BLOCK_TYPES.DIVIDER,
    BLOCK_TYPES.SPACER,
    BLOCK_TYPES.PROBLEM,
  ];

  const handleAdd = useCallback((type) => {
    if (onAdd && typeof onAdd === 'function') {
      try {
        onAdd(type, insertAfterIndex);
        if (onOpenChange) {
          onOpenChange(false);
        }
      } catch (error) {
        console.error('Error adding block:', error);
      }
    } else {
      console.error('AddBlockButton: onAdd is not a function');
    }
  }, [onAdd, insertAfterIndex, onOpenChange]);

  if (!onAdd) {
    console.error('AddBlockButton: onAdd is required');
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-8 flex items-center justify-center opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity border-2 border-dashed border-slate-300 rounded-lg hover:border-primary hover:bg-primary/5 focus:border-primary focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenChange) {
              onOpenChange(true);
            }
          }}
          aria-label="Add block"
          type="button"
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-white border-slate-200 z-50" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-2">
          {blockTypes.map((type) => (
            <button
              key={type}
              className="p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              onClick={() => handleAdd(type)}
              type="button"
            >
              <div className="text-2xl mb-1">{getBlockIcon(type)}</div>
              <div className="text-sm font-medium text-slate-900">{getBlockLabel(type)}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Block Renderer Component (Sortable)
const BlockRenderer = ({
  block,
  isSelected,
  isDragging,
  onSelect,
  onUpdate,
  onDelete,
  workspaceId,
  walkthroughId,
  stepId,
  onMediaUpload,
  canUploadFile
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block.id, disabled: false });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('Delete this block?')) {
      onDelete();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <BlockContent
            block={block}
            onUpdate={onUpdate}
            onDelete={onDelete}
            workspaceId={workspaceId}
            walkthroughId={walkthroughId}
            stepId={stepId}
            onMediaUpload={onMediaUpload}
            canUploadFile={canUploadFile}
          />
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
            title="Delete block"
            aria-label="Delete block"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Block Content Renderer
const BlockContent = ({ block, onUpdate, onDelete, workspaceId, walkthroughId, stepId, onMediaUpload, canUploadFile }) => {
  // Initialize guards for editors (hooks must be at top level)
  const [headingInitialized, setHeadingInitialized] = useState(false);
  const [textInitialized, setTextInitialized] = useState(false);
  
  useEffect(() => {
    const timer1 = setTimeout(() => setHeadingInitialized(true), 100);
    const timer2 = setTimeout(() => setTextInitialized(true), 100);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  switch (block.type) {
    case BLOCK_TYPES.HEADING:
      const headingSize = block.data?.level === 1 ? 'text-3xl' : block.data?.level === 2 ? 'text-2xl' : 'text-xl';
      return (
        <div>
          <InlineRichEditor
            content={block.data?.content || ''}
            onChange={(content) => {
              if (headingInitialized && onUpdate) {
                onUpdate({ data: { ...(block.data || {}), content } });
              }
            }}
            placeholder="Heading text..."
            textSize={headingSize}
            isBold={true}
            className="text-slate-900"
          />
        </div>
      );

    case BLOCK_TYPES.TEXT:
      return (
        <RichTextEditor
          content={block.data?.content || ''}
          onChange={(content) => {
            if (textInitialized && onUpdate) {
              onUpdate({ data: { ...(block.data || {}), content } });
            }
          }}
        />
      );

    case BLOCK_TYPES.IMAGE:
      const imageUrl = block.data?.url ? normalizeImageUrl(block.data.url) : null;
      return (
        <div>
          {imageUrl ? (
            <div>
              <img
                src={imageUrl}
                alt={block.data.alt || ''}
                className="w-full rounded-lg mb-2"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <Input
                value={block.data.caption || ''}
                onChange={(e) => onUpdate({ data: { ...block.data, caption: e.target.value } })}
                placeholder="Add caption..."
                className="text-sm"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && onMediaUpload(e.target.files[0], block.id)}
                className="mb-2"
              />
              <p className="text-sm text-slate-500 mt-2">or</p>
              <Input
                placeholder="Paste image URL"
                onBlur={(e) => {
                  if (e.target.value) {
                    onUpdate({ data: { ...block.data, url: normalizeImageUrl(e.target.value) } });
                  }
                }}
                className="mt-2"
              />
            </div>
          )}
        </div>
      );

    case BLOCK_TYPES.VIDEO:
      return (
        <div>
          {block.data.url ? (
            <div>
              {block.data.type === 'youtube' ? (
                <div className="aspect-video">
                  <iframe
                    src={block.data.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video src={block.data.url} controls className="w-full rounded-lg" />
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files[0] && onMediaUpload(e.target.files[0], block.id)}
                className="mb-2"
              />
              <p className="text-sm text-slate-500 mt-2">or YouTube URL</p>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                onBlur={(e) => {
                  if (e.target.value) {
                    const isYoutube = e.target.value.includes('youtube') || e.target.value.includes('youtu.be');
                    onUpdate({
                      data: {
                        ...block.data,
                        url: e.target.value,
                        type: isYoutube ? 'youtube' : 'url'
                      }
                    });
                  }
                }}
                className="mt-2"
              />
            </div>
          )}
        </div>
      );

    case BLOCK_TYPES.BUTTON:
      return (
        <div className="space-y-3">
          <Input
            value={block.data.text || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, text: e.target.value } })}
            placeholder="Button text"
          />
        </div>
      );

    case BLOCK_TYPES.DIVIDER:
      return <div className="h-px bg-slate-200 w-full" />;

    case BLOCK_TYPES.SPACER:
      return <div style={{ height: block.data.height || 32 }} />;

    case BLOCK_TYPES.PROBLEM:
      return (
        <div className="border border-warning-300 rounded-lg p-4 bg-warning-50 space-y-2">
          <Input
            value={block.data.title || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, title: e.target.value } })}
            placeholder="Problem title"
          />
          <Textarea
            value={block.data.explanation || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, explanation: e.target.value } })}
            placeholder="Explanation"
          />
        </div>
      );

    case BLOCK_TYPES.CAROUSEL:
      return (
        <CarouselBlockEditor
          block={block}
          onUpdate={onUpdate}
          workspaceId={workspaceId}
          canUploadFile={canUploadFile}
        />
      );

    default:
      return <div className="text-slate-400 text-sm">Unknown block type: {block.type}</div>;
  }
};

// Carousel Block Editor Component
const CarouselBlockEditor = ({ block, onUpdate, workspaceId, canUploadFile }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploadingSlide, setUploadingSlide] = useState(null);
  const slides = block.data?.slides || [];
  const MAX_SLIDES = 20; // Enforce max slides per block

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) {
      toast.error(`Maximum ${MAX_SLIDES} slides allowed per carousel`);
      return;
    }
    const newSlide = {
      slide_id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file_id: null,
      url: '',
      media_type: 'image', // image, video, gif
      caption: ''
    };
    onUpdate({ data: { ...block.data, slides: [...slides, newSlide] } });
    setActiveIndex(slides.length);
  };

  const removeSlide = (slideIndex) => {
    if (slides.length <= 1) {
      toast.error('Carousel must have at least one slide');
      return;
    }
    const newSlides = slides.filter((_, i) => i !== slideIndex);
    onUpdate({ data: { ...block.data, slides: newSlides } });
    if (activeIndex >= newSlides.length) {
      setActiveIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const updateSlide = (slideIndex, updates) => {
    const newSlides = [...slides];
    newSlides[slideIndex] = { ...newSlides[slideIndex], ...updates };
    onUpdate({ data: { ...block.data, slides: newSlides } });
  };

  const handleSlideUpload = async (file, slideIndex) => {
    try {
      setUploadingSlide(slideIndex);
      const slide = slides[slideIndex];
      if (!slide) return;

      // Check quota
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
        return;
      }

      // Upload file via API
      const idempotencyKey = `carousel-slide-${block.id}-${slide.slide_id}-${file.name}-${Date.now()}`;
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'block_image', // Use block_image for carousel slides
        referenceId: `${block.id}-${slide.slide_id}`
      });
      
      if (response.data.status !== 'active' && response.data.status !== 'existing') {
        toast.error(`Upload not completed (status: ${response.data.status}). Please try again.`);
        return;
      }
      
      if (!response.data.url) {
        toast.error('Upload succeeded but no URL returned.');
        return;
      }
      
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : normalizeImageUrl(uploadedUrl);
      
      // Determine media type
      const fileType = file.type.split('/')[0];
      const fileName = file.name.toLowerCase();
      let mediaType = 'image';
      if (fileType === 'video' || fileName.endsWith('.mp4') || fileName.endsWith('.webm')) {
        mediaType = 'video';
      } else if (fileName.endsWith('.gif')) {
        mediaType = 'gif';
      }
      
      updateSlide(slideIndex, {
        url: fullUrl,
        file_id: response.data.file_id,
        media_type: mediaType
      });
      
      toast.success('Slide uploaded!');
    } catch (error) {
      console.error('Slide upload error:', error);
      if (error.response?.status === 402) {
        toast.error('Storage quota exceeded. Please upgrade your plan.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to upload slide');
      }
    } finally {
      setUploadingSlide(null);
    }
  };

  if (slides.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
        <p className="text-sm text-slate-500 mb-4">No slides yet. Add your first slide to start.</p>
        <Button onClick={addSlide} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Slide
        </Button>
      </div>
    );
  }

  const currentSlide = slides[activeIndex];

  return (
    <div className="space-y-4">
      {/* Carousel Display */}
      <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-lg transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow-lg transition-all"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </>
        )}

        {/* Slide Content */}
        <div className="aspect-video relative bg-slate-100">
          {currentSlide?.url ? (
            <>
              {currentSlide.media_type === 'video' ? (
                <video
                  src={normalizeImageUrl(currentSlide.url)}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={normalizeImageUrl(currentSlide.url)}
                  alt={`Slide ${activeIndex + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              {currentSlide.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 text-sm">
                  {currentSlide.caption}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No media for this slide</p>
              </div>
            </div>
          )}
        </div>

        {/* Dots Indicator */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === activeIndex ? 'bg-primary w-6' : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slide Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Slide {activeIndex + 1} of {slides.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Remove slide ${activeIndex + 1}?`)) {
                  removeSlide(activeIndex);
                }
              }}
              disabled={slides.length <= 1}
            >
              <X className="w-4 h-4 mr-1" />
              Remove
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                addSlide();
              }}
              disabled={slides.length >= MAX_SLIDES}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Slide
            </Button>
          </div>
        </div>

        {/* Current Slide Editor */}
        {currentSlide && (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Media</Label>
              {currentSlide.url ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-600">Current: {currentSlide.media_type}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSlide(activeIndex, { url: '', file_id: null });
                    }}
                  >
                    Remove Media
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSlideUpload(file, activeIndex);
                          e.target.value = '';
                        }}
                        disabled={uploadingSlide === activeIndex}
                        className="text-sm"
                      />
                      {uploadingSlide === activeIndex && (
                        <div className="text-xs text-slate-500">Uploading...</div>
                      )}
                  <p className="text-xs text-slate-500">or</p>
                  <Input
                    placeholder="Paste media URL"
                    onBlur={(e) => {
                      if (e.target.value) {
                        const url = normalizeImageUrl(e.target.value);
                        const isVideo = url.includes('.mp4') || url.includes('.webm') || url.includes('video');
                        updateSlide(activeIndex, {
                          url,
                          media_type: isVideo ? 'video' : 'image'
                        });
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Caption (Optional)</Label>
              <InlineRichEditor
                content={currentSlide.caption || ''}
                onChange={(content) => updateSlide(activeIndex, { caption: content })}
                placeholder="Add caption for this slide..."
                className="text-sm min-h-[60px] border border-slate-200 rounded px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Inspector Panel Component - Never crashes, always resilient
const InspectorPanel = ({
  selectedBlock,
  currentStep,
  onStepUpdate,
  onBlockUpdate,
  onBlockDelete,
  workspaceId,
  walkthroughId,
  stepId,
  onMediaUpload,
  canUploadFile
}) => {
  // Block settings
  if (selectedBlock && selectedBlock.id && onBlockUpdate && onBlockDelete) {
    return (
      <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Block Settings</h2>
          {onBlockDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Delete this block?')) {
                  onBlockDelete(selectedBlock.id);
                }
              }}
              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Block Type</Label>
            <div className="text-sm font-medium text-slate-900">{getBlockLabel(selectedBlock.type)}</div>
          </div>

          {selectedBlock.type === BLOCK_TYPES.HEADING && (
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Heading Level</Label>
              <Select
                value={String(selectedBlock.data?.level || 2)}
                onValueChange={(value) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, level: parseInt(value) } })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedBlock.type === BLOCK_TYPES.IMAGE && (
            <>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Image URL</Label>
                <Input
                  value={selectedBlock.data?.url || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, url: e.target.value } })}
                  placeholder="Image URL"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Alt Text</Label>
                <Input
                  value={selectedBlock.data?.alt || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, alt: e.target.value } })}
                  placeholder="Alt text for accessibility"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Caption</Label>
                <Input
                  value={selectedBlock.data?.caption || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, caption: e.target.value } })}
                  placeholder="Image caption"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Upload Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      onMediaUpload(e.target.files[0], selectedBlock.id);
                      e.target.value = '';
                    }
                  }}
                  className="h-9"
                />
              </div>
            </>
          )}

          {selectedBlock.type === BLOCK_TYPES.VIDEO && (
            <>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Video URL</Label>
                <Input
                  value={selectedBlock.data?.url || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, url: e.target.value } })}
                  placeholder="Video URL or YouTube link"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Video Type</Label>
                <Select
                  value={selectedBlock.data?.type || 'url'}
                  onValueChange={(value) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, type: value } })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">Direct URL</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Upload Video</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      onMediaUpload(e.target.files[0], selectedBlock.id);
                      e.target.value = '';
                    }
                  }}
                  className="h-9"
                />
              </div>
            </>
          )}

          {selectedBlock.type === BLOCK_TYPES.BUTTON && (
            <>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Button Text</Label>
                <Input
                  value={selectedBlock.data?.text || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, text: e.target.value } })}
                  placeholder="Button text"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Action</Label>
                <Select
                  value={selectedBlock.data?.action || 'next'}
                  onValueChange={(value) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, action: value } })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">Next Step</SelectItem>
                    <SelectItem value="link">External Link</SelectItem>
                    <SelectItem value="check">Check Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedBlock.data?.action === 'link' && (
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Link URL</Label>
                  <Input
                    value={selectedBlock.data?.url || ''}
                    onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, url: e.target.value } })}
                    placeholder="https://..."
                  />
                </div>
              )}
            </>
          )}

          {selectedBlock.type === BLOCK_TYPES.SPACER && (
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Height (px)</Label>
              <Input
                type="number"
                value={selectedBlock.data?.height || 32}
                onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, height: parseInt(e.target.value) || 32 } })}
                min="0"
              />
            </div>
          )}

          {selectedBlock.type === BLOCK_TYPES.PROBLEM && (
            <>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Problem Title</Label>
                <Input
                  value={selectedBlock.data?.title || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, title: e.target.value } })}
                  placeholder="Problem title"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Explanation</Label>
                <Textarea
                  value={selectedBlock.data?.explanation || ''}
                  onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, explanation: e.target.value } })}
                  placeholder="Problem explanation"
                  rows={4}
                />
              </div>
            </>
          )}

          {selectedBlock.type === BLOCK_TYPES.CAROUSEL && (
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Carousel Slides</Label>
              <div className="text-sm text-slate-600">
                {selectedBlock.data?.slides?.length || 0} slide(s)
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Edit slides in the canvas. Maximum 20 slides per carousel.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step settings (no block selected) - Show Tips instead
  if (currentStep && currentStep.id && onStepUpdate) {
    return <BuildingTips />;
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Inspector</h2>
      </div>
      <div className="flex-1 p-4">
        <div className="text-sm text-slate-400 text-center py-8">
          Select a step or block to edit
        </div>
      </div>
    </div>
  );
};

export default BuilderV2Page;
