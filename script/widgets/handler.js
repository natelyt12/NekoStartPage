import { loadHTML, loadCSS, unloadHTML } from "/script/core/loader.js";
import { getSettings, saveSettings, subscribe } from "/script/settings/utils/storagehandler.js";

export async function initWidget() {
    const isEnabled = getSettings().widgets_enabled !== false;

    if (!isEnabled) {
        unloadHTML("widgets_container");
        return;
    }

    // Natural DOM-based check: if container already has children, it is already loaded
    const container = document.getElementById("widgets_container");
    if (container && container.children.length > 0) {
        return;
    }

    // Load style for widget elements
    loadCSS("script/widgets/style.css");

    // Load DOM into #widgets_container
    const success = await loadHTML("widgets_container", "script/widgets/main.html");
    if (success) {
        console.debug("Widget DOM loaded.");
    }
}

export async function initSettings() {
    // Just sync the toggle checkbox, do not load the empty setting.html which overwrites widgets_container
    syncWidgetToggle();
}

/**
 * Handle checkbox toggle logic for widget enabling/disabling
 */
function syncWidgetToggle() {
    const widgetCheckbox = document.getElementById("widgets_enabled");
    if (!widgetCheckbox) return;

    // Reactively subscribe to "widgets_enabled" only when settings panel is open
    // Since subscribe() immediately triggers, it will sync the checkbox value too
    subscribe("widgets_enabled", (isEnabled) => {
        const enabled = isEnabled !== false;
        if (enabled) {
            initWidget();
        } else {
            unloadHTML("widgets_container");
        }
        widgetCheckbox.checked = enabled;
    });

    widgetCheckbox.onchange = (e) => {
        saveSettings({ widgets_enabled: e.target.checked });
    };
}
