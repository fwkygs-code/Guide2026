const fs = require('fs');

// Load the translation files
const en = JSON.parse(fs.readFileSync('./frontend/src/i18n/locales/en.json', 'utf8'));
const he = JSON.parse(fs.readFileSync('./frontend/src/i18n/locales/he.json', 'utf8'));

// Test the specific keys that are showing as raw text
const testKeys = [
  'portal.privacy.informationWeCollect.youProvide.items[0]',
  'portal.privacy.informationWeCollect.youProvide.items[1]',
  'portal.privacy.informationWeCollect.youProvide.items[2]',
  'portal.privacy.informationWeCollect.youProvide.items[3]',
  'portal.privacy.informationWeCollect.youProvide.contentItems[0]',
  'portal.privacy.informationWeCollect.youProvide.contentItems[1]',
  'portal.privacy.informationWeCollect.youProvide.contentItems[2]',
  'portal.privacy.informationWeCollect.automaticallyCollected.items[0]',
  'portal.privacy.informationWeCollect.automaticallyCollected.items[1]',
  'portal.privacy.informationWeCollect.automaticallyCollected.items[2]',
  'portal.privacy.informationWeCollect.automaticallyCollected.items[3]',
  'portal.privacy.cookies.items[0]',
  'portal.privacy.cookies.items[1]',
  'portal.privacy.cookies.items[2]',
  'portal.privacy.cookies.items[3]'
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (key.includes('[') && key.includes(']')) {
      const arrayKey = key.split('[')[0];
      const index = parseInt(key.split('[')[1].split(']')[0]);
      return current[arrayKey][index];
    }
    return current[key];
  }, obj);
}

console.log('Testing translation keys...\n');

testKeys.forEach(key => {
  try {
    const enValue = getNestedValue(en, key);
    const heValue = getNestedValue(he, key);
    console.log(`${key}:`);
    console.log(`  EN: ${enValue}`);
    console.log(`  HE: ${heValue}`);
    console.log('');
  } catch (error) {
    console.log(`${key}: ERROR - ${error.message}`);
    console.log('');
  }
});
