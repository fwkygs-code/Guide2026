import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { useWorkspaceSlug } from '../hooks/useWorkspaceSlug';
import { api, getBackendUrl } from '../lib/api';
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

const ImplementationPage = () => {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { workspaceId, loading: workspaceLoading } = useWorkspaceSlug(workspaceSlug);
  const [categories, setCategories] = useState([]);
  const [walkthroughs, setWalkthroughs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWalkthroughId, setExpandedWalkthroughId] = useState(null);

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
            <TabsTrigger value="webhooks" disabled>
              {t('workspace.integrateWebhooksTab')}
            </TabsTrigger>
            <TabsTrigger value="embeds" disabled>
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
                      const walkthroughKey =
                        walkthrough.id || walkthrough.slug || `walkthrough-${group.id}-${walkthroughIndex}`;
                      const isExpanded = expandedWalkthroughId === walkthroughKey;
                      const steps = walkthrough.steps || [];
                      const walkthroughIdentifier = walkthrough.slug || walkthrough.id;
                      const walkthroughUrl = `${getBackendUrl()}/portal/${workspaceSlug}/${walkthroughIdentifier}`;

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
                                    const canonicalUrl = step.step_id
                                      ? `${walkthroughUrl}#step=${step.step_id}`
                                      : null;
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
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => canonicalUrl && handleCopyLink(canonicalUrl)}
                                          disabled={!canonicalUrl}
                                        >
                                          <Copy className="w-3.5 h-3.5 mr-2" />
                                          {t('common.copy')}
                                        </Button>
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
        </Tabs>
      </PageSurface>
    </DashboardLayout>
  );
};

export default ImplementationPage;
