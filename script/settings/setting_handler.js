import { loadHTML, loadCSS } from "../core/loader.js";
import { initSvgs, initToggleSettingBtn, initSubToggle, initPopupAlert, openCustomPopup } from "./utils/UI.js";
import { t, translateDOM } from "../core/i18n.js";
import { initBgAPIFeatures } from "./features/bgapi.js";
import { InitBGEditor } from "./features/bgeditor.js";
import { initializeWavySettings } from "./features/bgwavy.js";
import { initAppUtils } from "./features/apputils.js";
import { initWeatherSettings } from "./features/weather.js";
import { initTimeSettings } from "./features/time.js";
import { getSettings, saveSettings } from "./utils/storagehandler.js";
import { initializeOnloadSettings } from "./features/onloadanim.js";
import { initializeParticles } from "./features/particles.js";
import { initSettings as initWidgetSettings } from "../widgets/handler.js";

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
    initWidgetSettings();

    // --- 4. RESTORE UI STATES FROM STORAGE ---
    const restoreStates = [
        { id: "API_selector", value: settings.wallpaperConfig.source },
        { id: "wallpaperRotation", value: settings.wallpaperConfig.rotation },
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
            const current = getSettings().language || "en";
            if (current !== value || !firstRun) {
                saveSettings({ language: value });
                if (!firstRun) {
                    const confirmDialog = document.createElement("div");
                    confirmDialog.className = "popup_body";
                    confirmDialog.innerHTML = `
                        <p style=" margin: 0px 4px; opacity: 0.8; line-height: 1.5;" data-i18n="alert.language_reload"></p>
                        <div class="actions">
                            <button id="reload_btn" data-i18n="alert.reload"></button>
                        </div>
                    `;
                    confirmDialog.querySelector("#reload_btn").onmousedown = () => location.reload();
                    openCustomPopup(t("alert.language_title"), confirmDialog, "400px", { isAlert: true, canClose: false });
                    translateDOM(confirmDialog);
                }
            }
        }
    });

    // Remove preload class to enable smooth transition on next open
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
