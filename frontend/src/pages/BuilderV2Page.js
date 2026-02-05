import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// Updated: Fixed setup form and carousel block - 2024
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, Eye, Clock, Check, ArrowLeft, Undo2, Redo2, Plus, X, GripVertical, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, AlignLeft, AlignCenter, AlignRight, Type, Trash2, FileText, Download, Sun } from 'lucide-react';
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
import { getFlattenedCategories, normalizeCategories } from '../utils/categoryTree';
import sanitizeHtml from '../lib/sanitizeHtml';
import { BLOCK_TYPES, createBlock, getBlockLabelKey, getBlockLabel, getBlockIcon, getAllBlockTypes } from '../utils/blockUtils';
import InlineRichEditor from '../components/canvas-builder/InlineRichEditor';
import RichTextEditor from '../components/canvas-builder/RichTextEditor';
import BuildingTips from '../components/canvas-builder/BuildingTips';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useQuota } from '../hooks/useQuota';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { getOnboardingSession } from '../onboarding/onboardingSession';
import WorkspaceLoader from '../components/WorkspaceLoader';

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
const arraysEqual = (a = [], b = []) => (
  Array.isArray(a) && Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, index) => value === b[index])
);

const BuilderV2Page = () => {
  const { t } = useTranslation();

  const { workspaceSlug, walkthroughId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!walkthroughId && walkthroughId !== 'new';
  
  // Resolve workspace slug to ID
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspaceSlug(workspaceSlug);
  const { canUploadFile } = useQuota(workspaceId);

  const emitOnboardingEvent = useCallback((name, detail) => {
    const session = getOnboardingSession();
    if (session?.active) {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }, []);

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
  const [isAccessibilityLight, setIsAccessibilityLight] = useState(false);
  
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
  const [workspaceData, setWorkspaceData] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const stored = localStorage.getItem('accessibilityLightMode');
    const enabled = stored === 'true';
    setIsAccessibilityLight(enabled);
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'accessibility-light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleAccessibilityLight = () => {
    const next = !isAccessibilityLight;
    setIsAccessibilityLight(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'accessibility-light');
      localStorage.setItem('accessibilityLightMode', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('accessibilityLightMode', 'false');
    }
  };

  const fetchWorkspaceData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const response = await api.getWorkspace(workspaceId);
      setWorkspaceData(response.data);
    } catch (error) {
      console.error('Failed to fetch workspace data:', error);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Acquire workspace lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      if (!workspaceId) return;
      try {
        const lockResult = await api.lockWorkspace(workspaceId, false);
        if (lockResult.locked) {
          toast.error(`Another user (${lockResult.locked_by}) is currently in this workspace.`);
          navigate(`/workspace/${workspaceSlug}/walkthroughs`);
        }
      } catch (error) {
        console.error('Failed to acquire workspace lock:', error);
      }
    };

    if (workspaceId) {
      acquireLock();
    }

    // Release lock on unmount (ignore errors - idempotent)
    return () => {
      if (workspaceId) {
        api.unlockWorkspace(workspaceId).catch(() => {
          // Ignore unlock errors - lock may already be released or expired
        });
      }
    };
  }, [workspaceId, workspaceSlug, navigate]);

  // Show error if workspace fetch failed
  useEffect(() => {
    if (workspaceError && !workspaceLoading) {
      const errorMessage = workspaceError.message || 'Failed to load workspace';
      const errorStatus = workspaceError.status;
      
      if (errorStatus === 403) {
        toast.error('Access denied: You do not have permission to access this workspace');
      } else if (errorStatus === 404) {
        toast.error('Workspace not found');
      } else {
        toast.error(errorMessage);
      }
      
      navigate('/dashboard');
    }
  }, [workspaceError, workspaceLoading, navigate]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await api.getCategories(workspaceId);
      const normalized = normalizeCategories(normalizeImageUrlsInObject(response.data));
      setCategories(normalized);
    } catch (error) {
      console.error('Failed to load categories');
    }
  }, [workspaceId]);

  const normalizeCategoryIds = useCallback((ids) => (
    Array.isArray(ids)
      ? ids
          .map((id) => (id === null || id === undefined ? null : String(id)))
          .filter((id) => id !== null)
      : []
  ), []);

  const flattenedCategories = useMemo(() => getFlattenedCategories(categories), [categories]);

  const categoryHierarchy = useMemo(() => {
    const parentMap = new Map();
    const childrenMap = new Map();

    categories.forEach((category) => {
      if (!category?.id) return;
      const id = category.id;
      const parentId = category.parent_id || null;
      parentMap.set(id, parentId);

      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      if (!childrenMap.has(id)) {
        childrenMap.set(id, []);
      }
      childrenMap.get(parentId).push(id);
    });

    const getAncestors = (id) => {
      const ancestors = [];
      let current = parentMap.get(id);
      while (current) {
        ancestors.push(current);
        current = parentMap.get(current);
      }
      return ancestors;
    };

    const getDescendants = (id) => {
      const descendants = [];
      const stack = [...(childrenMap.get(id) || [])];
      while (stack.length) {
        const childId = stack.pop();
        descendants.push(childId);
        const childChildren = childrenMap.get(childId);
        if (childChildren?.length) {
          stack.push(...childChildren);
        }
      }
      return descendants;
    };

    return { getAncestors, getDescendants };
  }, [categories]);

  const applyHierarchySelection = useCallback((previousIds = [], categoryId, isSelected) => {
    const nextIds = new Set(previousIds);

    if (isSelected) {
      nextIds.add(categoryId);
      categoryHierarchy.getAncestors(categoryId).forEach((ancestorId) => nextIds.add(ancestorId));
    } else {
      nextIds.delete(categoryId);
      categoryHierarchy.getDescendants(categoryId).forEach((descendantId) => nextIds.delete(descendantId));
    }

    const ordered = [];
    flattenedCategories.forEach(({ id }) => {
      if (nextIds.has(id)) {
        ordered.push(id);
        nextIds.delete(id);
      }
    });
    nextIds.forEach((id) => ordered.push(id));

    return ordered;
  }, [categoryHierarchy, flattenedCategories]);

  const enforceHierarchySelection = useCallback((ids = []) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return Array.isArray(ids) ? ids : [];
    }
    return ids.reduce((acc, id) => applyHierarchySelection(acc, id, true), []);
  }, [applyHierarchySelection]);

  const loadWalkthrough = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getWalkthrough(workspaceId, walkthroughId);
      const normalized = normalizeImageUrlsInObject(response.data);
      
      console.log('[BuilderV2] Loaded walkthrough:', walkthroughId);
      console.log('[BuilderV2] Steps count:', normalized.steps?.length || 0);
      
      // Ensure blocks array exists and is properly structured
      if (normalized.steps) {
        normalized.steps = normalized.steps.map((step, idx) => {
          const blocks = (step.blocks || []).map(block => ({
            id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: block.type || 'text',
            data: block.data || {},
            settings: block.settings || {}
          }));
          
          console.log(`[BuilderV2] Step ${idx + 1} has ${blocks.length} blocks:`, blocks.map(b => b.type));
          
          return {
            ...step,
            blocks
          };
        });
      }
      const normalizedCategoryIds = normalizeCategoryIds(normalized.category_ids);
      const enforcedCategoryIds = enforceHierarchySelection(normalizedCategoryIds);
      setWalkthrough({ ...normalized, category_ids: enforcedCategoryIds });
      setSetupData({
        title: normalized.title || '',
        description: normalized.description || '',
        icon_url: normalized.icon_url || '',
        category_ids: enforcedCategoryIds
      });
      if (normalized.steps && normalized.steps.length > 0) {
        setCurrentStepIndex(0);
      }
    } catch (error) {
      toast.error('Failed to load walkthrough');
      navigate(`/workspace/${workspaceSlug}/walkthroughs`.replace(/\/+/g, '/'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, walkthroughId, navigate, workspaceSlug]);

  // Load categories and walkthrough if editing
  useEffect(() => {
    if (!workspaceId || workspaceLoading) return; // Wait for workspace ID to be resolved
    if (workspaceError) return; // Don't fetch if there was an error
    
    loadCategories();
    
    if (isEditing && walkthroughId) {
      loadWalkthrough();
    }
  }, [isEditing, walkthroughId, workspaceId, workspaceLoading, workspaceError, loadCategories, loadWalkthrough]);

  useEffect(() => {
    if (setupComplete || isEditing) return;
    const session = getOnboardingSession();
    if (!session?.active || !session.categoryId) return;
    const sessionCategoryId = String(session.categoryId);
    if (!categories.some(category => category.id === sessionCategoryId)) return;
    setSetupData(prev => (
      prev.category_ids.includes(sessionCategoryId)
        ? prev
        : { ...prev, category_ids: applyHierarchySelection(prev.category_ids, sessionCategoryId, true) }
    ));
  }, [categories, setupComplete, isEditing, applyHierarchySelection]);

  useEffect(() => {
    if (!categories.length) return;

    setSetupData(prev => {
      const enforced = enforceHierarchySelection(prev.category_ids);
      return arraysEqual(enforced, prev.category_ids) ? prev : { ...prev, category_ids: enforced };
    });

    setWalkthrough(prev => {
      if (!prev) return prev;
      const enforced = enforceHierarchySelection(prev.category_ids);
      return arraysEqual(enforced, prev.category_ids) ? prev : { ...prev, category_ids: enforced };
    });
  }, [categories, enforceHierarchySelection]);

  // Save walkthrough
  const saveWalkthrough = async () => {
    try {
      setIsSaving(true);
      
      // Save walkthrough metadata
      // CRITICAL: Always save as draft unless explicitly publishing
      // This ensures save/autosave doesn't accidentally publish
      const walkthroughData = {
        title: walkthrough.title || '',
        description: walkthrough.description || '',
        privacy: walkthrough.privacy || 'public',
        category_ids: walkthrough.category_ids || [],
        navigation_type: walkthrough.navigation_type || 'next_prev',
        navigation_placement: walkthrough.navigation_placement || 'bottom',
        status: 'draft',  // Always save as draft - publish is separate action
      };

      console.log('[BuilderV2] walkthough metadata payload', walkthroughData);
      console.log('[BuilderV2] current steps snapshot for save', walkthrough.steps);

      let finalWalkthroughId = walkthroughId;

      if (isEditing) {
        console.log('[BuilderV2] updateWalkthrough payload', {
          workspaceId,
          walkthroughId,
          walkthroughData
        });
        await api.updateWalkthrough(workspaceId, walkthroughId, walkthroughData);
      } else {
        const response = await api.createWalkthrough(workspaceId, walkthroughData);
        finalWalkthroughId = response.data.id;
        navigate(`/workspace/${workspaceSlug}/walkthroughs/${finalWalkthroughId}/edit`.replace(/\/+/g, '/'), { replace: true });
        toast.success('Walkthrough created');
      }

      // Save all steps with their blocks
      if (finalWalkthroughId && walkthrough.steps) {
        for (const step of walkthrough.steps) {
          // CRITICAL: Ensure blocks are properly structured before sending
          const blocks = (step.blocks || []).map(block => {
            if (!block || typeof block !== 'object') {
              console.warn('[BuilderV2] Invalid block found:', block);
              return null;
            }
            return {
              id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: block.type || 'text',
              data: block.data || {},
              settings: block.settings || {}
            };
          }).filter(b => b !== null); // {t('builder.placeholders.remove')} null blocks
          
          const stepData = {
            title: step.title || '',
            content: step.content || '', // Required by backend StepCreate model
            blocks: blocks,
            navigation_type: step.navigation_type || 'next_prev',
            order: step.order || 0,
            common_problems: step.common_problems || [],
          };

          console.log(`[BuilderV2] Saving step ${step.id} with ${blocks.length} blocks:`, blocks.map(b => b.type));
          const calloutBlocks = blocks.filter(b => b.type === BLOCK_TYPES.CALLOUT);
          if (calloutBlocks.length) {
            console.log('[BuilderV2] Callout block payload(s)', calloutBlocks);
          }

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


  // Handle setup form submission - create walkthrough with metadata
  const handleSetupComplete = async () => {
    if (!setupData.title || !setupData.title.trim()) {
      toast.error('Please enter a walkthrough name');
      return;
    }
    if (!setupData.description || !setupData.description.trim()) {
      toast.error('Please enter a walkthrough description');
      return;
    }
    const onboardingSession = getOnboardingSession();
    if (onboardingSession?.active && onboardingSession.categoryId && !setupData.category_ids.includes(onboardingSession.categoryId)) {
      toast.error('Please select the category you just created');
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
      navigate(`/workspace/${workspaceSlug}/walkthroughs/${newWalkthroughId}/edit`.replace(/\/+/g, '/'), { replace: true });
      toast.success('Walkthrough created! Start adding steps.');
      emitOnboardingEvent('onboarding:walkthroughCreated', { walkthroughId: newWalkthroughId, categoryIds: walkthroughData.category_ids || [] });
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
      if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
        emitOnboardingEvent('onboarding:stepTitleUpdated', { title: updates.title });
      }
    }
  }, [walkthrough.steps, currentStepIndex, emitOnboardingEvent]);

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
      emitOnboardingEvent('onboarding:blockAdded', { blockType: newBlock.type, stepIndex: currentStepIndex });
    } catch (error) {
      console.error('Error adding block:', error);
      toast.error('Failed to add block');
    }
  }, [walkthrough.steps, currentStepIndex, emitOnboardingEvent]);

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

  if (loading || workspaceLoading || !workspaceId) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-secondary dark:bg-black">
        <WorkspaceLoader size={160} />
      </div>
    );
  }

  // Show setup form for new walkthroughs before allowing step creation
  if (!setupComplete && !isEditing) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-secondary p-8">
        <div className="w-full max-w-2xl bg-card rounded-lg shadow-lg border border-border p-8 max-h-[90vh] overflow-y-auto" data-onboarding="walkthrough-setup-form">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold text-foreground">{t('walkthrough.createNew')}</h2>
            <p className="text-sm text-muted-foreground">{t('walkthrough.setupBeforeSteps')}</p>
          </div>

          <div className="space-y-6">
                {/* Walkthrough Name */}
                <div>
                  <Label htmlFor="title" className="text-sm font-medium text-foreground mb-2 block">
                    {t('walkthrough.name')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={setupData.title}
                    onChange={(e) => setSetupData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('walkthrough.enterName')}
                    className="w-full"
                    data-testid="walkthrough-name-input"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-foreground mb-2 block">
                    {t('common.description')}
                  </Label>
                  <Textarea
                    id="description"
                    value={setupData.description}
                    onChange={(e) => setSetupData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('walkthrough.enterDescription')}
                    rows={3}
                    className="w-full"
                  />
                </div>

                {/* Icon/Photo */}
                <div>
                  <Label className="text-sm font-medium text-foreground mb-2 block">
                    {t('walkthrough.iconPhoto')}
                  </Label>
                  {setupData.icon_url ? (
                    <div className="space-y-2">
                      <img
                        src={normalizeImageUrl(setupData.icon_url)}
                        alt={t('walkthrough.labels.iconPreview')}
                        className="w-24 h-24 rounded-lg object-cover border border-border"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSetupData(prev => ({ ...prev, icon_url: '' }))}
                      >
                        {t('builder.placeholders.remove')}
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
                      <p className="text-sm text-muted-foreground">{t('walkthrough.or')}</p>
                      <Input
                        placeholder={t('walkthrough.enterImageUrl')}
                        value={setupData.icon_url}
                        onChange={(e) => setSetupData(prev => ({ ...prev, icon_url: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-sm font-medium text-foreground mb-2 block">
                    {t('common.categories')}
                  </Label>
                  {flattenedCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('walkthrough.noCategories')}</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                      {flattenedCategories.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2"
                          style={{ paddingLeft: option.depth * 16 }}
                        >
                          <Checkbox
                            id={`cat-${option.id}`}
                            checked={setupData.category_ids.includes(option.id)}
                            onCheckedChange={(checked) => {
                              const optionId = option.id;
                              setSetupData(prev => ({
                                ...prev,
                                category_ids: applyHierarchySelection(prev.category_ids, optionId, checked === true),
                              }));
                            }}
                          />
                          <Label htmlFor={`cat-${option.id}`} className="text-sm cursor-pointer">
                            {option.label}
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
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('onboarding:dialogClosed'));
                      navigate('/dashboard');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleSetupComplete}
                    disabled={
                      !setupData.title?.trim() ||
                      !setupData.description?.trim() ||
                      loading ||
                      uploadingIcon ||
                      (() => {
                        const currentSession = getOnboardingSession();
                        return currentSession?.active &&
                          currentSession.categoryId &&
                          !setupData.category_ids.includes(currentSession.categoryId);
                      })()
                    }
                    className="flex-1"
                    data-onboarding="walkthrough-setup-submit"
                  >
                    {loading ? t('common.creating') : t('walkthrough.createWalkthrough')}
                  </Button>
                </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-secondary dark:bg-black overflow-hidden" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh' }}>
      {/* Zone 1: Top Command Bar (Fixed Height) */}
      <div className="h-14 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          
          <div className="h-6 w-px bg-slate-200" />
          
          <div className="flex items-center gap-2">
            {isSaving && <Clock className="w-4 h-4 text-muted-foreground animate-spin" />}
            {lastSaved && !isSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-600" />
                Saved {Math.round((new Date() - lastSaved) / 1000)}s ago
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleAccessibilityLight}
            data-testid="accessibility-light-toggle"
            className="rounded-full h-9 w-9 p-0"
          >
            <Sun className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <Button variant="secondary" size="sm" disabled title={t('builder.buttons.undo')}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" disabled title={t('builder.buttons.redo')}>
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/portal/${workspaceSlug}/${walkthroughId || 'preview'}`, '_blank')}
          >
            <Eye className="w-4 h-4 mr-2" />
            {t('walkthrough.preview')}
          </Button>
          <Button size="sm" onClick={saveWalkthrough} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {t('common.save')}
          </Button>
          {walkthroughId && walkthroughId !== 'new' && (
            <Button 
              size="sm" 
              onClick={async () => {
                try {
                  setIsSaving(true);
                  await api.updateWalkthrough(workspaceId, walkthroughId, { ...walkthrough, status: 'published' });
                  setWalkthrough(prev => ({ ...prev, status: 'published' }));
                  toast.success('Walkthrough published!');
                } catch (error) {
                  console.error('Failed to publish:', error);
                  toast.error(error.response?.data?.detail || 'Failed to publish walkthrough');
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('walkthrough.publish')}
            </Button>
          )}
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
                title: `${t('walkthrough.step')} ${walkthrough.steps.length + 1}`,
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
              emitOnboardingEvent('onboarding:stepAdded', { stepId: newStep.id, stepIndex: newIndex });
              
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
        <div className="flex-1 overflow-y-auto bg-secondary dark:bg-background min-w-0">
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
            walkthrough={walkthrough}
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
  const { t } = useTranslation();
  
  const [hoveredIndex, setHoveredIndex] = useState(null);
  return (
    <div className="w-64 flex-shrink-0 border-r border-border bg-card overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t('walkthrough.steps')}</h2>
        <Button variant="secondary" size="sm" onClick={onAddStep} className="h-7 w-7 p-0" data-onboarding="add-step-button">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {steps.length === 0 ? (
          <div className="p-4 text-sm text-foreground text-center">
            {t('builder.noStepsYet')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-full">
            {steps.map((step, index) => (
              <div
                key={step.id || index}
                className={`p-3 cursor-pointer hover:bg-secondary transition-colors group relative ${
                  currentStepIndex === index ? 'bg-secondary border-l-2 border-primary' : ''
                }`}
                onClick={() => onStepClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-foreground w-6 flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {step.title || t('builder.stepDefault', { number: index + 1 })}
                    </div>
                  </div>
                  {onDeleteStep && steps.length > 1 && hoveredIndex === index && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t('dialogs.confirm.deleteStep', { number: index + 1 }))) {
                          onDeleteStep(index);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1"
                      title={t('builder.labels.deleteStep')}
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
  canUploadFile,
  walkthrough
}) => {
  const { t } = useTranslation();
  if (!currentStep) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{t('builder.selectStepOrCreate')}</p>
        </div>
      </div>
    );
  }

  if (!onStepUpdate) {
    console.error('CanvasStage: onStepUpdate is required but not provided');
  }

  return (
    <div className="min-h-full flex items-start justify-center py-16 px-8">
      <div className="w-full max-w-[920px] bg-card rounded-lg shadow-sm border border-border min-h-[600px] p-12">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={blockItems} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {/* Step Title */}
              {onStepUpdate && currentStep && currentStep.id && (
                <StepTitleEditor
                  key={currentStep.id}
                  title={currentStep.title || ''}
                  onChange={(title) => {
                    if (onStepUpdate && isStepLoaded) {
                      onStepUpdate({ title });
                    }
                  }}
                  isStepLoaded={isStepLoaded}
                />
              )}

              {/* Step Navigation Type */}
              {onStepUpdate && currentStep && currentStep.id && (
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground">
                    {t('builder.navigationType')}
                  </Label>
                  <Select
                    value={currentStep.navigation_type || 'next_prev'}
                    onValueChange={(value) => {
                      if (onStepUpdate && isStepLoaded) {
                        onStepUpdate({ navigation_type: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next_prev">{t('builder.nextPrevious')}</SelectItem>
                      <SelectItem value="checkoff">{t('builder.checkoffRequired')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                        walkthrough={walkthrough}
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
              <div className="bg-card border-2 border-primary rounded-lg p-4 shadow-lg opacity-90">
                {blocks.find(b => b.id === activeBlockId)?.type || 'Block'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

// Step Title Editor - uses InlineRichEditor with center alignment persistence
const StepTitleEditor = ({ title, onChange, isStepLoaded }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [htmlContent, setHtmlContent] = useState(null);

  useEffect(() => {
    if (isStepLoaded && !isInitialized) {
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStepLoaded, isInitialized]);

  // Convert plain text title to HTML with center alignment if needed
  // Reset htmlContent when title prop changes (for different steps)
  useEffect(() => {
    // Always update htmlContent when title changes (don't check htmlContent state)
    if (title) {
      // If title is plain text, wrap it in a paragraph with center alignment
      if (!title.includes('<') && !title.includes('>')) {
        setHtmlContent(`<p style="text-align: center;">${title}</p>`);
      } else {
        setHtmlContent(title);
      }
    } else {
      setHtmlContent('<p style="text-align: center;"></p>');
    }
  }, [title]); // Only depend on title - reset when it changes

  const handleChange = useCallback((html) => {
    if (isInitialized && isStepLoaded && onChange) {
      setHtmlContent(html);
      // Extract plain text for backward compatibility with backend
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      onChange(plainText);
    }
  }, [isInitialized, isStepLoaded, onChange]);

  if (!onChange) {
    console.error('StepTitleEditor: onChange is required');
    return null;
  }

  return (
    <div data-onboarding="step-title-editor">
      <InlineRichEditor
        content={htmlContent || (title ? `<p style="text-align: center;">${title}</p>` : '<p style="text-align: center;"></p>')}
        onChange={handleChange}
        placeholder="Step title..."
        isRTL={false}
        textSize="text-3xl"
        isBold={true}
        align="center"
        className="text-foreground font-heading"
      />
    </div>
  );
};

// Add Block Button with Popover - Always visible, keyboard accessible
const AddBlockButton = ({ insertAfterIndex, onAdd, isOpen, onOpenChange }) => {
  const { t } = useTranslation();

  // Create a mapping of block types to display names
  const getBlockDisplayName = (type) => {
    const labelKey = getBlockLabelKey(type);
    const translated = t(labelKey);
    return translated;
  };

  // Get all block types from centralized registry - single source of truth
  const blockTypes = getAllBlockTypes();

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
          className="w-full h-8 flex items-center justify-center opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 focus:border-primary focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenChange) {
              onOpenChange(true);
            }
          }}
          aria-label={t('builder.labels.addBlock')}
          type="button"
          data-onboarding="add-block-button"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2 bg-card border-border shadow-lg z-[100]" 
        align="center" 
        side="bottom"
        sideOffset={4}
        collisionPadding={20}
        avoidCollisions={true}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[400px] overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-1.5 p-1">
            {blockTypes.map((type) => (
              <button
                key={type}
                className="p-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                onClick={() => handleAdd(type)}
                type="button"
              >
                <div className="text-lg mb-1">{getBlockIcon(type)}</div>
                <div className="text-xs font-medium leading-tight text-foreground">{getBlockDisplayName(type)}</div>
              </button>
            ))}
          </div>
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
  canUploadFile,
  walkthrough
}) => {
  const { t } = useTranslation();
  
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
    if (window.confirm(t('dialogs.confirm.deleteBlock'))) {
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
          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-muted-foreground"
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
            walkthrough={walkthrough}
          />
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
            title={t('builder.labels.deleteBlock')}
            aria-label={t('builder.labels.deleteBlock')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Block Content Renderer
const BlockContent = ({ block, onUpdate, onDelete, workspaceId, walkthroughId, stepId, onMediaUpload, canUploadFile, walkthrough }) => {
  const { t } = useTranslation();

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
            placeholder={t('builder.placeholders.headingText')}
            textSize={headingSize}
            isBold={true}
            className="text-foreground text-gray-900 text-center"
            align="center"
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
          textAlign="center"
          variant="builder"
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
                placeholder={t('builder.placeholders.addCaption')}
                className="text-sm text-center"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && onMediaUpload(e.target.files[0], block.id)}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground mt-2">{t('builder.placeholders.or')}</p>
              <Input
                placeholder={t('builder.blockSettings.url')}
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
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files[0] && onMediaUpload(e.target.files[0], block.id)}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground mt-2">{t('builder.messages.orYouTubeUrl')}</p>
              <Input
                placeholder={t('builder.blockSettings.url')}
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
      // Default button text based on action
      const getDefaultButtonText = (action) => {
        const defaults = {
          next: 'builder.buttonDefaults.next',
          go_to_step: 'builder.buttonDefaults.goToStep',
          end: 'builder.buttonDefaults.end',
          restart: 'builder.buttonDefaults.restart',
          support: 'builder.buttonDefaults.support',
          link: 'builder.buttonDefaults.link',
          check: 'builder.buttonDefaults.check'
        };
        return defaults[action] || 'builder.buttonDefaults.button';
      };
      
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.buttonText')}</Label>
            <Input
              value={block.data.text || ''}
              onChange={(e) => onUpdate({ data: { ...block.data, text: e.target.value } })}
              placeholder={t(getDefaultButtonText(block.data.action || 'next'))}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.action')}</Label>
            <Select
              value={block.data.action || 'next'}
              onValueChange={(value) => {
                // Auto-fill button text if empty or matches previous default
                const currentAction = block.data.action || 'next';
                const currentText = block.data.text || '';
                const previousDefault = getDefaultButtonText(currentAction);
                const newDefault = getDefaultButtonText(value);
                
                // Update text if it's empty or still using the previous default
                const shouldUpdateText = !currentText || currentText === previousDefault;
                
                onUpdate({ 
                  data: { 
                    ...block.data, 
                    action: value,
                    text: shouldUpdateText ? newDefault : currentText
                  } 
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">{t('builder.buttonActions.next')}</SelectItem>
                <SelectItem value="go_to_step">{t('builder.buttonActions.goToStep')}</SelectItem>
                <SelectItem value="end">{t('builder.buttonActions.end')}</SelectItem>
                <SelectItem value="restart">{t('builder.buttonActions.restart')}</SelectItem>
                <SelectItem value="support">{t('builder.buttonActions.support')}</SelectItem>
                <SelectItem value="link">{t('builder.buttonActions.link')}</SelectItem>
                <SelectItem value="check">{t('builder.buttonActions.check')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Go to Step: Show step selector */}
          {block.data.action === 'go_to_step' && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Target Step</Label>
              <Select
                value={block.data.targetStepId || ''}
                onValueChange={(value) => onUpdate({ data: { ...block.data, targetStepId: value } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select step..." />
                </SelectTrigger>
                <SelectContent>
                  {(walkthrough?.steps || []).map((step, idx) => (
                    <SelectItem key={step.id} value={step.id}>
                      {idx + 1}. {step.name || 'Untitled Step'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!walkthrough?.steps || walkthrough.steps.length === 0) && (
                <p className="text-xs text-muted-foreground mt-1">{t('builder.placeholders.addMoreSteps')}</p>
              )}
            </div>
          )}
          
          {/* External Link: Show URL field */}
          {block.data.action === 'link' && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">URL</Label>
              <Input
                value={block.data.url || ''}
                onChange={(e) => onUpdate({ data: { ...block.data, url: e.target.value } })}
                placeholder="https://example.com"
              />
            </div>
          )}
          
          {/* Support: Show contact options */}
          {block.data.action === 'support' && (() => {
            // Check if workspace has any contact info
            const hasPortalContactInfo = workspaceData && (
              workspaceData.contact_whatsapp || 
              workspaceData.contact_phone || 
              workspaceData.contact_hours
            );
            
            return (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={block.data.usePortalContactInfo !== false && hasPortalContactInfo}
                      onCheckedChange={(checked) => onUpdate({ data: { ...block.data, usePortalContactInfo: checked } })}
                      id={`use-portal-${block.id}`}
                      disabled={!hasPortalContactInfo}
                    />
                    <Label 
                      htmlFor={`use-portal-${block.id}`} 
                      className={`text-xs ${hasPortalContactInfo ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                    >
                      Use workspace portal contact info
                    </Label>
                  </div>
                  {!hasPortalContactInfo && (
                    <p className="text-xs text-amber-600 ml-6">
                      No workspace contact info configured. Go to workspace settings to add WhatsApp, phone, or working hours.
                    </p>
                  )}
                </div>
              
              {(!hasPortalContactInfo || block.data.usePortalContactInfo === false) && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">WhatsApp Number</Label>
                    <Input
                      value={block.data.supportWhatsapp || ''}
                      onChange={(e) => onUpdate({ data: { ...block.data, supportWhatsapp: e.target.value } })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Phone Number</Label>
                    <Input
                      value={block.data.supportPhone || ''}
                      onChange={(e) => onUpdate({ data: { ...block.data, supportPhone: e.target.value } })}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Working Hours</Label>
                    <Input
                      value={block.data.supportHours || ''}
                      onChange={(e) => onUpdate({ data: { ...block.data, supportHours: e.target.value } })}
                      placeholder="Mon-Fri 9AM-5PM"
                    />
                  </div>
                </>
              )}
            </div>
            );
          })()}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.buttonStyle')}</Label>
              <Select
                value={block.data.style || 'primary'}
                onValueChange={(value) => onUpdate({ data: { ...block.data, style: value } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.alignment')}</Label>
              <Select
                value={block.data.alignment || 'center'}
                onValueChange={(alignment) => onUpdate({ data: { ...block.data, alignment } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">{t('builder.alignmentOptions.left')}</SelectItem>
                  <SelectItem value="center">{t('builder.alignmentOptions.center')}</SelectItem>
                  <SelectItem value="right">{t('builder.alignmentOptions.right')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );

    case BLOCK_TYPES.DIVIDER:
      return <div className="h-px bg-slate-200 w-full" />;

    case BLOCK_TYPES.SPACER:
      return <div style={{ height: block.data.height || 32 }} />;

    case BLOCK_TYPES.PROBLEM:
      return (
        <div className="border border-warning-300 rounded-lg p-4 bg-warning-50 space-y-3 text-foreground text-gray-900">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">{t('builder.problemTitle')}</Label>
            <InlineRichEditor
              content={block.data.title || ''}
              onChange={(html) => onUpdate({ data: { ...block.data, title: html } })}
              placeholder={t('builder.placeholders.problemTitle')}
              isRTL={false}
              textSize="text-base"
              isBold={true}
              align="left"
              className="text-foreground text-gray-900"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block font-medium">{t('builder.problemExplanation')}</Label>
            <InlineRichEditor
              content={block.data.explanation || ''}
              onChange={(html) => onUpdate({ data: { ...block.data, explanation: html } })}
              placeholder={t('builder.placeholders.explanation')}
              isRTL={false}
              textSize="text-sm"
              isBold={false}
              align="left"
              className="text-foreground text-gray-900"
            />
          </div>
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

    case BLOCK_TYPES.CHECKLIST:
      const items = block.data?.items || [];
      return (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.checked || false}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx] = { ...item, checked: e.target.checked };
                  onUpdate({ data: { ...block.data, items: newItems } });
                }}
                className="mt-1 flex-shrink-0"
              />
              <Input
                value={item.text || ''}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx] = { ...item, text: e.target.value };
                  onUpdate({ data: { ...block.data, items: newItems } });
                }}
                placeholder={t('builder.placeholders.checklistItem')}
                className="flex-1 text-center"
              />
              <button
                onClick={() => {
                  const newItems = items.filter((_, i) => i !== idx);
                  onUpdate({ data: { ...block.data, items: newItems } });
                }}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newItems = [...items, { id: `item-${Date.now()}`, text: '', checked: false }];
              onUpdate({ data: { ...block.data, items: newItems } });
            }}
            className="text-foreground text-gray-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('builder.addItem')}
          </Button>
        </div>
      );

    case BLOCK_TYPES.CALLOUT:
      return (
        <div className={`border-l-4 rounded-lg p-4 ${
          block.data?.variant === 'warning' ? 'border-warning-500 bg-warning-50' :
          block.data?.variant === 'important' ? 'border-destructive bg-destructive/10' :
          block.data?.variant === 'info' ? 'border-blue-500 bg-blue-50' :
          'border-primary bg-primary/10'
        }`}>
          <div className="flex flex-wrap gap-4 mb-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {t('builder.blockSettings.variant')}
              </Label>
              <Select
                value={block.data?.variant || 'tip'}
                onValueChange={(variant) => onUpdate({ data: { ...block.data, variant } })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tip">💡 {t('builder.calloutTip')}</SelectItem>
                  <SelectItem value="warning">⚠️ {t('builder.calloutWarning')}</SelectItem>
                  <SelectItem value="important">❗ {t('builder.calloutImportant')}</SelectItem>
                  <SelectItem value="info">ℹ️ {t('builder.calloutInfo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <RichTextEditor
            content={block.data?.content || ''}
            onChange={(content) => onUpdate({ data: { ...block.data, content } })}
            variant="builder"
          />
        </div>
      );

    case BLOCK_TYPES.ANNOTATED_IMAGE:
      return (
        <AnnotatedImageBlockEditor
          block={block}
          onUpdate={onUpdate}
          onMediaUpload={onMediaUpload}
          canUploadFile={canUploadFile}
        />
      );

    case BLOCK_TYPES.EMBED:
      // Transform URL based on provider
      const getEmbedUrl = (url, provider) => {
        if (!url) return '';
        
        try {
          switch (provider) {
            case 'youtube':
              // Convert YouTube watch URLs to embed format
              if (url.includes('youtube.com/watch')) {
                const videoId = url.split('v=')[1]?.split('&')[0];
                return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
              } else if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
              } else if (url.includes('youtube.com/embed/')) {
                return url; // Already in embed format
              }
              return url;
              
            case 'vimeo':
              // Convert Vimeo URLs to embed format
              if (url.includes('vimeo.com/') && !url.includes('/video/')) {
                const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
                return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
              }
              return url;
              
            case 'loom':
              // Loom share URLs to embed format
              if (url.includes('loom.com/share/')) {
                const videoId = url.split('/share/')[1]?.split('?')[0];
                return videoId ? `https://www.loom.com/embed/${videoId}` : url;
              }
              return url;
              
            case 'figma':
              // Figma URLs need embed parameter
              if (url.includes('figma.com/') && !url.includes('embed')) {
                return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
              }
              return url;
              
            case 'google_docs':
              // Google Docs need /preview or /pub?embedded=true
              if (url.includes('docs.google.com/document/')) {
                const docId = url.split('/d/')[1]?.split('/')[0];
                return docId ? `https://docs.google.com/document/d/${docId}/preview` : url;
              } else if (url.includes('docs.google.com/presentation/')) {
                const docId = url.split('/d/')[1]?.split('/')[0];
                return docId ? `https://docs.google.com/presentation/d/${docId}/embed` : url;
              } else if (url.includes('docs.google.com/spreadsheets/')) {
                const docId = url.split('/d/')[1]?.split('/')[0];
                return docId ? `https://docs.google.com/spreadsheets/d/${docId}/preview` : url;
              }
              return url;
              
            default:
              return url;
          }
        } catch (error) {
          console.error('Error transforming embed URL:', error);
          return url;
        }
      };
      
      const embedUrl = getEmbedUrl(block.data?.url, block.data?.provider || 'youtube');
      
      return (
        <div className="space-y-3">
          <Select
            value={block.data?.provider || 'youtube'}
            onValueChange={(provider) => onUpdate({ data: { ...block.data, provider } })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="vimeo">Vimeo</SelectItem>
              <SelectItem value="loom">Loom</SelectItem>
              <SelectItem value="figma">Figma</SelectItem>
              <SelectItem value="google_docs">Google Docs</SelectItem>
              <SelectItem value="notebooklm">NotebookLM</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={block.data?.url || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, url: e.target.value } })}
            placeholder={`Paste ${block.data?.provider || 'YouTube'} URL`}
          />
          {block.data?.url && (
            <div className="aspect-video border border-border rounded-lg overflow-hidden bg-secondary">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          )}
        </div>
      );

    case BLOCK_TYPES.SECTION:
      const sectionBlocks = block.data?.blocks || [];
      return (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <Input
            value={block.data?.title || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, title: e.target.value } })}
            placeholder={t('builder.placeholders.sectionTitle')}
            className="font-semibold text-center"
          />
          <div className="text-sm text-muted-foreground">
            {t('builder.placeholders.sectionNotSupported')}
          </div>
        </div>
      );

    case BLOCK_TYPES.CONFIRMATION:
      return (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <RichTextEditor
            content={block.data?.message || ''}
            onChange={(message) => onUpdate({ data: { ...block.data, message } })}
            textAlign="center"
            variant="builder"
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" disabled className="w-5 h-5 rounded border-primary/30" />
            <span className="text-sm text-muted-foreground">{t('builder.confirmationPreview')}</span>
          </div>
        </div>
      );

    case BLOCK_TYPES.EXTERNAL_LINK:
      return (
        <div className="space-y-3">
          <Input
            value={block.data?.text || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, text: e.target.value } })}
            placeholder="Link text"
          />
          <Input
            value={block.data?.url || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, url: e.target.value } })}
            placeholder="URL"
            type="url"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={block.data?.openInNewTab !== false}
              onChange={(e) => onUpdate({ data: { ...block.data, openInNewTab: e.target.checked } })}
              className="flex-shrink-0"
            />
            <Label className="text-sm">{t('builder.openInNewTab')}</Label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.alignment')}</Label>
            <Select
              value={block.data?.alignment || 'center'}
              onValueChange={(alignment) => {
                if (!alignment) {
                  onUpdate({ data: { ...block.data, alignment: undefined } });
                } else {
                  onUpdate({ data: { ...block.data, alignment } });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">{t('builder.alignmentOptions.left')}</SelectItem>
                <SelectItem value="center">{t('builder.alignmentOptions.center')}</SelectItem>
                <SelectItem value="right">{t('builder.alignmentOptions.right')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case BLOCK_TYPES.CODE:
      return (
        <div className="space-y-3">
          <Select
            value={block.data?.language || 'bash'}
            onValueChange={(language) => onUpdate({ data: { ...block.data, language } })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bash">Bash</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={block.data?.code || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, code: e.target.value } })}
            placeholder={t('builder.placeholders.enterCode')}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
      );

    case BLOCK_TYPES.HTML:
      return (
        <div className="space-y-3">
          <Textarea
            value={block.data?.html || ''}
            onChange={(e) => onUpdate({ data: { ...block.data, html: e.target.value } })}
            placeholder={t('builder.placeholders.enterHtml')}
            rows={8}
            className="font-mono text-sm"
          />
          {block.data?.html && (
            <div className="border border-border rounded-lg p-4">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.data?.html || '') }}
              />
            </div>
          )}
        </div>
      );

    case BLOCK_TYPES.FILE:
      return (
        <div className="space-y-3">
          {block.data?.url ? (
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{block.data.name || 'File'}</div>
                  <div className="text-sm text-muted-foreground">
                    {block.data.size ? `${(block.data.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdate({ data: { ...block.data, url: '', name: '', size: 0, type: '' } })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <a
                href={block.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mt-2"
              >
                <Download className="w-4 h-4" />
                Download File
              </a>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file && onMediaUpload) {
                    onMediaUpload(file, block.id);
                  }
                }}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground mt-2">{t('builder.placeholders.or')}</p>
              <Input
                placeholder={t('builder.placeholders.fileUrl')}
                onBlur={(e) => {
                  if (e.target.value) {
                    onUpdate({ data: { ...block.data, url: e.target.value } });
                  }
                }}
                className="mt-2"
              />
            </div>
          )}
        </div>
      );

    case BLOCK_TYPES.COLUMNS: {
      const getDefaultColumnButtonText = (action) => {
        const defaults = {
          next: 'builder.buttonDefaults.next',
          go_to_step: 'builder.buttonDefaults.goToStep',
          end: 'builder.buttonDefaults.end',
          restart: 'builder.buttonDefaults.restart',
          support: 'builder.buttonDefaults.support',
          link: 'builder.buttonDefaults.link',
          check: 'builder.buttonDefaults.check'
        };
        return defaults[action] || 'builder.buttonDefaults.button';
      };

      const updateColumnButton = (key, buttonData) => {
        onUpdate({ data: { ...block.data, [key]: buttonData } });
      };

      const renderColumnButtonControls = (columnKey) => {
        const buttonData = block.data?.[columnKey] || null;
        const buttonAction = buttonData?.action || 'next';

        return (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.buttonText')}</Label>
            <Input
              value={buttonData?.text || ''}
              onChange={(e) => {
                const text = e.target.value;
                if (!text) {
                  updateColumnButton(columnKey, null);
                  return;
                }
                const existing = buttonData || { action: 'next' };
                updateColumnButton(columnKey, { ...existing, text });
              }}
              placeholder={t(getDefaultColumnButtonText(buttonAction))}
            />

            <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.blockSettings.action')}</Label>
            <Select
              value={buttonAction}
              onValueChange={(value) => {
                const existing = buttonData || {};
                const currentAction = existing.action || 'next';
                const currentText = existing.text || '';
                const previousDefault = getDefaultColumnButtonText(currentAction);
                const newDefault = getDefaultColumnButtonText(value);
                const shouldUpdateText = !currentText || currentText === previousDefault;

                updateColumnButton(columnKey, {
                  ...existing,
                  action: value,
                  text: shouldUpdateText ? newDefault : currentText || newDefault
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">{t('builder.buttonActions.next')}</SelectItem>
                <SelectItem value="go_to_step">{t('builder.buttonActions.goToStep')}</SelectItem>
                <SelectItem value="end">{t('builder.buttonActions.end')}</SelectItem>
                <SelectItem value="restart">{t('builder.buttonActions.restart')}</SelectItem>
                <SelectItem value="support">{t('builder.buttonActions.support')}</SelectItem>
                <SelectItem value="link">{t('builder.buttonActions.link')}</SelectItem>
                <SelectItem value="check">{t('builder.buttonActions.check')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      };

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.placeholders.column1')}</Label>
                <RichTextEditor
                  content={block.data?.column1 || ''}
                  onChange={(content) => onUpdate({ data: { ...block.data, column1: content } })}
                  variant="builder"
                />
              </div>
              {renderColumnButtonControls('column1Button')}
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">{t('builder.placeholders.column2')}</Label>
                <RichTextEditor
                  content={block.data?.column2 || ''}
                  onChange={(content) => onUpdate({ data: { ...block.data, column2: content } })}
                  variant="builder"
                />
              </div>
              {renderColumnButtonControls('column2Button')}
            </div>
          </div>
        </div>
      );
    }

    default:
      return <div className="text-muted-foreground text-sm">Unknown block type: {block.type}</div>;
  }
};

// Supported annotation types - single source of truth
const SUPPORTED_ANNOTATION_TYPES = ['dot', 'rectangle', 'arrow', 'line'];

// Annotated Image Block Editor Component - ENHANCED: smooth drag, resize corners, inline popup
const AnnotatedImageBlockEditor = ({ block, onUpdate, onMediaUpload, canUploadFile }) => {
  const { t } = useTranslation();
  
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [editingMarker, setEditingMarker] = useState(null);
  const [draggingMarker, setDraggingMarker] = useState(null);
  const [resizingMarker, setResizingMarker] = useState(null);
  const [resizeCorner, setResizeCorner] = useState(null);
  const [interactionMode, setInteractionMode] = useState('idle'); // 'idle' | 'dragging' | 'resizing' | 'rotating' | 'resizing_start' | 'resizing_end'
  const imageRef = React.useRef(null);
  const dragStartPos = React.useRef(null);
  const animationFrameRef = React.useRef(null);
  
  const imageUrl = block.data?.url ? normalizeImageUrl(block.data.url) : null;
  const markers = block.data?.markers || [];
  
  // Add marker at click position (percentage-based)
  const handleImageClick = (e) => {
    if (!imageRef.current || interactionMode !== 'idle') return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    
    // Ensure ALL annotation types save identical x,y coordinates
    const baseX = Math.max(0, Math.min(100, x));
    const baseY = Math.max(0, Math.min(100, y));

    const newMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: baseX, // IDENTICAL for all annotation types
      y: baseY, // IDENTICAL for all annotation types
      shape: 'dot', // 'dot', 'rectangle', 'arrow', or 'line'
      size: 30, // Diameter in pixels for dot
      width: 10, // Width in % for rectangle
      height: 10, // Height in % for rectangle
      length: 80, // Length in pixels for arrow
      rotation: 0, // Rotation in radians for arrow (0-2π)
      x1: Math.max(0, Math.min(100, baseX - 10)), // Start point for line (relative to base position)
      y1: Math.max(0, Math.min(100, baseY)), // Start point for line
      x2: Math.max(0, Math.min(100, baseX + 10)), // End point for line (relative to base position)
      y2: Math.max(0, Math.min(100, baseY)), // End point for line
      color: '#3b82f6', // Default blue color
      title: '',
      description: ''
    };


    
    const newMarkers = [...markers, newMarker];
    onUpdate({ data: { ...block.data, markers: newMarkers } });
    setEditingMarker(markers.length); // Edit the new marker
  };
  
  const updateMarker = (index, updates) => {
    const newMarkers = [...markers];
    newMarkers[index] = { ...newMarkers[index], ...updates };
    onUpdate({ data: { ...block.data, markers: newMarkers } });
  };
  
  const deleteMarker = (index) => {
    const newMarkers = markers.filter((_, i) => i !== index);
    onUpdate({ data: { ...block.data, markers: newMarkers } });
    if (editingMarker === index) setEditingMarker(null);
    if (selectedMarker === index) setSelectedMarker(null);
    if (draggingMarker === index) setDraggingMarker(null);
    if (resizingMarker === index) setResizingMarker(null);
  };
  
  // Drag handlers - smooth with RAF
  const handleMarkerPointerDown = (e, index) => {
    // Early return if already resizing (any mode)
    if (interactionMode === 'resizing' || interactionMode === 'resizing-dot') {
      return;
    }
    // Don't start dragging if clicking on a resize handle
    if (e.target.hasAttribute('data-resize-handle') || e.target.closest('[data-resize-handle]')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    setInteractionMode('dragging');
    setDraggingMarker(index);
    setEditingMarker(null);
    const rect = imageRef.current.getBoundingClientRect();
    dragStartPos.current = { x: e.clientX, y: e.clientY, rect };
  };
  
  const handleResizePointerDown = (e, index, corner) => {
    e.stopPropagation();
    e.preventDefault();
    // Set pointer capture so resize continues even outside bounds
    e.currentTarget.setPointerCapture(e.pointerId);
    setInteractionMode('resizing');
    setResizingMarker(index);
    setResizeCorner(corner);
    setEditingMarker(null);
    const rect = imageRef.current.getBoundingClientRect();
    dragStartPos.current = { x: e.clientX, y: e.clientY, rect };
  };

  // Dot resize handle handlers (must be on the handle itself due to pointer capture)
  const handleDotResizePointerDown = (e, index, marker) => {
    console.log('[Dot Resize] Handle pointer down', { index, marker, currentMode: interactionMode });
    e.stopPropagation();
    e.preventDefault();
    // Set pointer capture so resize continues even outside bounds
    e.currentTarget.setPointerCapture(e.pointerId);
    setInteractionMode('resizing');
    setResizingMarker(index);
    setResizeCorner('dot');
    setEditingMarker(null);

    const rect = imageRef.current.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    // Determine dominant axis based on initial pointer position relative to center
    const deltaX = Math.abs(startX - marker.x);
    const deltaY = Math.abs(startY - marker.y);
    const resizeAxis = deltaX > deltaY ? 'x' : 'y';

    // Store start position for the dominant axis only
    const startPos = resizeAxis === 'x' ? startX : startY;
    const startSize = marker.size || 30;

    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      rect,
      resizeAxis,
      startPos,
      startSize
    };

    console.log('[Dot Resize] Stored dragStartPos', dragStartPos.current);
  };

  const handleArrowPointerDown = (e, index, action) => {
    console.log('[Arrow] Handle pointer down', { index, action, currentMode: interactionMode });
    e.stopPropagation();
    e.preventDefault();
    // Set pointer capture so interaction continues even outside bounds
    e.currentTarget.setPointerCapture(e.pointerId);

    if (action === 'move') {
      setInteractionMode('dragging');
      setDraggingMarker(index);
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];
      // Store initial marker position for correct delta calculation
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        rect,
        initialX: marker.x,
        initialY: marker.y
      };
    } else if (action === 'rotate') {
      setInteractionMode('rotating');
      setResizingMarker(index);
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];

      // Calculate center point
      const centerX = marker.x;
      const centerY = marker.y;

      // Calculate initial angle offset: currentRotation - angle from center to pointer
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
      const angleToPointer = Math.atan2(pointerY - centerY, pointerX - centerX);
      const initialOffset = (marker.rotation || 0) - angleToPointer;

      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        rect,
        centerX,
        centerY,
        initialOffset
      };
    } else if (action === 'resize') {
      setInteractionMode('resizing');
      setResizingMarker(index);
      setResizeCorner('arrow');
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];
      // Store initial length for delta-based resize
      dragStartPos.current = { 
        x: e.clientX, 
        y: e.clientY, 
        rect,
        initialLength: marker.length || 80
      };
    }

    console.log('[Arrow] Stored dragStartPos', dragStartPos.current);
  };

  const handleLinePointerDown = (e, index, action) => {
    console.log('[Line] Handle pointer down', { index, action, currentMode: interactionMode });
    e.stopPropagation();
    e.preventDefault();

    e.currentTarget.setPointerCapture(e.pointerId);

    if (action === 'move') {
      setInteractionMode('dragging');
      setDraggingMarker(index);
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];
      // Store initial pointer AND marker positions for correct delta calculation
      dragStartPos.current = { 
        x: e.clientX, 
        y: e.clientY, 
        rect, 
        markerIndex: index,
        // Store initial line endpoints
        initialX1: marker.x1,
        initialY1: marker.y1,
        initialX2: marker.x2,
        initialY2: marker.y2
      };
    } else if (action === 'resize_start') {
      setInteractionMode('resizing');
      setResizingMarker(index);
      setResizeCorner('line_start');
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];

      // Store anchor point (end) and original line direction
      const anchorX = marker.x2;
      const anchorY = marker.y2;
      const originalLength = Math.sqrt((marker.x2 - marker.x1) ** 2 + (marker.y2 - marker.y1) ** 2);
      const directionX = (marker.x2 - marker.x1) / originalLength;
      const directionY = (marker.y2 - marker.y1) / originalLength;

      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        rect,
        anchorX,
        anchorY,
        originalLength,
        directionX,
        directionY
      };
    } else if (action === 'resize_end') {
      setInteractionMode('resizing');
      setResizingMarker(index);
      setResizeCorner('line_end');
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];

      // Store anchor point (start) and original line direction
      const anchorX = marker.x1;
      const anchorY = marker.y1;
      const originalLength = Math.sqrt((marker.x2 - marker.x1) ** 2 + (marker.y2 - marker.y1) ** 2);
      const directionX = (marker.x2 - marker.x1) / originalLength;
      const directionY = (marker.y2 - marker.y1) / originalLength;

      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        rect,
        anchorX,
        anchorY,
        originalLength,
        directionX,
        directionY
      };
    } else if (action === 'rotate') {
      setInteractionMode('rotating');
      setResizingMarker(index);
      setEditingMarker(null);
      const rect = imageRef.current.getBoundingClientRect();
      const marker = markers[index];

      // Calculate center point
      const centerX = (marker.x1 + marker.x2) / 2;
      const centerY = (marker.y1 + marker.y2) / 2;

      // Calculate initial angle offset: currentRotation - angle from center to pointer
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
      const angleToPointer = Math.atan2(pointerY - centerY, pointerX - centerX);
      const initialOffset = (marker.rotation || 0) - angleToPointer;

      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        rect,
        centerX,
        centerY,
        initialOffset
      };
    }

    console.log('[Line] Stored dragStartPos', dragStartPos.current);
  };
  
  const handleImagePointerMove = (e) => {
    if (!imageRef.current) {
      console.warn('handleImagePointerMove called with null imageRef');
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      console.warn('Invalid rect in handleImagePointerMove:', rect);
      return;
    }

    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    // Ensure variables are valid numbers
    if (!isFinite(currentX) || !isFinite(currentY)) {
      console.warn('Invalid coordinates calculated:', { currentX, currentY, clientX: e.clientX, clientY: e.clientY, rect });
      return;
    }

    console.log('handleImagePointerMove executing:', { currentX, currentY, interactionMode });

    // Handle rotation (immediate, no animation frame needed)
    if (interactionMode === 'rotating' && resizingMarker !== null) {
      const dragData = dragStartPos.current;
      if (!dragData || typeof dragData.centerX !== 'number' || typeof dragData.centerY !== 'number' || typeof dragData.initialOffset !== 'number') {
        console.warn('Invalid drag data for rotation:', dragData);
        return;
      }

      const { centerX, centerY, initialOffset } = dragData;

      // Calculate absolute rotation: angle from center to pointer + initial offset
      const deltaX = currentX - centerX;
      const deltaY = currentY - centerY;
      const angleToPointer = Math.atan2(deltaY, deltaX);
      const rotation = angleToPointer + initialOffset;

      // Normalize to 0-2π
      const normalizedRotation = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      updateMarker(resizingMarker, { rotation: normalizedRotation });
      return; // Exit early for rotation
    }

    if (interactionMode === 'dragging' && draggingMarker !== null) {
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Use RAF for smooth updates
      animationFrameRef.current = requestAnimationFrame(() => {
        const marker = markers[draggingMarker];
        if (marker.shape === 'line' && dragStartPos.current.initialX1 !== undefined) {
          // Line dragging: move both endpoints together using INITIAL positions + delta
          const startPointerX = ((dragStartPos.current.x - dragStartPos.current.rect.left) / dragStartPos.current.rect.width) * 100;
          const startPointerY = ((dragStartPos.current.y - dragStartPos.current.rect.top) / dragStartPos.current.rect.height) * 100;

          const deltaX = currentX - startPointerX;
          const deltaY = currentY - startPointerY;

          // Use INITIAL positions (stored on pointer down) + delta, NOT current positions
          const newX1 = Math.max(0, Math.min(100, dragStartPos.current.initialX1 + deltaX));
          const newY1 = Math.max(0, Math.min(100, dragStartPos.current.initialY1 + deltaY));
          const newX2 = Math.max(0, Math.min(100, dragStartPos.current.initialX2 + deltaX));
          const newY2 = Math.max(0, Math.min(100, dragStartPos.current.initialY2 + deltaY));

          updateMarker(draggingMarker, { x1: newX1, y1: newY1, x2: newX2, y2: newY2 });
        } else if (marker.shape === 'arrow' && dragStartPos.current.initialX !== undefined) {
          // Arrow dragging: use delta-based movement from initial position
          const startPointerX = ((dragStartPos.current.x - dragStartPos.current.rect.left) / dragStartPos.current.rect.width) * 100;
          const startPointerY = ((dragStartPos.current.y - dragStartPos.current.rect.top) / dragStartPos.current.rect.height) * 100;

          const deltaX = currentX - startPointerX;
          const deltaY = currentY - startPointerY;

          updateMarker(draggingMarker, {
            x: Math.max(0, Math.min(100, dragStartPos.current.initialX + deltaX)),
            y: Math.max(0, Math.min(100, dragStartPos.current.initialY + deltaY))
          });
        } else {
          // Regular marker dragging (dot, rectangle) - direct position
          updateMarker(draggingMarker, {
            x: Math.max(0, Math.min(100, currentX)),
            y: Math.max(0, Math.min(100, currentY))
          });
        }
      });
    }
    // Handle resizing (immediate, no animation frame needed)
    else if (interactionMode === 'resizing' && resizingMarker !== null && resizeCorner) {
      const marker = markers[resizingMarker];
      if (!marker) {
        console.warn('Marker not found for resizing:', resizingMarker);
        return;
      }

      if (resizeCorner === 'dot') {
        // Dot resize: axis-based delta resize
        const dragData = dragStartPos.current;
        if (!dragData || !dragData.resizeAxis || typeof dragData.startPos !== 'number' || typeof dragData.startSize !== 'number') {
          console.warn('Invalid drag data for dot resize:', dragData);
          return;
        }

        const { resizeAxis, startPos, startSize } = dragData;

        // Read current position from the same axis only
        const currentPos = resizeAxis === 'x' ? currentX : currentY;

        // Calculate signed delta from start position
        const delta = currentPos - startPos;

        // Apply delta to size with sensitivity adjustment
        const sensitivity = 2; // Adjust this value to control resize speed
        const newSize = Math.max(10, Math.min(200, startSize + delta * sensitivity));

        updateMarker(resizingMarker, { size: newSize });
      } else if (resizeCorner === 'arrow') {
        // Arrow resize: change length using signed delta along arrow axis
        const dragData = dragStartPos.current;
        if (!dragData || typeof dragData.x !== 'number' || typeof dragData.y !== 'number' || typeof dragData.initialLength !== 'number' || !dragData.rect) {
          console.warn('Invalid drag data for arrow resize:', dragData);
          return;
        }

        const { x: startX, y: startY, initialLength, rect } = dragData;

        const startPointerX = ((startX - rect.left) / rect.width) * 100;
        const startPointerY = ((startY - rect.top) / rect.height) * 100;

        const currentDeltaX = currentX - startPointerX;
        const currentDeltaY = currentY - startPointerY;

        // Project delta onto arrow direction to get signed length change
        const rotation = marker.rotation || 0;
        const signedDelta = currentDeltaX * Math.cos(rotation) + currentDeltaY * Math.sin(rotation);

        // Use initial length + signed delta (can grow or shrink)
        const newLength = Math.max(20, Math.min(300, initialLength + signedDelta * 2));

        updateMarker(resizingMarker, { length: newLength });
      } else if (resizeCorner === 'line_start' || resizeCorner === 'line_end') {
        // Line endpoint resize: constrained along line axis
        const dragData = dragStartPos.current;
        if (!dragData || typeof dragData.anchorX !== 'number' || typeof dragData.anchorY !== 'number' ||
            typeof dragData.directionX !== 'number' || typeof dragData.directionY !== 'number') {
          console.warn('Invalid drag data for line resize:', dragData);
          return;
        }

        const { anchorX, anchorY, directionX, directionY } = dragData;

        // Calculate vector from anchor to current pointer position
        const pointerVectorX = currentX - anchorX;
        const pointerVectorY = currentY - anchorY;

        // Project onto line direction using dot product
        const projection = pointerVectorX * directionX + pointerVectorY * directionY;

        // Calculate new length (can be negative for direction reversal)
        const newLength = Math.max(5, Math.abs(projection)); // Minimum length

        // Calculate new endpoint position along the line direction
        const lengthDirection = projection >= 0 ? 1 : -1; // Preserve direction
        const endX = anchorX + lengthDirection * newLength * directionX;
        const endY = anchorY + lengthDirection * newLength * directionY;

        // Clamp to bounds
        const clampedEndX = Math.max(0, Math.min(100, endX));
        const clampedEndY = Math.max(0, Math.min(100, endY));

        if (resizeCorner === 'line_start') {
          // Moving start point, end point is anchor
          updateMarker(resizingMarker, {
            x1: clampedEndX,
            y1: clampedEndY
          });
        } else if (resizeCorner === 'line_end') {
          // Moving end point, start point is anchor
          updateMarker(resizingMarker, {
            x2: clampedEndX,
            y2: clampedEndY
          });
        }
      } else {
        // Rectangle resize
        const deltaX = currentX - marker.x;
        const deltaY = currentY - marker.y;

        let newWidth = marker.width || 10;
        let newHeight = marker.height || 10;

        if (resizeCorner === 'se') {
          newWidth = Math.max(5, marker.width / 2 + deltaX);
          newHeight = Math.max(5, marker.height / 2 + deltaY);
        } else if (resizeCorner === 'sw') {
          newWidth = Math.max(5, marker.width / 2 - deltaX);
          newHeight = Math.max(5, marker.height / 2 + deltaY);
        } else if (resizeCorner === 'ne') {
          newWidth = Math.max(5, marker.width / 2 + deltaX);
          newHeight = Math.max(5, marker.height / 2 - deltaY);
        } else if (resizeCorner === 'nw') {
          newWidth = Math.max(5, marker.width / 2 - deltaX);
          newHeight = Math.max(5, marker.height / 2 - deltaY);
        }

        updateMarker(resizingMarker, { width: newWidth, height: newHeight });
      }
      return; // Exit early for resizing
    }
  };
  
  const handleImagePointerUp = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setInteractionMode('idle');
    setDraggingMarker(null);
    setResizingMarker(null);
    setResizeCorner(null);
    dragStartPos.current = null;
  };
  
  // Cleanup RAF on unmount
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  if (!imageUrl) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary">
        <div className="space-y-4">
          <div className="text-muted-foreground font-medium">📌 Annotated Image Block</div>
          <p className="text-sm text-muted-foreground">{t('builder.messages.uploadImageToStart')}</p>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files[0] && onMediaUpload(e.target.files[0], block.id)}
            className="mb-2"
          />
          <p className="text-sm text-muted-foreground">or</p>
          <Input
            placeholder={t('builder.placeholders.pasteImageUrl')}
            onBlur={(e) => {
              if (e.target.value) {
                onUpdate({ data: { ...block.data, url: normalizeImageUrl(e.target.value) } });
              }
            }}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Image with markers */}
      <div 
        className="relative border border-border rounded-lg overflow-hidden bg-secondary select-none"
        onPointerMove={handleImagePointerMove}
        onPointerUp={handleImagePointerUp}
        onPointerLeave={handleImagePointerUp}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={block.data?.alt || 'Annotated image'}
          className={`w-full pointer-events-none ${draggingMarker !== null || resizingMarker !== null ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          onClick={handleImageClick}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
          draggable={false}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
        
        {/* Render markers */}
        {markers.map((marker, idx) => {
          const isActive = editingMarker === idx || draggingMarker === idx || resizingMarker === idx;
          const markerShape = marker.shape || 'dot';
          const markerSize = marker.size || 30;
          const markerWidth = marker.width || 10;
          const markerHeight = marker.height || 10;
          const markerColor = marker.color || '#3b82f6';
          
          // Safety guard: validate annotation type
          if (process.env.NODE_ENV === 'development' && !SUPPORTED_ANNOTATION_TYPES.includes(markerShape)) {
            console.error(`Unregistered annotation type: ${markerShape}. Supported types:`, SUPPORTED_ANNOTATION_TYPES);
          }
          
          if (markerShape === 'rectangle') {
            // Rectangle marker with corner resize handles
            return (
              <div key={marker.id || idx}>
                <div
                  className={`absolute border-2 cursor-move select-none ${
                    isActive
                      ? 'shadow-lg ring-2'
                      : 'hover:shadow-md shadow-md'
                  }`}
                  style={{
                    left: `${marker.x}%`,
                    top: `${marker.y}%`,
                    width: `${markerWidth}%`,
                    height: `${markerHeight}%`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: markerColor,
                    backgroundColor: isActive ? `${markerColor}1a` : `${markerColor}0d`, // 10% and 5% opacity
                    ringColor: isActive ? `${markerColor}4d` : undefined, // 30% opacity ring
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                  onPointerDown={(e) => {
                    // Check if clicking directly on a resize handle
                    if (e.target.hasAttribute('data-resize-handle')) {
                      return; // Let the handle's own handler deal with it
                    }
                    handleMarkerPointerDown(e, idx);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (interactionMode === 'idle' && !e.target.hasAttribute('data-resize-handle')) {
                      setEditingMarker(editingMarker === idx ? null : idx);
                    }
                  }}
                >
                  {/* Number badge positioned outside top-right corner like an exponent */}
                  <span
                    className="absolute text-foreground rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
                    style={{
                      width: '18px',
                      height: '18px',
                      top: '-9px',
                      right: '-9px',
                      fontSize: '10px',
                      backgroundColor: markerColor
                    }}
                  >
                    {idx + 1}
                  </span>
                  
                  {/* Corner resize handles */}
                  {isActive && (
                    <>
                      {['nw', 'ne', 'sw', 'se'].map((corner) => (
                        <div
                          key={corner}
                          data-resize-handle="true"
                          className="absolute w-4 h-4 bg-card rounded-full hover:scale-125 transition-transform"
                          style={{
                            [corner.includes('n') ? 'top' : 'bottom']: '-8px',
                            [corner.includes('w') ? 'left' : 'right']: '-8px',
                            border: `2px solid ${markerColor}`,
                            cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                            zIndex: 20,
                            pointerEvents: 'auto',
                            touchAction: 'none'
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleResizePointerDown(e, idx, corner);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          }
          
          // Dot marker with pixel-based sizing and delta resize
          if (markerShape === 'dot') {
            return (
              <div key={marker.id || idx}>
              <div
                className={`absolute cursor-move select-none ${
                  isActive
                    ? 'shadow-lg ring-2'
                    : 'hover:shadow-md shadow-md'
                }`}
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  width: `${markerSize || 30}px`,
                  height: `${markerSize || 30}px`,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  border: `2px solid ${markerColor}`,
                  backgroundColor: isActive ? `${markerColor}1a` : `${markerColor}0d`, // 10% and 5% opacity
                  ringColor: isActive ? `${markerColor}4d` : undefined, // 30% opacity ring
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onPointerDown={(e) => {
                  // Check if clicking directly on a resize handle
                  if (e.target.hasAttribute('data-resize-handle')) {
                    return; // Let the handle's own handler deal with it
                  }
                  handleMarkerPointerDown(e, idx);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (interactionMode === 'idle' && !e.target.hasAttribute('data-resize-handle')) {
                    setEditingMarker(editingMarker === idx ? null : idx);
                  }
                }}
              >
                {/* Number badge positioned outside top-right corner like an exponent */}
                <span
                  className="absolute text-foreground rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
                  style={{
                    width: '18px',
                    height: '18px',
                    top: '-9px',
                    right: '-9px',
                    fontSize: '10px',
                    backgroundColor: markerColor
                  }}
                >
                  {idx + 1}
                </span>

                {/* Single resize handle positioned at rightmost point */}
                {isActive && (
                  <div
                    data-resize-handle="true"
                    className="absolute w-4 h-4 bg-card rounded-full hover:scale-125 transition-transform"
                    style={{
                      right: '-8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: `2px solid ${markerColor}`,
                      cursor: 'ew-resize',
                      zIndex: 20,
                      pointerEvents: 'auto',
                      touchAction: 'none'
                    }}
                    onPointerDown={(e) => handleDotResizePointerDown(e, idx, marker)}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                )}
              </div>
            </div>
          );
          }

          // Arrow marker with move, rotate, and resize interactions
          if (markerShape === 'arrow') {
            const arrowLength = marker.length || 80;
            const arrowRotation = marker.rotation || 0;

            return (
              <div key={marker.id || idx}>
                <div
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${marker.x}%`,
                    top: `${marker.y}%`,
                    transform: `rotate(${arrowRotation}rad)`, // No center translation - tip at click position
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    color: markerColor
                  }}
                  onPointerDown={(e) => {
                    // Check if clicking on handles
                    if (e.target.hasAttribute('data-rotation-handle') || e.target.hasAttribute('data-resize-handle')) {
                      return; // Let handle's own handler deal with it
                    }
                    handleArrowPointerDown(e, idx, 'move');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (interactionMode === 'idle' && !e.target.hasAttribute('data-rotation-handle') && !e.target.hasAttribute('data-resize-handle')) {
                      setEditingMarker(editingMarker === idx ? null : idx);
                    }
                  }}
                >
                  {/* Arrow shaft - extends leftward from tip */}
                  <div
                    className={`absolute ${isActive ? 'shadow-lg' : 'shadow-md'}`}
                    style={{
                      left: '0',
                      top: '50%',
                      width: `${arrowLength - 8}px`, // Subtract arrowhead size
                      height: '2px',
                      transform: 'translateX(-100%) translateY(-50%)', // Extend left from tip
                      transformOrigin: 'right center', // Rotate from tip end
                      backgroundColor: markerColor
                    }}
                  />

                  {/* Arrowhead - positioned at tip (click position) */}
                  <div
                    className={`absolute ${isActive ? 'shadow-lg' : 'shadow-md'}`}
                    style={{
                      left: '0',
                      top: '50%',
                      width: '0',
                      height: '0',
                      borderLeft: `8px solid ${markerColor}`,
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent',
                      transform: 'translateY(-50%)', // Center vertically at tip
                      transformOrigin: 'left center',
                    }}
                  />

                  {/* Number badge - positioned above tip */}
                  <span
                    className="absolute text-foreground rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none shadow-md"
                    style={{
                      width: '18px',
                      height: '18px',
                      left: '0',
                      top: '50%',
                      transform: 'translate(-50%, -50%) translateY(-20px)',
                      fontSize: '10px',
                      backgroundColor: markerColor
                    }}
                  >
                    {idx + 1}
                  </span>

                  {/* Rotation handle */}
                  {isActive && (
                    <div
                      data-rotation-handle="true"
                      className="absolute w-4 h-4 border-2 border-white rounded-full hover:scale-125 transition-transform shadow-md"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%) translateY(-30px)',
                        backgroundColor: markerColor,
                        cursor: 'alias',
                        zIndex: 20,
                        pointerEvents: 'auto',
                        touchAction: 'none'
                      }}
                      onPointerDown={(e) => handleArrowPointerDown(e, idx, 'rotate')}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  )}

                  {/* Resize handle at arrowhead */}
                  {isActive && (
                  <div
                    data-resize-handle="true"
                    className="absolute w-4 h-4 border-2 border-white rounded-full hover:scale-125 transition-transform shadow-md"
                    style={{
                      left: `calc(50% + ${arrowLength + 8}px)`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: markerColor,
                      cursor: 'ew-resize',
                      zIndex: 20,
                      pointerEvents: 'auto',
                      touchAction: 'none'
                    }}
                      onPointerDown={(e) => handleArrowPointerDown(e, idx, 'resize')}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  )}
                </div>
              </div>
            );
          }

          // Line marker with move and endpoint resize
          if (markerShape === 'line') {
            const startX = marker.x1 || marker.x || 0;
            const startY = marker.y1 || marker.y || 0;
            const endX = marker.x2 || marker.x || 10;
            const endY = marker.y2 || marker.y || 0;
            const centerX = (startX + endX) / 2;
            const centerY = (startY + endY) / 2;
            const lineRotation = marker.rotation || 0;

            // Calculate rotated coordinates for rendering
            const rotatePoint = (x, y, cx, cy, angle) => {
              const dx = x - cx;
              const dy = y - cy;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos
              };
            };

            // Convert from rotated coordinates back to absolute coordinates
            const unrotatePoint = (rx, ry, cx, cy, angle) => {
              const dx = rx - cx;
              const dy = ry - cy;
              const cos = Math.cos(-angle); // Negative angle for unrotation
              const sin = Math.sin(-angle);
              return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos
              };
            };

            const rotatedStart = rotatePoint(startX, startY, centerX, centerY, lineRotation);
            const rotatedEnd = rotatePoint(endX, endY, centerX, centerY, lineRotation);

            return (
              <div key={marker.id || idx}>
                <svg
                  className="absolute"
                  style={{
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none'
                  }}
                >
                  {/* Main line (pre-rotated coordinates for correct pointer events) */}
                  <line
                    x1={`${rotatedStart.x}%`}
                    y1={`${rotatedStart.y}%`}
                    x2={`${rotatedEnd.x}%`}
                    y2={`${rotatedEnd.y}%`}
                    stroke={markerColor}
                    strokeWidth={isActive ? "3" : "2"}
                    style={{ pointerEvents: 'stroke', cursor: 'move' }}
                      onPointerDown={(e) => {
                        if (e.target !== e.currentTarget) return; // Only handle direct clicks on line
                        handleLinePointerDown(e, idx, 'move');
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMarker(editingMarker === idx ? null : idx);
                      }}
                  />

                  {/* Resize handles - endpoint circles at visual positions - show when editing/selected */}
                  {editingMarker === idx && (
                    <>
                      <circle
                        cx={`${rotatedStart.x}%`}
                        cy={`${rotatedStart.y}%`}
                        r="5"
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="2"
                        style={{
                          cursor: 'crosshair',
                          pointerEvents: 'auto',
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                        }}
                        onPointerDown={(e) => handleLinePointerDown(e, idx, 'resize_start')}
                      />

                      <circle
                        cx={`${rotatedEnd.x}%`}
                        cy={`${rotatedEnd.y}%`}
                        r="5"
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="2"
                        style={{
                          cursor: 'crosshair',
                          pointerEvents: 'auto',
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
                        }}
                        onPointerDown={(e) => handleLinePointerDown(e, idx, 'resize_end')}
                      />
                    </>
                  )}

                  {/* Rotation handle - positioned using line normal vector */}
                  {editingMarker === idx && (
                    <circle
                      cx={`${centerX + Math.cos(lineRotation + Math.PI/2) * 25}%`}
                      cy={`${centerY + Math.sin(lineRotation + Math.PI/2) * 25}%`}
                      r="7"
                      fill={markerColor}
                      stroke="white"
                      strokeWidth="3"
                      style={{
                        cursor: 'alias',
                        pointerEvents: 'auto',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                      }}
                      onPointerDown={(e) => handleLinePointerDown(e, idx, 'rotate')}
                    />
                  )}

                  {/* Number badge at midpoint (rotated) */}
                  <text
                    x={`${(rotatedStart.x + rotatedEnd.x) / 2}%`}
                    y={`${(rotatedStart.y + rotatedEnd.y) / 2 - 2}%`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={markerColor}
                    fontSize="10"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {idx + 1}
                  </text>
                </svg>
              </div>
            );
          }

          // Fallback for unknown shapes
          return null;
        })}
        
        {/* Empty state overlay */}
        {markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
            <div className="bg-card rounded-lg shadow-lg p-6 text-center space-y-2">
              <div className="text-2xl">📌</div>
              <div className="font-medium">{t('builder.messages.clickAnywhereToAdd')}</div>
              <div className="text-sm text-muted-foreground">{t('builder.messages.interactiveMarkersAppear')}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Annotations list and editing panel */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-sm">
            📌 {t('builder.annotatedImage.annotations')} ({markers.length})
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (imageRef.current) {
                const rect = imageRef.current.getBoundingClientRect();
                handleImageClick({
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
              }
            }}
            className="h-7 text-xs text-foreground"
          >
            <Plus className="w-3 h-3 mr-1" />
            {t('builder.annotatedImage.addCenter')}
          </Button>
        </div>
        
        {markers.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            {t('builder.blocks.annotatedImageInstructions.clickImage')}
          </div>
        ) : (
          <div className="space-y-2">
            {markers.map((marker, idx) => (
              <button
                key={marker.id || idx}
                onClick={() => setEditingMarker(editingMarker === idx ? null : idx)}
                className={`w-full p-2 rounded-lg border text-left transition-all hover:border-primary hover:bg-primary/5 ${
                  editingMarker === idx ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary text-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {marker.title || t('builder.labels.untitled')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {marker.shape === 'rectangle' ? `◻ ${t('builder.labels.rectangle')}` : marker.shape === 'arrow' ? `→ ${t('builder.labels.arrow')}` : marker.shape === 'line' ? `━ ${t('builder.labels.line')}` : `● ${t('builder.labels.dot')}`} • {t('builder.labels.clickToEdit')}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Edit annotation panel - shown below when marker is selected */}
      {editingMarker !== null && markers[editingMarker] && (
        <div className="border border-primary rounded-lg bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-primary/20">
            <span className="font-semibold text-sm">
              {t('builder.labels.editingAnnotation', { number: editingMarker + 1 })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setEditingMarker(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground mb-1 block">{t('builder.labels.title')}</Label>
              <Input
                value={markers[editingMarker].title || ''}
                onChange={(e) => updateMarker(editingMarker, { title: e.target.value })}
                placeholder={t('builder.placeholders.annotationTitle')}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label className="text-xs text-foreground mb-1 block">{t('builder.labels.description')}</Label>
              <Textarea
                value={markers[editingMarker].description || ''}
                onChange={(e) => updateMarker(editingMarker, { description: e.target.value })}
                placeholder={t('builder.placeholders.annotationDescription')}
                rows={2}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-foreground mb-1 block">{t('builder.labels.color')}</Label>
              <input
                type="color"
                value={markers[editingMarker].color || '#3b82f6'}
                onChange={(e) => updateMarker(editingMarker, { color: e.target.value })}
                className="w-full h-9 rounded-md border border-border cursor-pointer"
              />
            </div>

            <div>
              <Label className="text-xs text-foreground mb-1 block">{t('builder.labels.shape')}</Label>
              <Select
                value={markers[editingMarker].shape || 'dot'}
                onValueChange={(shape) => updateMarker(editingMarker, { shape })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dot">● {t('builder.labels.dot')}</SelectItem>
                  <SelectItem value="rectangle">◻ {t('builder.labels.rectangle')}</SelectItem>
                  <SelectItem value="arrow">→ {t('builder.labels.arrow')}</SelectItem>
                  <SelectItem value="line">━ {t('builder.labels.line')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {markers[editingMarker].shape === 'arrow' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-foreground mb-1 block">Length (pixels)</Label>
                  <Input
                    type="number"
                    value={markers[editingMarker].length || 80}
                    onChange={(e) => updateMarker(editingMarker, { length: Math.max(20, Math.min(300, parseInt(e.target.value) || 80)) })}
                    min={20}
                    max={300}
                    step={10}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-foreground mb-1 block">Rotation (degrees)</Label>
                  <Input
                    type="number"
                    value={Math.round(((markers[editingMarker].rotation || 0) * 180) / Math.PI)}
                    onChange={(e) => {
                      const degrees = parseFloat(e.target.value) || 0;
                      const radians = (degrees * Math.PI) / 180;
                      // Normalize to 0-2π
                      const normalized = radians < 0 ? radians + 2 * Math.PI : radians % (2 * Math.PI);
                      updateMarker(editingMarker, { rotation: normalized });
                    }}
                    min={0}
                    max={360}
                    step={15}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm(t('builder.labels.deleteAnnotation') + '?')) {
                  deleteMarker(editingMarker);
                }
              }}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('builder.labels.deleteAnnotation')}
            </Button>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 space-y-1">
        <div>💡 {t('builder.blocks.annotatedImageInstructions.clickImage')}</div>
        <div>🎯 {t('builder.blocks.annotatedImageInstructions.clickAnnotation')}</div>
        <div>🖱️ {t('builder.blocks.annotatedImageInstructions.dragMarkers')}</div>
        <div>↔️ {t('builder.blocks.annotatedImageInstructions.dragCorners')}</div>
      </div>
    </div>
  );
};

// CarouselCaptionEditor removed - now using InlineRichEditor directly for consistency

// Carousel Block Editor Component
const CarouselBlockEditor = ({ block, onUpdate, workspaceId, canUploadFile }) => {
  const { t } = useTranslation();
  
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
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">No slides yet. Add your first slide to start.</p>
        <Button onClick={addSlide} size="sm" className="text-foreground text-gray-900">
          <Plus className="w-4 h-4 mr-2" />
          {t('builder.placeholders.addSlide')}
        </Button>
      </div>
    );
  }

  const currentSlide = slides[activeIndex];

  return (
    <div className="space-y-4">
      {/* Carousel Display */}
      <div className="relative border border-border dark:border-slate-800 rounded-lg overflow-hidden bg-secondary dark:bg-background space-y-0">
        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-card/90 hover:bg-card border border-border rounded-full p-2 shadow-lg transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-card/90 hover:bg-card border border-border rounded-full p-2 shadow-lg transition-all"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </>
        )}

        {/* Slide Content */}
        <div className="aspect-video relative bg-secondary dark:bg-card">
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
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No media for this slide</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Caption below image */}
        {currentSlide?.caption && (
          <div className="px-2 mt-2">
            <div 
              className="prose prose-sm max-w-none bg-transparent text-foreground rounded-lg px-4 py-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentSlide.caption || '') }}
            />
          </div>
        )}

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
                  idx === activeIndex ? 'bg-primary w-6' : 'bg-card/60 hover:bg-card/80'
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
          <div className="text-sm text-muted-foreground">
            Slide {activeIndex + 1} of {slides.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(t('dialogs.confirm.removeSlide', { number: activeIndex + 1 }))) {
                  removeSlide(activeIndex);
                }
              }}
              disabled={slides.length <= 1}
              className="text-foreground text-gray-900"
            >
              <X className="w-4 h-4 mr-1" />
              {t('builder.placeholders.remove')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                addSlide();
              }}
              disabled={slides.length >= MAX_SLIDES}
              className="text-foreground text-gray-900"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('builder.placeholders.addSlide')}
            </Button>
          </div>
        </div>

        {/* Current Slide Editor */}
        {currentSlide && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Media</Label>
              {currentSlide.url ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Current: {currentSlide.media_type}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSlide(activeIndex, { url: '', file_id: null });
                    }}
                  >
                    {t('builder.placeholders.removeMedia')}
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
                        <div className="text-xs text-muted-foreground">Uploading...</div>
                      )}
                  <p className="text-xs text-muted-foreground">or</p>
                  <Input
                    placeholder={t('builder.placeholders.pasteMediaUrl')}
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
              <Label className="text-xs text-muted-foreground mb-1.5 block">Caption (Optional)</Label>
              <InlineRichEditor
                content={currentSlide.caption || ''}
                onChange={(html) => updateSlide(activeIndex, { caption: html })}
                placeholder={t('builder.placeholders.addSlideCaption')}
                isRTL={false}
                textSize="text-sm"
                isBold={false}
                align="left"
                className=""
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
  const { t } = useTranslation();
  // Always show Building Tips panel (never show Block Settings)
  // Block settings removed per user request - keep tips panel visible
  
  if (currentStep && currentStep.id) {
    return <BuildingTips />;
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold">{t('builder.inspector')}</h2>
      </div>
      <div className="flex-1 p-4">
        <div className="text-sm text-muted-foreground text-center py-8">
          {t('builder.selectStepOrBlock')}
        </div>
      </div>
    </div>
  );
};

export default BuilderV2Page;
