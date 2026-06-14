const fs = require('fs');

const files = [
  'android/app/(tabs)/index.tsx',
  'android/app/(tabs)/voucher.tsx',
  'android/app/(tabs)/member.tsx',
  'android/app/(tabs)/router.tsx',
  'android/app/settings.tsx',
  'android/app/(tabs)/_layout.tsx',
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import { useColorScheme }')) {
    content = "import { useColorScheme } from 'react-native';\nimport Colors from '@/constants/Colors';\n" + content;
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed imports in ${file}`);
  }
});
