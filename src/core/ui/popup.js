import { renderIcons } from "/src/core/icon.js";
import { t, translateDOM } from "/src/core/i18n.js";

const activePopups = new Map();
let currentZIndex = 101;

/**
 * Open a custom popup with designated HTML content.
 * @param {string} title - Popup header title.
 * @param {HTMLElement} contentNode - Configured HTML node containing logic.
 * @param {string} width - Popup width.
 * @param {Object} options - Popup settings options:
 *   - id {string}: Định danh popup, giúp tránh mở trùng nhiều popup cùng id (nếu đã mở sẽ tạo hiệu ứng zoom focus).
 *   - isAlert {boolean}: Nếu true, tạo nền tối (overlay mờ) và chặn click ra bên ngoài, không cho phép kéo thả.
 *   - canClose {boolean}: Hiển thị nút X để đóng. Nếu false sẽ ẩn nút X.
 *   - hideWidgetGrid {boolean}: Ẩn và chặn tương tác với danh sách Widget trên màn hình.
 *   - hideSettingPanel {boolean}: Ẩn bảng Setting (Bảng Cài đặt bên phải).
 *   - canDrag {boolean}: Cho phép kéo thả popup (không áp dụng cho isAlert). Mặc định true.
 * @returns {Object} { closeBtn, popupSection, popupMover, popupWrapper, closePopup } Reference to the popup components and close method.
 */
export function openCustomPopup(title, contentNode, width = "400px", options = {}) {
    const {
        id: popupId = null,
        isAlert = false,
        canClose = true,
        canMinimize = options.isAlert ? false : true,
        hideWidgetGrid = false,
        hideSettingPanel = false,
        canDrag = true
    } = options;

    const shouldHideWidgetGrid = hideWidgetGrid;
    const shouldHideSettingPanel = hideSettingPanel;

    if (popupId && activePopups.has(popupId)) {
        const existing = activePopups.get(popupId);
        currentZIndex++;
        existing.popupWrapper.style.zIndex = currentZIndex;

        existing.popupSection.style.animation = "none";
        setTimeout(() => {
            existing.popupSection.style.animation = "popup_focus_zoom 0.3s var(--expo_out)";
        }, 10);

        return existing;
    }

    const popupWrapper = document.createElement("div");
    popupWrapper.className = "popup_section_wrapper";
    popupWrapper.style.zIndex = ++currentZIndex;
    popupWrapper.style.backgroundColor = "transparent";
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
    if (!isAlert && canDrag) {
        popupHeader.classList.add("draggable");
    }

    const titleText = document.createElement("span");
    titleText.innerText = title;
    popupHeader.appendChild(titleText);

    const popupControls = document.createElement("div");
    popupControls.className = "popup_controls";

    const popupMinimize = document.createElement("button");
    popupMinimize.className = "popup_close popup_minimize";
    popupMinimize.style.display = canMinimize ? "flex" : "none";
    popupMinimize.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 12H17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;

    popupMinimize.onclick = (e) => {
        e.stopPropagation();
        popupSection.classList.toggle("minimized");
    };

    const popupClose = document.createElement("button");
    popupClose.className = "popup_close";
    popupClose.style.display = canClose ? "flex" : "none";
    popupClose.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 7L7 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 7L17 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;

    popupControls.appendChild(popupMinimize);
    popupControls.appendChild(popupClose);

    const popupContentWrapper = document.createElement("div");
    popupContentWrapper.className = "popup_content_wrapper";

    const popupContent = document.createElement("div");
    popupContent.className = "popup_content";
    popupContent.appendChild(contentNode);

    popupContentWrapper.appendChild(popupContent);

    popupHeader.appendChild(popupControls);
    popupSection.append(popupHeader, popupContentWrapper);
    popupMover.appendChild(popupSection);
    popupWrapper.appendChild(popupMover);

    popupMover.style.position = "absolute";
    popupSection.style.animation = "none";
    popupWrapper.style.visibility = "hidden";

    document.body.appendChild(popupWrapper);

    const w = popupSection.offsetWidth;
    const h = popupSection.offsetHeight;

    popupMover.style.left = `calc(50vw - ${w / 2}px)`;
    popupMover.style.top = `calc(50vh - ${h / 2}px)`;

    popupSection.style.animation = "";
    popupWrapper.style.visibility = "";

    const toggleExternalUI = (visible) => {
        if (shouldHideWidgetGrid) {
            const widgets = document.querySelector("#widgets_container");
            if (widgets) {
                widgets.style.opacity = visible ? "1" : "0";
                widgets.style.pointerEvents = visible ? "auto" : "none";
            }
        }

        if (shouldHideSettingPanel) {
            ["#setting_wrapper", "#setting_toggle_btn"].forEach((selector) => {
                const el = document.querySelector(selector);
                if (el) {
                    if (visible) {
                        el.classList.remove("preview_active");
                    } else {
                        el.classList.add("preview_active");
                    }
                }
            });
        }
    };

    toggleExternalUI(false);

    const recenter = () => {
        if (popupSection.classList.contains("minimized")) return;
        const currentW = popupSection.offsetWidth;
        const currentH = popupSection.offsetHeight;
        popupMover.style.left = `calc(50vw - ${currentW / 2}px)`;
        popupMover.style.top = `calc(50vh - ${currentH / 2}px)`;
    };

    const closePopup = () => {
        if (popupId) activePopups.delete(popupId);

        popupWrapper.style.backgroundColor = "transparent";
        popupWrapper.classList.add("popup_closing");
        popupWrapper.style.pointerEvents = "none";

        toggleExternalUI(true);
        setTimeout(() => popupWrapper.remove(), 380);
    };

    const result = { closeBtn: popupClose, popupSection, popupMover, popupWrapper, closePopup, recenter };
    if (popupId) activePopups.set(popupId, result);

    if (canClose) {
        popupClose.addEventListener("mousedown", () => {
            const beforeCloseEvent = new CustomEvent("popupBeforeClose", { cancelable: true });
            popupClose.dispatchEvent(beforeCloseEvent);
            if (!beforeCloseEvent.defaultPrevented) closePopup();
        });
    }

    if (!isAlert && canDrag) {
        let isDragging = false;
        let startX, startY, currentTX = 0, currentTY = 0, startTX = 0, startTY = 0;

        popupHeader.style.cursor = "default";
        popupHeader.addEventListener("mousedown", (e) => {
            if (e.target === popupClose || popupClose.contains(e.target)) return;
            isDragging = true;
            popupHeader.style.cursor = "default";
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
                popupHeader.style.cursor = "default";
                popupMover.style.transition = "";
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        popupSection.addEventListener(
            "mousedown",
            () => {
                currentZIndex++;
                popupWrapper.style.zIndex = currentZIndex;
            },
            { capture: true },
        );
    }

    translateDOM(popupSection);
    renderIcons(popupSection);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            popupWrapper.classList.add("popup_opened");

            if (isAlert) {
                popupWrapper.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
            } else {
                popupWrapper.style.backgroundColor = "transparent";
            }
        });
    });

    return result;
}

