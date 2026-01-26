/**
 * Translation Enforcement Utilities
 * 
 * Architectural enforcement: Make missing translations visible immediately in development.
 * Prevent untranslated text from reaching production.
 */

import { toast } from 'sonner';

/**
 * Enhanced translation function with dev-mode enforcement
 * 
 * Wraps i18next's t() to detect and warn about missing translations
 * 
 * @param {function} t - Original i18next t function
 * @param {string} key - Translation key
 * @param {object} options - Translation options
 * @param {string} currentLanguage - Current language code
 * @returns {string} Translated text or warning
 */
export function enforceTranslation(t, key, options = {}, currentLanguage = 'en') {
  const translated = t(key, { ...options, defaultValue: null });
  
  // Check if translation is missing
  const isMissing = translated === null || translated === key;
  
  if (isMissing && process.env.NODE_ENV === 'development') {
    console.error(`[Translation Missing] Key: "${key}", Language: "${currentLanguage}"`);
    
    // Show visual warning in dev mode
    if (typeof window !== 'undefined') {
      toast.error(`Missing translation: ${key}`, {
        duration: 5000,
        description: `Language: ${currentLanguage}`
      });
    }
    
    // Return a visible error marker
    return `⚠️ MISSING: ${key}`;
  }
  
  // Check if English is showing in non-English locale (fallback detection)
  if (currentLanguage !== 'en' && !isMissing) {
    // Simple heuristic: if translation contains common English words, it might be a fallback
    const englishIndicators = ['the', 'and', 'or', 'is', 'are', 'was', 'were', 'have', 'has'];
    const words = translated.toLowerCase().split(/\s+/);
    const hasEnglishWords = words.some(word => englishIndicators.includes(word));
    
    if (hasEnglishWords && process.env.NODE_ENV === 'development') {
      console.warn(`[Possible Fallback] Key: "${key}" may be showing English in ${currentLanguage}:`, translated);
    }
  }
  
  return translated || key;
}

/**
 * Validate translation key exists before rendering
 * 
 * Use in components to fail fast if translation key is invalid
 * 
 * @param {function} t - i18next t function
 * @param {string} key - Translation key to validate
 * @throws {Error} In development if key is missing
 */
export function validateTranslationKey(t, key) {
  if (process.env.NODE_ENV === 'development') {
    const exists = t(key, { defaultValue: null }) !== null;
    if (!exists) {
      throw new Error(`Translation key does not exist: "${key}"`);
    }
  }
}

/**
 * Block registry validation
 * 
 * Ensures all block types have corresponding translation keys
 * 
 * @param {function} t - i18next t function
 * @param {array} blockTypes - Array of block type identifiers
 * @param {string} keyPrefix - Translation key prefix (e.g., 'builder.blocks')
 */
export function validateBlockRegistry(t, blockTypes, keyPrefix = 'builder.blocks') {
  if (process.env.NODE_ENV === 'development') {
    const missing = [];
    
    blockTypes.forEach(type => {
      const key = `${keyPrefix}.${type}`;
      const translated = t(key, { defaultValue: null });
      
      if (translated === null) {
        missing.push(key);
      }
    });
    
    if (missing.length > 0) {
      console.error('[Block Registry] Missing translations:', missing);
      toast.error(`Missing block translations: ${missing.length} keys`, {
        description: missing.join(', ')
      });
    }
  }
}

/**
 * Prevent hardcoded strings in production
 * 
 * Runtime check to ensure no raw English strings are rendered
 * Only runs in development to avoid performance impact
 */
export function detectHardcodedStrings() {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // Check for common English patterns in rendered text
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            
            // Skip empty, numeric, or very short text
            if (!text || text.length < 3 || /^\d+$/.test(text)) return;
            
            // Check for suspicious English patterns
            const suspiciousPatterns = [
              /^(Delete|Remove|Cancel|Confirm|Save|Edit|Create|Update)\s/i,
              /^Are you sure/i,
              /^Step \d+$/,
              /^Slide \d+$/
            ];
            
            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(text));
            
            if (isSuspicious) {
              console.warn('[Hardcoded String Detected]', text, node.parentElement);
            }
          }
        });
      });
    });
    
    // Observe body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return () => observer.disconnect();
  }
}

/**
 * Translation coverage report
 * 
 * Generate a report of translation coverage for all registered keys
 * Useful for auditing translation completeness
 */
export function generateTranslationCoverageReport(i18n) {
  if (process.env.NODE_ENV === 'development') {
    const languages = Object.keys(i18n.store.data);
    const report = {};
    
    languages.forEach(lang => {
      const keys = flattenKeys(i18n.store.data[lang]);
      report[lang] = {
        totalKeys: keys.length,
        keys: keys
      };
    });
    
    console.table(report);
    return report;
  }
}

/**
 * Flatten nested translation keys for analysis
 */
function flattenKeys(obj, prefix = '') {
  let keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(flattenKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

export default {
  enforceTranslation,
  validateTranslationKey,
  validateBlockRegistry,
  detectHardcodedStrings,
  generateTranslationCoverageReport
};
