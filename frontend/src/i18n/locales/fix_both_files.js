const fs = require('fs');

function fixJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\nProcessing ${filePath}:`);
    console.log(`Original length: ${content.length}`);
    
    // Fix the common JSON syntax issues
    let fixed = content
      // Fix double brace issue before notifications
      .replace(/}\s*{\s*"notifications":/g, '},\n  "notifications":')
      // Fix any other similar patterns
      .replace(/}\s*{\s*"/g, '},\n  "')
      // Remove any trailing commas before closing braces
      .replace(/,\s*}/g, '\n  }')
      // Fix any malformed comma patterns
      .replace(/,(\s*),/g, ',$1');
    
    fs.writeFileSync(filePath, fixed);
    console.log(`Fixed length: ${fixed.length}`);
    
    // Verify it's valid
    JSON.parse(fixed);
    console.log(`✅ ${filePath} is now valid`);
    return true;
  } catch(e) {
    console.log(`❌ ${filePath} error: ${e.message}`);
    return false;
  }
}

// Fix both files
const enValid = fixJsonFile('en.json');
const heValid = fixJsonFile('he.json');

if (enValid && heValid) {
  console.log('\n✅ Both files are now valid JSON');
} else {
  console.log('\n❌ Some files still have issues');
}
