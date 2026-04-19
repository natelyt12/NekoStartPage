import { getSettings } from "/script/settings/utils/storagehandler.js";

export function initToggleSettingBtn() {
    let isSettingsOpen = false;
    const settingToggleBtn = document.getElementById("setting_toggle_btn");

    // Set initial opacity based on settings
    const dim = getSettings().hideToggleButton !== false;
    settingToggleBtn.style.opacity = dim ? "0" : "1";

    settingToggleBtn.addEventListener("click", () => {
        isSettingsOpen = !isSettingsOpen;
        const settingWrapper = document.getElementById("setting_wrapper");
        settingWrapper.classList.toggle("setting_wrapper_opened");
        if (isSettingsOpen) {
            settingToggleBtn.style.opacity = "1";
            settingToggleBtn.style.left = "10px";
            settingToggleBtn.style.background = "transparent";
            settingToggleBtn.style.border = "none";
            settingToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;
        } else {
            const dim = getSettings().hideToggleButton !== false;
            settingToggleBtn.style.opacity = dim ? "0" : "1";
            settingToggleBtn.style.left = "-54px";
            settingToggleBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path
            d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
            stroke="white"
            stroke-width="2"
        /><path
            d="M19.43 12.98C19.47 12.66 19.5 12.33 19.5 12C19.5 11.67 19.47 11.34 19.43 11.02L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.28 4.97 19.06 5.06L16.56 6.06C16.04 5.65 15.47 5.31 14.85 5.06L14.5 2.39C14.47 2.17 14.28 2 14.05 2H9.95C9.72 2 9.53 2.17 9.5 2.39L9.15 5.06C8.53 5.31 7.96 5.65 7.44 6.06L4.94 5.06C4.72 4.97 4.46 5.05 4.34 5.27L2.34 8.73C2.22 8.95 2.27 9.22 2.46 9.37L4.57 11.02C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.66 4.57 12.98L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.72 19.03 4.94 18.94L7.44 17.94C7.96 18.35 8.53 18.69 9.15 18.94L9.5 21.61C9.53 21.83 9.72 22 9.95 22H14.05C14.28 22 14.47 21.83 14.5 21.61L14.85 18.94C15.47 18.69 16.04 18.35 16.56 17.94L19.06 18.94C19.28 19.03 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98Z"
            stroke="white"
            stroke-width="2"
        /></svg>`;
        }
    });
}

export function initSvgs() {
    const sbsct_svgContainers = document.querySelectorAll(".sbsctsvg");
    sbsct_svgContainers.forEach((container) => {
        if (container.children.length === 0) {
            container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>`;
        }
    });
}

// ==========================================
// SUBSECTION LOGIC (merged from subsection.js)
// ==========================================

// 1. Helper to update UI based on ID and Value
function updateDropdownUI(dropdownId, value) {
    const btn = document.getElementById(dropdownId);
    if (!btn) return;

    // Find the attached subsection
    let subsection = btn.nextElementSibling;
    while (subsection && !subsection.classList.contains("subsection")) {
        subsection = subsection.nextElementSibling;
    }

    if (subsection) {
        // Find corresponding item by data-value in this subsection
        const item = subsection.querySelector(`.dropdown_item[data-value="${value}"]`);
        const displaySpan = btn.querySelector(".selected_value");

        if (item && displaySpan) {
            // Update text and attribute
            displaySpan.textContent = item.textContent;

            // Copy i18n attribute for translation engine
            if (item.hasAttribute("data-i18n")) {
                displaySpan.setAttribute("data-i18n", item.getAttribute("data-i18n"));
            } else {
                displaySpan.removeAttribute("data-i18n");
            }

            btn.setAttribute("data-selected", value);
        }
    }
}

