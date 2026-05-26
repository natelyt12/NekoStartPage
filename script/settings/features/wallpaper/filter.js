import { openCustomPopup, showNotification, createSlider } from "/script/settings/utils/UI.js";
import { t, translateDOM } from "/script/core/i18n.js";
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
        translateDOM(this.clone);
        
        this.bindElements();
        this.setupBindings();

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
            if (this.isDirty) {
                applyWallpaperFilters();
            }
        }
    }

    bindElements() {
        const container = this.clone.querySelector("#filter_sliders_container");
        const config = getSettings().wallpaperConfig || {};
        
        const sliderSpecs = [
            { id: "brightness", label: t("setting_panel.wallpaper_customization.brightness"), min: 0.1, max: 2.0, step: 0.05, defaultValue: 1.0, value: config.brightness ?? 1.0, unit: "%" },
            { id: "contrast", label: t("setting_panel.wallpaper_customization.contrast"), min: 0.1, max: 2.0, step: 0.05, defaultValue: 1.0, value: config.contrast ?? 1.0, unit: "%" },
            { id: "saturate", label: t("setting_panel.wallpaper_customization.saturate"), min: 0, max: 3.0, step: 0.1, defaultValue: 1.0, value: config.saturate ?? 1.0, unit: "%" },
            { id: "blur", label: t("setting_panel.wallpaper_customization.blur"), min: 0, max: 100, step: 1, defaultValue: 0, value: config.blur ?? 0, unit: "px" },
            { id: "hue", label: t("setting_panel.wallpaper_customization.hue"), min: 0, max: 360, step: 1, defaultValue: 0, value: config.hue ?? 0, unit: "deg" },
        ];

        this.sliders = {};
        if (container) {
            container.innerHTML = "";
            sliderSpecs.forEach(spec => {
                const sliderComponent = createSlider({
                    label: spec.label,
                    min: spec.min,
                    max: spec.max,
                    step: spec.step,
                    value: spec.value,
                    defaultValue: spec.defaultValue,
                    unit: spec.unit,
                    onChange: () => this.applyPreview()
                });
                container.appendChild(sliderComponent);
                this.sliders[spec.id] = sliderComponent;
            });
        }

        this.btnReset = this.clone.querySelector("#btn_filter_reset");
        this.btnSave = this.clone.querySelector("#btn_filter_save");
    }

    setupBindings() {
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
        for (const [id, slider] of Object.entries(this.sliders)) {
            config[id] = slider.value;
        }

        const filterStr = `brightness(${config.brightness}) blur(${config.blur}px) contrast(${config.contrast}) saturate(${config.saturate}) hue-rotate(${config.hue}deg)`;
        const bg = document.querySelector(".image");
        const video = document.querySelector(".video");
        
        if (bg) bg.style.filter = filterStr;
        if (video) video.style.filter = filterStr;
    }

    handleReset() {
        const defaults = {
            brightness: 1.0,
            contrast: 1.0,
            saturate: 1.0,
            blur: 0,
            hue: 0
        };

        for (const [id, slider] of Object.entries(this.sliders)) {
            if (id in defaults) {
                slider.value = defaults[id];
            }
        }
        this.applyPreview();
    }

    handleSave() {
        const config = {};
        for (const [id, slider] of Object.entries(this.sliders)) {
            config[id] = slider.value;
        }

        const currentConf = getSettings().wallpaperConfig || {};
        const newConf = { ...currentConf, ...config };

        saveSettings({ wallpaperConfig: newConf });
        showNotification(t("alert.saved_changes"), "success");
        this.isDirty = false;

        const popupClose = this.popup ? this.popup.closeBtn : null;
        if (popupClose) popupClose.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        
        applyWallpaperFilters();
    }
}

const editor = new FilterSettingsEditor();

export function initializeFilterSettings() {
    editor.initialize();
}
