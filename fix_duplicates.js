const fs = require('fs');

const files = [
  'android/app/(tabs)/index.tsx',
  'android/app/(tabs)/voucher.tsx',
  'android/app/(tabs)/member.tsx',
  'android/app/(tabs)/router.tsx',
  'android/app/settings.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find all 'react-native' imports
  const regex = /import\s+\{([^}]+)\}\s+from\s+'react-native';/g;
  let match;
  let allImports = new Set();
  
  while ((match = regex.exec(content)) !== null) {
    const items = match[1].split(',').map(i => i.trim()).filter(Boolean);
    items.forEach(item => allImports.add(item));
  }
  
  if (allImports.size > 0) {
    // Remove all existing 'react-native' imports
    content = content.replace(/import\s+\{[^}]+\}\s+from\s+'react-native';[\r\n]*/g, '');
    
    // Create new single import
    const newImport = `import { ${Array.from(allImports).join(', ')} } from 'react-native';\n`;
    
    // Add it after the first import or at the top
    content = newImport + content;
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Deduplicated imports in ${file}`);
  }
});
