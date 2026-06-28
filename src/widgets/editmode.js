import { getSettings, saveSettings, subscribe } from "/src/core/storageHandler.js";
import { applyWidgetPositionStyles, getCanvasMetrics } from "./handler.js";

const gridSize = 10;
let isEditMode = false;
let isWidgetDragDirty = false;

// Active anchor indicator elements (populated while edit mode is open)
let anchorIndicators = [];

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
            container.querySelectorAll(".widget.selected").forEach(w => w.classList.remove("selected"));
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
                } else if (!e.shiftKey) {
                    w.classList.remove("selected");
                }
            });
        };

        const onMouseUp = () => {
            selectionBox.remove();
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
                widget.classList.toggle("selected");
                if (!widget.classList.contains("selected")) {
                    return; // Do not start dragging if we just deselected it
                }
            } else if (!widget.classList.contains("selected")) {
                if (!e || !e.shiftKey) {
                    container.querySelectorAll(".widget.selected").forEach(w => w.classList.remove("selected"));
                }
                widget.classList.add("selected");
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
                w.classList.add("dragging");
                
                w.dataset.oldAnchor = w.dataset.anchor || "";
                w.dataset.oldOffsetX = w.dataset.offsetX || "0";
                w.dataset.oldOffsetY = w.dataset.offsetY || "0";

                return { el: w, initialLeft: left, initialTop: top, width, height };
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

            const localCenterXAnchor = absoluteCenterX - canvasOffsetX;
            const localCenterYAnchor = absoluteCenterY - canvasOffsetY;

            const minX = canvasOffsetX;
            const maxX = Math.max(minX, canvasOffsetX + contentWidth - bboxWidth);
            const minY = canvasOffsetY;
            const maxY = Math.max(minY, canvasOffsetY + contentHeight - bboxHeight);

            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));

            const localLeft = newLeft - canvasOffsetX;
            const localTop = newTop - canvasOffsetY;

            const localCenterX = localLeft + bboxWidth / 2;
            const localCenterY = localTop + bboxHeight / 2;

            const anchors = [
                { name: "top-left", x: 0, y: 0 },
                { name: "top-center", x: localCenterXAnchor, y: 0 },
                { name: "top-right", x: contentWidth, y: 0 },
                { name: "center-left", x: 0, y: localCenterYAnchor },
                { name: "center", x: localCenterXAnchor, y: localCenterYAnchor },
                { name: "center-right", x: contentWidth, y: localCenterYAnchor },
                { name: "bottom-left", x: 0, y: contentHeight },
                { name: "bottom-center", x: localCenterXAnchor, y: contentHeight },
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

            let offsetX = 0;
            let offsetY = 0;

            switch (bestAnchorName) {
                case "top-left": offsetX = localLeft; offsetY = localTop; break;
                case "top-center": offsetX = localCenterX - localCenterXAnchor; offsetY = localTop; break;
                case "top-right": offsetX = contentWidth - (localLeft + bboxWidth); offsetY = localTop; break;
                case "center-left": offsetX = localLeft; offsetY = localCenterY - localCenterYAnchor; break;
                case "center": offsetX = localCenterX - localCenterXAnchor; offsetY = localCenterY - localCenterYAnchor; break;
                case "center-right": offsetX = contentWidth - (localLeft + bboxWidth); offsetY = localCenterY - localCenterYAnchor; break;
                case "bottom-left": offsetX = localLeft; offsetY = contentHeight - (localTop + bboxHeight); break;
                case "bottom-center": offsetX = localCenterX - localCenterXAnchor; offsetY = contentHeight - (localTop + bboxHeight); break;
                case "bottom-right": offsetX = contentWidth - (localLeft + bboxWidth); offsetY = contentHeight - (localTop + bboxHeight); break;
            }

            snappedOffsetX = Math.round(offsetX / gridSize) * gridSize;
            snappedOffsetY = Math.round(offsetY / gridSize) * gridSize;

            let localGuideLeft = 0;
            let localGuideTop = 0;

            switch (bestAnchorName) {
                case "top-left": localGuideLeft = snappedOffsetX; localGuideTop = snappedOffsetY; break;
                case "top-center": localGuideLeft = localCenterXAnchor + snappedOffsetX - bboxWidth / 2; localGuideTop = snappedOffsetY; break;
                case "top-right": localGuideLeft = contentWidth - snappedOffsetX - bboxWidth; localGuideTop = snappedOffsetY; break;
                case "center-left": localGuideLeft = snappedOffsetX; localGuideTop = localCenterYAnchor + snappedOffsetY - bboxHeight / 2; break;
                case "center": localGuideLeft = localCenterXAnchor + snappedOffsetX - bboxWidth / 2; localGuideTop = localCenterYAnchor + snappedOffsetY - bboxHeight / 2; break;
                case "center-right": localGuideLeft = contentWidth - snappedOffsetX - bboxWidth; localGuideTop = localCenterYAnchor + snappedOffsetY - bboxHeight / 2; break;
                case "bottom-left": localGuideLeft = snappedOffsetX; localGuideTop = contentHeight - snappedOffsetY - bboxHeight; break;
                case "bottom-center": localGuideLeft = localCenterXAnchor + snappedOffsetX - bboxWidth / 2; localGuideTop = contentHeight - snappedOffsetY - bboxHeight; break;
                case "bottom-right": localGuideLeft = contentWidth - snappedOffsetX - bboxWidth; localGuideTop = contentHeight - snappedOffsetY - bboxHeight; break;
            }

            const guideLeft = localGuideLeft + canvasOffsetX;
            const guideTop = localGuideTop + canvasOffsetY;

            // Apply snapped delta to all selected widgets
            let snappedDeltaX = guideLeft - bboxInitialLeft;
            let snappedDeltaY = guideTop - bboxInitialTop;
            
            // Fix: Round delta to gridSize so widgets never land on sub-grid coordinates
            // This prevents relative distance corruption when widgets have different anchors
            snappedDeltaX = Math.round(snappedDeltaX / gridSize) * gridSize;
            snappedDeltaY = Math.round(snappedDeltaY / gridSize) * gridSize;

            widgetData.forEach(data => {
                data.el.style.left = (data.initialLeft + snappedDeltaX) + "px";
                data.el.style.top = (data.initialTop + snappedDeltaY) + "px";
            });

            anchorIndicators.forEach(el => {
                const axis = el.dataset.axis;
                let isActive = false;
                
                if (axis === "top" && bestAnchorName.includes("top") && snappedOffsetY === 0) isActive = true;
                if (axis === "bottom" && bestAnchorName.includes("bottom") && snappedOffsetY === 0) isActive = true;
                if (axis === "left" && bestAnchorName.includes("left") && snappedOffsetX === 0) isActive = true;
                if (axis === "right" && bestAnchorName.includes("right") && snappedOffsetX === 0) isActive = true;
                if (axis === "center-x" && (bestAnchorName === "top-center" || bestAnchorName === "bottom-center" || bestAnchorName === "center") && snappedOffsetX === 0) isActive = true;
                if (axis === "center-y" && (bestAnchorName === "center-left" || bestAnchorName === "center-right" || bestAnchorName === "center") && snappedOffsetY === 0) isActive = true;
                
                el.classList.toggle("active", isActive);
            });
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            anchorIndicators.forEach(el => el.classList.remove("active"));
            
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            widgetData.forEach(data => {
                data.el.classList.remove("dragging");

                const currentLeft = parseFloat(data.el.style.left);
                const currentTop = parseFloat(data.el.style.top);
                
                // Calculate anchor and offset for individual widget
                const indvAnchorData = calculateIndividualAnchor(currentLeft, currentTop, data.width, data.height, containerWidth, containerHeight);
                
                data.el.dataset.anchor = indvAnchorData.anchor;
                data.el.dataset.offsetX = indvAnchorData.offsetX;
                data.el.dataset.offsetY = indvAnchorData.offsetY;

                applyWidgetPositionStyles(data.el, indvAnchorData);

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

function calculateIndividualAnchor(left, top, widgetWidth, widgetHeight, containerWidth, containerHeight) {
    const { offsetX: canvasOffsetX, offsetY: canvasOffsetY, effectiveW: contentWidth, effectiveH: contentHeight, centerX: absoluteCenterX, centerY: absoluteCenterY } = getCanvasMetrics(containerWidth, containerHeight);

    const localCenterXAnchor = absoluteCenterX - canvasOffsetX;
    const localCenterYAnchor = absoluteCenterY - canvasOffsetY;

    const localLeft = left - canvasOffsetX;
    const localTop = top - canvasOffsetY;

    const localCenterX = localLeft + widgetWidth / 2;
    const localCenterY = localTop + widgetHeight / 2;

    const anchors = [
        { name: "top-left", x: 0, y: 0 },
        { name: "top-center", x: localCenterXAnchor, y: 0 },
        { name: "top-right", x: contentWidth, y: 0 },
        { name: "center-left", x: 0, y: localCenterYAnchor },
        { name: "center", x: localCenterXAnchor, y: localCenterYAnchor },
        { name: "center-right", x: contentWidth, y: localCenterYAnchor },
        { name: "bottom-left", x: 0, y: contentHeight },
        { name: "bottom-center", x: localCenterXAnchor, y: contentHeight },
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

    const bestAnchorName = bestAnchor.name;

    let offsetX = 0;
    let offsetY = 0;

    switch (bestAnchorName) {
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

    return { anchor: bestAnchorName, offsetX: snappedOffsetX, offsetY: snappedOffsetY };
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

    // Create anchor indicator elements
    anchorIndicators = createAnchorIndicators(container);

    Promise.all([import("/src/core/ui.js"), import("/src/core/i18n.js")]).then(([{ openCustomPopup, showNotification }, { t }]) => {
        const contentNode = document.createElement("div");
        contentNode.className = "popup_body";
        contentNode.innerHTML = `
            <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">${t("alert.widget_edit_desc")}</p>
            <div class="actions">
                <button id="widget_cancel_btn" class="secondary">${t("alert.widget_edit_cancel")}</button>
                <button id="widget_save_btn" class="primary">${t("alert.widget_edit_save")}</button>
            </div>
        `;

        const popup = openCustomPopup(t("alert.widget_edit_title"), contentNode, "400px", {
            id: "widget_edit_popup",
            isAlert: false,
            canClose: false,
            hideSettingPanel: true,
        });

        let canExit = false;
        let exitTimer = null;

        contentNode.querySelector("#widget_cancel_btn").onmousedown = () => {
            if (isWidgetDragDirty && !canExit) {
                showNotification(t("alert.unsaved_changes"), "warning");
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
                w.classList.remove("selected");
            });
            
            saveSettings({ widgets: newWidgets });
            showNotification(t("alert.saved_changes"), "success");
            exitMode();
        };

        function exitMode() {
            isEditMode = false;
            container.classList.remove("edit-mode");
            removeAnchorIndicators();
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

/** Remove all anchor indicators from the DOM */
function removeAnchorIndicators() {
    anchorIndicators.forEach(el => el.remove());
    anchorIndicators = [];
}
