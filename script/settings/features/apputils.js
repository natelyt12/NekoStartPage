import { saveSettings, getSettings, exportSettings, importSettings } from "../utils/storagehandler.js";
import { getFormattedClock as coreGetFormattedClock, initDate } from "../../core/time.js";
import { openCustomPopup, showNotification } from "../utils/UI.js";
import { t } from "../../core/i18n.js";

/**
 * Master initialization function for all application specific utility subsets.
 * Activates Tab Titles, Presentation Mode, Hotkeys, Date/Time, debug options and Backup.
 */
export function initAppUtils() {
    initTabTitle();
    initPresentationMode();
    initHotkeys();
    initDateTime();
    initDebug();
    initBackup();
    initToggleButtonOpacity();
}

function initHotkeys() {
    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key === "x") {
            const presentationToggle = document.getElementById("presentation_mode");
            if (presentationToggle) {
                presentationToggle.checked = !presentationToggle.checked;
                presentationToggle.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
    });
}

function initBackup() {
    const exportBtn = document.getElementById("export_settings_btn");
    const importBtn = document.getElementById("import_settings_btn");
    const importFile = document.getElementById("import_settings_file");

    if (exportBtn) {
        exportBtn.addEventListener("mousedown", async () => {
            exportBtn.disabled = true;
            exportBtn.innerText = t("alert.export_loading");
            await exportSettings();
            exportBtn.disabled = false;
            exportBtn.innerText = t("alert.export_btn");
        });
    }

    const handleImportFile = (fileInput, importFunc) => {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const contents = e.target.result;
                const success = await importFunc(contents);
                if (success) {
                    const confirmDialog = document.createElement("div");
                    confirmDialog.className = "popup_body";
                    confirmDialog.innerHTML = `
                        <p style="margin-bottom: 20px; opacity: 0.8; line-height: 1.5;">${t("alert.import_success_msg")}</p>
                        <div class="actions">
                            <button id="reload_btn">${t("alert.reload")}</button>
                        </div>
                    `;
                    confirmDialog.querySelector("#reload_btn").onmousedown = () => location.reload();
                    openCustomPopup(t("alert.import_success_title"), confirmDialog, "400px", false);
                } else {
                    showNotification(t("alert.import_error_msg"), "error");
                }
            };
            reader.readAsText(file);
        };
    };

    if (importBtn && importFile) {
        importBtn.addEventListener("mousedown", () => {
            importFile.click();
        });
        handleImportFile(importFile, importSettings);
    }
}

function initTabTitle() {
    const tabTitleInput = document.getElementById("tab_title");
    if (!tabTitleInput) return;

    const initialTitle = getSettings().tabTitle || "";

    if (initialTitle) {
        tabTitleInput.value = initialTitle;
        document.title = initialTitle;
    }

    tabTitleInput.addEventListener("change", (e) => {
        const newTitle = e.target.value;
        document.title = newTitle || t("tab_new");
        saveSettings({ tabTitle: newTitle });
    });
}

function initPresentationMode() {
    const presentationToggle = document.getElementById("presentation_mode");
    const safemodeBox = document.querySelector(".safemode");
    if (!presentationToggle || !safemodeBox) return;

    const updateStatus = (isEnabled) => {
        if (isEnabled) {
            safemodeBox.classList.add("safemode-enabled");
        } else {
            safemodeBox.classList.remove("safemode-enabled");
        }
    };

    const isEnabled = getSettings().presentationMode;
    presentationToggle.checked = isEnabled;
    updateStatus(isEnabled);

    presentationToggle.addEventListener("change", (e) => {
        updateStatus(e.target.checked);
        saveSettings({ presentationMode: e.target.checked });
    });
}

