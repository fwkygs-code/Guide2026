import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const PrivacyPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-900 hover:text-primary transition-colors">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-bold">InterGuide</span>
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
          <h1 className="text-4xl font-heading font-bold text-slate-900 mb-6">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">1. Information We Collect</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Account information (name, email address, password)</li>
                <li>Content you create using our Service (walkthroughs, categories, media files)</li>
                <li>Billing information (processed by PayPal - we do not store payment card details)</li>
                <li>Usage data and analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">2. How We Use Your Information</h2>
              <p className="text-slate-700 leading-relaxed">
                We use the information we collect to provide, maintain, and improve our Service, process transactions, send you technical notices and updates, 
                and respond to your comments and questions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">3. Payment Processing</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                All payments are processed by PayPal. We do not store or have access to your payment card details. 
                PayPal handles all payment data in accordance with their privacy policy and PCI DSS requirements.
              </p>
              <p className="text-slate-700 leading-relaxed">
                We only receive and store your PayPal subscription ID for account management purposes. No payment credentials are stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">4. Data Storage and Security</h2>
              <p className="text-slate-700 leading-relaxed">
                We use industry-standard security measures to protect your data. Your content is stored securely using cloud infrastructure. 
                However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">5. Cookies</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information. 
                Cookies are files with a small amount of data which may include an anonymous unique identifier.
              </p>
              <p className="text-slate-700 leading-relaxed">
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. 
                However, if you do not accept cookies, you may not be able to use some portions of our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">6. Data Sharing</h2>
              <p className="text-slate-700 leading-relaxed">
                We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating our Service, 
                conducting our business, or serving our users, so long as those parties agree to keep this information confidential.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">7. Your Rights</h2>
              <p className="text-slate-700 leading-relaxed mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Object to processing of your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">8. Data Retention</h2>
              <p className="text-slate-700 leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide you services. 
                If you delete your account, we will delete your personal information within 30 days, unless we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">9. Children's Privacy</h2>
              <p className="text-slate-700 leading-relaxed">
                Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-slate-700 leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page 
                and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-slate-900 mb-4">11. Contact Us</h2>
              <p className="text-slate-700 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at support@example.com.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
