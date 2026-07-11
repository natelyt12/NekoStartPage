import { getSettings, saveSettings, subscribe } from "/src/core/storageHandler.js";
import { applyWidgetPositionStyles, getCanvasMetrics } from "./handler.js";

const gridSize = 10;
let isEditMode = false;
let isWidgetDragDirty = false;

// Active anchor indicator elements (populated while edit mode is open)
let anchorIndicators = [];
let anchorMenuEl = null;
let lerpAnimationId = null;
const lerpFactor = 0.25;

export function makeWidgetsDraggable(container) {
    // 1. Drag Selection Logic on Container
    container.addEventListener("mousedown", (e) => {
        if (!isEditMode) return;
        if (e.target !== container) return; // Only trigger if clicked on the empty container background
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const containerRect = container.getBoundingClientRect();

        const selectionBox = document.createElement("div");
        selectionBox.className = "widget-selection-box";
        container.appendChild(selectionBox);

        if (!e.shiftKey) {
            container.querySelectorAll(".widget.selected").forEach(w => {
                w.classList.remove("selected");
                if (w._ghostBox) w._ghostBox.classList.remove("selected");
            });
        }

        const onMouseMove = (moveEvent) => {
            const currentX = moveEvent.clientX;
            const currentY = moveEvent.clientY;

            const left = Math.min(startX, currentX) - containerRect.left;
            const top = Math.min(startY, currentY) - containerRect.top;
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            selectionBox.style.left = left + "px";
            selectionBox.style.top = top + "px";
            selectionBox.style.width = width + "px";
            selectionBox.style.height = height + "px";

            const boxRect = selectionBox.getBoundingClientRect();
            container.querySelectorAll(".widget").forEach(w => {
                const wRect = w.getBoundingClientRect();
                const isOverlapping = !(
                    boxRect.right < wRect.left || 
                    boxRect.left > wRect.right || 
                    boxRect.bottom < wRect.top || 
                    boxRect.top > wRect.bottom
                );
                
                if (isOverlapping) {
                    w.classList.add("selected");
                    if (w._ghostBox) w._ghostBox.classList.add("selected");
                } else if (!e.shiftKey) {
                    w.classList.remove("selected");
                    if (w._ghostBox) w._ghostBox.classList.remove("selected");
                }
            });
        };

        const onMouseUp = () => {
            selectionBox.classList.add("fade-out");
            setTimeout(() => selectionBox.remove(), 200);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    // 2. Drag & Drop Logic for Widgets
    const widgets = container.querySelectorAll(".widget");

    widgets.forEach((widget) => {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        
        let bboxInitialLeft = 0;
        let bboxInitialTop = 0;
        let bboxWidth = 0;
        let bboxHeight = 0;

        let bestAnchorName = "top-left";
        let snappedOffsetX = 0;
        let snappedOffsetY = 0;
        
        let widgetData = [];

        const handleStart = (clientX, clientY, e) => {
            if (e && (e.ctrlKey || e.metaKey)) {
                const isSel = widget.classList.toggle("selected");
                if (widget._ghostBox) widget._ghostBox.classList.toggle("selected", isSel);
                if (!widget.classList.contains("selected")) {
                    return; // Do not start dragging if we just deselected it
                }
            } else if (!widget.classList.contains("selected")) {
                if (!e || !e.shiftKey) {
                    container.querySelectorAll(".widget.selected").forEach(w => {
                        w.classList.remove("selected");
                        if (w._ghostBox) w._ghostBox.classList.remove("selected");
                    });
                }
                widget.classList.add("selected");
                if (widget._ghostBox) widget._ghostBox.classList.add("selected");
            }

            isDragging = true;

            const selectedWidgets = Array.from(container.querySelectorAll(".widget.selected"));
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const containerRect = container.getBoundingClientRect();

            widgetData = selectedWidgets.map(w => {
                const rect = w.getBoundingClientRect();
                const left = Math.round((rect.left - containerRect.left) / gridSize) * gridSize;
                const top = Math.round((rect.top - containerRect.top) / gridSize) * gridSize;
                const width = parseFloat(w.style.width) || w.offsetWidth;
                const height = parseFloat(w.style.height) || w.offsetHeight;
                
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, left + width);
                maxY = Math.max(maxY, top + height);

                w.style.left = left + "px";
                w.style.top = top + "px";
                w.style.right = "";
                w.style.bottom = "";
                w.style.translate = "";
                if (w._dragEndTimeout) {
                    clearTimeout(w._dragEndTimeout);
                    w._dragEndTimeout = null;
                }
                w.classList.add("dragging");
                
                w.dataset.oldAnchor = w.dataset.anchor || "";
                w.dataset.oldOffsetX = w.dataset.offsetX || "0";
                w.dataset.oldOffsetY = w.dataset.offsetY || "0";

                const ghostEl = w._ghostBox;
                if (ghostEl) {
                    ghostEl.style.left = left + "px";
                    ghostEl.style.top = top + "px";
                    ghostEl.style.right = "";
                    ghostEl.style.bottom = "";
                    ghostEl.style.translate = "";
                    ghostEl.style.transform = "";
                }

                return { el: w, ghostEl, initialLeft: left, initialTop: top, width, height };
            });

            bboxInitialLeft = minX;
            bboxInitialTop = minY;
            bboxWidth = maxX - minX;
            bboxHeight = maxY - minY;

            startX = clientX;
            startY = clientY;
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            let newLeft = bboxInitialLeft + deltaX;
            let newTop = bboxInitialTop + deltaY;

            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const { offsetX: canvasOffsetX, offsetY: canvasOffsetY, effectiveW: contentWidth, effectiveH: contentHeight, centerX: absoluteCenterX, centerY: absoluteCenterY } = getCanvasMetrics(containerWidth, containerHeight);

            const minX = canvasOffsetX;
            const maxX = Math.max(minX, canvasOffsetX + contentWidth - bboxWidth);
            const minY = canvasOffsetY;
            const maxY = Math.max(minY, canvasOffsetY + contentHeight - bboxHeight);

            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));

            const clampedDeltaX = newLeft - bboxInitialLeft;
            const clampedDeltaY = newTop - bboxInitialTop;

            let snappedDeltaX = Math.round(clampedDeltaX / gridSize) * gridSize;
            let snappedDeltaY = Math.round(clampedDeltaY / gridSize) * gridSize;

            const finalLeft = bboxInitialLeft + snappedDeltaX;
            const finalTop = bboxInitialTop + snappedDeltaY;
            const finalRight = finalLeft + bboxWidth;
            const finalBottom = finalTop + bboxHeight;
            const finalCenterX = finalLeft + bboxWidth / 2;
            const finalCenterY = finalTop + bboxHeight / 2;
            
            const canvasCenterX = absoluteCenterX;
            const canvasCenterY = absoluteCenterY;
            
            // Only light up if perfectly aligned (tol = 1 for float safety)
            const tol = 1;
            
            anchorIndicators.forEach(el => {
                const axis = el.dataset.axis;
                let isActive = false;
                switch (axis) {
                    case "left": isActive = Math.abs(finalLeft - canvasOffsetX) <= tol; break;
                    case "right": isActive = Math.abs(finalRight - (canvasOffsetX + contentWidth)) <= tol; break;
                    case "center-x": isActive = Math.abs(finalCenterX - canvasCenterX) <= tol; break;
                    case "top": isActive = Math.abs(finalTop - canvasOffsetY) <= tol; break;
                    case "bottom": isActive = Math.abs(finalBottom - (canvasOffsetY + contentHeight)) <= tol; break;
                    case "center-y": isActive = Math.abs(finalCenterY - canvasCenterY) <= tol; break;
                }
                el.classList.toggle("active", isActive);
            });

            widgetData.forEach(data => {
                // Free drag for actual widget
                data.el.style.left = (data.initialLeft + clampedDeltaX) + "px";
                data.el.style.top = (data.initialTop + clampedDeltaY) + "px";
                
                // Snapped drag for ghost (Update target for lerp)
                if (data.ghostEl) {
                    data.ghostEl._targetLeft = data.initialLeft + snappedDeltaX;
                    data.ghostEl._targetTop = data.initialTop + snappedDeltaY;
                }
            });
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            anchorIndicators.forEach(el => el.classList.remove("active"));
            
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            widgetData.forEach(data => {
                // Snap the actual widget to the ghost's final position
                const currentLeft = data.ghostEl && data.ghostEl._targetLeft !== undefined ? data.ghostEl._targetLeft : parseFloat(data.ghostEl.style.left);
                const currentTop = data.ghostEl && data.ghostEl._targetTop !== undefined ? data.ghostEl._targetTop : parseFloat(data.ghostEl.style.top);
                
                // Keep the current anchor
                const currentAnchor = data.el.dataset.anchor || "top-left";
                const indvAnchorData = calculateOffsetForAnchor(currentAnchor, currentLeft, currentTop, data.width, data.height, containerWidth, containerHeight);
                
                data.el.dataset.anchor = indvAnchorData.anchor;
                data.el.dataset.offsetX = indvAnchorData.offsetX;
                data.el.dataset.offsetY = indvAnchorData.offsetY;

                // FIRST: Record position before applying final anchored styles
                const firstRect = data.el.getBoundingClientRect();

                applyWidgetPositionStyles(data.el, indvAnchorData);

                // LAST: Measure new position
                const lastRect = data.el.getBoundingClientRect();

                // INVERT
                const deltaX = firstRect.left - lastRect.left;
                const deltaY = firstRect.top - lastRect.top;

                data.el.style.transition = 'none';
                data.el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

                // PLAY
                requestAnimationFrame(() => {
                    // Force reflow
                    data.el.getBoundingClientRect();
                    
                    // Animate to 0
                    data.el.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    data.el.style.transform = '';
                    
                    // Cleanup
                    data.el._dragEndTimeout = setTimeout(() => {
                        data.el.style.transition = '';
                        data.el.classList.remove("dragging");
                        data.el._dragEndTimeout = null;
                    }, 400);
                });
                if (indvAnchorData.anchor !== data.el.dataset.oldAnchor || 
                    indvAnchorData.offsetX !== parseInt(data.el.dataset.oldOffsetX || "0") || 
                    indvAnchorData.offsetY !== parseInt(data.el.dataset.oldOffsetY || "0")) {
                    isWidgetDragDirty = true;
                }
            });
            
            widgetData = [];
        };

        const handleHandle = widget;
        handleHandle.addEventListener("mousedown", (e) => {
            if (!isEditMode) return;
            if (e.target.closest("button, input, select, a")) return;
            e.preventDefault();
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

        handleHandle.addEventListener("touchstart", (e) => {
            if (!isEditMode) return;
            if (e.target.closest("button, input, select, a")) return;
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY, { shiftKey: false });

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

function calculateOffsetForAnchor(forcedAnchorName, left, top, widgetWidth, widgetHeight, containerWidth, containerHeight) {
    const { offsetX: canvasOffsetX, offsetY: canvasOffsetY, effectiveW: contentWidth, effectiveH: contentHeight, centerX: absoluteCenterX, centerY: absoluteCenterY } = getCanvasMetrics(containerWidth, containerHeight);

    const localCenterXAnchor = absoluteCenterX - canvasOffsetX;
    const localCenterYAnchor = absoluteCenterY - canvasOffsetY;

    const localLeft = left - canvasOffsetX;
    const localTop = top - canvasOffsetY;

    const localCenterX = localLeft + widgetWidth / 2;
    const localCenterY = localTop + widgetHeight / 2;

    let offsetX = 0;
    let offsetY = 0;

    switch (forcedAnchorName) {
        case "top-left": offsetX = localLeft; offsetY = localTop; break;
        case "top-center": offsetX = localCenterX - localCenterXAnchor; offsetY = localTop; break;
        case "top-right": offsetX = contentWidth - (localLeft + widgetWidth); offsetY = localTop; break;
        case "center-left": offsetX = localLeft; offsetY = localCenterY - localCenterYAnchor; break;
        case "center": offsetX = localCenterX - localCenterXAnchor; offsetY = localCenterY - localCenterYAnchor; break;
        case "center-right": offsetX = contentWidth - (localLeft + widgetWidth); offsetY = localCenterY - localCenterYAnchor; break;
        case "bottom-left": offsetX = localLeft; offsetY = contentHeight - (localTop + widgetHeight); break;
        case "bottom-center": offsetX = localCenterX - localCenterXAnchor; offsetY = contentHeight - (localTop + widgetHeight); break;
        case "bottom-right": offsetX = contentWidth - (localLeft + widgetWidth); offsetY = contentHeight - (localTop + widgetHeight); break;
    }

    const snappedOffsetX = Math.round(offsetX / gridSize) * gridSize;
    const snappedOffsetY = Math.round(offsetY / gridSize) * gridSize;

    return { anchor: forcedAnchorName, offsetX: snappedOffsetX, offsetY: snappedOffsetY };
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

    // Create anchor menu
    anchorMenuEl = document.createElement("div");
    anchorMenuEl.className = "anchor-menu";
    const gridEl = document.createElement("div");
    gridEl.className = "anchor-grid";
    const anchorsList = [
        "top-left", "top-center", "top-right",
        "center-left", "center", "center-right",
        "bottom-left", "bottom-center", "bottom-right"
    ];
    anchorsList.forEach(name => {
        const cell = document.createElement("button");
        cell.className = "anchor-cell";
        cell.dataset.name = name;
        cell.onmousedown = (e) => { // Use mousedown to prevent drag interference
            e.preventDefault();
            e.stopPropagation();
            handleAnchorMenuClick(name, container);
        };
        gridEl.appendChild(cell);
    });
    anchorMenuEl.appendChild(gridEl);
    container.appendChild(anchorMenuEl);

    // Create persistent ghost boxes for all widgets
    widgets.forEach((w) => {
        const ghostEl = document.createElement("div");
        ghostEl.className = "widget-ghost";
        const width = parseFloat(w.style.width) || w.offsetWidth;
        const height = parseFloat(w.style.height) || w.offsetHeight;
        
        ghostEl.style.width = width + "px";
        ghostEl.style.height = height + "px";
        
        const containerRect = container.getBoundingClientRect();
        const rect = w.getBoundingClientRect();
        const startLeft = rect.left - containerRect.left;
        const startTop = rect.top - containerRect.top;
        
        ghostEl._currentLeft = startLeft;
        ghostEl._currentTop = startTop;
        ghostEl._targetLeft = startLeft;
        ghostEl._targetTop = startTop;
        
        ghostEl.style.left = startLeft + "px";
        ghostEl.style.top = startTop + "px";
        
        container.appendChild(ghostEl);
        w._ghostBox = ghostEl;

        w._onMouseEnter = () => ghostEl.classList.add("hover");
        w._onMouseLeave = () => ghostEl.classList.remove("hover");
        w.addEventListener("mouseenter", w._onMouseEnter);
        w.addEventListener("mouseleave", w._onMouseLeave);
    });

    // Start lerp animation loop
    if (lerpAnimationId) cancelAnimationFrame(lerpAnimationId);
    const loop = () => {
        if (!isEditMode) return;
        
        // Phase 1: READ (Tránh Layout Thrashing)
        const containerRect = container.getBoundingClientRect();
        const ghostsToUpdate = [];
        
        widgets.forEach((w) => {
            const ghost = w._ghostBox;
            if (!ghost) return;
            
            // Nếu không bị kéo thì ghost box luôn tự bám theo widget thật
            if (!w.classList.contains("dragging")) {
                const rect = w.getBoundingClientRect();
                // Bỏ qua nếu bị minimize (width/height = 0)
                if (rect.width > 0 && rect.height > 0) {
                    ghost._targetLeft = rect.left - containerRect.left;
                    ghost._targetTop = rect.top - containerRect.top;
                }
            }
            ghostsToUpdate.push(ghost);
        });

        // Phase 2: WRITE
        ghostsToUpdate.forEach((ghost) => {
            if (ghost._targetLeft === undefined) return;
            
            ghost._currentLeft += (ghost._targetLeft - ghost._currentLeft) * lerpFactor;
            ghost._currentTop += (ghost._targetTop - ghost._currentTop) * lerpFactor;
            
            if (Math.abs(ghost._targetLeft - ghost._currentLeft) < 0.5) ghost._currentLeft = ghost._targetLeft;
            if (Math.abs(ghost._targetTop - ghost._currentTop) < 0.5) ghost._currentTop = ghost._targetTop;
            
            ghost.style.left = ghost._currentLeft + "px";
            ghost.style.top = ghost._currentTop + "px";
        });
        
        // Update anchor menu position
        const selected = Array.from(container.querySelectorAll(".widget.selected"));
        if (selected.length > 0 && anchorMenuEl) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            selected.forEach(w => {
                const ghost = w._ghostBox;
                if (ghost && ghost._currentLeft !== undefined) {
                    minX = Math.min(minX, ghost._currentLeft);
                    minY = Math.min(minY, ghost._currentTop);
                    maxX = Math.max(maxX, ghost._currentLeft + parseFloat(ghost.style.width));
                    maxY = Math.max(maxY, ghost._currentTop + parseFloat(ghost.style.height));
                }
            });
            if (minX !== Infinity) {
                const menuWidth = 68; // ~ (16*3 + 4*2 + 6*2)
                const menuHeight = 68;
                const isRightHalf = maxX > (containerRect.width / 2);
                const isBottomHalf = maxY > (containerRect.height / 2);
                
                let menuLeft = isRightHalf ? minX - menuWidth - 10 : maxX + 10;
                let menuTop = isBottomHalf ? maxY - menuHeight : minY;
                
                anchorMenuEl.style.left = menuLeft + "px";
                anchorMenuEl.style.top = menuTop + "px";
                if (!anchorMenuEl.classList.contains("visible")) {
                    anchorMenuEl.classList.add("visible");
                }
                
                let sharedAnchor = selected[0].dataset.anchor || "top-left";
                for (let i = 1; i < selected.length; i++) {
                    if ((selected[i].dataset.anchor || "top-left") !== sharedAnchor) {
                        sharedAnchor = null;
                        break;
                    }
                }
                anchorMenuEl.querySelectorAll(".anchor-cell").forEach(cell => {
                    cell.classList.toggle("active", cell.dataset.name === sharedAnchor);
                });
            }
        } else if (anchorMenuEl) {
            anchorMenuEl.classList.remove("visible");
        }
        
        lerpAnimationId = requestAnimationFrame(loop);
    };
    lerpAnimationId = requestAnimationFrame(loop);

    // Create anchor indicator elements
    anchorIndicators = createAnchorIndicators(container);

    Promise.all([import("/src/core/ui.js"), import("/src/core/i18n.js")]).then(([{ openCustomPopup, showNotification, createConfirmDialog }, { t }]) => {
        const msg = t("sp.widgets.edit_desc");
        let activePopup = null;

        const onCancel = () => {
            if (isWidgetDragDirty && !canExit) {
                showNotification(t("common.unsaved_changes"), "warning");
                canExit = true;
                if (exitTimer) clearTimeout(exitTimer);
                exitTimer = setTimeout(() => { canExit = false; }, 5000);
            } else {
                // Restore original positions
                originalPositions.forEach((pos) => {
                    if (pos.anchor) {
                        pos.element.dataset.anchor = pos.anchor;
                        pos.element.dataset.offsetX = pos.offsetX;
                        pos.element.dataset.offsetY = pos.offsetY;
                        applyWidgetPositionStyles(pos.element, {
                            anchor: pos.anchor,
                            offsetX: parseInt(pos.offsetX, 10),
                            offsetY: parseInt(pos.offsetY, 10),
                        });
                    } else {
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
                    pos.element.classList.remove("selected");
                    if (pos.element._ghostBox) pos.element._ghostBox.classList.remove("selected");
                });
                if (activePopup) activePopup.closePopup();
                exitMode();
            }
        };

        const { container: contentNode, setCloseHandler } = createConfirmDialog(msg, () => {
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
                w.classList.remove("selected");
                if (w._ghostBox) w._ghostBox.classList.remove("selected");
            });
            
            saveSettings({ widgets: newWidgets });
            showNotification(t("common.saved_changes"), "success");
            if (activePopup) activePopup.closePopup();
            exitMode();
        }, { 
            okText: t("sp.widgets.edit_save"), 
            cancelText: t("sp.widgets.edit_cancel"), 
            okClass: "primary", 
            cancelClass: "secondary",
            onCancel: onCancel
        });

        const popup = openCustomPopup(t("sp.widgets.edit_title"), contentNode, "400px", {
            id: "widget_edit_popup",
            isAlert: false,
            canClose: true,
            hideWidgetGrid: false,
            hideSettingPanel: true,
            canDrag: true
        });

        activePopup = popup;
        setCloseHandler(() => { if (activePopup) activePopup.closePopup(); });
        if (popup && popup.closeBtn) popup.closeBtn.addEventListener("popupBeforeClose", onCancel);

        function exitMode() {
            isEditMode = false;
            container.classList.remove("edit-mode");
            removeAnchorIndicators();
            
            if (lerpAnimationId) {
                cancelAnimationFrame(lerpAnimationId);
                lerpAnimationId = null;
            }
            
            // Clean up all ghost boxes and listeners
            container.querySelectorAll(".widget").forEach(w => {
                if (w._ghostBox) {
                    w._ghostBox.remove();
                    w._ghostBox = null;
                }
                if (w._onMouseEnter) {
                    w.removeEventListener("mouseenter", w._onMouseEnter);
                    w.removeEventListener("mouseleave", w._onMouseLeave);
                    w._onMouseEnter = null;
                    w._onMouseLeave = null;
                }
            });
            
            if (anchorMenuEl) {
                anchorMenuEl.remove();
                anchorMenuEl = null;
            }
            
            popup.closePopup();
        }
    });
}

/** Create 6 smart guide lines (4 edges + 2 center axes) */
function createAnchorIndicators(container) {
    const els = [];
    const axes = ["top", "bottom", "left", "right", "center-x", "center-y"];
    
    axes.forEach(axis => {
        const el = document.createElement("div");
        el.className = `canvas-indicator canvas-guide guide-${axis}`;
        el.dataset.axis = axis;
        el.setAttribute("aria-hidden", "true");
        container.appendChild(el);
        els.push(el);
    });
    return els;
}

function handleAnchorMenuClick(newAnchor, container) {
    const selected = Array.from(container.querySelectorAll(".widget.selected"));
    if (selected.length === 0) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    selected.forEach(w => {
        let currentLeft, currentTop;
        if (w._ghostBox && w._ghostBox._targetLeft !== undefined) {
            currentLeft = w._ghostBox._targetLeft;
            currentTop = w._ghostBox._targetTop;
        } else {
            const rect = w.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            currentLeft = Math.round((rect.left - containerRect.left) / gridSize) * gridSize;
            currentTop = Math.round((rect.top - containerRect.top) / gridSize) * gridSize;
        }
        
        const width = parseFloat(w.style.width) || w.offsetWidth;
        const height = parseFloat(w.style.height) || w.offsetHeight;
        
        const forcedAnchorData = calculateOffsetForAnchor(newAnchor, currentLeft, currentTop, width, height, containerWidth, containerHeight);
        
        w.dataset.anchor = forcedAnchorData.anchor;
        w.dataset.offsetX = forcedAnchorData.offsetX;
        w.dataset.offsetY = forcedAnchorData.offsetY;
        
        applyWidgetPositionStyles(w, forcedAnchorData);
        
        isWidgetDragDirty = true;
    });
}

/** Remove all anchor indicators from the DOM */
function removeAnchorIndicators() {
    anchorIndicators.forEach(el => el.remove());
    anchorIndicators = [];
}
