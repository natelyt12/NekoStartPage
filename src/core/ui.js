import { getSettings } from "/src/core/storageHandler.js";
import { Icons, renderIcons } from "/src/core/icon.js";
import { t, translateDOM } from "/src/core/i18n.js";

export function initToggleSettingBtn() {
    let isSettingsOpen = false;
    const settingToggleBtn = document.getElementById("setting_toggle_btn");
    if (!settingToggleBtn) return;

    // Set initial opacity based on settings
    const dim = getSettings().hideToggleButton !== false;
    settingToggleBtn.style.opacity = dim ? "0" : "1";

    settingToggleBtn.addEventListener("mousedown", () => {
        isSettingsOpen = !isSettingsOpen;
        const settingWrapper = document.getElementById("setting_wrapper");

        settingWrapper.classList.toggle("setting_wrapper_opened");
        settingToggleBtn.classList.toggle("setting_toggle_btn_opened");

        if (isSettingsOpen) {
            settingToggleBtn.style.opacity = "1";
            settingToggleBtn.innerHTML = Icons.close;
        } else {
            const dim = getSettings().hideToggleButton !== false;
            settingToggleBtn.style.opacity = dim ? "0" : "1";
            settingToggleBtn.innerHTML = Icons.settings;
        }
    });
}

export function initSvgs() {
    const sbsct_svgContainers = document.querySelectorAll(".sbsctsvg");
    sbsct_svgContainers.forEach((container) => {
        if (container.children.length === 0) {
            container.innerHTML = Icons.chevronDown;
        }
    });

    const popupButtons = document.querySelectorAll(".icon_button");
    popupButtons.forEach((btn) => {
        if (!btn.querySelector("svg, i[data-icon]")) {
            const i18nKey = btn.getAttribute("data-i18n");
            const textContent = btn.innerHTML.trim();
            if (i18nKey) {
                btn.innerHTML = `<span data-i18n="${i18nKey}">${textContent}</span>`;
                btn.removeAttribute("data-i18n");
            } else {
                btn.innerHTML = `<span>${textContent}</span>`;
            }
            btn.insertAdjacentHTML('beforeend', Icons.chevronRight);
        }
    });
}

