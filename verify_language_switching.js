const fs = require('fs');

function checkLanguageSwitching() {
  console.log('=== LANGUAGE SWITCHING CHECK ===');
  
  // Check i18n config for proper language switching
  const configPath = 'frontend/src/i18n/config.js';
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  let issues = [];
  
  // Check for language change handler
  if (!configContent.includes('languageChanged')) {
    issues.push('Missing languageChanged event handler');
  }
  
  // Check for localStorage persistence
  if (!configContent.includes('localStorage.setItem')) {
    issues.push('Missing localStorage persistence for language');
  }
  
  // Check for direction handling
  if (!configContent.includes('document.documentElement.setAttribute')) {
    issues.push('Missing document direction updates');
  }
  
  // Check for proper fallback
  if (!configContent.includes('fallbackLng')) {
    issues.push('Missing fallback language configuration');
  }
  
  // Check for proper initialization
  if (!configContent.includes('getSavedLanguage')) {
    issues.push('Missing saved language retrieval on init');
  }
  
  // Check for language switcher component
  const switcherPath = 'frontend/src/components/LanguageSwitcher.jsx';
  if (fs.existsSync(switcherPath)) {
    const switcherContent = fs.readFileSync(switcherPath, 'utf8');
    
    if (!switcherContent.includes('i18n.changeLanguage')) {
      issues.push('LanguageSwitcher missing i18n.changeLanguage call');
    }
    
    if (!switcherContent.includes('useTranslation')) {
      issues.push('LanguageSwitcher not using useTranslation hook');
    }
  } else {
    issues.push('LanguageSwitcher component not found');
  }
  
  // Check for proper language detection
  if (!configContent.includes('lng: getSavedLanguage()')) {
    issues.push('Missing proper language initialization');
  }
  
  if (issues.length > 0) {
    console.log('❌ Language switching issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  }
  
  console.log('✅ Language switching checks passed');
  return true;
}

const switching = checkLanguageSwitching();
process.exit(switching ? 0 : 1);