export function initSubToggle() {
    // --- FLOW 1: LISTEN FOR USER CLICKS ---
    document.addEventListener("mousedown", (event) => {
        const target = event.target;

        // Auto close all other dropdowns if clicked outside or on another toggle
        const isClickInsideDropdown = target.closest(".dropdown_wrapper");

        if (!isClickInsideDropdown) {
            document.querySelectorAll(".subsection.opening").forEach(sub => {
                sub.classList.remove("opening");
                let controlBtn = sub.previousElementSibling;
                while (controlBtn && !controlBtn.classList.contains("subsection_button")) {
                    controlBtn = controlBtn.previousElementSibling;
                }
                if (controlBtn) controlBtn.classList.remove("btn_active");
            });
        }

        // Handle open/close toggles
        const btn = target.closest(".subsection_button");
        if (btn) {
            let subsection = btn.nextElementSibling;
            while (subsection && !subsection.classList.contains("subsection")) {
                subsection = subsection.nextElementSibling;
            }
            if (subsection) {
                const wasOpening = subsection.classList.contains("opening");

                // Close others
                document.querySelectorAll(".subsection.opening").forEach(sub => {
                    if (sub !== subsection) {
                        sub.classList.remove("opening");
                        let controlBtn = sub.previousElementSibling;
                        while (controlBtn && !controlBtn.classList.contains("subsection_button")) {
                            controlBtn = controlBtn.previousElementSibling;
                        }
                        if (controlBtn) controlBtn.classList.remove("btn_active");
                    }
                });

                if (wasOpening) {
                    subsection.classList.remove("opening");
                    btn.classList.remove("btn_active");
                } else {
                    subsection.classList.add("opening");
                    btn.classList.add("btn_active");
                }
            }
            return;
        }

        // Handle user item selection
        const item = target.closest(".dropdown_item");
        if (item) {
            const subsection = item.closest(".subsection");
            let controlBtn = subsection.previousElementSibling;
            while (controlBtn && !controlBtn.classList.contains("subsection_button")) {
                controlBtn = controlBtn.previousElementSibling;
            }

            if (controlBtn) {
                const value = item.getAttribute("data-value");
                const id = controlBtn.id;

                // Dispatch event on click. This will trigger UI updates below.
                const changeEvent = new CustomEvent("subsectionChange", {
                    bubbles: true,
                    detail: { id: id, value: value },
                });
                document.dispatchEvent(changeEvent);

                // Close menu
                subsection.classList.remove("opening");
                controlBtn.classList.remove("btn_active");
            }
        }
    });

    // --- FLOW 2: LISTEN FOR UI UPDATE EVENTS (Used for loading settings) ---
    document.addEventListener("subsectionChange", (e) => {
        const { id, value } = e.detail;
        if (id && value !== undefined && value !== null) {
            updateDropdownUI(id, value);
        }
    });
}

// ==========================================
// POPUP LOGIC (merged from popup.js)
// ==========================================

const settings = document.querySelector("#setting_wrapper");
const widget = document.querySelector("#widgets_container");

// Keep track of active popups by ID
const activePopups = new Map();
let currentZIndex = 101;

// Cache popup elements (No longer needed since popups are dynamic)
export function initPopupAlert() {
    // Left empty or can be removed if not needed, kept for compatibility if imported
}

/**
 * Open a custom popup with designated HTML content.
 * @param {string} title - Popup header title.
 * @param {HTMLElement} contentNode - Configured HTML node containing logic.
 * @param {string} width - Popup width.
 * @param {Object} options - Popup settings options: { id: string, isAlert: boolean, canClose: boolean, hideUI: boolean }
 * @returns {Object} { closeBtn } Reference to the popup's close button.
 */
