import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Info } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { PLAN_DEFINITIONS } from '../config/plans';

const PlanSelectionModal = ({ open, onOpenChange, onPlanSelected, isSignup = false }) => {
  const { t } = useTranslation();
  const [selecting, setSelecting] = useState(false);
  const [mediaCapacityDialogOpen, setMediaCapacityDialogOpen] = useState(false);
  const [selectedPlanMedia, setSelectedPlanMedia] = useState(null);

  const getPlanDisplayName = (plan) => t(plan.nameKey);
  const getPlanPrice = (plan) => t(plan.priceKey);
  const getPlanPeriod = (plan) => (plan.periodKey ? t(plan.periodKey) : null);
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

  const handleSelectPlan = async (planId) => {
    if (planId === 'enterprise') {
      // Open email for enterprise
      const subject = encodeURIComponent(t('upgrade.enterprisePlanInquirySubject'));
      window.open(`mailto:support@example.com?subject=${subject}`, '_blank');
      return;
    }
    
    setSelecting(true);
    try {
      // CRITICAL: Pro plan requires PayPal subscription first
      if (planId === 'pro') {
        toast.error(t('billing.proRequiresPayPal'));
        onOpenChange(false);
        if (onPlanSelected) {
          onPlanSelected('free'); // Default to free plan
        }
        return;
      } else {
        // For Free plan, use changePlan endpoint
        await api.changePlan(planId);
        const selectedPlan = PLAN_DEFINITIONS.find((plan) => plan.id === planId);
        toast.success(t('toast.planSelected', { plan: selectedPlan ? getPlanDisplayName(selectedPlan) : '' }));
      }
      
      if (onPlanSelected) {
        onPlanSelected(planId);
      }
      onOpenChange(false);
      // Refresh page to update quota display
      window.location.reload();
    } catch (error) {
      console.error('Failed to select plan:', error);
      const errorMessage = error.response?.data?.detail || t('upgrade.selectPlanError');
      toast.error(errorMessage);
    } finally {
      setSelecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isSignup ? t('upgrade.choosePlan') : t('upgrade.changePlan')}
          </DialogTitle>
          <DialogDescription>
            {isSignup 
              ? t('upgrade.selectPlanDescription')
              : t('upgrade.changePlanDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {PLAN_DEFINITIONS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border-2 p-6 ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute top-4 right-4 bg-primary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('upgrade.popular')}
                </Badge>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {getPlanDisplayName(plan)}
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">
                    {getPlanPrice(plan)}
                  </span>
                  {getPlanPeriod(plan) && (
                    <span className="text-sm text-muted-foreground ml-2">
                      / {getPlanPeriod(plan)}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span>{getPlanFeature(feature)}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={selecting}
              >
                {selecting ? t('upgrade.selecting') : plan.id === 'enterprise' ? t('upgrade.contactSales') : t('upgrade.selectPlan')}
              </Button>

              <Button
                className="w-full mt-2 text-foreground"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPlanMedia(plan);
                  setMediaCapacityDialogOpen(true);
                }}
              >
                <Info className="w-4 h-4 mr-2" />
                {t('upgrade.maxMediaCapacity')}
              </Button>
              {plan.id === 'enterprise' && (
                <div className="mt-4 p-3 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>{t('common.note')}:</strong> {t('upgrade.enterpriseRequiresSetup')}
                  </p>
                </div>
              )}
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

        {isSignup && (
          <div className="mt-6 p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>{t('common.note')}:</strong> {t('billing.planSelectionNote')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlanSelectionModal;
