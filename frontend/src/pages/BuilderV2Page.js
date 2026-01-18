import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, Eye, Clock, Check, ArrowLeft, Undo2, Redo2, Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrl, normalizeImageUrlsInObject } from '../lib/utils';
import { BLOCK_TYPES, createBlock, getBlockLabel, getBlockIcon } from '../utils/blockUtils';
import InlineRichEditor from '../components/canvas-builder/InlineRichEditor';
import RichTextEditor from '../components/canvas-builder/RichTextEditor';
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
  const isEditing = !!walkthroughId;
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load walkthrough if editing
  useEffect(() => {
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
          if (normalized.steps && normalized.steps.length > 0) {
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
        navigate(`/workspace/${workspaceId}/builder-v2/${response.data.id}`, { replace: true });
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

  // Update current step
  const updateCurrentStep = (updates) => {
    const newSteps = [...walkthrough.steps];
    if (newSteps[currentStepIndex]) {
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], ...updates };
      setWalkthrough({ ...walkthrough, steps: newSteps });
    }
  };

  // Add block at index
  const addBlock = (blockType, insertAfterIndex) => {
    const newBlock = createBlock(blockType);
    const newSteps = [...walkthrough.steps];
    if (newSteps[currentStepIndex]) {
      const blocks = newSteps[currentStepIndex].blocks || [];
      const newBlocks = [...blocks];
      if (insertAfterIndex === -1) {
        newBlocks.unshift(newBlock);
      } else {
        newBlocks.splice(insertAfterIndex + 1, 0, newBlock);
      }
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], blocks: newBlocks };
      setWalkthrough({ ...walkthrough, steps: newSteps });
      setSelectedBlockId(newBlock.id);
      setBlockPickerOpen(null);
    }
  };

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

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentStep = walkthrough.steps[currentStepIndex] || null;
  const selectedBlock = currentStep?.blocks?.find(b => b.id === selectedBlockId) || null;
  const blocks = currentStep?.blocks || [];
  const blockItems = blocks.map(b => b.id);

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
          onAddStep={() => {
            const newStep = {
              id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: `Step ${walkthrough.steps.length + 1}`,
              blocks: [],
              order: walkthrough.steps.length
            };
            setWalkthrough({ ...walkthrough, steps: [...walkthrough.steps, newStep] });
            setCurrentStepIndex(walkthrough.steps.length);
          }}
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
          />
        </div>

        {/* Zone 4: Inspector Panel (Right - Fixed Width, No Scroll) */}
        <InspectorPanel
          selectedBlock={selectedBlock}
          currentStep={currentStep}
          onStepUpdate={updateCurrentStep}
          onBlockUpdate={updateBlock}
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
const StepNavigator = ({ steps, currentStepIndex, onStepClick, onAddStep }) => {
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
                className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                  currentStepIndex === index ? 'bg-slate-100 border-l-2 border-primary' : ''
                }`}
                onClick={() => onStepClick(index)}
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
  onDragStart,
  onDragEnd,
  blockItems,
  sensors,
  workspaceId,
  walkthroughId,
  stepId,
  onMediaUpload,
  blockPickerOpen,
  onBlockPickerOpen
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
              <StepTitleEditor
                title={currentStep.title}
                onChange={(title) => onStepUpdate({ title })}
              />

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

// Step Title Editor
const StepTitleEditor = ({ title, onChange }) => {
  return (
    <InlineRichEditor
      content={title || ''}
      onChange={onChange}
      placeholder="Step title..."
      isRTL={false}
      textSize="text-3xl"
      isBold={true}
      align="left"
      className="text-slate-900 font-heading"
    />
  );
};

// Add Block Button with Popover
const AddBlockButton = ({ insertAfterIndex, onAdd, isOpen, onOpenChange }) => {
  const blockTypes = [
    BLOCK_TYPES.HEADING,
    BLOCK_TYPES.TEXT,
    BLOCK_TYPES.IMAGE,
    BLOCK_TYPES.VIDEO,
    BLOCK_TYPES.BUTTON,
    BLOCK_TYPES.DIVIDER,
    BLOCK_TYPES.SPACER,
    BLOCK_TYPES.PROBLEM,
  ];

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity border-2 border-dashed border-slate-300 rounded-lg hover:border-primary hover:bg-primary/5"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(true);
          }}
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-white border-slate-200">
        <div className="grid grid-cols-2 gap-2">
          {blockTypes.map((type) => (
            <button
              key={type}
              className="p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 text-left transition-colors"
              onClick={() => {
                onAdd(type, insertAfterIndex);
                onOpenChange(false);
              }}
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
  onMediaUpload
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
          />
        </div>
      </div>
    </div>
  );
};

// Block Content Renderer
const BlockContent = ({ block, onUpdate, onDelete, workspaceId, walkthroughId, stepId, onMediaUpload }) => {
  switch (block.type) {
    case BLOCK_TYPES.HEADING:
      const headingSize = block.data.level === 1 ? 'text-3xl' : block.data.level === 2 ? 'text-2xl' : 'text-xl';
      return (
        <div>
          <InlineRichEditor
            content={block.data.content || ''}
            onChange={(content) => onUpdate({ data: { ...block.data, content } })}
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
          content={block.data.content || ''}
          onChange={(content) => onUpdate({ data: { ...block.data, content } })}
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

    default:
      return <div className="text-slate-400 text-sm">Unknown block type: {block.type}</div>;
  }
};

// Inspector Panel Component
const InspectorPanel = ({
  selectedBlock,
  currentStep,
  onStepUpdate,
  onBlockUpdate,
  workspaceId,
  walkthroughId,
  stepId,
  onMediaUpload,
  canUploadFile
}) => {
  if (selectedBlock) {
    return (
      <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Block Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Block Type</Label>
            <div className="text-sm font-medium text-slate-900">{getBlockLabel(selectedBlock.type)}</div>
          </div>
          {selectedBlock.type === BLOCK_TYPES.IMAGE && (
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Image URL</Label>
              <Input
                value={selectedBlock.data?.url || ''}
                onChange={(e) => onBlockUpdate(selectedBlock.id, { data: { ...selectedBlock.data, url: e.target.value } })}
                placeholder="Image URL"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentStep) {
    return (
      <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Step Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Step Title</Label>
            <Input
              value={currentStep.title || ''}
              onChange={(e) => onStepUpdate({ title: e.target.value })}
              placeholder="Step title"
            />
          </div>
        </div>
      </div>
    );
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
