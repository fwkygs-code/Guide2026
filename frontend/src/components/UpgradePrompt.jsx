import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Info } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';
import PayPalSubscription from './PayPalSubscription';

const UpgradePrompt = ({ open, onOpenChange, reason = null, workspaceId = null }) => {
  const { t } = useTranslation();
  const { quotaData, refreshQuota } = useQuota(workspaceId);
  const [mediaCapacityDialogOpen, setMediaCapacityDialogOpen] = useState(false);
  const [selectedPlanMedia, setSelectedPlanMedia] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  // Check if user has an active or pending PayPal subscription
  // Only show "Manage Subscription" for PayPal subscriptions (not manual/managed subscriptions)
  const subscription = quotaData?.subscription;
  const isPayPalSubscription = subscription && subscription.provider === 'paypal';
  const hasActiveSubscription = isPayPalSubscription && subscription.status === 'active';
  const hasPendingSubscription = isPayPalSubscription && subscription.status === 'pending';

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
      price: 'Contact for pricing',
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
        return 'You have exceeded your storage quota. Upgrade to get more storage space.';
      case 'file_size':
        return 'This file exceeds your plan\'s maximum file size limit. Upgrade to upload larger files.';
      case 'workspaces':
        return 'You have reached your workspace limit. Upgrade to create more workspaces.';
      case 'walkthroughs':
        return 'You have reached your walkthrough limit. Upgrade for unlimited walkthroughs.';
      case 'categories':
        return 'You have reached your category limit. Upgrade for unlimited categories.';
      default:
        return 'Upgrade your plan to unlock more features and higher limits.';
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
                  : 'border-slate-200'
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
                <h3 className="text-xl font-semibold text-slate-900">
                  {planOption.displayName}
                </h3>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {planOption.price}
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                {planOption.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
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
                // Only show "Manage Subscription" if user has an ACTIVE or PENDING PayPal subscription
                // Check both that subscription exists AND has correct status
                subscription && (hasActiveSubscription || hasPendingSubscription) ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        // For users with PayPal account: redirect to PayPal's subscription management page
                        // For guest checkout/card-only users: provide alternative cancellation path
                        window.open('https://www.paypal.com/myaccount/autopay/', '_blank');
                      }}
                    >
                      Manage Subscription
                    </Button>
                    <Button
                      className="w-full"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // If user doesn't have PayPal account (card-only payment), show contact support option
                        window.open('mailto:support@example.com?subject=Cancel Subscription Request', '_blank');
                      }}
                    >
                      Need Help Cancelling?
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
                    {isSubscribing ? 'Processing...' : t('upgrade.select')}
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
                  ? 'Contact us for custom media capacity details'
                  : 'Detailed media file size and transformation limits'}
              </DialogDescription>
            </DialogHeader>

            {selectedPlanMedia?.name === 'enterprise' ? (
              <div className="py-6">
                <p className="text-slate-600 mb-4">
                  Enterprise plans include custom media capacity limits tailored to your needs.
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
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max image file size</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxImageFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max video file size</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxVideoFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max raw file size</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxRawFileSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max image transformation size</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxImageTransformationSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max video transformation size</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxVideoTransformationSize}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-slate-700 font-medium">Max image megapixel</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxImageMegapixel}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-700 font-medium">Max megapixel in all frames</span>
                    <span className="text-slate-900 font-semibold">{selectedPlanMedia.mediaCapacity.maxMegapixelAllFrames}</span>
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
              <DialogTitle>Subscribe to Pro Plan</DialogTitle>
              <DialogDescription>
                Complete your subscription to unlock Pro features. Your subscription will be activated automatically.
              </DialogDescription>
            </DialogHeader>
            {/* CRITICAL: Keep PayPal component mounted - use visibility instead of conditional rendering */}
            <div className="py-4" style={{ display: showPayPal ? 'block' : 'none' }}>
              <PayPalSubscription
                onSuccess={async (subscriptionID) => {
                  // Close modal after payment success
                  setIsSubscribing(false);
                  setShowPayPal(false);
                  // Refresh quota in background
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
            <div className="text-xs text-slate-500 mt-4 space-y-2 text-center">
              <p>
                Payments are processed by PayPal. By subscribing, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/billing-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Billing Policy</a>.
              </p>
              <p>
                Your subscription will automatically renew unless cancelled through your PayPal account. 
                Invoices and receipts are sent by PayPal.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {!showPayPal && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Note:</strong> Enterprise plans require custom setup. Please contact us for Enterprise pricing.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
