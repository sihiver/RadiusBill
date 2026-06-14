const fs = require('fs');
let file = 'android/app/settings.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix header
content = content.replace(/<View style=\{styles\.header\}>/g, "<View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>");

// Fix arrow color
content = content.replace(/name="arrow-left" size=\{20\} color="#1e293b"/g, 'name="arrow-left" size={20} color={colors.text}');

// Fix emptyState
content = content.replace(/<View style=\{styles\.emptyState\}>/g, "<View style={[styles.emptyState, { backgroundColor: colors.card }]}>");

// Fix deviceItem
content = content.replace(/style=\{\[styles\.deviceItem, connectedDevice === item\.address && styles\.deviceItemActive\]\}/g, "style={[styles.deviceItem, { backgroundColor: colors.card }, connectedDevice === item.address && [styles.deviceItemActive, { backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff' }]]}");

// Fix deviceName
content = content.replace(/<Text style=\{styles\.deviceName\}>/g, "<Text style={[styles.deviceName, { color: colors.text }]}>");

// Fix deviceMac
content = content.replace(/<Text style=\{styles\.deviceMac\}>/g, "<Text style={[styles.deviceMac, { color: colors.textSecondary }]}>");

// Fix footer
content = content.replace(/<View style=\{styles\.footer\}>/g, "<View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed settings.tsx');
