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
              src="/logo-main.png" 
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
          <h1 className="text-4xl font-heading font-bold text-slate-900 mb-6">Billing Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: January 2026</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <p className="text-slate-700 leading-relaxed mb-4">
                This Billing Policy governs subscriptions, payments, trials, renewals, cancellations, and refunds for InterGuide.app ("InterGuide", "we", "us"). This policy forms part of the InterGuide Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">1. Plans and Pricing</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                InterGuide offers both free and paid subscription plans.
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li><strong>Free Plan:</strong> Limited access to the platform at no cost.</li>
                <li><strong>Paid Plan:</strong> $5 USD per month, following a 14-day free trial.</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                Pricing may change in the future. Any changes will apply only to future billing periods and will be communicated in advance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">2. Free Trial</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>New users may be eligible for a 14-day free trial of paid features.</li>
                <li>No charges are applied during the trial period.</li>
                <li>If a payment method is provided, billing begins automatically at the end of the trial unless canceled before the trial expires.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">3. Payment Processing</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Payments are processed exclusively through PayPal.</li>
                <li>InterGuide does not collect, store, or process payment card or banking information.</li>
                <li>All payment information is handled directly by PayPal under their own terms and privacy policy.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">4. Billing Cycle and Renewal</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Subscriptions are billed on a monthly recurring basis.</li>
                <li>Billing occurs automatically at the beginning of each billing period.</li>
                <li>By subscribing, you authorize PayPal to charge the applicable subscription fee on a recurring basis.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">5. Cancellations</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>You may cancel your subscription at any time through PayPal or by contacting support@interguide.app.</li>
                <li>Cancellation prevents future charges but does not refund the current billing period.</li>
                <li>Access to paid features remains available until the end of the active billing cycle.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">6. Failed Payments</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>If a payment fails, access to paid features may be temporarily suspended.</li>
                <li>InterGuide reserves the right to restrict or terminate access after repeated payment failures.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">7. Refund Policy</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Subscription fees are non-refundable, except where required by applicable law.</li>
                <li>No partial refunds are provided for unused time.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">8. Downgrades and Plan Changes</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Plan changes take effect at the next billing cycle unless otherwise stated.</li>
                <li>No credits are issued for downgrades during an active billing period.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">9. Data Retention After Subscription Ends</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>When a paid subscription ends, access to the workspace and published portals is suspended.</li>
                <li>Workspace data is retained for up to 90 days.</li>
                <li>After 90 days, data may be permanently deleted unless the user reactivates the subscription or requests deletion earlier.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">10. Taxes</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Prices listed do not include applicable taxes unless stated otherwise.</li>
                <li>You are responsible for any taxes imposed by your jurisdiction.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">11. Changes to This Billing Policy</h2>
              <p className="text-slate-700 leading-relaxed">
                We may update this Billing Policy from time to time. Changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">12. Contact</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                For billing questions or cancellations:
              </p>
              <p className="text-slate-700 leading-relaxed">
                Email: support@interguide.app
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BillingPolicyPage;
