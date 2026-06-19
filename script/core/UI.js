import { getSettings } from "/script/core/storagehandler.js";
import { Icons, renderIcons } from "/script/core/icon.js";
import { translateDOM } from "/script/core/i18n.js";

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
 * @param {Object} options - Popup settings options: { id: string, isAlert: boolean, canClose: boolean, hideUI: boolean }
 * @returns {Object} { closeBtn } Reference to the popup's close button.
 */
export function openCustomPopup(title, contentNode, width = "400px", options = {}) {
    const {
        id: popupId = null,
        isAlert = false,
        canClose = true,
        hideUI = false,
        preview = false,
        hideWidgetGrid = false,
        hideSettingPanel = false,
        canDrag = true
    } = options;

    const shouldHideWidgetGrid = hideWidgetGrid || hideUI || preview;
    const shouldHideSettingPanel = hideSettingPanel || hideUI || preview;

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
 * @returns {HTMLElement} The created DOM element wrapper
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

    const rangeInput = document.createElement("input");
    rangeInput.type = "range";
    rangeInput.className = "slider_range_input";
    rangeInput.min = min;
    rangeInput.max = max;
    rangeInput.step = step;
    rangeInput.value = value;

    sliderRow.appendChild(decBtn);
    sliderRow.appendChild(rangeInput);
    sliderRow.appendChild(incBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(sliderRow);

    // Sync mechanism
    const updateValue = (val, triggerCallback = true) => {
        let numericVal = parseFloat(val);
        if (isNaN(numericVal)) return;

        // Clamp value
        if (numericVal < min) numericVal = min;
        if (numericVal > max) numericVal = max;

        // Round to step precision
        const decimalPlaces = (step.toString().split('.')[1] || '').length;
        numericVal = parseFloat(numericVal.toFixed(decimalPlaces));

        rangeInput.value = numericVal;
        numInput.value = numericVal;

        if (triggerCallback && onChange) {
            onChange(numericVal);
        }
    };

    rangeInput.addEventListener("input", (e) => {
        updateValue(e.target.value);
    });

    numInput.addEventListener("input", (e) => {
        updateValue(e.target.value);
    });

    numInput.addEventListener("change", (e) => {
        updateValue(e.target.value);
    });

    resetBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        updateValue(defaultValue);
    });

    decBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const currentVal = parseFloat(rangeInput.value);
        updateValue(currentVal - step);
    });

    incBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const currentVal = parseFloat(rangeInput.value);
        updateValue(currentVal + step);
    });

    // Add programmatical property setter/getter
    Object.defineProperty(wrapper, "value", {
        get: () => parseFloat(rangeInput.value),
        set: (newVal) => updateValue(newVal, false),
        configurable: true
    });

    return wrapper;
}
