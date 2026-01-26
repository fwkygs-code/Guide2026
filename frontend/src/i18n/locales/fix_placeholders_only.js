const fs = require('fs');

// Fix ONLY the malformed placeholders as requested
// Replace {,type}} with {{type}}
// Replace any other malformed patterns

// Fix en.json
const enContent = fs.readFileSync('en.json', 'utf8');
let enFixed = enContent;

// Fix the specific malformed placeholder
enFixed = enFixed.replace(/\{,type\}\}/g, '{{type}}');

// Fix any other similar malformed patterns
enFixed = enFixed.replace(/\{,(\w+)\}\}/g, '{{$1}}');

fs.writeFileSync('en.json', enFixed);
console.log('Fixed en.json malformed placeholders only');

// Fix he.json
const heContent = fs.readFileSync('he.json', 'utf8');
let heFixed = heContent;

// Fix the specific malformed placeholder
heFixed = heFixed.replace(/\{,type\}\}/g, '{{type}}');

// Fix any other similar malformed patterns
heFixed = heFixed.replace(/\{,(\w+)\}\}/g, '{{$1}}');

fs.writeFileSync('he.json', heFixed);
console.log('Fixed he.json malformed placeholders only');
