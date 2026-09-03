import { showNotification } from "/src/core/ui.js";
import { t } from "/src/core/i18n.js";
import { renderIcons } from "/src/core/icon.js";
import { getSettings, saveSettings, subscribe } from "/src/core/storageHandler.js";
import { applyWidgetPositionStyles } from "./handler.js";

let isEditMode = false;
let isWidgetDragDirty = false;
let anchorMenuEl = null;
let targetWidgetForAnchor = null;
let anchorIndicators = [];

function createAnchorIndicators(container) {
    const els = [];
    ["center-x", "center-y"].forEach(axis => {
        const el = document.createElement("div");
        el.className = `canvas-indicator canvas-guide guide-${axis}`;
        el.dataset.axis = axis;
        container.appendChild(el);
        els.push(el);
    });
    return els;
}

function removeAnchorIndicators() {
    anchorIndicators.forEach(el => el.remove());
    anchorIndicators = [];
}

export function makeWidgetsDraggable(container) {
    const widgets = container.querySelectorAll(".widget");

    widgets.forEach((w) => {
        let isDragging = false;
        let startMouseX = 0;
        let startMouseY = 0;

        // Context menu to open anchor selector
        w.addEventListener("contextmenu", (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            targetWidgetForAnchor = w;
            showAnchorMenu(e.clientX, e.clientY, container);
        });

        const handleStart = (clientX, clientY, e) => {
            if (!isEditMode) return;
            if (e && e.target.closest("button, input, select, a")) return;
            
            isDragging = true;
            startMouseX = clientX;
            startMouseY = clientY;
            
            w.classList.add("selected", "dragging");
            
            // Store initial values
            w.dataset.initialX = w.dataset.x || "0";
            w.dataset.initialY = w.dataset.y || "0";
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;

            const dx = clientX - startMouseX;
            const dy = clientY - startMouseY;

            const initialX = parseFloat(w.dataset.initialX);
            const initialY = parseFloat(w.dataset.initialY);

            const ax = parseFloat(w.dataset.ax || "50");
            const ay = parseFloat(w.dataset.ay || "50");

            // Snap to 5px grid
            let newX = Math.round((initialX + dx) / 5) * 5;
            let newY = Math.round((initialY + dy) / 5) * 5;

            // Clamping to container bounds
            const wWidth = w.offsetWidth;
            const wHeight = w.offsetHeight;
            const cWidth = container.clientWidth;
            const cHeight = container.clientHeight;

            const anchorPxX = cWidth * ax / 100;
            const shiftX = wWidth * ax / 100;
            const minXSnap = Math.ceil((shiftX - anchorPxX) / 5) * 5;
            const maxXSnap = Math.floor((cWidth - wWidth + shiftX - anchorPxX) / 5) * 5;
            newX = Math.max(minXSnap, Math.min(newX, maxXSnap));

            const anchorPxY = cHeight * ay / 100;
            const shiftY = wHeight * ay / 100;
            const minYSnap = Math.ceil((shiftY - anchorPxY) / 5) * 5;
            const maxYSnap = Math.floor((cHeight - wHeight + shiftY - anchorPxY) / 5) * 5;
            newY = Math.max(minYSnap, Math.min(newY, maxYSnap));

            w.dataset.x = newX;
            w.dataset.y = newY;

            w.style.transform = `translate(calc(-${ax}% + ${newX}px), calc(-${ay}% + ${newY}px))`;
            isWidgetDragDirty = true;

            // Highlight guidelines
            requestAnimationFrame(() => {
                const rect = w.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                const widgetCenterX = rect.left + rect.width / 2;
                const widgetCenterY = rect.top + rect.height / 2;
                
                const canvasCenterX = containerRect.left + containerRect.width / 2;
                const canvasCenterY = containerRect.top + containerRect.height / 2;
                
                anchorIndicators.forEach(el => {
                    const axis = el.dataset.axis;
                    if (axis === "center-x") {
                        el.classList.toggle("active", Math.abs(widgetCenterX - canvasCenterX) <= 3);
                    } else if (axis === "center-y") {
                        el.classList.toggle("active", Math.abs(widgetCenterY - canvasCenterY) <= 3);
                    }
                });
            });
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            w.classList.remove("selected", "dragging");
            anchorIndicators.forEach(el => el.classList.remove("active"));
        };

        w.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return; // Only left click
            handleStart(e.clientX, e.clientY, e);

            const onMouseMove = (moveEvent) => handleMove(moveEvent.clientX, moveEvent.clientY);
            const onMouseUp = () => {
                handleEnd();
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        w.addEventListener("touchstart", (e) => {
            if (!isEditMode) return;
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY, e);

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

function showAnchorMenu(x, y, container) {
    if (!anchorMenuEl) {
        anchorMenuEl = document.createElement("div");
        anchorMenuEl.className = "anchor-menu grid-anchor-menu";
        
        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            if (anchorMenuEl && !e.target.closest('.anchor-menu')) {
                anchorMenuEl.classList.remove('visible');
                targetWidgetForAnchor = null;
            }
        });
        
        const anchorsList = [
            { ax: 0, ay: 0, title: "Top Left" }, { ax: 50, ay: 0, title: "Top Center" }, { ax: 100, ay: 0, title: "Top Right" },
            { ax: 0, ay: 50, title: "Center Left" }, { ax: 50, ay: 50, title: "Center" }, { ax: 100, ay: 50, title: "Center Right" },
            { ax: 0, ay: 100, title: "Bottom Left" }, { ax: 50, ay: 100, title: "Bottom Center" }, { ax: 100, ay: 100, title: "Bottom Right" }
        ];
        
        const gridEl = document.createElement("div");
        gridEl.className = "anchor-grid";
        
        anchorsList.forEach(item => {
            const btn = document.createElement("button");
            btn.className = "anchor-cell";
            btn.title = item.title;
            btn.dataset.ax = item.ax;
            btn.dataset.ay = item.ay;
            
            btn.onclick = (e) => {
                e.stopPropagation();
                if (targetWidgetForAnchor) {
                    const ax = e.target.dataset.ax;
                    const ay = e.target.dataset.ay;
                    
                    targetWidgetForAnchor.dataset.ax = ax;
                    targetWidgetForAnchor.dataset.ay = ay;
                    
                    // Reset offset to teleport to anchor
                    targetWidgetForAnchor.dataset.x = 0;
                    targetWidgetForAnchor.dataset.y = 0;
                    
                    applyWidgetPositionStyles(targetWidgetForAnchor, {
                        ax: parseInt(ax), ay: parseInt(ay), x: 0, y: 0
                    });
                    
                    isWidgetDragDirty = true;
                    anchorMenuEl.classList.remove('visible');
                    targetWidgetForAnchor = null;
                }
            };
            gridEl.appendChild(btn);
        });
        
        anchorMenuEl.appendChild(gridEl);
        container.appendChild(anchorMenuEl);
    }
    
    // Position menu
    const rect = container.getBoundingClientRect();
    let menuLeft = x - rect.left;
    let menuTop = y - rect.top;
    
    anchorMenuEl.style.left = menuLeft + "px";
    anchorMenuEl.style.top = menuTop + "px";
    
    // Highlight current anchor
    if (targetWidgetForAnchor) {
        const currentAx = targetWidgetForAnchor.dataset.ax || "0";
        const currentAy = targetWidgetForAnchor.dataset.ay || "0";
        anchorMenuEl.querySelectorAll(".anchor-cell").forEach(cell => {
            cell.classList.toggle("active", cell.dataset.ax === currentAx && cell.dataset.ay === currentAy);
        });
    }
    
    anchorMenuEl.classList.add("visible");
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

let floatingBar = null;
let canExit = false;
let exitTimer = null;
let originalPositions = [];

function startEditMode() {
    if (isEditMode) return;
    const container = document.getElementById("widgets_container");
    if (!container) return;

    originalPositions = [];
    const widgets = container.querySelectorAll(".widget");

    widgets.forEach((w) => {
        originalPositions.push({
            element: w,
            ax: w.dataset.ax,
            ay: w.dataset.ay,
            x: w.dataset.x,
            y: w.dataset.y
        });
    });

    isWidgetDragDirty = false;
    isEditMode = true;
    container.classList.add("edit-mode");
    anchorIndicators = createAnchorIndicators(container);

    // Hide settings panel during edit mode
    document.querySelector("#setting_wrapper")?.classList.add("preview_active");
    document.querySelector("#setting_toggle_btn")?.classList.add("preview_active");

    // Create lightweight floating action bar with only Cancel and Save buttons
    const bar = document.createElement("div");
    bar.className = "edit_floating_bar";
    bar.id = "widget_edit_bar";
    bar.innerHTML = `
        <button id="edit_cancel_btn">
            <i data-icon="close"></i>
            <span>${t("sp.widgets.edit_cancel", "Hủy")}</span>
        </button>
        <button id="edit_save_btn">
            <i data-icon="particleCheck"></i>
            <span>${t("sp.widgets.edit_save", "Lưu")}</span>
        </button>
    `;
    renderIcons(bar);

    bar.querySelector("#edit_cancel_btn")?.addEventListener("click", () => {
        if (isWidgetDragDirty && !canExit) {
            showNotification(t("common.unsaved_changes", "Thay đổi chưa được lưu. Nhấn lần nữa để hủy."), "warning");
            canExit = true;
            if (exitTimer) clearTimeout(exitTimer);
            exitTimer = setTimeout(() => { canExit = false; }, 4000);
            return;
        }

        // Revert positions
        originalPositions.forEach((pos) => {
            if (pos.ax !== undefined) {
                applyWidgetPositionStyles(pos.element, {
                    ax: parseInt(pos.ax),
                    ay: parseInt(pos.ay),
                    x: parseInt(pos.x),
                    y: parseInt(pos.y)
                });
            }
            pos.element.classList.remove("selected", "dragging");
        });

        exitMode();
    });

    bar.querySelector("#edit_save_btn")?.addEventListener("click", () => {
        const newWidgets = { ...getSettings().widgets };
        const widgetsDOM = container.querySelectorAll(".widget");

        widgetsDOM.forEach((w) => {
            if (w.dataset.ax !== undefined) {
                const type = w.id.replace("widget-", "");
                newWidgets[type] = {
                    ...newWidgets[type],
                    position: {
                        ax: parseInt(w.dataset.ax, 10),
                        ay: parseInt(w.dataset.ay, 10),
                        x: parseInt(w.dataset.x, 10),
                        y: parseInt(w.dataset.y, 10),
                    }
                };
            }
            w.classList.remove("selected", "dragging");
        });

        saveSettings({ widgets: newWidgets });
        showNotification(t("common.saved_changes", "Đã lưu thay đổi"), "success");
        exitMode();
    });

    document.body.appendChild(bar);
    floatingBar = bar;
}

function exitMode() {
    isEditMode = false;
    const container = document.getElementById("widgets_container");
    if (container) container.classList.remove("edit-mode");
    removeAnchorIndicators();
    if (anchorMenuEl) {
        anchorMenuEl.classList.remove("visible");
        targetWidgetForAnchor = null;
    }

    if (floatingBar) {
        floatingBar.classList.add("closing");
        const barToRemove = floatingBar;
        floatingBar = null;
        setTimeout(() => barToRemove.remove(), 260);
    }

    // Restore settings panel
    document.querySelector("#setting_wrapper")?.classList.remove("preview_active");
    document.querySelector("#setting_toggle_btn")?.classList.remove("preview_active");
}
