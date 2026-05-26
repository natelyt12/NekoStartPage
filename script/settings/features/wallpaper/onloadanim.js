import { openCustomPopup, showNotification, createSlider } from "/script/settings/utils/UI.js";
import { t, translateDOM } from "/script/core/i18n.js";
import { getSettings, saveSettings } from "/script/settings/utils/storagehandler.js";

class OnloadAnimator {
    constructor() {
        this.onloadAnimationFrame = document.querySelector(".onload_animation_frame");
        this.overlay = document.querySelector(".overlay");
    }

    execute(zoom, rotate, blur, speed, overlaySpeed, isPreview, onComplete = null) {
        if (!this.onloadAnimationFrame || !this.overlay) {
            this.onloadAnimationFrame = document.querySelector(".onload_animation_frame");
            this.overlay = document.querySelector(".overlay");
            if (!this.onloadAnimationFrame || !this.overlay) return;
        }

        const startAnimation = () => {
            this.onloadAnimationFrame.style.transition = "none";
            this.onloadAnimationFrame.style.filter = `blur(${blur}px)`;
            this.onloadAnimationFrame.style.transform = `scale(${zoom}) rotate(${rotate}deg)`;

            if (!isPreview) {
                this.overlay.style.transition = "none";
                this.overlay.style.opacity = "1";
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.onloadAnimationFrame.style.transition = `transform ${speed}s var(--expo_out), filter ${speed}s var(--expo_out)`;
                    this.onloadAnimationFrame.style.filter = "blur(0px)";
                    this.onloadAnimationFrame.style.transform = `scale(1) rotate(0deg)`;

                    this.overlay.style.transition = `opacity ${overlaySpeed}s var(--expo_in_out)`;
                    this.overlay.style.opacity = "0";

                    const maxDuration = Math.max(speed, overlaySpeed);

                    setTimeout(() => {
                        this.overlay.style.transition = "";
                        this.onloadAnimationFrame.style.transition = "";

                        if (!isPreview) {
                            this.overlay.style.pointerEvents = "none";
                            this.onloadAnimationFrame.style.pointerEvents = "none";
                        }
                        if (onComplete) onComplete();

                        document.dispatchEvent(new CustomEvent("onload-animation-complete"));
                    }, maxDuration * 1000);
                });
            });
        };

        if (isPreview) {
            this.overlay.style.transition = "opacity 0.5s var(--expo_in_out)";
            this.overlay.style.opacity = "1";
            setTimeout(startAnimation, 500);
        } else {
            startAnimation();
        }
    }

    applySettings() {
        const settings = getSettings();
        const localOnloadData = settings.onload || {};

        const zoom = localOnloadData.zoom || 1;
        const rotate = localOnloadData.rotate || 0;
        const blur = localOnloadData.blur || 0;
        const speed = localOnloadData.speed || 1;
        const overlaySpeed = localOnloadData.overlay_speed || 1;

        this.execute(zoom, rotate, blur, speed, overlaySpeed, false);
    }
}

class OnloadSettingsEditor {
    constructor(animator) {
        this.animator = animator;
        this.handlePresetChange = this.handlePresetChange.bind(this);
        this.handleBeforeClose = this.handleBeforeClose.bind(this);
        this.isDirty = false;
        this.canExit = false;
        this.exitTimer = null;
    }

    initialize() {
        const editBtn = document.getElementById("edit_onload_settings");

        if (editBtn) {
            editBtn.addEventListener("mousedown", () => this.openEditor());
        }
    }

