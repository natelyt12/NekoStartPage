import { openCustomPopup, showNotification } from "/script/settings/utils/UI.js";
import { t } from "/script/core/i18n.js";
import { getSettings, saveSettings } from "/script/settings/utils/storagehandler.js";
import { applyWallpaperFilters } from "/script/settings/features/wallpaper/bgapi.js";

class FilterSettingsEditor {
    constructor() {
        this.isDirty = false;
        this.canExit = false;
        this.exitTimer = null;
        this.handleBeforeClose = this.handleBeforeClose.bind(this);
    }

    initialize() {
        const editBtn = document.getElementById("edit_filter_settings");
        if (editBtn) {
            editBtn.addEventListener("mousedown", () => this.openEditor());
        }
    }

    openEditor() {
        const template = document.getElementById("tpl_filter_settings");
        if (!template) return;

        this.clone = template.content.cloneNode(true);
        
        this.bindElements();
        this.setupBindings();
        this.loadCurrentSettings();

        const windowTitle = t("setting_panel.wallpaper_customization.filters");
        this.popup = openCustomPopup(windowTitle, this.clone, "420px", { 
            id: "filter_settings", 
            isAlert: false, 
            canClose: true, 
            hideUI: true 
        });

        const popupClose = this.popup.closeBtn;
        if (popupClose) {
            popupClose.addEventListener("popupBeforeClose", this.handleBeforeClose);
        }

        // Initialize SVGs if any (though currently none in this template)
        import("/script/settings/utils/UI.js").then(({ initSvgs }) => initSvgs());
    }

    handleBeforeClose(e) {
        if (this.isDirty && !this.canExit) {
            e.preventDefault();
            showNotification(t("alert.unsaved_changes"), "warning");
            this.canExit = true;

            if (this.exitTimer) clearTimeout(this.exitTimer);
            this.exitTimer = setTimeout(() => {
                this.canExit = false;
            }, 5000);
        } else {
            const popupClose = this.popup ? this.popup.closeBtn : null;
            if (popupClose) {
                popupClose.removeEventListener("popupBeforeClose", this.handleBeforeClose);
            }
            // Revert preview if not saved
            if (this.isDirty) {
                applyWallpaperFilters();
            }
        }
    }

    bindElements() {
        this.syncPairs = [
            { id: "brightness", range: this.clone.querySelector("#brightness_range"), number: this.clone.querySelector("#brightness_num") },
            { id: "contrast", range: this.clone.querySelector("#contrast_range"), number: this.clone.querySelector("#contrast_num") },
            { id: "saturate", range: this.clone.querySelector("#saturate_range"), number: this.clone.querySelector("#saturate_num") },
            { id: "blur", range: this.clone.querySelector("#blur_range"), number: this.clone.querySelector("#blur_num") },
            { id: "hue", range: this.clone.querySelector("#hue_range"), number: this.clone.querySelector("#hue_num") },
        ];

        this.btnReset = this.clone.querySelector("#btn_filter_reset");
        this.btnSave = this.clone.querySelector("#btn_filter_save");
    }

    setupBindings() {
        this.syncPairs.forEach((pair) => {
            if (!pair.range || !pair.number) return;

            pair.range.addEventListener("input", (e) => {
                pair.number.value = e.target.value;
                this.applyPreview();
            });

            pair.number.addEventListener("input", (e) => {
                pair.range.value = e.target.value;
                this.applyPreview();
            });

            pair.number.addEventListener("change", (e) => {
                let val = parseFloat(e.target.value);
                const min = parseFloat(e.target.min);
                const max = parseFloat(e.target.max);

                if (isNaN(val)) {
                    e.target.value = pair.range.value;
                    return;
                }

                if (val < min) val = min;
                if (val > max) val = max;

                e.target.value = val;
                pair.range.value = val;
                this.applyPreview();
            });
        });

        if (this.btnReset) {
            this.btnReset.addEventListener("mousedown", () => this.handleReset());
        }

        if (this.btnSave) {
            this.btnSave.addEventListener("mousedown", () => this.handleSave());
        }
    }

    applyPreview() {
        this.isDirty = true;
        const config = {};
        this.syncPairs.forEach(pair => {
            config[pair.id] = parseFloat(pair.range.value);
        });

        // Temporarily override settings for applyWallpaperFilters to pick up
        const settings = getSettings();
        const oldConfig = { ...settings.wallpaperConfig };
        
        // We don't want to save yet, but applyWallpaperFilters reads from storage usually.
        // To avoid modifying storage globally prematurely, we can either:
        // 1. Modify applyWallpaperFilters to accept a config object.
        // 2. Or just apply it directly here.
        
        const filterStr = `brightness(${config.brightness}) blur(${config.blur}px) contrast(${config.contrast}) saturate(${config.saturate}) hue-rotate(${config.hue}deg)`;
        const bg = document.querySelector(".image");
        const video = document.querySelector(".video");
        
        if (bg) bg.style.filter = filterStr;
        if (video) video.style.filter = filterStr;
    }

    handleReset() {
        const defaults = {
            brightness: 1,
            contrast: 1,
            saturate: 1,
            blur: 0,
            hue: 0
        };

        this.syncPairs.forEach(pair => {
            if (pair.id in defaults) {
                pair.range.value = defaults[pair.id];
                pair.number.value = defaults[pair.id];
            }
        });
        this.applyPreview();
    }

    handleSave() {
        const config = {};
        this.syncPairs.forEach(pair => {
            config[pair.id] = parseFloat(pair.range.value);
        });

        const currentConf = getSettings().wallpaperConfig || {};
        const newConf = { ...currentConf, ...config };

        saveSettings({ wallpaperConfig: newConf });
        showNotification(t("alert.saved_changes"), "success");
        this.isDirty = false;

        const popupClose = this.popup ? this.popup.closeBtn : null;
        if (popupClose) popupClose.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        
        applyWallpaperFilters();
    }

    loadCurrentSettings() {
        const config = getSettings().wallpaperConfig || {};
        const current = {
            brightness: config.brightness ?? 1,
            contrast: config.contrast ?? 1,
            saturate: config.saturate ?? 1,
            blur: config.blur ?? 0,
            hue: config.hue ?? 0
        };

        this.syncPairs.forEach(pair => {
            if (pair.id in current) {
                pair.range.value = current[pair.id];
                pair.number.value = current[pair.id];
            }
        });
        this.isDirty = false;
    }
}

const editor = new FilterSettingsEditor();

export function initializeFilterSettings() {
    editor.initialize();
}
