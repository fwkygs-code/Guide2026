import React, { useState, useRef, useEffect } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import BlockComponent from './BlockComponent';
import InlineRichEditor from './InlineRichEditor';
import { BLOCK_TYPES, createBlock, getBlockIcon, getBlockLabel, detectRTL } from '../../utils/blockUtils';

const LiveCanvas = ({ walkthrough, currentStepIndex, selectedElement, onSelectElement, onUpdateStep, workspaceId, walkthroughId, onUpgrade }) => {
  const currentStep = walkthrough.steps[currentStepIndex];
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [isBlockPickerOpen, setIsBlockPickerOpen] = useState(false);
  const [pendingFocusBlockId, setPendingFocusBlockId] = useState(null);
  const pickerRef = useRef(null);

  // Detect RTL from walkthrough title or step content
  const isRTL = detectRTL(walkthrough.title) || (currentStep && detectRTL(currentStep.title));

  // Close picker on escape or click outside
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsBlockPickerOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsBlockPickerOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus new block after creation
  useEffect(() => {
    if (pendingFocusBlockId) {
      requestAnimationFrame(() => {
        const blockElement = document.querySelector(`[data-block-id="${pendingFocusBlockId}"]`);
        if (blockElement) {
          const firstInput = blockElement.querySelector('input, textarea, [contenteditable]');
          if (firstInput) {
            firstInput.focus();
          }
        }
        setPendingFocusBlockId(null);
      });
    }
  }, [pendingFocusBlockId, currentStep?.blocks]);

  const addBlock = (type) => {
    if (!currentStep) return;
    
    const newBlock = createBlock(type);
    const updatedBlocks = [...(currentStep.blocks || []), newBlock];
    
    // Insert block
    onUpdateStep(currentStep.id, { blocks: updatedBlocks });
    
    // Close picker
    setIsBlockPickerOpen(false);
    
    // Set for focus
    setSelectedBlockId(newBlock.id);
    setPendingFocusBlockId(newBlock.id);
  };

  const updateBlock = (updatedBlock) => {
    if (!currentStep) return;
    
    const updatedBlocks = (currentStep.blocks || []).map(b => 
      b.id === updatedBlock.id ? updatedBlock : b
    );
    
    onUpdateStep(currentStep.id, { blocks: updatedBlocks });
  };

  const deleteBlock = (blockId) => {
    if (!currentStep) return;
    
    const updatedBlocks = (currentStep.blocks || []).filter(b => b.id !== blockId);
    onUpdateStep(currentStep.id, { blocks: updatedBlocks });
    setSelectedBlockId(null);
  };

  const duplicateBlock = (block) => {
    if (!currentStep) return;
    
    const newBlock = { ...block, id: `block-${Date.now()}` };
    const blocks = currentStep.blocks || [];
    const blockIndex = blocks.findIndex(b => b.id === block.id);
    const updatedBlocks = [
      ...blocks.slice(0, blockIndex + 1),
      newBlock,
      ...blocks.slice(blockIndex + 1)
    ];
    
    onUpdateStep(currentStep.id, { blocks: updatedBlocks });
  };

  const blockTypes = [
    { type: BLOCK_TYPES.HEADING, label: getBlockLabel(BLOCK_TYPES.HEADING), icon: getBlockIcon(BLOCK_TYPES.HEADING) },
    { type: BLOCK_TYPES.TEXT, label: getBlockLabel(BLOCK_TYPES.TEXT), icon: getBlockIcon(BLOCK_TYPES.TEXT) },
    { type: BLOCK_TYPES.IMAGE, label: getBlockLabel(BLOCK_TYPES.IMAGE), icon: getBlockIcon(BLOCK_TYPES.IMAGE) },
    { type: BLOCK_TYPES.VIDEO, label: getBlockLabel(BLOCK_TYPES.VIDEO), icon: getBlockIcon(BLOCK_TYPES.VIDEO) },
    { type: BLOCK_TYPES.FILE, label: getBlockLabel(BLOCK_TYPES.FILE), icon: getBlockIcon(BLOCK_TYPES.FILE) },
    { type: BLOCK_TYPES.BUTTON, label: getBlockLabel(BLOCK_TYPES.BUTTON), icon: getBlockIcon(BLOCK_TYPES.BUTTON) },
    { type: BLOCK_TYPES.DIVIDER, label: getBlockLabel(BLOCK_TYPES.DIVIDER), icon: getBlockIcon(BLOCK_TYPES.DIVIDER) },
    { type: BLOCK_TYPES.SPACER, label: getBlockLabel(BLOCK_TYPES.SPACER), icon: getBlockIcon(BLOCK_TYPES.SPACER) },
    { type: BLOCK_TYPES.PROBLEM, label: getBlockLabel(BLOCK_TYPES.PROBLEM), icon: getBlockIcon(BLOCK_TYPES.PROBLEM) },
    { type: BLOCK_TYPES.CHECKLIST, label: getBlockLabel(BLOCK_TYPES.CHECKLIST), icon: getBlockIcon(BLOCK_TYPES.CHECKLIST) },
    { type: BLOCK_TYPES.CALLOUT, label: getBlockLabel(BLOCK_TYPES.CALLOUT), icon: getBlockIcon(BLOCK_TYPES.CALLOUT) },
    { type: BLOCK_TYPES.ANNOTATED_IMAGE, label: getBlockLabel(BLOCK_TYPES.ANNOTATED_IMAGE), icon: getBlockIcon(BLOCK_TYPES.ANNOTATED_IMAGE) },
    { type: BLOCK_TYPES.EMBED, label: getBlockLabel(BLOCK_TYPES.EMBED), icon: getBlockIcon(BLOCK_TYPES.EMBED) },
    { type: BLOCK_TYPES.SECTION, label: getBlockLabel(BLOCK_TYPES.SECTION), icon: getBlockIcon(BLOCK_TYPES.SECTION) },
    { type: BLOCK_TYPES.CONFIRMATION, label: getBlockLabel(BLOCK_TYPES.CONFIRMATION), icon: getBlockIcon(BLOCK_TYPES.CONFIRMATION) },
    { type: BLOCK_TYPES.EXTERNAL_LINK, label: getBlockLabel(BLOCK_TYPES.EXTERNAL_LINK), icon: getBlockIcon(BLOCK_TYPES.EXTERNAL_LINK) },
    { type: BLOCK_TYPES.CODE, label: getBlockLabel(BLOCK_TYPES.CODE), icon: getBlockIcon(BLOCK_TYPES.CODE) },
  ];

  if (!currentStep) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/30">
        <div className="text-center">
          <p className="text-slate-400 mb-4">אין שלב נבחר</p>
          <p className="text-sm text-slate-500">הוסף שלב להתחלה</p>
        </div>
      </div>
    );
  }

  const blocks = currentStep.blocks || [];

  return (
    <div className="flex-1 flex flex-col bg-gray-50/30 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Canvas Container */}
      <div className="flex-1 overflow-y-auto p-12">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Live Step Card */}
          <div className="bg-white rounded-2xl shadow-soft-lg p-12 min-h-[600px]">
            {/* Step Title - Rich Text Editable */}
            <div className="mb-8" data-testid="canvas-step-title">
              <InlineRichEditor
                content={currentStep.title}
                onChange={(html) => onUpdateStep(currentStep.id, { title: html })}
                  placeholder="Step name"
                isRTL={isRTL}
                textSize="text-4xl"
                isBold={true}
                  align="center"
                className="text-slate-900 font-heading"
              />
            </div>

            {/* Blocks */}
            <div className="space-y-4 ml-12">
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block) => (
                  <BlockComponent
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    onSelect={(id) => {
                      setSelectedBlockId(id);
                      onSelectElement({ type: 'block', block, onUpdateBlock: updateBlock });
                    }}
                    onUpdate={updateBlock}
                    onDelete={deleteBlock}
                    onDuplicate={duplicateBlock}
                    isRTL={isRTL}
                    workspaceId={workspaceId}
                    walkthroughId={walkthroughId}
                    stepId={currentStep.id}
                    onUpgrade={onUpgrade}
                  />
                ))}
              </SortableContext>

              {/* Add Block Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    data-testid="add-block-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add block
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-[500px] overflow-y-auto" align="start">
                  <div className="grid grid-cols-2 gap-2">
                    {blockTypes.map(({ type, label, icon }) => (
                      <Button
                        key={type}
                        variant="outline"
                        onClick={() => addBlock(type)}
                        className="justify-start h-auto py-3"
                        data-testid={`add-block-${type}`}
                      >
                        <span className="text-xl mr-2">{icon}</span>
                        <span className="text-sm">{label}</span>
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {blocks.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="mb-2">No blocks yet</p>
                <p className="text-sm">Click “Add block” to get started</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Canvas Hint */}
      <div className="h-12 border-t border-slate-200 bg-white flex items-center justify-center">
        <div className="text-sm text-slate-500">
          Drag blocks to reorder • Click to edit • {isRTL && 'RTL enabled'}
        </div>
      </div>
    </div>
  );
};

export default LiveCanvas;
