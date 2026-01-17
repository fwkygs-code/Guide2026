import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

const PlanSelectionModal = ({ open, onOpenChange, onPlanSelected, isSignup = false }) => {
  const [selecting, setSelecting] = useState(false);

  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '1 workspace',
        '3 categories',
        '10 walkthroughs',
        '500 MB storage',
        '10 MB max file size',
        'Basic support'
      ],
      popular: false
    },
    {
      name: 'pro',
      displayName: 'Pro',
      price: 'Free Trial',
      period: '14 days',
      features: [
        '3 workspaces',
        'Unlimited categories',
        'Unlimited walkthroughs',
        '25 GB storage',
        '150 MB max file size',
        'Extra storage available',
        'Priority support',
        'Advanced features'
      ],
      popular: true,
      trial: true
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      features: [
        'Unlimited workspaces',
        'Unlimited categories',
        'Unlimited walkthroughs',
        '200 GB storage',
        '500 MB max file size',
        'Custom file size limits',
        'Priority support',
        'Dedicated account manager',
        'Custom integrations'
      ],
      popular: false
    }
  ];

  const handleSelectPlan = async (planName) => {
    if (planName === 'enterprise') {
      // Open email for enterprise
      window.open('mailto:support@example.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    
    setSelecting(true);
    try {
      // Call API to change plan
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
      toast.error(error.response?.data?.detail || 'Failed to select plan. Please try again.');
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
                  Popular
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
                    Start with a free 14-day trial
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
                {selecting ? 'Selecting...' : plan.name === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
              </Button>
            </div>
          ))}
        </div>

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
