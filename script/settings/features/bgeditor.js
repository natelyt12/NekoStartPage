import { openCustomPopup, showNotification } from "../utils/UI.js";
import { saveSettings, getSettings } from "../utils/storagehandler.js"; // Import getSettings
import { t, translateDOM } from "../../core/i18n.js";

class BackgroundEditor {
    constructor(realLayer, template) {
        this.realLayer = realLayer;
        this.template = template;

        this.DEFAULT_STATE = { x: 50, y: 50, zoom: 1 };

        const WALLPAPER_POSITION = getSettings().wallpaperPosition;
        this.startState = WALLPAPER_POSITION ? { ...WALLPAPER_POSITION } : { ...this.DEFAULT_STATE };
        this.currentState = { ...this.startState };
        this.isSaved = false;
        this.isDirty = false;
        this.canExit = false;
        this.exitTimer = null;

        this.ui = {};
        this.dimensions = {
            baseLensW: 0,
            baseLensH: 0,
            viewW: 0,
            viewH: 0,
            maxMoveX: 0,
            maxMoveY: 0
        };

        this.dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            startLeft: 0,
            startTop: 0
        };

        // Ensure standard methods are bound to "this" object
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    init() {
        if (getSettings().wallpaperPosition) {
            this.applyTransformToLayer(this.startState, false);
        }
    }

    open() {
        let bgUrl = getComputedStyle(this.realLayer).backgroundImage;
        if (!bgUrl || bgUrl === "none") {
            showNotification(t("alert.no_image_to_arrange"), "warning");
            return;
        }

        this.isSaved = false;
        this.isDirty = false;
        this.canExit = false;
        if (this.exitTimer) clearTimeout(this.exitTimer);
        this.currentState = { ...this.startState };

        const clone = this.template.content.cloneNode(true);
        translateDOM(clone);

        this.bindUI(clone);
        this.loadImageAndCalculate(bgUrl);
        this.setupEvents();

        this.popup = openCustomPopup(t("bg_editor.window_title"), clone, "534px", { id: "bg_editor", isAlert: false, canClose: true, hideUI: true });
        this.setupCloseEvent();
    }

    bindUI(clone) {
        this.ui.editorContainer = clone.querySelector("#editor_container");
        this.ui.fullImageView = clone.querySelector("#full_image_view");
        this.ui.viewLens = clone.querySelector("#view_lens");
        this.ui.slider = clone.querySelector("#zoom_slider");
        this.ui.zoomText = clone.querySelector("#zoom_value");
        this.ui.btnReset = clone.querySelector("#btn_reset");
        this.ui.btnApply = clone.querySelector("#btn_apply");
    }

    updateVisuals() {
        const z = this.currentState.zoom;
        const ui = this.ui;
        const d = this.dimensions;

        ui.zoomText.innerText = `${Math.round(z * 100)}%`;
        ui.slider.value = z;

        if (d.baseLensW === 0) return;

        const currentLensW = d.baseLensW / z;
        const currentLensH = d.baseLensH / z;

        ui.viewLens.style.width = `${currentLensW}px`;
        ui.viewLens.style.height = `${currentLensH}px`;

        d.maxMoveX = d.viewW - currentLensW;
        d.maxMoveY = d.viewH - currentLensH;

        const lensLeft = d.maxMoveX > 0 ? (this.currentState.x / 100) * d.maxMoveX : 0;
        const lensTop = d.maxMoveY > 0 ? (this.currentState.y / 100) * d.maxMoveY : 0;

        ui.viewLens.style.left = `${lensLeft}px`;
        ui.viewLens.style.top = `${lensTop}px`;

        this.applyTransformToLayer(this.currentState, true);
    }

    applyTransformToLayer(state, isTransitioning) {
        if (isTransitioning) {
            this.realLayer.style.transition = "transform 0.1s linear";
        }
        this.realLayer.style.transformOrigin = `${state.x}% ${state.y}%`;
        this.realLayer.style.backgroundPosition = `${state.x}% ${state.y}%`;
        this.realLayer.style.transform = `scale(${state.zoom})`;
    }

