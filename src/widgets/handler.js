import { translateDOM } from "/src/core/i18n.js";
import { getSettings, saveSettings, subscribe } from "/src/core/storageHandler.js";
import { startClockUpdates, stopClockUpdates } from "/src/widgets/clock/clock.js";
import { startWeatherUpdates, stopWeatherUpdates } from "/src/widgets/weather/weather.js";
import { Icons } from "/src/core/icon.js";
import { makeWidgetsDraggable, syncWidgetEditMode } from "./editmode.js";

let gridSize = 10;
let widgetSubscriptions = [];
let resizeObserver = null;

/**
 * Canonical canvas metric calculator — single source of truth.
 * Canvas occupies the largest area that is a multiple of gridSize fitting in the container.
 * @param {number} containerW - container clientWidth
 * @param {number} containerH - container clientHeight
 */
export function getCanvasMetrics(containerW, containerH) {
    const step = gridSize; // Expand by 1 grid at a time
    const effectiveW = Math.floor(containerW / step) * step;
    const effectiveH = Math.floor(containerH / step) * step;
    // floor keeps offsetX/Y stable (never jumps mid-step when effectiveW hasn't changed)
    const offsetX = Math.floor(((containerW - effectiveW) / 2) / gridSize) * gridSize;
    const offsetY = Math.floor(((containerH - effectiveH) / 2) / gridSize) * gridSize;
    
    // Round center coordinates to the nearest grid step so anchors are mathematically perfect
    const centerX = Math.round((offsetX + effectiveW / 2) / gridSize) * gridSize;
    const centerY = Math.round((offsetY + effectiveH / 2) / gridSize) * gridSize;
    
    return { offsetX, offsetY, effectiveW, effectiveH, centerX, centerY };
}

export function updateCanvasOffsets() {
    const container = document.getElementById("widgets_container");
    if (!container) return;
    const { offsetX, offsetY, effectiveW, effectiveH, centerX, centerY } = getCanvasMetrics(container.clientWidth, container.clientHeight);
    container.style.setProperty("--canvas-offset-x",   `${offsetX}px`);
    container.style.setProperty("--canvas-offset-y",   `${offsetY}px`);
    container.style.setProperty("--canvas-effective-w", `${effectiveW}px`);
    container.style.setProperty("--canvas-effective-h", `${effectiveH}px`);
    container.style.setProperty("--canvas-center-x",   `${centerX}px`);
    container.style.setProperty("--canvas-center-y",   `${centerY}px`);
}

export function applyWidgetPositionStyles(widget, pos) {
    widget.style.left = "";
    widget.style.right = "";
    widget.style.top = "";
    widget.style.bottom = "";
    widget.style.translate = "";

    const { anchor, offsetX, offsetY } = pos;
    const ox = `${offsetX}px`;
    const oy = `${offsetY}px`;

    // All 9 anchors use ONLY left + top + translate.
    // Never right/bottom — those were asymmetric with floor-based offsetX.
    // left  = canvas left edge reference point X
    // top   = canvas top  edge reference point Y
    // translate shifts the widget so its visual anchor corner/edge lands on that point.
    switch (anchor) {
        case "top-left":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + ${oy})`;
            // translate: 0 0 (default — widget top-left corner is the reference)
            break;
        case "top-center":
            widget.style.left      = `calc(var(--canvas-center-x, 50%) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + ${oy})`;
            widget.style.translate = "-50% 0";   // widget horizontal-center at left
            break;
        case "top-right":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + var(--canvas-effective-w, 100%) - ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + ${oy})`;
            widget.style.translate = "-100% 0";  // widget right edge at left
            break;
        case "center-left":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-center-y, 50%) + ${oy})`;
            widget.style.translate = "0 -50%";   // widget vertical-center at top
            break;
        case "center":
            widget.style.left      = `calc(var(--canvas-center-x, 50%) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-center-y, 50%) + ${oy})`;
            widget.style.translate = "-50% -50%"; // widget center at (left, top)
            break;
        case "center-right":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + var(--canvas-effective-w, 100%) - ${ox})`;
            widget.style.top       = `calc(var(--canvas-center-y, 50%) + ${oy})`;
            widget.style.translate = "-100% -50%"; // widget right+vertical-center
            break;
        case "bottom-left":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + var(--canvas-effective-h, 100%) - ${oy})`;
            widget.style.translate = "0 -100%";  // widget bottom edge at top
            break;
        case "bottom-center":
            widget.style.left      = `calc(var(--canvas-center-x, 50%) + ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + var(--canvas-effective-h, 100%) - ${oy})`;
            widget.style.translate = "-50% -100%"; // widget bottom+horizontal-center
            break;
        case "bottom-right":
            widget.style.left      = `calc(var(--canvas-offset-x, 0px) + var(--canvas-effective-w, 100%) - ${ox})`;
            widget.style.top       = `calc(var(--canvas-offset-y, 0px) + var(--canvas-effective-h, 100%) - ${oy})`;
            widget.style.translate = "-100% -100%"; // widget bottom-right corner
            break;
        default:
            widget.style.left = `calc(var(--canvas-offset-x, 0px) + ${ox})`;
            widget.style.top  = `calc(var(--canvas-offset-y, 0px) + ${oy})`;
            break;
    }
}

import clockHtml from "./clock/clock.html?raw";
import weatherHtml from "./weather/weather.html?raw";
import "./style.css";
import "./clock/clock.css";
import "./weather/weather.css";

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

    // Load widget HTML files dynamically
    let loadedCount = 0;
    if (getSettings().widgets?.clock?.enabled !== false) {
        container.insertAdjacentHTML("beforeend", clockHtml);
        loadedCount++;
    }
    if (getSettings().widgets?.weather?.enabled !== false) {
        container.insertAdjacentHTML("beforeend", weatherHtml);
        loadedCount++;
    }

    const dummyHtml = `