function initDebug() {
    const clearCacheBtn = document.getElementById("clear_cache_btn");
    const resetSettingsBtn = document.getElementById("reset_settings_btn");

    const createConfirmDialog = (msg, onConfirm) => {
        const container = document.createElement("div");
        container.className = "popup_body";
        const cancelText = t("alert.confirm_cancel");
        const okText = t("alert.confirm");
        container.innerHTML = `
            <p style="margin-bottom: 20px; opacity: 0.8; line-height: 1.5;">${msg}</p>
            <div class="actions">
                <button id="confirm_cancel_btn">${cancelText}</button>
                <button class="btn_warning" id="confirm_ok_btn">${okText}</button>
            </div>
        `;
        container.querySelector("#confirm_cancel_btn").onmousedown = () => document.querySelector(".popup_close").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        container.querySelector("#confirm_ok_btn").onmousedown = async () => {
            document.querySelector(".popup_close").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            await onConfirm();
        };
        return container;
    };

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener("mousedown", () => {
            const dialog = createConfirmDialog(
                t("alert.clear_cache_confirm"),
                async () => {
                    const { clearStore } = await import("../../core/db.js");
                    await clearStore();
                    localStorage.removeItem("weather_cache");
                }
            );
            openCustomPopup(t("alert.clear_cache_title"), dialog, "400px", false);
        });
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener("mousedown", () => {
            const dialog = createConfirmDialog(
                t("alert.reset_settings_confirm"),
                async () => {
                    const { clearStore } = await import("../../core/db.js");
                    await clearStore();
                    localStorage.clear();
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            );
            openCustomPopup(t("alert.reset_settings_title"), dialog, "400px", false);
        });
    }
}

function initDateTime() {
    const addZeroHourbox = document.getElementById("add_zero_hour");
    if (addZeroHourbox) {
        addZeroHourbox.checked = getSettings().add_zero_hour !== false;
        addZeroHourbox.addEventListener("change", (e) => {
            saveSettings({ add_zero_hour: e.target.checked });
            document.dispatchEvent(new Event("time-updated"));
        });
    }

    const showSecondsbox = document.getElementById("show_seconds");
    if (showSecondsbox) {
        showSecondsbox.checked = getSettings().show_seconds === true;
        showSecondsbox.addEventListener("change", (e) => {
            saveSettings({ show_seconds: e.target.checked });
            document.dispatchEvent(new Event("time-updated"));
        });
    }

    const clock12hBox = document.getElementById("clock_format_12h");
    if (clock12hBox) {
        clock12hBox.checked = getSettings().clock_format === "12h";
        clock12hBox.addEventListener("change", (e) => {
            const format = e.target.checked ? "12h" : "24h";
            saveSettings({ clock_format: format });
            document.dispatchEvent(new Event("time-updated"));
        });
    }

    const showAmPmBox = document.getElementById("show_ampm");
    if (showAmPmBox) {
        showAmPmBox.checked = getSettings().show_ampm !== false;
        showAmPmBox.addEventListener("change", (e) => {
            saveSettings({ show_ampm: e.target.checked });
            document.dispatchEvent(new Event("time-updated"));
        });
    }
}

export function getFormattedClock() {
    return coreGetFormattedClock(getSettings());
}

/**
 * Retrieve the fully formatted date string in localized format.
 * @returns {string} The formatted local string for the present day.
 */
export function getFormattedDate() {
    const today = initDate();
    return `${today.day}/${today.month}/${today.year}`;
}

function initToggleButtonOpacity() {
    const toggleOpacityBox = document.getElementById("toggle_button_opacity");
    if (!toggleOpacityBox) return;

    const isDim = getSettings().hideToggleButton !== false;
    toggleOpacityBox.checked = isDim;

    toggleOpacityBox.addEventListener("change", (e) => {
        const isEnabled = e.target.checked;
        saveSettings({ hideToggleButton: isEnabled });

        // Apply immediately if closed
        const settingToggleBtn = document.getElementById("setting_toggle_btn");
        const settingWrapper = document.getElementById("setting_wrapper");
        const isOpened = settingWrapper && settingWrapper.classList.contains("setting_wrapper_opened");
        if (settingToggleBtn && !isOpened) {
            settingToggleBtn.style.opacity = isEnabled ? "0" : "1";
        }
    });
}
