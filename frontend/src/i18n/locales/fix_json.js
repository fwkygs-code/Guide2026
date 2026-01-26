const fs = require('fs');

try {
  const content = fs.readFileSync('en.json', 'utf8');
  console.log('Original file length:', content.length);
  
  // Fix the double brace issue around notifications
  const fixed = content.replace(/},\s*{\s*"notifications":/g, '},\n  "notifications":');
  
  fs.writeFileSync('en.json', fixed);
  console.log('Fixed JSON structure');
  
  // Verify it's valid
  JSON.parse(fixed);
  console.log('✅ en.json is now valid');
} catch(e) {
  console.log('❌ Error:', e.message);
}
