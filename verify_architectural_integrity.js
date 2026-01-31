const fs = require('fs');

function checkArchitecturalIntegrity() {
  console.log('=== ARCHITECTURAL INTEGRITY CHECK ===');
  
  let issues = [];
  
  // Check that Policies are untouched
  const policyFiles = [
    'memory/PRD.md',
    'frontend/src/policy-system/EditorRoot.tsx',
    'frontend/src/knowledge-systems/policy-system/ui.tsx'
  ];
  
  policyFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for unauthorized changes to policy system
      if (content.includes('useTranslation()') && !content.includes('knowledgeSystems')) {
        issues.push(`${file}: Policy system using generic translation namespace`);
      }
    }
  });
  
  // Check for shared generic abstractions
  const sharedFiles = [
    'frontend/src/utils/translationEnforcement.js',
    'frontend/src/hooks/useTranslationEnforcement.js'
  ];
  
  sharedFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if these are being used inappropriately
      if (content.includes('export') && content.includes('generic')) {
        issues.push(`${file}: Contains shared generic abstraction`);
      }
    }
  });
  
  // Check system independence
  const systems = [
    'procedure-system',
    'faq-system', 
    'decision-tree-system',
    'documentation-system',
    'policy-system'
  ];
  
  systems.forEach(system => {
    const editorPath = `frontend/src/${system}/EditorRoot.tsx`;
    if (fs.existsSync(editorPath)) {
      const content = fs.readFileSync(editorPath, 'utf8');
      
      // Each system should use its own namespace
      if (!content.includes('knowledgeSystems')) {
        issues.push(`${system}: Not using proper knowledgeSystems namespace`);
      }
      
      // Check for cross-system dependencies
      systems.forEach(otherSystem => {
        if (system !== otherSystem && content.includes(otherSystem)) {
          issues.push(`${system}: Has dependency on ${otherSystem}`);
        }
      });
    }
  });
  
  // Check for proper namespace isolation
  const configPath = 'frontend/src/i18n/config.js';
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (!configContent.includes('knowledgeSystems:')) {
    issues.push('Missing knowledgeSystems namespace in i18n config');
  }
  
  if (!configContent.includes('portal:')) {
    issues.push('Missing portal namespace in i18n config');
  }
  
  if (!configContent.includes('common:')) {
    issues.push('Missing common namespace in i18n config');
  }
  
  // Verify no generic abstractions were introduced
  const srcFiles = getAllFiles('frontend/src', ['.js', '.jsx', '.ts', '.tsx']);
  
  srcFiles.forEach(file => {
    if (file.includes('translation') && !file.includes('i18n')) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for generic translation helpers
      if (content.includes('function translate') || content.includes('const translate')) {
        issues.push(`${file}: Contains generic translation helper`);
      }
    }
  });
  
  if (issues.length > 0) {
    console.log('❌ Architectural integrity issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  }
  
  console.log('✅ Architectural integrity checks passed');
  return true;
}

function getAllFiles(dir, extensions, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = `${dir}/${item}`;
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, extensions, files);
    } else {
      const ext = `.${item.split('.').pop()}`;
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

const integrity = checkArchitecturalIntegrity();
process.exit(integrity ? 0 : 1);
