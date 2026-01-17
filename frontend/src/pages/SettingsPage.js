import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Copy, ExternalLink, Share2, Code, Globe, Type, Upload, Plus, Trash2, Phone, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTextSize } from '../contexts/TextSizeContext';
import DashboardLayout from '../components/DashboardLayout';
import QuotaDisplay from '../components/QuotaDisplay';
import UpgradePrompt from '../components/UpgradePrompt';
import PlanSelectionModal from '../components/PlanSelectionModal';

const SettingsPage = () => {
  const { workspaceId } = useParams();
  const { textSize, setTextSize } = useTextSize();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [logoUrl, setLogoUrl] = useState('');
  const [portalBackgroundUrl, setPortalBackgroundUrl] = useState('');
  const [portalPalette, setPortalPalette] = useState({ primary: '#4f46e5', secondary: '#8b5cf6', accent: '#10b981' });
  const [portalLinks, setPortalLinks] = useState([]);
  const [portalPhone, setPortalPhone] = useState('');
  const [portalWorkingHours, setPortalWorkingHours] = useState('');
  const [portalWhatsapp, setPortalWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [planSelectionOpen, setPlanSelectionOpen] = useState(false);

  useEffect(() => {
    fetchWorkspace();
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const response = await api.getWorkspace(workspaceId);
      setWorkspace(response.data);
      setName(response.data.name);
      setBrandColor(response.data.brand_color || '#4f46e5');
      setLogoUrl(response.data.logo || '');
      setPortalBackgroundUrl(response.data.portal_background_url || '');
      setPortalPalette(response.data.portal_palette || { primary: '#4f46e5', secondary: '#8b5cf6', accent: '#10b981' });
      setPortalLinks(response.data.portal_links || []);
      setPortalPhone(response.data.portal_phone || '');
      setPortalWorkingHours(response.data.portal_working_hours || '');
      setPortalWhatsapp(response.data.portal_whatsapp || '');
    } catch (error) {
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setLogoUrl(fullUrl);
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };

  const handleBackgroundUpload = async (file) => {
    try {
      const response = await api.uploadFile(file);
      const uploadedUrl = response.data.url;
      // CRITICAL: Cloudinary returns full HTTPS URLs, don't prepend API_BASE
      const fullUrl = uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://')
        ? uploadedUrl
        : `${(process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}${uploadedUrl}`;
      setPortalBackgroundUrl(fullUrl);
      toast.success('Background uploaded!');
    } catch (error) {
      toast.error('Failed to upload background');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateWorkspace(workspaceId, {
        name,
        brand_color: brandColor,
        logo: logoUrl || null,
        portal_background_url: portalBackgroundUrl || null,
        portal_palette: portalPalette,
        portal_links: portalLinks.length > 0 ? portalLinks : null,
        portal_phone: portalPhone || null,
        portal_working_hours: portalWorkingHours || null,
        portal_whatsapp: portalWhatsapp || null
      });
      toast.success('Settings saved!');
      fetchWorkspace();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const portalUrl = `${window.location.origin}/portal/${workspace?.slug}`;
  const portalEmbedUrl = `${window.location.origin}/embed/portal/${workspace?.slug}`;
  const portalIframeCode = `<iframe src="${portalEmbedUrl}" width="100%" height="800" frameborder="0" allowfullscreen></iframe>`;
  const portalScriptCode = `<script src="${window.location.origin}/embed/widget.js" data-slug="${workspace?.slug}"></script>`;

  const copyToClipboard = (text, message = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast.success(message);
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

  return (
    <DashboardLayout>
      <UpgradePrompt open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen} workspaceId={workspaceId} />
      <PlanSelectionModal
        open={planSelectionOpen}
        onOpenChange={setPlanSelectionOpen}
        isSignup={false}
      />
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="mb-8">
              <h1 className="text-3xl font-heading font-bold text-slate-900">Workspace Settings</h1>
              <p className="text-slate-600 mt-1">Manage your workspace configuration</p>
            </div>

            <div className="space-y-6">
          {/* Basic Settings */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="workspace-name-input"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="logo">Workspace Logo</Label>
                <div className="mt-1.5 space-y-2">
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                    className="text-sm"
                  />
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl('')}
                      className="text-destructive"
                    >
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="brand-color">Brand Color</Label>
                <div className="flex gap-3 mt-1.5">
                  <Input
                    id="brand-color"
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-20 h-10"
                    data-testid="brand-color-input"
                  />
                  <Input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Portal Branding */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Portal Branding
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="portal-background">Portal Background Image</Label>
                <p className="text-xs text-slate-500 mb-1.5">Custom background for your public portal</p>
                <div className="mt-1.5 space-y-2">
                  {portalBackgroundUrl && (
                    <div className="relative">
                      <img src={portalBackgroundUrl} alt="Background" className="w-full h-32 rounded-lg object-cover border border-slate-200" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPortalBackgroundUrl('')}
                        className="absolute top-2 right-2 text-destructive bg-white/90 hover:bg-white"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && handleBackgroundUpload(e.target.files[0])}
                    className="text-sm"
                  />
                </div>
              </div>
              <div>
                <Label>Portal Color Palette</Label>
                <p className="text-xs text-slate-500 mb-1.5">Customize colors for your portal</p>
                <div className="grid grid-cols-3 gap-3 mt-1.5">
                  <div>
                    <Label className="text-xs text-slate-400 mb-1">Primary</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={portalPalette.primary || '#4f46e5'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, primary: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={portalPalette.primary || '#4f46e5'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, primary: e.target.value })}
                        className="flex-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 mb-1">Secondary</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={portalPalette.secondary || '#8b5cf6'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, secondary: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={portalPalette.secondary || '#8b5cf6'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, secondary: e.target.value })}
                        className="flex-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 mb-1">Accent</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={portalPalette.accent || '#10b981'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, accent: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={portalPalette.accent || '#10b981'}
                        onChange={(e) => setPortalPalette({ ...portalPalette, accent: e.target.value })}
                        className="flex-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Portal Contact Information */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Portal Contact Information
            </h2>
            <p className="text-xs text-slate-500 mb-4">Add contact information that will appear at the top of your portal</p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="portal-phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="portal-phone"
                  value={portalPhone}
                  onChange={(e) => setPortalPhone(e.target.value)}
                  placeholder="e.g., +1 (555) 123-4567"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="portal-working-hours" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Working Hours
                </Label>
                <Input
                  id="portal-working-hours"
                  value={portalWorkingHours}
                  onChange={(e) => setPortalWorkingHours(e.target.value)}
                  placeholder="e.g., Mon-Fri: 9AM-5PM EST"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="portal-whatsapp" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Link
                </Label>
                <Input
                  id="portal-whatsapp"
                  value={portalWhatsapp}
                  onChange={(e) => setPortalWhatsapp(e.target.value)}
                  placeholder="e.g., https://wa.me/1234567890"
                  type="url"
                  className="mt-1.5"
                />
                <p className="text-xs text-slate-400 mt-1">Format: https://wa.me/[country code][phone number]</p>
              </div>
            </div>
          </div>

          {/* Portal Links */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Portal External Links
            </h2>
            <p className="text-xs text-slate-500 mb-4">Add buttons with external links that will appear at the top of your portal (e.g., link to your website, support page, etc.)</p>
            <div className="space-y-3">
              {portalLinks.map((link, index) => (
                <div key={index} className="flex gap-2 items-start p-3 bg-slate-50/50 rounded-lg border border-slate-200/50">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Button Label (e.g., Visit Website)"
                      value={link.label || ''}
                      onChange={(e) => {
                        const newLinks = [...portalLinks];
                        newLinks[index] = { ...newLinks[index], label: e.target.value };
                        setPortalLinks(newLinks);
                      }}
                      className="text-sm"
                    />
                    <Input
                      placeholder="URL (e.g., https://example.com)"
                      value={link.url || ''}
                      onChange={(e) => {
                        const newLinks = [...portalLinks];
                        newLinks[index] = { ...newLinks[index], url: e.target.value };
                        setPortalLinks(newLinks);
                      }}
                      type="url"
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newLinks = portalLinks.filter((_, i) => i !== index);
                      setPortalLinks(newLinks);
                    }}
                    className="text-destructive hover:text-destructive mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {portalLinks.length < 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPortalLinks([...portalLinks, { label: '', url: '' }])}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              )}
              {portalLinks.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No links added yet. Click "Add Link" to get started.</p>
              )}
            </div>
          </div>

          {/* Plan Management */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Plan Management</h2>
            <div className="space-y-4">
              <div>
                <Label>Current Plan</Label>
                <p className="text-sm text-slate-600 mt-1.5">
                  Manage your subscription and plan settings
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setPlanSelectionOpen(true)}
                className="w-full"
              >
                Change Plan
              </Button>
            </div>
          </div>

          {/* Text Size Settings */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Text Size</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="text-size">Text Size Preference</Label>
                <p className="text-xs text-gray-500 mb-1.5">Adjust text size throughout the application</p>
                <Select value={textSize} onValueChange={setTextSize} className="mt-1.5">
                  <SelectTrigger id="text-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium (Default)</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="xl">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3 p-3 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/50">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <div className="space-y-1">
                    <p className={`${textSize === 'small' ? 'text-sm' : textSize === 'medium' ? 'text-base' : textSize === 'large' ? 'text-lg' : 'text-xl'}`}>
                      This is how body text will look
                    </p>
                    <p className={`font-heading font-semibold ${textSize === 'small' ? 'text-base' : textSize === 'medium' ? 'text-lg' : textSize === 'large' ? 'text-xl' : 'text-2xl'}`}>
                      This is how headings will look
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Portal Settings */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Public Portal</h2>
            <Tabs defaultValue="share" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="share">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </TabsTrigger>
                <TabsTrigger value="embed">
                  <Code className="w-4 h-4 mr-2" />
                  Embed
                </TabsTrigger>
                <TabsTrigger value="integration">
                  <Globe className="w-4 h-4 mr-2" />
                  Integration
                </TabsTrigger>
              </TabsList>

              <TabsContent value="share" className="space-y-4 mt-4">
                <div>
                  <Label>Portal Link</Label>
                  <p className="text-xs text-gray-500 mb-1.5">Share this link to give others access to your portal</p>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={portalUrl}
                      readOnly
                      className="flex-1"
                      data-testid="portal-url-input"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(portalUrl, 'Portal link copied!')} 
                      data-testid="copy-portal-url-button"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(portalUrl, '_blank')}
                      data-testid="view-portal-button"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="embed" className="space-y-4 mt-4">
                <div>
                  <Label>iFrame Embed Code</Label>
                  <p className="text-xs text-gray-500 mb-1.5">Copy and paste this code into your website HTML</p>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={portalIframeCode}
                      readOnly
                      className="flex-1 font-mono text-xs"
                      data-testid="portal-iframe-input"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(portalIframeCode, 'Embed code copied!')}
                      data-testid="copy-iframe-button"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-3 p-3 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/50">
                    <p className="text-xs text-gray-600 mb-2">Preview:</p>
                    <iframe 
                      src={portalEmbedUrl}
                      className="w-full h-96 border border-gray-200 rounded-lg"
                      title="Portal Preview"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="integration" className="space-y-4 mt-4">
                <div>
                  <Label>CRM Integration</Label>
                  <p className="text-xs text-gray-500 mb-1.5">Use these URLs to integrate with your CRM or other platforms</p>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs text-gray-600 mb-1">Portal API Endpoint</Label>
                      <div className="flex gap-2">
                        <Input
                          value={`${window.location.origin}/api/portal/${workspace?.slug}`}
                          readOnly
                          className="flex-1 font-mono text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(`${window.location.origin}/api/portal/${workspace?.slug}`, 'API endpoint copied!')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 mb-1">Embeddable Portal URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={portalEmbedUrl}
                          readOnly
                          className="flex-1 font-mono text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(portalEmbedUrl, 'Embed URL copied!')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50/50 backdrop-blur-sm rounded-xl border border-blue-200/50">
                    <p className="text-sm font-medium text-gray-900 mb-2">Integration Tips:</p>
                    <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                      <li>Use the embed URL in iframes for seamless integration</li>
                      <li>API endpoint returns JSON data for custom integrations</li>
                      <li>All portal routes support CORS for cross-origin embedding</li>
                      <li>Works with Salesforce, HubSpot, Zendesk, and other CRMs</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Save Button at Bottom */}
          <div className="glass rounded-xl p-6 border-t-2 border-primary/20">
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setLogoUrl(workspace?.logo || '');
                  setPortalBackgroundUrl(workspace?.portal_background_url || '');
                  setPortalPalette(workspace?.portal_palette || { primary: '#4f46e5', secondary: '#8b5cf6', accent: '#10b981' });
                  setPortalLinks(workspace?.portal_links || []);
                  setPortalPhone(workspace?.portal_phone || '');
                  setPortalWorkingHours(workspace?.portal_working_hours || '');
                  setPortalWhatsapp(workspace?.portal_whatsapp || '');
                  setBrandColor(workspace?.brand_color || '#4f46e5');
                  setName(workspace?.name || '');
                }}
              >
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="save-settings-button">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
          </div>
          </div>

          {/* Quota Sidebar */}
          <div className="lg:col-span-1">
            <QuotaDisplay workspaceId={workspaceId} showWarnings={true} onUpgrade={() => setUpgradePromptOpen(true)} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;