import { saveSettings, getSettings, exportSettings, importSettings, subscribe } from "/script/core/storagehandler.js";
import { getFormattedClock as coreGetFormattedClock, initDate } from "/script/core/time.js";
import { openCustomPopup, showNotification } from "/script/core/UI.js";
import { t } from "/script/core/i18n.js";

/**
 * Master initialization function for all application specific utility subsets.
 * Activates Tab Titles, Presentation Mode, Hotkeys, Date/Time, debug options and Backup.
 */
let isAppUtilsInitialized = false;

export function initAppUtils() {
    initTabTitle();
    initPresentationMode();
    
    if (!isAppUtilsInitialized) {
        isAppUtilsInitialized = true;
        initHotkeys();
    }

    initDateTime();
    initDebug();
    initBackup();
    initToggleButtonOpacity();
}

function initHotkeys() {
    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key === "x") {
            const current = getSettings().presentationMode === true;
            saveSettings({ presentationMode: !current });
        }
    });
}

function initBackup() {
    const exportBtn = document.getElementById("export_settings_btn");
    const importBtn = document.getElementById("import_settings_btn");
    const importFile = document.getElementById("import_settings_file");

    if (exportBtn) {
        exportBtn.addEventListener("mousedown", () => {
            const dialogData = createConfirmDialog(
                t("alert.export_confirm_msg"),
                async () => {
                    const textSpan = exportBtn.querySelector("span");
                    exportBtn.disabled = true;
                    if (textSpan) textSpan.innerText = t("alert.export_loading");
                    await exportSettings();
                    exportBtn.disabled = false;
                    if (textSpan) textSpan.innerText = t("setting_panel.backup_restore.export_settings");
                    showNotification(t("alert.export_success"), "success");
                }
            );
            const popup = openCustomPopup(t("alert.export_confirm_title"), dialogData.container, "400px", { isAlert: true, canClose: false });
            dialogData.setCloseHandler(popup.closePopup);
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
                        <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">${t("alert.import_success_msg")}</p>
                        <div class="actions">
                            <button id="reload_btn">${t("alert.reload")}</button>
                        </div>
                    `;
                    confirmDialog.querySelector("#reload_btn").onmousedown = () => location.reload();
                    openCustomPopup(t("alert.import_success_title"), confirmDialog, "400px", { isAlert: true, canClose: false });
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
    if (tabTitleInput) {
        tabTitleInput.value = getSettings().tabTitle || "";
        tabTitleInput.onchange = (e) => {
            saveSettings({ tabTitle: e.target.value });
        };
    }
}

function initPresentationMode() {
    const presentationToggle = document.getElementById("presentation_mode");
    if (presentationToggle) {
        presentationToggle.checked = getSettings().presentationMode === true;
        presentationToggle.onchange = (e) => {
            saveSettings({ presentationMode: e.target.checked });
        };
    }
}

function createConfirmDialog(msg, onConfirm) {
    const container = document.createElement("div");
    container.className = "popup_body";
    const cancelText = t("alert.confirm_cancel");
    const okText = t("alert.confirm");
    container.innerHTML = `
        <p style="margin: 0px 4px ;opacity: 0.8; line-height: 1.5;">${msg}</p>
        <div class="actions">
            <button id="confirm_cancel_btn">${cancelText}</button>
            <button id="confirm_ok_btn">${okText}</button>
        </div>
    `;
    let closeHandler = null;
    container.querySelector("#confirm_cancel_btn").onmousedown = () => {
        if (closeHandler) closeHandler();
    };
    container.querySelector("#confirm_ok_btn").onmousedown = async () => {
        if (closeHandler) closeHandler();
        await onConfirm();
    };
    return { container, setCloseHandler: (fn) => (closeHandler = fn) };
}

function initDebug() {
    const resetSettingsBtn = document.getElementById("reset_settings_btn");

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener("mousedown", () => {
            const dialogData = createConfirmDialog(
                t("alert.reset_settings_confirm"),
                async () => {
                    const { clearStore } = await import("/script/core/db.js");
                    await clearStore();
                    localStorage.clear();
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            );
            const popup = openCustomPopup(t("alert.reset_settings_title"), dialogData.container, "400px", { isAlert: true, canClose: false });
            dialogData.setCloseHandler(popup.closePopup);
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
    if (toggleOpacityBox) {
        toggleOpacityBox.checked = getSettings().hideToggleButton !== false;
        toggleOpacityBox.onchange = (e) => {
            saveSettings({ hideToggleButton: e.target.checked });
        };
    }
}

// ==========================================
// REACTIVE SETTINGS SUBSCRIPTIONS
// ==========================================

subscribe("tabTitle", (newTitle) => {
    document.title = newTitle || t("tab_new") || "New Tab";
    const tabTitleInput = document.getElementById("tab_title");
    if (tabTitleInput) {
        tabTitleInput.value = newTitle || "";
    }
});

subscribe("presentationMode", (isEnabled) => {
    const safemodeBox = document.querySelector(".safemode");
    if (safemodeBox) {
        if (isEnabled) {
            safemodeBox.classList.add("safemode-enabled");
        } else {
            safemodeBox.classList.remove("safemode-enabled");
        }
    }
    const presentationToggle = document.getElementById("presentation_mode");
    if (presentationToggle) {
        presentationToggle.checked = isEnabled === true;
    }
});

subscribe("hideToggleButton", (isDim) => {
    const settingToggleBtn = document.getElementById("setting_toggle_btn");
    const settingWrapper = document.getElementById("setting_wrapper");
    const isOpened = settingWrapper && settingWrapper.classList.contains("setting_wrapper_opened");
    
    if (settingToggleBtn) {
        if (isDim !== false && !isOpened) {
            settingToggleBtn.classList.add("toggle_hidden");
        } else {
            settingToggleBtn.classList.remove("toggle_hidden");
        }
    }
    
    const toggleOpacityBox = document.getElementById("toggle_button_opacity");
    if (toggleOpacityBox) {
        toggleOpacityBox.checked = isDim !== false;
    }
});
