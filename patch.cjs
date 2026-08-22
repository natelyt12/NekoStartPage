const fs = require('fs');
const file = '/mnt/shared/Code/Project/neko/src/wallpaper/providers/ProviderManager.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/updateOuterMenuVisibility\(\) \{/g, 'updateOuterMenuVisibility(locked = false) {');

content = content.replace(/        if \(ui.provider_changewall\) ui.provider_changewall.style.display = p.showChangewallButton \? "flex" : "none";\n        if \(ui.provider_source\) \{\n            ui.provider_source.style.display = p.showSourceButton \? "flex" : "none";\n            ui.provider_source.disabled = !p.canViewSource;\n        \}\n        if \(ui.provider_download\) ui.provider_download.style.display = p.showDownloadButton \? "flex" : "none";\n        if \(ui.provider_add_to_collection\) ui.provider_add_to_collection.style.display = p.showAddToCollectionButton \? "flex" : "none";\n        if \(ui.provider_extra_settings\) ui.provider_extra_settings.style.display = p.showExtraSettingsButton \? "flex" : "none";\n    \}/g, `        if (ui.loading) ui.loading.style.opacity = locked ? 1 : 0;
        if (ui.API_selector) ui.API_selector.disabled = locked;

        if (ui.provider_changewall) {
            ui.provider_changewall.style.display = p.showChangewallButton ? "flex" : "none";
            ui.provider_changewall.disabled = locked;
        }
        if (ui.provider_source) {
            ui.provider_source.style.display = p.showSourceButton ? "flex" : "none";
            ui.provider_source.disabled = locked || !p.canViewSource;
        }
        if (ui.provider_download) {
            ui.provider_download.style.display = p.showDownloadButton ? "flex" : "none";
            ui.provider_download.disabled = locked;
        }
        if (ui.provider_add_to_collection) {
            ui.provider_add_to_collection.style.display = p.showAddToCollectionButton ? "flex" : "none";
            ui.provider_add_to_collection.disabled = locked;
        }
        if (ui.provider_extra_settings) {
            ui.provider_extra_settings.style.display = p.showExtraSettingsButton ? "flex" : "none";
            ui.provider_extra_settings.disabled = locked;
        }
    }`);

const setUILockedRegex = /\s*\/\*\*[\s\S]*?\* Update disabled states for Outer Menu buttons\.[\s\S]*?setUILocked\(locked\) \{[\s\S]*?    \}/;
content = content.replace(setUILockedRegex, '');

content = content.replace(/this\.setUILocked/g, 'this.updateOuterMenuVisibility');

fs.writeFileSync(file, content);
