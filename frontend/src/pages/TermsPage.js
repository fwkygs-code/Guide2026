import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TermsPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
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
                {t('workspace.backToHome')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card rounded-xl shadow-lg p-8 md:p-12">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-6">{t('portal.terms.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">{t('portal.terms.lastUpdated')}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.intro')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.operatedBy')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">1. The Service</h2>
              <p className="text-foreground leading-relaxed mb-4">
                InterGuide provides a platform for building knowledge bases and walkthroughs and publishing them as shareable or embeddable portals. Features may evolve over time.
              </p>
              <p className="text-foreground leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any part of the service at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">2. Eligibility</h2>
              <p className="text-foreground leading-relaxed mb-4">
                You must be at least 16 years old to use InterGuide.
              </p>
              <p className="text-foreground leading-relaxed">
                If you are under the age of 18, you represent that you have permission from a parent or legal guardian. We do not knowingly allow use by individuals under 16.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">3. Accounts</h2>
              <p className="text-foreground leading-relaxed mb-4">
                You must create an account to access most features.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                You agree to:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Provide accurate information</li>
                <li>Maintain the security of your credentials</li>
                <li>Be responsible for all activity under your account</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                InterGuide may suspend or terminate accounts that violate these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">4. Subscriptions, Trials, and Billing</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Paid features are offered on a subscription basis as described in the Billing Policy, which is incorporated into these Terms.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Key points:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>14-day free trial (if offered)</li>
                <li>$5 USD monthly subscription</li>
                <li>Payments processed exclusively via PayPal</li>
                <li>No refunds except where required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">5. User Content</h2>
              <div className="mb-4">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">5.1 Ownership</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  You retain ownership of all content you create or upload, including text, walkthroughs, images, videos, and files ("User Content").
                </p>
                <p className="text-foreground leading-relaxed">
                  InterGuide does not claim ownership over your User Content.
                </p>
              </div>
              <div className="mb-4">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">5.2 License to Operate</h3>
                <p className="text-foreground leading-relaxed">
                  By using the service, you grant InterGuide a limited, non-exclusive, worldwide license to host, store, process, display, and transmit User Content solely for the purpose of operating and improving the service.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">5.3 Platform Structure</h3>
                <p className="text-foreground leading-relaxed">
                  InterGuide retains all rights to the platform architecture, workflows, layouts, schemas, and system-generated structures used to organize User Content.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">6. Acceptable Use</h2>
              <p className="text-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Upload illegal or infringing content</li>
                <li>Harass, abuse, or harm others</li>
                <li>Interfere with platform security or performance</li>
                <li>Use the service for unlawful purposes</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                We reserve the right to remove content or restrict access at our discretion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">7. Collaboration and Sharing</h2>
              <p className="text-foreground leading-relaxed">
                InterGuide allows workspace sharing and collaboration between users. You are responsible for managing access permissions and the consequences of sharing content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">8. Suspension and Termination</h2>
              <p className="text-foreground leading-relaxed mb-4">
                We may suspend or terminate your access if you:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Violate these Terms</li>
                <li>Fail to pay applicable fees</li>
                <li>Create risk or legal exposure</li>
              </ul>
              <p className="text-foreground leading-relaxed mb-4">
                Upon termination:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Access to paid features and portals is disabled</li>
                <li>Data retention is handled per the Privacy Policy and Billing Policy</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">9. Data Retention</h2>
              <p className="text-foreground leading-relaxed mb-4">
                After subscription termination:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>Workspace data is retained for up to 90 days</li>
                <li>Data may be deleted after this period</li>
                <li>Earlier deletion may be requested via support@interguide.app</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">10. Intellectual Property</h2>
              <p className="text-foreground leading-relaxed">
                All InterGuide software, branding, design, and platform technology are owned by InterGuide.app and protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">11. Third-Party Services</h2>
              <p className="text-foreground leading-relaxed">
                InterGuide relies on third-party infrastructure and services. We are not responsible for outages or issues caused by third-party providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">12. No Warranty</h2>
              <p className="text-foreground leading-relaxed font-semibold">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">13. Limitation of Liability</h2>
              <p className="text-foreground leading-relaxed font-semibold mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, INTERGUIDE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
              </p>
              <p className="text-foreground leading-relaxed font-semibold">
                INTERGUIDE'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO INTERGUIDE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">14. Indemnification</h2>
              <p className="text-foreground leading-relaxed">
                You agree to indemnify and hold harmless InterGuide from claims arising out of your use of the service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">15. Arbitration and Class Action Waiver</h2>
              <p className="text-foreground leading-relaxed font-semibold mb-4">
                PLEASE READ CAREFULLY.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Any dispute arising out of or relating to these Terms or the service shall be resolved by binding arbitration, rather than in court, except where prohibited by law.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                You waive the right to participate in class actions, class arbitrations, or representative actions.
              </p>
              <p className="text-foreground leading-relaxed">
                Arbitration shall be conducted on an individual basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">16. Governing Law</h2>
              <p className="text-foreground leading-relaxed mb-4">
                These Terms are governed by the laws of:
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                <li>The State of California, USA, and</li>
                <li>The State of Israel,</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                without regard to conflict-of-law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">17. Changes to Terms</h2>
              <p className="text-foreground leading-relaxed">
                We may update these Terms from time to time. Continued use of the service after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">18. Contact</h2>
              <p className="text-foreground leading-relaxed mb-4">
                For legal or support inquiries:
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

export default TermsPage;
