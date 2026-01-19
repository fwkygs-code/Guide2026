import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';
import { api } from '../lib/api';
import { toast } from 'sonner';

const BillingInfo = () => {
  const { t } = useTranslation();
  const { quotaData, refreshQuota } = useQuota();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (!quotaData) {
    return null;
  }

  const { plan, subscription, trial_period_end, current_period_end, cancel_at_period_end, paypal_verified_status, last_verified_at, cancellation_receipt } = quotaData;
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
      return <Badge className="bg-blue-500">Pending Activation</Badge>;
    } else if (status === 'cancelled') {
      return <Badge className="bg-orange-500">Cancelled</Badge>;
    }
    return null;
  };

  const isInTrial = trial_period_end && new Date(trial_period_end) > new Date();

  return (
    <Card className="bg-white border-slate-200">
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
                  After the trial, billing will occur at $5/month as determined by PayPal.
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

        {/* Cancellation Status - Only show if not in button section */}
        {cancel_at_period_end && !(subscription && (subscription.status === 'active' || subscription.status === 'pending' || subscription.status === 'cancelled')) && (
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-900">Subscription Cancelled</div>
                <div className="text-xs text-orange-700 mt-1">
                  Your subscription will remain active until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}.
                  After that, your account will be downgraded to the Free plan. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.
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
                  Your Pro subscription is active. Renewal is managed by PayPal according to your subscription terms.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Activation */}
        {subscription.status === 'pending' && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">Activating your subscription…</div>
                <div className="text-xs text-blue-700 mt-1">
                  PayPal is processing your subscription. This may take up to 1 minute. You can continue using the app.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card-Only Disclaimer */}
        {hasSubscription && (
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-slate-600">
              Payments made without a PayPal account are still managed by PayPal and renew automatically unless cancelled.
            </p>
          </div>
        )}

        {/* PayPal Verified Status */}
        {paypal_verified_status && (
          <div>
            <div className="text-sm font-medium text-slate-700">PayPal Verified Status</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={paypal_verified_status === 'ACTIVE' ? 'bg-green-500' : paypal_verified_status === 'CANCELLED' ? 'bg-orange-500' : 'bg-slate-500'}>
                {paypal_verified_status}
              </Badge>
              {last_verified_at && (
                <span className="text-xs text-slate-500">
                  Last verified: {formatDate(last_verified_at)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Cancellation Receipt */}
        {cancellation_receipt && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm font-medium text-slate-900 mb-2">Cancellation Receipt</div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>Requested: {cancellation_receipt.cancellation_requested_at ? formatDate(cancellation_receipt.cancellation_requested_at) : 'N/A'}</div>
              <div>Provider: {cancellation_receipt.provider?.toUpperCase() || 'PayPal'}</div>
              {cancellation_receipt.effective_end_date && (
                <div>Effective end date: {formatDate(cancellation_receipt.effective_end_date)}</div>
              )}
              {cancellation_receipt.provider_subscription_id && (
                <div className="font-mono text-xs break-all">Subscription ID: {cancellation_receipt.provider_subscription_id}</div>
              )}
            </div>
          </div>
        )}

        {/* Card-Only Disclaimer */}
        {hasSubscription && (
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-slate-600">
              Payments made without a PayPal account are still managed by PayPal and renew automatically unless cancelled.
            </p>
          </div>
        )}

        {/* Cancellation Receipt */}
        {cancellation_receipt && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm font-medium text-slate-900 mb-2">Cancellation Receipt</div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>Requested: {cancellation_receipt.cancellation_requested_at ? formatDate(cancellation_receipt.cancellation_requested_at) : 'N/A'}</div>
              <div>Provider: {cancellation_receipt.provider?.toUpperCase() || 'PayPal'}</div>
              {cancellation_receipt.effective_end_date && (
                <div>Effective end date: {formatDate(cancellation_receipt.effective_end_date)}</div>
              )}
              {cancellation_receipt.provider_subscription_id && (
                <div className="font-mono text-xs">Subscription ID: {cancellation_receipt.provider_subscription_id}</div>
              )}
            </div>
          </div>
        )}

        {/* Cancel Subscription Button */}
        {subscription && (subscription.status === 'active' || subscription.status === 'pending' || subscription.status === 'cancelled') && (
          <div className="pt-4 border-t border-slate-200">
            {cancel_at_period_end ? (
              <div className="space-y-2">
                {paypal_verified_status === 'CANCELLED' ? (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-900">Subscription cancelled by PayPal</div>
                        <div className="text-xs text-green-700 mt-1">
                          PayPal has confirmed the cancellation. No further charges will occur. Pro access until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}. Verified by PayPal.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : paypal_verified_status === 'UNKNOWN' || !paypal_verified_status ? (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-900">Cancellation requested — pending PayPal confirmation</div>
                        <div className="text-xs text-blue-700 mt-1">
                          Cancellation request sent. PayPal confirmation pending. Your access remains active until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}. Final billing status is determined by PayPal.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">
                    Your subscription will remain active until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}. No further charges will occur after this date unless you re-subscribe. Final billing status is determined by PayPal.
                  </p>
                )}
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Processing...' : 'Cancel Subscription'}
                </Button>
                
                {/* Cancellation Confirmation Dialog */}
                <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancel subscription?</DialogTitle>
                      <DialogDescription>
                        <div className="space-y-2">
                          <p>
                            You will keep Pro access until {current_period_end ? formatDate(current_period_end) : 'the end of your billing period'}.
                          </p>
                          <p className="font-medium">
                            No further charges will occur after this date unless you re-subscribe.
                          </p>
                          <p className="text-xs text-slate-500">
                            Final billing status is determined by PayPal.
                          </p>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          setShowCancelDialog(false);
                          setIsCancelling(true);
                          try {
                            const response = await api.cancelPayPalSubscription();
                            if (response.data && response.data.success) {
                              const status = response.data.status;
                              const paypalVerified = response.data.paypal_verified;
                              
                              // Show different messages based on PayPal verification
                              if (status === 'cancelled_confirmed' && paypalVerified) {
                                toast.success(
                                  <div>
                                    <div className="font-medium">Subscription cancelled</div>
                                    <div className="text-sm">PayPal has confirmed the cancellation. No further charges will occur. Final billing status is determined by PayPal.</div>
                                  </div>
                                );
                              } else {
                                toast.success(
                                  <div>
                                    <div className="font-medium">Cancellation pending confirmation</div>
                                    <div className="text-sm">PayPal is processing the cancellation. Your access remains active until the end of the period. Final billing status is determined by PayPal.</div>
                                  </div>
                                );
                              }
                              
                              if (refreshQuota) {
                                await refreshQuota();
                              }
                            }
                          } catch (error) {
                            const errorMessage = error.response?.data?.detail || 'Failed to process cancellation request. Please try again or contact support.';
                            toast.error(errorMessage);
                          } finally {
                            setIsCancelling(false);
                          }
                        }}
                        disabled={isCancelling}
                      >
                        {isCancelling ? 'Processing...' : 'Confirm cancellation'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingInfo;
