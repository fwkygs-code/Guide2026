import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Info } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';
import PayPalSubscription from './PayPalSubscription';
import { api } from '../lib/api';
import { toast } from 'sonner';

const UpgradePrompt = ({ open, onOpenChange, reason = null, workspaceId = null }) => {
  const { t } = useTranslation();
  const { quotaData, refreshQuota } = useQuota(workspaceId);
  const [mediaCapacityDialogOpen, setMediaCapacityDialogOpen] = useState(false);
  const [selectedPlanMedia, setSelectedPlanMedia] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Check if user has an active, pending, or cancelled PayPal subscription
  // CANCELLED subscriptions still show "Cancel Subscription" until EXPIRED
  const subscription = quotaData?.subscription;
  const isPayPalSubscription = subscription && subscription.provider === 'paypal';
  const hasActiveSubscription = isPayPalSubscription && subscription.status === 'active';
  const hasPendingSubscription = isPayPalSubscription && subscription.status === 'pending';
  const hasCancelledSubscription = isPayPalSubscription && subscription.status === 'cancelled';
  // Show cancel button for ACTIVE, PENDING, or CANCELLED (user can still see status)
  const canManageSubscription = isPayPalSubscription && (hasActiveSubscription || hasPendingSubscription || hasCancelledSubscription);

  if (!quotaData) return null;

  const { plan } = quotaData;
  const currentPlanName = plan.name;

  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      price: '$0',
      features: [
        '1 workspace',
        '3 categories',
        '10 walkthroughs',
        '500 MB storage',
        '10 MB max file size'
      ],
      current: currentPlanName === 'free',
      mediaCapacity: {
        maxImageFileSize: '10 MB',
        maxVideoFileSize: '100 MB',
        maxRawFileSize: '10 MB',
        maxImageTransformationSize: '100 MB',
        maxVideoTransformationSize: '40 MB',
        maxImageMegapixel: '25 MP',
        maxMegapixelAllFrames: '50 MP'
      }
    },
    {
      name: 'pro',
      displayName: 'Pro',
      price: '14 days free trial',
      priceAfter: '$5/month',
      features: [
        '3 workspaces',
        'Unlimited categories',
        'Unlimited walkthroughs',
        '25 GB storage',
        '150 MB max file size',
        'Extra storage available'
      ],
      current: currentPlanName === 'pro',
      recommended: true,
      mediaCapacity: {
        maxImageFileSize: '20 MB',
        maxVideoFileSize: '2 GB',
        maxRawFileSize: '20 MB',
        maxImageTransformationSize: '100 MB',
        maxVideoTransformationSize: '300 MB',
        maxImageMegapixel: '25 MP',
        maxMegapixelAllFrames: '100 MP'
      }
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      price: 'Custom pricing',
      features: [
        'Unlimited workspaces',
        'Unlimited categories',
        'Unlimited walkthroughs',
        '200 GB storage',
        '500 MB max file size',
        'Custom file size limits',
        'Priority support'
      ],
      current: currentPlanName === 'enterprise',
      mediaCapacity: null // Custom - contact for details
    }
  ];

  const getReasonMessage = () => {
    switch (reason) {
      case 'storage':
        return t('upgrade.storageExceeded');
      case 'file_size':
        return t('upgrade.fileSizeExceeded');
      case 'workspaces':
        return t('upgrade.workspacesExceeded');
      case 'walkthroughs':
        return t('upgrade.walkthroughsExceeded');
      case 'categories':
        return t('upgrade.categoriesExceeded');
      default:
        return t('upgrade.genericMessage');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('upgrade.title')}</DialogTitle>
          <DialogDescription>
            {getReasonMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {plans.map((planOption) => (
            <div
              key={planOption.name}
              className={`relative rounded-xl border-2 p-6 ${
                planOption.current
                  ? 'border-primary bg-primary/5'
                  : planOption.recommended
                  ? 'border-primary shadow-lg'
                  : 'border-border'
              }`}
            >
              {planOption.current && (
                <Badge className="absolute top-4 right-4">{t('upgrade.current')}</Badge>
              )}
              {planOption.recommended && !planOption.current && (
                <Badge variant="default" className="absolute top-4 right-4">
                  {t('upgrade.recommended')}
                </Badge>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {planOption.displayName}
                </h3>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-foreground">
                    {planOption.price}
                  </p>
                  {planOption.priceAfter && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {planOption.priceAfter}
                    </p>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {planOption.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {planOption.current ? (
                <Button variant="outline" className="w-full" disabled>
                  {t('upgrade.current')} {t('quota.plan')}
                </Button>
              ) : planOption.name === 'pro' ? (
                // Show "Cancel Subscription" if user has ACTIVE, PENDING, or CANCELLED PayPal subscription
                canManageSubscription ? (
                  <div className="space-y-2">
                    {hasCancelledSubscription ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground text-center">
                          Your subscription will remain active until the end of your billing period, then automatically cancel. No further charges will occur after that date unless you re-subscribe. Final billing status is determined by PayPal.
                        </p>
                        <p className="text-xs text-muted-foreground/80 text-center mt-1 italic">
                          Payments made without a PayPal account are still managed by PayPal and renew automatically unless cancelled.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => setShowCancelDialog(true)}
                          disabled={isCancelling}
                        >
                          {isCancelling ? t('billing.processing') : t('billing.cancelSubscription')}
                        </Button>
                        
                        {/* Cancellation Confirmation Dialog */}
                        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('billing.cancelSubscriptionConfirm')}</DialogTitle>
                              <DialogDescription>
                                <div className="space-y-2">
                                  <p>
                                    {t('billing.keepAccessUntil', { date: quotaData?.current_period_end ? new Date(quotaData.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : t('billing.endOfBillingPeriod') })}
                                  </p>
                                  <p className="font-medium">
                                    {t('billing.noFurtherCharges')}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {t('billing.finalStatusByPayPal')}
                                  </p>
                                </div>
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setShowCancelDialog(false)}
                              >
                                {t('common.cancel')}
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
                                            <div className="font-medium">{t('billing.cancelledByPayPal')}</div>
                                            <div className="text-sm">{t('billing.cancelledByPayPalDesc')}</div>
                                          </div>
                                        );
                                      } else {
                                        toast.success(
                                          <div>
                                            <div className="font-medium">{t('billing.cancellationPending')}</div>
                                            <div className="text-sm">{t('billing.cancellationPendingDesc')}</div>
                                          </div>
                                        );
                                      }
                                      
                                      // Refresh quota to update subscription status and lock UI
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
                                {isCancelling ? t('billing.processing') : t('billing.confirmCancellation')}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {/* Optional: "Manage via PayPal" link for users with PayPal accounts */}
                    {/* Note: Card-only (guest) users may not have PayPal accounts, so this is optional */}
                    <Button
                      className="w-full"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Optional: Open PayPal subscription management page
                        // Note: This may not work for card-only (guest checkout) users
                        // but is harmless to show as an option
                        window.open('https://www.paypal.com/myaccount/autopay/', '_blank');
                      }}
                    >
                      {t('billing.manageViaPayPal')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setShowPayPal(true);
                    }}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? t('billing.processing') : t('upgrade.select')}
                  </Button>
                )
              ) : (
                <Button
                  className="w-full"
                  onClick={() => {
                    // Enterprise plan - still use mailto
                    window.open('mailto:support@example.com?subject=Enterprise Plan Inquiry', '_blank');
                    onOpenChange(false);
                  }}
                >
                  {t('upgrade.contactSales')}
                </Button>
              )}

              <Button
                className="w-full mt-2"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPlanMedia(planOption);
                  setMediaCapacityDialogOpen(true);
                }}
              >
                <Info className="w-4 h-4 mr-2" />
                {t('upgrade.maxMediaCapacity')}
              </Button>
            </div>
          ))}
        </div>

        {/* Media Capacity Dialog */}
        <Dialog open={mediaCapacityDialogOpen} onOpenChange={setMediaCapacityDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedPlanMedia?.displayName} - {t('upgrade.maxMediaCapacity')}
              </DialogTitle>
              <DialogDescription>
                {selectedPlanMedia?.name === 'enterprise'
                  ? t('upgrade.contactForMediaCapacity')
                  : t('upgrade.mediaCapacityDetails')}
              </DialogDescription>
            </DialogHeader>

            {selectedPlanMedia?.name === 'enterprise' ? (
              <div className="py-6">
                <p className="text-muted-foreground mb-4">
                  {t('upgrade.enterpriseMediaCapacityDesc')}
                </p>
                <Button
                  onClick={() => {
                    window.open('mailto:support@example.com?subject=Enterprise Media Capacity Inquiry', '_blank');
                    setMediaCapacityDialogOpen(false);
                  }}
                >
                  {t('upgrade.contactSales')}
                </Button>
              </div>
            ) : selectedPlanMedia?.mediaCapacity ? (
              <div className="py-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxImageFileSize')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxImageFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxVideoFileSize')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxVideoFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxRawFileSize')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxRawFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxImageTransformSize')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxImageTransformationSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxVideoTransformSize')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxVideoTransformationSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxImageMegapixel')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxImageMegapixel}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-foreground font-medium">{t('upgrade.mediaCapacity.maxMegapixelAllFrames')}</span>
                    <span className="text-foreground font-semibold">{selectedPlanMedia.mediaCapacity.maxMegapixelAllFrames}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* PayPal Subscription Dialog */}
        <Dialog open={showPayPal} onOpenChange={(open) => {
          // Only allow closing if not currently subscribing
          if (!isSubscribing) {
            setShowPayPal(open);
            if (!open) {
              setIsSubscribing(false);
            }
          }
        }}>
          <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t('billing.subscribeToProPlan')}</DialogTitle>
              <DialogDescription>
                {t('billing.subscribeDescription')}
              </DialogDescription>
            </DialogHeader>
            {/* CRITICAL: Keep PayPal component mounted - use visibility instead of conditional rendering */}
            <div className="py-4" style={{ display: showPayPal ? 'block' : 'none' }}>
              <PayPalSubscription
                refreshQuota={refreshQuota}
                onSuccess={async (subscriptionID) => {
                  // Close modal after payment success (polling will handle this automatically)
                  setIsSubscribing(false);
                  setShowPayPal(false);
                  // Refresh quota in background (polling already does this, but refresh again to be sure)
                  if (refreshQuota) {
                    await refreshQuota();
                  }
                  // Close parent dialog and redirect to dashboard
                  onOpenChange(false);
                }}
                onCancel={() => {
                  setIsSubscribing(false);
                  // Allow user to close dialog manually
                }}
                isSubscribing={isSubscribing}
                setIsSubscribing={setIsSubscribing}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-4 space-y-2 text-center">
              <p>
                {t('billing.paymentsProcessedByPayPal')}{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                {' '}{t('common.and')}{' '}
                <a href="/billing-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Billing Policy</a>.
              </p>
              <p>
                {t('billing.autoRenewNotice')}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {!showPayPal && (
          <div className="mt-6 p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>{t('common.note')}:</strong> {t('upgrade.enterpriseRequiresSetup')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
