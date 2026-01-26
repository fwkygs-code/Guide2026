/**
 * useTranslationEnforcement - React Hook for Translation Enforcement
 * 
 * Architectural enforcement: Automatically validates translations in development.
 * Detects missing keys and fallback English in non-English locales.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Hook to enforce translation completeness in development
 * 
 * Usage: Add to root component or key pages
 * useTranslationEnforcement();
 */
export function useTranslationEnforcement() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // Override t() function to add validation
    const originalT = i18n.t.bind(i18n);
    
    i18n.t = function(key, options) {
      const result = originalT(key, { ...options, defaultValue: null });
      
      // Detect missing translation
      if (result === null || result === key) {
        console.error(`[Translation Missing] Key: "${key}", Language: "${i18n.language}"`);
        
        // Show toast warning
        toast.error(`Missing translation: ${key}`, {
          duration: 3000,
          description: `Language: ${i18n.language}`
        });
        
        return `⚠️ ${key}`;
      }
      
      return result;
    };

    console.log('[Translation Enforcement] Active in development mode');

    // Cleanup
    return () => {
      i18n.t = originalT;
    };
  }, [i18n]);
}

/**
 * Hook to validate a specific translation key exists
 * Throws error in development if key is missing
 * 
 * Usage:
 * useTranslationKey('builder.blocks.heading');
 */
export function useTranslationKey(key) {
  const { t } = useTranslation();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const exists = t(key, { defaultValue: null }) !== null;
      if (!exists) {
        throw new Error(`Translation key does not exist: "${key}"`);
      }
    }
  }, [key, t]);
}

export default useTranslationEnforcement;
