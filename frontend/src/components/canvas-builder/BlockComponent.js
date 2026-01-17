import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Trash2, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import RichTextEditor from './RichTextEditor';
import InlineRichEditor from './InlineRichEditor';
import { BLOCK_TYPES } from '../../utils/blockUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../../lib/api';
import { normalizeImageUrl } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuota } from '../../hooks/useQuota';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

// Render can provide a bare hostname; ensure we always have a valid absolute URL
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const BlockComponent = ({ block, isSelected, onSelect, onUpdate, onDelete, onDuplicate, isRTL, workspaceId, walkthroughId, stepId, onUpgrade }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });
  
  const { canUploadFile } = useQuota(workspaceId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const handleMediaUpload = async (file) => {
    try {
      console.log('[BlockComponent] Starting upload for block:', block.id, 'Type:', block.type);
      
      // Check quota before upload
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
        if (onUpgrade && (quotaCheck.reason === 'storage' || quotaCheck.reason === 'file_size')) {
          onUpgrade(quotaCheck.reason);
        }
        return;
      }
      
      // Generate idempotency key for this upload
      const idempotencyKey = `${block.id}-${file.name}-${file.size}-${Date.now()}`;
      
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'block_image',
        referenceId: block.id
      });
      console.log('[BlockComponent] Upload response:', response.data);
      
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      // If URL is already absolute (starts with http:// or https://), use it directly
      // Otherwise, prepend API_BASE for local storage fallback
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${API_BASE.replace(/\/$/, '')}${uploadedUrl}`;
      
      console.log('[BlockComponent] Full URL:', fullUrl);
      
      // CRITICAL: Preserve ALL existing block data and settings when updating URL
      const updatedBlock = {
        ...block,
        data: {
          ...(block.data || {}), // Preserve all existing data fields
          url: fullUrl, // Update URL
          file_id: response.data.file_id // Store file_id for tracking
        },
        settings: block.settings || {} // Preserve settings
      };
      
      if (block.type === BLOCK_TYPES.IMAGE) {
        console.log('[BlockComponent] Updating image block with URL:', fullUrl);
        onUpdate(updatedBlock);
      } else if (block.type === BLOCK_TYPES.VIDEO) {
        updatedBlock.data.type = 'url';
        console.log('[BlockComponent] Updating video block with URL:', fullUrl);
        onUpdate(updatedBlock);
      } else if (block.type === BLOCK_TYPES.FILE) {
        updatedBlock.data.name = file.name;
        updatedBlock.data.size = file.size;
        updatedBlock.data.type = file.type;
        console.log('[BlockComponent] Updating file block with URL:', fullUrl);
        onUpdate(updatedBlock);
      }
      
      console.log('[BlockComponent] Block updated successfully:', updatedBlock);
      toast.success('File uploaded!');
    } catch (error) {
      console.error('[BlockComponent] Upload error:', error);
      
      // Handle quota errors with user-friendly messages
      if (error.response?.status === 402) {
        const message = error.response?.data?.detail || 'Storage quota exceeded. Please upgrade your plan or delete some files.';
        toast.error(message);
        if (onUpgrade) {
          onUpgrade('storage');
        }
      } else if (error.response?.status === 413) {
        const message = error.response?.data?.detail || 'File size exceeds the maximum allowed for your plan.';
        toast.error(message);
        if (onUpgrade) {
          onUpgrade('file_size');
        }
      } else if (error.response?.status === 409) {
        toast.error('Upload already in progress. Please wait...');
      } else {
        toast.error(error.response?.data?.detail || 'Upload failed');
      }
    }
  };

  const renderBlock = () => {
    switch (block.type) {
      case BLOCK_TYPES.HEADING:
        const headingSize = block.data.level === 1 ? 'text-3xl' : block.data.level === 2 ? 'text-2xl' : 'text-xl';
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Select
                value={block.data.level.toString()}
                onValueChange={(value) => onUpdate({ ...block, data: { ...block.data, level: parseInt(value) } })}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <InlineRichEditor
              content={block.data.content}
              onChange={(html) => onUpdate({ ...block, data: { ...block.data, content: html } })}
              placeholder="Heading text..."
              isRTL={isRTL}
              textSize={headingSize}
              isBold={true}
              className="text-slate-900"
            />
          </div>
        );

      case BLOCK_TYPES.TEXT:
        return (
          <RichTextEditor
            content={block.data.content}
            onChange={(content) => onUpdate({ ...block, data: { ...block.data, content } })}
            isRTL={isRTL}
          />
        );

      case BLOCK_TYPES.IMAGE:
        return (
          <div>
            {block.data?.url ? (
              <div>
                <img 
                  src={normalizeImageUrl(block.data.url)} 
                  alt={block.data.alt || ''} 
                  className="w-full rounded-lg mb-2"
                  onError={(e) => {
                    console.error('[BlockComponent] Image failed to load:', {
                      blockId: block.id,
                      url: block.data.url,
                      error: e
                    });
                    // Show placeholder on error
                    e.target.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.className = 'border-2 border-dashed border-red-300 rounded-lg p-4 text-center bg-red-50';
                    placeholder.innerHTML = '<p class="text-sm text-red-600">Image failed to load</p>';
                    e.target.parentNode.appendChild(placeholder);
                  }}
                />
                <Input
                  value={block.data.caption || ''}
                  onChange={(e) => onUpdate({ ...block, data: { ...block.data, caption: e.target.value } })}
                  placeholder="Add caption..."
                  className="text-sm"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && handleMediaUpload(e.target.files[0])}
                  className="mb-2"
                />
                <p className="text-sm text-slate-500 mt-2">or</p>
                <Input
                  placeholder="Paste image URL"
                  onBlur={(e) => {
                    if (e.target.value) {
                      const normalizedUrl = normalizeImageUrl(e.target.value);
                      onUpdate({ ...block, data: { ...block.data, url: normalizedUrl } });
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
                  onChange={(e) => e.target.files[0] && handleMediaUpload(e.target.files[0])}
                  className="mb-2"
                />
                <p className="text-sm text-slate-500 mt-2">or YouTube URL</p>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  onBlur={(e) => {
                    if (e.target.value) {
                      onUpdate({ 
                        ...block, 
                        data: { 
                          ...block.data, 
                          url: e.target.value,
                          type: e.target.value.includes('youtube') || e.target.value.includes('youtu.be') ? 'youtube' : 'url'
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

      case BLOCK_TYPES.FILE:
        return (
          <div>
            {block.data.url ? (
              <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{block.data.name}</div>
                  <div className="text-sm text-slate-500">{(block.data.size / 1024).toFixed(2)} KB</div>
                </div>
                <a href={block.data.url} download className="text-primary hover:underline text-sm">
                  Download
                </a>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Input
                  type="file"
                  onChange={(e) => e.target.files[0] && handleMediaUpload(e.target.files[0])}
                />
                <p className="text-sm text-slate-500 mt-2">Upload any file (PDF, ZIP, etc)</p>
              </div>
            )}
          </div>
        );

      case BLOCK_TYPES.BUTTON:
        return (
          <div className="space-y-3">
            <Input
              value={block.data.text}
              onChange={(e) => onUpdate({ ...block, data: { ...block.data, text: e.target.value } })}
              placeholder="Button text"
            />
            <Select
              value={block.data.action}
              onValueChange={(value) => onUpdate({ ...block, data: { ...block.data, action: value } })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">Next Step</SelectItem>
                <SelectItem value="link">External Link</SelectItem>
                <SelectItem value="check">Checkbox Required</SelectItem>
              </SelectContent>
            </Select>
            {block.data.action === 'link' && (
              <Input
                value={block.data.url || ''}
                onChange={(e) => onUpdate({ ...block, data: { ...block.data, url: e.target.value } })}
                placeholder="https://..."
              />
            )}
            <div className="flex gap-2">
              <Button
                variant={block.data.style === 'primary' ? 'default' : 'outline'}
                onClick={() => onUpdate({ ...block, data: { ...block.data, style: 'primary' } })}
                size="sm"
              >
                Primary
              </Button>
              <Button
                variant={block.data.style === 'secondary' ? 'default' : 'outline'}
                onClick={() => onUpdate({ ...block, data: { ...block.data, style: 'secondary' } })}
                size="sm"
              >
                Secondary
              </Button>
            </div>
          </div>
        );

      case BLOCK_TYPES.DIVIDER:
        return (
          <div className="py-4">
            <hr className="border-slate-300" />
          </div>
        );

      case BLOCK_TYPES.SPACER:
        return (
          <div className="flex items-center gap-2">
            <Label className="text-sm">Height:</Label>
            <Input
              type="number"
              value={block.data.height}
              onChange={(e) => onUpdate({ ...block, data: { ...block.data, height: parseInt(e.target.value) } })}
              className="w-24"
              min="8"
              max="200"
            />
            <span className="text-sm text-slate-500">px</span>
            <div className="flex-1 border-b border-dashed border-slate-300" style={{ marginBottom: block.data.height / 2 }} />
          </div>
        );

      case BLOCK_TYPES.PROBLEM:
        return (
          <div className="border-l-4 border-orange-400 bg-orange-50/50 backdrop-blur-sm p-4 rounded-xl">
            <Input
              value={block.data.title}
              onChange={(e) => onUpdate({ ...block, data: { ...block.data, title: e.target.value } })}
              placeholder="Problem title"
              className="mb-2 bg-white"
            />
            <Input
              value={block.data.explanation}
              onChange={(e) => onUpdate({ ...block, data: { ...block.data, explanation: e.target.value } })}
              placeholder="Solution"
              className="bg-white"
            />
          </div>
        );

      default:
        return <div className="text-slate-400">Unknown block type: {block.type}</div>;
    }
  };

  const settings = block.settings || {};
  const blockStyle = {
    padding: `${settings.padding || 16}px`,
    marginTop: `${settings.marginTop || settings.margin || 0}px`,
    marginBottom: `${settings.marginBottom || settings.margin || 0}px`,
    marginLeft: `${settings.marginLeft || settings.margin || 0}px`,
    marginRight: `${settings.marginRight || settings.margin || 0}px`,
    borderWidth: `${settings.borderWidth || 0}px`,
    borderColor: settings.borderColor || '#e2e8f0',
    borderStyle: settings.borderWidth > 0 ? 'solid' : 'none',
    borderRadius: `${settings.borderRadius || 8}px`,
    backgroundColor: settings.backgroundColor && settings.backgroundColor !== 'transparent' ? settings.backgroundColor : 'transparent'
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...blockStyle }}
      data-block-id={block.id}
      className={`group relative transition-all ${
        isSelected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-slate-300'
      }`}
      onClick={() => onSelect(block.id)}
    >
      {/* Block Controls */}
      <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
        <button
          {...attributes}
          {...listeners}
          className="w-8 h-8 flex items-center justify-center bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(block);
          }}
          className="w-8 h-8 flex items-center justify-center bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white"
        >
          <Copy className="w-4 h-4 text-slate-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>

      {/* Block Content */}
      <div>
        {renderBlock()}
      </div>
    </div>
  );
};

export default BlockComponent;