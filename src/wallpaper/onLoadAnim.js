import { openSidebarSubmenu, closeSidebarSubmenu, setSubmenuDirty, showNotification, createSlider } from "/src/core/ui.js";
import { t, translateDOM } from "/src/core/i18n.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";

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

        const zoom = localOnloadData.zoom || 1;
        const rotate = localOnloadData.rotate || 0;
        const blur = localOnloadData.blur || 0;
        const speed = localOnloadData.speed || 1;
        const bgEasing = localOnloadData.bg_easing || "var(--expo_out)";
        const overlaySpeed = localOnloadData.overlay_speed || 0.8;
        const overlayEasing = localOnloadData.overlay_easing || "var(--sine_in_out)";

        this.execute(zoom, rotate, blur, speed, bgEasing, overlaySpeed, overlayEasing, false);
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
        this.setupSliders();
        this.setupBindings();

        openSidebarSubmenu(t("onload_anim.window_title"), this.clone, {
            width: "420px",
            canPreview: true,
            isDirty: () => this.isDirty,
            onCancel: () => {
                document.removeEventListener("subsectionChange", this.handlePresetChange);
                if (this.isDirty) {
                    this.isDirty = false;
                    setSubmenuDirty(false);
                }
            }
        });

        import("/src/core/ui.js").then(({ initSubsectionSvg }) => initSubsectionSvg());
        this.dispatchInitialEvent();
        this.isDirty = false;
        this.isInitializing = false;
        setSubmenuDirty(false);
    }

    bindElements() {
        this.bgSlidersContainer = this.clone.querySelector("#onload_bg_sliders");
        this.overlaySlidersContainer = this.clone.querySelector("#onload_overlay_sliders");
        this.btnPreview = this.clone.querySelector("#btn_preview");
        this.btnSave = this.clone.querySelector("#btn_save");
    }

    markAsCustom() {
        if (this.isInitializing) return;
        this.isDirty = true;
        setSubmenuDirty(true);
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
        const bgSpecs = [
            { id: "zoom", label: t("onload_anim.zoom_label"), min: 1, max: 3, step: 0.01, defaultValue: 1, unit: "%" },
            { id: "blur", label: t("onload_anim.blur_label"), min: 0, max: 30, step: 1, defaultValue: 0, unit: "%" },
            { id: "rotate", label: t("onload_anim.rotate_label"), min: -45, max: 45, step: 0.1, defaultValue: 0, unit: "deg" },
            { id: "speed", label: t("onload_anim.speed_label"), min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: "s" },
        ];
        const overlaySpecs = [
            { id: "overlay_speed", label: t("onload_anim.overlay_speed_label"), min: 0.1, max: 5, step: 0.1, defaultValue: 0.8, unit: "s" },
        ];

        this.sliders = {};

        if (this.bgSlidersContainer) {
            this.bgSlidersContainer.innerHTML = "";
            bgSpecs.forEach((spec) => {
                const sliderComponent = createSlider({
                    label: spec.label,
                    min: spec.min,
                    max: spec.max,
                    step: spec.step,
                    value: this.localOnloadData[spec.id] ?? spec.defaultValue,
                    defaultValue: spec.defaultValue,
                    unit: spec.unit,
                    onChange: () => this.markAsCustom(),
                });
                this.bgSlidersContainer.appendChild(sliderComponent);
                this.sliders[spec.id] = sliderComponent;
            });
        }

        if (this.overlaySlidersContainer) {
            this.overlaySlidersContainer.innerHTML = "";
            overlaySpecs.forEach((spec) => {
                const sliderComponent = createSlider({
                    label: spec.label,
                    min: spec.min,
                    max: spec.max,
                    step: spec.step,
                    value: this.localOnloadData[spec.id] ?? spec.defaultValue,
                    defaultValue: spec.defaultValue,
                    unit: spec.unit,
                    onChange: () => this.markAsCustom(),
                });
                this.overlaySlidersContainer.appendChild(sliderComponent);
                this.sliders[spec.id] = sliderComponent;
            });
        }
    }

    setupBindings() {
        document.addEventListener("subsectionChange", this.handlePresetChange);

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
            let presetValues = null;

            switch (e.detail.value) {
                case "default":
                    presetValues = { zoom: 1, rotate: 0, blur: 0, speed: 1, overlay_speed: 0.8 };
                    break;
                case "zoom_in_light":
                    presetValues = { zoom: 1.2, rotate: 0, blur: 10, speed: 3, overlay_speed: 1 };
                    break;
                case "zoom_in_heavy":
                    presetValues = { zoom: 2.4, rotate: 20, blur: 16, speed: 2.6, overlay_speed: 1 };
                    break;
                case "sleepy":
                    presetValues = { zoom: 1.3, rotate: 0, blur: 30, speed: 5, overlay_speed: 2.5 };
                    break;
                case "nature":
                    presetValues = { zoom: 2, rotate: -10, blur: 15, speed: 5, overlay_speed: 1 };
                    break;
            }

            if (presetValues) {
                for (const [key, val] of Object.entries(presetValues)) {
                    if (this.sliders && this.sliders[key]) {
                        this.sliders[key].value = val;
                    }
                }
                if (!this.isInitializing) {
                    this.isDirty = true;
                    setSubmenuDirty(true);
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

        this.animator.execute(zoom, rotate, blur, speed, bgEasing, overlaySpeed, overlayEasing, true, () => {
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
        const zoom = parseFloat(this.sliders?.zoom?.value ?? 1);
        const rotate = parseFloat(this.sliders?.rotate?.value ?? 0);
        const blur = parseFloat(this.sliders?.blur?.value ?? 0);
        const speed = parseFloat(this.sliders?.speed?.value ?? 1);
        const overlaySpeed = parseFloat(this.sliders?.overlay_speed?.value ?? 1);
        const bgEasing = "var(--expo_out)";
        const overlayEasing = "var(--sine_in_out)";
        const widgetImmediate = document.getElementById("widget_immediate")?.checked;

        const btnPreset = document.getElementById("onload_preset");
        const presetSelected = btnPreset ? btnPreset.getAttribute("data-selected") || "custom" : "custom";

        let currentOnloadData = getSettings().onload || {};
        currentOnloadData.preset = presetSelected;
        currentOnloadData.zoom = zoom;
        currentOnloadData.rotate = rotate;
        currentOnloadData.blur = blur;
        currentOnloadData.speed = speed;
        currentOnloadData.bg_easing = bgEasing;
        currentOnloadData.overlay_speed = overlaySpeed;
        currentOnloadData.overlay_easing = overlayEasing;
        currentOnloadData.widget_immediate = widgetImmediate !== false;

        saveSettings({ onload: currentOnloadData });
        showNotification(t("common.saved_changes"), "success");
        this.isDirty = false;
        setSubmenuDirty(false);
    }

    loadCurrentSettings() {
        this.localOnloadData = getSettings().onload || {};

        if (this.localOnloadData.preset === undefined) this.localOnloadData.preset = "default";
        if (this.localOnloadData.zoom === undefined) this.localOnloadData.zoom = 1;
        if (this.localOnloadData.rotate === undefined) this.localOnloadData.rotate = 0;
        if (this.localOnloadData.blur === undefined) this.localOnloadData.blur = 0;
        if (this.localOnloadData.speed === undefined) this.localOnloadData.speed = 1;
        this.localOnloadData.bg_easing = "var(--expo_out)";
        if (this.localOnloadData.overlay_speed === undefined) this.localOnloadData.overlay_speed = 0.8;
        this.localOnloadData.overlay_easing = "var(--sine_in_out)";
        if (this.localOnloadData.widget_immediate === undefined) this.localOnloadData.widget_immediate = true;

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
