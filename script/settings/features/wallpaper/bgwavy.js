import { openCustomPopup, showNotification, createSlider } from "/script/settings/utils/UI.js";
import { saveSettings, getSettings, subscribe } from "/script/settings/utils/storagehandler.js";
import { t, translateDOM } from "/script/core/i18n.js";

let wavyInstance = null;

function createWavyController(element, initialConfig = null) {
    const DEFAULT_CONFIG = {
        speedX: 1.0,
        amplitudeX: 6,
        speedY: 1.2,
        amplitudeY: 6,
        speedRotate: 0.8,
        amplitudeRotate: 0.7,
        scale: 1.03,
    };

    let config = { ...DEFAULT_CONFIG, ...(initialConfig || {}) };
    let animationId = null;
    let startTimestamp = null;
    let isRunning = false;

    function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = (timestamp - startTimestamp) / 1000;

        // Main logic
        const x = ((Math.sin(elapsed * config.speedX) + Math.sin(elapsed * config.speedX * 0.421) * 0.5) / 1.5) * config.amplitudeX;
        const y = ((Math.cos(elapsed * config.speedY) + Math.sin(elapsed * config.speedY * 0.613) * 0.5) / 1.5) * config.amplitudeY;
        const rot = ((Math.sin(elapsed * config.speedRotate) + Math.sin(elapsed * config.speedRotate * 0.543) * 0.5) / 1.5) * config.amplitudeRotate;

        element.style.transform = `
            translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) 
            rotate(${rot}deg) 
            scale(${config.scale})
        `;

        if (isRunning) {
            animationId = requestAnimationFrame(step);
        }
    }

    return {
        updateConfig(newConfig) {
            config = { ...config, ...newConfig };
        },
        getConfig() {
            return { ...config };
        },
        getDefaultConfig() {
            return { ...DEFAULT_CONFIG };
        },
        start() {
            if (isRunning) return;
            isRunning = true;
            startTimestamp = null;
            animationId = requestAnimationFrame(step);
        },
        stop(resetPosition = true) {
            isRunning = false;
            if (animationId) cancelAnimationFrame(animationId);
            animationId = null;
            if (resetPosition) {
                element.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
            }
        },
        get isActive() {
            return isRunning;
        },
    };
}

// 1. Subscribe reactively to "wavy" setting changes
subscribe("wavy", (wavyConfig) => {
    const wavyLayer = document.querySelector(".wavy");
    if (!wavyLayer) return;

    if (!wavyInstance) {
        wavyInstance = createWavyController(wavyLayer, wavyConfig.config);
    } else {
        wavyInstance.updateConfig(wavyConfig.config);
    }

    if (wavyConfig.enabled) {
        wavyInstance.start();
    } else {
        wavyInstance.stop();
    }
});

/**
 * Initialize Wavy settings panel and bind to the specific DOM elements.
 * Reads start conditions from storage and mounts the wavy toggle checkbox.
 */
export function initializeWavySettings() {
    const toggle = document.getElementById("wavy_animation");
    const editBtn = document.getElementById("edit_wavy_settings");

    if (toggle) {
        toggle.checked = getSettings().wavy.enabled;

        // Clean up previous event listeners by using a direct override or standard listeners
        toggle.onchange = (e) => {
            const isChecked = e.target.checked;
            const currentWavyData = getSettings().wavy;
            currentWavyData.enabled = isChecked;
            saveSettings({ wavy: currentWavyData });
        };
    }
    if (editBtn) {
        editBtn.onmousedown = () => openWavyEditor();
    }
}

