const fs = require('fs');
const path = require('path');

const replacements = [
    { from: 'alert.confirm', to: 'common.confirm' },
    { from: 'alert.confirm_cancel', to: 'common.cancel' },
    { from: 'alert.reload', to: 'common.reload' },
    { from: 'alert.saved_changes', to: 'common.saved_changes' },
    { from: 'alert.unsaved_changes', to: 'common.unsaved_changes' },
    
    { from: 'alert.delete_collection_msg', to: 'sp.api.collection.delete_msg' },
    { from: 'alert.delete_collection_title', to: 'sp.api.collection.delete_title' },
    { from: 'alert.delete_confirm_btn', to: 'sp.api.collection.delete_btn' },

    { from: 'alert.export_confirm_msg', to: 'sp.backup.export_msg' },
    { from: 'alert.export_confirm_title', to: 'sp.backup.export_title' },
    { from: 'alert.export_loading', to: 'sp.backup.export_loading' },
    { from: 'alert.export_success', to: 'sp.backup.export_success' },
    { from: 'alert.import_error_msg', to: 'sp.backup.import_error' },
    { from: 'alert.import_success_msg', to: 'sp.backup.import_success' },
    { from: 'alert.import_success_title', to: 'sp.backup.import_title' },

    { from: 'alert.language_reload', to: 'sp.language.reload_msg' },
    { from: 'alert.language_title', to: 'sp.language.reload_title' },

    { from: 'alert.reset_settings_confirm', to: 'sp.danger_zone.reset_msg' },
    { from: 'alert.reset_settings_title', to: 'sp.danger_zone.reset_title' },

    { from: 'alert.widget_edit_cancel', to: 'sp.widgets.edit_cancel' },
    { from: 'alert.widget_edit_save', to: 'sp.widgets.edit_save' },
    { from: 'alert.widget_edit_desc', to: 'sp.widgets.edit_desc' },
    { from: 'alert.widget_edit_title', to: 'sp.widgets.edit_title' },
    
    { from: 'alert.no_image_to_arrange', to: 'bg_editor.no_image_alert' }
];

// Sort replacements by descending length to prevent partial matches like 'alert.confirm' shadowing 'alert.confirm_cancel'
replacements.sort((a, b) => b.from.length - a.from.length);

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
                if (newKey === rep.from) {
                    newKey = rep.to;
                    break;
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
        const reAttr = new RegExp(`data-i18n([a-z-]*)="(?:${fromEscaped})"`, 'g');
        content = content.replace(reAttr, `data-i18n$1="${rep.to}"`);
        
        const reAttrSingle = new RegExp(`data-i18n([a-z-]*)='(?:${fromEscaped})'`, 'g');
        content = content.replace(reAttrSingle, `data-i18n$1='${rep.to}'`);

        // Regex for t("...")
        const reTDouble = new RegExp(`t\\("${fromEscaped}"`, 'g');
        content = content.replace(reTDouble, `t("${rep.to}"`);
        
        // Regex for t('...')
        const reTSingle = new RegExp(`t\\('${fromEscaped}'`, 'g');
        content = content.replace(reTSingle, `t('${rep.to}'`);
        
        // Regex for t(`...`)
        const reTBacktick = new RegExp(`t\\(\\\`${fromEscaped}\\\``, 'g');
        content = content.replace(reTBacktick, `t(\`${rep.to}\``);
    }

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated source file: ${file}`);
    }
}

console.log('Alert renaming complete.');
