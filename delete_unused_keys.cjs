const fs = require('fs');
const path = require('path');

const keysToDelete = [
    "sp.time.days.0",
    "sp.time.days.1",
    "sp.time.days.2",
    "sp.time.days.3",
    "sp.time.days.4",
    "sp.time.days.5",
    "sp.time.days.6"
];

const localesDir = path.join(__dirname, 'public/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        let removedCount = 0;
        for (const key of keysToDelete) {
            if (key in data) {
                delete data[key];
                removedCount++;
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Deleted ${removedCount} keys from ${file}`);
    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
}
