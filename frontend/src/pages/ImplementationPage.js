import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { api, getBackendUrl, getPublicPortalUrl } from '../lib/api';
import {
  PageHeader,
  PageSurface,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button
} from '../components/ui/design-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const ImplementationPage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [categories, setCategories] = useState([]);
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWalkthroughId, setExpandedWalkthroughId] = useState(null);
  const [embedType, setEmbedType] = useState('inline');
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('600');

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      try {
        const [categoryResponse, walkthroughResponse] = await Promise.all([
          api.getCategories(workspaceId),
          api.getWalkthroughs(workspaceId)
        ]);
        setCategories(categoryResponse.data || []);
        setWalkthroughs(walkthroughResponse.data || []);
      } catch (error) {
        toast.error(t('settings.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, t]);

  const categoryGroups = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    const groups = sortedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      walkthroughs: walkthroughs.filter((walkthrough) =>
        (walkthrough.category_ids || []).includes(category.id)
      )
    }));
    const uncategorized = walkthroughs.filter((walkthrough) => !(walkthrough.category_ids || []).length);
    if (uncategorized.length) {
      groups.push({
        id: 'uncategorized',
        name: t('workspace.uncategorized'),
        walkthroughs: uncategorized
      });
    }
    return groups;
  }, [categories, walkthroughs, t]);

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success(t('settings.copiedToClipboard'));
  };

  const toggleWalkthrough = (walkthroughKey) => {
    setExpandedWalkthroughId((current) => (current === walkthroughKey ? null : walkthroughKey));
  };

  const portalUrl = `${getPublicPortalUrl()}/embed/portal/${workspaceSlug}?embed=1`;

  const normalizeDimension = (value, defaultValue) => {
    const raw = (value || '').trim();
    if (!raw) {
      return { value: defaultValue, error: null };
    }
    if (/^\d+$/.test(raw)) {
      return { value: `${raw}px`, error: Number(raw) > 0 ? null : t('workspace.embedInvalidDimension') };
    }
    if (/^\d+%$/.test(raw)) {
      return { value: raw, error: parseInt(raw, 10) > 0 ? null : t('workspace.embedInvalidDimension') };
    }
    if (/^\d+px$/.test(raw)) {
      return { value: raw, error: parseInt(raw, 10) > 0 ? null : t('workspace.embedInvalidDimension') };
    }
    return { value: null, error: t('workspace.embedInvalidDimension') };
  };

  const inlineWidthConfig = normalizeDimension(embedWidth, '100%');
  const inlineHeightConfig = normalizeDimension(embedHeight, '600px');
  const floatingWidthConfig = normalizeDimension(embedWidth, '100%');
  const floatingHeightConfig = normalizeDimension(embedHeight, '70vh');

  const normalizedDrawerWidth = floatingWidthConfig.value || '100%';
  const normalizedDrawerHeight = floatingHeightConfig.value || '70vh';

  const inlineEmbedSnippet = `<iframe
  src="${portalUrl}"
  width="${inlineWidthConfig.value}"
  height="${inlineHeightConfig.value}"
  style="border:0;border-radius:12px"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-popups"
></iframe>`;

  const floatingEmbedSnippet = `<style>
#ig-help-button {
  position: fixed;
  right: 24px;
  bottom: 24px;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  font: 600 14px/1.2 system-ui, -apple-system, sans-serif;
  cursor: pointer;
  z-index: 2147483647;
  box-shadow: 0 12px 32px rgba(0,0,0,0.2);
}
#ig-help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: none;
  z-index: 2147483646;
}
#ig-help-drawer {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(${normalizedDrawerWidth}, 720px);
  max-width: 96vw;
  height: ${normalizedDrawerHeight};
  background: #0b1220;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  display: none;
  z-index: 2147483647;
  box-shadow: 0 -12px 32px rgba(0,0,0,0.25);
}
#ig-help-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: rgba(0,0,0,0.45);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  z-index: 2;
}
</style>
<button id="ig-help-button">Need help?</button>
<div id="ig-help-overlay"></div>
<div id="ig-help-drawer">
  <button id="ig-help-close">Close</button>
  <iframe
    src="${portalUrl}"
    width="100%"
    height="100%"
    style="border:0"
    loading="lazy"
    sandbox="allow-scripts allow-same-origin allow-popups"
  ></iframe>
</div>
<script>
(function () {
  var button = document.getElementById('ig-help-button');
  var overlay = document.getElementById('ig-help-overlay');
  var drawer = document.getElementById('ig-help-drawer');
  var close = document.getElementById('ig-help-close');
  var open = function () {
    overlay.style.display = 'block';
    drawer.style.display = 'block';
  };
  var shut = function () {
    overlay.style.display = 'none';
    drawer.style.display = 'none';
  };
  button.addEventListener('click', open);
  overlay.addEventListener('click', shut);
  close.addEventListener('click', shut);
})();
</script>`;

  if (loading || workspaceLoading || !workspaceId) {
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
      <PageHeader
        title={t('workspace.integrate')}
        description={t('workspace.integrateDescription')}
      />

      <PageSurface>
        <Tabs defaultValue="links" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="links">{t('workspace.integrateLinksTab')}</TabsTrigger>
            <TabsTrigger value="webhooks">
              {t('workspace.integrateWebhooksTab')}
            </TabsTrigger>
            <TabsTrigger value="embeds">
              {t('workspace.integrateEmbedsTab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="links" className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {t('workspace.integrateLinksDescription')}
            </div>
            <div className="space-y-6">
              {categoryGroups.map((group) => (
                <Card key={group.id} className="border border-border/60 bg-card/60">
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <span>{group.name}</span>
                    </CardTitle>
                    <Badge variant="outline">
                      {group.walkthroughs.length} {t('workspace.guides')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {group.walkthroughs.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        {t('workspace.noGuidesInCategory')}
                      </div>
                    )}
                    {group.walkthroughs.map((walkthrough, walkthroughIndex) => {
                      const categoryKey = group.id || `category-${walkthroughIndex}`;
                      const walkthroughKey = walkthrough.id
                        ? `${categoryKey}:${walkthrough.id}`
                        : `${categoryKey}:${walkthroughIndex}`;
                      const isExpanded = expandedWalkthroughId === walkthroughKey;
                      const steps = walkthrough.steps || [];
                      const walkthroughIdentifier = walkthrough.slug || walkthrough.id;
                      const integrationBaseUrl = getBackendUrl();
                      const shareableBaseUrl = getPublicPortalUrl();
                      const integrationWalkthroughUrl = `${integrationBaseUrl}/portal/${workspaceSlug}/${walkthroughIdentifier}`;
                      const shareableWalkthroughUrl = `${shareableBaseUrl}/portal/${workspaceSlug}/${walkthroughIdentifier}`;

                      return (
                        <div key={walkthroughKey} className="rounded-xl border border-border/60 bg-background/40">
                          <button
                            type="button"
                            onClick={() => toggleWalkthrough(walkthroughKey)}
                            className="w-full text-left px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex flex-col">
                                <span className="text-base font-semibold text-foreground truncate">
                                  {walkthrough.title || t('common.untitled')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {steps.length} {t('workspace.steps')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {walkthrough.status || t('workspace.draft')}
                              </Badge>
                              <ChevronDown
                                className={`w-4 h-4 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </button>
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden border-t border-border/60"
                              >
                                <div className="px-4 py-3 space-y-2">
                                  {steps.map((step, index) => {
                                    const integrationUrl = step.step_id
                                      ? `${integrationWalkthroughUrl}#step=${step.step_id}`
                                      : null;
                                    const shareableUrl = `${shareableWalkthroughUrl}#step=${index + 1}`;
                                    return (
                                      <div
                                        key={step.id || `${walkthrough.id}-step-${index}`}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-2"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <span className="text-xs text-muted-foreground w-6">
                                            {index + 1}.
                                          </span>
                                          <span className="text-sm text-foreground truncate">
                                            {step.title || t('common.untitled')}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => integrationUrl && handleCopyLink(integrationUrl)}
                                            disabled={!integrationUrl}
                                          >
                                            <Copy className="w-3.5 h-3.5 mr-2" />
                                            {t('workspace.copyIntegrationLink')}
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCopyLink(shareableUrl)}
                                          >
                                            <Copy className="w-3.5 h-3.5 mr-2" />
                                            {t('workspace.copyShareableLink')}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="webhooks" className="space-y-6">
            <Card className="border border-border/60 bg-card/60">
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t('workspace.integrateWebhooksDescription')}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="embeds" className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {t('workspace.integrateEmbedsDescription')}
            </div>
            <Card className="border border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle>{t('workspace.embedOptionsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs value={embedType} onValueChange={setEmbedType} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 max-w-sm">
                    <TabsTrigger value="inline">{t('workspace.embedInlineOption')}</TabsTrigger>
                    <TabsTrigger value="floating">{t('workspace.embedFloatingOption')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="inline" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="embed-width">{t('workspace.embedWidth')}</Label>
                        <Input
                          id="embed-width"
                          value={embedWidth}
                          onChange={(event) => setEmbedWidth(event.target.value)}
                        />
                        {inlineWidthConfig.error && (
                          <p className="text-xs text-destructive">{inlineWidthConfig.error}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="embed-height">{t('workspace.embedHeight')}</Label>
                        <Input
                          id="embed-height"
                          value={embedHeight}
                          onChange={(event) => setEmbedHeight(event.target.value)}
                        />
                        {inlineHeightConfig.error && (
                          <p className="text-xs text-destructive">{inlineHeightConfig.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('workspace.embedSnippet')}</Label>
                      <Textarea value={inlineEmbedSnippet} readOnly rows={6} className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => handleCopyLink(inlineEmbedSnippet)}
                        disabled={!!inlineWidthConfig.error || !!inlineHeightConfig.error}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {t('workspace.copyEmbedCode')}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="floating" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="floating-width">{t('workspace.embedWidth')}</Label>
                        <Input
                          id="floating-width"
                          value={embedWidth}
                          onChange={(event) => setEmbedWidth(event.target.value)}
                        />
                        {floatingWidthConfig.error && (
                          <p className="text-xs text-destructive">{floatingWidthConfig.error}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="floating-height">{t('workspace.embedHeight')}</Label>
                        <Input
                          id="floating-height"
                          value={embedHeight}
                          onChange={(event) => setEmbedHeight(event.target.value)}
                        />
                        {floatingHeightConfig.error && (
                          <p className="text-xs text-destructive">{floatingHeightConfig.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('workspace.embedSnippet')}</Label>
                      <Textarea value={floatingEmbedSnippet} readOnly rows={10} className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => handleCopyLink(floatingEmbedSnippet)}
                        disabled={!!floatingWidthConfig.error || !!floatingHeightConfig.error}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {t('workspace.copyEmbedCode')}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageSurface>
    </DashboardLayout>
  );
};

export default ImplementationPage;
