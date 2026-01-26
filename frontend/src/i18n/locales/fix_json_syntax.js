const fs = require('fs');

// Fix en.json - only fix the JSON syntax error, not placeholders
const enContent = fs.readFileSync('en.json', 'utf8');
// Fix the specific }{ pattern that breaks JSON
const enFixed = enContent.replace(/}\s*{\s*"(notifications|empty|admin)":/g, '},\n  "$1":');
fs.writeFileSync('en.json', enFixed);
console.log('Fixed en.json JSON syntax only');

// Fix he.json - only fix the JSON syntax error
const heContent = fs.readFileSync('he.json', 'utf8');
// Fix the specific }{ pattern that breaks JSON
const heFixed = heContent.replace(/}\s*{\s*"(notifications|empty|admin)":/g, '},\n  "$1":');
fs.writeFileSync('he.json', heFixed);
console.log('Fixed he.json JSON syntax only');

// Now fix the malformed placeholders
const enContent2 = fs.readFileSync('en.json', 'utf8');
const enFixed2 = enContent2.replace(/\{,type\}\}/g, '{{type}}');
fs.writeFileSync('en.json', enFixed2);
console.log('Fixed en.json placeholders');

const heContent2 = fs.readFileSync('he.json', 'utf8');
const heFixed2 = heContent2.replace(/\{,type\}\}/g, '{{type}}');
fs.writeFileSync('he.json', heFixed2);
console.log('Fixed he.json placeholders');