/**
 * Creates a reusable confirmation dialog body.
 * @param {string} msg - The message to display.
 * @param {function} onConfirm - Callback executed when the OK button is clicked.
 * @param {Object} [options] - Additional configuration options.
 * @param {string} [options.okText] - Custom text for the OK button.
 * @param {string} [options.cancelText] - Custom text for the Cancel button.
 * @param {string} [options.okClass] - Custom CSS class for the OK button.
 * @param {string} [options.cancelClass] - Custom CSS class for the Cancel button.
 * @param {boolean} [options.hideCancel=false] - Whether to hide the Cancel button entirely.
 * @param {function} [options.onCancel] - Optional callback executed exclusively when the Cancel button is clicked.
 * @returns {Object} { container: HTMLElement, setCloseHandler: function }
 */
export function createConfirmDialog(msg, onConfirm, options = {}) {
    const {
        okText = t("common.confirm"),
        cancelText = t("common.cancel"),
        okClass = "",
        cancelClass = "",
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
        container.querySelector("#confirm_cancel_btn").onmousedown = async () => {
            if (onCancel) await onCancel();
            if (closeHandler) closeHandler();
        };
    }
    container.querySelector("#confirm_ok_btn").onmousedown = async () => {
        if (closeHandler) closeHandler();
        await onConfirm();
    };
    return { container, setCloseHandler: (fn) => (closeHandler = fn) };
}
