const fs = require('fs');

const twConfigPath = './tailwind.config.js';
let config = fs.readFileSync(twConfigPath, 'utf8');

// Extract the colors object
const colorRegex = /colors: \{([^}]+)\}/s;
const match = config.match(colorRegex);
if (!match) process.exit(1);

const colorString = match[1];
const colors = {};
colorString.split('\n').forEach(line => {
  const parts = line.split(':');
  if (parts.length >= 2) {
    const key = parts[0].trim().replace(/"/g, '');
    const value = parts[1].trim().replace(/",?$/, '').replace(/^"/, '');
    if (key && value) {
      colors[key] = value;
    }
  }
});

// Generate CSS variables for :root
let rootVars = ':root {\n';
let darkVars = '.dark {\n';
let newTwColors = 'colors: {\n';

// Simple dark mode inversion logic for a Material 3 inspired theme
Object.keys(colors).forEach(key => {
  const val = colors[key];
  rootVars += `  --color-${key}: ${val};\n`;
  newTwColors += `        "${key}": "var(--color-${key})",\n`;
  
  // Basic dark theme heuristic
  let darkVal = val;
  if (key === 'surface-container-lowest') darkVal = '#0f1113';
  else if (key === 'surface-container-low') darkVal = '#191c1e';
  else if (key === 'surface-container') darkVal = '#1e2124';
  else if (key === 'surface-container-high') darkVal = '#2a2d30';
  else if (key === 'surface-container-highest') darkVal = '#34373a';
  else if (key === 'surface') darkVal = '#111315';
  else if (key === 'background') darkVal = '#111315';
  else if (key === 'on-surface') darkVal = '#e1e3e5';
  else if (key === 'on-surface-variant') darkVal = '#c0c3c8';
  else if (key === 'outline') darkVal = '#8e9196';
  else if (key === 'surface-dim') darkVal = '#111315';
  else if (key === 'surface-variant') darkVal = '#414448';
  else if (key === 'primary') darkVal = '#bbc3ff'; // lighter primary
  else if (key === 'on-primary') darkVal = '#000088';
  else if (key === 'primary-container') darkVal = '#2a1aab'; // darker container
  else if (key === 'on-primary-container') darkVal = '#e0e0ff';
  else if (key === 'error') darkVal = '#ffb4ab';
  else if (key === 'on-error') darkVal = '#690005';
  else if (key === 'error-container') darkVal = '#93000a';
  else if (key === 'on-error-container') darkVal = '#ffdad6';
  else if (key === 'outline-variant') darkVal = '#46464f';
  // Just some simple defaults for the rest
  
  darkVars += `  --color-${key}: ${darkVal};\n`;
});

rootVars += '}\n';
darkVars += '}\n';

config = config.replace(colorRegex, newTwColors.replace(/,\n$/, '\n') + '      }');
config = config.replace("export default {", "export default {\n  darkMode: 'class',");

fs.writeFileSync(twConfigPath, config);

let css = fs.readFileSync('./src/index.css', 'utf8');
// Insert before body
css = css.replace('body {', rootVars + '\n' + darkVars + '\nbody {');
fs.writeFileSync('./src/index.css', css);

console.log("Done generating theme!");
