const fs = require('fs');
const path = require('path');

const replacements = [
    { from: 'sp.api_options.', to: 'sp.api.' },
    { from: 'particles_animation.', to: 'particles.' },
    { from: 'onload_animation.', to: 'onload_anim.' }
];

// 1. Update Locale JSON files
const localesDir = path.join(__dirname, 'public/locales');
const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of localeFiles) {
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const newData = {};

        for (const key of Object.keys(data)) {
            let newKey = key;
            for (const rep of replacements) {
                if (newKey.startsWith(rep.from)) {
                    newKey = newKey.replace(rep.from, rep.to);
                }
            }
            newData[newKey] = data[key];
        }

        fs.writeFileSync(filePath, JSON.stringify(newData, null, 4));
        console.log(`Updated locale keys in ${file}`);
    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
}

// 2. Update Source Files
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

for (const file of sourceFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    for (const rep of replacements) {
        const fromEscaped = rep.from.replace(/\./g, '\\.');
        
        // Regex for data-i18n="..."
        const reAttr = new RegExp(`data-i18n([a-z-]*)="(?:${fromEscaped})`, 'g');
        content = content.replace(reAttr, `data-i18n$1="${rep.to}`);
        
        const reAttrSingle = new RegExp(`data-i18n([a-z-]*)='(?:${fromEscaped})`, 'g');
        content = content.replace(reAttrSingle, `data-i18n$1='${rep.to}`);

        // Regex for t("...")
        const reTDouble = new RegExp(`t\\("${fromEscaped}`, 'g');
        content = content.replace(reTDouble, `t("${rep.to}`);
        
        // Regex for t('...')
        const reTSingle = new RegExp(`t\\('${fromEscaped}`, 'g');
        content = content.replace(reTSingle, `t('${rep.to}`);
        
        // Regex for t(`...`)
        const reTBacktick = new RegExp(`t\\(\\\`${fromEscaped}`, 'g');
        content = content.replace(reTBacktick, `t(\`${rep.to}`);
    }

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated source file: ${file}`);
    }
}

console.log('Renaming complete.');