<div class="widget clock-widget" id="widget-dummy1" style="position: absolute; width: max-content; height: auto; z-index: 10;">
    <div class="clock-digital-container" style="background: rgba(255,0,0,0.2); padding: 10px; border-radius: 10px;">
        <span class="clock-time" style="font-size: 2.5em; font-weight: 400; color: white;">Dummy 1</span>
    </div>
</div>
<div class="widget clock-widget" id="widget-dummy2" style="position: absolute; width: max-content; height: auto; z-index: 10;">
    <div class="clock-digital-container" style="background: rgba(0,255,0,0.2); padding: 10px; border-radius: 10px;">
        <span class="clock-time" style="font-size: 2.5em; font-weight: 400; color: white;">Dummy 2</span>
    </div>
</div>
<div class="widget clock-widget" id="widget-dummy3" style="position: absolute; width: max-content; height: auto; z-index: 10;">
    <div class="clock-digital-container" style="background: rgba(0,0,255,0.2); padding: 10px; border-radius: 10px;">
        <span class="clock-time" style="font-size: 2.5em; font-weight: 400; color: white;">Dummy 3</span>
    </div>
</div>`;
    container.insertAdjacentHTML("beforeend", dummyHtml);


    if (loadedCount > 0) {
        console.debug("Widget DOM loaded dynamically.");
        document.getElementById("widgets_container").style.opacity = "1";
    }

    const positionsStr = localStorage.getItem("neko_widget_positions");
    const userPositions = positionsStr ? JSON.parse(positionsStr) : {};

        const DEFAULT_POSITIONS = {
            "widget-clock": { anchor: "bottom-left", offsetX: 0, offsetY: 0 },
            "widget-weather": { anchor: "top-right", offsetX: 20, offsetY: 20 },
            "widget-dummy1": { anchor: "center", offsetX: -100, offsetY: 0 },
            "widget-dummy2": { anchor: "center", offsetX: 100, offsetY: 0 },
            "widget-dummy3": { anchor: "center", offsetX: 0, offsetY: -100 }
        };

        widgetSubscriptions.forEach((unsub) => unsub());
        widgetSubscriptions = [];

        gridSize = 10;
        container.style.setProperty("--grid-size", gridSize);

        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(updateCanvasOffsets);
        resizeObserver.observe(container);
        updateCanvasOffsets();

        // Apply saved positions or fallback to default
        const widgetsDOM = container.querySelectorAll(".widget");
        widgetsDOM.forEach((w) => {
            const type = w.id.replace("widget-", "");
            const pos = getSettings().widgets?.[type]?.position || DEFAULT_POSITIONS[w.id];
            if (pos && pos.anchor) {
                w.dataset.anchor = pos.anchor;
                w.dataset.offsetX = pos.offsetX;
                w.dataset.offsetY = pos.offsetY;
                applyWidgetPositionStyles(w, pos);
            }
            
            // Force widget dimensions to be exactly multiples of the grid size (5px)
            // We use MutationObserver to avoid infinite loops from ResizeObserver.
            const updateRoundedSize = () => {
                // Revert to natural size
                w.style.width = 'max-content';
                w.style.height = 'max-content';
                
                // Measure exactly
                const rect = w.getBoundingClientRect();
                const step = parseInt(getComputedStyle(w).getPropertyValue('--grid-size')) || 10;
                
                // CRITICAL: We MUST round to an EVEN multiple of the grid step (step * 2).
                // If width is an odd multiple of 10 (e.g. 30), half width is 15.
                // When anchored to 'center', translate: -50% pushes the visual edge to a 5px boundary.
                // This causes a 5px jump on mousedown, and another 5px jump on mouseup!
                // By forcing width to be an even multiple (e.g. 40), half width is 20, keeping both center AND edges perfectly on the 10px grid.
                const doubleStep = step * 2;
                const roundedW = Math.ceil((rect.width - 0.01) / doubleStep) * doubleStep;
                const roundedH = Math.ceil((rect.height - 0.01) / doubleStep) * doubleStep;
                
                // Force rounded size
                w.style.width = `${roundedW}px`;
                w.style.height = `${roundedH}px`;
            };
            
            updateRoundedSize();
            
            // Listen for any inner DOM changes
            const mo = new MutationObserver(updateRoundedSize);
            mo.observe(w, { childList: true, characterData: true, subtree: true });
            
            // Also listen for font loading (since font affects text size)
            if (document.fonts) {
                document.fonts.ready.then(updateRoundedSize);
            }
        });

        makeWidgetsDraggable(container);
        if (getSettings().widgets?.clock?.enabled !== false) startClockUpdates();
        if (getSettings().widgets?.weather?.enabled !== false) startWeatherUpdates();
}

function cleanupWidget() {
    stopClockUpdates();
    stopWeatherUpdates();
    widgetSubscriptions.forEach((unsub) => unsub());
    widgetSubscriptions = [];
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    const container = document.getElementById("widgets_container");
    if (container) container.innerHTML = "";
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
