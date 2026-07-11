const fs = require('fs');
const path = require('path');

const localesFile = path.join(__dirname, 'public/locales/vi.json');
const localeData = JSON.parse(fs.readFileSync(localesFile, 'utf8'));
const allKeys = Object.keys(localeData);

function getAllFiles(dir, exts) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(file, exts));
        } else {
            if (exts.some(ext => file.endsWith(ext))) {
                results.push(file);
            }
        }
    });
    return results;
}

const sourceFiles = getAllFiles(path.join(__dirname, 'src'), ['.js', '.html']);
sourceFiles.push(path.join(__dirname, 'index.html'));

let fullContent = '';
for (const file of sourceFiles) {
    fullContent += fs.readFileSync(file, 'utf8') + '\n';
}

const potentiallyUnused = [];

// Known prefixes that are constructed dynamically in JS
const dynamicPrefixes = [
    'particles_animation.',
    'sp.weather.weather_codes.',
    'sp.time.days.',
    'sp.api_options.collection.type'
];

for (const key of allKeys) {
    // If it perfectly matches somewhere in the code
    if (fullContent.includes(key)) {
        continue;
    }

    // Check if it's one of the known dynamic keys
    const isDynamic = dynamicPrefixes.some(prefix => key.startsWith(prefix));
    if (isDynamic) {
        continue;
    }

    potentiallyUnused.push(key);
}

console.log('--- POTENTIALLY UNUSED KEYS ---');
potentiallyUnused.forEach(k => console.log(k));
console.log('Total:', potentiallyUnused.length);
