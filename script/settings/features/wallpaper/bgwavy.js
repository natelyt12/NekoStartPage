import { openCustomPopup, showNotification } from "/script/settings/utils/UI.js";
import { saveSettings, getSettings } from "/script/settings/utils/storagehandler.js";
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

/**
 * Initialize Wavy settings panel and bind to the specific DOM element that has the wavy class.
 * Reads start conditions from storage and mounts the wavy toggle checkbox.
 */
export function initializeWavySettings() {
    const wavyLayer = document.querySelector(".wavy");
    const toggle = document.getElementById("wavy_animation");
    const editBtn = document.getElementById("edit_wavy_settings");

    let localWavyData = getSettings().wavy;

    if (!wavyLayer) return;

    wavyInstance = createWavyController(wavyLayer, localWavyData.config);

    const syncUI = (isEnabled) => {
        if (isEnabled) {
            wavyInstance.start();
        } else {
            wavyInstance.stop();
        }
    };

    if (toggle) {
        toggle.checked = localWavyData.enabled;

        syncUI(localWavyData.enabled);

        toggle.addEventListener("change", (e) => {
            const isChecked = e.target.checked;

            let currentWavyData = getSettings().wavy;
            currentWavyData.enabled = isChecked;

            syncUI(isChecked);
            saveSettings({ wavy: currentWavyData });
        });
    }
    if (editBtn) {
        editBtn.onmousedown = () => openWavyEditor();
    }
}

function openWavyEditor() {
    const template = document.getElementById("tpl_wavy_settings");
    const clone = template.content.cloneNode(true);
    translateDOM(clone);
    const inputs = clone.querySelectorAll("input.input_number");
    const btnPreview = clone.querySelector("#btn_preview");
    const btnSave = clone.querySelector("#btn_save");
    const btnReset = clone.querySelector("#btn_reset");
    const btnRandom = clone.querySelector("#btn_random");

    const startConfig = wavyInstance.getConfig();
    const wasRunning = wavyInstance.isActive;
    let isDirty = false;
    let canExit = false;
    let exitTimer = null;

    inputs.forEach((input) => {
        input.addEventListener("input", () => {
            isDirty = true;
        });
    });

    const setInputs = (cfg) => {
        inputs.forEach((input) => {
            const key = input.dataset.key;
            if (cfg[key] !== undefined) input.value = cfg[key];
        });
    };

    const getInputs = () => {
        let newCfg = {};
        inputs.forEach((input) => {
            const key = input.dataset.key;
            let val = parseFloat(input.value);
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);
            if (val < min) val = min;
            if (val > max) val = max;
            newCfg[key] = val;
        });
        return newCfg;
    };

    setInputs(startConfig);

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

    popup = openCustomPopup(t("wavy_editor.window_title"), clone, "400px", { id: "wavy_settings", isAlert: false, canClose: true, hideUI: true });

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
