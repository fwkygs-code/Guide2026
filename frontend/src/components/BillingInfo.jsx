import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, CheckCircle2 } from 'lucide-react';
import { useQuota } from '../hooks/useQuota';
import { toast } from 'sonner';

const BillingInfo = () => {
  const { t } = useTranslation();
  const { quotaData } = useQuota();

  if (!quotaData) {
    return null;
  }

  const { plan, provider, access_granted, access_until, is_recurring, management_url } = quotaData;
  const isPayPalSubscription = provider === 'PAYPAL';
  const isProPlan = plan === 'pro' || plan === 'pro-testing';

  if (!isProPlan || !isPayPalSubscription) {
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

  const getCanonicalStatusBadge = () => {
    if (access_granted) {
      return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    }
    return <Badge className="bg-slate-500">Inactive</Badge>;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t('billing.billingAndSubscription')}
          </span>
          {getCanonicalStatusBadge()}
        </CardTitle>
        <CardDescription>
          {t('billing.subscriptionDetails')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium text-foreground">{t('billing.plan')}</div>
          <div className="text-lg font-semibold text-foreground capitalize">{plan}</div>
        </div>

        {access_granted && access_until && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900">Status: Active</div>
                <div className="text-xs text-green-700 mt-1">
                  Access until {formatDate(access_until)}
                </div>
                {is_recurring && (
                  <div className="text-xs text-green-600 mt-1">
                    Renews automatically unless cancelled in PayPal
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!access_granted && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm font-medium text-slate-900">Status: Inactive</div>
          </div>
        )}

        {access_granted && management_url && (
          <div className="pt-4 border-t border-border">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                window.open(management_url, '_blank');
              }}
            >
              Manage Subscription in PayPal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingInfo;
