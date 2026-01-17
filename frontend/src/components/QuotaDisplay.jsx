import React, { useState, useEffect } from 'react';
import { Database, FolderOpen, BookOpen, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  if (bytes === null || bytes === undefined) return 'Unlimited';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return 'Unlimited';
  return num.toLocaleString();
};

const QuotaDisplay = ({ workspaceId = null, showWarnings = true, onUpgrade = null }) => {
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQuotaData();
  }, [workspaceId]);

  const fetchQuotaData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user plan and quota
      const planResponse = await api.getUserPlan();
      const planData = planResponse.data;
      
      // If workspaceId provided, also fetch workspace-specific quota
      let workspaceQuota = null;
      if (workspaceId) {
        try {
          const workspaceResponse = await api.getWorkspaceQuota(workspaceId);
          workspaceQuota = workspaceResponse.data;
        } catch (err) {
          // Workspace quota is optional, don't fail if it doesn't exist
          console.warn('Workspace quota not available:', err);
        }
      }
      
      // Transform API response to match component expectations
      setQuotaData({
        plan: planData.plan,
        subscription: planData.subscription,
        trial_period_end: planData.trial_period_end || null,
        next_billing_date: planData.next_billing_date || null,
        quota: {
          storage_used: planData.quota.storage_used_bytes || 0,
          storage_allowed: planData.quota.storage_allowed_bytes || 0,
          workspaces_used: planData.quota.workspace_count || 0,
          workspaces_limit: planData.quota.workspace_limit,
          walkthroughs_used: planData.quota.walkthroughs_used || 0,
          walkthroughs_limit: planData.quota.walkthroughs_limit,
          categories_used: planData.quota.categories_used || 0,
          categories_limit: planData.quota.categories_limit
        },
        workspaceQuota: workspaceQuota ? {
          walkthroughs_used: workspaceQuota.usage?.walkthrough_count || 0,
          walkthroughs_limit: workspaceQuota.usage?.walkthrough_limit,
          categories_used: workspaceQuota.usage?.category_count || 0,
          categories_limit: workspaceQuota.usage?.category_limit
        } : null
      });
    } catch (err) {
      console.error('Failed to fetch quota data:', err);
      setError('Failed to load quota information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quota Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !quotaData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quota Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{error || 'Unable to load quota information'}</p>
        </CardContent>
      </Card>
    );
  }

  const { plan, quota, workspaceQuota, trial_period_end, next_billing_date } = quotaData;
  
  // Calculate time until trial ends or next billing
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
  
  // Calculate percentages
  const storagePercent = quota.storage_allowed > 0 
    ? Math.min(100, (quota.storage_used / quota.storage_allowed) * 100)
    : 0;
  
  const workspacesPercent = quota.workspaces_limit !== null && quota.workspaces_limit > 0
    ? Math.min(100, (quota.workspaces_used / quota.workspaces_limit) * 100)
    : 0;
  
  const walkthroughsPercent = quota.walkthroughs_limit !== null && quota.walkthroughs_limit > 0
    ? Math.min(100, (quota.walkthroughs_used / quota.walkthroughs_limit) * 100)
    : 0;
  
  const categoriesPercent = quota.categories_limit !== null && quota.categories_limit > 0
    ? Math.min(100, (quota.categories_used / quota.categories_limit) * 100)
    : 0;

  // Determine warning levels
  const getStorageWarning = () => {
    if (storagePercent >= 100) return { level: 'error', message: 'Storage quota exceeded' };
    if (storagePercent >= 90) return { level: 'warning', message: 'Storage almost full' };
    if (storagePercent >= 75) return { level: 'info', message: 'Storage getting full' };
    return null;
  };

  const getWorkspacesWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    // Being at limit is fine - user just can't create more, but can use existing ones
    if (workspacesPercent >= 100) return null; // At limit is OK, no warning
    if (workspacesPercent >= 80) return { level: 'warning', message: 'Approaching workspace limit' };
    return null;
  };

  const getWalkthroughsWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    if (walkthroughsPercent >= 100) return null; // At limit is OK, no warning
    if (walkthroughsPercent >= 80) return { level: 'warning', message: 'Approaching walkthrough limit' };
    return null;
  };

  const getCategoriesWarning = () => {
    // Only show warning when approaching (80-99%), not when at limit (100%)
    if (categoriesPercent >= 100) return null; // At limit is OK, no warning
    if (categoriesPercent >= 80) return { level: 'warning', message: 'Approaching category limit' };
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
        <h3 className="text-lg font-semibold text-slate-900">Quota Usage</h3>
        <div className="flex items-center gap-2">
          {onUpgrade && (
            <Button size="sm" variant="default" onClick={onUpgrade}>
              Upgrade Plan
            </Button>
          )}
          <Badge variant={plan.name === 'enterprise' ? 'default' : plan.name === 'pro' ? 'secondary' : 'outline'}>
            {plan.display_name} Plan
          </Badge>
        </div>
      </div>

      {/* Trial Period / Billing Date Info */}
      {(trial_period_end || next_billing_date) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            {trial_period_end && new Date(trial_period_end) > new Date() && (
              <div className="flex items-center gap-2 text-sm text-blue-900">
                <span className="font-medium">Trial ends in:</span>
                <span>{formatTimeUntil(trial_period_end)}</span>
              </div>
            )}
            {next_billing_date && (!trial_period_end || new Date(trial_period_end) <= new Date()) && (
              <div className="flex items-center gap-2 text-sm text-blue-900">
                <span className="font-medium">Next billing:</span>
                <span>{formatTimeUntil(next_billing_date)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                    ? 'You cannot upload more files. Please delete some files or upgrade your plan.'
                    : 'Consider deleting unused files or upgrading your plan.'}
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    Upgrade
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
                  You are approaching your workspace limit. You'll need to upgrade to create more.
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    Upgrade
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
                  You are approaching your walkthrough limit. You'll need to upgrade to create more.
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    Upgrade
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
                  You are approaching your category limit. You'll need to upgrade to create more.
                </span>
                {onUpgrade && (
                  <Button size="sm" variant="outline" onClick={onUpgrade} className="shrink-0">
                    Upgrade
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Storage Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
            </div>
            <span className="text-xs text-slate-500">
              {formatBytes(quota.storage_used)} / {formatBytes(quota.storage_allowed)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={storagePercent} className="h-2" />
          <div className="mt-2 text-xs text-slate-500">
            {storagePercent.toFixed(1)}% used
            {quota.storage_allowed > 0 && (
              <span className="ml-2">
                ({formatBytes(quota.storage_allowed - quota.storage_used)} remaining)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workspaces Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            </div>
            <span className="text-xs text-slate-500">
              {quota.workspaces_used} / {formatNumber(quota.workspaces_limit)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {quota.workspaces_limit !== null ? (
            <>
              <Progress value={workspacesPercent} className="h-2" />
              <div className="mt-2 text-xs text-slate-500">
                {workspacesPercent.toFixed(1)}% used
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>Unlimited</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Walkthroughs Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-medium">Walkthroughs</CardTitle>
            </div>
            <span className="text-xs text-slate-500">
              {quota.walkthroughs_used} / {formatNumber(quota.walkthroughs_limit)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {quota.walkthroughs_limit !== null ? (
            <>
              <Progress value={walkthroughsPercent} className="h-2" />
              <div className="mt-2 text-xs text-slate-500">
                {walkthroughsPercent.toFixed(1)}% used
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>Unlimited</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
            </div>
            <span className="text-xs text-slate-500">
              {quota.categories_used} / {formatNumber(quota.categories_limit)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {quota.categories_limit !== null ? (
            <>
              <Progress value={categoriesPercent} className="h-2" />
              <div className="mt-2 text-xs text-slate-500">
                {categoriesPercent.toFixed(1)}% used
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span>Unlimited</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace-specific quota (if available) */}
      {workspaceQuota && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Workspace</CardTitle>
            <CardDescription className="text-xs">
              Quota usage for this specific workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Walkthroughs:</span>
              <span className="font-medium">
                {workspaceQuota.walkthroughs_used} / {formatNumber(workspaceQuota.walkthroughs_limit)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Categories:</span>
              <span className="font-medium">
                {workspaceQuota.categories_used} / {formatNumber(workspaceQuota.categories_limit)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Limits Info */}
      <Card className="bg-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Plan Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span>Max file size:</span>
            <span className="font-medium">{formatBytes(plan.max_file_size_bytes)}</span>
          </div>
          {plan.extra_storage_increment_bytes && (
            <div className="flex items-center justify-between">
              <span>Extra storage increments:</span>
              <span className="font-medium">{formatBytes(plan.extra_storage_increment_bytes)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotaDisplay;
