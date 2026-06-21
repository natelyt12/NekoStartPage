import { loadCSS, unloadHTML } from "/script/core/loader.js";
import { getSettings, saveSettings, subscribe } from "/script/core/storagehandler.js";
import { startClockUpdates, stopClockUpdates } from "/script/widgets/clock/clock.js";
import { startWeatherUpdates, stopWeatherUpdates } from "/script/widgets/weather/weather.js";
import { Icons } from "/script/core/icon.js";

let gridSize = 10;
let gridPadding = 0;
let widgetSubscriptions = [];
let isEditMode = false;
let isWidgetDragDirty = false;

export function applyWidgetPositionStyles(widget, pos, paddingPx = 0) {
    widget.style.left = "";
    widget.style.right = "";
    widget.style.top = "";
    widget.style.bottom = "";
    widget.style.translate = "";

    const { anchor, offsetX, offsetY } = pos;

    // Offsets are stored relative to the content-box (after padding).
    // CSS left/right/top/bottom are measured from the container's padding edge,
    // so we must add paddingPx for left/top anchors and subtract for right/bottom anchors.
    // For center-* anchors, calc(50%) spans the full box including padding,
    // so we shift by paddingPx to align the midpoint with the content-box center.
    switch (anchor) {
        case "top-left":
            widget.style.left = `${offsetX + paddingPx}px`;
            widget.style.top = `${offsetY + paddingPx}px`;
            break;
        case "top-center":
            // calc(50%) is the visual center of the full box.
            // Content-box center is shifted by paddingPx from the left, so net shift is 0
            // (extra paddingPx on left, same subtracted on right → center stays at 50%).
            // offsetX is displacement from content-box center.
            widget.style.left = `calc(50% + ${offsetX}px)`;
            widget.style.top = `${offsetY + paddingPx}px`;
            widget.style.translate = "-50% 0";
            break;
        case "top-right":
            widget.style.right = `${offsetX + paddingPx}px`;
            widget.style.top = `${offsetY + paddingPx}px`;
            break;
        case "center-left":
            widget.style.left = `${offsetX + paddingPx}px`;
            // calc(50%) center of full box; content-box center is at same 50% when padding is symmetric.
            widget.style.top = `calc(50% + ${offsetY}px)`;
            widget.style.translate = "0 -50%";
            break;
        case "center":
            widget.style.left = `calc(50% + ${offsetX}px)`;
            widget.style.top = `calc(50% + ${offsetY}px)`;
            widget.style.translate = "-50% -50%";
            break;
        case "center-right":
            widget.style.right = `${offsetX + paddingPx}px`;
            widget.style.top = `calc(50% + ${offsetY}px)`;
            widget.style.translate = "0 -50%";
            break;
        case "bottom-left":
            widget.style.left = `${offsetX + paddingPx}px`;
            widget.style.bottom = `${offsetY + paddingPx}px`;
            break;
        case "bottom-center":
            widget.style.left = `calc(50% + ${offsetX}px)`;
            widget.style.bottom = `${offsetY + paddingPx}px`;
            widget.style.translate = "-50% 0";
            break;
        case "bottom-right":
            widget.style.right = `${offsetX + paddingPx}px`;
            widget.style.bottom = `${offsetY + paddingPx}px`;
            break;
        default:
            widget.style.left = `${offsetX + paddingPx}px`;
            widget.style.top = `${offsetY + paddingPx}px`;
            break;
    }
}

