import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BillingPolicyPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-900 hover:text-primary transition-colors">
            <img 
              src="/logo.png" 
              alt="InterGuide" 
              className="h-10 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
          <h1 className="text-4xl font-heading font-bold text-slate-900 mb-6">Subscription & Billing Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">1. Payment Processing</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                All subscription payments are processed by PayPal. We do not store or have access to your payment card details, billing addresses, 
                or other payment credentials. PayPal handles all payment processing in accordance with their terms of service and PCI DSS requirements.
              </p>
              <p className="text-slate-700 leading-relaxed">
                By subscribing to a paid plan, you authorize PayPal to process payments on our behalf.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">2. Subscription Renewal</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Subscriptions automatically renew at the end of each billing period unless cancelled through your PayPal account. 
                You will continue to have access to Pro features until the end of your current billing period, even if you cancel.
              </p>
              <p className="text-slate-700 leading-relaxed">
                To cancel your subscription, log into your PayPal account and manage your automatic payments at: 
                <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                  https://www.paypal.com/myaccount/autopay/
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">3. Subscription Status</h2>
              <p className="text-slate-700 leading-relaxed mb-4">Your subscription can have the following statuses:</p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li><strong>ACTIVE:</strong> Your subscription is active and you have full Pro access. Payments are being processed automatically by PayPal.</li>
                <li><strong>PENDING:</strong> Your subscription has been created but payment confirmation is pending. Pro access will be granted once PayPal confirms payment.</li>
                <li><strong>CANCELLED:</strong> You have cancelled your subscription. You retain Pro access until the end of your current billing period.</li>
                <li><strong>EXPIRED:</strong> Your subscription has expired (end of billing period or payment failure). Access downgrades to Free plan.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">4. Failed Payments</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                If a payment fails, PayPal will attempt to process the payment according to their retry policy. 
                We do not immediately suspend access on payment failure. Your Pro access continues until PayPal notifies us that your subscription has expired.
              </p>
              <p className="text-slate-700 leading-relaxed">
                You will be downgraded to the Free plan only after PayPal sends an EXPIRED webhook event, which typically occurs at the end of your billing period 
                or after PayPal's retry attempts are exhausted.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">5. Invoices and Receipts</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                All invoices and receipts are sent by PayPal, not by InterGuide. You will receive payment confirmations and receipts directly from PayPal 
                to the email address associated with your PayPal account.
              </p>
              <p className="text-slate-700 leading-relaxed">
                To access your payment history, invoices, and receipts, log into your PayPal account at 
                <a href="https://www.paypal.com/myaccount/activity/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                  https://www.paypal.com/myaccount/activity/
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">6. Refunds</h2>
              <p className="text-slate-700 leading-relaxed">
                Refunds are processed by PayPal in accordance with their refund policy. To request a refund, please contact PayPal support 
                or reach out to us at support@example.com and we will assist you with the refund process.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">7. Plan Changes</h2>
              <p className="text-slate-700 leading-relaxed">
                When upgrading or downgrading your plan, the change takes effect immediately. When downgrading, you retain access to Pro features 
                until the end of your current billing period. Pro-rated refunds are handled by PayPal according to their policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">8. Data Storage</h2>
              <p className="text-slate-700 leading-relaxed">
                We store only your PayPal subscription ID for account management purposes. We do not store payment card numbers, 
                billing addresses, or any other payment credentials. All payment data remains securely with PayPal.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">9. Contact for Billing Issues</h2>
              <p className="text-slate-700 leading-relaxed">
                For billing-related questions or issues, you can:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4 mt-4">
                <li>Manage your subscription directly in PayPal: <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PayPal AutoPay Management</a></li>
                <li>Contact PayPal support for payment-related issues</li>
                <li>Contact us at support@example.com for subscription management assistance</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BillingPolicyPage;
