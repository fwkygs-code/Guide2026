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
  const [selectedPlanType, setSelectedPlanType] = useState('pro');
  
  // UI CLEANUP Fix 12: Use canonical state from API
  if (!quotaData) return null;

  const { plan, provider, access_granted, access_until, is_recurring, management_url } = quotaData;
  const currentPlanName = plan;
  const isPayPalSubscription = provider === 'PAYPAL';
  const canManageSubscription = isPayPalSubscription && access_granted;

  const plans = [
    {
      name: 'free',
      displayName: t('plans.free.name'),
      price: t('plans.free.price'),
      features: [
        t('plans.free.features.workspaces'),
        t('plans.free.features.categories'),
        t('plans.free.features.walkthroughs'),
        t('plans.free.features.storage'),
        t('plans.free.features.fileSize')
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
      displayName: t('plans.pro.name'),
      price: t('plans.pro.price'),
      priceAfter: t('plans.pro.priceAfter'),
      features: [
        t('plans.pro.features.workspaces'),
        t('plans.pro.features.categories'),
        t('plans.pro.features.walkthroughs'),
        t('plans.pro.features.storage'),
        t('plans.pro.features.fileSize'),
        t('plans.pro.features.extraStorage')
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
      displayName: t('plans.enterprise.name'),
      price: t('plans.enterprise.price'),
      features: [
        t('plans.enterprise.features.workspaces'),
        t('plans.enterprise.features.categories'),
        t('plans.enterprise.features.walkthroughs'),
        t('plans.enterprise.features.storage'),
        t('plans.enterprise.features.fileSize'),
        t('plans.enterprise.features.customLimits'),
        t('plans.enterprise.features.support')
      ],
      current: currentPlanName === 'enterprise',
      mediaCapacity: null
    }
  ];

  // TRANSLATION VALIDATION: Fail fast on missing keys
  plans.forEach(plan => {
    if (plan.displayName && plan.displayName.includes('.')) {
      console.error('[TRANSLATION] MISSING KEY:', plan.displayName);
    }
  });

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
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {planOption.current ? (
                <Button variant="outline" className="w-full" disabled>
                  {t('upgrade.current')} {t('quota.plan')}
                </Button>
              ) : planOption.name === 'pro' ? (
                // MONEY SAFETY: If access granted, remove payment entry point from render tree
                access_granted ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        if (management_url) {
                          window.open(management_url, '_blank');
                        } else {
                          toast.error(t('billing.unableToOpenPayPal'));
                        }
                      }}
                    >
                      {t('billing.manageSubscriptionInPayPal')}
                    </Button>
                    {access_until && (
                      <div className="text-xs text-center text-muted-foreground space-y-1">
                        <p>{t('billing.status')}: <span className="font-medium text-foreground">{t('billing.statusActive')}</span></p>
                        <p>{t('billing.accessUntil', { date: new Date(access_until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
                        {is_recurring && <p className="text-muted-foreground/80">{t('billing.renewsAutomatically')}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedPlanType(planOption.name);
                      setShowPayPal(true);
                    }}
                    disabled={isSubscribing}
                  >
                    {t('upgrade.select')}
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
                planType={selectedPlanType}
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
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t('auth.termsOfService')}</a>
                {' '}{t('common.and')}{' '}
                <a href="/billing-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t('auth.billingPolicy')}</a>.
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
