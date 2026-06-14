const fs = require('fs');

const fixFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');

  // Fix modal content
  content = content.replace(/<View style=\{styles\.modalContent\}>/g, "<View style={[styles.modalContent, { backgroundColor: colors.card }]}>");
  
  // Fix cardBody in router
  content = content.replace(/<View style=\{styles\.cardBody\}>/g, "<View style={[styles.cardBody, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#f8fafc' }]}>");
  
  // Fix action buttons
  content = content.replace(/<TouchableOpacity style=\{styles\.actionBtn\}/g, "<TouchableOpacity style={[styles.actionBtn, { backgroundColor: colorScheme === 'dark' ? '#334155' : '#f1f5f9' }]}");
  
  // Fix inputs
  content = content.replace(/<TextInput([\s\S]*?)style=\{styles\.input\}/g, "<TextInput$1style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#fff' }]}");
  
  // Fix Picker container
  content = content.replace(/<View style=\{styles\.pickerContainer\}>/g, "<View style={[styles.pickerContainer, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#fff', borderColor: colors.border }]}>");

  // Fix avatar background
  content = content.replace(/<View style=\{styles\.avatar\}>/g, "<View style={[styles.avatar, { backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>");

  // Fix phone text (color: colors.textSecondary)
  content = content.replace(/<Text style=\{styles\.phoneText\}>/g, "<Text style={[styles.phoneText, { color: colors.textSecondary }]}>");

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed remaining dark mode in ${file}`);
}

fixFile('android/app/(tabs)/router.tsx');
fixFile('android/app/(tabs)/member.tsx');
fixFile('android/app/(tabs)/voucher.tsx');