export function openCustomPopup(title, contentNode, width = "400px", options = {}) {
    const { id: popupId = null, isAlert = false, canClose = true, hideUI = false, canDrag = true } = options;

    // 1. Prevention of duplicate popups if ID is provided
    if (popupId && activePopups.has(popupId)) {
        const existing = activePopups.get(popupId);
        currentZIndex++;
        existing.popupWrapper.style.zIndex = currentZIndex;

        // Visual hint for focus
        existing.popupSection.style.animation = "none";
        setTimeout(() => {
            existing.popupSection.style.animation = "popup_focus_zoom 0.3s var(--expo_out)";
        }, 10);

        return existing;
    }

    // 2. Element Creation & Setup
    const popupWrapper = document.createElement("div");
    popupWrapper.className = "popup_section_wrapper";
    popupWrapper.style.zIndex = ++currentZIndex;
    popupWrapper.style.backgroundColor = "transparent"; // Start transparent, animate in
    popupWrapper.style.pointerEvents = isAlert ? "auto" : "none";

    const popupMover = document.createElement("div");
    popupMover.className = "popup_mover";
    popupMover.style.pointerEvents = "none";

    const popupSection = document.createElement("div");
    popupSection.className = "popup_section";
    popupSection.style.width = width;
    popupSection.style.pointerEvents = "auto";

    const popupHeader = document.createElement("div");
    popupHeader.className = "popup_header";

    const titleText = document.createElement("span");
    titleText.innerText = title;
    popupHeader.appendChild(titleText);

    const popupContent = document.createElement("div");
    popupContent.className = "popup_content";
    popupContent.appendChild(contentNode);

    const popupClose = document.createElement("button");
    popupClose.className = "popup_close";
    popupClose.style.display = canClose ? "flex" : "none";
    popupClose.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;

    // 3. Assemble & Inject
    popupHeader.appendChild(popupClose);
    popupSection.append(popupHeader, popupContent);
    popupMover.appendChild(popupSection);
    popupWrapper.appendChild(popupMover);
    document.body.appendChild(popupWrapper);

    const toggleExternalUI = (visible) => {
        if (!hideUI) return;
        ["#widgets_container", "#setting_wrapper"].forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                el.style.opacity = visible ? "1" : "0";
                el.style.pointerEvents = visible ? "auto" : "none";
            }
        });
    };

    toggleExternalUI(false);

    // 4. Close & Interaction Logic
    const closePopup = () => {
        if (popupId) activePopups.delete(popupId);

        // Fade out background
        popupWrapper.style.backgroundColor = "transparent";
        popupWrapper.classList.add("popup_closing");

        // If it was an alert, we need to disable pointer events immediately on close
        popupWrapper.style.pointerEvents = "none";

        toggleExternalUI(true);
        setTimeout(() => popupWrapper.remove(), 380);
    };

    const result = { closeBtn: popupClose, popupSection, popupMover, popupWrapper, closePopup };
    if (popupId) activePopups.set(popupId, result);

    if (canClose) {
        popupClose.addEventListener("mousedown", () => {
            const beforeCloseEvent = new CustomEvent("popupBeforeClose", { cancelable: true });
            popupClose.dispatchEvent(beforeCloseEvent);
            if (!beforeCloseEvent.defaultPrevented) closePopup();
        });
    }

    // 5. Draggable Logic (for non-alerts and if allowed)
    if (!isAlert && canDrag) {
        let isDragging = false;
        let startX, startY, currentTX = 0, currentTY = 0, startTX = 0, startTY = 0;

        popupHeader.style.cursor = "grab";
        popupHeader.addEventListener("mousedown", (e) => {
            if (e.target === popupClose || popupClose.contains(e.target)) return;
            isDragging = true;
            popupHeader.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            startTX = currentTX;
            startTY = currentTY;
            popupMover.style.transition = "none";

            const onMouseMove = (moveEv) => {
                if (!isDragging) return;
                currentTX = startTX + (moveEv.clientX - startX);
                currentTY = startTY + (moveEv.clientY - startY);
                popupMover.style.transform = `translate(${currentTX}px, ${currentTY}px)`;
            };

            const onMouseUp = () => {
                isDragging = false;
                popupHeader.style.cursor = "grab";
                popupMover.style.transition = "";
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        popupSection.addEventListener("mousedown", () => {
            currentZIndex++;
            popupWrapper.style.zIndex = currentZIndex;
        }, { capture: true });
    }

    // 6. Entry Animation
    setTimeout(() => {
        popupWrapper.classList.add("popup_opened");

        // Determine backdrop color:
        // 1. Alerts get a heavy dark overlay
        // 2. Regular popups & Preview modes get NO overlay (transparent)
        if (isAlert) {
            popupWrapper.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
        } else {
            popupWrapper.style.backgroundColor = "transparent";
        }
    }, 10);

    return result;
}

/**
 * Display a top-center notification with a 5-second progress bar.
 * Supporting multiple concurrent notifications.
 * @param {string} message - The text content to display.
 * @param {"info"|"success"|"error"|"warning"} type - The visual style of the notification.
 */
export function showNotification(message, type = "info") {
    let container = document.querySelector(".notification_container");

    // Create container if not exists
    if (!container) {
        container = document.createElement("div");
        container.className = "notification_container";
        document.body.appendChild(container);
    }

    const activeNotifications = container.querySelectorAll(".notification:not(.exit)");
    if (activeNotifications.length >= 5) {
        const oldest = activeNotifications[0];
        oldest.classList.add("exit");
        setTimeout(() => {
            if (oldest.parentElement) oldest.remove();
        }, 350);
    }

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;

    const text = document.createElement("span");
    text.textContent = message;
    notification.appendChild(text);

    const progress = document.createElement("div");
    progress.className = "notification_progress";
    notification.appendChild(progress);

    container.appendChild(notification);

    // Auto-remove logic
    const removeNotification = () => {
        if (!notification.parentElement) return;

        notification.classList.add("exit");
        setTimeout(() => {
            notification.remove();
            // Cleanup container if empty
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    };

    // Duration: 5 seconds
    setTimeout(removeNotification, 5000);
}
