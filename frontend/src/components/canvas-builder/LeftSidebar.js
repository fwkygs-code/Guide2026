import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, FileText, Trash2, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { api } from '../../lib/api';
import { normalizeImageUrl } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuota } from '../../hooks/useQuota';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:8000';
const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const LeftSidebar = ({ walkthrough, categories, onUpdate, onAddStep, onStepClick, currentStepIndex, onDeleteStep, workspaceId, onUpgrade }) => {
  const { t } = useTranslation();
  const { canUploadFile } = useQuota(workspaceId);
  
  // Organize categories into tree structure
  const categoryTree = useMemo(() => {
    // Filter out any null/undefined categories and ensure parent_id is properly handled
    const validCategories = (categories || []).filter(c => c && c.id);
    const parents = validCategories.filter(c => !c.parent_id || c.parent_id === null || c.parent_id === '');
    return parents.map(parent => ({
      ...parent,
      children: validCategories.filter(c => c.parent_id === parent.id)
    }));
  }, [categories]);

  const handleIconUpload = async (file) => {
    try {
      // Check quota before upload
      const quotaCheck = canUploadFile(file.size);
      if (!quotaCheck.allowed) {
        toast.error(quotaCheck.message || 'Cannot upload file. Quota limit reached.');
        if (onUpgrade && (quotaCheck.reason === 'storage' || quotaCheck.reason === 'file_size')) {
          onUpgrade(quotaCheck.reason);
        }
        return;
      }
      
      const idempotencyKey = `walkthrough-icon-${walkthrough.id}-${file.name}-${Date.now()}`;
      const response = await api.uploadFile(file, {
        workspaceId: workspaceId,
        idempotencyKey: idempotencyKey,
        referenceType: 'walkthrough_icon',
        referenceId: walkthrough.id
      });
      
      // CRITICAL: Only update walkthrough if upload status is confirmed as ACTIVE or EXISTING
      const uploadStatus = response.data.status;
      if (uploadStatus !== 'active' && uploadStatus !== 'existing') {
        console.error('[LeftSidebar] Upload not confirmed active:', uploadStatus);
        toast.error(`Upload not completed (status: ${uploadStatus}). Please try again.`);
        return; // Do not update walkthrough
      }
      
      if (!response.data.url) {
        console.error('[LeftSidebar] Upload response missing URL');
        toast.error('Upload succeeded but no URL returned. Please try again.');
        return; // Do not update walkthrough
      }
      
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      // If URL is already absolute (starts with http:// or https://), use it directly
      // Otherwise, prepend API_BASE for local storage fallback
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${API_BASE.replace(/\/$/, '')}${uploadedUrl}`;
      // CRITICAL: Always preserve all other walkthrough data when updating icon
      onUpdate({ 
        ...walkthrough, 
        icon_url: fullUrl,
        // Ensure steps and blocks are preserved
        steps: walkthrough.steps || []
      });
      toast.success('Icon uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
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
      } else {
        toast.error(error.response?.data?.detail || 'Upload failed');
      }
    }
  };

  const handleCategoryChange = (categoryId) => {
    const currentIds = walkthrough.category_ids || [];
    if (currentIds.includes(categoryId)) {
      // Remove category
      onUpdate({ ...walkthrough, category_ids: currentIds.filter(id => id !== categoryId) });
    } else {
      // Add category
      onUpdate({ ...walkthrough, category_ids: [...currentIds, categoryId] });
    }
  };

  return (
    <div className="w-80 border-r border-slate-200 bg-white flex flex-col" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ResizablePanelGroup direction="vertical" className="h-full">
        {/* Walkthrough Info */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={60}>
          <div className="p-6 h-full overflow-y-auto">
        <Input
          value={walkthrough.title}
          onChange={(e) => onUpdate({ ...walkthrough, title: e.target.value })}
          className="text-lg font-heading font-semibold mb-3 border-0 px-0 focus-visible:ring-0"
          placeholder={t('walkthrough.title')}
          data-testid="walkthrough-title"
        />
        
        <textarea
          value={walkthrough.description || ''}
          onChange={(e) => onUpdate({ ...walkthrough, description: e.target.value })}
          className="w-full text-sm text-slate-600 resize-none border-0 px-0 focus:outline-none"
          placeholder={t('walkthrough.description')}
          rows={2}
          data-testid="walkthrough-description"
        />

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t('category.icon')}</label>
            <div className="space-y-2">
              {walkthrough.icon_url ? (
                <div className="flex items-center gap-2">
                  <img 
                    src={normalizeImageUrl(walkthrough.icon_url)} 
                    alt="Icon" 
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200/50"
                    onError={(e) => {
                      console.error('Failed to load icon:', walkthrough.icon_url);
                      // Don't remove icon_url on error, just hide the broken image
                      e.target.style.display = 'none';
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // CRITICAL: Preserve all other data when removing icon
                      onUpdate({ 
                        ...walkthrough, 
                        icon_url: null,
                        steps: walkthrough.steps || []
                      });
                    }}
                    className="h-8"
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <label className="flex-1">
                  <Input
                    type="url"
                    value={walkthrough.icon_url || ''}
                    onChange={(e) => onUpdate({ ...walkthrough, icon_url: e.target.value })}
                    placeholder={t('category.icon')}
                    className="h-9"
                    data-testid="icon-url-input"
                  />
                </label>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleIconUpload(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                    </span>
                  </Button>
                </label>
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {t('builder.enterUrlOrUpload')}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Categories</label>
            <div className="space-y-2">
              {categoryTree.length > 0 ? (
                categoryTree.map((parentCat) => (
                  <div key={parentCat.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(walkthrough.category_ids || []).includes(parentCat.id)}
                        onChange={() => handleCategoryChange(parentCat.id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                        data-testid={`category-checkbox-${parentCat.id}`}
                      />
                      <label className="text-sm text-slate-700 flex items-center gap-1.5 cursor-pointer">
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                        {parentCat.name}
                      </label>
                    </div>
                    {parentCat.children.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {parentCat.children.map((subCat) => (
                          <div key={subCat.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={(walkthrough.category_ids || []).includes(subCat.id)}
                              onChange={() => handleCategoryChange(subCat.id)}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                              data-testid={`subcategory-checkbox-${subCat.id}`}
                            />
                            <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer">
                              <span className="text-slate-400">└</span>
                              {subCat.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">{t('builder.noCategoriesAvailable')}</p>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              {t('builder.selectCategoriesForWalkthrough')}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t('builder.privacy')}</label>
            <Select
              value={walkthrough.privacy}
              onValueChange={(value) => onUpdate({ ...walkthrough, privacy: value })}
            >
              <SelectTrigger className="h-9" data-testid="privacy-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('builder.public')}</SelectItem>
                <SelectItem value="private">{t('builder.private')}</SelectItem>
                <SelectItem value="password">{t('builder.passwordProtected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {walkthrough.privacy === 'password' && (
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">{t('builder.portalPassword')}</label>
              <Input
                type="password"
                value={walkthrough.password || ''}
                onChange={(e) => onUpdate({ ...walkthrough, password: e.target.value })}
                placeholder={t('builder.setPassword')}
                className="h-9"
                data-testid="portal-password-input"
              />
              <div className="text-xs text-slate-400 mt-1">
                {t('builder.passwordStoredAsHash')}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t('builder.statusLabel')}</label>
            <Badge variant={walkthrough.status === 'published' ? 'default' : 'secondary'}>
              {walkthrough.status === 'published' ? t('builder.status.published') : t('builder.status.draft')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, flex: '1 1 auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-700">{t('walkthrough.steps')}</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={onAddStep}
              data-testid="add-step-sidebar"
              className="h-7 px-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('common.create')}
            </Button>
          </div>

          <div className="space-y-2">
            {walkthrough.steps.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                isActive={currentStepIndex === index}
                onClick={() => onStepClick(index)}
                onDelete={() => onDeleteStep(step.id)}
                onUpdate={(updates) => {
                  const updatedSteps = walkthrough.steps.map((s, i) => 
                    i === index ? { ...s, ...updates } : s
                  );
                  onUpdate({ ...walkthrough, steps: updatedSteps });
                }}
              />
            ))}

            {walkthrough.steps.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t('walkthrough.noStepsYet')}</p>
              </div>
            )}
          </div>
        </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

const StepItem = ({ step, index, isActive, onClick, onDelete, onUpdate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-primary/10 border-2 border-primary'
          : 'bg-gray-50/50 backdrop-blur-sm hover:bg-gray-100/80 border-2 border-transparent'
      }`}
      data-testid={`step-item-${index}`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
            <span className="text-sm font-medium text-slate-900 truncate">
              {step.title}
            </span>
          </div>
          {step.blocks && step.blocks.length > 0 && (
            <span className="text-xs text-slate-400">{step.blocks.length} blocks</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this step?')) {
              onDelete();
            }
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
          data-testid={`delete-step-${index}`}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>

      {/* Navigation Type Selector */}
      {onUpdate && (
        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
          <Select
            value={step.navigation_type || 'next_prev'}
            onValueChange={(value) => onUpdate({ navigation_type: value })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next_prev">Previous / Next</SelectItem>
              <SelectItem value="checkoff">Tick When Done</SelectItem>
              <SelectItem value="auto">Auto Advance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default LeftSidebar;