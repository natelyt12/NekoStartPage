import { loadHTML, loadCSS, unloadHTML } from "../core/loader.js";
import { getSettings, saveSettings } from "../settings/utils/storagehandler.js";

export async function initWidget() {
    const settings = getSettings();
    const isEnabled = settings.layouts_enabled !== false;

    if (!isEnabled) {
        unloadHTML("widgets_container");
        return;
    }

    // Load style for widget elements
    loadCSS("script/widgets/style.css");

    // Load DOM into #widgets_container
    const success = await loadHTML("widgets_container", "script/widgets/main.html");
    if (success) {
        // Initialize widget scripts (e.g. from script/) here
        console.debug("Widget DOM loaded.");
    }
}

export async function initSettings() {
    // Load setting DOM into #widget_settings_container
    const success = await loadHTML("widget_settings_container", "script/widgets/setting.html");
    if (success) {
        // Initialize widget settings scripts (e.g. from script/) here
        syncWidgetToggle();
    }
}

/**
 * Handle checkbox toggle logic for widget enabling/disabling
 */
function syncWidgetToggle() {
    const settings = getSettings();
    const widgetCheckbox = document.getElementById("layouts_enabled");
    const settingsContainer = document.getElementById("widget_settings_container");

    if (!widgetCheckbox) return;

    // Initial state
    const isEnabled = settings.layouts_enabled !== false;
    widgetCheckbox.checked = isEnabled;
    if (settingsContainer) {
        settingsContainer.style.display = isEnabled ? "block" : "none";
    }

    // Change event
    widgetCheckbox.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        saveSettings({ layouts_enabled: enabled });

        // Toggle settings container visibility
        if (settingsContainer) {
            settingsContainer.style.display = enabled ? "block" : "none";
        }

        // Re-initialize widget visibility
        initWidget();
    });
}