    openEditor() {
        const template = document.getElementById("tpl_onload_settings");
        if (!template) return;

        this.clone = template.content.cloneNode(true);
        translateDOM(this.clone);

        this.bindElements();
        this.loadCurrentSettings();
        this.setupSliders();
        this.setupBindings();

        this.popup = openCustomPopup(t("onload_animation.window_title"), this.clone, "420px", { id: "onload_settings", isAlert: false, canClose: true, hideUI: true });

        const popupClose = this.popup.closeBtn;
        if (popupClose) {
            popupClose.addEventListener("popupBeforeClose", this.handleBeforeClose);
        }

        import("/script/settings/utils/UI.js").then(({ initSvgs }) => initSvgs());
        this.dispatchInitialEvent();
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
            document.removeEventListener("subsectionChange", this.handlePresetChange);
            const popupClose = this.popup ? this.popup.closeBtn : null;
            if (popupClose) {
                popupClose.removeEventListener("popupBeforeClose", this.handleBeforeClose);
            }
        }
    }

    bindElements() {
        this.slidersContainer = this.clone.querySelector("#onload_sliders_container");
        this.btnPreview = this.clone.querySelector("#btn_preview");
        this.btnSave = this.clone.querySelector("#btn_save");
    }

    markAsCustom() {
        this.isDirty = true;
        const btn = document.getElementById("onload_preset");
        if (btn && btn.getAttribute("data-selected") !== "custom") {
            const mockEvent = new CustomEvent("subsectionChange", {
                bubbles: true,
                detail: { id: "onload_preset", value: "custom" },
            });
            document.dispatchEvent(mockEvent);
        }
    }

    setupSliders() {
        const specs = [
            { id: "zoom", label: t("onload_animation.zoom_label"), min: 1, max: 3, step: 0.01, defaultValue: 1, unit: "%" },
            { id: "blur", label: t("onload_animation.blur_label"), min: 0, max: 30, step: 1, defaultValue: 0, unit: "%" },
            { id: "rotate", label: t("onload_animation.rotate_label"), min: -45, max: 45, step: 0.1, defaultValue: 0, unit: "deg" },
            { id: "speed", label: t("onload_animation.speed_label"), min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: "s" },
            { id: "overlay_speed", label: t("onload_animation.overlay_speed_label"), min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: "s" }
        ];

        this.sliders = {};
        if (this.slidersContainer) {
            this.slidersContainer.innerHTML = "";
            specs.forEach(spec => {
                const sliderComponent = createSlider({
                    label: spec.label,
                    min: spec.min,
                    max: spec.max,
                    step: spec.step,
                    value: this.localOnloadData[spec.id] ?? spec.defaultValue,
                    defaultValue: spec.defaultValue,
                    unit: spec.unit,
                    onChange: () => {
                        this.markAsCustom();
                    }
                });
                this.slidersContainer.appendChild(sliderComponent);
                this.sliders[spec.id] = sliderComponent;
            });
        }
    }

    setupBindings() {
        document.addEventListener("subsectionChange", this.handlePresetChange);

        if (this.btnPreview) {
            this.btnPreview.addEventListener("mousedown", () => this.handlePreview());
        }

        if (this.btnSave) {
            this.btnSave.addEventListener("mousedown", () => this.handleSave());
        }
    }

    handlePresetChange(e) {
        if (e.detail.id === "onload_preset") {
            let presetValues = null;

            switch (e.detail.value) {
                case "default":
                    presetValues = { zoom: 1, rotate: 0, blur: 0, speed: 1, overlay_speed: 0.4 };
                    break;
                case "zoom_in_light":
                    presetValues = { zoom: 1.4, rotate: 0, blur: 10, speed: 3, overlay_speed: 1 };
                    break;
                case "zoom_in_heavy":
                    presetValues = { zoom: 2.4, rotate: 20, blur: 16, speed: 2.6, overlay_speed: 1 };
                    break;
                case "sleepy":
                    presetValues = { zoom: 1.3, rotate: 0, blur: 30, speed: 5, overlay_speed: 2.5 };
                    break;
                case "nature":
                    presetValues = { zoom: 1.2, rotate: 0, blur: 7, speed: 2.5, overlay_speed: 1 };
                    break;
            }

            if (presetValues) {
                for (const [key, val] of Object.entries(presetValues)) {
                    if (this.sliders && this.sliders[key]) {
                        this.sliders[key].value = val;
                    }
                }
            }
        }
    }

    handlePreview() {
        const zoom = this.sliders?.zoom?.value ?? 1;
        const rotate = this.sliders?.rotate?.value ?? 0;
        const blur = this.sliders?.blur?.value ?? 0;
        const speed = parseFloat(this.sliders?.speed?.value ?? 1);
        const overlaySpeed = parseFloat(this.sliders?.overlay_speed?.value ?? 1);
        const popupSection = this.popup ? this.popup.popupSection : null;

        this.btnPreview.disabled = true;
        if (this.btnSave) this.btnSave.disabled = true;

        if (popupSection) {
            popupSection.style.transition = "0.5s";
            popupSection.style.opacity = "0";
            popupSection.style.overflow = "hidden";
        }

        this.animator.execute(zoom, rotate, blur, speed, overlaySpeed, true, () => {
            this.btnPreview.disabled = false;
            if (this.btnSave) this.btnSave.disabled = false;

            if (popupSection) {
                popupSection.style.transition = `0.4s`;
                popupSection.style.opacity = "1";
                popupSection.style.overflow = "visible";
            }
        });
    }

    handleSave() {
        const zoom = parseFloat(this.sliders?.zoom?.value ?? 1);
        const rotate = parseFloat(this.sliders?.rotate?.value ?? 0);
        const blur = parseFloat(this.sliders?.blur?.value ?? 0);
        const speed = parseFloat(this.sliders?.speed?.value ?? 1);
        const overlaySpeed = parseFloat(this.sliders?.overlay_speed?.value ?? 1);
        const widgetImmediate = document.getElementById("widget_immediate")?.checked;

        const btnPreset = document.getElementById("onload_preset");
        const presetSelected = btnPreset ? btnPreset.getAttribute("data-selected") || "custom" : "custom";

        let currentOnloadData = getSettings().onload || {};
        currentOnloadData.preset = presetSelected;
        currentOnloadData.zoom = zoom;
        currentOnloadData.rotate = rotate;
        currentOnloadData.blur = blur;
        currentOnloadData.speed = speed;
        currentOnloadData.overlay_speed = overlaySpeed;
        currentOnloadData.widget_immediate = widgetImmediate !== false;

        saveSettings({ onload: currentOnloadData });
        showNotification(t("alert.saved_changes"), "success");
        this.isDirty = false;

        const popupClose = this.popup ? this.popup.closeBtn : null;
        if (popupClose) popupClose.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }

    loadCurrentSettings() {
        this.localOnloadData = getSettings().onload || {
            preset: "default",
            zoom: 1,
            rotate: 0,
            blur: 0,
            speed: 1,
            overlay_speed: 1,
            widget_immediate: true,
        };

        const widgetImmediateCheck = this.clone.querySelector("#widget_immediate");
        if (widgetImmediateCheck) {
            widgetImmediateCheck.checked = this.localOnloadData.widget_immediate !== false;
        }
    }

    dispatchInitialEvent() {
        const mockEvent = new CustomEvent("subsectionChange", {
            bubbles: true,
            detail: { id: "onload_preset", value: this.localOnloadData.preset },
        });
        document.dispatchEvent(mockEvent);
    }
}

// Instantiate the classes for global logic use while keeping specific functionality isolated
const animator = new OnloadAnimator();
const settingsEditor = new OnloadSettingsEditor(animator);

/**
 * Run Onload Animation at startup
 */
export function applyOnloadAnimation() {
    animator.applySettings();
}

/**
 * Initialize Onload Animation settings panel
 */
export function initializeOnloadSettings() {
    settingsEditor.initialize();
}

