import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';

const UpgradePrompt = ({ open, onOpenChange, reason = null, workspaceId = null }) => {
  const { quotaData } = useQuota(workspaceId);

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
      current: currentPlanName === 'free'
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
      recommended: true
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
      current: currentPlanName === 'enterprise'
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
          <DialogTitle>Upgrade Your Plan</DialogTitle>
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
                <Badge className="absolute top-4 right-4">Current</Badge>
              )}
              {planOption.recommended && !planOption.current && (
                <Badge variant="default" className="absolute top-4 right-4">
                  Recommended
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
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => {
                    // TODO: Integrate with payment system
                    window.open('mailto:support@example.com?subject=Plan Upgrade Request', '_blank');
                    onOpenChange(false);
                  }}
                >
                  {planOption.name === 'enterprise' ? 'Contact Sales' : 'Upgrade Now'}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            <strong>Note:</strong> Plan upgrades are currently processed manually. Please contact us to upgrade your plan.
            We'll help you choose the right plan for your needs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
