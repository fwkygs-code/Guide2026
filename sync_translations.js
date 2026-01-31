const fs = require('fs');

function syncTranslations() {
  const enContent = fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8');
  const heContent = fs.readFileSync('frontend/src/i18n/locales/he.json', 'utf8');
  
  const enTranslations = JSON.parse(enContent);
  const heTranslations = JSON.parse(heContent);
  
  // Create a new English structure with all Hebrew keys
  const syncedEn = {};
  
  function copyKeys(source, target, path = '') {
    for (const key in source) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key]) target[key] = {};
        copyKeys(source[key], target[key], fullPath);
      } else {
        // Copy the key structure with placeholder value
        target[key] = source[key];
      }
    }
  }
  
  // Copy all Hebrew structure to English
  copyKeys(heTranslations, syncedEn);
  
  // Preserve existing English translations where they exist
  function preserveExisting(source, target) {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key]) target[key] = {};
        preserveExisting(source[key], target[key]);
      } else {
        if (target[key] && typeof target[key] === 'string') {
          // Keep existing English translation
          target[key] = source[key];
        }
      }
    }
  }
  
  preserveExisting(enTranslations, syncedEn);
  
  // Write the synced English file
  fs.writeFileSync('frontend/src/i18n/locales/en.json', JSON.stringify(syncedEn, null, 2));
  
  console.log('✅ Translations synced - English now has all keys from Hebrew');
  console.log('Existing English translations preserved where available');
}

syncTranslations();
