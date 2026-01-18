import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';

const BillingInfo = () => {
  const { t } = useTranslation();
  const { quotaData } = useQuota();

  if (!quotaData) {
    return null;
  }

  const { plan, subscription, trial_period_end, current_period_end, cancel_at_period_end } = quotaData;
  const hasSubscription = subscription && subscription.provider === 'paypal';
  const isProPlan = plan.name === 'pro';

  // Only show billing info for Pro plan with PayPal subscription
  if (!isProPlan || !hasSubscription) {
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = () => {
    if (!subscription) return null;
    
    const status = subscription.status;
    if (status === 'active') {
      return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    } else if (status === 'pending') {
      return <Badge className="bg-yellow-500">Pending Activation</Badge>;
    } else if (status === 'cancelled') {
      return <Badge className="bg-orange-500">Cancelled</Badge>;
    }
    return null;
  };

  const isInTrial = trial_period_end && new Date(trial_period_end) > new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Billing & Subscription
          </span>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Your subscription details and billing information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Name */}
        <div>
          <div className="text-sm font-medium text-slate-700">Plan</div>
          <div className="text-lg font-semibold text-slate-900 capitalize">{plan.display_name || plan.name}</div>
        </div>

        {/* Subscription Status */}
        {subscription && (
          <div>
            <div className="text-sm font-medium text-slate-700">Subscription Status</div>
            <div className="text-base text-slate-900 capitalize">{subscription.status}</div>
            {subscription.provider && (
              <div className="text-xs text-slate-500 mt-1">Provider: {subscription.provider.toUpperCase()}</div>
            )}
          </div>
        )}

        {/* Trial Information */}
        {isInTrial && trial_period_end && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">Free Trial Active</div>
                <div className="text-xs text-blue-700 mt-1">
                  Your trial ends on {formatDate(trial_period_end)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  After the trial, you'll be charged $19.90/month
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Billing Period */}
        {current_period_end && !isInTrial && (
          <div>
            <div className="text-sm font-medium text-slate-700">Current Billing Period Ends</div>
            <div className="text-base text-slate-900">{formatDate(current_period_end)}</div>
          </div>
        )}

        {/* Next Billing Date */}
        {quotaData.next_billing_date && !isInTrial && (
          <div>
            <div className="text-sm font-medium text-slate-700">Next Billing Date</div>
            <div className="text-base text-slate-900">{formatDate(quotaData.next_billing_date)}</div>
          </div>
        )}

        {/* Cancellation Status */}
        {cancel_at_period_end && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-900">Cancellation Scheduled</div>
                <div className="text-xs text-orange-700 mt-1">
                  Your subscription will remain active until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}.
                  After that, your account will be downgraded to the Free plan.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Subscription Info */}
        {subscription.status === 'active' && !cancel_at_period_end && !isInTrial && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">Subscription Active</div>
                <div className="text-xs text-green-700 mt-1">
                  Your Pro subscription is active and will automatically renew.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Activation */}
        {subscription.status === 'pending' && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-yellow-900">Activating your subscription…</div>
                <div className="text-xs text-yellow-700 mt-1">
                  This may take up to 1 minute. You can continue using the app.
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingInfo;
