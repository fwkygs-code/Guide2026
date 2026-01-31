const fs = require('fs');

function checkTranslationIntegrity() {
  const enContent = fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8');
  const heContent = fs.readFileSync('frontend/src/i18n/locales/he.json', 'utf8');
  
  const enTranslations = JSON.parse(enContent);
  const heTranslations = JSON.parse(heContent);
  
  const enKeys = getAllKeys(enTranslations);
  const heKeys = getAllKeys(heTranslations);
  
  const missingInHe = enKeys.filter(key => !heKeys.includes(key));
  const missingInEn = heKeys.filter(key => !enKeys.includes(key));
  
  console.log('=== TRANSLATION INTEGRITY CHECK ===');
  console.log(`English keys: ${enKeys.length}`);
  console.log(`Hebrew keys: ${heKeys.length}`);
  
  if (missingInHe.length > 0) {
    console.log(`❌ Missing in Hebrew (${missingInHe.length}):`);
    missingInHe.slice(0, 10).forEach(key => console.log(`  - ${key}`));
    if (missingInHe.length > 10) console.log(`  ... and ${missingInHe.length - 10} more`);
  }
  
  if (missingInEn.length > 0) {
    console.log(`❌ Missing in English (${missingInEn.length}):`);
    missingInEn.slice(0, 10).forEach(key => console.log(`  - ${key}`));
    if (missingInEn.length > 10) console.log(`  ... and ${missingInEn.length - 10} more`);
  }
  
  if (missingInHe.length === 0 && missingInEn.length === 0) {
    console.log('✅ All translation keys match between languages');
    return true;
  }
  
  return false;
}

function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

const integrity = checkTranslationIntegrity();
process.exit(integrity ? 0 : 1);
