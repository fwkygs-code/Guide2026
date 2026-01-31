const fs = require('fs');

function validateJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`✅ ${filePath} - Valid JSON`);
    return true;
  } catch (error) {
    console.log(`❌ ${filePath} - Invalid JSON: ${error.message}`);
    return false;
  }
}

const enValid = validateJSON('frontend/src/i18n/locales/en.json');
const heValid = validateJSON('frontend/src/i18n/locales/he.json');

if (!enValid || !heValid) {
  process.exit(1);
}