export async function initWidget() {
    const isEnabled = getSettings().widgets?.enabled !== false;

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
    const widgetsToLoad = [];
    if (getSettings().widgets?.clock?.enabled !== false) widgetsToLoad.push("script/widgets/clock/clock.html");
    if (getSettings().widgets?.weather?.enabled !== false) widgetsToLoad.push("script/widgets/weather/weather.html");

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

        // Inject drag handle into every widget that doesn't already have one
        const DRAG_HANDLE_HTML = `
            <div class="widget-drag-handle">
                ${Icons.move}
            </div>`;
        container.querySelectorAll(".widget").forEach((w) => {
            if (!w.querySelector(".widget-drag-handle")) {
                w.insertAdjacentHTML("afterbegin", DRAG_HANDLE_HTML);
            }
        });

        widgetSubscriptions.forEach((unsub) => unsub());
        widgetSubscriptions = [];

        gridSize = 10;
        gridPadding = getSettings().widgets?.grid_padding !== undefined ? getSettings().widgets.grid_padding : 0;
        container.style.setProperty("--grid-size", gridSize);
        container.style.setProperty("--grid-padding", gridPadding);

        const DEFAULT_POSITIONS = {
            "widget-clock": { anchor: "bottom-left", offsetX: 0, offsetY: 0 },
            "widget-weather": { anchor: "top-right", offsetX: 20, offsetY: 20 }
        };

        // Apply saved positions or fallback to default
        const paddingPx = gridPadding * gridSize;
        const widgetsDOM = container.querySelectorAll(".widget");
        widgetsDOM.forEach((w) => {
            const type = w.id.replace("widget-", "");
            const pos = getSettings().widgets?.[type]?.position || DEFAULT_POSITIONS[w.id];
            if (pos && pos.anchor) {
                w.dataset.anchor = pos.anchor;
                w.dataset.offsetX = pos.offsetX;
                w.dataset.offsetY = pos.offsetY;
                applyWidgetPositionStyles(w, pos, paddingPx);
            }
        });

        makeWidgetsDraggable(container);
        if (getSettings().widgets?.clock?.enabled !== false) startClockUpdates();
        if (getSettings().widgets?.weather?.enabled !== false) startWeatherUpdates();
    }
}

function cleanupWidget() {
    stopClockUpdates();
    stopWeatherUpdates();
    widgetSubscriptions.forEach((unsub) => unsub());
    widgetSubscriptions = [];
    unloadHTML("widgets_container");
}

export async function reloadWidgets() {
    cleanupWidget();
    await initWidget();
}

export async function initSettings() {
    syncWidgetToggle();
    syncIndividualWidgetToggles();
    syncWidgetEditMode();
}

/**
 * Handle checkbox toggle logic for widget enabling/disabling
 */
