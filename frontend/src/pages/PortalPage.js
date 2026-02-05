import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, FolderOpen, Search, Lock, ChevronRight, HelpCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { normalizeImageUrl } from '../lib/utils';
import KnowledgeSystemsNavigationBar from '../knowledge-systems/portal/KnowledgeSystemsNavigationBar';
import { portalKnowledgeSystemsService } from '../knowledge-systems/api-service';
import { usePortal } from '../contexts/PortalContext';
import createCategoryResolver from '../utils/categoryResolver';
import { buildCategoryTree, normalizeCategories } from '../utils/categoryTree';


const PortalPage = () => {
  const { t, ready } = useTranslation(['portal', 'common', 'translation']);
  const navigate = useNavigate();
  const { portal, workspace, slug, portalIdNormalized, portalDetails, primaryColor, inIframe, workspaceHeroImage } = usePortal();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const [selectedCategoryForChat, setSelectedCategoryForChat] = useState(null);
  const [knowledgeSystemCounts, setKnowledgeSystemCounts] = useState({});
  const walkthroughsSectionRef = useRef(null);
  const resolverOnSelectRef = useRef(null);
  const [resolverActive, setResolverActive] = useState(false);
  const [resolverPrompt, setResolverPrompt] = useState(null);
  const [resolverOptions, setResolverOptions] = useState([]);
  const [resolverWalkthroughs, setResolverWalkthroughs] = useState([]);
  const [resolverDepth, setResolverDepth] = useState(1);

  const normalizeCategoryIds = useCallback((ids) => (
    Array.isArray(ids)
      ? ids
          .map((id) => (id === null || id === undefined ? null : String(id)))
          .filter((id) => id !== null)
      : []
  ), []);

  const normalizedCategories = useMemo(() => normalizeCategories(portal?.categories || []), [portal?.categories]);

  const normalizedWalkthroughs = useMemo(() => (
    Array.isArray(portal?.walkthroughs)
      ? portal.walkthroughs.map((walkthrough) => ({
          ...walkthrough,
          category_ids: normalizeCategoryIds(walkthrough.category_ids),
        }))
      : []
  ), [portal?.walkthroughs, normalizeCategoryIds]);

  // Organize categories into parent/children structure
  const categoryTree = useMemo(() => buildCategoryTree(normalizedCategories), [normalizedCategories]);

  const resolver = useMemo(() => {
    if (!normalizedCategories.length || !normalizedWalkthroughs.length) return null;
    return createCategoryResolver(normalizedCategories, normalizedWalkthroughs);
  }, [normalizedCategories, normalizedWalkthroughs]);

  // Get all category IDs (including children) when a parent is selected
  const getCategoryIds = useCallback((categoryId) => {
    if (!categoryId) return null;
    const ids = [];
    const stack = [categoryId];
    const byParent = normalizedCategories.reduce((acc, category) => {
      const key = category.parent_id || 'root';
      if (!acc[key]) acc[key] = [];
      acc[key].push(category.id);
      return acc;
    }, {});

    while (stack.length) {
      const current = stack.pop();
      ids.push(current);
      const children = byParent[current] || [];
      stack.push(...children);
    }

    return ids;
  }, [normalizedCategories]);

  const filteredWalkthroughs = useMemo(() => {
    return normalizedWalkthroughs.filter(wt => {
      const matchesSearch = wt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           wt.description?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!selectedCategory) return matchesSearch;
      const categoryIds = getCategoryIds(selectedCategory);
      return matchesSearch && categoryIds && wt.category_ids?.some(id => categoryIds.includes(id));
    }) || [];
  }, [portal?.walkthroughs, searchQuery, selectedCategory, getCategoryIds]);

  // Group walkthroughs by category
  const walkthroughsByCategory = useMemo(() => {
    const grouped = {};
    categoryTree.forEach(cat => {
      const catIds = [cat.id, ...cat.children.map(c => c.id)];
      const items = filteredWalkthroughs.filter(wt => 
        wt.category_ids?.some(id => catIds.includes(id))
      );
      if (items.length > 0) {
        grouped[cat.id] = { category: cat, walkthroughs: items };
      }
    });
    // Uncategorized
    const uncategorized = filteredWalkthroughs.filter(wt => 
      !wt.category_ids || wt.category_ids.length === 0
    );
    if (uncategorized.length > 0) {
      grouped['_uncategorized'] = { category: null, walkthroughs: uncategorized };
    }
    return grouped;
  }, [categoryTree, filteredWalkthroughs]);

  const scrollToWalkthroughs = useCallback(() => {
    if (walkthroughsSectionRef.current) {
      walkthroughsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const resetResolver = useCallback(() => {
    setResolverActive(false);
    setResolverPrompt(null);
    setResolverOptions([]);
    setResolverWalkthroughs([]);
    resolverOnSelectRef.current = null;
  }, []);

  const navigateToWalkthrough = useCallback((walkthrough) => {
    if (!walkthrough) return;
    resetResolver();
    const target = walkthrough.slug || walkthrough.id;
    if (!target) return;
    navigate(`/portal/${slug}/${target}`);
  }, [navigate, resetResolver, slug]);

  const showWalkthroughList = useCallback((walkthroughsList) => {
    setResolverActive(true);
    setResolverPrompt(null);
    setResolverOptions([]);
    setResolverWalkthroughs(walkthroughsList || []);
    resolverOnSelectRef.current = null;
  }, []);

  const promptUserToChoose = useCallback((options, depth, onSelect) => {
    if (!Array.isArray(options) || options.length === 0) {
      showWalkthroughList([]);
      return;
    }
    const copyMap = {
      1: 'What do you need help with?',
      2: 'Which area best matches your issue?',
      3: 'Let\'s narrow it down a bit more'
    };
    setResolverPrompt(copyMap[depth] || copyMap[3]);
    setResolverOptions(options);
    setResolverWalkthroughs([]);
    setResolverDepth(depth);
    resolverOnSelectRef.current = onSelect;
    setResolverActive(true);
  }, [showWalkthroughList]);

  const resolverHandlers = useMemo(() => ({
    navigateToWalkthrough,
    showWalkthroughList,
    promptUserToChoose
  }), [navigateToWalkthrough, promptUserToChoose, showWalkthroughList]);

  const handleGuidedStart = useCallback(() => {
    if (!resolver) {
      toast.info('Guided helper is unavailable right now.');
      return;
    }
    setResolverActive(true);
    setResolverPrompt(null);
    setResolverOptions([]);
    setResolverWalkthroughs([]);
    resolverOnSelectRef.current = null;
    resolver.resolveNode(null, 1, resolverHandlers);
  }, [resolver, resolverHandlers]);

  const handleResolverOptionClick = useCallback((optionId) => {
    if (!optionId) return;
    if (resolverOnSelectRef.current) {
      resolverOnSelectRef.current(optionId);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    
    const loadCounts = async () => {
      try {
        const [policies, procedures, documentation, faqs, decisionTrees] = await Promise.all([
          portalKnowledgeSystemsService.getAllByType(slug, 'policy'),
          portalKnowledgeSystemsService.getAllByType(slug, 'procedure'),
          portalKnowledgeSystemsService.getAllByType(slug, 'documentation'),
          portalKnowledgeSystemsService.getAllByType(slug, 'faq'),
          portalKnowledgeSystemsService.getAllByType(slug, 'decision_tree')
        ]);
        
        setKnowledgeSystemCounts({
          policy: Array.isArray(policies) ? policies.length : 0,
          procedure: Array.isArray(procedures) ? procedures.length : 0,
          documentation: Array.isArray(documentation) ? documentation.length : 0,
          faq: Array.isArray(faqs) ? faqs.length : 0,
          'decision-tree': Array.isArray(decisionTrees) ? decisionTrees.length : 0
        });
      } catch (error) {
        console.error('[PortalPage] Failed to load knowledge system counts:', error);
        setKnowledgeSystemCounts({});
      }
    };
    
    loadCounts();
  }, [slug]);

  const knowledgeSystemsMenu = useMemo(() => {
    if (!slug) return [];
    const systems = [
      { key: 'policy', label: t('portal:knowledgeSystems.labels.policies', { defaultValue: 'Policies' }), path: `/portal/${slug}/knowledge/policies`, count: knowledgeSystemCounts.policy || 0 },
      { key: 'procedure', label: t('portal:knowledgeSystems.labels.procedures', { defaultValue: 'Procedures' }), path: `/portal/${slug}/knowledge/procedures`, count: knowledgeSystemCounts.procedure || 0 },
      { key: 'documentation', label: t('portal:knowledgeSystems.labels.documentation', { defaultValue: 'Documentation' }), path: `/portal/${slug}/knowledge/documentation`, count: knowledgeSystemCounts.documentation || 0 },
      { key: 'faq', label: t('portal:knowledgeSystems.labels.faqs', { defaultValue: 'FAQs' }), path: `/portal/${slug}/knowledge/faqs`, count: knowledgeSystemCounts.faq || 0 },
      { key: 'decision-tree', label: t('portal:knowledgeSystems.labels.decisions', { defaultValue: 'Decision Trees' }), path: `/portal/${slug}/knowledge/decisions`, count: knowledgeSystemCounts['decision-tree'] || 0 }
    ];
    return systems.filter(system => system.count > 0);
  }, [slug, t, knowledgeSystemCounts]);

  const showByCategory = selectedCategory === null && categoryTree.length > 0;
  return (
      <>
      {/* Portal-Specific Header */}
      <section className={`${inIframe ? 'py-6' : 'py-10 md:py-14'} px-6 relative`}>
        <div className="max-w-6xl mx-auto">
          {portalIdNormalized === 'admin' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-7 md:p-10 shadow-xl border border-border/50">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal:headers.admin.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-2 mb-3">
                      {portalDetails.title}
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground mb-5 leading-relaxed">
                      {portalDetails.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Badge variant="secondary">{t('portal:headers.admin.badgeSystemHealth')}</Badge>
                      <Badge variant="secondary">{t('portal:headers.admin.badgeAuditReady')}</Badge>
                      <Badge variant="secondary">{t('portal:headers.admin.badgeIntegrationControl')}</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToWalkthroughs}
                    className="rounded-2xl overflow-hidden border border-border/40 bg-slate-950/60 relative focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-all duration-300 group"
                  >
                    <img src={portalDetails.headerImage} alt="Admin control center overview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute bottom-4 right-4 text-xs font-semibold uppercase tracking-wide text-white flex items-center gap-2">
                      {t('portal:headers.tenant.imageCtaLabel')}
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'tenant' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-7 md:p-10 shadow-xl border border-border/50">
                <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] items-center">
                  <button
                    type="button"
                    onClick={scrollToWalkthroughs}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        scrollToWalkthroughs();
                      }
                    }}
                    className="rounded-2xl overflow-hidden border border-border/40 bg-slate-950/60 relative cursor-pointer group focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    role="button"
                    tabIndex={0}
                    aria-label={t('portal:headers.tenant.imageCta')}
                    title={t('portal:headers.tenant.imageCta')}
                  >
                    <img src={workspaceHeroImage || portalDetails.headerImage} alt={`${workspace?.name || 'Workspace'} guided journey`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      {t('portal:headers.tenant.imageCtaLabel')}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal:headers.tenant.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-2 mb-3">
                      {portalDetails.title}
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground mb-6 leading-relaxed">
                      {portalDetails.description}
                    </p>
                    <div className="relative max-w-2xl">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('portal:searchPlaceholder')}
                        className="pl-12 h-12 md:h-14 text-base md:text-lg rounded-xl bg-background/70 border border-border/60 focus-visible:ring-primary/50"
                        data-testid="portal-search-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'knowledge' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal:headers.knowledge.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-8">{portalDetails.description}</p>
                    <div className="relative max-w-2xl">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('portal:searchPlaceholder')}
                        className="pl-12 h-14 text-lg rounded-xl glass shadow-lg"
                        data-testid="portal-search-input"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt={`${workspace?.name || 'Workspace'} knowledge systems overview`} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {portalIdNormalized === 'integrations' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-border/60">
                <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
                  <div className="rounded-2xl overflow-hidden border border-border/60 bg-slate-950/60">
                    <img src={portalDetails.headerImage} alt={`${workspace?.name || 'Workspace'} integrations overview`} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('portal:headers.integrations.label')}</p>
                    <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground mt-3 mb-4">
                      {portalDetails.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-6">{portalDetails.description}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{t('portal:headers.integrations.badgeApiReady')}</Badge>
                      <Badge variant="secondary">{t('portal:headers.integrations.badgeWorkflowAutomation')}</Badge>
                      <Badge variant="secondary">{t('portal:headers.integrations.badgeSyncHealth')}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Guided Resolver Entry + Flow */}
      <section className="py-6 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="default" onClick={handleGuidedStart} data-testid="guided-resolver-start">
              {t('portal:findRightGuide', { defaultValue: 'Find the right guide' })}
            </Button>
            {resolverActive && (
              <Button variant="ghost" onClick={resetResolver} data-testid="guided-resolver-reset">
                {t('portal:guidedReset', { defaultValue: 'Exit guided helper' })}
              </Button>
            )}
          </div>
          {resolverActive && (
            <div className="glass rounded-2xl border border-border/60 p-6">
              {resolverPrompt && resolverOptions.length > 0 ? (
                <div className="space-y-5">
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    {resolverPrompt}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {resolverOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={() => handleResolverOptionClick(option.id)}
                      >
                        <div>
                          <div className="font-semibold text-left">{option.name}</div>
                          {option.description && (
                            <p className="text-sm text-muted-foreground text-left mt-1 line-clamp-2">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                        {t('portal:guidedResults', { defaultValue: 'Recommended walkthroughs' })}
                      </p>
                      <h3 className="text-2xl font-heading font-bold text-foreground mt-1">
                        {resolverWalkthroughs.length > 0
                          ? t('portal:guidedMatches', { defaultValue: '{{count}} guides match', count: resolverWalkthroughs.length })
                          : t('portal:guidedNoMatches', { defaultValue: 'No matching guides' })}
                      </h3>
                    </div>
                  </div>
                  {resolverWalkthroughs.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                      {resolverWalkthroughs.map((walkthrough, index) => (
                        <motion.div
                          key={`resolver-${walkthrough.id}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <button
                            type="button"
                            onClick={() => navigateToWalkthrough(walkthrough)}
                            className="block text-left w-full"
                          >
                            <div className="rounded-xl p-5 md:p-6 border border-border/70 hover:border-primary/40 bg-card/80 h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                              <div className="flex items-start gap-4 mb-3">
                                {walkthrough.icon_url ? (
                                  <img
                                    src={normalizeImageUrl(walkthrough.icon_url)}
                                    alt={walkthrough.title}
                                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border"
                                  />
                                ) : (
                                  <div 
                                    className="w-14 h-14 rounded-xl backdrop-blur-sm border flex items-center justify-center flex-shrink-0"
                                    style={{ 
                                      backgroundColor: `${primaryColor}15`, 
                                      borderColor: `${primaryColor}30` 
                                    }}
                                  >
                                    <BookOpen className="w-8 h-8" style={{ color: primaryColor }} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-heading font-semibold text-foreground mb-1 leading-tight">
                                    {walkthrough.title}
                                  </h3>
                                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {walkthrough.description || t('translation:walkthrough.noDescription')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/70">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide border-border/70">
                                    {walkthrough.steps?.length || 0} {t('portal:stepsLabel')}
                                  </Badge>
                                  {walkthrough.privacy === 'password' && (
                                    <Badge variant="secondary" className="text-[11px] flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      Locked
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t('portal:guidedNoResultsMessage', { defaultValue: 'Try another option or browse categories below.' })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Categories Filter */}
      {categoryTree.length > 0 && (
        <section className="py-4 px-6" aria-label={t('portal:categoriesLabel')}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                {t('portal:categoriesLabel')}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap md:flex-nowrap overflow-x-auto pb-1">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className={`cursor-pointer px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full border ${selectedCategory === null ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground border-border/70 hover:border-foreground/60'}`}
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
              >
                {t('common:all')}
              </Badge>
              {categoryTree.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  className={`cursor-pointer px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full border ${selectedCategory === category.id ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground border-border/70 hover:border-foreground/60'}`}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`category-${category.id}`}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Walkthroughs - Organized by Category */}
      <section className="py-8 md:py-10 px-6 pb-16" ref={walkthroughsSectionRef} id="portal-walkthroughs">
        <div className="max-w-7xl mx-auto">
          {showByCategory ? (
            // Show organized by categories
            Object.keys(walkthroughsByCategory).length > 0 ? (
              <div className="space-y-12">
                {Object.entries(walkthroughsByCategory).map(([key, { category, walkthroughs }], sectionIndex) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIndex * 0.1 }}
                  >
                    {category && (
                      <div className="mb-4 pl-3 border-l-2 border-border/50">
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">{category.name}</h2>
                            {category.description && (
                              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{category.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {category?.children.length > 0 && (
                      <div className="mb-4 flex gap-2 flex-wrap">
                        {category.children.map(subCat => (
                          <Badge key={subCat.id} variant="secondary" className="text-xs">
                            {subCat.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                      {walkthroughs.map((walkthrough, index) => (
                        <motion.div
                          key={walkthrough.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (sectionIndex * 0.1) + (index * 0.05) }}
                        >
                          <Link to={`/portal/${slug}/${walkthrough.slug || walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`} className="block h-full">
                            <div className="rounded-xl p-5 md:p-6 border border-border/70 hover:border-primary/40 bg-card/80 h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                              <div className="flex items-start gap-4 mb-3">
                                {walkthrough.icon_url ? (
                                  <img
                                    src={normalizeImageUrl(walkthrough.icon_url)}
                                    alt={walkthrough.title}
                                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border"
                                    onError={(e) => {
                                      console.error('Failed to load icon:', walkthrough.icon_url);
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className="w-14 h-14 rounded-xl backdrop-blur-sm border flex items-center justify-center flex-shrink-0"
                                    style={{ 
                                      backgroundColor: `${primaryColor}15`, 
                                      borderColor: `${primaryColor}30` 
                                    }}
                                  >
                                    <BookOpen className="w-8 h-8" style={{ color: primaryColor }} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 
                                    className="text-lg font-heading font-semibold text-foreground mb-1 leading-tight"
                                  >
                                    {walkthrough.title}
                                  </h3>
                                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {walkthrough.description || t('translation:walkthrough.noDescription')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/70">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide border-border/70">
                                    {walkthrough.steps?.length || 0} {t('portal:stepsLabel')}
                                  </Badge>
                                  {walkthrough.privacy === 'password' && (
                                    <Badge variant="secondary" className="text-[11px] flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      Locked
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-0 text-sm font-semibold text-primary hover:text-primary"
                                >
                                  {t('portal:startGuide')}
                                  <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-heading font-semibold text-white mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-slate-300">Try adjusting your search or filters</p>
              </div>
            )
          ) : (
            // Show flat list when category is selected
            filteredWalkthroughs.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {filteredWalkthroughs.map((walkthrough, index) => (
                  <motion.div
                    key={walkthrough.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={`/portal/${slug}/${walkthrough.id}`} data-testid={`walkthrough-${walkthrough.id}`} className="block h-full">
                      <div className="rounded-xl p-5 md:p-6 border border-border/70 hover:border-primary/40 bg-card/80 h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="flex items-start gap-4 mb-3">
                          {walkthrough.icon_url ? (
                            <img
                              src={walkthrough.icon_url}
                              alt={walkthrough.title}
                              className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-border"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-heading font-semibold text-foreground mb-1 leading-tight">
                              {walkthrough.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {walkthrough.description || t('translation:walkthrough.noDescription')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/70">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[11px] uppercase tracking-wide border-border/70">
                              {walkthrough.steps?.length || 0} {t('portal:stepsLabel')}
                            </Badge>
                            {walkthrough.privacy === 'password' && (
                              <Badge variant="secondary" className="text-[11px] flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-0 text-sm font-semibold text-primary hover:text-primary"
                          >
                            {t('portal:startGuide')}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
                  No walkthroughs found
                </h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* Knowledge Systems Menu - Hide in iframe mode */}
      {!inIframe && (
        <section className="py-8 px-6 mt-20">
          <div className="max-w-7xl mx-auto">
            <div className="glass rounded-2xl border border-border px-6 py-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-heading font-semibold text-foreground">{t('portal:knowledgeSystems.title', { defaultValue: 'Knowledge Systems' })}</h3>
                  <p className="text-sm text-muted-foreground">{t('portal:knowledgeSystems.description', { defaultValue: 'Browse published policies, procedures, docs, FAQs, and decisions.' })}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('portal:knowledgeSystems.available', { defaultValue: '{{count}} available', count: knowledgeSystemsMenu.length })}
                </div>
              </div>
              {knowledgeSystemsMenu.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('portal:knowledgeSystems.none', { defaultValue: 'No knowledge systems published yet.' })}</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {knowledgeSystemsMenu.map(system => (
                    <Link key={system.key} to={system.path}>
                      <Button variant="outline" size="sm">
                        {system.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Floating Help Button */}
      <AnimatePresence>
        {!helpChatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Get categories with NotebookLM URLs
              const categoriesWithChat = portal?.categories?.filter(c => c.notebooklm_url) || [];
              if (categoriesWithChat.length === 0) {
                toast.info('No chat support available for any category.');
                return;
              }
              if (categoriesWithChat.length === 1) {
                // If only one category has chat, open it directly
                const category = categoriesWithChat[0];
                setSelectedCategoryForChat(category);
                setHelpChatOpen(true);
                // Open NotebookLM in a new popup window (not iframe - Google blocks iframes)
                const popup = window.open(
                  category.notebooklm_url,
                  'gemini_chat',
                  'width=800,height=700,resizable=yes,scrollbars=yes,status=yes,location=yes,toolbar=no,menubar=no'
                );
                // Store reference to close it later
                if (popup) {
                  window.chatWindow = popup;
                  // Focus the popup
                  popup.focus();
                } else {
                  toast.error('Popup blocked. Please allow popups for this site and try again.');
                }
              } else {
                // Multiple categories - show selection dialog
                setCategorySelectOpen(true);
              }
            }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full font-medium shadow-2xl hover:shadow-3xl transition-all text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <HelpCircle className="w-5 h-5" />
            <span>{t('portal:needHelp')}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Category Selection Dialog */}
      <Dialog open={categorySelectOpen} onOpenChange={setCategorySelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('portal:selectCategory')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {portal?.categories?.filter(c => c.notebooklm_url).map((category) => (
              <Button
                key={category.id}
                variant="secondary"
                className="w-full justify-start h-auto py-3 px-4"
                onClick={() => {
                  setSelectedCategoryForChat(category);
                  setCategorySelectOpen(false);
                  setHelpChatOpen(true);
                  // Open NotebookLM in a new popup window (not iframe - Google blocks iframes)
                  const popup = window.open(
                    category.notebooklm_url,
                    'gemini_chat',
                    'width=800,height=700,resizable=yes,scrollbars=yes,status=yes,location=yes,toolbar=no,menubar=no'
                  );
                  // Store reference to close it later
                  if (popup) {
                    window.chatWindow = popup;
                    // Focus the popup
                    popup.focus();
                  } else {
                    toast.error('Popup blocked. Please allow popups for this site and try again.');
                    setHelpChatOpen(false);
                    setSelectedCategoryForChat(null);
                  }
                }}
              >
                <FolderOpen className="w-4 h-4 mr-3" style={{ color: primaryColor }} />
                <div className="text-left flex-1">
                  <div className="font-medium text-slate-900">{category.name}</div>
                  {category.description && (
                    <div className="text-xs text-slate-600 mt-0.5">{category.description}</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Bubble Indicator - Shows when chat window is open */}
      {helpChatOpen && selectedCategoryForChat && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Chat Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5" />
              <div>
                  <div className="font-semibold">{t('portal:chatOpened')}</div>
                <div className="text-xs opacity-90">{selectedCategoryForChat.name}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/20 text-white"
              onClick={() => {
                setHelpChatOpen(false);
                setSelectedCategoryForChat(null);
                // Try to close the popup window if it's still open
                if (window.chatWindow && !window.chatWindow.closed) {
                  window.chatWindow.close();
                }
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="glass p-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">
              {t('portal:chatWindowInstructions')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (selectedCategoryForChat.notebooklm_url) {
                  window.open(selectedCategoryForChat.notebooklm_url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              {t('portal:openChatTab')}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Knowledge Systems Navigation Bar */}
      {!inIframe && <KnowledgeSystemsNavigationBar workspaceId={workspace?.id} />}

      {/* Footer - Powered by InterGuide */}
      {!inIframe && (
        <footer className="glass border-t border-border py-6 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {t('portal:poweredBy')}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {t('portal:wantKnowledgeBase')}
            </p>
            <Link to="/signup">
              <Button variant="secondary" size="sm">
                {t('portal:getStarted')}
              </Button>
            </Link>
          </div>
        </footer>
      )}

    </>
  );
};

export default PortalPage;
