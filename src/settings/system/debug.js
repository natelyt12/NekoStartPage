import { getSettings, saveSettings } from "/src/core/storageHandler.js";
import { getFromStore, saveToStore } from "/src/core/db.js";
import { rotationTimes } from "/src/wallpaper/rotation.js";
import { showNotification, openCustomPopup, openSidebarSubmenu } from "/src/core/ui.js";

export function initDebugSettings() {
    initI18nDebug();
    initRotationTest();
    initPopupTest();
    initNotifTest();
    initNotifTest();
    initSubmenuTest();
    initUnsplashDebug();
}

function initUnsplashDebug() {
    const unsplashInput = document.getElementById("debug_unsplash_key");
    if (unsplashInput) {
        unsplashInput.value = getSettings().unsplashApiKey || "";
        unsplashInput.addEventListener("input", (e) => {
            saveSettings({ unsplashApiKey: e.target.value.trim() });
        });
    }
}

function initI18nDebug() {
    const debugToggle = document.getElementById("debug_i18n");
    if (debugToggle) {
        debugToggle.checked = getSettings().debugI18n || false;
        debugToggle.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            saveSettings({ debugI18n: isChecked });
            location.reload();
        });
    }
}

function initRotationTest() {
    const btnTest = document.getElementById("btn_test_rotation");
    const btnReload = document.getElementById("btn_test_reload");
    const tooltip = document.getElementById("rotation_test_tooltip");

    if (!btnTest) return;

    btnTest.addEventListener("mousedown", async () => {
        const settings = getSettings();
        const freq = settings.wallpaperConfig?.rotation || 0;
        const source = settings.wallpaperConfig?.source || "";

        if (freq === 0) {
            showNotification("Vui lòng chọn một tần suất xoay (khác 'Không bao giờ') để test", "warning");
            return;
        }

        if (source === "local_image" || source === "local_video") {
            showNotification("Nguồn cục bộ không hỗ trợ xoay ảnh tự động theo thời gian", "warning");
            return;
        }

        const storageKeyMap = {
            "wallhaven": "wallhaven_data",
            "picre": "picre_data"
        };

        const dbKey = storageKeyMap[source];
        if (!dbKey) return;

        btnTest.disabled = true;
        tooltip.style.display = "block";
        tooltip.innerText = "Đang xử lý dữ liệu database...";

        try {
            let data = await getFromStore(dbKey);
            const limit = rotationTimes[freq];
            const newTimestamp = Date.now() - limit + 3000;
            let success = false;

            if (source === "wallhaven" && data && data.current) {
                data.current.last_updated = newTimestamp;
                success = true;
            } else if (source === "picre" && data && data.last_updated) {
                data.last_updated = newTimestamp;
                success = true;
            }

            if (success) {
                await saveToStore(dbKey, data);

                let timeLeft = 3;
                const timer = setInterval(() => {
                    timeLeft--;
                    if (timeLeft > 0) {
                        tooltip.innerText = `Sẽ hết hạn sau ${timeLeft}s nữa...`;
                    } else {
                        clearInterval(timer);
                        tooltip.innerText = "Đã hết hạn! Hãy nhấn nút Reload bên dưới để xem Workflow mới";
                        btnReload.style.display = "block";
                    }
                }, 1000);

                tooltip.innerText = `Sẽ hết hạn sau ${timeLeft}s nữa...`;
            } else {
                showNotification("Không tìm thấy dữ liệu ảnh trong cache để modify", "error");
                btnTest.disabled = false;
            }
        } catch (e) {
            console.error(e);
            showNotification("Lỗi khi modify database", "error");
            btnTest.disabled = false;
        }
    });

    if (btnReload) {
        btnReload.addEventListener("mousedown", () => {
            location.reload();
        });
    }
}

