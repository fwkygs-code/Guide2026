const fs = require('fs');

// Fix en.json - replace unescaped double quotes inside string values with single quotes
const enContent = fs.readFileSync('en.json', 'utf8');
// Only replace double quotes that are inside string values (not the JSON structure quotes)
// This regex finds double quotes that are inside string values but not the structural quotes
const enFixed = enContent.replace(/"([^"]*)"([^"]*)"([^"]*)"/g, (match, before, quote, after) => {
  // If this looks like an internal quote in a string, replace it
  if (before && after) {
    return `"${before}'${after}"`;
  }
  return match;
});

// More targeted approach: find patterns like word"word and change to word'word
const enFixed2 = enFixed.replace(/\w"\w/g, (match) => match.replace('"', "'"));

fs.writeFileSync('en.json', enFixed2);
console.log('Fixed en.json internal quotes');

// Fix he.json - replace unescaped double quotes inside string values with single quotes
const heContent = fs.readFileSync('he.json', 'utf8');
const heFixed2 = heContent.replace(/\w"\w/g, (match) => match.replace('"', "'"));

fs.writeFileSync('he.json', heFixed2);
console.log('Fixed he.json internal quotes');
