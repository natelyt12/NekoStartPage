const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'public/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Sort keys alphabetically
        const sortedKeys = Object.keys(data).sort();
        const sortedData = {};
        for (const key of sortedKeys) {
            sortedData[key] = data[key];
        }

        fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 4));
        console.log(`[Locale Sorter] Sorted ${file}`);
    } catch (err) {
        console.error(`[Locale Sorter] Error sorting ${file}:`, err);
    }
}