// ==========================================
// SUBSECTION / DROPDOWN
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
            document.querySelectorAll(".subsection.opening").forEach((sub) => {
                sub.classList.remove("opening");
                setTimeout(() => {
                    if (!sub.classList.contains("opening")) {
                        sub.classList.remove("active", "open_upwards");
                    }
                }, 200);
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
                document.querySelectorAll(".subsection.opening").forEach((sub) => {
                    if (sub !== subsection) {
                        sub.classList.remove("opening");
                        setTimeout(() => {
                            if (!sub.classList.contains("opening")) {
                                sub.classList.remove("active", "open_upwards");
                            }
                        }, 200);
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
                    setTimeout(() => {
                        if (!subsection.classList.contains("opening")) {
                            subsection.classList.remove("active", "open_upwards");
                        }
                    }, 200);
                } else {
                    subsection.classList.add("active");
                    subsection.offsetHeight;
                    subsection.classList.add("opening");
                    btn.classList.add("btn_active");

                    const rect = btn.getBoundingClientRect();
                    const scrollParent = btn.closest('.popup_content, #settings_content') || document.body;
                    const parentRect = scrollParent === document.body ? { top: 0, bottom: window.innerHeight } : scrollParent.getBoundingClientRect();

                    if (parentRect.bottom - rect.bottom < 250 && rect.top - parentRect.top > 200) {
                        subsection.classList.add("open_upwards");
                    } else {
                        subsection.classList.remove("open_upwards");
                    }
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
                setTimeout(() => {
                    if (!subsection.classList.contains("opening")) {
                        subsection.classList.remove("active", "open_upwards");
                    }
                }, 200);
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

// Keep track of active popups by ID
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

    // Wrap content for swipe-up animation
    const popupContentWrapper = document.createElement("div");
    popupContentWrapper.className = "popup_content_wrapper";

    const popupContent = document.createElement("div");
    popupContent.className = "popup_content";
    popupContent.appendChild(contentNode);

    popupContentWrapper.appendChild(popupContent);

    // 3. Assemble & Inject
    popupHeader.appendChild(popupControls);
    popupSection.append(popupHeader, popupContentWrapper);
    popupMover.appendChild(popupSection);
    popupWrapper.appendChild(popupMover);

    // Prepare for absolute positioning to prevent flex centering jumps
    popupMover.style.position = "absolute";
    popupSection.style.animation = "none";
    popupWrapper.style.visibility = "hidden";

    document.body.appendChild(popupWrapper);

    // Read intrinsic dimensions (ignoring transforms)
    const w = popupSection.offsetWidth;
    const h = popupSection.offsetHeight;

    // Lock position to the center of the viewport
    popupMover.style.left = `calc(50vw - ${w / 2}px)`;
    popupMover.style.top = `calc(50vh - ${h / 2}px)`;

    // Restore animation and visibility
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

        // Fade out background
        popupWrapper.style.backgroundColor = "transparent";
        popupWrapper.classList.add("popup_closing");

        // If it was an alert, we need to disable pointer events immediately on close
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

    // 5. Draggable Logic (for non-alerts and if allowed)
    if (!isAlert && canDrag) {
        let isDragging = false;
        let startX,
            startY,
            currentTX = 0,
            currentTY = 0,
            startTX = 0,
            startTY = 0;

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

    // 6. Entry Animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            popupWrapper.classList.add("popup_opened");

            // Determine backdrop color:
            // 1. Alerts get a heavy dark overlay
            // 2. Regular popups & Preview modes get NO overlay (transparent)
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
        oldest.style.maxHeight = oldest.offsetHeight + "px";
        oldest.offsetHeight; // force reflow
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
        if (!notification.parentElement || notification.classList.contains("exit")) return;

        notification.style.maxHeight = notification.offsetHeight + "px";
        notification.offsetHeight; // force reflow
        notification.classList.add("exit");
        setTimeout(() => {
            notification.remove();
            // Cleanup container if empty
            if (container.children.length === 0) {
                container.remove();
            }
        }, 350);
    };

    // Duration: 5 seconds
    setTimeout(removeNotification, 5000);
}

/**
 * Creates a reusable premium slider component with a header row (label, number input, reset button)
 * and a full-width range slider below it.
 * 
 * @param {Object} options - Slider configuration
 * @param {string} options.label - The text label of the slider
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {number} options.step - Increment step
 * @param {number} options.value - Initial value
 * @param {number} options.defaultValue - Default value to reset to
 * @param {string} options.unit - Unit to display next to the number input (e.g. "%", "px", "deg", "s")
 * @param {function} options.onChange - Callback triggered on slider or input changes (receives new float value)
 * @returns {HTMLElement & { value: number, setValueNoAnim: function(number): void }} The created DOM element wrapper with added properties/methods
 */
export function createSlider(options) {
    const {
        label = "Slider",
        dataI18n = null,
        min = 0,
        max = 100,
        step = 1,
        value = 50,
        defaultValue = 50,
        unit = "",
        onChange = null
    } = options;

    const wrapper = document.createElement("div");
    wrapper.className = "custom_slider_group";

    const header = document.createElement("div");
    header.className = "slider_header";

    const labelSpan = document.createElement("span");
    labelSpan.className = "slider_label";
    labelSpan.innerText = label;
    if (dataI18n) {
        labelSpan.setAttribute("data-i18n", dataI18n);
    }

    const controlGroup = document.createElement("div");
    controlGroup.className = "slider_control_group";

    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.className = "slider_num_input";
    numInput.min = min;
    numInput.max = max;
    numInput.step = step;
    numInput.value = value;

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "slider_reset_btn";
    resetBtn.innerHTML = Icons.reset;
    resetBtn.title = "Reset to default";

    controlGroup.appendChild(numInput);
    const unitSpan = document.createElement("span");
    unitSpan.className = "slider_unit";
    unitSpan.innerText = unit || "\u00A0";
    controlGroup.appendChild(unitSpan);
    controlGroup.appendChild(resetBtn);

    header.appendChild(labelSpan);
    header.appendChild(controlGroup);

    const sliderRow = document.createElement("div");
    sliderRow.className = "slider_row_container";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "slider_step_btn btn_liked";
    decBtn.innerHTML = Icons.sliderDec;

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "slider_step_btn btn_liked";
    incBtn.innerHTML = Icons.sliderInc;

    const trackContainer = document.createElement("div");
    trackContainer.className = "custom_slider_track_container";

    const track = document.createElement("div");
    track.className = "custom_slider_track";

    const trackFill = document.createElement("div");
    trackFill.className = "custom_slider_track_fill";
    track.appendChild(trackFill);

    const thumb = document.createElement("div");
    thumb.className = "custom_slider_thumb";

    trackContainer.appendChild(track);
    trackContainer.appendChild(thumb);

    sliderRow.appendChild(decBtn);
    sliderRow.appendChild(trackContainer);
    sliderRow.appendChild(incBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(sliderRow);

    // Sync mechanism
    let currentValue = value;
    let isDragging = false;

    const updateValue = (val, triggerCallback = true, animate = true) => {
        let numericVal = parseFloat(val);
        if (isNaN(numericVal)) return;

        // Clamp value
        if (numericVal < min) numericVal = min;
        if (numericVal > max) numericVal = max;

        // Round to step precision
        const decimalPlaces = (step.toString().split('.')[1] || '').length;
        numericVal = parseFloat(numericVal.toFixed(decimalPlaces));

        const isValueChanged = currentValue !== numericVal;

        currentValue = numericVal;
        numInput.value = numericVal;

        // Update thumb position
        const percentage = ((numericVal - min) / (max - min));

        if (animate && !isDragging) {
            thumb.style.transition = "left 0.3s var(--expo_out), transform 0.3s var(--expo_out), border-radius 0.3s var(--expo_out), box-shadow 0.3s var(--expo_out)";
            trackFill.style.transition = "width 0.3s var(--expo_out)";
        } else {
            thumb.style.transition = "transform 0.3s var(--expo_out), border-radius 0.3s var(--expo_out), box-shadow 0.3s var(--expo_out)";
            trackFill.style.transition = "none";
        }

        // Set position with bounded edges
        const posCalc = `calc(8px + ${percentage} * (100% - 16px))`;
        thumb.style.left = posCalc;
        trackFill.style.width = posCalc;

        if (triggerCallback && onChange && isValueChanged) {
            onChange(numericVal);
        }
    };

    // Drag logic
    const updateFromMouse = (e) => {
        const rect = trackContainer.getBoundingClientRect();
        const interactiveWidth = rect.width - 16;
        let x = e.clientX - (rect.left + 8);
        if (x < 0) x = 0;
        if (x > interactiveWidth) x = interactiveWidth;

        const percentage = x / interactiveWidth;
        const rawValue = min + percentage * (max - min);

        // snap to step
        const steps = Math.round((rawValue - min) / step);
        const snappedValue = min + steps * step;

        updateValue(snappedValue, true, false);
    };

    trackContainer.addEventListener("mousedown", (e) => {
        isDragging = true;
        thumb.classList.add("dragging");
        updateFromMouse(e);

        const onMouseMove = (moveEv) => {
            if (!isDragging) return;
            updateFromMouse(moveEv);
        };

        const onMouseUp = () => {
            isDragging = false;
            thumb.classList.remove("dragging");
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    numInput.addEventListener("input", (e) => {
        updateValue(e.target.value, true, true);
    });

    numInput.addEventListener("change", (e) => {
        updateValue(e.target.value, true, true);
    });

    resetBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        updateValue(defaultValue, true, true);
    });

    decBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        updateValue(currentValue - step, true, true);
    });

    incBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        updateValue(currentValue + step, true, true);
    });

    // Initialize position without triggering callback
    updateValue(value, false, false);

    // Add programmatical property setter/getter
    Object.defineProperty(wrapper, "value", {
        get: () => currentValue,
        set: (val) => updateValue(val, false, true),
        configurable: true
    });

    wrapper.setValueNoAnim = (val) => updateValue(val, false, false);

    return wrapper;
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
