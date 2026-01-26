import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BillingPolicyPage = () => {
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
          <h1 className="text-4xl font-heading font-bold text-foreground mb-6">{t('portal.billing.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">{t('portal.billing.lastUpdated')}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.billing.intro')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.plansAndPricing.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.billing.plansAndPricing.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.plansAndPricing.items', { returnObjects: true }).map((item, index) => (
                  <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.billing.plansAndPricing.changes')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.freeTrial.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.freeTrial.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.paymentProcessing.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.paymentProcessing.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.billingCycle.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.billingCycle.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.cancellations.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.cancellations.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.failedPayments.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.failedPayments.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.refundPolicy.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.refundPolicy.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.downgrades.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.downgrades.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.dataRetention.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.dataRetention.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.taxes.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.billing.taxes.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.changesToPolicy.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.billing.changesToPolicy.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.billing.contact.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.billing.contact.intro')}
              </p>
              <p className="text-foreground">{t('portal.billing.contact.email')}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BillingPolicyPage;
