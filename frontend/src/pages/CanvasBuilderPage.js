import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Eye, Play, ArrowLeft, Clock, Check, History, Trash2, CheckSquare, Square, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Plus, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrlsInObject, normalizeImageUrl } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import UpgradePrompt from '../components/UpgradePrompt';
import LeftSidebar from '../components/canvas-builder/LeftSidebar';
import LiveCanvas from '../components/canvas-builder/LiveCanvas';
import RightInspector from '../components/canvas-builder/RightInspector';
import StepTimeline from '../components/canvas-builder/StepTimeline';
import PreviewMode from '../components/canvas-builder/PreviewMode';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';

const CanvasBuilderPage = () => {
  const { t, i18n } = useTranslation();
  const { workspaceSlug, walkthroughId } = useParams();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'he';
  const isEditing = !!walkthroughId;
  
  // Resolve workspace slug to ID
  const { workspace: workspaceFromHook, workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspaceSlug(workspaceSlug);
  
  const draftKey = workspaceId ? `interguide:draft:${workspaceId}` : null;
  
  // Set workspace from hook
  useEffect(() => {
    if (workspaceFromHook) {
      setWorkspace(workspaceFromHook);
    }
  }, [workspaceFromHook]);
  
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
  const [activeStepId, setActiveStepId] = useState(null);
  const [overStepId, setOverStepId] = useState(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  // On mobile, hide panels by default; on desktop, show them
  const [leftPanelVisible, setLeftPanelVisible] = useState(window.innerWidth >= 1024);
  const [rightPanelVisible, setRightPanelVisible] = useState(window.innerWidth >= 1024);
  const [stepTimelineVisible, setStepTimelineVisible] = useState(true);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // On mobile, panels should be hidden by default
        if (leftPanelVisible && window.innerWidth < 768) {
          setLeftPanelVisible(false);
        }
        if (rightPanelVisible && window.innerWidth < 768) {
          setRightPanelVisible(false);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [leftPanelVisible, rightPanelVisible]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
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
          // Ignore unlock errors - lock may already be released, expired, or user was forced out
        });
      }
    };
  }, [workspaceId, workspaceSlug, navigate]);

  // Clear draft when explicitly creating a new walkthrough
  if (!isEditing) {
    // Check if we're navigating to /new (not just walkthroughId is undefined)
    const currentPath = window.location.pathname;
    if (currentPath.includes('/walkthroughs/new')) {
      // Clear any existing draft to ensure fresh start
      localStorage.removeItem(draftKey);
      // Reset walkthrough to initial state
      setWalkthrough({
        title: 'Untitled Walkthrough',
        description: '',
        status: 'draft',
        privacy: 'public',
        steps: [],
        category_ids: [],
        navigation_type: 'next_prev',
        navigation_placement: 'bottom'
      });
    }
  }
  
  // Only fetch data if workspace is loaded and valid
  if (workspaceId && !workspaceLoading && !workspaceError) {
    fetchData();
  }
}, [workspaceId, walkthroughId, workspaceLoading, workspaceError]);

  // Restore draft for new walkthroughs (prevents losing long edits on refresh)
  // Only restore if we're not explicitly on /new route
  useEffect(() => {
    if (isEditing) return;
    const currentPath = window.location.pathname;
    // Don't restore draft if we're explicitly creating new
    if (currentPath.includes('/walkthroughs/new')) return;
    
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return;
      // CRITICAL: Ensure blocks arrays are restored from draft
      const draftData = { ...parsed.data };
      if (draftData.steps) {
        draftData.steps = draftData.steps.map(step => ({
          ...step,
          blocks: step.blocks || []
        }));
      }
      // Normalize image URLs in draft
      const normalized = normalizeImageUrlsInObject(draftData);
      setWalkthrough((prev) => ({ ...prev, ...normalized }));
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
      // CRITICAL: Ensure blocks arrays are preserved in draft
      if (draftWalkthrough.steps) {
        draftWalkthrough.steps = draftWalkthrough.steps.map(step => ({
          ...step,
          blocks: step.blocks || []
        }));
      }
      localStorage.setItem(draftKey, JSON.stringify({ updatedAt: Date.now(), data: draftWalkthrough }));
    } catch {
      // ignore
    }
  }, [walkthrough, isEditing, loading]);

  const fetchData = async () => {
    if (!workspaceId || workspaceError) return; // Don't fetch if workspace ID is invalid or there was an error
    
    try {
      const [wsResponse, catResponse] = await Promise.all([
        api.getWorkspace(workspaceId),
        api.getCategories(workspaceId)
      ]);

      setWorkspace(wsResponse.data);
      setCategories(catResponse.data);

      if (isEditing) {
        const wtResponse = await api.getWalkthrough(workspaceId, walkthroughId);
        // Normalize image URLs in walkthrough data
        const normalized = normalizeImageUrlsInObject(wtResponse.data);
        // CRITICAL: Ensure all steps have blocks array initialized with proper structure
        if (normalized.steps) {
          normalized.steps = normalized.steps.map(step => {
            const stepWithBlocks = {
              ...step,
              blocks: step.blocks || []
            };
            // Ensure blocks array is properly structured
            if (!Array.isArray(stepWithBlocks.blocks)) {
              stepWithBlocks.blocks = [];
            }
            // CRITICAL: Ensure each block has proper structure (data, settings, type, id)
            stepWithBlocks.blocks = stepWithBlocks.blocks.map(block => {
              if (!block || typeof block !== 'object') {
                return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
              }
              // Ensure block has all required fields
              return {
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: block.data || {},
                settings: block.settings || {}
              };
            });
            return stepWithBlocks;
          });
        }
        // CRITICAL: Ensure icon_url is preserved and normalized
        if (wtResponse.data.icon_url) {
          normalized.icon_url = normalizeImageUrl(wtResponse.data.icon_url);
        } else {
          normalized.icon_url = normalized.icon_url || null;
        }
        setWalkthrough(normalized);
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
    // CRITICAL: Always include icon_url explicitly, even if null, to preserve existing value
    // CRITICAL: Always save as draft unless explicitly publishing - prevents accidental publishing
    const data = {
      title: walkthrough.title || '',
      description: walkthrough.description || '',
      icon_url: walkthrough.icon_url || null,  // Explicitly include, backend will preserve if None
      privacy: walkthrough.privacy || 'public',
      password: walkthrough.privacy === 'password' ? walkthrough.password : undefined,
      category_ids: walkthrough.category_ids || [],
      navigation_type: walkthrough.navigation_type || 'next_prev',
      navigation_placement: walkthrough.navigation_placement || 'bottom',
      status: 'draft'  // Always save as draft - publish is separate action
    };

    try {
      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, data);

        // Update steps - CRITICAL: Always preserve blocks array with complete structure
        const nextSteps = [...(walkthrough.steps || [])];
        
        // CRITICAL: Save all steps sequentially and wait for each to complete
        for (let i = 0; i < nextSteps.length; i++) {
          const step = nextSteps[i];
          // Ensure blocks array exists and has proper structure
          if (!step.blocks) {
            step.blocks = [];
          }
          // CRITICAL: Ensure each block has complete structure (data, settings, type, id)
          // IMPORTANT: Preserve ALL block data including URLs by using spread operator
          step.blocks = (step.blocks || []).map(block => {
            if (!block || typeof block !== 'object') {
              console.warn('[CanvasBuilder] Invalid block in save, creating default:', block);
              return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
            }
            
            // CRITICAL: Deep copy data to preserve all nested properties
            const blockData = block.data ? { ...block.data } : {};
            const blockSettings = block.settings ? { ...block.settings } : {};
            
            // Log image blocks to track URL preservation during save
            if (block.type === 'image' && blockData.url) {
              console.log('[CanvasBuilder] Saving image block with URL:', block.id, blockData.url);
            } else if (block.type === 'image' && !blockData.url) {
              console.warn('[CanvasBuilder] WARNING: Image block missing URL:', block.id, block);
            }
            
            return {
              id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: block.type || 'text',
              data: blockData,  // Preserve all data including url
              settings: blockSettings
            };
          });
          
          console.log('[CanvasBuilder] Saving step with blocks:', step.id, step.blocks);
          
          try {
            if (step.id && !step.isNew) {
              await api.updateStep(workspaceId, walkthroughId, step.id, {
                title: step.title || '',
                content: step.content || '',
                media_url: step.media_url || null,
                media_type: step.media_type || null,
                navigation_type: step.navigation_type || 'next_prev',
                common_problems: step.common_problems || [],
                blocks: step.blocks  // Send blocks with complete structure
              });
            } else if (step.isNew) {
              const res = await api.addStep(workspaceId, walkthroughId, {
                title: step.title || '',
                content: step.content || '',
                media_url: step.media_url || null,
                media_type: step.media_type || null,
                navigation_type: step.navigation_type || 'next_prev',
                order: step.order || i,
                common_problems: step.common_problems || [],
                blocks: step.blocks  // Send blocks with complete structure (already validated above)
              });
              // IMPORTANT: mark as persisted so future saves don't re-add duplicates
              if (res.data && res.data.id) {
                nextSteps[i] = { ...step, id: res.data.id, isNew: false };
                console.log('[CanvasBuilder] Step saved with ID:', res.data.id);
              } else {
                console.error('[CanvasBuilder] Step save failed: no ID returned', res);
                throw new Error('Step save failed: no ID returned');
              }
            }
          } catch (error) {
            console.error('[CanvasBuilder] Error saving step:', step.id || step.title, error);
            throw error; // Re-throw to prevent reorder with incomplete saves
          }
        }
        
        // If we persisted any new steps, update local state to prevent duplicates.
        setWalkthrough((prev) => ({ ...prev, steps: nextSteps }));

        // CRITICAL: Guard reorder - only proceed if all steps have valid IDs
        // Filter out: undefined, null, empty strings, temp-* prefixed IDs
        const persistedIds = nextSteps
          .map((s) => s?.id)
          .filter((id) => {
            const isValid = id && 
                           typeof id === 'string' && 
                           id.trim().length > 0 && 
                           !id.startsWith('temp-');
            if (!isValid && id !== undefined) {
              console.warn('[CanvasBuilder] Filtered out invalid step ID:', id);
            }
            return isValid;
          });
        
        console.log('[CanvasBuilder] Reorder check:', {
          totalSteps: nextSteps.length,
          validIds: persistedIds.length,
          ids: persistedIds
        });
        
        // CRITICAL: Only reorder if ALL steps have valid IDs and we have at least one step
        if (persistedIds.length === nextSteps.length && persistedIds.length > 0) {
          console.log('[CanvasBuilder] Calling reorderSteps with:', persistedIds);
          try {
            await api.reorderSteps(workspaceId, walkthroughId, persistedIds);
            console.log('[CanvasBuilder] Reorder successful');
          } catch (error) {
            console.error('[CanvasBuilder] Reorder failed:', error);
            // Log the exact error for debugging
            if (error.response) {
              console.error('[CanvasBuilder] Reorder error response:', {
                status: error.response.status,
                data: error.response.data,
                payload: { step_ids: persistedIds }
              });
            }
            throw error; // Re-throw to show error to user
          }
        } else {
          console.warn('[CanvasBuilder] Skipping reorder:', {
            reason: persistedIds.length !== nextSteps.length ? 'ID count mismatch' : 'No steps to reorder',
            expected: nextSteps.length,
            got: persistedIds.length
          });
        }
        
        // CRITICAL: After saving, refetch to ensure we have the latest data with all blocks preserved
        // This ensures data consistency and prevents loss of blocks
        const refreshed = await api.getWalkthrough(workspaceId, walkthroughId);
        const normalized = normalizeImageUrlsInObject(refreshed.data);
        if (normalized.steps) {
          normalized.steps = normalized.steps.map(step => {
            const stepWithBlocks = {
              ...step,
              blocks: Array.isArray(step.blocks) ? step.blocks : (step.blocks ? [step.blocks] : [])
            };
            // CRITICAL: Ensure each block has proper structure (data, settings, type, id)
            stepWithBlocks.blocks = stepWithBlocks.blocks.map(block => {
              if (!block || typeof block !== 'object') {
                console.warn('[CanvasBuilder] Invalid block loaded, creating default:', block);
                return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
              }
              
              // CRITICAL: Deep copy data to preserve all nested properties
              const blockData = block.data || {};
              const blockSettings = block.settings || {};
              
              // Log image blocks to track URL loading
              if (block.type === 'image') {
                if (blockData.url) {
                  console.log('[CanvasBuilder] Loaded image block with URL:', block.id, blockData.url);
                } else {
                  console.warn('[CanvasBuilder] WARNING: Loaded image block WITHOUT URL:', block.id, block);
                }
              }
              
              return {
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: blockData,  // Preserve all data including url
                settings: blockSettings
              };
            });
            
            // Log step block summary
            const imageBlocks = stepWithBlocks.blocks.filter(b => b.type === 'image');
            if (imageBlocks.length > 0) {
              const withUrls = imageBlocks.filter(b => b.data && b.data.url);
              console.log(`[CanvasBuilder] Step ${step.id}: ${imageBlocks.length} image blocks, ${withUrls.length} with URLs`);
            }
            return stepWithBlocks;
          });
        }
        // Preserve icon_url
        if (refreshed.data.icon_url) {
          normalized.icon_url = normalizeImageUrl(refreshed.data.icon_url);
        }
        setWalkthrough(normalized);

        if (showToast) toast.success('Saved!');
        setLastSaved(new Date());
      } else {
        // IMPORTANT: prevent creating multiple empty walkthroughs on repeated clicks
        const response = await api.createWalkthrough(workspaceId, data);
        const newId = response.data.id;

        for (const step of walkthrough.steps || []) {
          // CRITICAL: Ensure blocks have complete structure
          const stepBlocks = (step.blocks || []).map(block => {
            if (!block || typeof block !== 'object') {
              return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
            }
            return {
              id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: block.type || 'text',
              data: block.data || {},
              settings: block.settings || {}
            };
          });
          await api.addStep(workspaceId, newId, {
            title: step.title || '',
            content: step.content || '',
            media_url: step.media_url || null,
            media_type: step.media_type || null,
            navigation_type: step.navigation_type || 'next_prev',
            order: step.order || 0,
            common_problems: step.common_problems || [],
            blocks: stepBlocks  // Send blocks with complete structure
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
        navigate(`/workspace/${workspaceSlug}/walkthroughs/${newId}/edit`);
      }
    } catch (error) {
      console.error('[CanvasBuilder] Save failed:', error);
      if (showToast) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to save walkthrough';
        toast.error(errorMessage);
      }
      throw error; // Re-throw for caller to handle if needed
    } finally {
      setIsSaving(false);
    }
  };

  const getVersionChanges = (prevVersion, currentVersion) => {
    if (!prevVersion || !currentVersion) return null;
    const prevSnapshot = prevVersion.snapshot || {};
    const currentSnapshot = currentVersion.snapshot || {};
    
    let stepsChanged = 0;
    let blocksChanged = 0;
    let imagesChanged = 0;
    let titleChanged = false;
    
    // Check title
    if (prevSnapshot.title !== currentSnapshot.title) {
      titleChanged = true;
    }
    
    // Check steps
    const prevSteps = prevSnapshot.steps || [];
    const currentSteps = currentSnapshot.steps || [];
    
    if (prevSteps.length !== currentSteps.length) {
      stepsChanged = Math.abs(prevSteps.length - currentSteps.length);
    }
    
    // Compare step blocks
    const stepMap = new Map();
    currentSteps.forEach(step => {
      if (step.id) stepMap.set(step.id, step);
    });
    
    prevSteps.forEach(prevStep => {
      const currentStep = stepMap.get(prevStep.id);
      if (currentStep) {
        const prevBlocks = prevStep.blocks || [];
        const currentBlocks = currentStep.blocks || [];
        
        if (prevBlocks.length !== currentBlocks.length) {
          blocksChanged += Math.abs(prevBlocks.length - currentBlocks.length);
        }
        
        // Check for image changes
        const prevImages = prevBlocks.filter(b => b.type === 'image' && b.data?.url);
        const currentImages = currentBlocks.filter(b => b.type === 'image' && b.data?.url);
        const prevImageUrls = new Set(prevImages.map(b => b.data.url));
        const currentImageUrls = new Set(currentImages.map(b => b.data.url));
        
        if (prevImageUrls.size !== currentImageUrls.size || 
            [...prevImageUrls].some(url => !currentImageUrls.has(url)) ||
            [...currentImageUrls].some(url => !prevImageUrls.has(url))) {
          imagesChanged += Math.abs(prevImages.length - currentImages.length);
        }
      } else {
        stepsChanged++;
      }
    });
    
    // Check for new steps
    currentSteps.forEach(step => {
      if (!prevSteps.find(s => s.id === step.id)) {
        stepsChanged++;
        blocksChanged += (step.blocks || []).length;
        imagesChanged += (step.blocks || []).filter(b => b.type === 'image' && b.data?.url).length;
      }
    });
    
    return {
      stepsChanged,
      blocksChanged,
      imagesChanged,
      titleChanged
    };
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

  const diagnoseWalkthrough = async () => {
    if (!isEditing) return;
    setShowRecoveryDialog(true);
    try {
      const res = await api.diagnoseWalkthrough(workspaceId, walkthroughId);
      setDiagnosisData(res.data);
    } catch (e) {
      toast.error('Failed to diagnose walkthrough');
      console.error('Diagnosis error:', e);
    }
  };

  const recoverBlocks = async (versionNumber = null) => {
    if (!isEditing) return;
    setRecovering(true);
    try {
      const res = await api.recoverBlocks(workspaceId, walkthroughId, versionNumber);
      toast.success(res.data.message || `Recovered ${res.data.recovered_count} image blocks!`);
      
      // Refetch walkthrough to get recovered data
      const refreshed = await api.getWalkthrough(workspaceId, walkthroughId);
      const normalized = normalizeImageUrlsInObject(refreshed.data);
      if (normalized.steps) {
        normalized.steps = normalized.steps.map(step => {
          const stepWithBlocks = {
            ...step,
            blocks: Array.isArray(step.blocks) ? step.blocks : (step.blocks ? [step.blocks] : [])
          };
          // CRITICAL: Ensure each block has proper structure (data, settings, type, id)
          stepWithBlocks.blocks = stepWithBlocks.blocks.map(block => {
            if (!block || typeof block !== 'object') {
              return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
            }
            return {
              id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: block.type || 'text',
              data: block.data || {},
              settings: block.settings || {}
            };
          });
          return stepWithBlocks;
        });
      }
      if (refreshed.data.icon_url) {
        normalized.icon_url = normalizeImageUrl(refreshed.data.icon_url);
      }
      setWalkthrough(normalized);
      setShowRecoveryDialog(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to recover blocks');
      console.error('Recovery error:', e);
    } finally {
      setRecovering(false);
    }
  };

  const rollbackToVersion = async (versionNumber) => {
    const ok = window.confirm(`Rollback to version ${versionNumber}? This will overwrite the current draft.`);
    if (!ok) return;
    try {
      const res = await api.rollbackWalkthrough(workspaceId, walkthroughId, versionNumber);
      // CRITICAL: Normalize image URLs and ensure blocks arrays exist with proper structure
      const normalized = normalizeImageUrlsInObject(res.data);
      // Ensure all steps have blocks array initialized
      if (normalized.steps) {
        normalized.steps = normalized.steps.map(step => {
          const stepWithBlocks = {
            ...step,
            blocks: step.blocks || []
          };
          // CRITICAL: Ensure each block has proper structure (data, settings, type, id)
          stepWithBlocks.blocks = stepWithBlocks.blocks.map(block => {
            if (!block || typeof block !== 'object') {
              return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
            }
            return {
              id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: block.type || 'text',
              data: block.data || {},
              settings: block.settings || {}
            };
          });
          return stepWithBlocks;
        });
      }
      setWalkthrough(normalized);
      toast.success(`Rolled back to version ${versionNumber}`);
      setShowVersions(false);
    } catch (e) {
      console.error('Rollback error:', e);
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
        // CRITICAL: Always include icon_url, even if null, to preserve existing value
        // CRITICAL: Status is set to 'published' in next object above (line 727) for publish action
        const data = {
          title: next.title,
          description: next.description || '',
          icon_url: next.icon_url || null,  // Explicitly include, backend will preserve if None
          privacy: next.privacy,
          category_ids: next.category_ids || [],
          navigation_type: next.navigation_type,
          navigation_placement: next.navigation_placement,
          status: next.status,  // This is 'published' when called from publish action (line 727)
        };

        if (isEditing) {
          await api.updateWalkthrough(workspaceId, walkthroughId, data);

          // CRITICAL: Ensure all steps have blocks array and preserve all data with complete structure
          // IMPORTANT: Use walkthrough state directly, not next, to ensure we have the latest block data
          const currentSteps = walkthrough.steps || [];
          for (const step of currentSteps) {
            // CRITICAL: Get blocks from current state, ensure they're properly structured
            let stepBlocks = Array.isArray(step.blocks) ? step.blocks : (step.blocks ? [step.blocks] : []);
            // CRITICAL: Deep copy blocks to preserve ALL nested data including URLs
            stepBlocks = stepBlocks.map(block => {
              if (!block || typeof block !== 'object') {
                return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
              }
              // CRITICAL: Preserve ALL block data including data.url, data.caption, etc.
              return {
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: block.data ? { ...block.data } : {},  // Preserve all data fields including url
                settings: block.settings ? { ...block.settings } : {}
              };
            });
            
            if (step.id && !step.isNew) {
              await api.updateStep(workspaceId, walkthroughId, step.id, {
                title: step.title || '',
                content: step.content || '',
                media_url: step.media_url || null,
                media_type: step.media_type || null,
                navigation_type: step.navigation_type || 'next_prev',
                common_problems: step.common_problems || [],
                blocks: stepBlocks  // Send blocks with complete structure including URLs
              });
            } else if (step.isNew) {
              await api.addStep(workspaceId, walkthroughId, {
                title: step.title || '',
                content: step.content || '',
                media_url: step.media_url || null,
                media_type: step.media_type || null,
                navigation_type: step.navigation_type || 'next_prev',
                order: step.order || 0,
                common_problems: step.common_problems || [],
                blocks: stepBlocks  // Send blocks with complete structure including URLs
              });
            }
          }
          
          // CRITICAL: After publishing, refetch to ensure we have the latest data with all blocks preserved
          const refreshed = await api.getWalkthrough(workspaceId, walkthroughId);
          const normalized = normalizeImageUrlsInObject(refreshed.data);
          if (normalized.steps) {
            normalized.steps = normalized.steps.map(step => {
              const stepWithBlocks = {
                ...step,
                blocks: step.blocks || []
              };
              // CRITICAL: Ensure each block has proper structure (data, settings, type, id)
              stepWithBlocks.blocks = stepWithBlocks.blocks.map(block => {
                if (!block || typeof block !== 'object') {
                  return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
                }
                // CRITICAL: Preserve all block data including URLs
                return {
                  id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: block.type || 'text',
                  data: block.data ? { ...block.data } : {},  // Preserve all data including url
                  settings: block.settings ? { ...block.settings } : {}
                };
              });
              return stepWithBlocks;
            });
          }
          // CRITICAL: Preserve icon_url from refreshed data
          if (refreshed.data.icon_url) {
            normalized.icon_url = normalizeImageUrl(refreshed.data.icon_url);
          }
          setWalkthrough(normalized);
        } else {
          const response = await api.createWalkthrough(workspaceId, data);
          const newId = response.data.id;

          for (const step of next.steps || []) {
            // CRITICAL: Ensure blocks have complete structure
            const stepBlocks = (step.blocks || []).map(block => {
              if (!block || typeof block !== 'object') {
                return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
              }
              return {
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: block.data || {},
                settings: block.settings || {}
              };
            });
            await api.addStep(workspaceId, newId, {
              title: step.title || '',
              content: step.content || '',
              media_url: step.media_url || null,
              media_type: step.media_type || null,
              navigation_type: step.navigation_type || 'next_prev',
              order: step.order || 0,
              common_problems: step.common_problems || [],
              blocks: stepBlocks  // Send blocks with complete structure
            });
          }

          navigate(`/workspace/${workspaceSlug}/walkthroughs/${newId}/edit`);
        }
      })();
      toast.success('Published successfully!');
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const stepIds = new Set((walkthrough.steps || []).map((s) => s.id));
    if (active?.id && stepIds.has(active.id)) {
      setActiveStepId(active.id);
      setOverStepId(null);
      setInsertAfterIndex(null);
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over?.id || !active?.id) {
      setOverStepId(null);
      setInsertAfterIndex(null);
      return;
    }

    const stepIds = new Set((walkthrough.steps || []).map((s) => s.id));
    if (!stepIds.has(over.id)) {
      setOverStepId(null);
      setInsertAfterIndex(null);
      return;
    }

    setOverStepId(over.id);
    
    // Calculate insertion point based on drag position
    const overIndex = walkthrough.steps.findIndex((s) => s.id === over.id);
    const activeIndex = walkthrough.steps.findIndex((s) => s.id === active.id);
    
    // Determine if we should insert before or after the over step
    // For horizontal timeline, we check mouse position relative to step center
    if (overIndex !== -1) {
      // If dragging from left to right, insert after
      // If dragging from right to left, insert before
      if (activeIndex < overIndex) {
        setInsertAfterIndex(overIndex);
      } else if (activeIndex > overIndex) {
        setInsertAfterIndex(overIndex - 1);
      } else {
        setInsertAfterIndex(null);
      }
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveStepId(null);
    setOverStepId(null);
    setInsertAfterIndex(null);
    
    if (!active?.id || !over?.id) return;

    const stepIds = new Set((walkthrough.steps || []).map((s) => s.id));
    if (!stepIds.has(active.id) || !stepIds.has(over.id)) return;

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

  const handleDragCancel = () => {
    setActiveStepId(null);
    setOverStepId(null);
    setInsertAfterIndex(null);
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
      blocks: [],  // CRITICAL: Always initialize blocks array
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
      blocks: [],  // CRITICAL: Always initialize blocks array
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
    console.log('[CanvasBuilder] updateStep called for step:', stepId, 'Updates:', updates);
    
    setWalkthrough((prev) => {
      const updatedSteps = prev.steps.map((s) => {
        if (s.id === stepId) {
          const updated = { ...s, ...updates };
          
          // CRITICAL: Ensure blocks array always exists with proper structure
          if (!updated.blocks) {
            updated.blocks = s.blocks || [];
          }
          
          // CRITICAL: Ensure each block has complete structure (data, settings, type, id)
          // IMPORTANT: Preserve ALL block data including URLs
          if (updated.blocks && Array.isArray(updated.blocks)) {
            updated.blocks = updated.blocks.map(block => {
              if (!block || typeof block !== 'object') {
                console.warn('[CanvasBuilder] Invalid block found, creating default:', block);
                return { id: `block-${Date.now()}`, type: 'text', data: {}, settings: {} };
              }
              
              // CRITICAL: Deep copy data to preserve all nested properties including url
              const blockData = block.data ? { ...block.data } : {};
              const blockSettings = block.settings ? { ...block.settings } : {};
              
              // Log image blocks to track URL preservation
              if (block.type === 'image' && blockData.url) {
                console.log('[CanvasBuilder] Preserving image block URL:', block.id, blockData.url);
              }
              
              return {
                id: block.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: block.type || 'text',
                data: blockData,  // Preserve all data including url
                settings: blockSettings
              };
            });
          }
          
          console.log('[CanvasBuilder] Updated step blocks:', updated.blocks);
          return updated;
        }
        return s;
      });
      
      return { ...prev, steps: updatedSteps };
    });
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

  if (loading || workspaceLoading || !workspaceId) {
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
      <UpgradePrompt open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} workspaceId={workspaceId} />
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-black overflow-hidden">
        {(isSaving || isPublishing) && (
          <div
            className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-soft-lg px-6 py-5 flex items-center gap-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {isPublishing ? t('builder.publishing') : t('builder.saving')} {t('builder.pleaseWait')}
              </div>
            </div>
          </div>
        )}
        {/* Top Bar */}
        <div className="h-16 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs`)}
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.back')}
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              {isSaving && <Clock className="w-4 h-4 text-slate-400 animate-spin" />}
              {lastSaved && !isSaving && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Check className="w-4 h-4 text-success" />
                  {t('builder.saved')} {Math.round((new Date() - lastSaved) / 1000)}s {t('builder.ago')}
                </div>
              )}
            </div>
            {/* Navigation Type Toggle - Only show when editing a step */}
            {walkthrough.steps && walkthrough.steps.length > 0 && currentStepIndex >= 0 && currentStepIndex < walkthrough.steps.length && (
              <>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">{t('builder.navigationType')}:</span>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-1">
                    <Button
                      variant={(walkthrough.steps[currentStepIndex]?.navigation_type || 'next_prev') === 'next_prev' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => {
                        const currentStep = walkthrough.steps[currentStepIndex];
                        if (currentStep) {
                          updateStep(currentStep.id, { navigation_type: 'next_prev' });
                        }
                      }}
                      disabled={isSaving || isPublishing}
                    >
                      <ArrowLeftRight className="w-3 h-3 mr-1.5" />
                      {t('builder.nextPrevious')}
                    </Button>
                    <Button
                      variant={walkthrough.steps[currentStepIndex]?.navigation_type === 'checkoff' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => {
                        const currentStep = walkthrough.steps[currentStepIndex];
                        if (currentStep) {
                          updateStep(currentStep.id, { navigation_type: 'checkoff' });
                        }
                      }}
                      disabled={isSaving || isPublishing}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1.5" />
                      {t('builder.checkoffRequired')}
                    </Button>
                  </div>
                </div>
              </>
            )}
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
              {selectStepsMode ? t('walkthrough.selecting') : t('walkthrough.selectSteps')}
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
                  {selectedStepIds.size === (walkthrough.steps || []).length ? t('walkthrough.unselectAll') : t('walkthrough.selectAll')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelectedSteps}
                  disabled={selectedStepIds.size === 0 || isSaving || isPublishing}
                  data-testid="delete-selected-steps-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('walkthrough.deleteSelected')}
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
              {t('builder.addStepBelow')}
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
                {t('builder.versions')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addStep}
              disabled={isSaving || isPublishing}
              data-testid="new-step-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('builder.newStep')}
            </Button>

            {walkthrough.status === 'published' && workspace && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/portal/${workspace.slug}`, '_blank')}
                data-testid="view-portal-button"
              >
                <Eye className="w-4 h-4 mr-2" />
                {t('builder.viewPortal')}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(true)}
              disabled={isSaving || isPublishing}
              data-testid="preview-button"
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('common.preview')}
            </Button>

            <Button
              size="sm"
              onClick={() => saveWalkthrough(true)}
              disabled={isSaving || isPublishing}
              data-testid="save-button"
            >
              <Save className="w-4 h-4 mr-2" />
              {t('common.save')}
            </Button>

            <Button
              size="sm"
              onClick={handlePublish}
              data-testid="publish-button"
              className="bg-success hover:bg-success/90"
              disabled={isSaving || isPublishing}
            >
              {t('builder.publish')}
            </Button>
          </div>
        </div>

        {/* Timeline and Main Editor Area - Vertical Resizable */}
        <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0" style={{ minHeight: 0 }}>
          {/* Timeline */}
          {stepTimelineVisible ? (
            <>
              <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
                <div className="relative border-b border-slate-200 h-full overflow-hidden" style={{ minHeight: 0 }}>
                  <div className="pr-12 overflow-y-auto" style={{ height: '100%', maxHeight: '100%' }}>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext items={(walkthrough.steps || []).map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                        <StepTimeline
                          steps={walkthrough.steps}
                          currentStepIndex={currentStepIndex}
                          onStepClick={setCurrentStepIndex}
                          onDeleteStep={deleteStep}
                          selectMode={selectStepsMode}
                          selectedIds={selectedStepIds}
                          onToggleSelect={toggleStepSelected}
                          overStepId={overStepId}
                          activeStepId={activeStepId}
                          insertAfterIndex={insertAfterIndex}
                        />
                      </SortableContext>
                      <DragOverlay>
                        {activeStepId ? (() => {
                          const step = walkthrough.steps.find(s => s.id === activeStepId);
                          const stepIndex = walkthrough.steps.findIndex(s => s.id === activeStepId);
                          if (!step) return null;
                          return (
                            <div className="flex flex-col items-center justify-center p-4 rounded-xl min-w-[180px] bg-primary text-white shadow-lg scale-105">
                              <div className="text-xs font-medium mb-1">Step {stepIndex + 1}</div>
                              <div className="text-sm font-semibold max-w-[140px] text-center line-clamp-2">
                                {step.title}
                              </div>
                            </div>
                          );
                        })() : null}
                      </DragOverlay>
                    </DndContext>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-50 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 h-8 w-8 p-0"
                    onClick={() => setStepTimelineVisible(!stepTimelineVisible)}
                    title="Hide steps timeline"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-slate-200 hover:bg-slate-300 transition-colors cursor-row-resize flex-shrink-0" />
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-50 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 h-8 w-8 p-0"
              onClick={() => setStepTimelineVisible(!stepTimelineVisible)}
              title="Show steps timeline"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          )}

          {/* Main Editor Area */}
          <ResizablePanel defaultSize={stepTimelineVisible ? 85 : 100} minSize={70}>
            <div className="overflow-hidden relative h-full" style={{ minHeight: 0 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={(walkthrough.steps || []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {/* Mobile button to show left panel */}
            {!leftPanelVisible && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden fixed left-4 top-20 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-10 w-10 p-0 rounded-full"
                onClick={() => setLeftPanelVisible(true)}
                title="Show walkthrough settings"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            
            {/* Mobile button to show right panel */}
            {!rightPanelVisible && selectedElement && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden fixed right-4 top-20 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-10 w-10 p-0 rounded-full"
                onClick={() => setRightPanelVisible(true)}
                title="Show element settings"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            
            {/* Desktop: Resizable panels */}
            <div className="hidden lg:block h-full">
              <ResizablePanelGroup direction="horizontal" className={`h-full ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Left Sidebar */}
                {leftPanelVisible ? (
                  <>
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                      <div className="relative h-full">
                        <LeftSidebar
                          walkthrough={walkthrough}
                          categories={categories}
                          onUpdate={setWalkthrough}
                          onAddStep={addStep}
                          onStepClick={setCurrentStepIndex}
                          onDeleteStep={deleteStep}
                          currentStepIndex={currentStepIndex}
                          workspaceId={workspaceId}
                          onUpgrade={(reason) => setUpgradePromptOpen(true)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`absolute top-4 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-8 w-8 p-0 ${isRTL ? '-left-10' : '-right-10'}`}
                          onClick={() => setLeftPanelVisible(false)}
                          title="Hide walkthrough settings"
                        >
                          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </Button>
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-slate-200 hover:bg-slate-300 transition-colors cursor-col-resize" />
                  </>
                ) : null}
                
                {/* Live Canvas */}
                <ResizablePanel defaultSize={leftPanelVisible && rightPanelVisible ? 60 : leftPanelVisible || rightPanelVisible ? 80 : 100} minSize={40}>
                  <LiveCanvas
                    walkthrough={walkthrough}
                    currentStepIndex={currentStepIndex}
                    selectedElement={selectedElement}
                    onSelectElement={setSelectedElement}
                    onUpdateStep={updateStep}
                    workspaceId={workspaceId}
                    walkthroughId={walkthroughId}
                    onUpgrade={(reason) => setUpgradePromptOpen(true)}
                  />
                </ResizablePanel>

                {/* Right Inspector */}
                {rightPanelVisible ? (
                  <>
                    <ResizableHandle withHandle className="bg-slate-200 hover:bg-slate-300 transition-colors cursor-col-resize" />
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
                      <div className="relative h-full">
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
                          onUpdateBlock={(updatedBlock) => {
                            if (walkthrough.steps[currentStepIndex]) {
                              const updatedBlocks = (walkthrough.steps[currentStepIndex].blocks || []).map(b => 
                                b.id === updatedBlock.id ? updatedBlock : b
                              );
                              updateStep(walkthrough.steps[currentStepIndex].id, { blocks: updatedBlocks });
                            }
                          }}
                          workspaceId={workspaceId}
                          walkthroughId={walkthroughId}
                          stepId={walkthrough.steps[currentStepIndex]?.id}
                          onUpgrade={(reason) => setUpgradePromptOpen(true)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`absolute top-4 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-8 w-8 p-0 ${isRTL ? '-right-10' : '-left-10'}`}
                          onClick={() => setRightPanelVisible(false)}
                          title="Hide element settings"
                        >
                          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </ResizablePanel>
                  </>
                ) : null}
              </ResizablePanelGroup>
            </div>

            {/* Mobile overlays */}
            <div className="lg:hidden">
              {leftPanelVisible && (
                <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setLeftPanelVisible(false)}>
                  <div className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="relative h-full">
                      <LeftSidebar
                        walkthrough={walkthrough}
                        categories={categories}
                        onUpdate={setWalkthrough}
                        onAddStep={addStep}
                        onStepClick={(index) => {
                          setCurrentStepIndex(index);
                          setLeftPanelVisible(false);
                        }}
                        onDeleteStep={deleteStep}
                        currentStepIndex={currentStepIndex}
                        workspaceId={workspaceId}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-8 w-8 p-0"
                        onClick={() => setLeftPanelVisible(false)}
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Mobile canvas - always visible */}
              <div className="h-screen pt-16">
                <LiveCanvas
                  walkthrough={walkthrough}
                  currentStepIndex={currentStepIndex}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  onUpdateStep={updateStep}
                  workspaceId={workspaceId}
                  walkthroughId={walkthroughId}
                  onUpgrade={(reason) => setUpgradePromptOpen(true)}
                />
              </div>

              {rightPanelVisible && (
                <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setRightPanelVisible(false)}>
                  <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="relative h-full">
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
                        onUpdateBlock={(updatedBlock) => {
                          if (walkthrough.steps[currentStepIndex]) {
                            const updatedBlocks = (walkthrough.steps[currentStepIndex].blocks || []).map(b => 
                              b.id === updatedBlock.id ? updatedBlock : b
                            );
                            updateStep(walkthrough.steps[currentStepIndex].id, { blocks: updatedBlocks });
                          }
                        }}
                        workspaceId={workspaceId}
                        walkthroughId={walkthroughId}
                        stepId={walkthrough.steps[currentStepIndex]?.id}
                        onUpgrade={(reason) => setUpgradePromptOpen(true)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-8 w-8 p-0"
                        onClick={() => setRightPanelVisible(false)}
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Show/hide buttons when panels are hidden */}
            {!leftPanelVisible && (
              <Button
                variant="ghost"
                size="sm"
                className={`absolute top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-12 w-8 p-0 lg:flex hidden ${isRTL ? 'right-0 rounded-l-lg' : 'left-0 rounded-r-lg'}`}
                onClick={() => setLeftPanelVisible(true)}
                title="Show walkthrough settings"
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            )}
            
            {!rightPanelVisible && (
              <Button
                variant="ghost"
                size="sm"
                className={`absolute top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 h-12 w-8 p-0 lg:flex hidden ${isRTL ? 'left-0 rounded-r-lg' : 'right-0 rounded-l-lg'}`}
                onClick={() => setRightPanelVisible(true)}
                title="Show element settings"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
            )}
            </SortableContext>

            <DragOverlay>
              {activeStepId ? (
                <div className="px-4 py-3 rounded-xl bg-primary text-white shadow-lg max-w-[240px]">
                  <div className="text-xs font-medium mb-1">Move step</div>
                  <div className="text-sm font-semibold truncate">
                    {(walkthrough.steps || []).find((s) => s.id === activeStepId)?.title || 'Step'}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('builder.versionHistory')}</DialogTitle>
          </DialogHeader>
          {versionsLoading ? (
            <div className="py-8 text-center text-slate-500">{t('common.loading')}</div>
          ) : versions.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {versions.map((v, idx) => {
                const prevVersion = idx < versions.length - 1 ? versions[idx + 1] : null;
                const changes = prevVersion ? getVersionChanges(prevVersion, v) : null;
                return (
                  <div key={v.id} className="flex items-start justify-between border border-slate-200 rounded-lg p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{t('builder.version')} {v.version}</div>
                      <div className="text-xs text-slate-500 truncate">{new Date(v.created_at).toLocaleString()}</div>
                      {changes && (
                        <div className="mt-2 text-xs text-slate-600 space-y-1">
                          {changes.stepsChanged > 0 && (
                            <div>• {t('builder.stepsChanged', { count: changes.stepsChanged })}</div>
                          )}
                          {changes.blocksChanged > 0 && (
                            <div>• {t('builder.blocksChanged', { count: changes.blocksChanged })}</div>
                          )}
                          {changes.imagesChanged > 0 && (
                            <div>• {t('builder.imagesChanged', { count: changes.imagesChanged })}</div>
                          )}
                          {changes.titleChanged && (
                            <div>• {t('builder.titleChanged')}</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-3">
                        <Button size="sm" variant="outline" onClick={() => rollbackToVersion(v.version)}>
                        {t('builder.rollback')}
                      </Button>
                      {versions.length > 1 && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={async () => {
                            if (window.confirm(t('builder.deleteVersionConfirm', { version: v.version }))) {
                              try {
                                await api.deleteWalkthroughVersion(workspaceId, walkthroughId, v.version);
                                toast.success(t('builder.versionDeleted'));
                                // Refresh versions list
                                const response = await api.getWalkthroughVersions(workspaceId, walkthroughId);
                                setVersions(response.data);
                              } catch (error) {
                                toast.error(error.response?.data?.detail || t('builder.failedToDeleteVersion'));
                              }
                            }
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              {t('builder.noVersions')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Recovery Dialog */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              {t('builder.imageRecovery')}
            </DialogTitle>
            <p className="text-sm text-slate-600 mt-2">
              {t('builder.imageRecoveryDescription')}
            </p>
          </DialogHeader>
          {diagnosisData ? (
            <div className="space-y-4 mt-4">
              {/* Current Status */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-semibold text-slate-900 mb-2">{t('builder.currentStatus')}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{t('builder.currentVersion')}:</span>
                    <span className="font-medium">{diagnosisData.current_version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{t('builder.hasImages')}:</span>
                    <span className={`font-medium ${diagnosisData.current_blocks_status.has_blocks ? 'text-success' : 'text-destructive'}`}>
                      {diagnosisData.current_blocks_status.has_blocks ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{t('builder.totalImageBlocks')}:</span>
                    <span className="font-medium">{diagnosisData.current_blocks_status.total_image_blocks}</span>
                  </div>
                  {diagnosisData.current_blocks_status.steps_with_images.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">{t('builder.stepsWithImages')}:</p>
                      {diagnosisData.current_blocks_status.steps_with_images.map((step, idx) => (
                        <div key={idx} className="text-xs text-slate-600 ml-2">
                          • {step.step_title}: {step.image_count} {step.image_count === 1 ? t('builder.imageCount') : t('builder.imageCountPlural')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Version Snapshots */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-semibold text-slate-900 mb-2">{t('builder.versionSnapshots')}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{t('builder.totalVersions')}:</span>
                    <span className="font-medium">{diagnosisData.version_snapshots_status.total_versions}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">{t('builder.versionsWithImages')}:</span>
                    <span className="font-medium">{diagnosisData.version_snapshots_status.versions_with_images}</span>
                  </div>
                </div>
                {diagnosisData.version_snapshots_status.version_details.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {diagnosisData.version_snapshots_status.version_details.map((version, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-900">Version {version.version}</span>
                          <span className="text-xs text-slate-500">{new Date(version.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          {version.images.map((img, imgIdx) => (
                            <div key={imgIdx} className="ml-2">
                              • {img.step_title}: {img.blocks_with_urls || img.image_count || 0} image(s) with URLs
                              {img.empty_blocks && img.empty_blocks.length > 0 && (
                                <span className="text-warning-600 ml-1">
                                  ({img.empty_blocks.length} empty)
                                </span>
                              )}
                            </div>
                          ))}
                          {version.total_empty_blocks > 0 && (
                            <div className="mt-2 pt-2 border-t border-warning/30 text-warning-600 text-xs">
                              ⚠️ {version.total_empty_blocks} image block(s) have empty URLs and cannot be recovered
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recovery Action */}
              {diagnosisData.can_recover && (
                <div className="p-4 rounded-xl border border-warning/30 bg-warning/10">
                  <h3 className="font-semibold text-warning-600 mb-2">{t('builder.recoveryAvailable')}</h3>
                  <p className="text-sm text-slate-700 mb-4">
                    {t('builder.imagesFoundInSnapshots')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => recoverBlocks()}
                      disabled={recovering}
                      className="bg-warning/20 text-warning-600 hover:bg-warning/30 border-warning/30"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${recovering ? 'animate-spin' : ''}`} />
                      {recovering ? t('builder.recovering') : t('builder.recoverFromLatest')}
                    </Button>
                    {diagnosisData.version_snapshots_status.version_details.length > 1 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const latestVersion = diagnosisData.version_snapshots_status.version_details[0]?.version;
                          if (latestVersion) recoverBlocks(latestVersion);
                        }}
                        disabled={recovering}
                      >
                        {t('builder.recoverFromVersion', { version: diagnosisData.version_snapshots_status.version_details[0]?.version })}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!diagnosisData.can_recover && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                  <p className="text-sm text-destructive font-medium mb-2">
                    {t('builder.noRecoverableImages')}
                  </p>
                  <p className="text-xs text-destructive/80">
                    {t('builder.emptyImageUrls')} {t('builder.reuploadManually')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">Analyzing walkthrough...</div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CanvasBuilderPage;