function openWavyEditor() {
    const template = document.getElementById("tpl_wavy_settings");
    const clone = template.content.cloneNode(true);
    translateDOM(clone);
    const container = clone.querySelector("#wavy_sliders_container");
    const btnPreview = clone.querySelector("#btn_preview");
    const btnSave = clone.querySelector("#btn_save");
    const btnReset = clone.querySelector("#btn_reset");
    const btnRandom = clone.querySelector("#btn_random");

    const startConfig = wavyInstance.getConfig();
    const defaults = wavyInstance.getDefaultConfig();
    const wasRunning = wavyInstance.isActive;
    let isDirty = false;
    let canExit = false;
    let exitTimer = null;

    const sliders = {};
    const groupsConfig = [
        {
            tooltipKey: "wavy_editor.amp_x_tooltip",
            sliders: [
                { id: "amplitudeX", label: t("wavy_editor.amp_x"), min: 0, max: 10, step: 1, defaultValue: defaults.amplitudeX, unit: "px" },
                { id: "speedX", label: t("wavy_editor.speed_x"), min: 0.1, max: 4.0, step: 0.1, defaultValue: defaults.speedX, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy_editor.amp_y_tooltip",
            sliders: [
                { id: "amplitudeY", label: t("wavy_editor.amp_y"), min: 0, max: 10, step: 1, defaultValue: defaults.amplitudeY, unit: "px" },
                { id: "speedY", label: t("wavy_editor.speed_y"), min: 0.1, max: 4.0, step: 0.1, defaultValue: defaults.speedY, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy_editor.rot_tooltip",
            sliders: [
                { id: "amplitudeRotate", label: t("wavy_editor.rot_angle"), min: 0, max: 3, step: 0.1, defaultValue: defaults.amplitudeRotate, unit: "deg" },
                { id: "speedRotate", label: t("wavy_editor.rot_speed"), min: 0, max: 3.0, step: 0.1, defaultValue: defaults.speedRotate, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy_editor.scale_tooltip",
            sliders: [
                { id: "scale", label: t("wavy_editor.scale"), min: 1.00, max: 1.20, step: 0.01, defaultValue: defaults.scale, unit: "x" }
            ]
        }
    ];

    if (container) {
        container.innerHTML = "";
        groupsConfig.forEach((group, index) => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "wavy_control_group";
            groupDiv.style.display = "flex";
            groupDiv.style.flexDirection = "column";
            groupDiv.style.gap = "6px";

            group.sliders.forEach(spec => {
                const sliderComponent = createSlider({
                    label: spec.label,
                    min: spec.min,
                    max: spec.max,
                    step: spec.step,
                    value: startConfig[spec.id] ?? spec.defaultValue,
                    defaultValue: spec.defaultValue,
                    unit: spec.unit,
                    onChange: () => {
                        isDirty = true;
                    }
                });
                groupDiv.appendChild(sliderComponent);
                sliders[spec.id] = sliderComponent;
            });

            // Add the tooltip
            const tooltipSpan = document.createElement("span");
            tooltipSpan.className = "tooltip";
            tooltipSpan.setAttribute("data-i18n", group.tooltipKey);
            tooltipSpan.innerHTML = t(group.tooltipKey);
            groupDiv.appendChild(tooltipSpan);

            container.appendChild(groupDiv);

            // Add separator unless it's the last group
            if (index < groupsConfig.length - 1) {
                const hr = document.createElement("hr");
                container.appendChild(hr);
            }
        });
    }

    const setInputs = (cfg) => {
        for (const [key, val] of Object.entries(cfg)) {
            if (sliders[key]) {
                sliders[key].value = val;
            }
        }
    };

    const getInputs = () => {
        let newCfg = {};
        for (const [key, slider] of Object.entries(sliders)) {
            newCfg[key] = slider.value;
        }
        return newCfg;
    };

    btnReset.onmousedown = () => {
        const def = wavyInstance.getDefaultConfig();
        setInputs(def);
        isDirty = true;
        showNotification(t("wavy_editor.reset_success"), "success");
    };

    if (btnRandom) {
        btnRandom.onmousedown = () => {
            const randomConfig = {
                amplitudeX: Math.floor(Math.random() * 11), // 0 to 10
                speedX: parseFloat((Math.random() * (4.0 - 0.1) + 0.1).toFixed(1)), // 0.1 to 4.0
                amplitudeY: Math.floor(Math.random() * 11), // 0 to 10
                speedY: parseFloat((Math.random() * (4.0 - 0.1) + 0.1).toFixed(1)), // 0.1 to 4.0
                amplitudeRotate: parseFloat((Math.random() * 3).toFixed(1)), // 0 to 3
                speedRotate: parseFloat((Math.random() * 3).toFixed(1)), // 0 to 3.0
                scale: parseFloat((Math.random() * (1.20 - 1.00) + 1.00).toFixed(2)) // 1.00 to 1.20
            };
            setInputs(randomConfig);
            isDirty = true;
        };
    }

    btnPreview.onmousedown = () => {
        const newConfig = getInputs();
        wavyInstance.updateConfig(newConfig);
        if (!wavyInstance.isActive) wavyInstance.start();
    };

    let isSaved = false;
    let popup = null;
    btnSave.onmousedown = () => {
        const finalConfig = getInputs();
        isSaved = true;
        isDirty = false;
        showNotification(t("alert.saved_changes"), "success");
        wavyInstance.updateConfig(finalConfig);
        let currentWavyData = getSettings().wavy;
        currentWavyData.config = finalConfig;

        saveSettings({ wavy: currentWavyData });

        if (!currentWavyData.enabled) {
            wavyInstance.stop();
        }
        if (popup && popup.closeBtn) {
            popup.closeBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        }
    };

    popup = openCustomPopup(t("wavy_editor.window_title"), clone, "420px", { id: "wavy_settings", isAlert: false, canClose: true, hideUI: true });

    const closeBtn = popup.closeBtn;
    if (closeBtn) {
        const handleBeforeClose = (e) => {
            if (isDirty && !canExit) {
                e.preventDefault();
                showNotification(t("alert.unsaved_changes"), "warning");
                canExit = true;

                if (exitTimer) clearTimeout(exitTimer);
                exitTimer = setTimeout(() => {
                    canExit = false;
                }, 5000);
            } else {
                if (!isSaved) {
                    wavyInstance.updateConfig(startConfig);
                    if (!wasRunning) wavyInstance.stop();
                }
                closeBtn.removeEventListener("popupBeforeClose", handleBeforeClose);
            }
        };
        closeBtn.addEventListener("popupBeforeClose", handleBeforeClose);
    }
}

/**
 * Turn visibility of the wavy animation setting section ON or OFF.
 * @param {boolean} state - True to display, false to hide.
 */
export function toggleWavyVisibility(state) {
    const toggle = document.getElementById("wavy_animation");
    if (!toggle) return;

    const section = toggle.closest(".setting_section");
    if (!section) return;

    section.style.display = state ? "block" : "none";
}
