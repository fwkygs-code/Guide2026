const fs = require('fs');
const path = require('path');

function findDuplicates(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const obj = JSON.parse(content);
  const keys = [];
  const duplicates = [];
  
  function traverse(obj, path = '') {
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;
      if (keys.includes(fullPath)) {
        duplicates.push(fullPath);
      } else {
        keys.push(fullPath);
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        traverse(obj[key], fullPath);
      }
    }
  }
  
  traverse(obj);
  return duplicates;
}

const enPath = path.join(__dirname, 'frontend/src/i18n/locales/en.json');
const hePath = path.join(__dirname, 'frontend/src/i18n/locales/he.json');

const enDuplicates = findDuplicates(enPath);
const heDuplicates = findDuplicates(hePath);

console.log('English duplicates:', enDuplicates.length > 0 ? enDuplicates : 'None');
console.log('Hebrew duplicates:', heDuplicates.length > 0 ? heDuplicates : 'None');

if (enDuplicates.length === 0 && heDuplicates.length === 0) {
  console.log('✅ NO DUPLICATES FOUND');
} else {
  console.log('❌ DUPLICATES EXIST');
  process.exit(1);
}
