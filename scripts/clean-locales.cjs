const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VI_LOCALE_PATH = path.join(__dirname, 'public/locales/vi.json');
const EN_LOCALE_PATH = path.join(__dirname, 'public/locales/en.json');
const SRC_DIR = path.join(__dirname, 'src');

const viData = JSON.parse(fs.readFileSync(VI_LOCALE_PATH, 'utf8'));
const enData = JSON.parse(fs.readFileSync(EN_LOCALE_PATH, 'utf8'));

const allKeys = new Set([...Object.keys(viData), ...Object.keys(enData)]);

// Comprehensive list of prefixes for dynamic keys
const dynamicPrefixes = [
    'particles.',
    'sp.api_selector.',
    'sp.api.',
    'sp.weather.codes.'
];

let unusedKeys = [];

for (const key of allKeys) {
    if (dynamicPrefixes.some(prefix => key.startsWith(prefix))) {
        continue;
    }

    try {
        execSync(`grep -rIq "${key}" ${SRC_DIR} *.html`);
    } catch (e) {
        unusedKeys.push(key);
    }
}

console.log("Found potentially unused keys:");
console.log(unusedKeys);

for (const key of unusedKeys) {
    delete viData[key];
    delete enData[key];
}

fs.writeFileSync(VI_LOCALE_PATH, JSON.stringify(viData, null, 4));
fs.writeFileSync(EN_LOCALE_PATH, JSON.stringify(enData, null, 4));

console.log(`\nRemoved ${unusedKeys.length} unused keys from locale files.`);
