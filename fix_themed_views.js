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
  
  // Remove the Themed import completely
  content = content.replace(/import \{ Text, View \} from '@\/components\/Themed';\n?/g, '');
  
  // Add Text, View to react-native import
  // Find "import { ..., ..., ... } from 'react-native';"
  content = content.replace(/import \{(.*?)\} from 'react-native';/g, (match, p1) => {
    let imports = p1.split(',').map(s => s.trim());
    if (!imports.includes('Text')) imports.push('Text');
    if (!imports.includes('View')) imports.push('View');
    return `import { ${imports.join(', ')} } from 'react-native';`;
  });

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed Themed Views in ${file}`);
});
