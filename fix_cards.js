const fs = require('fs');

const files = [
  'android/app/(tabs)/router.tsx',
  'android/app/(tabs)/member.tsx',
  'android/app/(tabs)/voucher.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/<View style=\{styles\.itemCard\}>/g, "<View style={[styles.itemCard, { backgroundColor: colors.card }]}>");
  content = content.replace(/<View style=\{styles\.modalContainer\}>/g, "<View style={[styles.modalContainer, { backgroundColor: colors.card }]}>");
  content = content.replace(/<Text style=\{styles\.modalTitle\}>/g, "<Text style={[styles.modalTitle, { color: colors.text }]}>");
  content = content.replace(/<Text style=\{styles\.label\}>/g, "<Text style={[styles.label, { color: colors.textSecondary }]}>");
  content = content.replace(/<Text style=\{styles\.value\}>/g, "<Text style={[styles.value, { color: colors.text }]}>");
  content = content.replace(/<Text style=\{styles\.nameText\}>/g, "<Text style={[styles.nameText, { color: colors.text }]}>");
  content = content.replace(/<Text style=\{styles\.codeText\}>/g, "<Text style={[styles.codeText, { color: colors.text }]}>");
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed cards in ${file}`);
});
