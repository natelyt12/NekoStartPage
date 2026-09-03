import { renderIcons } from "/src/core/icon.js";
import { t, translateDOM } from "/src/core/i18n.js";

const activePopups = new Map();
let currentZIndex = 1000;

// Track the most recent user click position to anchor popups intelligently
let lastPointerPos = null;
if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", (e) => {
        if (e.clientX !== undefined && e.clientY !== undefined) {
            lastPointerPos = { x: e.clientX, y: e.clientY };
        }
    }, { capture: true, passive: true });
}

/**
 * Opens a custom popup positioned contextually near the cursor or centered in the viewport.
 * Features automatic edge-clamping to prevent overflowing off-screen.
 * 
 * @param {string} title - Header title text.
 * @param {HTMLElement} contentNode - Body content element.
 * @param {string} [width="400px"] - Popup width (CSS string).
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.id=null] - Unique identifier for the popup to prevent duplicates.
 * @param {boolean} [options.canClose=true] - Whether to show the close 'X' button and allow backdrop/Esc closing.
 * @param {boolean} [options.preventBackdropClose=false] - If true, clicking the backdrop will not close the popup.
 * @param {{x: number, y: number}} [options.anchorPos=null] - Explicit coordinates to anchor the popup center.
 * @param {Event} [options.anchorEvent=null] - Click/pointer event to derive anchor coordinates.
 * @param {boolean} [options.hideWidgetGrid=false] - Hide widgets container while popup is open.
 * @param {boolean} [options.hideSettingPanel=false] - Hide settings panel while popup is open.
 * @param {Function} [options.onClose=null] - Callback triggered when popup closes.
 * @returns {{ closeBtn: HTMLElement|null, popupSection: HTMLElement, popupWrapper: HTMLElement, closePopup: Function }}
 */
