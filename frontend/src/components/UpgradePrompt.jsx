import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Info } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';
import PayPalSubscription from './PayPalSubscription';
import { toast } from 'sonner';
import { PLAN_DEFINITIONS } from '../config/plans';

const UpgradePrompt = ({ open, onOpenChange, reason = null, workspaceId = null }) => {
  const { t, i18n } = useTranslation();
  const { quotaData, refreshQuota } = useQuota(workspaceId);
  const [mediaCapacityDialogOpen, setMediaCapacityDialogOpen] = useState(false);
  const [selectedPlanMedia, setSelectedPlanMedia] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState('pro');
  
  // UI CLEANUP Fix 12: Use canonical state from API
  if (!quotaData) return null;

  const { plan, access_granted, access_until, is_recurring, management_url } = quotaData;
  const currentPlanName = plan;

  const getPlanDisplayName = (plan) => t(plan.nameKey);
  const getPlanPrice = (plan) => t(plan.priceKey);
  const getPlanPriceAfter = (plan) => (plan.priceAfterKey ? t(plan.priceAfterKey) : null);
  const getPlanFeature = (feature) => {
    const values = {};
    if (feature.count !== undefined) {
      values.count = feature.count;
    }
    if (feature.sizeKey) {
      values.size = t(feature.sizeKey);
    }
    return t(feature.key, values);
  };

  const plans = PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    current: plan.id === currentPlanName
  }));

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
              key={planOption.id}
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
                  {getPlanDisplayName(planOption)}
                </h3>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-foreground">
                    {getPlanPrice(planOption)}
                  </p>
                  {getPlanPriceAfter(planOption) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {getPlanPriceAfter(planOption)}
                    </p>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {planOption.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground">{getPlanFeature(feature)}</span>
                  </li>
                ))}
              </ul>

              {planOption.current ? (
                <Button variant="outline" className="w-full" disabled>
                  {t('upgrade.current')} {t('quota.plan')}
                </Button>
              ) : planOption.id === 'pro' ? (
                // Show PayPal management only when on Pro with access granted
                access_granted && currentPlanName === 'pro' ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full text-foreground"
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
                        <p>{t('billing.accessUntil', { date: new Date(access_until).toLocaleDateString(i18n.language || 'en', { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
                        {is_recurring && <p className="text-muted-foreground/80">{t('billing.renewsAutomatically')}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedPlanType(planOption.id);
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
                    const subject = encodeURIComponent(t('upgrade.enterprisePlanInquirySubject'));
                    window.open(`mailto:support@example.com?subject=${subject}`, '_blank');
                    onOpenChange(false);
                  }}
                >
                  {t('upgrade.contactSales')}
                </Button>
              )}

              <Button
                className="w-full mt-2 text-foreground"
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
                {selectedPlanMedia ? getPlanDisplayName(selectedPlanMedia) : ''} - {t('upgrade.maxMediaCapacity')}
              </DialogTitle>
              <DialogDescription>
                {selectedPlanMedia?.id === 'enterprise'
                  ? t('upgrade.contactForMediaCapacity')
                  : t('upgrade.mediaCapacityDetails')}
              </DialogDescription>
            </DialogHeader>

            {selectedPlanMedia?.id === 'enterprise' ? (
              <div className="py-6">
                <p className="text-muted-foreground mb-4">
                  {t('upgrade.enterpriseMediaCapacityDesc')}
                </p>
                <Button
                  onClick={() => {
                    const subject = encodeURIComponent(t('upgrade.enterpriseMediaCapacityInquirySubject'));
                    window.open(`mailto:support@example.com?subject=${subject}`, '_blank');
                    setMediaCapacityDialogOpen(false);
                  }}
                >
                  {t('upgrade.contactSales')}
                </Button>
              </div>
            ) : selectedPlanMedia?.mediaCapacity ? (
              <div className="py-4">
                <div className="space-y-3">
                  {selectedPlanMedia.mediaCapacity.map((item, index) => {
                    const isLast = index === selectedPlanMedia.mediaCapacity.length - 1;
                    return (
                      <div
                        key={item.labelKey}
                        className={`flex justify-between items-center py-2 ${isLast ? '' : 'border-b border-border'}`}
                      >
                        <span className="text-foreground font-medium">{t(item.labelKey)}</span>
                        <span className="text-foreground font-semibold">{t(item.valueKey)}</span>
                      </div>
                    );
                  })}
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
