import { saveSettings, getSettings, exportSettings, importSettings, subscribe } from "/src/core/storageHandler.js";
import { getFormattedClock as coreGetFormattedClock, initDate } from "/src/core/time.js";
import { openCustomPopup, showNotification, createConfirmDialog, createSlider } from "/src/core/ui.js";
import { t } from "/src/core/i18n.js";
import { EventBus } from "/src/core/eventBus.js";
import { EVENTS } from "/src/core/events.js";

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
                    const msg = t("alert.import_success_msg");
                    const { container: confirmDialog, setCloseHandler } = createConfirmDialog(msg, () => location.reload(), { okText: t("alert.reload"), hideCancel: true });
                    const popup = openCustomPopup(t("alert.import_success_title"), confirmDialog, "400px", { isAlert: true, canClose: false });
                    setCloseHandler(() => popup.closePopup());
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



function initDebug() {
    const resetSettingsBtn = document.getElementById("reset_settings_btn");

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener("mousedown", () => {
            const dialogData = createConfirmDialog(
                t("alert.reset_settings_confirm"),
                async () => {
                    const { clearStore } = await import("/src/core/db.js");
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
