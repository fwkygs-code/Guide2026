import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TermsPage = () => {
  const { t } = useTranslation();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <img 
              src="/NewLogo.png" 
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
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.theService.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.theService.intro')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.theService.rights')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.eligibility.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.eligibility.age')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.eligibility.consent')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.accounts.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.accounts.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.accounts.agreeTo')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.accounts.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.accounts.termination')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.subscriptions.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.subscriptions.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.subscriptions.keyPoints')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.subscriptions.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.userContent.title')}</h2>
              <h3 className="text-xl font-heading font-semibold text-foreground mb-3">{t('portal.terms.userContent.ownership.title')}</h3>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.userContent.ownership.intro')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.userContent.ownership.noClaim')}
              </p>
              <h3 className="text-xl font-heading font-semibold text-foreground mb-3">{t('portal.terms.userContent.license.title')}</h3>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.userContent.license.content')}
              </p>
              <h3 className="text-xl font-heading font-semibold text-foreground mb-3">{t('portal.terms.userContent.platform.title')}</h3>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.userContent.platform.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.acceptableUse.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.acceptableUse.agreeNotTo')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.acceptableUse.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.acceptableUse.rights')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.collaboration.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.collaboration.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.suspension.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.suspension.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.suspension.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.suspension.uponTermination')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.suspension.terminationItems', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.dataRetention.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.dataRetention.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.dataRetention.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.intellectualProperty.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.intellectualProperty.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.thirdPartyServices.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.thirdPartyServices.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.noWarranty.title')}</h2>
              <p className="text-foreground leading-relaxed font-semibold">
                {t('portal.terms.noWarranty.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.limitationOfLiability.title')}</h2>
              <p className="text-foreground leading-relaxed font-semibold mb-4">
                {t('portal.terms.limitationOfLiability.content1')}
              </p>
              <p className="text-foreground leading-relaxed font-semibold">
                {t('portal.terms.limitationOfLiability.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.indemnification.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.indemnification.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.arbitration.title')}</h2>
              <p className="text-foreground leading-relaxed font-semibold mb-4">
                {t('portal.terms.arbitration.readCarefully')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.arbitration.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.arbitration.waiver')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.arbitration.individual')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.governingLaw.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.governingLaw.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.terms.governingLaw.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.governingLaw.conflict')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.changesToTerms.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.changesToTerms.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.terms.contact.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.terms.contact.intro')}
              </p>
              <p className="text-foreground leading-relaxed">
                {t('portal.terms.contact.email')}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