function syncWidgetToggle() {
    const widgetCheckbox = document.getElementById("widgets_enabled");
    if (!widgetCheckbox) return;

    let prevEnabled = null;

    subscribe("widgets", (widgets) => {
        const enabled = widgets?.enabled !== false;
        
        if (prevEnabled !== enabled) {
            if (prevEnabled !== null) {
                if (enabled) {
                    initWidget();
                } else {
                    cleanupWidget();
                }
            }
            prevEnabled = enabled;
        }

        widgetCheckbox.checked = enabled;

        const widgetSidebarElements = document.querySelectorAll(".widget_sidebar_element");
        widgetSidebarElements.forEach((el) => {
            el.style.display = enabled ? "" : "none";
        });

        if (enabled) {
            updateSidebarTabVisibility("time", widgets?.clock?.enabled !== false);
            updateSidebarTabVisibility("weather", widgets?.weather?.enabled !== false);
        }

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
        saveSettings({ widgets: { ...getSettings().widgets, enabled: e.target.checked } });
    };
}

function updateSidebarTabVisibility(tabId, isVisible) {
    const tab = document.querySelector(`.nav_item[data-tab="${tabId}"]`);
    if (tab) {
        const globalEnabled = getSettings().widgets?.enabled !== false;
        tab.style.display = globalEnabled && isVisible ? "" : "none";

        if (!isVisible && tab.classList.contains("active")) {
            const widgetsTab = document.querySelector('.nav_item[data-tab="widgets"]');
            if (widgetsTab) widgetsTab.dispatchEvent(new MouseEvent("mousedown"));
        }
    }
}

function syncIndividualWidgetToggles() {
    const clockToggle = document.getElementById("widget_clock_enabled");
    if (clockToggle) {
        subscribe("widgets", (widgets) => {
            const enabled = widgets?.clock?.enabled !== false;
            clockToggle.checked = enabled;
            updateSidebarTabVisibility("time", enabled);
        });
        clockToggle.onchange = async (e) => {
            saveSettings({ widgets: { ...getSettings().widgets, clock: { ...getSettings().widgets?.clock, enabled: e.target.checked } } });
            await reloadWidgets();
        };
    }

    const weatherToggle = document.getElementById("widget_weather_enabled");
    if (weatherToggle) {
        subscribe("widgets", (widgets) => {
            const enabled = widgets?.weather?.enabled !== false;
            weatherToggle.checked = enabled;
            updateSidebarTabVisibility("weather", enabled);
        });
        weatherToggle.onchange = async (e) => {
            saveSettings({ widgets: { ...getSettings().widgets, weather: { ...getSettings().widgets?.weather, enabled: e.target.checked } } });
            await reloadWidgets();
        };
    }
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

        let bestAnchorName = "top-left";
        let snappedOffsetX = 0;
        let snappedOffsetY = 0;

        const handleStart = (clientX, clientY) => {
            isDragging = true;
            widget.classList.add("dragging");

            // Calculate initial visual coordinates using getBoundingClientRect to avoid translation jump bugs
            const containerRect = container.getBoundingClientRect();
            const widgetRect = widget.getBoundingClientRect();
            initialLeft = widgetRect.left - containerRect.left;
            initialTop = widgetRect.top - containerRect.top;
            startX = clientX;
            startY = clientY;

            // Store old position details to verify dirty state later
            widget.dataset.oldAnchor = widget.dataset.anchor || "";
            widget.dataset.oldOffsetX = widget.dataset.offsetX || "0";
            widget.dataset.oldOffsetY = widget.dataset.offsetY || "0";

            // Temporarily use absolute left/top layout without translations during active drag
            widget.style.left = initialLeft + "px";
            widget.style.top = initialTop + "px";
            widget.style.right = "";
            widget.style.bottom = "";
            widget.style.translate = "";
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Get current widget dimensions
            const widgetWidth = widget.offsetWidth;
            const widgetHeight = widget.offsetHeight;

            // Calculate responsive boundary limits utilizing clamped effective padding
            const rawPaddingPx = gridPadding * gridSize;
            const maxPaddingX = Math.max(0, (containerWidth - widgetWidth) / 2);
            const maxPaddingY = Math.max(0, (containerHeight - widgetHeight) / 2);

            const paddingPxX = Math.min(rawPaddingPx, maxPaddingX);
            const paddingPxY = Math.min(rawPaddingPx, maxPaddingY);

            const contentWidth = containerWidth - 2 * paddingPxX;
            const contentHeight = containerHeight - 2 * paddingPxY;

            // Clamp coordinate within viewport boundaries (with padding offsets)
            const minX = paddingPxX;
            const maxX = Math.max(minX, containerWidth - widgetWidth - paddingPxX);
            const minY = paddingPxY;
            const maxY = Math.max(minY, containerHeight - widgetHeight - paddingPxY);

            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));

            // Coordinates relative to Content-Box
            const localLeft = newLeft - paddingPxX;
            const localTop = newTop - paddingPxY;

            // Find closest anchor out of the 9 anchor points based on Content-Box coordinates
            const localCenterX = localLeft + widgetWidth / 2;
            const localCenterY = localTop + widgetHeight / 2;

            const anchors = [
                { name: "top-left", x: 0, y: 0 },
                { name: "top-center", x: contentWidth / 2, y: 0 },
                { name: "top-right", x: contentWidth, y: 0 },
                { name: "center-left", x: 0, y: contentHeight / 2 },
                { name: "center", x: contentWidth / 2, y: contentHeight / 2 },
                { name: "center-right", x: contentWidth, y: contentHeight / 2 },
                { name: "bottom-left", x: 0, y: contentHeight },
                { name: "bottom-center", x: contentWidth / 2, y: contentHeight },
                { name: "bottom-right", x: contentWidth, y: contentHeight },
            ];

            let bestAnchor = anchors[0];
            let minDist = Infinity;

            anchors.forEach((a) => {
                const dist = Math.pow(localCenterX - a.x, 2) + Math.pow(localCenterY - a.y, 2);
                if (dist < minDist) {
                    minDist = dist;
                    bestAnchor = a;
                }
            });

            bestAnchorName = bestAnchor.name;

            // Calculate raw relative offsets inside the Content-Box
            let offsetX = 0;
            let offsetY = 0;

            switch (bestAnchorName) {
                case "top-left":
                    offsetX = localLeft;
                    offsetY = localTop;
                    break;
                case "top-center":
                    offsetX = localCenterX - contentWidth / 2;
                    offsetY = localTop;
                    break;
                case "top-right":
                    offsetX = contentWidth - (localLeft + widgetWidth);
                    offsetY = localTop;
                    break;
                case "center-left":
                    offsetX = localLeft;
                    offsetY = localCenterY - contentHeight / 2;
                    break;
                case "center":
                    offsetX = localCenterX - contentWidth / 2;
                    offsetY = localCenterY - contentHeight / 2;
                    break;
                case "center-right":
                    offsetX = contentWidth - (localLeft + widgetWidth);
                    offsetY = localCenterY - contentHeight / 2;
                    break;
                case "bottom-left":
                    offsetX = localLeft;
                    offsetY = contentHeight - (localTop + widgetHeight);
                    break;
                case "bottom-center":
                    offsetX = localCenterX - contentWidth / 2;
                    offsetY = contentHeight - (localTop + widgetHeight);
                    break;
                case "bottom-right":
                    offsetX = contentWidth - (localLeft + widgetWidth);
                    offsetY = contentHeight - (localTop + widgetHeight);
                    break;
            }

            // Snap relative offset
            snappedOffsetX = Math.round(offsetX / gridSize) * gridSize;
            snappedOffsetY = Math.round(offsetY / gridSize) * gridSize;

            // Compute absolute layout position for the direct widget snapping relative to Content-Box
            let localGuideLeft = 0;
            let localGuideTop = 0;

            switch (bestAnchorName) {
                case "top-left":
                    localGuideLeft = snappedOffsetX;
                    localGuideTop = snappedOffsetY;
                    break;
                case "top-center":
                    localGuideLeft = contentWidth / 2 + snappedOffsetX - widgetWidth / 2;
                    localGuideTop = snappedOffsetY;
                    break;
                case "top-right":
                    localGuideLeft = contentWidth - snappedOffsetX - widgetWidth;
                    localGuideTop = snappedOffsetY;
                    break;
                case "center-left":
                    localGuideLeft = snappedOffsetX;
                    localGuideTop = contentHeight / 2 + snappedOffsetY - widgetHeight / 2;
                    break;
                case "center":
                    localGuideLeft = contentWidth / 2 + snappedOffsetX - widgetWidth / 2;
                    localGuideTop = contentHeight / 2 + snappedOffsetY - widgetHeight / 2;
                    break;
                case "center-right":
                    localGuideLeft = contentWidth - snappedOffsetX - widgetWidth;
                    localGuideTop = contentHeight / 2 + snappedOffsetY - widgetHeight / 2;
                    break;
                case "bottom-left":
                    localGuideLeft = snappedOffsetX;
                    localGuideTop = contentHeight - snappedOffsetY - widgetHeight;
                    break;
                case "bottom-center":
                    localGuideLeft = contentWidth / 2 + snappedOffsetX - widgetWidth / 2;
                    localGuideTop = contentHeight - snappedOffsetY - widgetHeight;
                    break;
                case "bottom-right":
                    localGuideLeft = contentWidth - snappedOffsetX - widgetWidth;
                    localGuideTop = contentHeight - snappedOffsetY - widgetHeight;
                    break;
            }

            // Convert Content-Box layout position back to Border-Box position for styling
            const guideLeft = localGuideLeft + paddingPxX;
            const guideTop = localGuideTop + paddingPxY;

            // Snap the actual widget styling directly
            widget.style.left = guideLeft + "px";
            widget.style.top = guideTop + "px";

            // Highlight specific smart guides when widget edge/center aligns to borders
            // --- Border guides: snap when any widget edge/center exactly meets the border ---
            const isOnLeft = Math.abs(localGuideLeft) < 1;
            const isOnRight = Math.abs(localGuideLeft + widgetWidth - contentWidth) < 1;
            const isOnTop = Math.abs(localGuideTop) < 1;
            const isOnBottom = Math.abs(localGuideTop + widgetHeight - contentHeight) < 1;

            // --- Center guides: light up (blue) when any part of the widget is tangent ---
            // Tangent conditions for the vertical center axis (axis-center-x):
            //   • widget left edge touches it   (widget enters from right)
            //   • widget right edge touches it  (widget enters from left)
            //   • widget center aligns with it
            const centerX = contentWidth / 2;
            const isTangentCenterX =
                Math.abs(localGuideLeft - centerX) < 1 || // left edge
                Math.abs(localGuideLeft + widgetWidth - centerX) < 1 || // right edge
                Math.abs(localGuideLeft + widgetWidth / 2 - centerX) < 1; // center

            // Tangent conditions for the horizontal center axis (axis-center-y):
            //   • widget top edge touches it
            //   • widget bottom edge touches it
            //   • widget center aligns with it
            const centerY = contentHeight / 2;
            const isTangentCenterY =
                Math.abs(localGuideTop - centerY) < 1 || // top edge
                Math.abs(localGuideTop + widgetHeight - centerY) < 1 || // bottom edge
                Math.abs(localGuideTop + widgetHeight / 2 - centerY) < 1; // center

            const toggleHighlight = (selector, force) => {
                const el = container.querySelector(selector);
                if (el) el.classList.toggle("highlight", force);
            };
            const toggleCenterHighlight = (selector, force) => {
                const el = container.querySelector(selector);
                if (el) el.classList.toggle("center-highlight", force);
            };

            toggleHighlight(".smart-guide.axis-left", isOnLeft);
            toggleHighlight(".smart-guide.axis-right", isOnRight);
            toggleHighlight(".smart-guide.axis-top", isOnTop);
            toggleHighlight(".smart-guide.axis-bottom", isOnBottom);
            toggleCenterHighlight(".smart-guide.axis-center-x", isTangentCenterX);
            toggleCenterHighlight(".smart-guide.axis-center-y", isTangentCenterY);
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            widget.classList.remove("dragging");

            // Clear all smart guides highlights (both border and center variants)
            container.querySelectorAll(".smart-guide").forEach((g) => {
                g.classList.remove("highlight");
                g.classList.remove("center-highlight");
            });

            // Save new anchor configuration state
            widget.dataset.anchor = bestAnchorName;
            widget.dataset.offsetX = snappedOffsetX;
            widget.dataset.offsetY = snappedOffsetY;

            // Re-apply correct positioning styles (pass paddingPx so CSS offsets align with content-box).
            // Use the same clamping strategy as handleMove: clamp rawPaddingPx to the smaller of the
            // two axes so the single paddingPx value is safe for both X and Y.
            const rawPaddingPxEnd = gridPadding * gridSize;
            const containerWidthEnd = container.clientWidth;
            const containerHeightEnd = container.clientHeight;
            const widgetWidthEnd = widget.offsetWidth;
            const widgetHeightEnd = widget.offsetHeight;
            const maxPaddingXEnd = Math.max(0, (containerWidthEnd - widgetWidthEnd) / 2);
            const maxPaddingYEnd = Math.max(0, (containerHeightEnd - widgetHeightEnd) / 2);
            const paddingPxEnd = Math.min(rawPaddingPxEnd, maxPaddingXEnd, maxPaddingYEnd);
            applyWidgetPositionStyles(
                widget,
                {
                    anchor: bestAnchorName,
                    offsetX: snappedOffsetX,
                    offsetY: snappedOffsetY,
                },
                paddingPxEnd,
            );

            // Check if widget position actually changed
            const oldAnchor = widget.dataset.oldAnchor || "";
            const oldOffsetX = parseInt(widget.dataset.oldOffsetX || "0", 10);
            const oldOffsetY = parseInt(widget.dataset.oldOffsetY || "0", 10);

            if (bestAnchorName !== oldAnchor || snappedOffsetX !== oldOffsetX || snappedOffsetY !== oldOffsetY) {
                isWidgetDragDirty = true;
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

    subscribe("widgets", (widgets) => {
        const enabled = widgets?.enabled !== false;
        if (!enabled && isEditMode) exitMode();
        editBtn.disabled = enabled === false;
        editBtn.style.opacity = enabled !== false ? "1" : "0.5";
        editBtn.style.pointerEvents = enabled !== false ? "auto" : "none";
    });

    editBtn.onclick = () => {
        startEditMode();
    };
}

function startEditMode() {
    if (isEditMode) return;
    const container = document.getElementById("widgets_container");
    if (!container) return;

    // Save original positions
    const originalPositions = [];
    const widgets = container.querySelectorAll(".widget");
    widgets.forEach((w) => {
        originalPositions.push({
            element: w,
            left: w.style.left,
            top: w.style.top,
            right: w.style.right,
            bottom: w.style.bottom,
            translate: w.style.translate,
            transform: w.style.transform,
            anchor: w.dataset.anchor || "",
            offsetX: w.dataset.offsetX || "",
            offsetY: w.dataset.offsetY || "",
        });
    });

    isWidgetDragDirty = false;
    isEditMode = true;
    container.classList.add("edit-mode");

    // Create Smart Guides overlay
    const paddingPxVal = gridPadding * gridSize;
    const guidesContainer = document.createElement("div");
    guidesContainer.className = "smart-guides-container";
    guidesContainer.innerHTML = `
        <div class="smart-guide vertical axis-left" style="left: ${paddingPxVal}px;"></div>
        <div class="smart-guide vertical axis-right" style="right: ${paddingPxVal}px;"></div>
        <div class="smart-guide vertical axis-center-x"></div>
        <div class="smart-guide horizontal axis-top" style="top: ${paddingPxVal}px;"></div>
        <div class="smart-guide horizontal axis-bottom" style="bottom: ${paddingPxVal}px;"></div>
        <div class="smart-guide horizontal axis-center-y"></div>
    `;
    container.appendChild(guidesContainer);

    // Import functions dynamically
    Promise.all([import("/script/core/UI.js"), import("/script/core/i18n.js")]).then(([{ openCustomPopup, showNotification, createSlider }, { t }]) => {
        // Create popup content
        const contentNode = document.createElement("div");
        contentNode.className = "popup_body";
        contentNode.innerHTML = `
            <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">${t("alert.widget_edit_desc")}</p>
            <div id="edit_mode_slider_container"></div>
            <div class="actions">
                <button id="widget_cancel_btn" class="secondary">${t("alert.widget_edit_cancel")}</button>
                <button id="widget_save_btn" class="primary">${t("alert.widget_edit_save")}</button>
            </div>
        `;

        const originalPadding = getSettings().widgets?.grid_padding !== undefined ? getSettings().widgets.grid_padding : 0;
        let isSliderDirty = false;

        const slider = createSlider({
            label: t("setting_panel.widgets.grid_padding") || "Khoảng cách lề (Grid Padding)",
            min: 0,
            max: 10,
            step: 1,
            value: originalPadding,
            defaultValue: 0,
            unit: t("setting_panel.widgets.grid_unit") || "",
            onChange: (newVal) => {
                if (newVal !== originalPadding) isSliderDirty = true;
                gridPadding = newVal;
                const container = document.getElementById("widgets_container");
                if (container) {
                    container.style.setProperty("--grid-padding", newVal);
                    const newPaddingPx = newVal * gridSize;
                    const guidesContainer = container.querySelector(".smart-guides-container");
                    if (guidesContainer) {
                        guidesContainer.querySelector(".smart-guide.axis-left").style.left = newPaddingPx + "px";
                        guidesContainer.querySelector(".smart-guide.axis-right").style.right = newPaddingPx + "px";
                        guidesContainer.querySelector(".smart-guide.axis-top").style.top = newPaddingPx + "px";
                        guidesContainer.querySelector(".smart-guide.axis-bottom").style.bottom = newPaddingPx + "px";
                    }
                    container.querySelectorAll(".widget").forEach((w) => {
                        if (w.dataset.anchor) {
                            applyWidgetPositionStyles(
                                w,
                                {
                                    anchor: w.dataset.anchor,
                                    offsetX: parseInt(w.dataset.offsetX || "0", 10),
                                    offsetY: parseInt(w.dataset.offsetY || "0", 10),
                                },
                                newPaddingPx,
                            );
                        }
                    });
                }
            },
        });

        contentNode.querySelector("#edit_mode_slider_container").appendChild(slider);

        const popup = openCustomPopup(t("alert.widget_edit_title"), contentNode, "400px", {
            id: "widget_edit_popup",
            isAlert: false,
            canClose: false,
            hideSettingPanel: true,
        });

        let canExit = false;
        let exitTimer = null;

        contentNode.querySelector("#widget_cancel_btn").onmousedown = () => {
            if ((isWidgetDragDirty || isSliderDirty) && !canExit) {
                showNotification(t("alert.unsaved_changes"), "warning");
                canExit = true;
                if (exitTimer) clearTimeout(exitTimer);
                exitTimer = setTimeout(() => {
                    canExit = false;
                }, 5000);
            } else {
                // Restore padding
                gridPadding = originalPadding;
                const container = document.getElementById("widgets_container");
                if (container) container.style.setProperty("--grid-padding", originalPadding);

                // Restore original positions using applyWidgetPositionStyles to ensure
                // padding is re-applied correctly (raw style strings could be stale).
                const restorePaddingPx = gridPadding * gridSize;
                originalPositions.forEach((pos) => {
                    if (pos.anchor) {
                        pos.element.dataset.anchor = pos.anchor;
                        pos.element.dataset.offsetX = pos.offsetX;
                        pos.element.dataset.offsetY = pos.offsetY;
                        applyWidgetPositionStyles(
                            pos.element,
                            {
                                anchor: pos.anchor,
                                offsetX: parseInt(pos.offsetX, 10),
                                offsetY: parseInt(pos.offsetY, 10),
                            },
                            restorePaddingPx,
                        );
                    } else {
                        // Widget had no saved anchor; restore raw styles as fallback
                        pos.element.style.left = pos.left;
                        pos.element.style.top = pos.top;
                        pos.element.style.right = pos.right;
                        pos.element.style.bottom = pos.bottom;
                        pos.element.style.translate = pos.translate;
                        pos.element.style.transform = pos.transform;
                        delete pos.element.dataset.anchor;
                        delete pos.element.dataset.offsetX;
                        delete pos.element.dataset.offsetY;
                    }
                });

                exitMode();
            }
        };

        contentNode.querySelector("#widget_save_btn").onmousedown = () => {
            const finalPositions = {};
            const widgetsDOM = container.querySelectorAll(".widget");
            
            const newWidgets = { ...getSettings().widgets };
            
            widgetsDOM.forEach((w) => {
                if (w.dataset.anchor) {
                    const type = w.id.replace("widget-", "");
                    newWidgets[type] = {
                        ...newWidgets[type],
                        position: {
                            anchor: w.dataset.anchor,
                            offsetX: parseInt(w.dataset.offsetX, 10),
                            offsetY: parseInt(w.dataset.offsetY, 10),
                        }
                    };
                }
            });
            
            newWidgets.grid_padding = gridPadding;
            
            saveSettings({ widgets: newWidgets });
            showNotification(t("alert.saved_changes"), "success");

            exitMode();
        };

        function exitMode() {
            isEditMode = false;
            container.classList.remove("edit-mode");

            const gc = container.querySelector(".smart-guides-container");
            if (gc) gc.remove();

            popup.closePopup();
        }
    });
}
