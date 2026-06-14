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
  content = content.replace(/Colors\[colorScheme \?\? 'light'\]/g, "Colors[colorScheme === 'dark' ? 'dark' : 'light']");
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed TS Error in ${file}`);
});
