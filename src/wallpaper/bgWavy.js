import { openSidebarSubmenu, closeSidebarSubmenu, setSubmenuDirty, showNotification, createSlider } from "/src/core/ui.js";
import { saveSettings, getSettings, subscribe } from "/src/core/storageHandler.js";
import { t, translateDOM } from "/src/core/i18n.js";

let wavyInstance = null;

function createWavyController(element, initialConfig = null) {
    const DEFAULT_CONFIG = {
        speedX: 1.0,
        amplitudeX: 6,
        speedY: 1.2,
        amplitudeY: 6,
        speedRotate: 0.8,
        amplitudeRotate: 0.7,
        scale: 1.05,
        parallaxInertia: 0.03,
        parallaxAmplitude: -30,
    };

    let config = { ...DEFAULT_CONFIG, ...(initialConfig || {}) };
    let animationId = null;
    let startTimestamp = null;
    let timeOffset = Math.random() * 1000;
    let isActive = false;

    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    // pointermove fires reliably even when a mouse button is held down on another element,
    // unlike mousemove which can be blocked by pointer capture during mousedown.
    window.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return; // ignore touch/pen to avoid conflicts
        targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = (timestamp - startTimestamp) / 1000 + timeOffset;

        const inertia = config.parallaxInertia !== undefined ? config.parallaxInertia : 0.025;
        mouseX += (targetMouseX - mouseX) * inertia;
        mouseY += (targetMouseY - mouseY) * inertia;

        const isWavyOn = config.enabled !== false;
        const isParallaxOn = config.parallaxEnabled === true;

        const x = isWavyOn ? (((Math.sin(elapsed * config.speedX) + Math.sin(elapsed * config.speedX * 0.421) * 0.5) / 1.5) * config.amplitudeX) : 0;
        const y = isWavyOn ? (((Math.cos(elapsed * config.speedY) + Math.sin(elapsed * config.speedY * 0.613) * 0.5) / 1.5) * config.amplitudeY) : 0;
        const rot = isWavyOn ? (((Math.sin(elapsed * config.speedRotate) + Math.sin(elapsed * config.speedRotate * 0.543) * 0.5) / 1.5) * config.amplitudeRotate) : 0;

        // Dynamic Wallpaper Mouse Parallax Shift
        const parallaxAmp = isParallaxOn ? (config.parallaxAmplitude !== undefined ? config.parallaxAmplitude : -15) : 0;
        const parallaxX = mouseX * parallaxAmp;
        const parallaxY = mouseY * (parallaxAmp * 0.65);

        const totalX = x + parallaxX;
        const totalY = y + parallaxY;

        element.style.transform = `
            translate(calc(-50% + ${totalX}px), calc(-50% + ${totalY}px)) 
            rotate(${rot}deg) 
            scale(${config.scale})
        `;

        if (isActive) {
            animationId = requestAnimationFrame(animate);
        }
    }

    function start() {
        if (isActive) return;
        isActive = true;
        startTimestamp = null;
        timeOffset = Math.random() * 1000;
        animationId = requestAnimationFrame(animate);
    }

    function stop(resetPosition = true) {
        isActive = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (resetPosition) {
            element.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
        }
    }

    function updateConfig(newConfig) {
        config = { ...config, ...newConfig };
    }

    function getConfig() {
        return { ...config };
    }

    function getDefaultConfig() {
        return { ...DEFAULT_CONFIG };
    }

    return {
        start,
        stop,
        updateConfig,
        getConfig,
        getDefaultConfig,
        get isActive() { return isActive; },
        // Single Source of Truth: smoothed mouse state for all parallax consumers
        getSmoothedMouse() { return { mouseX, mouseY }; }
    };
}

export function getWavyParallaxState() {
    if (!wavyInstance) {
        const wavySettings = getSettings().wavy || {};
        const wavyConfig = wavySettings.config || {};
        const isParallaxOn = wavySettings.parallaxEnabled === true;
        return {
            enabled: isParallaxOn,
            inertia: wavyConfig.parallaxInertia !== undefined ? Number(wavyConfig.parallaxInertia) : 0.03,
            amplitude: isParallaxOn ? (wavyConfig.parallaxAmplitude !== undefined ? Number(wavyConfig.parallaxAmplitude) : -30) : 0
        };
    }
    const currentConfig = wavyInstance.getConfig();
    const isParallaxOn = currentConfig.parallaxEnabled === true;
    return {
        enabled: isParallaxOn,
        inertia: currentConfig.parallaxInertia !== undefined ? Number(currentConfig.parallaxInertia) : 0.03,
        amplitude: isParallaxOn ? (currentConfig.parallaxAmplitude !== undefined ? Number(currentConfig.parallaxAmplitude) : -30) : 0
    };
}

/**
 * Returns the already-lerped mouse position from the wavy animation loop.
 * This is the Single Source of Truth for parallax across wallpaper + particles.
 * Always safe to call — returns {0,0} if the wavy controller hasn't started yet.
 */
