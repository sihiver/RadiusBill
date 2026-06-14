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
  
  // Split content at StyleSheet.create
  const parts = content.split('StyleSheet.create({');
  if (parts.length > 1) {
    let top = parts[0];
    let bottom = parts[1];
    
    // In the bottom part (inside StyleSheet.create), revert colors.* to dummy values or just remove them.
    // The inline styles in JSX will override them anyway.
    bottom = bottom.replace(/colors\.textSecondary/g, "'#64748b'");
    bottom = bottom.replace(/colors\.text/g, "'#1e293b'");
    bottom = bottom.replace(/colors\.card/g, "'#fff'");
    bottom = bottom.replace(/colors\.background/g, "'#f1f5f9'");
    bottom = bottom.replace(/colors\.border/g, "'#e2e8f0'");
    
    content = top + 'StyleSheet.create({' + bottom;
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed StyleSheet in ${file}`);
  }
});
