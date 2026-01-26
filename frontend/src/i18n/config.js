import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import heTranslations from './locales/he.json';

// Get saved language from localStorage or default to English
const getSavedLanguage = () => {
  const saved = localStorage.getItem('i18nextLng');
  if (saved && ['en', 'he'].includes(saved)) {
    return saved;
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      he: {
        translation: heTranslations,
      },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Avoid suspense for better compatibility
    },
    // Development-mode enforcement: Detect missing translations
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[i18n] Missing translation key: "${key}" for languages: ${lngs.join(', ')}`);
      }
    },
    // Prevent fallback to key name in development
    returnNull: process.env.NODE_ENV === 'development',
    returnEmptyString: false,
  });

// Update document direction when language changes
i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', lng === 'he' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lng);
  localStorage.setItem('i18nextLng', lng);
});

// Set initial direction
document.documentElement.setAttribute('dir', i18n.language === 'he' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;
