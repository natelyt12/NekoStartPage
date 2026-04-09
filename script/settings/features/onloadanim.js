import { openCustomPopup, showNotification } from "../utils/UI.js";
import { t, translateDOM } from "../../core/i18n.js";
import { getSettings, saveSettings } from "../utils/storagehandler.js";

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
                    this.onloadAnimationFrame.style.transition = `transform ${speed}s var(--expo), filter ${speed}s var(--expo)`;
                    this.onloadAnimationFrame.style.filter = "blur(0px)";
                    this.onloadAnimationFrame.style.transform = `scale(1) rotate(0deg)`;

                    this.overlay.style.transition = `opacity ${overlaySpeed}s var(--expo_2)`;
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
            this.overlay.style.transition = "opacity 0.5s var(--expo_2)";
            this.overlay.style.opacity = "1";
            setTimeout(startAnimation, 500);
        } else {
            startAnimation();
        }
    }

    applySettings() {
        const localOnloadData = getSettings().onload || {};

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
        this.setupBindings();
        this.loadCurrentSettings();

        openCustomPopup(t("onload_animation.window_title"), this.clone, "420px", true, true);

        const popupClose = document.querySelector(".popup_close");
        if (popupClose) {
            popupClose.addEventListener("popupBeforeClose", this.handleBeforeClose);
        }

        import("../utils/UI.js").then(({ initSvgs }) => initSvgs());
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
            const popupClose = document.querySelector(".popup_close");
            if (popupClose) {
                popupClose.removeEventListener("popupBeforeClose", this.handleBeforeClose);
            }
        }
    }

    bindElements() {
        this.syncPairs = [
            { range: this.clone.querySelector("#zoom_range"), number: this.clone.querySelector("#zoom_value") },
            { range: this.clone.querySelector("#rotate_range"), number: this.clone.querySelector("#rotate_value") },
            { range: this.clone.querySelector("#blur_range"), number: this.clone.querySelector("#blur_value") },
            { range: this.clone.querySelector("#speed_range"), number: this.clone.querySelector("#speed_value") },
            { range: this.clone.querySelector("#overlay_speed_range"), number: this.clone.querySelector("#overlay_speed_value") },
        ];

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

    setupBindings() {
        this.syncPairs.forEach((pair) => {
            if (!pair.range || !pair.number) return;

            pair.range.addEventListener("input", (e) => {
                pair.number.value = e.target.value;
                this.markAsCustom();
            });

            pair.number.addEventListener("input", (e) => {
                pair.range.value = e.target.value;
                this.markAsCustom();
            });

            pair.number.addEventListener("change", (e) => {
                let val = parseFloat(e.target.value);
                const min = parseFloat(e.target.min);
                const max = parseFloat(e.target.max);

                if (isNaN(val)) {
                    e.target.value = pair.range.value;
                    this.markAsCustom();
                    return;
                }

                if (val < min) val = min;
                if (val > max) val = max;

                e.target.value = val;
                pair.range.value = val;
                this.markAsCustom();
            });
        });

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
                    presetValues = { zoom_range: 1, rotate_range: 0, blur_range: 0, speed_range: 1, overlay_speed_range: 1 };
                    break;
                case "zoom_in_light":
                    presetValues = { zoom_range: 1.4, rotate_range: 0, blur_range: 10, speed_range: 3, overlay_speed_range: 1 };
                    break;
                case "zoom_in_heavy":
                    presetValues = { zoom_range: 2.4, rotate_range: 20, blur_range: 16, speed_range: 2.6, overlay_speed_range: 1 };
                    break;
                case "sleepy":
                    presetValues = { zoom_range: 1.3, rotate_range: 0, blur_range: 30, speed_range: 5, overlay_speed_range: 2.5 };
                    break;
                case "nature":
                    presetValues = { zoom_range: 1.2, rotate_range: 0, blur_range: 7, speed_range: 2.5, overlay_speed_range: 1 };
                    break;
            }

            if (presetValues) {
                this.syncPairs.forEach((pair) => {
                    if (pair.range && pair.range.id in presetValues) {
                        pair.range.value = presetValues[pair.range.id];
                        pair.number.value = presetValues[pair.range.id];
                    }
                });
            }
        }
    }

    handlePreview() {
        const zoom = document.getElementById("zoom_value")?.value || 1;
        const rotate = document.getElementById("rotate_value")?.value || 0;
        const blur = document.getElementById("blur_value")?.value || 0;
        const speed = parseFloat(document.getElementById("speed_value")?.value || 1);
        const overlaySpeed = parseFloat(document.getElementById("overlay_speed_value")?.value || 1);
        const popupSection = document.querySelector(".popup_section");

        this.btnPreview.disabled = true;
        if (this.btnSave) this.btnSave.disabled = true;

        if (popupSection) {
            popupSection.style.transition = "0.5s var(--expo_2)";
            popupSection.style.opacity = "0";
            popupSection.style.overflow = "hidden";
        }

        this.animator.execute(zoom, rotate, blur, speed, overlaySpeed, true, () => {
            this.btnPreview.disabled = false;
            if (this.btnSave) this.btnSave.disabled = false;

            if (popupSection) {
                popupSection.style.transition = `0.4s var(--expo)`;
                popupSection.style.opacity = "1";
                popupSection.style.overflow = "visible";
            }
        });
    }

    handleSave() {
        const zoom = parseFloat(document.getElementById("zoom_value")?.value || 1);
        const rotate = parseFloat(document.getElementById("rotate_value")?.value || 0);
        const blur = parseFloat(document.getElementById("blur_value")?.value || 0);
        const speed = parseFloat(document.getElementById("speed_value")?.value || 1);
        const overlaySpeed = parseFloat(document.getElementById("overlay_speed_value")?.value || 1);
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

        const popupClose = document.querySelector(".popup_close");
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

        if (this.localOnloadData.preset === "custom") {
            const manualSync = {
                zoom_range: this.localOnloadData.zoom,
                rotate_range: this.localOnloadData.rotate,
                blur_range: this.localOnloadData.blur,
                speed_range: this.localOnloadData.speed,
                overlay_speed_range: this.localOnloadData.overlay_speed,
            };
            this.syncPairs.forEach((pair) => {
                if (pair.range && pair.range.id in manualSync) {
                    pair.range.value = manualSync[pair.range.id];
                    pair.number.value = manualSync[pair.range.id];
                }
            });
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
