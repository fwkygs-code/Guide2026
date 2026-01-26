import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
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
          <h1 className="text-4xl font-heading font-bold text-foreground mb-6">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: January 2026</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <p className="text-foreground leading-relaxed mb-4">
                This Privacy Policy explains how InterGuide.app ("InterGuide", "we", "us", or "our") collects, uses, stores, and protects personal information when you use our services.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                InterGuide is operated under the name InterGuide.app. Contact email: support@interguide.app
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">1. Scope</h2>
              <p className="text-foreground leading-relaxed">
                This Privacy Policy applies to all users of the InterGuide platform, including free and paid users, and to all services provided through https://www.interguide.app.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">2. Information We Collect</h2>
              <div className="mb-4">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">2.1 Information You Provide</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  We collect information you voluntarily provide, including:
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Account credentials (encrypted passwords)</li>
                  <li>Content you create or upload, including:</li>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-6">
                    <li>Walkthroughs</li>
                    <li>Knowledge base entries</li>
                    <li>Images, videos, and files</li>
                  </ul>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">2.2 Automatically Collected Information</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  We may automatically collect limited technical data necessary to operate the service, including:
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                  <li>IP address</li>
                  <li>Device and browser information</li>
                  <li>Session and authentication data</li>
                  <li>Usage activity within the platform</li>
                </ul>
                <p className="text-foreground leading-relaxed">
                  This data is used strictly for platform functionality, security, and internal analytics.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">3. Cookies</h2>
              <p className="text-foreground leading-relaxed mb-4">
                InterGuide uses cookies strictly for operational purposes:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Authentication and login sessions</li>
                <li>Autosave and workspace functionality</li>
                <li>User interface preferences</li>
                <li>Internal analytics</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                We do not use advertising, tracking, or third-party marketing cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">4. Analytics</h2>
              <p className="text-foreground leading-relaxed">
                We use internal analytics only to understand platform usage and improve reliability and performance. No advertising or behavioral tracking is performed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">5. Payments</h2>
              <p className="text-foreground leading-relaxed mb-4">
                InterGuide offers both free and paid plans.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Payments are processed exclusively through PayPal. We do not collect, process, or store payment card or billing information. Payment data is handled entirely by PayPal under their own privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">6. Third-Party Service Providers</h2>
              <p className="text-foreground leading-relaxed mb-4">
                We use trusted third-party infrastructure providers to operate the service, including:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Cloudflare (security and content delivery)</li>
                <li>Render (application hosting)</li>
                <li>MongoDB (database storage)</li>
                <li>Cloudinary (media storage)</li>
                <li>SAV (infrastructure services)</li>
                <li>Resend (transactional email delivery)</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                These providers process data only as necessary to deliver their services to InterGuide.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">7. Data Use</h2>
              <p className="text-foreground leading-relaxed mb-4">
                We use collected data to:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Create and manage user accounts</li>
                <li>Provide and operate the platform</li>
                <li>Enable collaboration and workspace sharing</li>
                <li>Maintain security and prevent abuse</li>
                <li>Send essential service emails (authentication, password reset)</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                We do not send marketing or promotional emails.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">8. Data Retention</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li><strong>Active accounts:</strong> Data is retained while the account is active.</li>
                <li><strong>Paid subscriptions ended:</strong> Workspace data is retained for up to 90 days after subscription termination.</li>
                <li><strong>After 90 days,</strong> data may be permanently deleted unless required for legal or operational purposes.</li>
                <li><strong>Users may request earlier deletion</strong> by contacting support@interguide.app.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">9. Account Deletion</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Users cannot self-delete accounts through the platform.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Users may:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Delete their own content at any time</li>
                <li>Request full account and data deletion by emailing support@interguide.app</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                Deletion requests are processed within a reasonable timeframe.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">10. International Data Transfers</h2>
              <p className="text-foreground leading-relaxed">
                Your data may be stored and processed on servers located outside your country of residence. We take reasonable measures to protect data regardless of location.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">11. Security</h2>
              <p className="text-foreground leading-relaxed mb-4">
                We implement reasonable administrative, technical, and organizational safeguards, including:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Encrypted credentials</li>
                <li>Access controls</li>
                <li>Secure infrastructure providers</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                No system is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">12. Children's Privacy</h2>
              <p className="text-foreground leading-relaxed">
                InterGuide is not intended for users under 16 years of age. We do not knowingly collect personal data from minors. If such data is discovered, it will be deleted.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">13. Your Rights</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Depending on your jurisdiction, you may have rights to:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Access your data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion</li>
                <li>Object to certain processing</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                Requests should be sent to support@interguide.app.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">14. Changes to This Policy</h2>
              <p className="text-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">15. Contact</h2>
              <p className="text-foreground leading-relaxed">
                For privacy-related questions or requests:
              </p>
              <p className="text-foreground leading-relaxed">
                Email: support@interguide.app
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
