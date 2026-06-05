import { loadCSS, unloadHTML } from "/script/core/loader.js";
import { getSettings, saveSettings, subscribe } from "/script/core/storagehandler.js";
import { startClockUpdates, stopClockUpdates } from "/script/widgets/clock/clock.js";
import { startWeatherUpdates, stopWeatherUpdates } from "/script/widgets/weather/weather.js";

let gridSize = 10;
let gridPadding = 0;
let widgetSubscriptions = [];
let isEditMode = false;
let isWidgetDragDirty = false;

export async function initWidget() {
    const isEnabled = getSettings().widgets_enabled !== false;

    if (!isEnabled) {
        cleanupWidget();
        return;
    }

    const container = document.getElementById("widgets_container");
    if (container && container.children.length > 0) {
        return;
    }

    // Load style for widget elements
    loadCSS("script/widgets/style.css");
    loadCSS("script/widgets/clock/clock.css");

    // Load widget HTML files dynamically in parallel
    const widgetsToLoad = ["script/widgets/clock/clock.html"];

    let loadedCount = 0;
    for (const url of widgetsToLoad) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                container.insertAdjacentHTML("beforeend", html);
                loadedCount++;
            }
        } catch (e) {
            console.error(`Failed to load widget HTML from ${url}`, e);
        }
    }

    if (loadedCount > 0) {
        console.debug("Widget DOM loaded dynamically.");

        // Clear existing subscriptions to avoid duplicates
        widgetSubscriptions.forEach((unsub) => unsub());
        widgetSubscriptions = [];

        gridSize = 10;
        gridPadding = 0;
        container.style.setProperty("--grid-size", gridSize);
        container.style.setProperty("--grid-padding", gridPadding);

        // Apply saved positions
        const savedPositions = getSettings().widget_positions || {};
        const widgets = container.querySelectorAll(".widget");
        widgets.forEach(w => {
            if (savedPositions[w.id]) {
                w.style.left = savedPositions[w.id].left;
                w.style.top = savedPositions[w.id].top;
            }
        });

        makeWidgetsDraggable(container);
        startClockUpdates();
        startWeatherUpdates();
    }
}

function cleanupWidget() {
    stopClockUpdates();
    stopWeatherUpdates();
    widgetSubscriptions.forEach((unsub) => unsub());
    widgetSubscriptions = [];
    unloadHTML("widgets_container");
}

export async function initSettings() {
    // Just sync the toggle checkbox, do not load setting.html which overwrites widgets_container
    syncWidgetToggle();
    syncWidgetEditMode();
}

/**
 * Handle checkbox toggle logic for widget enabling/disabling
 */
function syncWidgetToggle() {
    const widgetCheckbox = document.getElementById("widgets_enabled");
    if (!widgetCheckbox) return;

    subscribe("widgets_enabled", (isEnabled) => {
        const enabled = isEnabled !== false;
        if (enabled) {
            initWidget();
        } else {
            cleanupWidget();
        }
        widgetCheckbox.checked = enabled;

        const widgetSidebarElements = document.querySelectorAll(".widget_sidebar_element");
        widgetSidebarElements.forEach((el) => {
            el.style.display = enabled ? "" : "none";
        });

        if (!enabled) {
            const activeTab = document.querySelector(".nav_item.active");
            if (activeTab) {
                const activeTabId = activeTab.getAttribute("data-tab");
                if (activeTabId === "time" || activeTabId === "weather") {
                    const widgetsTab = document.querySelector('.nav_item[data-tab="widgets"]');
                    if (widgetsTab) {
                        widgetsTab.dispatchEvent(new MouseEvent("mousedown"));
                    }
                }
            }
        }
    });

    widgetCheckbox.onchange = (e) => {
        saveSettings({ widgets_enabled: e.target.checked });
    };
}

/**
 * Enable drag and drop behavior for all widget elements with grid snapping
 */
