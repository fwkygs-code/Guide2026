const fs = require('fs');

// Fix ONLY internal quotes in string values, not JSON structure quotes
// Pattern: find quotes inside string values (between " and ") and change them to single quotes

function fixInternalQuotes(content) {
  let result = '';
  let inString = false;
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    
    if (char === '"' && (i === 0 || content[i-1] === ',' || content[i-1] === '{' || content[i-1] === '[' || content[i-1] === ':')) {
      // This is a structural quote (start of string value)
      inString = true;
      result += char;
    } else if (char === '"' && inString && (i === content.length - 1 || content[i+1] === ',' || content[i+1] === '}' || content[i+1] === ']' || content[i+1] === '\n')) {
      // This is a structural quote (end of string value)
      inString = false;
      result += char;
    } else if (char === '"' && inString) {
      // This is an internal quote inside a string value - change to single quote
      result += "'";
    } else {
      result += char;
    }
    i++;
  }
  
  return result;
}

// Fix en.json
const enContent = fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8');
const enFixed = fixInternalQuotes(enContent);
fs.writeFileSync('frontend/src/i18n/locales/en.json', enFixed);
console.log('Fixed en.json internal quotes only');

// Fix he.json
const heContent = fs.readFileSync('frontend/src/i18n/locales/he.json', 'utf8');
const heFixed = fixInternalQuotes(heContent);
fs.writeFileSync('frontend/src/i18n/locales/he.json', heFixed);
console.log('Fixed he.json internal quotes only');
