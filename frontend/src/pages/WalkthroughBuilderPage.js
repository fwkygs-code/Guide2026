import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Save, ArrowLeft, Trash2, Eye, Bold, Italic, List, AlignLeft, AlignCenter, Image, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { normalizeImageUrlsInObject } from '../lib/utils';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';

const rawBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL || // backwards compatibility
  'http://127.0.0.1:8000';

const API_BASE = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

const WalkthroughBuilderPage = () => {
  const { workspaceSlug, walkthroughId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!walkthroughId;
  
  // Resolve workspace slug to ID
  const { workspace: workspaceFromHook, workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspaceSlug(workspaceSlug);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('draft');
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [workspace, setWorkspace] = useState(null);

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
      
      // Navigate back to dashboard if workspace access failed
      navigate('/dashboard');
    }
  }, [workspaceError, workspaceLoading, navigate]);

  useEffect(() => {
    if (!workspaceId || workspaceLoading) return; // Wait for workspace ID to be resolved and loading to complete
    if (workspaceError) return; // Don't fetch if there was an error
    
    fetchCategories();
    if (isEditing) {
      fetchWalkthrough();
    }
  }, [workspaceId, walkthroughId, workspaceLoading, workspaceError]);

  const fetchCategories = async () => {
    if (!workspaceId) return; // Wait for workspace ID to be resolved
    try {
      const response = await api.getCategories(workspaceId);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const fetchWalkthrough = async () => {
    if (!workspaceId) return; // Wait for workspace ID to be resolved
    try {
      const response = await api.getWalkthrough(workspaceId, walkthroughId);
      const wt = response.data;
      // Normalize image URLs
      const normalized = normalizeImageUrlsInObject(wt);
      setTitle(normalized.title);
      setDescription(normalized.description || '');
      setPrivacy(normalized.privacy);
      setPassword('');
      setStatus(normalized.status);
      // Ensure all steps have blocks array initialized
      const stepsWithBlocks = (normalized.steps || []).map(step => ({
        ...step,
        blocks: step.blocks || [],
        // Ensure blocks array is properly structured
        ...(step.blocks && Array.isArray(step.blocks) ? {} : { blocks: [] })
      }));
      setSteps(stepsWithBlocks);
      setSelectedCategories(normalized.category_ids || []);
      
      // CRITICAL: Ensure icon_url is preserved
      if (normalized.icon_url) {
        // Icon URL is already normalized in normalizeImageUrlsInObject
      }
    } catch (error) {
      toast.error('Failed to load walkthrough');
      navigate(`/workspace/${workspaceSlug}/walkthroughs`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publishNow = false) => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (saving || publishing) return;
    if (publishNow) setPublishing(true);
    else setSaving(true);
    try {
      const data = {
        title,
        description,
        privacy,
        password: privacy === 'password' ? password : undefined,
        category_ids: selectedCategories,
        navigation_type: 'next_prev',
        navigation_placement: 'bottom',
        status: publishNow ? 'published' : 'draft'  // Always set status: draft on save, published only on explicit publish
      };

      let savedWalkthroughId = walkthroughId;

      if (isEditing) {
        await api.updateWalkthrough(workspaceId, walkthroughId, data);
        
        const nextSteps = [...(steps || [])];
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
            nextSteps[i] = { ...step, id: res.data.id, isNew: false };
          }
        }
        setSteps(nextSteps);
        
        if (publishNow) {
          // Status already set to 'published' in data above
          setStatus('published');
          toast.success('Walkthrough published!');
        } else {
          // Status already set to 'draft' in data above
          setStatus('draft');
          toast.success('Walkthrough saved as draft!');
        }
      } else {
        const response = await api.createWalkthrough(workspaceId, data);
        savedWalkthroughId = response.data.id;
        
        for (const step of steps) {
          await api.addStep(workspaceId, savedWalkthroughId, {
            title: step.title,
            content: step.content,
            media_url: step.media_url,
            media_type: step.media_type,
            navigation_type: step.navigation_type || 'next_prev',
            common_problems: step.common_problems || [],
            blocks: step.blocks || []
          });
        }
        
        if (publishNow) {
          // Status already set to 'published' in data above
          setStatus('published');
          toast.success('Walkthrough published!');
        } else {
          // Status already set to 'draft' in data above
          setStatus('draft');
          toast.success('Walkthrough created as draft!');
        }
        
        navigate(`/workspace/${workspaceSlug}/walkthroughs/${savedWalkthroughId}/edit`);
      }
    } catch (error) {
      toast.error('Failed to save walkthrough');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const handlePublish = async () => {
    await handleSave(true);
  };

  const addStep = () => {
    const newStepId = `temp-${Date.now()}`;
    setSteps([
      ...steps,
      {
        id: newStepId,
        title: `Step ${steps.length + 1}`,
        content: '',
        media_url: null,
        media_type: null,
        navigation_type: 'next_prev',
        common_problems: [],
        blocks: [],
        order: steps.length,
        isNew: true
      }
    ]);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleMediaUpload = async (index, file) => {
    try {
      // Set media type immediately based on file
      const fileType = file.type.split('/')[0];
      const fileName = file.name.toLowerCase();
      
      if (fileType === 'image' || fileName.endsWith('.gif')) {
        updateStep(index, 'media_type', 'image');
      } else if (fileType === 'video') {
        updateStep(index, 'media_type', 'video');
      }
      
      // Upload file
      const response = await api.uploadFile(file);
      
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      // If URL is already absolute (starts with http:// or https://), use it directly
      // Otherwise, prepend API_BASE for local storage fallback
      const uploadedUrl = response.data.url;
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${API_BASE.replace(/\/$/, '')}${uploadedUrl}`;
      updateStep(index, 'media_url', fullUrl);
      
      console.log('Media uploaded:', fullUrl);
      toast.success('File uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('העלאת הקובץ נכשלה');
    }
  };

  const handleMediaUrlChange = (index, url) => {
    updateStep(index, 'media_url', url);
    
    // Auto-detect media type from URL
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
      updateStep(index, 'media_type', 'image');
    } else if (lowerUrl.match(/\.(mp4|webm|mov|avi)$/)) {
      updateStep(index, 'media_type', 'video');
    } else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      updateStep(index, 'media_type', 'youtube');
    }
  };

  const insertFormatting = (index, format) => {
    const editorId = `step-editor-${index}`;
    const editor = document.getElementById(editorId);
    if (!editor) return;
    
    editor.focus();
    
    switch(format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'h2':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'ul':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'center':
        document.execCommand('justifyCenter', false, null);
        break;
      case 'left':
        document.execCommand('justifyLeft', false, null);
        break;
    }
    
    // Update content after formatting
    updateStep(index, 'content', editor.innerHTML);
  };

  const handleEditorInput = (index, event) => {
    updateStep(index, 'content', event.target.innerHTML);
  };

  const handleEditorPaste = (index, event) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateStep(index, 'content', event.target.innerHTML);
  };

  if (workspaceLoading || loading || !workspaceId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (workspaceError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Failed to Load Workspace</h2>
            <p className="text-slate-600 mb-4">
              {workspaceError.status === 403 
                ? 'You do not have permission to access this workspace'
                : workspaceError.message || 'An error occurred while loading the workspace'}
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {(saving || publishing) && (
        <div className="fixed inset-0 z-[200] bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-soft-lg px-6 py-5 flex items-center gap-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <div className="text-sm text-slate-700">
              {publishing ? 'Publishing…' : 'Saving…'} Please wait.
            </div>
          </div>
        </div>
      )}
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/workspace/${workspaceSlug}/walkthroughs`)}
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-heading font-bold text-slate-900">
              {isEditing ? 'Edit Walkthrough' : 'New Walkthrough'}
            </h1>
          </div>
          <div className="flex gap-3">
            {status === 'published' && workspace && (
              <Button
                variant="outline"
                onClick={() => window.open(`/portal/${workspace.slug}`, '_blank')}
                data-testid="view-portal-button"
              >
                <Eye className="w-4 h-4 mr-2" />
                View on Portal
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving || publishing}
              data-testid="save-draft-button"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={handlePublish}
              disabled={saving || publishing}
              data-testid="publish-button"
            >
              <Eye className="w-4 h-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Getting Started Guide"
                  data-testid="walkthrough-title-input"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A comprehensive guide to get you started..."
                  rows={3}
                  data-testid="walkthrough-description-input"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="privacy">Privacy</Label>
                <Select value={privacy} onValueChange={setPrivacy}>
                  <SelectTrigger className="mt-1.5" data-testid="privacy-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="password">Password Protected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {privacy === 'password' && (
                <div>
                  <Label htmlFor="portal-password">Password</Label>
                  <Input
                    id="portal-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a password"
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold">Steps</h2>
              <Button onClick={addStep} size="sm" data-testid="add-step-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>

            <div className="space-y-6">
              {steps.map((step, index) => {
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-slate-200 rounded-lg p-4 bg-white"
                    data-testid={`step-${index}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-500">שלב {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                        data-testid={`remove-step-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, 'title', e.target.value)}
                      placeholder="כותרת השלב"
                      className="mb-3"
                      data-testid={`step-title-${index}`}
                    />

                    {/* Rich Text Editor */}
                    <div className="space-y-2">
                      <div className="flex gap-1 border border-gray-200/50 rounded-xl p-2 bg-gray-50/50 backdrop-blur-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'bold')}
                          className="h-8 w-8 p-0"
                          title="מודגש"
                        >
                          <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'italic')}
                          className="h-8 w-8 p-0"
                          title="נטוי"
                        >
                          <Italic className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'h2')}
                          className="h-8 w-8 p-0"
                          title="כותרת"
                        >
                          H2
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'ul')}
                          className="h-8 w-8 p-0"
                          title="רשימה"
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'center')}
                          className="h-8 w-8 p-0"
                          title="מרכז"
                        >
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => insertFormatting(index, 'left')}
                          className="h-8 w-8 p-0"
                          title="שמאל"
                        >
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div
                        id={`step-editor-${index}`}
                        contentEditable
                        onInput={(e) => handleEditorInput(index, e)}
                        onPaste={(e) => handleEditorPaste(index, e)}
                        dangerouslySetInnerHTML={{ __html: step.content }}
                        className="min-h-[200px] p-4 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 prose max-w-none"
                        // Let the browser choose RTL/LTR based on content (fixes Hebrew spacing/cursor issues)
                        style={{ direction: 'auto', unicodeBidi: 'plaintext' }}
                        data-testid={`step-content-${index}`}
                      />
                    </div>

                    {/* Media Upload Section */}
                    <div className="border-t pt-3 mt-3">
                      <Label className="mb-2 block">Media (Photo/GIF/Video)</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept="image/*,video/*,.gif"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleMediaUpload(index, file);
                            }}
                            className="flex-1"
                            id={`file-upload-${index}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`file-upload-${index}`).click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            העלה
                          </Button>
                        </div>
                        <div className="text-sm text-slate-500 text-center">או</div>
                        <Input
                          value={step.media_url || ''}
                          onChange={(e) => handleMediaUrlChange(index, e.target.value)}
                          placeholder="הדבק URL של תמונה/וידאו (YouTube, תמונה ישירה...)"
                          className="text-sm"
                        />
                      </div>
                      
                      {step.media_url && (
                        <div className="mt-3 p-3 bg-gray-50/50 backdrop-blur-sm rounded-xl">
                          <div className="text-xs text-slate-500 mb-2">תצוגה מקדימה:</div>
                          <div className="text-xs text-slate-400 mb-2 font-mono break-all">URL: {step.media_url}</div>
                          <div className="text-xs text-slate-400 mb-2">Type: {step.media_type || 'לא מוגדר'}</div>
                          {step.media_type === 'image' && (
                            <img 
                              src={step.media_url} 
                              alt="Preview" 
                              className="max-h-48 rounded border border-slate-200"
                              onLoad={() => console.log('Image loaded successfully:', step.media_url)}
                              onError={(e) => {
                                console.error('Failed to load image:', step.media_url);
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                          {step.media_type === 'video' && (
                            <video 
                              src={step.media_url} 
                              controls 
                              className="max-h-48 rounded border border-slate-200"
                              onError={(e) => {
                                console.error('Failed to load video:', step.media_url);
                              }}
                            />
                          )}
                          {step.media_type === 'youtube' && (
                            <div className="text-sm text-slate-600 flex items-center gap-2">
                              <span>🎥</span>
                              <span>וידאו YouTube: {step.media_url}</span>
                            </div>
                          )}
                          {!step.media_type && (
                            <div className="text-sm text-slate-400">טוען...</div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {steps.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <p>No steps yet. Click "Add Step" to create the first one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WalkthroughBuilderPage;