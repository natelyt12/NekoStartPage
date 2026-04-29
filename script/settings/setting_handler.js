import { loadHTML } from "/script/core/loader.js";
import { initSvgs, initToggleSettingBtn, initSubToggle, initPopupAlert, showNotification } from "/script/settings/utils/UI.js";
import { t, translateDOM, initI18n } from "/script/core/i18n.js";
import {
    initBgAPIFeatures,
    InitBGEditor,
    initializeWavySettings,
    initializeOnloadSettings,
    initializeParticles,
    initializeFilterSettings
} from "/script/settings/features/wallpaper/index.js";
import { initAppUtils, initDebugSettings } from "/script/settings/features/system/index.js";
import { initWeatherSettings, initTimeSettings } from "/script/settings/features/widgets/index.js";
import { getSettings, saveSettings } from "/script/settings/utils/storagehandler.js";
import { initSettings as initWidgetSettings } from "/script/widgets/handler.js";

const success = await loadHTML("setting_wrapper", "script/settings/settings.html");
if (success) {
    // RENDER SETTINGS UI
    translateDOM(document.getElementById("setting_wrapper"));

    // --- 1. LOAD SETTINGS FROM STORAGE ---
    const settings = getSettings();
    console.debug("Loaded settings", settings);

    // --- 2. INIT UI & EVENTS ---
    initSubToggle();
    initSvgs();
    initToggleSettingBtn();
    initPopupAlert();
    initSettingsNav();

    // --- 3. INIT FEATURES ---
    initBgAPIFeatures();
    InitBGEditor();
    initializeWavySettings();
    initAppUtils();
    initWeatherSettings();
    initTimeSettings();
    initializeOnloadSettings();
    initializeParticles();
    initializeFilterSettings();
    initWidgetSettings();
    initDebugSettings();

    // --- 4. RESTORE UI STATES FROM STORAGE ---
    const restoreStates = [
        { id: "wallpaperRotation", value: settings.wallpaperConfig.rotation },
        { id: "API_selector", value: settings.wallpaperConfig.source },
        { id: "wh_resolution", value: settings.wallhavenConfig?.resolution || "" },
        { id: "language", value: settings.language || "vi" },
    ];

    restoreStates.forEach((state) => {
        document.dispatchEvent(
            new CustomEvent("subsectionChange", {
                detail: { id: state.id, value: state.value, firstRun: true },
            }),
        );
    });

    // --- 4. EVENT LISTENERS FOR AUTO SAVE ---
    document.addEventListener("subsectionChange", (e) => {
        const { id, value, firstRun } = e.detail;
        if (id === "language") {
            const current = getSettings().language || "vi";
            if (current !== value && !firstRun) {
                saveSettings({ language: value });

                // Hot Change Logic
                initI18n(value).then(() => {
                    translateDOM(document);
                    showNotification(t("alert.saved_changes"), "success");

                    // Dispatch event for other components to update if needed
                    document.dispatchEvent(new CustomEvent("language-changed", { detail: { lang: value } }));
                });
            }
        }
    });

    // Remove preload class to enable smooth transition on next open
    setTimeout(() => {
        document.getElementById("setting_wrapper")?.classList.remove("preload");
    }, 100);

    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.code === "KeyX") {
            e.preventDefault();
            document.getElementById("setting_toggle_btn")?.click();
        }
    });

}
function initSettingsNav() {
    const navItems = document.querySelectorAll(".nav_item");
    const tabContents = document.querySelectorAll(".tab_content");

    navItems.forEach((item) => {
        item.addEventListener("mousedown", () => {
            const tabId = item.getAttribute("data-tab");

            // Remove active class from all nav items and tab contents
            navItems.forEach((nav) => nav.classList.remove("active"));
            tabContents.forEach((tab) => tab.classList.remove("active"));

            // Add active class to clicked nav item and corresponding tab content
            item.classList.add("active");
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add("active");
                // Reset scroll position when switching tabs
                document.getElementById("settings_content").scrollTo({
                    top: 0,
                    behavior: "smooth",
                });
            }
        });
    });
}
