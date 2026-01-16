import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Copy, ExternalLink, Share2, Code, Globe, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTextSize } from '../contexts/TextSizeContext';
import DashboardLayout from '../components/DashboardLayout';

const SettingsPage = () => {
  const { workspaceId } = useParams();
  const { textSize, setTextSize } = useTextSize();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkspace();
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const response = await api.getWorkspace(workspaceId);
      setWorkspace(response.data);
      setName(response.data.name);
      setBrandColor(response.data.brand_color);
    } catch (error) {
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateWorkspace(workspaceId, {
        name,
        brand_color: brandColor
      });
      toast.success('Settings saved!');
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
      <div className="p-8 max-w-4xl">
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
              <Button onClick={handleSave} disabled={saving} data-testid="save-settings-button">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;