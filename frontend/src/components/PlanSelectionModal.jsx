import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Info } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

const PlanSelectionModal = ({ open, onOpenChange, onPlanSelected, isSignup = false }) => {
  const { t } = useTranslation();
  const [selecting, setSelecting] = useState(false);
  const [mediaCapacityDialogOpen, setMediaCapacityDialogOpen] = useState(false);
  const [selectedPlanMedia, setSelectedPlanMedia] = useState(null);

  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        t('upgrade.planFeatures.workspace', { count: 1 }),
        t('upgrade.planFeatures.categories', { count: 3 }),
        t('upgrade.planFeatures.walkthroughs', { count: 10 }),
        t('upgrade.planFeatures.storage', { size: '500 MB' }),
        t('upgrade.planFeatures.maxFileSize', { size: '10 MB' }),
        t('upgrade.planFeatures.basicSupport')
      ],
      popular: false,
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
      price: 'Free Trial',
      period: '14 days',
      features: [
        t('upgrade.planFeatures.workspaces', { count: 3 }),
        t('upgrade.planFeatures.unlimitedCategories'),
        t('upgrade.planFeatures.unlimitedWalkthroughs'),
        t('upgrade.planFeatures.storage', { size: '25 GB' }),
        t('upgrade.planFeatures.maxFileSize', { size: '150 MB' }),
        t('upgrade.planFeatures.extraStorageAvailable'),
        t('upgrade.planFeatures.prioritySupport'),
        t('upgrade.planFeatures.advancedFeatures')
      ],
      popular: true,
      trial: true,
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
      price: 'Custom',
      period: 'pricing',
      features: [
        t('upgrade.planFeatures.unlimitedWorkspaces'),
        t('upgrade.planFeatures.unlimitedCategories'),
        t('upgrade.planFeatures.unlimitedWalkthroughs'),
        t('upgrade.planFeatures.storage', { size: '200 GB' }),
        t('upgrade.planFeatures.maxFileSize', { size: '500 MB' }),
        t('upgrade.planFeatures.customFileSizeLimits'),
        t('upgrade.planFeatures.prioritySupport'),
        t('upgrade.planFeatures.dedicatedAccountManager'),
        t('upgrade.planFeatures.customIntegrations')
      ],
      popular: false,
      mediaCapacity: null // Custom - contact for details
    }
  ];

  const handleSelectPlan = async (planName) => {
    if (planName === 'enterprise') {
      // Open email for enterprise
      window.open('mailto:support@example.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    
    // CRITICAL: Pro plan requires PayPal subscription - cannot be selected during signup
    if (planName === 'pro') {
      toast.error('Pro plan requires PayPal subscription. After creating your account, go to Dashboard and click "Upgrade to Pro" to subscribe via PayPal.');
      onOpenChange(false);
      if (onPlanSelected) {
        onPlanSelected('free'); // Default to free plan
      }
      return;
    }
    
    setSelecting(true);
    try {
      // Call API to change plan (only works for Free plan now - Pro blocked in backend)
      await api.changePlan(planName);
      toast.success(`Successfully selected ${plans.find(p => p.name === planName)?.displayName} plan!`);
      if (onPlanSelected) {
        onPlanSelected(planName);
      }
      onOpenChange(false);
      // Refresh page to update quota display
      window.location.reload();
    } catch (error) {
      console.error('Failed to select plan:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to select plan. Please try again.';
      toast.error(errorMessage);
      
      // If Pro plan blocked, default to free and close modal
      if (error.response?.status === 400 && errorMessage.includes('PayPal subscription')) {
        if (onPlanSelected) {
          onPlanSelected('free');
        }
        onOpenChange(false);
      }
    } finally {
      setSelecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isSignup ? 'Choose Your Plan' : 'Change Plan'}
          </DialogTitle>
          <DialogDescription>
            {isSignup 
              ? 'Select a plan to get started. You can change your plan anytime.'
              : 'Select a new plan. Your current usage will be preserved.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border-2 p-6 ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-slate-200'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute top-4 right-4 bg-primary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('upgrade.popular')}
                </Badge>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-semibold text-slate-900">
                  {plan.displayName}
                </h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-slate-500 ml-2">
                      / {plan.period}
                    </span>
                  )}
                </div>
                {plan.trial && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    {t('upgrade.freeTrial')}
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                onClick={() => handleSelectPlan(plan.name)}
                disabled={selecting}
              >
                {selecting ? t('upgrade.selecting') : plan.name === 'enterprise' ? t('upgrade.contactSales') : t('upgrade.selectPlan')}
              </Button>

              <Button
                className="w-full mt-2"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPlanMedia(plan);
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

        {isSignup && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Note:</strong> You can start with the Free plan and upgrade anytime. 
              Pro plan includes a 14-day free trial with no credit card required.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlanSelectionModal;
