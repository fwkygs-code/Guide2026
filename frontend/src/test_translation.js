const fs = require('fs');
const content = fs.readFileSync('./i18n/locales/he.json', 'utf8');
const heLocale = JSON.parse(content);
console.log('Translation key exists:', heLocale.categories && heLocale.categories.addSubCategory);
console.log('Translation key value:', heLocale.categories?.addSubCategory);