function makeWidgetsDraggable(container) {
    const widgets = container.querySelectorAll(".widget");

    widgets.forEach((widget) => {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;
        let guide = null;

        const getPosition = (el) => {
            return {
                left: el.offsetLeft,
                top: el.offsetTop,
                width: el.offsetWidth,
                height: el.offsetHeight,
            };
        };

        const handleStart = (clientX, clientY) => {
            isDragging = true;
            widget.classList.add("dragging");

            const pos = getPosition(widget);
            initialLeft = pos.left;
            initialTop = pos.top;
            startX = clientX;
            startY = clientY;

            guide = document.createElement("div");
            guide.className = "widget-snap-guide";
            guide.style.width = pos.width + "px";
            guide.style.height = pos.height + "px";
            guide.style.left = initialLeft + "px";
            guide.style.top = initialTop + "px";
            container.appendChild(guide);
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            // Boundary limits
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const pos = getPosition(widget);

            // Calculate responsive boundary limits utilizing clamped effective padding
            const rawPaddingPx = gridPadding * gridSize;
            const maxPaddingX = Math.max(0, (containerWidth - pos.width) / 2);
            const maxPaddingY = Math.max(0, (containerHeight - pos.height) / 2);

            const paddingPxX = Math.min(rawPaddingPx, maxPaddingX);
            const paddingPxY = Math.min(rawPaddingPx, maxPaddingY);

            const minX = paddingPxX;
            const maxX = containerWidth - pos.width - paddingPxX;
            const minY = paddingPxY;
            const maxY = containerHeight - pos.height - paddingPxY;

            // Clamp new coordinates
            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));

            // Apply style transforms for visual responsiveness during drag
            widget.style.left = newLeft + "px";
            widget.style.top = newTop + "px";

            // Calculate grid snap coordinates for the helper guide
            const snappedX = Math.round((newLeft - paddingPxX) / gridSize) * gridSize + paddingPxX;
            const snappedY = Math.round((newTop - paddingPxY) / gridSize) * gridSize + paddingPxY;

            if (guide) {
                guide.style.left = snappedX + "px";
                guide.style.top = snappedY + "px";
            }
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            widget.classList.remove("dragging");

            // Apply grid snapping to final position
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const pos = getPosition(widget);

            const rawPaddingPx = gridPadding * gridSize;
            const maxPaddingX = Math.max(0, (containerWidth - pos.width) / 2);
            const maxPaddingY = Math.max(0, (containerHeight - pos.height) / 2);

            const paddingPxX = Math.min(rawPaddingPx, maxPaddingX);
            const paddingPxY = Math.min(rawPaddingPx, maxPaddingY);

            const snappedX = Math.round((pos.left - paddingPxX) / gridSize) * gridSize + paddingPxX;
            const snappedY = Math.round((pos.top - paddingPxY) / gridSize) * gridSize + paddingPxY;

            widget.style.left = snappedX + "px";
            widget.style.top = snappedY + "px";

            // Check if widget position changed
            if (snappedX !== initialLeft || snappedY !== initialTop) {
                isWidgetDragDirty = true;
            }

            // Remove guide
            if (guide) {
                guide.remove();
                guide = null;
            }
        };

        // Mouse Events
        const handleHandle = widget;
        handleHandle.addEventListener("mousedown", (e) => {
            if (!isEditMode) return;
            if (e.target.closest("button, input, select, a")) return;
            e.preventDefault();
            handleStart(e.clientX, e.clientY);

            const onMouseMove = (moveEvent) => {
                handleMove(moveEvent.clientX, moveEvent.clientY);
            };

            const onMouseUp = () => {
                handleEnd();
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        // Touch Events
        handleHandle.addEventListener("touchstart", (e) => {
            if (!isEditMode) return;
            if (e.target.closest("button, input, select, a")) return;
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY);

            const onTouchMove = (moveEvent) => {
                const moveTouch = moveEvent.touches[0];
                handleMove(moveTouch.clientX, moveTouch.clientY);
            };

            const onTouchEnd = () => {
                handleEnd();
                document.removeEventListener("touchmove", onTouchMove);
                document.removeEventListener("touchend", onTouchEnd);
            };

            document.addEventListener("touchmove", onTouchMove, { passive: false });
            document.addEventListener("touchend", onTouchEnd);
        });
    });
}

export function syncWidgetEditMode() {
    const editBtn = document.getElementById("widget_edit_mode");
    if (!editBtn) return;

    subscribe("widgets_enabled", (enabled) => {
        editBtn.disabled = enabled === false;
        editBtn.style.opacity = enabled !== false ? "1" : "0.5";
        editBtn.style.pointerEvents = enabled !== false ? "auto" : "none";
    });

    editBtn.onclick = () => {
        startEditMode();
    };
}

function startEditMode() {
    const container = document.getElementById("widgets_container");
    if (!container) return;

    // Save original positions
    const originalPositions = [];
    const widgets = container.querySelectorAll(".widget");
    widgets.forEach(w => {
        originalPositions.push({
            element: w,
            left: w.style.left,
            top: w.style.top
        });
    });

    isWidgetDragDirty = false;
    isEditMode = true;
    container.classList.add("edit-mode");

    // Create popup content
    const contentNode = document.createElement("div");
    contentNode.className = "popup_body";
    contentNode.innerHTML = `
        <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">Đang ở chế độ chỉnh sửa widget. Kéo thả widget để thay đổi vị trí.</p>
        <div class="actions">
            <button id="widget_cancel_btn" class="secondary">Hủy bỏ</button>
            <button id="widget_save_btn" class="primary">Lưu</button>
        </div>
    `;

    // Import functions dynamically
    Promise.all([
        import("/script/core/UI.js"),
        import("/script/core/i18n.js")
    ]).then(([{ openCustomPopup, showNotification }, { t }]) => {
        const popup = openCustomPopup("Chế độ chỉnh sửa", contentNode, "320px", {
            id: "widget_edit_popup",
            isAlert: false,
            canClose: false,
            hidesetting: true
        });

        let canExit = false;
        let exitTimer = null;

        contentNode.querySelector("#widget_cancel_btn").onmousedown = () => {
            if (isWidgetDragDirty && !canExit) {
                showNotification(t("alert.unsaved_changes"), "warning");
                canExit = true;
                if (exitTimer) clearTimeout(exitTimer);
                exitTimer = setTimeout(() => {
                    canExit = false;
                }, 5000);
            } else {
                // Restore original positions
                originalPositions.forEach(pos => {
                    pos.element.style.left = pos.left;
                    pos.element.style.top = pos.top;
                });

                exitMode();
            }
        };

        contentNode.querySelector("#widget_save_btn").onmousedown = () => {
            const finalPositions = {};
            const widgets = container.querySelectorAll(".widget");
            widgets.forEach(w => {
                finalPositions[w.id] = {
                    left: w.style.left,
                    top: w.style.top
                };
            });
            saveSettings({ widget_positions: finalPositions });
            showNotification(t("alert.saved_changes"), "success");

            exitMode();
        };

        function exitMode() {
            isEditMode = false;
            container.classList.remove("edit-mode");

            popup.closePopup();
        }
    });
}
