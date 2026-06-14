const fs = require('fs');
const path = require('path');

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
  
  // Ensure useColorScheme and Colors are imported
  if (!content.includes('useColorScheme')) {
    content = content.replace("import React", "import { useColorScheme } from 'react-native';\nimport Colors from '@/constants/Colors';\nimport React");
  } else if (!content.includes('Colors from')) {
    content = content.replace("import { useColorScheme }", "import { useColorScheme } from 'react-native';\nimport Colors from '@/constants/Colors';\n//");
  }

  // Find the main component function declaration to inject colors
  // E.g. export default function DashboardScreen() {
  content = content.replace(/export default function \w+\(.*\) \{/, match => {
    return `${match}\n  const colorScheme = useColorScheme();\n  const colors = Colors[colorScheme ?? 'light'];`;
  });

  // Now replace hardcoded styles with dynamic ones where applicable
  // For container:
  content = content.replace(/style=\{styles\.container\}/g, "style={[styles.container, { backgroundColor: colors.background }]}");
  // For cards:
  content = content.replace(/style=\{styles\.card\}/g, "style={[styles.card, { backgroundColor: colors.card }]}");
  content = content.replace(/style=\{styles\.fullCard\}/g, "style={[styles.fullCard, { backgroundColor: colors.card }]}");
  content = content.replace(/style=\{styles\.statCard\}/g, "style={[styles.statCard, { backgroundColor: colors.card }]}");
  
  // For list items:
  content = content.replace(/style=\{styles\.listItem\}/g, "style={[styles.listItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}");
  content = content.replace(/style=\{styles\.itemCard\}/g, "style={[styles.itemCard, { backgroundColor: colors.card }]}");
  content = content.replace(/style=\{styles\.deviceItem\}/g, "style={[styles.deviceItem, { backgroundColor: colors.card }]}");

  // For text:
  content = content.replace(/style=\{styles\.pageTitle\}/g, "style={[styles.pageTitle, { color: colors.text }]}");
  content = content.replace(/style=\{styles\.cardTitle\}/g, "style={[styles.cardTitle, { color: colors.text }]}");
  content = content.replace(/style=\{styles\.statValue\}/g, "style={[styles.statValue, { color: colors.text }]}");
  content = content.replace(/style=\{styles\.itemTitle\}/g, "style={[styles.itemTitle, { color: colors.text }]}");
  content = content.replace(/style=\{styles\.itemDesc\}/g, "style={[styles.itemDesc, { color: colors.textSecondary }]}");
  content = content.replace(/style=\{styles\.label\}/g, "style={[styles.label, { color: colors.textSecondary }]}");

  // Modals/Headers:
  content = content.replace(/backgroundColor: 'white'/g, "backgroundColor: colors.card");
  content = content.replace(/backgroundColor: '#fff'/g, "backgroundColor: colors.card");
  content = content.replace(/color: '#334155'/g, "color: colors.text");
  content = content.replace(/color: '#1e293b'/g, "color: colors.text");
  content = content.replace(/color: '#64748b'/g, "color: colors.textSecondary");
  content = content.replace(/borderBottomColor: '#f1f5f9'/g, "borderBottomColor: colors.border");
  content = content.replace(/borderBottomColor: '#e2e8f0'/g, "borderBottomColor: colors.border");

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Patched ${file}`);
});