    loadImageAndCalculate(bgUrl) {
        const cleanUrl = bgUrl.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
        const imgObj = new Image();
        imgObj.src = cleanUrl;

        imgObj.onload = () => {
            const imgRatio = imgObj.naturalWidth / imgObj.naturalHeight;
            const screenRatio = window.innerWidth / window.innerHeight;
            const maxW = 500;
            const maxH = 500;

            const d = this.dimensions;

            if (imgRatio > maxW / maxH) {
                d.viewW = maxW;
                d.viewH = d.viewW / imgRatio;
            } else {
                d.viewH = maxH;
                d.viewW = d.viewH * imgRatio;
            }

            this.ui.fullImageView.style.width = this.ui.editorContainer.style.width = `${d.viewW}px`;
            this.ui.fullImageView.style.height = this.ui.editorContainer.style.height = `${d.viewH}px`;
            this.ui.fullImageView.style.backgroundImage = `url(${cleanUrl})`;

            if (screenRatio > imgRatio) {
                d.baseLensW = d.viewW;
                d.baseLensH = d.baseLensW / screenRatio;
            } else {
                d.baseLensH = d.viewH;
                d.baseLensW = d.baseLensH * screenRatio;
            }

            this.updateVisuals();

            // Mouse drags configuration
            this.ui.viewLens.onmousedown = (e) => {
                this.dragState.isDragging = true;
                this.dragState.startX = e.clientX;
                this.dragState.startY = e.clientY;
                this.dragState.startLeft = this.ui.viewLens.offsetLeft;
                this.dragState.startTop = this.ui.viewLens.offsetTop;
                e.preventDefault();
            };

            document.addEventListener("mousemove", this.onMouseMove);
            document.addEventListener("mouseup", this.onMouseUp);
        };
    }

    onMouseMove(e) {
        if (!this.dragState.isDragging) return;
        const d = this.dimensions;
        const ds = this.dragState;

        let newLeft = Math.max(0, Math.min(ds.startLeft + (e.clientX - ds.startX), d.maxMoveX));
        let newTop = Math.max(0, Math.min(ds.startTop + (e.clientY - ds.startY), d.maxMoveY));

        // Convert px to percent
        const newX = d.maxMoveX > 0 ? (newLeft / d.maxMoveX) * 100 : 50;
        const newY = d.maxMoveY > 0 ? (newTop / d.maxMoveY) * 100 : 50;

        if (this.currentState.x !== newX || this.currentState.y !== newY) {
            this.isDirty = true;
        }

        this.currentState.x = newX;
        this.currentState.y = newY;

        this.updateVisuals();
    }

    onMouseUp() {
        this.dragState.isDragging = false;
    }

    setupEvents() {
        this.ui.slider.oninput = () => {
            this.currentState.zoom = parseFloat(this.ui.slider.value);
            this.isDirty = true;
            this.updateVisuals();
        };

        this.ui.btnReset.onmousedown = () => {
            this.currentState = { ...this.DEFAULT_STATE };
            this.isDirty = true;
            this.updateVisuals();
        };

        this.ui.btnApply.onmousedown = () => {
            this.isSaved = true;
            this.isDirty = false;
            this.startState = {
                x: parseFloat(this.currentState.x.toFixed(2)),
                y: parseFloat(this.currentState.y.toFixed(2)),
                zoom: parseFloat(this.currentState.zoom),
            };
            console.debug("Saved:", this.startState);
            saveSettings({ wallpaperPosition: this.startState });
            if (this.popup && this.popup.closeBtn) {
                this.popup.closeBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            }
        };
    }

    setupCloseEvent() {
        const closeBtn = this.popup ? this.popup.closeBtn : null;
        if (!closeBtn) return;

        const handleBeforeClose = (e) => {
            if (this.isDirty && !this.canExit) {
                e.preventDefault();
                showNotification(t("alert.unsaved_changes"), "warning");
                this.canExit = true;

                if (this.exitTimer) clearTimeout(this.exitTimer);
                this.exitTimer = setTimeout(() => {
                    this.canExit = false;
                }, 5000);
            } else {
                if (!this.isSaved) {
                    this.currentState = { ...this.startState };
                    if (this.dimensions.baseLensW > 0) {
                        this.updateVisuals();
                    } else {
                        this.applyTransformToLayer(this.startState, false);
                    }
                }
                this.realLayer.style.transition = "";

                document.removeEventListener("mousemove", this.onMouseMove);
                document.removeEventListener("mouseup", this.onMouseUp);

                closeBtn.removeEventListener("popupBeforeClose", handleBeforeClose);
            }
        };
        closeBtn.addEventListener("popupBeforeClose", handleBeforeClose);
    }
}

/**
 * Initialize the Background Editor component.
 * Allows users to adjust the zoom and focus position of the current static background image using a popup UI.
 */
export function InitBGEditor() {
    const btn = document.getElementById("arrange_wallpaper");
    const template = document.getElementById("tpl_wallpaper_editor");
    const realLayer = document.querySelector(".image");

    if (!btn || !template || !realLayer) return;

    const editor = new BackgroundEditor(realLayer, template);
    editor.init();

    btn.onmousedown = () => {
        editor.open();
    };
}

/**
 * Show or hide the background editor button trigger from the interface based on the active API block format.
 * Primarily used to hide the editor when dealing with dynamic or video backgrounds.
 * @param {boolean} state - True to make the button visible, false to hide it.
 */
export function toggleBgEditorVisibility(state) {
    const btn = document.getElementById("arrange_wallpaper");
    if (!btn) return;

    const display = state ? "block" : "none";
    btn.style.display = display;

    if (btn.nextElementSibling) {
        btn.nextElementSibling.style.display = display;
    }
}
