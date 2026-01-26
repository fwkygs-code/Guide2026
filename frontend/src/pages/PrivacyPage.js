import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const PrivacyPage = () => {
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
          <h1 className="text-4xl font-heading font-bold text-foreground mb-6">{t('portal.privacy.title')}</h1>
          <p className="text-sm text-muted-foreground mb-8">{t('portal.privacy.lastUpdated')}</p>

          <div className="prose prose-slate max-w-none space-y-8">
            <section>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.operatedBy')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.scope.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.scope.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.informationWeCollect.title')}</h2>
              <div className="mb-4">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">{t('portal.privacy.informationWeCollect.youProvide.title')}</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  {t('portal.privacy.informationWeCollect.youProvide.intro')}
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                  {t('portal.privacy.informationWeCollect.youProvide.items', { returnObjects: true }).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-6">
                    {t('portal.privacy.informationWeCollect.youProvide.contentItems', { returnObjects: true }).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-foreground mb-3">{t('portal.privacy.informationWeCollect.automaticallyCollected.title')}</h3>
                <p className="text-foreground leading-relaxed mb-4">
                  {t('portal.privacy.informationWeCollect.automaticallyCollected.intro')}
                </p>
                <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                  {t('portal.privacy.informationWeCollect.automaticallyCollected.items', { returnObjects: true }).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <p className="text-foreground leading-relaxed">
                  {t('portal.privacy.informationWeCollect.automaticallyCollected.usage')}
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.cookies.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.cookies.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.cookies.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.cookies.noTracking')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.analytics.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.analytics.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.payments.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.payments.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.payments.paypalOnly')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.thirdPartyProviders.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.thirdPartyProviders.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.thirdPartyProviders.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.thirdPartyProviders.dataProcessing')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.dataUse.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.dataUse.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.dataUse.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.dataUse.noMarketing')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.dataRetention.title')}</h2>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.dataRetention.items', { returnObjects: true }).map((item, index) => (
                  <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.accountDeletion.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.accountDeletion.intro')}
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.accountDeletion.usersMay')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.accountDeletion.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.accountDeletion.processingTime')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.internationalDataTransfers.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.internationalDataTransfers.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.security.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.security.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.security.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.security.noGuarantee')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.childrensPrivacy.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.childrensPrivacy.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.yourRights.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.yourRights.intro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2 ml-4">
                {t('portal.privacy.yourRights.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.yourRights.contact')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.changesToPolicy.title')}</h2>
              <p className="text-foreground leading-relaxed">
                {t('portal.privacy.changesToPolicy.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-semibold text-foreground mb-4">{t('portal.privacy.contact.title')}</h2>
              <p className="text-foreground leading-relaxed mb-4">
                {t('portal.privacy.contact.intro')}
              </p>
              <p className="text-foreground">{t('portal.privacy.contact.email')}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
