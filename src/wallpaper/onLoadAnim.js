import { openSidebarSubmenu, closeSidebarSubmenu, setSubmenuDirty, showNotification, initSubsectionSvg } from "/src/core/ui.js";
import { t, translateDOM } from "/src/core/i18n.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";

const PRESETS = {
    default: { zoom: 1, rotate: 0, blur: 0, speed: 1, overlay_speed: 0.8 },
    zoom_in_light: { zoom: 1.2, rotate: 0, blur: 10, speed: 3, overlay_speed: 1 },
    zoom_in_heavy: { zoom: 2.4, rotate: 20, blur: 16, speed: 2.6, overlay_speed: 1 },
    sleepy: { zoom: 1.3, rotate: 0, blur: 30, speed: 5, overlay_speed: 2.5 },
    nature: { zoom: 2, rotate: -10, blur: 15, speed: 5, overlay_speed: 1 },
};

function getPresetValues(presetName) {
    return PRESETS[presetName] || PRESETS.default;
}

class OnloadAnimator {
    constructor() {
        this.onloadAnimationFrame = document.querySelector(".onload_animation_frame");
        this.overlay = document.querySelector(".overlay");
    }

    execute(zoom, rotate, blur, speed, bgEasing, overlaySpeed, overlayEasing, isPreview, onComplete = null) {
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

            // Force reflow to ensure initial transform is applied before transitioning
            void this.onloadAnimationFrame.offsetHeight;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.onloadAnimationFrame.style.transition = `transform ${speed}s ${bgEasing}, filter ${speed}s ${bgEasing}`;
                    this.onloadAnimationFrame.style.filter = "blur(0px)";
                    this.onloadAnimationFrame.style.transform = `scale(1) rotate(0deg)`;

                    this.overlay.style.transition = `opacity ${overlaySpeed}s ${overlayEasing}`;
                    this.overlay.style.opacity = "0";

                    const maxDuration = Math.max(speed, overlaySpeed);
                    const targetDuration = maxDuration > 1 ? maxDuration - 1 : maxDuration;
                    const earlyTime = targetDuration * 1000;
                    const fullTime = maxDuration * 1000;

                    let onCompleteCalled = false;
                    const triggerOnComplete = () => {
                        if (!onCompleteCalled) {
                            onCompleteCalled = true;
                            if (onComplete) onComplete();
                        }
                    };

                    setTimeout(triggerOnComplete, earlyTime);

                    setTimeout(() => {
                        this.overlay.style.transition = "";
                        this.onloadAnimationFrame.style.transition = "";

                        if (!isPreview) {
                            this.overlay.style.pointerEvents = "none";
                            this.onloadAnimationFrame.style.pointerEvents = "none";
                        }

                        triggerOnComplete();

                        document.dispatchEvent(new CustomEvent("onload-animation-complete"));
                    }, fullTime);
                });
            });
        };

        if (isPreview) {
            this.overlay.style.transition = `opacity 0.5s ${overlayEasing}`;
            this.overlay.style.opacity = "1";
            setTimeout(startAnimation, 500);
        } else {
            startAnimation();
        }
    }

    applySettings() {
        const settings = getSettings();
        const localOnloadData = settings.onload || {};
        const presetName = localOnloadData.preset || "default";
        
        const vals = getPresetValues(presetName);
        const bgEasing = localOnloadData.bg_easing ?? "var(--expo_out)";
        const overlayEasing = localOnloadData.overlay_easing ?? "var(--sine_in_out)";

        this.execute(vals.zoom, vals.rotate, vals.blur, vals.speed, bgEasing, vals.overlay_speed, overlayEasing, false);
    }
}

