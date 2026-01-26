const fs = require('fs');

// Fix ONLY specific problematic quote patterns inside string values
// Very targeted approach - only change known problematic patterns

const enContent = fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8');
let enFixed = enContent;

// Fix specific patterns like you"l -> you'll
enFixed = enFixed.replace(/you"l/g, "you'll");
enFixed = enFixed.replace(/won"t/g, "won't");
enFixed = enFixed.replace(/don"t/g, "don't");
enFixed = enFixed.replace(/can"t/g, "can't");
enFixed = enFixed.replace(/didn"t/g, "didn't");
enFixed = enFixed.replace(/doesn"t/g, "doesn't");
enFixed = enFixed.replace(/isn"t/g, "isn't");
enFixed = enFixed.replace(/aren"t/g, "aren't");
enFixed = enFixed.replace(/wasn"t/g, "wasn't");
enFixed = enFixed.replace(/weren"t/g, "weren't");
enFixed = enFixed.replace(/haven"t/g, "haven't");
enFixed = enFixed.replace(/hasn"t/g, "hasn't");
enFixed = enFixed.replace(/hadn"t/g, "hadn't");
enFixed = enFixed.replace(/couldn"t/g, "couldn't");
enFixed = enFixed.replace(/wouldn"t/g, "wouldn't");
enFixed = enFixed.replace(/shouldn"t/g, "shouldn't");
enFixed = enFixed.replace(/mightn"t/g, "mightn't");
enFixed = enFixed.replace(/mustn"t/g, "mustn't");

fs.writeFileSync('frontend/src/i18n/locales/en.json', enFixed);
console.log('Fixed en.json specific quote patterns');

// Same for he.json
const heContent = fs.readFileSync('frontend/src/i18n/locales/he.json', 'utf8');
let heFixed = heContent;

heFixed = heFixed.replace(/you"l/g, "you'll");
heFixed = heFixed.replace(/won"t/g, "won't");
heFixed = heFixed.replace(/don"t/g, "don't");
heFixed = heFixed.replace(/can"t/g, "can't");
heFixed = heFixed.replace(/didn"t/g, "didn't");
heFixed = heFixed.replace(/doesn"t/g, "doesn't");
heFixed = heFixed.replace(/isn"t/g, "isn't");
heFixed = heFixed.replace(/aren"t/g, "aren't");
heFixed = heFixed.replace(/wasn"t/g, "wasn't");
heFixed = heFixed.replace(/weren"t/g, "weren't");
heFixed = heFixed.replace(/haven"t/g, "haven't");
heFixed = heFixed.replace(/hasn"t/g, "hasn't");
heFixed = heFixed.replace(/hadn"t/g, "hadn't");
heFixed = heFixed.replace(/couldn"t/g, "couldn't");
heFixed = heFixed.replace(/wouldn"t/g, "wouldn't");
heFixed = heFixed.replace(/shouldn"t/g, "shouldn't");
heFixed = heFixed.replace(/mightn"t/g, "mightn't");
heFixed = heFixed.replace(/mustn"t/g, "mustn't");

fs.writeFileSync('frontend/src/i18n/locales/he.json', heFixed);
console.log('Fixed he.json specific quote patterns');
