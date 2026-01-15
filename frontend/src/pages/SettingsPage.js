import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

const SettingsPage = () => {
  const { workspaceId } = useParams();
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

  const copyPortalUrl = () => {
    const url = `${window.location.origin}/portal/${workspace?.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Portal URL copied!');
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

          {/* Portal Settings */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-heading font-semibold mb-4">Public Portal</h2>
            <div className="space-y-4">
              <div>
                <Label>Portal URL</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={`${window.location.origin}/portal/${workspace?.slug}`}
                    readOnly
                    className="flex-1"
                    data-testid="portal-url-input"
                  />
                  <Button variant="outline" onClick={copyPortalUrl} data-testid="copy-portal-url-button">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/portal/${workspace?.slug}`, '_blank')}
                    data-testid="view-portal-button"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;