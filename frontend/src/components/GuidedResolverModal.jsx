import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronRight, ChevronLeft, Lock, X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeImageUrl } from '@/lib/utils';

const GuidedResolverModal = ({
  open,
  onClose,
  categories = [],
  walkthroughs = [],
  portalSlug,
  onSelectWalkthrough,
}) => {
  const { t } = useTranslation(['portal', 'common', 'translation']);

  const childrenMap = useMemo(() => {
    const map = new Map();

    categories.forEach((category) => {
      if (!category?.id) return;
      const normalized = {
        ...category,
        id: String(category.id),
        parent_id: category.parent_id ? String(category.parent_id) : null,
      };
      const parentKey = normalized.parent_id || 'root';
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      map.get(parentKey).push(normalized);
    });

    map.forEach((list) => {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return map;
  }, [categories]);

  const [path, setPath] = useState([]);
  const [mode, setMode] = useState('quiz');
  const [resolvedLeaf, setResolvedLeaf] = useState(null);
  const [results, setResults] = useState([]);

  const resetState = useCallback(() => {
    setPath([]);
    setMode('quiz');
    setResolvedLeaf(null);
    setResults([]);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const getChildren = useCallback(
    (nodeId) => childrenMap.get(nodeId || 'root') || [],
    [childrenMap]
  );

  const currentOptions = useMemo(() => {
    if (mode === 'results') return [];
    const parentId = path.length ? path[path.length - 1].id : null;
    return getChildren(parentId);
  }, [getChildren, mode, path]);

  const breadcrumb = useMemo(() => {
    if (!path.length) return [];
    return path.map((node, index) => ({
      id: node.id,
      label: node.name || node.label || t('portal:guided.pathUnnamed', { defaultValue: 'Unlabeled' }),
      isLeaf: index === path.length - 1 && mode === 'results',
    }));
  }, [path, mode, t]);

  const currentQuestionTitle = useMemo(() => {
    if (mode === 'results') {
      return t('portal:guided.resultsHeading', { defaultValue: 'Recommended walkthroughs' });
    }
    if (!path.length) {
      return t('portal:guided.topLevelQuestion', { defaultValue: 'What do you need help with?' });
    }
    return t('portal:guided.deeperQuestion', { defaultValue: 'Let’s narrow it down' });
  }, [mode, path.length, t]);

  const filterWalkthroughsByLeaf = useCallback(
    (leafId) => {
      if (!leafId) return [];
      return walkthroughs.filter((walkthrough) =>
        Array.isArray(walkthrough?.category_ids) && walkthrough.category_ids.some((id) => String(id) === leafId)
      );
    },
    [walkthroughs]
  );

  const handleSelectCategory = (category) => {
    if (!category) return;
    const children = getChildren(category.id);
    setPath((prev) => [...prev, category]);

    if (children.length === 0) {
      const filtered = filterWalkthroughsByLeaf(category.id);
      setResolvedLeaf(category);
      setResults(filtered);
      setMode('results');
      return;
    }
  };

  const handleBack = () => {
    if (mode === 'results') {
      setMode('quiz');
      setResolvedLeaf(null);
      setResults([]);
      setPath((prev) => prev.slice(0, -1));
      return;
    }
    if (!path.length) return;
    setPath((prev) => prev.slice(0, -1));
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  const handleWalkthroughClick = (walkthrough) => {
    if (!walkthrough) return;
    onSelectWalkthrough?.(walkthrough);
    handleClose();
  };

  const renderOptionButton = (option, index) => (
    <button
      key={option.id}
      type="button"
      aria-label={t('portal:guided.optionAria', { defaultValue: 'Select option {{label}}', label: option.name })}
      className="group w-full text-left rounded-2xl border border-border/70 bg-card/60 px-5 py-4 backdrop-blur transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      onClick={() => handleSelectCategory(option)}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-lg font-semibold text-foreground tracking-tight">
            {option.name || t('portal:guided.optionUnnamed', { defaultValue: 'Untitled option' })}
          </p>
          {option.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {option.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground/80 hidden sm:inline">
            {t('portal:guided.optionHint', { defaultValue: 'Step {{count}}', count: path.length + 1 })}
          </span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );

  const quizEmptyState = (
    <div className="text-center py-10">
      <p className="text-base text-muted-foreground">{t('portal:guided.noCategories', { defaultValue: 'No categories available yet.' })}</p>
    </div>
  );

  const resultsEmptyState = (
    <div className="text-center py-10">
      <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-base text-muted-foreground">{t('portal:guided.noWalkthroughs', { defaultValue: 'No walkthroughs found for this category.' })}</p>
    </div>
  );

  const breadcrumbDisplay = (
    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      <span>{t('portal:guided.pathLabel', { defaultValue: 'Path' })}</span>
      {path.length === 0 ? (
        <span className="px-3 py-1 rounded-full bg-muted/50 text-foreground text-[11px]">
          {t('portal:guided.rootLabel', { defaultValue: 'All categories' })}
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {breadcrumb.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <span className={`px-3 py-1 rounded-full ${crumb.isLeaf ? 'bg-primary/10 text-foreground font-semibold' : 'bg-muted/40 text-muted-foreground'}`}>
                {crumb.label}
              </span>
              {index < breadcrumb.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );

  const walkthroughCards = results.map((walkthrough) => (
    <div key={walkthrough.id} className="rounded-2xl border border-border/60 bg-card/70 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        {walkthrough.icon_url ? (
          <img
            src={normalizeImageUrl(walkthrough.icon_url)}
            alt={walkthrough.title}
            className="w-12 h-12 rounded-xl object-cover border border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-muted/80 flex items-center justify-center border border-border/50">
            <BookOpen className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground leading-tight">{walkthrough.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {walkthrough.description || t('translation:walkthrough.noDescription')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
            {walkthrough.steps?.length || 0} {t('portal:stepsLabel')}
          </Badge>
          {walkthrough.privacy === 'password' && (
            <Badge variant="secondary" className="text-[11px] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {t('portal:labels.locked', { defaultValue: 'Locked' })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleWalkthroughClick(walkthrough)}>
            {t('portal:startGuide')}
          </Button>
          <Link to={`/portal/${portalSlug || ''}/${walkthrough.slug || walkthrough.id}`}>
            <Button variant="outline" size="sm">
              {t('portal:guided.openFull', { defaultValue: 'Open full walkthrough' })}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  ));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : handleClose())}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-border/60 bg-background/95">
        <div className="bg-gradient-to-r from-primary/15 via-transparent to-primary/5 px-6 py-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {t('portal:guided.headerLabel', { defaultValue: 'Guided Journey' })}
            </p>
            <div className="flex items-center gap-2 text-2xl font-heading font-semibold text-foreground">
              <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
              <span>{t('portal:guided.title', { defaultValue: 'Find the right guide' })}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label={t('portal:guided.closeLabel', { defaultValue: 'Close guided modal' })}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={path.length === 0 && mode === 'quiz'}
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('portal:guided.backLabel', { defaultValue: 'Back' })}
                </Button>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    {mode === 'results'
                      ? t('portal:guided.resultsLabel', { defaultValue: 'Results' })
                      : t('portal:guided.stepLabel', { defaultValue: 'Step {{count}}', count: path.length + 1 })}
                  </p>
                  <p className="text-lg font-semibold text-foreground leading-tight">{currentQuestionTitle}</p>
                </div>
              </div>
              {breadcrumbDisplay}
            </div>

            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min((path.length / Math.max(path.length + currentOptions.length, 1)) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {t('portal:guided.progressLabel', { defaultValue: '{{current}} of {{total}}', current: Math.max(path.length, 1), total: Math.max(path.length + (mode === 'quiz' ? 1 : 0), 1) })}
              </span>
            </div>
          </div>

          {mode === 'quiz' ? (
            currentOptions.length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {currentOptions.map((option, index) => renderOptionButton(option, index))}
              </div>
            ) : (
              quizEmptyState
            )
          ) : results.length > 0 ? (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    {t('portal:guided.resultsSummaryLabel', { defaultValue: 'Best match' })}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {resolvedLeaf?.name || t('portal:guided.rootLabel', { defaultValue: 'All categories' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('portal:guided.matchCount', { defaultValue: '{{count}} guides found', count: results.length })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetState}>
                  {t('portal:guided.startOver', { defaultValue: 'Start over' })}
                </Button>
              </div>
              {walkthroughCards}
            </div>
          ) : (
            resultsEmptyState
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuidedResolverModal;
