import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, Zap, Users, BarChart3, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/LanguageSwitcher';

const LandingPage = () => {
  const { t } = useTranslation();
  
  const features = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: t('landing.featureInteractiveTitle'),
      description: t('landing.featureInteractiveDesc')
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: t('landing.featureBuilderTitle'),
      description: t('landing.featureBuilderDesc')
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: t('landing.featureMultiTenantTitle'),
      description: t('landing.featureMultiTenantDesc')
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: t('landing.featureAnalyticsTitle'),
      description: t('landing.featureAnalyticsDesc')
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: t('landing.featureEmbeddableTitle'),
      description: t('landing.featureEmbeddableDesc')
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: t('landing.featurePrivacyTitle'),
      description: t('landing.featurePrivacyDesc')
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-primary" />
            <span className="text-xl font-heading font-bold">InterGuide</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="ghost" data-testid="nav-login-button">{t('common.login')}</Button>
            </Link>
            <Link to="/signup">
              <Button data-testid="nav-signup-button">{t('portal.getStarted')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl lg:text-6xl font-heading font-bold text-slate-900 mb-6 tracking-tight">
              {t('landing.heroTitle')}
              <span className="text-primary block mt-2">{t('landing.heroSubtitle')}</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              {t('landing.heroDescription')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="rounded-full px-8" data-testid="hero-get-started-button">
                  {t('landing.getStartedFree')}
                </Button>
              </Link>
              <Button size="lg" variant="secondary" className="rounded-full px-8" data-testid="hero-view-demo-button">
                {t('landing.viewDemo')}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-heading font-bold text-slate-900 mb-4">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-lg text-slate-600">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass rounded-xl p-6 hover:shadow-soft-lg transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-12 text-center"
          >
            <h2 className="text-4xl font-heading font-bold text-slate-900 mb-4">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              {t('landing.ctaDescription')}
            </p>
            <Link to="/signup">
              <Button size="lg" className="rounded-full px-8" data-testid="cta-get-started-button">
                {t('landing.startBuildingNow')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-bold text-white">InterGuide</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mb-6 text-sm">
            <Link to="/terms" className="text-slate-300 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-slate-300 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/billing-policy" className="text-slate-300 hover:text-white transition-colors">
              Subscription & Billing Policy
            </Link>
          </div>
          <p className="text-center">{t('landing.copyright')}</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;