function initPopupTest() {
    const createContent = (text) => {
        const div = document.createElement("div");
        div.className = "popup_body";
        div.innerHTML = `<p>${text}</p>`;
        return div;
    };

    document.getElementById("test_popup_normal")?.addEventListener("mousedown", () => {
        openCustomPopup("Normal Popup", createContent("This is a standard popup for testing."), "400px");
    });

    document.getElementById("test_popup_alert")?.addEventListener("mousedown", () => {
        openCustomPopup("Alert Popup", createContent("This is an alert popup (Red title, no backdrop click close)."), "400px", { isAlert: true });
    });

    document.getElementById("test_popup_noclose")?.addEventListener("mousedown", () => {
        const div = document.createElement("div");
        div.className = "popup_body";
        div.innerHTML = `
            <p>This popup has no close button. You must click backdrop (if allowed) or use the button below.</p>
            <button id="manual_close_btn" style="background: var(--accent_2); color: white; margin-top: 10px;">Close this Popup</button>
        `;
        const result = openCustomPopup("No X Button", div, "400px", { canClose: false });

        div.querySelector("#manual_close_btn").addEventListener("mousedown", () => {
            result.closePopup();
        });
    });

    document.getElementById("test_popup_large")?.addEventListener("mousedown", () => {
        openCustomPopup("Large Popup", createContent("This is a wide popup (600px) for testing layout responsiveness."), "600px");
    });

    document.getElementById("test_popup_800")?.addEventListener("mousedown", () => {
        openCustomPopup("Collection Test", createContent("Preview Mode: Width 800px"), "800px", { hideWidgetGrid: true, hideSettingPanel: true });
    });

    document.getElementById("test_popup_1000")?.addEventListener("mousedown", () => {
        openCustomPopup("Collection Test", createContent("Preview Mode: Width 1000px"), "1000px", { hideWidgetGrid: true, hideSettingPanel: true });
    });

    document.getElementById("test_popup_1200")?.addEventListener("mousedown", () => {
        openCustomPopup("Collection Test", createContent("Preview Mode: Width 1200px"), "1200px", { hideWidgetGrid: true, hideSettingPanel: true });
    });
}

function initNotifTest() {
    document.getElementById("test_notif_info")?.addEventListener("mousedown", () => {
        showNotification("Info Notification: Just a friendly update.", "info");
    });

    document.getElementById("test_notif_success")?.addEventListener("mousedown", () => {
        showNotification("Success Notification: Task completed successfully!", "success");
    });

    document.getElementById("test_notif_error")?.addEventListener("mousedown", () => {
        showNotification("Error Notification: Something went wrong!", "error");
    });

    document.getElementById("test_notif_warning")?.addEventListener("mousedown", () => {
        showNotification("Warning Notification: Please check your settings.", "warning");
    });
}

function initSubmenuTest() {
    const createSubmenuContent = (titleText) => {
        const div = document.createElement("div");
        div.className = "setting_section";
        div.innerHTML = `
            <p class="setting_title">${titleText}</p>
            <p style="font-size: 0.85em; opacity: 0.7; margin-bottom: 12px; line-height: 1.5;">Đây là khung nội dung Submenu tầng 2 trượt từ bên phải sang. Chiều rộng sidebar vẫn giữ nguyên 380px (hoặc tùy chỉnh).</p>
            <div class="setting_options" style="display: flex; flex-direction: column; gap: 8px;">
                <button id="sub_action_1">Thao tác thử nghiệm 1</button>
                <button id="sub_action_2">Thao tác thử nghiệm 2</button>
            </div>
        `;
        div.querySelector("#sub_action_1")?.addEventListener("mousedown", () => {
            showNotification("Đã nhấp Thao tác 1 trong Submenu", "success");
        });
        div.querySelector("#sub_action_2")?.addEventListener("mousedown", () => {
            showNotification("Đã nhấp Thao tác 2 trong Submenu", "info");
        });
        return div;
    };

    document.getElementById("test_sidebar_submenu")?.addEventListener("mousedown", () => {
        const inputVal = document.getElementById("test_submenu_width")?.value.trim();
        const title = inputVal ? `Submenu (${inputVal})` : "Cài đặt Nâng cao";
        openSidebarSubmenu(title, createSubmenuContent("Chi tiết Submenu Nâng cao"), { width: inputVal });
    });

    document.getElementById("test_sidebar_submenu_fullscreen")?.addEventListener("mousedown", () => {
        openSidebarSubmenu("Submenu Fullscreen (100vw)", createSubmenuContent("Chi tiết Submenu Toàn Màn Hình"), { isFullScreen: true });
    });
}