export function openCustomPopup(title, contentNode, width = "400px", options = {}) {
    const {
        id: popupId = null,
        canClose = true,
        preventBackdropClose = false,
        hideWidgetGrid = false,
        hideSettingPanel = false,
        onClose = null
    } = options;

    // If a popup with the same ID is already open, focus it
    if (popupId && activePopups.has(popupId)) {
        const existing = activePopups.get(popupId);
        currentZIndex++;
        existing.popupWrapper.style.zIndex = currentZIndex;
        existing.popupSection.style.animation = "none";
        setTimeout(() => {
            existing.popupSection.style.animation = "popup_enter 0.3s var(--expo_out)";
        }, 10);
        return existing;
    }

    const popupWrapper = document.createElement("div");
    popupWrapper.className = "popup_section_wrapper";
    popupWrapper.style.zIndex = ++currentZIndex;

    const popupSection = document.createElement("div");
    popupSection.className = "popup_section";
    popupSection.style.width = width;

    // Header with title and close button
    const popupHeader = document.createElement("div");
    popupHeader.className = "popup_header";

    const titleText = document.createElement("span");
    titleText.innerText = title;
    popupHeader.appendChild(titleText);

    let popupClose = null;
    if (canClose) {
        popupClose = document.createElement("button");
        popupClose.className = "popup_close";
        popupClose.setAttribute("aria-label", "Close");
        popupClose.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`;
        popupHeader.appendChild(popupClose);
    }

    // Content container
    const popupContent = document.createElement("div");
    popupContent.className = "popup_content";
    if (contentNode) popupContent.appendChild(contentNode);

    popupSection.append(popupHeader, popupContent);
    popupWrapper.appendChild(popupSection);
    document.body.appendChild(popupWrapper);

    // Contextual positioning: center around click position and clamp within viewport
    const anchor = options.anchorPos || (options.anchorEvent ? { x: options.anchorEvent.clientX, y: options.anchorEvent.clientY } : lastPointerPos);
    
    // Viewport dimensions excluding scrollbars
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;

    // Use unscaled offsetWidth / offsetHeight to avoid animation scale interference
    const popupW = popupSection.offsetWidth || parseInt(width, 10) || 380;
    const popupH = popupSection.offsetHeight || 220;

    const targetX = anchor?.x !== undefined ? anchor.x : (vw / 2);
    const targetY = anchor?.y !== undefined ? anchor.y : (vh / 2);

    const margin = 16;
    let left = targetX - (popupW / 2);
    let top = targetY - (popupH / 2);

    // Strict viewport clamping (never overflow edges)
    const maxLeft = Math.max(margin, vw - popupW - margin);
    const maxTop = Math.max(margin, vh - popupH - margin);

    left = Math.max(margin, Math.min(maxLeft, left));
    top = Math.max(margin, Math.min(maxTop, top));

    popupSection.style.left = `${Math.round(left)}px`;
    popupSection.style.top = `${Math.round(top)}px`;

    // External UI toggle helpers (widgets and setting panel)
    const toggleExternalUI = (visible) => {
        if (hideWidgetGrid) {
            const widgets = document.querySelector("#widgets_container");
            if (widgets) {
                widgets.style.opacity = visible ? "1" : "0";
                widgets.style.pointerEvents = visible ? "auto" : "none";
            }
        }

        if (hideSettingPanel) {
            ["#setting_wrapper", "#setting_toggle_btn"].forEach((selector) => {
                const el = document.querySelector(selector);
                if (el) {
                    if (visible) el.classList.remove("preview_active");
                    else el.classList.add("preview_active");
                }
            });
        }
    };

    toggleExternalUI(false);

    let isClosed = false;
    const closePopup = () => {
        if (isClosed) return;
        isClosed = true;

        if (popupId) activePopups.delete(popupId);
        popupWrapper.classList.add("popup_closing");
        popupWrapper.style.pointerEvents = "none";

        document.removeEventListener("keydown", onKeyDown);
        toggleExternalUI(true);

        if (typeof onClose === "function") {
            onClose();
        }

        setTimeout(() => {
            popupWrapper.remove();
        }, 260);
    };

    // Close on Escape key
    const onKeyDown = (e) => {
        if (e.key === "Escape" && canClose) {
            e.preventDefault();
            closePopup();
        }
    };
    document.addEventListener("keydown", onKeyDown);

    // Close on clicking backdrop
    if (canClose && !preventBackdropClose) {
        popupWrapper.addEventListener("mousedown", (e) => {
            if (e.target === popupWrapper) {
                closePopup();
            }
        });
    }

    if (popupClose) {
        popupClose.addEventListener("click", () => {
            const beforeCloseEvent = new CustomEvent("popupBeforeClose", { cancelable: true });
            popupClose.dispatchEvent(beforeCloseEvent);
            if (!beforeCloseEvent.defaultPrevented) {
                closePopup();
            }
        });
    }

    translateDOM(popupSection);
    renderIcons(popupSection);

    requestAnimationFrame(() => {
        popupWrapper.classList.add("popup_opened");
    });

    const result = { closeBtn: popupClose, popupSection, popupWrapper, closePopup };
    if (popupId) activePopups.set(popupId, result);
    return result;
}

/**
 * Displays a lightweight confirmation dialog with Promise support.
 * 
 * @param {string} msg - Message description text.
 * @param {Object} [options={}] - Dialog options.
 * @param {string} [options.title] - Dialog title.
 * @param {string} [options.okText] - Confirm button label.
 * @param {string} [options.cancelText] - Cancel button label.
 * @param {boolean} [options.isDanger=false] - Whether this is a destructive action (styles confirm button with .danger_btn).
 * @param {string} [options.width="380px"] - Dialog width.
 * @param {Event|{x: number, y: number}} [options.anchor] - Mouse anchor position or event.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
 */
export function showConfirm(msg, options = {}) {
    const {
        title = t("common.confirm", "Xác nhận"),
        okText = t("common.confirm", "Đồng ý"),
        cancelText = t("common.cancel", "Hủy"),
        isDanger = false,
        width = "380px",
        anchor = null
    } = options;

    return new Promise((resolve) => {
        const body = document.createElement("div");
        body.className = "popup_body";
        body.innerHTML = `
            <p class="popup_desc">${msg}</p>
            <div class="actions">
                <button id="confirm_cancel_btn" class="secondary">${cancelText}</button>
                <button id="confirm_ok_btn" class="${isDanger ? "danger_btn" : "primary"}">${okText}</button>
            </div>
        `;

        let resolved = false;
        const finish = (val) => {
            if (resolved) return;
            resolved = true;
            popup.closePopup();
            resolve(val);
        };

        const popup = openCustomPopup(title, body, width, {
            canClose: true,
            anchorPos: anchor?.x !== undefined ? anchor : (anchor?.clientX !== undefined ? { x: anchor.clientX, y: anchor.clientY } : null),
            onClose: () => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }
        });

        body.querySelector("#confirm_cancel_btn")?.addEventListener("click", () => finish(false));
        body.querySelector("#confirm_ok_btn")?.addEventListener("click", () => finish(true));
    });
}

/**
 * Creates a confirmation dialog body with backward-compatible interface.
 * 
 * @param {string} msg - The message to display.
 * @param {Function} onConfirm - Callback executed when the OK button is clicked.
 * @param {Object} [options={}] - Options: okText, cancelText, isDanger, okClass, cancelClass, hideCancel, onCancel.
 * @returns {{ container: HTMLElement, setCloseHandler: Function }}
 */
export function createConfirmDialog(msg, onConfirm, options = {}) {
    const {
        okText = t("common.confirm", "Đồng ý"),
        cancelText = t("common.cancel", "Hủy"),
        isDanger = false,
        okClass = isDanger ? "danger_btn" : "primary",
        cancelClass = "secondary",
        hideCancel = false,
        onCancel = null
    } = options;

    const container = document.createElement("div");
    container.className = "popup_body";
    container.innerHTML = `
        <p class="popup_desc">${msg}</p>
        <div class="actions">
            ${hideCancel ? "" : `<button id="confirm_cancel_btn" class="${cancelClass}">${cancelText}</button>`}
            <button id="confirm_ok_btn" class="${okClass}">${okText}</button>
        </div>
    `;

    let closeHandler = null;

    if (!hideCancel) {
        container.querySelector("#confirm_cancel_btn")?.addEventListener("click", async () => {
            let shouldClose = true;
            if (onCancel) {
                const res = await onCancel();
                if (res === false) shouldClose = false;
            }
            if (shouldClose && closeHandler) closeHandler();
        });
    }

    container.querySelector("#confirm_ok_btn")?.addEventListener("click", async () => {
        let shouldClose = true;
        if (onConfirm) {
            const res = await onConfirm();
            if (res === false) shouldClose = false;
        }
        if (shouldClose && closeHandler) closeHandler();
    });

    return {
        container,
        setCloseHandler: (fn) => { closeHandler = fn; }
    };
}
