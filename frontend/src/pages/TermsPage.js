import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TermsPage = () => {
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
          <h1 className="text-4xl font-heading font-bold text-slate-900 mb-6">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-700 leading-relaxed">
                By accessing and using InterGuide ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">2. Use License</h2>
              <p className="text-slate-700 leading-relaxed">
                Permission is granted to temporarily use InterGuide for personal and commercial purposes. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4 mt-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display (commercial or non-commercial) without written permission</li>
                <li>Attempt to decompile or reverse engineer any software contained on InterGuide</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">3. Subscription and Billing</h2>
              <p className="text-slate-700 leading-relaxed">
                All subscription payments are processed by PayPal. By subscribing to a paid plan, you agree that:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4 mt-4">
                <li>Payments are processed by PayPal in accordance with PayPal's terms of service</li>
                <li>Subscriptions automatically renew unless cancelled through your PayPal account</li>
                <li>You are responsible for maintaining valid payment information with PayPal</li>
                <li>Invoices and receipts are sent by PayPal, not by InterGuide</li>
                <li>Failed payments may result in service suspension after PayPal notifies us of subscription expiration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">4. Account Responsibilities</h2>
              <p className="text-slate-700 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. 
                You agree to immediately notify us of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">5. Content and Intellectual Property</h2>
              <p className="text-slate-700 leading-relaxed">
                You retain ownership of all content you create using InterGuide. You grant us a license to store, display, and process your content solely for the purpose of providing the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">6. Service Availability</h2>
              <p className="text-slate-700 leading-relaxed">
                We strive to maintain high availability but do not guarantee uninterrupted service. We reserve the right to modify, suspend, or discontinue the Service at any time with reasonable notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">7. Limitation of Liability</h2>
              <p className="text-slate-700 leading-relaxed">
                In no event shall InterGuide or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) 
                arising out of the use or inability to use the materials on InterGuide's website, even if InterGuide or an authorized representative has been notified orally or in writing of the possibility of such damage.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">8. Revisions</h2>
              <p className="text-slate-700 leading-relaxed">
                InterGuide may revise these terms of service at any time without notice. By using this Service, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">9. Contact Information</h2>
              <p className="text-slate-700 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at support@example.com.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
