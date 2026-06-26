
import { initSvgs, initToggleSettingBtn, initSubToggle, openCustomPopup } from "/src/script/core/UI.js";
import { renderIcons } from "/src/script/core/icon.js";
import { t, translateDOM } from "/src/script/core/i18n.js";
import {
    initBgAPIFeatures,
    InitBGEditor,
    initializeWavySettings,
    initializeOnloadSettings,
    initializeParticles,
    initializeFilterSettings,
    initCollectionUI,
} from "/src/script/wallpaper/index.js";
import { initAppUtils, initDebugSettings } from "/src/script/settings/system/index.js";
import { initTimeSettings } from "/src/script/widgets/clock/clock.js";
import { initWeatherSettings } from "/src/script/widgets/weather/weather.js";
import { getSettings, saveSettings } from "/src/script/core/storagehandler.js";
import { initSettings as initWidgetSettings } from "/src/script/widgets/handler.js";

import settingsHtml from "./settings.html?raw";
import clockSettingHtml from "/src/script/widgets/clock/setting.html?raw";
import weatherSettingHtml from "/src/script/widgets/weather/setting.html?raw";
import "./settings.css";

export async function initSettingsLauncher() {
    const wrapper = document.getElementById("setting_wrapper");
    if (wrapper) {
        wrapper.innerHTML = settingsHtml;
        const success = true;
        
        const tabTime = document.getElementById("tab-time");
        if (tabTime) tabTime.innerHTML = clockSettingHtml;
        
        const tabWeather = document.getElementById("tab-weather");
        if (tabWeather) tabWeather.innerHTML = weatherSettingHtml;

        // RENDER SETTINGS UI
        translateDOM(document.getElementById("setting_wrapper"));

        // --- 1. LOAD SETTINGS FROM STORAGE ---
        const settings = getSettings();
        console.debug("Loaded settings", settings);

        // --- 2. INIT UI & EVENTS ---
        initSubToggle();
        initSvgs();
        renderIcons();
        initToggleSettingBtn();
        initSettingsNav();

        // --- 3. INIT FEATURES ---
        initBgAPIFeatures();
        initCollectionUI();
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

                    // Prompt for restart
                    const contentNode = document.createElement("div");
                    contentNode.className = "popup_body";
                    contentNode.innerHTML = `
                        <p style="margin: 0;opacity: 0.8; line-height: 1.5;">${t("alert.language_reload") || "Thay đổi ngôn ngữ yêu cầu tải lại trang"}</p>
                        <div class="actions">
                            <button id="lang_cancel_btn" class="secondary">${t("alert.confirm_cancel") || "Hủy bỏ"}</button>
                            <button id="lang_restart_btn" class="primary">${t("alert.reload") || "Tải lại trang"}</button>
                        </div>
                    `;
                    const popup = openCustomPopup(t("alert.language_title") || "Thay đổi ngôn ngữ", contentNode, "320px", {
                        id: "language_restart_popup",
                        isAlert: true,
                        canClose: true
                    });

                    const revertLanguage = () => {
                        saveSettings({ language: current });
                        document.dispatchEvent(
                            new CustomEvent("subsectionChange", {
                                detail: { id: "language", value: current, firstRun: true },
                            })
                        );
                    };

                    contentNode.querySelector("#lang_cancel_btn").onmousedown = () => {
                        revertLanguage();
                        if (popup && popup.closePopup) popup.closePopup();
                    };

                    if (popup && popup.closeBtn) {
                        popup.closeBtn.addEventListener("popupBeforeClose", revertLanguage);
                    }

                    contentNode.querySelector("#lang_restart_btn").onmousedown = () => {
                        location.reload();
                    };
                }
            }
        });

        // Remove preload class to enable smooth transition on next open
        setTimeout(() => {
            document.getElementById("setting_wrapper")?.classList.remove("preload");
        }, 100);
    }
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