export function getSmoothedMouse() {
    if (!wavyInstance) return { mouseX: 0, mouseY: 0 };
    return wavyInstance.getSmoothedMouse();
}

// 1. Subscribe reactively to "wavy" setting changes
subscribe("wavy", (wavyConfig) => {
    const wavyLayer = document.querySelector(".wavy");
    if (!wavyLayer) return;

    const fullConfig = {
        ...(wavyConfig.config || {}),
        enabled: wavyConfig.enabled !== false,
        parallaxEnabled: wavyConfig.parallaxEnabled === true
    };

    if (!wavyInstance) {
        wavyInstance = createWavyController(wavyLayer, fullConfig);
    } else {
        wavyInstance.updateConfig(fullConfig);
    }

    if (fullConfig.enabled || fullConfig.parallaxEnabled) {
        wavyInstance.start();
    } else {
        wavyInstance.stop();
    }
});

/**
 * Initialize Wavy settings panel and bind to the specific DOM elements.
 */
export function initializeWavySettings() {
    const editWavyBtn = document.getElementById("edit_wavy_settings");
    if (editWavyBtn) {
        editWavyBtn.onmousedown = () => openWavyEditor();
    }
}

function openWavyEditor() {
    const template = document.getElementById("tpl_wavy_settings");
    if (!template) return;

    let isDirty = false;
    const markDirty = () => {
        isDirty = true;
        setSubmenuDirty(true);
    };

    const clone = template.content.cloneNode(true);
    translateDOM(clone);

    const toggleWavy = clone.querySelector("#wavy_animation");
    if (toggleWavy) {
        toggleWavy.checked = getSettings().wavy?.enabled !== false;
        toggleWavy.onchange = (e) => {
            const isChecked = e.target.checked;
            const currentWavyData = getSettings().wavy || {};
            currentWavyData.enabled = isChecked;
            saveSettings({ wavy: currentWavyData });
            wavyInstance.updateConfig({ enabled: isChecked });
            if (isChecked || currentWavyData.parallaxEnabled === true) {
                if (!wavyInstance.isActive) wavyInstance.start();
            } else {
                wavyInstance.stop();
            }
        };
    }

    const toggleParallax = clone.querySelector("#parallax_animation");
    if (toggleParallax) {
        toggleParallax.checked = getSettings().wavy?.parallaxEnabled === true;
        toggleParallax.onchange = (e) => {
            const isChecked = e.target.checked;
            const currentWavyData = getSettings().wavy || {};
            currentWavyData.parallaxEnabled = isChecked;
            saveSettings({ wavy: currentWavyData });
            wavyInstance.updateConfig({ parallaxEnabled: isChecked });
            if (isChecked || currentWavyData.enabled !== false) {
                if (!wavyInstance.isActive) wavyInstance.start();
            } else {
                wavyInstance.stop();
            }
        };
    }

    const wavyContainer = clone.querySelector("#wavy_sliders_container");
    const parallaxContainer = clone.querySelector("#parallax_sliders_container");

    const btnWavyReset = clone.querySelector("#btn_wavy_reset");
    const btnWavyRandom = clone.querySelector("#btn_wavy_random");
    const btnWavySave = clone.querySelector("#btn_wavy_save");

    const btnParallaxReset = clone.querySelector("#btn_parallax_reset");
    const btnParallaxSave = clone.querySelector("#btn_parallax_save");

    let startConfig = wavyInstance.getConfig();
    const defaults = wavyInstance.getDefaultConfig();

    const sliders = {};

    const wavyGroups = [
        {
            tooltipKey: "wavy.amp_x_tooltip",
            sliders: [
                { id: "amplitudeX", label: t("wavy.amp_x"), min: 0, max: 10, step: 1, defaultValue: defaults.amplitudeX, unit: "px" },
                { id: "speedX", label: t("wavy.speed_x"), min: 0.1, max: 4.0, step: 0.1, defaultValue: defaults.speedX, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy.amp_y_tooltip",
            sliders: [
                { id: "amplitudeY", label: t("wavy.amp_y"), min: 0, max: 10, step: 1, defaultValue: defaults.amplitudeY, unit: "px" },
                { id: "speedY", label: t("wavy.speed_y"), min: 0.1, max: 4.0, step: 0.1, defaultValue: defaults.speedY, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy.rot_tooltip",
            sliders: [
                { id: "amplitudeRotate", label: t("wavy.rot_angle"), min: 0, max: 3, step: 0.1, defaultValue: defaults.amplitudeRotate, unit: "deg" },
                { id: "speedRotate", label: t("wavy.rot_speed"), min: 0, max: 3.0, step: 0.1, defaultValue: defaults.speedRotate, unit: "x" }
            ]
        },
        {
            tooltipKey: "wavy.scale_tooltip",
            sliders: [
                { id: "scale", label: t("wavy.scale"), min: 1.00, max: 1.20, step: 0.01, defaultValue: defaults.scale, unit: "x" }
            ]
        }
    ];

    const parallaxGroups = [
        {
            sliders: [
                { id: "parallaxInertia", label: t("wavy.parallax_inertia") || "Độ nặng", min: 0.005, max: 0.1, step: 0.005, defaultValue: defaults.parallaxInertia, unit: "" },
                { id: "parallaxAmplitude", label: t("wavy.parallax_amplitude") || "Biên độ bám chuột", min: -60, max: 60, step: 1, defaultValue: defaults.parallaxAmplitude, unit: "px" }
            ]
        }
    ];

    const applyLivePreview = () => {
        const newConfig = getInputs();
        wavyInstance.updateConfig(newConfig);
        if (!wavyInstance.isActive && (getSettings().wavy?.enabled !== false || getSettings().wavy?.parallaxEnabled !== false)) {
            wavyInstance.start();
        }
        markDirty();
    };

    const renderGroups = (targetContainer, groups) => {
        if (!targetContainer) return;
        targetContainer.innerHTML = "";
        groups.forEach((group, index) => {
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
                    onChange: applyLivePreview
                });
                groupDiv.appendChild(sliderComponent);
                sliders[spec.id] = sliderComponent;
            });

            // Add the tooltip if group specifies one
            if (group.tooltipKey) {
                const tooltipSpan = document.createElement("span");
                tooltipSpan.className = "tooltip";
                tooltipSpan.setAttribute("data-i18n", group.tooltipKey);
                tooltipSpan.innerHTML = t(group.tooltipKey);
                groupDiv.appendChild(tooltipSpan);
            }

            targetContainer.appendChild(groupDiv);

            if (index < groups.length - 1) {
                const divider = document.createElement("div");
                divider.className = "section_divider";
                targetContainer.appendChild(divider);
            }
        });
    };

    renderGroups(wavyContainer, wavyGroups);
    renderGroups(parallaxContainer, parallaxGroups);

    const getInputs = () => {
        let newCfg = {};
        for (const [key, slider] of Object.entries(sliders)) {
            newCfg[key] = slider.value;
        }
        return newCfg;
    };

    const saveCurrentConfig = () => {
        const finalConfig = getInputs();
        showNotification(t("common.saved_changes"), "success");
        wavyInstance.updateConfig(finalConfig);
        let currentWavyData = getSettings().wavy || {};
        currentWavyData.config = finalConfig;

        saveSettings({ wavy: currentWavyData });

        startConfig = { ...finalConfig };
        isDirty = false;
        setSubmenuDirty(false);
    };

    if (btnWavyReset) {
        btnWavyReset.onmousedown = () => {
            const wavyKeys = ["amplitudeX", "speedX", "amplitudeY", "speedY", "amplitudeRotate", "speedRotate", "scale"];
            wavyKeys.forEach(k => {
                if (sliders[k]) sliders[k].value = defaults[k];
            });
            applyLivePreview();
            showNotification(t("wavy.reset_success"), "success");
        };
    }

    if (btnWavyRandom) {
        btnWavyRandom.onmousedown = () => {
            const randomConfig = {
                amplitudeX: Math.floor(Math.random() * 11),
                speedX: parseFloat((Math.random() * (4.0 - 0.1) + 0.1).toFixed(1)),
                amplitudeY: Math.floor(Math.random() * 11),
                speedY: parseFloat((Math.random() * (4.0 - 0.1) + 0.1).toFixed(1)),
                amplitudeRotate: parseFloat((Math.random() * 3).toFixed(1)),
                speedRotate: parseFloat((Math.random() * 3).toFixed(1)),
            };
            for (const [k, v] of Object.entries(randomConfig)) {
                if (sliders[k]) sliders[k].value = v;
            }
            applyLivePreview();
        };
    }

    if (btnWavySave) {
        btnWavySave.onmousedown = saveCurrentConfig;
    }

    if (btnParallaxReset) {
        btnParallaxReset.onmousedown = () => {
            if (sliders.parallaxInertia) sliders.parallaxInertia.value = defaults.parallaxInertia;
            if (sliders.parallaxAmplitude) sliders.parallaxAmplitude.value = defaults.parallaxAmplitude;
            applyLivePreview();
            showNotification(t("wavy.reset_success"), "success");
        };
    }

    if (btnParallaxSave) {
        btnParallaxSave.onmousedown = saveCurrentConfig;
    }

    openSidebarSubmenu(t("wavy.window_title"), clone, {
        width: "420px",
        canPreview: true,
        isDirty: () => isDirty,
        onCancel: () => {
            if (isDirty) {
                wavyInstance.updateConfig(startConfig);
                isDirty = false;
                setSubmenuDirty(false);
            }
        }
    });
}

/**
 * Turn visibility of the wavy animation setting section ON or OFF.
 * @param {boolean} state - True to display, false to hide.
 */
export function toggleWavyVisibility(state) {
    const editBtn = document.getElementById("edit_wavy_settings");
    if (editBtn) {
        editBtn.style.display = state ? "inline-flex" : "none";
        const tooltip = editBtn.nextElementSibling;
        if (tooltip && tooltip.classList.contains("tooltip")) {
            tooltip.style.display = state ? "block" : "none";
        }
    }
}
