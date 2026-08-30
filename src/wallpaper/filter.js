import { openSidebarSubmenu, closeSidebarSubmenu, setSubmenuDirty, showNotification, createSlider, initSubsectionSvg } from "/src/core/ui.js";
import { t, translateDOM } from "/src/core/i18n.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";


class FilterSettingsEditor {
    constructor() {
        this.isDirty = false;
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

        this.isDirty = false;
        this.clone = template.content.cloneNode(true);
        translateDOM(this.clone);

        this.bindElements();
        this.setupBindings();

        const windowTitle = t("sp.wallpaper_customization.filters");
        openSidebarSubmenu(windowTitle, this.clone, {
            width: "420px",
            canPreview: true,
            isDirty: () => this.isDirty,
            onCancel: () => {
                if (this.isDirty) {
                    applyWallpaperFilters();
                    this.isDirty = false;
                }
            }
        });

        initSubsectionSvg();
    }

    bindElements() {
        const container = this.clone.querySelector("#filter_sliders_container");
        const config = getSettings().wallpaperConfig || {};

        const standardSpecs = [
            { id: "brightness", label: t("sp.wallpaper_customization.brightness"), min: 0.1, max: 2.0, step: 0.05, defaultValue: 1.0, value: config.brightness ?? 1.0, unit: "%" },
            { id: "contrast", label: t("sp.wallpaper_customization.contrast"), min: 0.1, max: 2.0, step: 0.05, defaultValue: 1.0, value: config.contrast ?? 1.0, unit: "%" },
            { id: "saturate", label: t("sp.wallpaper_customization.saturate"), min: 0, max: 3.0, step: 0.1, defaultValue: 1.0, value: config.saturate ?? 1.0, unit: "%" },
        ];

        const heavySpecs = [
            { id: "chroma", label: t("sp.wallpaper_customization.chroma"), min: 0, max: 20, step: 0.5, defaultValue: 0, value: config.chroma ?? 0, unit: "px" },
            { id: "bloom", label: t("sp.wallpaper_customization.bloom"), min: 0, max: 100, step: 10, defaultValue: 0, value: config.bloom ?? 0, unit: "%" },
        ];

        this.sliders = {};
        if (container) {
            container.innerHTML = "";

            const renderSpec = (spec) => {
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
            };

            // 1. Standard Sliders
            standardSpecs.forEach(renderSpec);

            // 2. Heavy Effects Divider
            const divider = document.createElement("div");
            divider.className = "section_divider";
            divider.setAttribute("data-i18n", "sp.wallpaper_customization.heavy_effects");
            divider.textContent = t("sp.wallpaper_customization.heavy_effects", "Hiệu ứng nặng");
            container.appendChild(divider);

            // 3. Heavy Effect Sliders
            heavySpecs.forEach(renderSpec);
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
        setSubmenuDirty(true);
        const config = {};
        for (const [id, slider] of Object.entries(this.sliders)) {
            config[id] = slider.value;
        }

        let filterStr = `brightness(${config.brightness}) contrast(${config.contrast}) saturate(${config.saturate})`;

        const chromaVal = config.chroma || 0;
        const filterEl = document.getElementById("chroma_filter");
        if (filterEl) {
            filterEl.children[0].setAttribute("dx", chromaVal);
            filterEl.children[1].setAttribute("dx", -chromaVal);
        }
        if (chromaVal > 0) {
            filterStr += ` url(#chroma_filter)`;
        }

        document.querySelectorAll(".image").forEach(img => {
            if (!img.parentElement.classList.contains("bloom_container")) {
                img.style.filter = filterStr;
            } else {
                img.style.filter = `saturate(${config.saturate})`;
            }
        });

        document.querySelectorAll(".video").forEach(v => {
            if (!v.parentElement.classList.contains("bloom_container")) {
                v.style.filter = filterStr;
            } else {
                v.style.filter = `saturate(${config.saturate})`;
            }
        });

        const bloomVal = config.bloom ?? 0;
        const bloomContainer = document.querySelector(".bloom_container");
        if (bloomContainer) {
            bloomContainer.style.opacity = bloomVal / 100;
        }
    }

    handleReset() {
        const defaults = {
            brightness: 1.0,
            contrast: 1.0,
            saturate: 1.0,
            chroma: 0,
            bloom: 0
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
        showNotification(t("common.saved_changes"), "success");
        this.isDirty = false;
        setSubmenuDirty(false);

        applyWallpaperFilters();
    }
}

const editor = new FilterSettingsEditor();

export function initializeFilterSettings() {
    editor.initialize();
}

/**
 * Apply CSS filters (brightness, contrast, saturate, SVG chroma filter, bloom) on page load.
 */
export function applyWallpaperFilters() {
    const config = getSettings().wallpaperConfig || {};
    const brightness = config.brightness ?? 1;
    const contrast = config.contrast ?? 1;
    const saturate = config.saturate ?? 1;
    const chroma = config.chroma ?? 0;

    let svg = document.getElementById("chroma_svg_filter");
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "chroma_svg_filter";
        svg.style.display = "none";
        svg.innerHTML = `
            <filter id="chroma_filter">
                <feOffset in="SourceGraphic" dx="0" dy="0" result="red-shift"/>
                <feOffset in="SourceGraphic" dx="0" dy="0" result="blue-shift"/>
                <feOffset in="SourceGraphic" dx="0" dy="0" result="green-shift"/>
                <feColorMatrix in="red-shift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red-channel"/>
                <feColorMatrix in="blue-shift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue-channel"/>
                <feColorMatrix in="green-shift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green-channel"/>
                <feBlend mode="screen" in="red-channel" in2="blue-channel" result="rb"/>
                <feBlend mode="screen" in="rb" in2="green-channel" result="rgb"/>
            </filter>
        `;
        document.body.appendChild(svg);
    }

    const filterEl = document.getElementById("chroma_filter");
    if (filterEl) {
        filterEl.children[0].setAttribute("dx", chroma);
        filterEl.children[1].setAttribute("dx", -chroma);
    }

    let filterStr = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
    if (chroma > 0) {
        filterStr += ` url(#chroma_filter)`;
    }

    document.querySelectorAll(".image").forEach(img => {
        if (!img.parentElement.classList.contains("bloom_container")) {
            img.style.filter = filterStr;
        } else {
            img.style.filter = `saturate(${saturate})`;
        }
    });

    document.querySelectorAll(".video").forEach(v => {
        if (!v.parentElement.classList.contains("bloom_container")) {
            v.style.filter = filterStr;
        } else {
            v.style.filter = `saturate(${saturate})`;
        }
    });

    const bloom = config.bloom ?? 0;
    const bloomContainer = document.querySelector(".bloom_container");
    if (bloomContainer) {
        bloomContainer.style.opacity = bloom / 100;
    }
}
