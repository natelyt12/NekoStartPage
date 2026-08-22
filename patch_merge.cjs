const fs = require('fs');
const file = '/mnt/shared/Code/Project/neko/src/wallpaper/providers/ProviderManager.js';
let content = fs.readFileSync(file, 'utf8');

// Replace updateOuterMenuVisibility and setUILocked with a single merged function
const regex = /\/\*\*\s*\n\s*\* Update outer menu button visibility based on activeProvider flags\.\n\s*\*\/\n\s*updateOuterMenuVisibility\(\) \{[\s\S]*?if \(ui\.provider_extra_settings\) ui\.provider_extra_settings\.disabled = false;\n\s*\}\n\s*\}/;

const mergedFunction = `/**
     * Update outer menu button visibility and disabled states based on activeProvider flags and lock state.
     * @param {boolean} [locked=false]
     */
    updateOuterMenuVisibility(locked = false) {
        const ui = this.globalUI;
        if (!ui || !this.activeProvider) return;

        if (ui.loading) ui.loading.style.opacity = locked ? 1 : 0;
        if (ui.API_selector) ui.API_selector.disabled = locked;

        const p = this.activeProvider;
        if (ui.apiConfigSection) ui.apiConfigSection.style.display = "block";

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
    }`;

content = content.replace(regex, mergedFunction);

// Replace this.setUILocked calls with this.updateOuterMenuVisibility
content = content.replace(/this\.setUILocked/g, 'this.updateOuterMenuVisibility');

fs.writeFileSync(file, content);
