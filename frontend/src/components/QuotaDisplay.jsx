import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, FolderOpen, BookOpen, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const formatBytes = (bytes, t) => {
  const safeT = t || ((key) => key);
  if (bytes === 0) return '0 B';
  if (bytes === null || bytes === undefined) return safeT('quota.unlimited');
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatNumber = (num, t) => {
  const safeT = t || ((key) => key);
  if (num === null || num === undefined) return safeT('quota.unlimited');
  return num.toLocaleString();
};

const asNumberOrNull = (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : null);
const asNumberOrZero = (value) => asNumberOrNull(value) ?? 0;

const QuotaDisplay = ({
  workspaceId = null,
  showWarnings = true,
  onUpgrade = null,
  onReadyChange = null,
  sharedQuotaData = undefined,
  sharedLoading = undefined,
  sharedError = undefined
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const usingShared = sharedLoading !== undefined || sharedQuotaData !== undefined || sharedError !== undefined;
  const resolvedLoading = usingShared ? !!sharedLoading : loading;
  const resolvedError = usingShared ? sharedError : error;
  const resolvedQuotaData = usingShared ? sharedQuotaData : quotaData;

  const fetchQuotaData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user plan and quota
      const planResponse = await api.getUserPlan();
      const planData = planResponse.data;
      
      // HARD INVARIANT: Canonical fields must exist
      if (planData.access_granted === undefined) {
        console.error('[QUOTA] INVALID PLAN PAYLOAD - access_granted missing', planData);
        throw new Error('Invalid plan data: access_granted field missing');
      }
      
      let workspaceQuota = null;
      if (workspaceId) {
        const workspaceResponse = await api.getWorkspaceQuota(workspaceId);
        workspaceQuota = workspaceResponse.data;
      }
      
      setQuotaData({
        user: {
          plan: planData.plan,
          access_granted: planData.access_granted,
          quota: planData.quota,
          over_quota: planData.over_quota,
          workspace
        },
        workspace: workspaceQuota
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch quota data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (usingShared) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchQuotaData();
  }, [user?.id, usingShared, fetchQuotaData]);

  useEffect(() => {
    if (!onReadyChange) return;
    onReadyChange(!resolvedLoading && !!resolvedQuotaData && !resolvedError);
  }, [resolvedLoading, resolvedQuotaData, resolvedError, onReadyChange]);

  if (resolvedLoading) {
    return (
      <Card interactive={true}>
        <CardHeader>
          <CardTitle className="text-white">{t('quota.usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-secondary rounded w-3/4"></div>
            <div className="h-4 bg-secondary rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (resolvedError || !resolvedQuotaData) {
    return (
      <Card interactive={true}>
        <CardHeader>
          <CardTitle className="text-white">{t('quota.usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || t('quota.unableToLoad')}</p>
        </CardContent>
      </Card>
    );
  }

  // Safe destructuring after null check
  const { planName, quota, workspaceQuota, access_until, is_recurring, access_granted } = resolvedQuotaData;
  
  // Calculate time until access expires
  const formatTimeUntil = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    
    if (diff <= 0) return null; // Past date
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? `, ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? `, ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };
  
  // Get plan display name
  const planDisplayName = planName === 'pro' ? 'Pro' : 
                          planName === 'enterprise' ? 'Enterprise' : 
                          'Free';

  const storageUsed = asNumberOrZero(quota?.storage_used);
  const storageAllowed = asNumberOrNull(quota?.storage_allowed);
  const storagePercent = storageAllowed !== null && storageAllowed > 0
    ? Math.min(100, (storageUsed / storageAllowed) * 100)
    : 0;
  const storageRemaining = storageAllowed !== null
    ? Math.max(0, storageAllowed - storageUsed)
    : null;

  const workspacesUsed = asNumberOrZero(quota?.workspaces_used);
  const workspacesLimit = asNumberOrNull(quota?.workspaces_limit);
  const workspacesPercent = workspacesLimit !== null && workspacesLimit > 0
    ? Math.min(100, (workspacesUsed / workspacesLimit) * 100)
    : 0;

  const walkthroughsUsed = asNumberOrZero(quota?.walkthroughs_used);
  const walkthroughsLimit = asNumberOrNull(quota?.walkthroughs_limit);
  const walkthroughsPercent = walkthroughsLimit !== null && walkthroughsLimit > 0
    ? Math.min(100, (walkthroughsUsed / walkthroughsLimit) * 100)
    : 0;

  const categoriesUsed = asNumberOrZero(quota?.categories_used);
  const categoriesLimit = asNumberOrNull(quota?.categories_limit);
  const categoriesPercent = categoriesLimit !== null && categoriesLimit > 0
    ? Math.min(100, (categoriesUsed / categoriesLimit) * 100)
    : 0;

  const workspaceWalkthroughsUsed = asNumberOrZero(workspaceQuota?.walkthroughs_used);
  const workspaceWalkthroughsLimit = asNumberOrNull(workspaceQuota?.walkthroughs_limit);
  const workspaceCategoriesUsed = asNumberOrZero(workspaceQuota?.categories_used);
  const workspaceCategoriesLimit = asNumberOrNull(workspaceQuota?.categories_limit);

  // Determine warning levels
  const getStorageWarning = () => {
    if (storagePercent >= 100) return { level: 'error', message: t('quota.warnings.storageExceeded') };
    if (storagePercent >= 90) return { level: 'warning', message: t('quota.warnings.storageAlmostFull') };
    if (storagePercent >= 75) return { level: 'info', message: t('quota.warnings.storageGettingFull') };
    return null;
  };

  const getWorkspacesWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    // Being at limit is fine - user just can't create more, but can use existing ones
    if (workspacesPercent >= 100) return null; // At limit is OK, no warning
    if (workspacesPercent >= 80) return { level: 'warning', message: t('quota.warnings.approachingWorkspaceLimit') };
    return null;
  };

  const getWalkthroughsWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    if (walkthroughsPercent >= 100) return null; // At limit is OK, no warning
    if (walkthroughsPercent >= 80) return { level: 'warning', message: t('quota.warnings.approachingWalkthroughLimit') };
    return null;
  };

  const getCategoriesWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    if (categoriesPercent >= 100) return null; // At limit is OK, no warning
    if (categoriesPercent >= 80) return { level: 'warning', message: t('quota.warnings.approachingCategoryLimit') };
    return null;
  };

  const storageWarning = getStorageWarning();
  const workspacesWarning = getWorkspacesWarning();
  const walkthroughsWarning = getWalkthroughsWarning();
  const categoriesWarning = getCategoriesWarning();

  return (
    <div className="space-y-4">
      {/* Plan Badge and Upgrade Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-heading font-bold text-white group-hover:text-primary transition-colors">{t('quota.usage')}</h3>
        <div className="flex items-center gap-2">
          {onUpgrade && (
            <Button size="sm" variant="default" onClick={onUpgrade}>
              {t('quota.upgrade')}
            </Button>
          )}
          <Badge variant={planName === 'enterprise' ? 'default' : planName === 'pro' ? 'secondary' : 'outline'}>
            {planDisplayName} {t('quota.plan')}
          </Badge>
        </div>
      </div>

      {/* Subscription Status / Access Until */}
      {access_granted && access_until && (() => {
        const now = new Date();
        const accessUntilDate = new Date(access_until);
        const isActive = accessUntilDate > now;
        
        if (!isActive) return null;
        
        return (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-blue-900">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">{t('billing.statusActive')}:</span>
                <span>
                  {is_recurring 
                    ? t('billing.renewsAutomatically')
                    : `${t('billing.accessUntil')} ${formatTimeUntil(access_until)}`
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Warnings */}
      {showWarnings && (
        <div className="space-y-2">
          {storageWarning && (
            <Alert variant={storageWarning.level === 'error' ? 'destructive' : storageWarning.level === 'warning' ? 'default' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{storageWarning.message}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {storageWarning.level === 'error' 
                    ? t('quota.warnings.cannotUploadMore')
                    : t('quota.warnings.considerDeleting')}
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    {t('quota.upgrade')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {workspacesWarning && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{workspacesWarning.message}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {t('quota.warnings.approachingWorkspaceLimitDesc')}
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    {t('quota.upgrade')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {walkthroughsWarning && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{walkthroughsWarning.message}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {t('quota.warnings.approachingWalkthroughLimitDesc')}
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    {t('quota.upgrade')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {categoriesWarning && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{categoriesWarning.message}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {t('quota.warnings.approachingCategoryLimitDesc')}
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    {t('quota.upgrade')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Storage Usage */}
      <Card interactive={true}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.storage')}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatBytes(storageUsed, t)} / {formatBytes(storageAllowed, t)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={storagePercent} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">
            {storagePercent.toFixed(1)}{t('quota.percentUsed')}
            {storageRemaining !== null && storageAllowed !== null && storageAllowed > 0 && (
              <span className="ml-2">
                ({formatBytes(storageRemaining, t)} {t('quota.remaining')})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workspaces Usage */}
      <Card interactive={true}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.workspaces')}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {workspacesUsed} / {formatNumber(workspacesLimit, t)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {workspacesLimit !== null ? (
            <>
              <Progress value={workspacesPercent} className="h-2" />
              <div className="mt-2 text-xs text-muted-foreground">
                {workspacesPercent.toFixed(1)}{t('quota.percentUsed')}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>{t('quota.unlimited')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Walkthroughs Usage */}
      <Card interactive={true}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.walkthroughs')}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {walkthroughsUsed} / {formatNumber(walkthroughsLimit, t)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {walkthroughsLimit !== null ? (
            <>
              <Progress value={walkthroughsPercent} className="h-2" />
              <div className="mt-2 text-xs text-muted-foreground">
                {walkthroughsPercent.toFixed(1)}{t('quota.percentUsed')}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>{t('quota.unlimited')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories Usage */}
      <Card interactive={true}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.categories')}</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {categoriesUsed} / {formatNumber(categoriesLimit, t)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {categoriesLimit !== null ? (
            <>
              <Progress value={categoriesPercent} className="h-2" />
              <div className="mt-2 text-xs text-muted-foreground">
                {categoriesPercent.toFixed(1)}{t('quota.percentUsed')}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>{t('quota.unlimited')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace-specific quota (if available) */}
      {workspaceQuota && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.thisWorkspace')}</CardTitle>
            <CardDescription className="text-xs">
              {t('quota.workspaceQuota')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('quota.walkthroughs')}:</span>
              <span className="font-medium text-foreground">
                {workspaceWalkthroughsUsed} / {formatNumber(workspaceWalkthroughsLimit, t)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('quota.categories')}:</span>
              <span className="font-medium text-foreground">
                {workspaceCategoriesUsed} / {formatNumber(workspaceCategoriesLimit, t)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Limits Info */}
      <Card interactive={true}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading font-bold text-foreground group-hover:text-primary transition-colors">{t('quota.planLimits')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{t('quota.maxFileSize')}:</span>
            <span className="font-medium">{formatBytes(quota.max_file_size, t)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotaDisplay;
