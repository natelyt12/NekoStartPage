import { initI18n } from "./i18n.js";
import { getSettings } from "./storagehandler.js";
import { loadInitialBackground } from "../wallpaper/bgapi.js";
import { initWidget } from "../widgets/handler.js";
import { initializeWavySettings } from "../wallpaper/bgwavy.js";
import { initializeParticles } from "../wallpaper/particles.js";
import { initAppUtils } from "../settings/system/apputils.js";
import { renderIcons } from "./icon.js";

let settingsLoaded = false;

/**
 * Dynamically loads and initializes the settings panel and its dependencies.
 */
async function loadSettingsPanel() {
    if (settingsLoaded) return;
    settingsLoaded = true;



    // Dynamic import of the settings sub-launcher
    const { initSettingsLauncher } = await import("../settings/setting_handler.js");
    await initSettingsLauncher();

    // Remove preload class and force reflow to guarantee the sliding transition animates on first click
    const wrapper = document.getElementById("setting_wrapper");
    if (wrapper) {
        void wrapper.offsetWidth; // Force layout calculation (reflow)
        wrapper.classList.remove("preload");
    }

    // Re-dispatch a mousedown event on the toggle button so the newly registered
    // event listener inside UI.js opens the settings panel immediately on first click.
    const toggleBtn = document.getElementById("setting_toggle_btn");
    if (toggleBtn) {
        toggleBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
}

/**
 * Initializes the global startup lifecycle for Neko Startpage.
 */
export async function start() {
    // 1. Get initial configuration
    const settings = getSettings();
    const onloadData = settings.onload || {};
    const immediate = onloadData.widget_immediate !== false;

    // Apply saved visual settings immediately on startup
    initAppUtils();
    initializeWavySettings();
    initializeParticles();
    renderIcons();

    // 2. Load core components in parallel (i18n and background wallpaper)
    const i18nPromise = initI18n();
    const bgPromise = loadInitialBackground();

    if (immediate) {
        // Load widgets immediately in parallel with i18n/background
        await Promise.all([
            i18nPromise,
            bgPromise,
            initWidget()
        ]);
    } else {
        // Load widgets only after the entrance animation completes
        await Promise.all([i18nPromise, bgPromise]);
        document.addEventListener("onload-animation-complete", () => {
            initWidget();
        }, { once: true });
    }

    // 3. Register Lazy Loading settings listeners
    const toggleBtn = document.getElementById("setting_toggle_btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("mousedown", loadSettingsPanel);
    }

    // 4. Register global shortcut Alt+X (Resolves original event/trigger bug)
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.code === "KeyX") {
            e.preventDefault();
            const btn = document.getElementById("setting_toggle_btn");
            if (btn) {
                if (!settingsLoaded) {
                    loadSettingsPanel();
                } else {
                    btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                }
            }
        }
    });
}
