const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../public/locales');
const baseFile = path.join(localesDir, 'vi.json');

const baseData = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const baseKeys = Object.keys(baseData).sort();

const targetLocales = ['en.json', 'jp.json', 'de.json'];

for (const file of targetLocales) {
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let addedCount = 0;
        let removedCount = 0;
        let missingKeys = [];

        // 1. Add missing keys
        for (const key of baseKeys) {
            if (!(key in data)) {
                data[key] = baseData[key];
                addedCount++;
                missingKeys.push(key);
            }
        }

        // 2. Remove keys that are not in base
        const currentKeys = Object.keys(data);
        for (const key of currentKeys) {
            if (!(key in baseData)) {
                delete data[key];
                removedCount++;
            }
        }

        // 3. Sort keys
        const sortedData = {};
        Object.keys(data).sort().forEach(k => {
            sortedData[k] = data[k];
        });

        fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 4));
        console.log(`Synced ${file}: Added ${addedCount} missing keys, Removed ${removedCount} extra keys.`);
    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
}