class OnloadSettingsEditor {
    constructor(animator) {
        this.animator = animator;
        this.handlePresetChange = this.handlePresetChange.bind(this);
        this.isDirty = false;
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

        this.isDirty = false;
        this.isInitializing = true;
        this.clone = template.content.cloneNode(true);
        translateDOM(this.clone);

        this.bindElements();
        this.loadCurrentSettings();
        this.setupBindings();

        openSidebarSubmenu(t("onload_anim.window_title"), this.clone, {
            width: "420px",
            canPreview: true,
            isDirty: () => this.isDirty,
            onCancel: () => {
                document.removeEventListener("dropdownChange", this.handlePresetChange);
                if (this.isDirty) {
                    this.isDirty = false;
                    setSubmenuDirty(false);
                }
            }
        });

        initSubsectionSvg();
        this.dispatchInitialEvent();
        this.isDirty = false;
        this.isInitializing = false;
        setSubmenuDirty(false);
    }

    bindElements() {
        this.btnPreview = this.clone.querySelector("#btn_preview");
        this.btnSave = this.clone.querySelector("#btn_save");
    }

    setupBindings() {
        document.addEventListener("dropdownChange", this.handlePresetChange);

        const widgetImmediate = this.clone.querySelector("#widget_immediate");
        if (widgetImmediate) {
            widgetImmediate.addEventListener("change", () => {
                if (!this.isInitializing) {
                    this.isDirty = true;
                    setSubmenuDirty(true);
                }
            });
        }

        if (this.btnPreview) {
            this.btnPreview.addEventListener("mousedown", () => this.handlePreview());
        }

        if (this.btnSave) {
            this.btnSave.addEventListener("mousedown", () => this.handleSave());
        }
    }

    handlePresetChange(e) {
        if (e.detail.id === "onload_preset") {
            if (!this.isInitializing) {
                this.isDirty = true;
                setSubmenuDirty(true);
            }
        }
    }

    handlePreview() {
        const btnPreset = document.getElementById("onload_preset");
        const presetSelected = btnPreset ? btnPreset.getAttribute("data-selected") || "default" : "default";
        const vals = getPresetValues(presetSelected);

        const bgEasing = "var(--expo_out)";
        const overlayEasing = "var(--sine_in_out)";
        const wrapper = document.getElementById("setting_wrapper");

        if (this.btnPreview) this.btnPreview.disabled = true;
        if (this.btnSave) this.btnSave.disabled = true;

        if (wrapper) {
            wrapper.style.transition = "opacity 0.4s ease";
            wrapper.style.opacity = "0";
            wrapper.style.pointerEvents = "none";
        }

        this.animator.execute(vals.zoom, vals.rotate, vals.blur, vals.speed, bgEasing, vals.overlay_speed, overlayEasing, true, () => {
            if (this.btnPreview) this.btnPreview.disabled = false;
            if (this.btnSave) this.btnSave.disabled = false;

            if (wrapper) {
                wrapper.style.opacity = "1";
                wrapper.style.pointerEvents = "";
                setTimeout(() => {
                    wrapper.style.transition = "";
                }, 400);
            }
        });
    }

    handleSave() {
        const widgetImmediate = document.getElementById("widget_immediate")?.checked;
        const btnPreset = document.getElementById("onload_preset");
        const presetSelected = btnPreset ? btnPreset.getAttribute("data-selected") || "default" : "default";

        let currentOnloadData = getSettings().onload || {};
        currentOnloadData.preset = presetSelected;
        currentOnloadData.widget_immediate = widgetImmediate !== false;

        saveSettings({ onload: currentOnloadData });
        showNotification(t("common.saved_changes"), "success");
        this.isDirty = false;
        setSubmenuDirty(false);
    }

    loadCurrentSettings() {
        this.localOnloadData = getSettings().onload || {};

        if (this.localOnloadData.preset === undefined || this.localOnloadData.preset === "custom") {
            this.localOnloadData.preset = "default";
        }
        if (this.localOnloadData.widget_immediate === undefined) {
            this.localOnloadData.widget_immediate = true;
        }

        const widgetImmediateCheck = this.clone.querySelector("#widget_immediate");
        if (widgetImmediateCheck) {
            widgetImmediateCheck.checked = this.localOnloadData.widget_immediate !== false;
        }
    }

    dispatchInitialEvent() {
        const mockEvent = new CustomEvent("dropdownChange", {
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
