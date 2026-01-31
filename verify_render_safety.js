const fs = require('fs');

function checkRenderSafety() {
  console.log('=== RENDER SAFETY CHECK ===');
  
  // Check for useTranslation without ready check
  const files = [
    'frontend/src/procedure-system/EditorRoot.tsx',
    'frontend/src/faq-system/EditorRoot.tsx', 
    'frontend/src/decision-tree-system/EditorRoot.tsx',
    'frontend/src/documentation-system/EditorRoot.tsx',
    'frontend/src/policy-system/EditorRoot.tsx'
  ];
  
  let issues = [];
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for proper namespace usage
      if (content.includes("useTranslation()")) {
        issues.push(`${file}: useTranslation() without explicit namespaces`);
      }
      
      // Check for render guards
      if (content.includes('if (loading') && !content.includes('!draft') && !content.includes('!meta')) {
        issues.push(`${file}: Loading check without data validation`);
      }
      
      // Check for missing i18n ready checks in components that use translations
      if (content.includes('t(') && !content.includes('ready') && !content.includes('loading')) {
        issues.push(`${file}: Translation usage without readiness check`);
      }
    }
  });
  
  // Check for missing keys in translations
  const enContent = fs.readFileSync('frontend/src/i18n/locales/en.json', 'utf8');
  const enTranslations = JSON.parse(enContent);
  
  // Check for empty string values
  const emptyKeys = findEmptyValues(enTranslations);
  if (emptyKeys.length > 0) {
    issues.push(`Empty translation values: ${emptyKeys.slice(0, 5).join(', ')}`);
  }
  
  if (issues.length > 0) {
    console.log('❌ Render safety issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  }
  
  console.log('✅ Render safety checks passed');
  return true;
}

function findEmptyValues(obj, prefix = '') {
  const empty = [];
  
  for (const key in obj) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      empty.push(...findEmptyValues(obj[key], fullPath));
    } else if (obj[key] === '' || obj[key] === null) {
      empty.push(fullPath);
    }
  }
  
  return empty;
}

const safe = checkRenderSafety();
process.exit(safe ? 0 : 1);
