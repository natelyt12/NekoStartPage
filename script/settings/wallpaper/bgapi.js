import { getPicreData } from "/apis/picre.js";
import { getWallhavenData, clearWallhavenQueue } from "/apis/wallheaven.js";
import { getSettings, saveSettings, subscribe } from "/script/core/storagehandler.js";
import { toggleBgEditorVisibility } from "/script/settings/wallpaper/bgeditor.js";
import { updateRotationUI, stopRotationTimer, startRotationTimer, isRotationExpired } from "/script/settings/wallpaper/rotation.js";
import { applyOnloadAnimation } from "/script/settings/wallpaper/onloadanim.js";
import { showNotification } from "/script/core/UI.js";
import { t } from "/script/core/i18n.js";

// ==========================================
// SOURCE MAP (URL -> Friendly Name)
// ==========================================
const SOURCE_MAP = [{ match: "pixiv.net", label: "Pixiv" }];

/**
 * Converts a raw source URL into a friendly display name.
 * Falls back to the raw URL if no match is found in SOURCE_MAP.
 * @param {string} url
 * @returns {string}
 */
function getSourceLabel(url) {
    if (!url) return "";
    const lower = url.toLowerCase();
    const entry = SOURCE_MAP.find((s) => lower.includes(s.match));
    return entry ? entry.label : url;
}

const setDisabled = (state, ...btns) => {
    btns.forEach((btn) => {
        if (btn) {
            btn.disabled = state;
        }
    });
};

const withTimeout = (promise, ms = 30000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Timeout"));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

// ==========================================
// BASE BACKGROUND PROVIDER (ABSTRACT)
// ==========================================
class BackgroundProvider {
    constructor(uiElements) {
        this.ui = uiElements;
        this.currentData = null;
        this.currentBlobUrl = null;
        this.providerId = "base";
        this.hasConfigUI = true;
    }

    // Nơi các Class con bắt buộc phải tự tùy ý code (Polymorphism)
    initUI() {
        throw new Error("initUI() must be implemented by subclass");
    }
    async fetch(refresh, firstRun) {
        throw new Error("fetch() must be implemented by subclass");
    }

    // Shared logic chung cho toàn bộ APIs (Inheritance)
    cleanup() {
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        if (this.ui.video.src.startsWith("blob:")) {
            this.ui.video.removeAttribute("src");
            this.ui.video.load();
        }
        this.ui.bg.style.backgroundColor = ""; // Reset
    }

    handleError(error) {
        console.error(`[${this.providerId}] Error:`, error);

        // Extract message: handle both Error objects and strings
        let displayMsg = error?.message || (typeof error === "string" ? error : "");

        // Normalize message
        if (displayMsg === "Timeout") {
            displayMsg = t("setting_panel.api_options.error_timeout");
        } else if (displayMsg === "default" || !displayMsg) {
            displayMsg = t("setting_panel.api_options.error", { provider: this.providerId });
        }

        // Show Notification directly
        showNotification(displayMsg, "error");

        // Show Tooltip in Setting Section
        if (this.ui.api_error_tooltip) {
            this.ui.api_error_tooltip.innerText = displayMsg;
            this.ui.api_error_tooltip.style.display = "block";
        }

        setUILocked(false);
    }

    // Xóa lỗi cũ khi bắt đầu tác vụ mới
    clearError() {
        if (this.ui.api_error_tooltip) {
            this.ui.api_error_tooltip.style.display = "none";
            this.ui.api_error_tooltip.innerText = "";
        }
    }

    download() {
        if (!this.currentData?.blob) return;

        const timestamp = Date.now();
        const mime = this.currentData.blob.type;
        let ext = "jpg";
        if (mime === "image/png") ext = "png";
        else if (mime === "image/webp") ext = "webp";
        else if (mime === "image/gif") ext = "gif";

        const filename = `wallpaper_${timestamp}.${ext}`;

        const a = document.createElement("a");
        const url = URL.createObjectURL(this.currentData.blob);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    viewSource() {
        if (this.currentData?.source) window.open(this.currentData.source);
    }

    async updatePreviewImage(blobUrl) {
        if (!this.ui.preview) return;
        let tempImg = new Image();
        tempImg.src = blobUrl;
        this.ui.preview.style.transition = "opacity 0.3s ease";
        this.ui.preview.style.opacity = 0;
        try {
            await tempImg.decode();
            this.ui.preview.src = blobUrl;
            this.ui.preview.style.opacity = 1;
        } catch (e) {
            this.ui.preview.src = blobUrl;
            this.ui.preview.style.opacity = 1;
        }
    }
}

// ==========================================
// LOGIC CHO COLLECTION API
// ==========================================
class CollectionProvider extends BackgroundProvider {
    constructor(uiElements) {
        super(uiElements);
        this.providerId = "collection";
    }

    updateTooltip() {
        if (!this.ui.collection_info_tooltip) return;
        if (!this.currentData || !this.currentData.metadata) {
            this.ui.collection_info_tooltip.innerText = t("setting_panel.api_options.collection.empty_tooltip", "Không có hình nền nào để hiển thị");
            return;
        }

        const data = this.currentData.metadata;
        const type = this.currentData.type || "image";
        const isVideo = type === "video" || type === "local_video" || (this.currentData.blob && this.currentData.blob.type.startsWith("video/"));
        
        const typeKey = isVideo ? "typeVideo" : "typeImage";
        const mediaType = t(`setting_panel.api_options.collection.typeLabel`, { type: t(`setting_panel.api_options.collection.${typeKey}`) });
        
        const srcVal = data.source === "local" ? t("setting_panel.api_options.collection.sourceLocal") : this.currentData.type || data.source || t("setting_panel.api_options.collection.sourceUnknown");
        const srcLabel = t(`setting_panel.api_options.collection.sourceLabel`, { source: srcVal });
        
        const sizeMB = data.size ? t(`setting_panel.api_options.collection.sizeLabel`, { size: (data.size / 1024 / 1024).toFixed(1) }) : "";
        const res = data.width && data.height ? t(`setting_panel.api_options.collection.resolutionLabel`, { width: data.width, height: data.height }) : "";

        const metaText = [mediaType, srcLabel, sizeMB, res].filter(Boolean).join(" | ");
        this.ui.collection_info_tooltip.innerText = metaText;
    }

    initUI() {
        if (this.ui.APIName) {
            this.ui.APIName.innerText = t("setting_panel.api_selector.collection_option", "Bộ sưu tập");
        }
        toggleConfigUIBlock("collection", this.ui);
    }

    async fetch(refresh = true, firstRun = false) {
        this.clearError();
        setUILocked(true, false);

        try {
            const { getCollection } = await import("/script/settings/wallpaper/bgcollection.js");
            const collection = await getCollection();

            if (!collection || collection.length === 0) {
                this.currentData = null;
                this.updateTooltip();
                
                if (!firstRun) {
                    showNotification(t("setting_panel.api_options.collection.empty_collection", "Bộ sưu tập trống, vui lòng thêm hình nền mới!"), "warning");
                    const { openCollectionPopup } = await import("/script/settings/wallpaper/bgcollection_ui.js");
                    openCollectionPopup();
                } else {
                    const settings = getSettings();
                    settings.wallpaperConfig.source = "wallhaven";
                    saveSettings(settings);
                    if (this.ui.API_selector) {
                        this.ui.API_selector.setAttribute("data-value", "wallhaven");
                        const valSpan = this.ui.API_selector.querySelector(".selected_value");
                        if (valSpan) valSpan.innerText = t("setting_panel.api_selector.wallhaven_option", "Wallhaven");
                    }
                }
                return;
            }

            const settings = getSettings();
            let item;

            if (!refresh && settings.wallpaperConfig.activeCollectionItemId) {
                item = collection.find((i) => i.id === settings.wallpaperConfig.activeCollectionItemId);
            }

            if (!item) {
                item = refresh ? collection[Math.floor(Math.random() * collection.length)] : collection[0];
                settings.wallpaperConfig.activeCollectionItemId = item.id;
                saveSettings(settings);
            }

            if (refresh) setUILocked(true, true);

            await applyCollectionItem(item, firstRun);
            this.currentData = { blob: item.blob, type: item.type, providerId: this.providerId, metadata: item.metadata };
            this.updateTooltip();
        } catch (error) {
            this.handleError(error);
        } finally {
            setUILocked(false);
        }
    }
}

// ==========================================
// LOGIC CHO PICRE API
// ==========================================
class PicreProvider extends BackgroundProvider {
    constructor(uiElements) {
        super(uiElements);
        this.providerId = "picre";
    }

    updateTooltip() {
        if (!this.ui.picre_info_tooltip) return;
        if (!this.currentData) {
            this.ui.picre_info_tooltip.innerText = "";
            return;
        }
        const data = this.currentData;
        const sizeMB = data.size ? (data.size / 1024 / 1024).toFixed(2) : "?";
        const sourceLabel = data.source ? getSourceLabel(data.source) : t("setting_panel.api_options.picre.noInfo");
        this.ui.picre_info_tooltip.innerText = t("setting_panel.api_options.picre.imageMetadata", {
            width: data.width || "?",
            height: data.height || "?",
            size: sizeMB,
            source: sourceLabel,
        });
    }

    initUI() {
        if (this.ui.APIName) this.ui.APIName.innerText = t("setting_panel.api_selector.picre_option");
        toggleConfigUIBlock("picre", this.ui);
    }

    async fetch(refresh = false, firstRun = false) {
        this.clearError();
        const buttons = [this.ui.API_selector, this.ui.picre_changewall_btn, this.ui.picre_download_btn, this.ui.picre_source_btn, this.ui.picre_add_btn];
        setUILocked(true);
        setDisabled(true, ...buttons);

        try {
            const [data] = await Promise.all([withTimeout(getPicreData(refresh)), new Promise((resolve) => setTimeout(resolve, 300))]);

            if (!data || !data.blob) throw new Error("default");

            const oldBlob = this.currentBlobUrl;
            let newBlobUrl = null;
            if (data?.blob) {
                newBlobUrl = URL.createObjectURL(data.blob);
            }

            await applyNewBackground({ type: "image", blobUrl: newBlobUrl, hideOld: oldBlob }, firstRun);

            this.currentData = data;
            this.currentBlobUrl = newBlobUrl;

            if (newBlobUrl) {
                await this.updatePreviewImage(newBlobUrl);
                this.updateTooltip();
            }
        } catch (error) {
            this.handleError(error);
        } finally {
            setUILocked(false);
            setDisabled(false, ...buttons);
        }
    }
}

// ==========================================
// LOGIC CHO WALLHAVEN API (Thêm Encapsulation config)
// ==========================================
class WallhavenProvider extends BackgroundProvider {
    constructor(uiElements) {
        super(uiElements);
        this.providerId = "wallhaven";
        this.initSettings();
    }

    updateTooltip() {
        if (!this.ui.wallhaven_info_tooltip) return;
        if (!this.currentData) {
            this.ui.wallhaven_info_tooltip.innerText = "";
            return;
        }
        const data = this.currentData;
        this.ui.wallhaven_info_tooltip.style.color = "";
        const queueStr = `${(data.queue_total || 24) - (data.queue_left || 0)}/${data.queue_total || 24}`;
        this.ui.wallhaven_info_tooltip.innerText = t("setting_panel.api_options.wallhaven.imageMetadata", {
            width: data.width,
            height: data.height,
            size: (data.size / 1024 / 1024).toFixed(2),
            category: data.category || "?",
            queue: queueStr,
        });
    }

    // Encapsulation: Mình gói toàn bộ việc đăng ký Listeners về Settings của Wh vào đây
    initSettings() {
        const config = getSettings().wallhavenConfig || { categories: {} };
        if (this.ui.wh_query) this.ui.wh_query.value = config.query || "";
        if (this.ui.wh_cat_general) this.ui.wh_cat_general.checked = config.categories.general !== false;
        if (this.ui.wh_cat_anime) this.ui.wh_cat_anime.checked = config.categories.anime !== false;
        if (this.ui.wh_cat_people) this.ui.wh_cat_people.checked = config.categories.people === true;

        const saveWallhavenConfig = async () => {
            const s = getSettings();
            if (!s.wallhavenConfig) s.wallhavenConfig = { categories: {} };
            s.wallhavenConfig.query = this.ui.wh_query ? this.ui.wh_query.value.trim() : "";
            s.wallhavenConfig.categories.general = this.ui.wh_cat_general ? this.ui.wh_cat_general.checked : true;
            s.wallhavenConfig.categories.anime = this.ui.wh_cat_anime ? this.ui.wh_cat_anime.checked : true;
            s.wallhavenConfig.categories.people = this.ui.wh_cat_people ? this.ui.wh_cat_people.checked : false;

            saveSettings({ wallhavenConfig: s.wallhavenConfig });
            await clearWallhavenQueue();
        };

        if (this.ui.wh_query) this.ui.wh_query.addEventListener("blur", saveWallhavenConfig);
        if (this.ui.wh_cat_general) this.ui.wh_cat_general.addEventListener("change", saveWallhavenConfig);
        if (this.ui.wh_cat_anime) this.ui.wh_cat_anime.addEventListener("change", saveWallhavenConfig);
        if (this.ui.wh_cat_people) this.ui.wh_cat_people.addEventListener("change", saveWallhavenConfig);
    }

    initUI() {
        if (this.ui.APIName) this.ui.APIName.innerText = t("setting_panel.api_selector.wallhaven_option");
        toggleConfigUIBlock("wallhaven", this.ui);
    }

    async fetch(refresh = false, firstRun = false) {
        this.clearError();
        const buttons = [
            this.ui.API_selector,
            this.ui.wallhaven_changewall_btn,
            this.ui.wallhaven_download_btn,
            this.ui.wallhaven_source_btn,
            this.ui.wallhaven_add_btn,
        ];
        setUILocked(true);
        setDisabled(true, ...buttons);

        try {
            const [data] = await Promise.all([withTimeout(getWallhavenData(refresh)), new Promise((resolve) => setTimeout(resolve, 300))]);

            if (data?.error) throw new Error(data.error);
            if (!data || !data.blob) throw new Error(t("setting_panel.api_options.wallhaven.no_result"));

            const oldBlob = this.currentBlobUrl;
            let newBlobUrl = null;
            if (data?.blob) {
                newBlobUrl = URL.createObjectURL(data.blob);
            }

            await applyNewBackground({ type: "image", blobUrl: newBlobUrl, hideOld: oldBlob }, firstRun);

            this.currentData = data;
            this.currentBlobUrl = newBlobUrl;

            if (newBlobUrl) {
                await this.updatePreviewImage(newBlobUrl);
            }
            if (data) {
                this.updateTooltip();
            }
        } catch (error) {
            this.handleError(error);
        } finally {
            setUILocked(false);
            setDisabled(false, ...buttons);
        }
    }

    handleError(error) {
        // Ghi đè chỉ để xử lý thêm UI specific cho Wallhaven
        super.handleError(error);
        this.currentData = null;
        if (this.ui.wallhaven_info_tooltip) this.ui.wallhaven_info_tooltip.innerText = ""; // Xóa các tooltip cũ để tránh rối
        if (this.ui.overlay) this.ui.overlay.style.opacity = 0;
        if (this.ui.preview) this.ui.preview.removeAttribute("src");
    }
}

// ==========================================
// ORCHESTRATION LAYER (QUẢN LÝ VÀ CHUYỂN ĐỔI OVERALL)
// ==========================================
let currentProvider = null;
let apiRegistry = {};
let rotationFrequency = 0;
let isTransitioning = false;
let globalUI = null;
let collectionBlobUrl = null; // Tracks blob URL created by applyCollectionItem

function setUILocked(state, showLoadingBar = true) {
    if (!globalUI) return;
    if (state === true) {
        if (globalUI.wallpaperRotation) globalUI.wallpaperRotation.disabled = true;
        if (showLoadingBar && globalUI.loading) globalUI.loading.style.opacity = 1;
        if (globalUI.API_selector) globalUI.API_selector.disabled = true;
        if (globalUI.arrange_wallpaper) globalUI.arrange_wallpaper.disabled = true;
    } else {
        if (globalUI.wallpaperRotation) globalUI.wallpaperRotation.disabled = false;
        if (globalUI.loading) globalUI.loading.style.opacity = 0;
        if (globalUI.API_selector) globalUI.API_selector.disabled = false;
        updateCustomizationUI(currentProvider?.providerId || "");
    }
}

async function applyNewBackground(payload, firstRun = false) {
    if (!firstRun) {
        globalUI.overlay.style.opacity = 1;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (payload.hideOld && payload.hideOld !== payload.blobUrl) {
        URL.revokeObjectURL(payload.hideOld);
    }

    // Clean up inactive providers safely
    if (!firstRun) {
        Object.values(apiRegistry).forEach((p) => {
            if (p !== currentProvider) {
                if (p.currentBlobUrl) {
                    URL.revokeObjectURL(p.currentBlobUrl);
                    p.currentBlobUrl = null;
                    p.currentData = null;
                }
            }
        });
    }

    if (payload.type === "video") {
        globalUI.video.style.display = "block";
        if (payload.blobUrl) {
            globalUI.video.src = payload.blobUrl;
            globalUI.video.play();
        }
        globalUI.bg.style.backgroundImage = "none";
        globalUI.bg.style.backgroundColor = "";
    } else if (payload.type === "image") {
        globalUI.video.style.display = "none";
        globalUI.video.pause();
        globalUI.video.removeAttribute("src");
        globalUI.bg.style.backgroundColor = "";
        if (payload.blobUrl) {
            globalUI.bg.style.backgroundImage = `url(${payload.blobUrl})`;
        }
    }

    if (firstRun) {
        applyOnloadAnimation();
    } else {
        globalUI.overlay.style.opacity = 0;
    }
    applyWallpaperFilters();
    applyWallpaperPosition();
}

export function applyWallpaperPosition() {
    const settings = getSettings();
    const state = settings.wallpaperPosition || { x: 50, y: 50, zoom: 1, mode: "cover" };
    const realLayer = document.querySelector(".image");
    if (!realLayer) return;

    const mode = state.mode || "cover";
    realLayer.style.backgroundSize = mode;

    if (mode === "contain") {
        realLayer.style.backgroundPosition = "center";
        realLayer.style.transformOrigin = "center";
        realLayer.style.transform = "scale(1)";
    } else {
        realLayer.style.transformOrigin = `${state.x}% ${state.y}%`;
        realLayer.style.backgroundPosition = `${state.x}% ${state.y}%`;
        realLayer.style.transform = `scale(${state.zoom})`;
    }
}

export function applyWallpaperFilters() {
    const config = getSettings().wallpaperConfig;
    const brightness = config.brightness ?? 1;
    const blur = config.blur ?? 0;
    const contrast = config.contrast ?? 1;
    const saturate = config.saturate ?? 1;
    const hue = config.hue ?? 0;
    const chroma = config.chroma ?? 0;

    let svg = document.getElementById("chroma_svg_filter");
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "chroma_svg_filter";
        svg.style.display = "none";
        svg.innerHTML = `
            <filter id="chroma_filter">
                <feOffset in="SourceGraphic" dx="0" dy="0" result="red-shift"/>
                <feOffset in="SourceGraphic" dx="0" dy="0" result="blue-shift"/>
                <feOffset in="SourceGraphic" dx="0" dy="0" result="green-shift"/>
                <feColorMatrix in="red-shift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red-channel"/>
                <feColorMatrix in="blue-shift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue-channel"/>
                <feColorMatrix in="green-shift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green-channel"/>
                <feBlend mode="screen" in="red-channel" in2="blue-channel" result="rb"/>
                <feBlend mode="screen" in="rb" in2="green-channel" result="rgb"/>
            </filter>
        `;
        document.body.appendChild(svg);
    }

    const filterEl = document.getElementById("chroma_filter");
    if (filterEl) {
        filterEl.children[0].setAttribute("dx", chroma);
        filterEl.children[1].setAttribute("dx", -chroma);
    }

    let filterStr = `brightness(${brightness}) blur(${blur}px) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hue}deg)`;
    if (chroma > 0) {
        filterStr += ` url(#chroma_filter)`;
    }

    // Safety check if globalUI is not loaded yet
    const bg = globalUI?.bg || document.querySelector(".image");
    const video = globalUI?.video || document.querySelector(".video");

    if (bg) bg.style.filter = filterStr;
    if (video) video.style.filter = filterStr;
}

function updateCustomizationUI(apiType) {
    if (!globalUI) return;

    if (globalUI.arrange_wallpaper) globalUI.arrange_wallpaper.disabled = false;
    if (globalUI.wavy_animation) {
        globalUI.wavy_animation.disabled = false;
        const parent = globalUI.wavy_animation.parentElement;
        if (parent) parent.removeAttribute("disabled");
    }
    if (globalUI.edit_wavy_settings) globalUI.edit_wavy_settings.disabled = false;
    if (globalUI.edit_onload_settings) globalUI.edit_onload_settings.disabled = false;
    if (globalUI.rotation_block) globalUI.rotation_block.style.display = "block";

    // Toggle "Mỗi lần mở tab mới" rotation option
    const tabOpt = document.getElementById("rotation_opt_tab");
    if (tabOpt) {
        const isCollection = apiType === "collection";
        tabOpt.style.display = isCollection ? "block" : "none";

        if (!isCollection && globalUI.wallpaperRotation) {
            const currentVal = parseInt(globalUI.wallpaperRotation.getAttribute("data-value") || "0");
            if (currentVal === 5) {
                document.dispatchEvent(new CustomEvent("subsectionChange", { detail: { id: "wallpaperRotation", value: 0 } }));
            }
        }
    }
}

function toggleConfigUIBlock(apiType, ui) {
    if (!ui.apiConfigSection) return;
    const provider = apiRegistry[apiType];
    const hasConfig = provider ? provider.hasConfigUI !== false : true;
    const isShown = apiType && apiType !== "loading" && apiType !== "none" && hasConfig;
    ui.apiConfigSection.style.display = isShown ? "block" : "none";

    if (ui.collection_config_ui) ui.collection_config_ui.style.display = apiType === "collection" ? "flex" : "none";
    if (ui.picre_config_ui) ui.picre_config_ui.style.display = apiType === "picre" ? "flex" : "none";
    if (ui.wallhaven_config_ui) ui.wallhaven_config_ui.style.display = apiType === "wallhaven" ? "flex" : "none";
}

/**
 * Initialize all logics and interfaces related to the Background Features API.
 * Defines setup, rotations, configuration savers, and dynamic background changing implementations.
 * @returns {Promise<void>}
 */
export async function initBgAPIFeatures() {
    globalUI = {
        bg: document.querySelector(".image"),
        video: document.querySelector(".video"),
        overlay: document.querySelector(".overlay"),
        preview: document.getElementById("preview"),
        APIName: document.getElementById("api_name"),
        loading: document.querySelector(".loading"),
        arrange_wallpaper: document.getElementById("arrange_wallpaper"),
        wallpaperRotation: document.getElementById("wallpaperRotation"),
        rotation_block: document.getElementById("rotation_setting_block"),
        apiConfigSection: document.getElementById("api_config"),
        API_selector: document.getElementById("API_selector"),
        api_error_tooltip: document.getElementById("api_error_tooltip"),

        collection_config_ui: document.getElementById("collection_config_ui"),
        collection_info_tooltip: document.getElementById("collection_info_tooltip"),

        wh_query: document.getElementById("wh_query"),
        wh_cat_general: document.getElementById("wh_cat_general"),
        wh_cat_anime: document.getElementById("wh_cat_anime"),
        wh_cat_people: document.getElementById("wh_cat_people"),
        wh_resolution: document.getElementById("wh_resolution"),

        picre_config_ui: document.getElementById("picre_config_ui"),
        wallhaven_config_ui: document.getElementById("wallhaven_config_ui"),

        picre_changewall_btn: document.getElementById("picre_changewall"),
        picre_source_btn: document.getElementById("picre_source"),
        picre_download_btn: document.getElementById("picre_download"),
        picre_add_btn: document.getElementById("picre_add_to_collection"),
        picre_info_tooltip: document.getElementById("picre_info_tooltip"),

        wallhaven_changewall_btn: document.getElementById("wallhaven_changewall"),
        wallhaven_source_btn: document.getElementById("wallhaven_source"),
        wallhaven_download_btn: document.getElementById("wallhaven_download"),
        wallhaven_add_btn: document.getElementById("wallhaven_add_to_collection"),
        wallhaven_info_tooltip: document.getElementById("wallhaven_info_tooltip"),

        wavy_animation: document.getElementById("wavy_animation"),
        edit_wavy_settings: document.getElementById("edit_wavy_settings"),
        edit_onload_settings: document.getElementById("edit_onload_settings"),
    };

    const initialSettings = getSettings();
    rotationFrequency = initialSettings.wallpaperConfig?.rotation || 0;

    // ONLY create apiRegistry if it doesn't exist yet to preserve cached currentData metadata
    if (Object.keys(apiRegistry).length === 0) {
        apiRegistry = {
            collection: new CollectionProvider(globalUI),
            picre: new PicreProvider(globalUI),
            wallhaven: new WallhavenProvider(globalUI),
        };
    } else {
        // Just update the ui reference of existing providers and re-bind event listeners to the fresh DOM
        Object.values(apiRegistry).forEach((provider) => {
            provider.ui = globalUI;
            if (provider.initSettings) {
                provider.initSettings();
            }
        });
    }

    // Initialize values from settings
    applyWallpaperFilters();

    const setupEventListeners = () => {
        const changeWall = () => currentProvider?.fetch(true);
        const downloadWall = () => currentProvider?.download();
        const viewSrc = () => currentProvider?.viewSource();

        globalUI.picre_changewall_btn?.addEventListener("mousedown", changeWall);
        globalUI.picre_download_btn?.addEventListener("mousedown", downloadWall);
        globalUI.picre_source_btn?.addEventListener("mousedown", viewSrc);

        globalUI.wallhaven_changewall_btn?.addEventListener("mousedown", changeWall);
        globalUI.wallhaven_download_btn?.addEventListener("mousedown", downloadWall);
        globalUI.wallhaven_source_btn?.addEventListener("mousedown", viewSrc);
    };

    setupEventListeners();

    // Re-sync current active provider and preview when settings panel DOM is loaded
    const activeSource = initialSettings.wallpaperConfig?.source || "wallhaven";
    if (apiRegistry[activeSource]) {
        currentProvider = apiRegistry[activeSource];

        if (globalUI.API_selector) {
            toggleBgEditorVisibility(true);
            if (globalUI.wallpaperRotation) {
                updateRotationUI(activeSource, globalUI.wallpaperRotation);
            }
            updateCustomizationUI(activeSource);
            currentProvider.initUI();

            // Re-render the metadata info tooltip using existing currentData
            if (currentProvider.updateTooltip) {
                currentProvider.updateTooltip();
            }

            // Populate preview image from background style
            const bgImgElement = document.querySelector(".image");
            if (bgImgElement && globalUI.preview) {
                const bgImg = bgImgElement.style.backgroundImage;
                if (bgImg) {
                    const cleanUrl = bgImg.slice(4, -1).replace(/"/g, "");
                    globalUI.preview.src = cleanUrl;
                }
            }
        }
    }

    document.addEventListener("subsectionChange", async (event) => {
        const { id, value, firstRun } = event.detail;

        if (id === "wh_resolution") {
            const s = getSettings();
            if (!s.wallhavenConfig) s.wallhavenConfig = { categories: {} };
            s.wallhavenConfig.resolution = value;
            saveSettings({ wallhavenConfig: s.wallhavenConfig });
            if (!firstRun) await clearWallhavenQueue();
            return;
        }

        if (id === "wallpaperRotation") {
            const freq = parseInt(value, 10);
            const current = getSettings().wallpaperConfig;
            if (current.rotation !== freq) {
                saveSettings({ wallpaperConfig: { ...current, rotation: freq } });
            }
            return;
        }

        if (id === "API_selector") {
            const current = getSettings().wallpaperConfig;
            if (current.source !== value) {
                saveSettings({ wallpaperConfig: { ...current, source: value } });
            }
        }
    });
}

// Subscribe reactively to "wallpaperConfig" settings changes
subscribe("wallpaperConfig", async (newConfig) => {
    if (!globalUI) return; // Wait until initBgAPIFeatures is initialized

    const source = newConfig?.source || "wallhaven";
    const rotation = newConfig?.rotation || 0;
    rotationFrequency = rotation;

    if (apiRegistry[source] && (!currentProvider || currentProvider.providerId !== source)) {
        if (isTransitioning) return;

        stopRotationTimer();
        isTransitioning = true;

        toggleBgEditorVisibility(true);
        if (globalUI.wallpaperRotation) {
            updateRotationUI(source, globalUI.wallpaperRotation);
        }
        updateCustomizationUI(source);

        currentProvider = apiRegistry[source];
        currentProvider.initUI();

        await currentProvider.fetch(false, false);

        startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true, false));

        isTransitioning = false;
    } else if (currentProvider && currentProvider.providerId === source) {
        // Source is the same, but rotation frequency changed
        stopRotationTimer();
        startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true, false));
    }
});

/**
 * Loads the active background wallpaper on startup without requiring settings HTML to be loaded.
 */
export async function loadInitialBackground() {
    if (!globalUI) {
        await initBgAPIFeatures();
    }

    const settings = getSettings();
    const config = settings.wallpaperConfig || {};
    const source = config.source || "wallhaven";
    const rotation = config.rotation || 0;
    rotationFrequency = rotation;

    // Handle "per new tab" collection rotation (frequency = 5)
    if (rotation === 5) {
        try {
            const { getCollection } = await import("/script/settings/wallpaper/bgcollection.js");
            const collection = await getCollection();
            if (collection.length > 0) {
                const item = collection[Math.floor(Math.random() * collection.length)];
                await applyCollectionItem(item, true);
                return; // Done — no provider needed
            }
        } catch (e) {
            console.warn("[bgapi] Could not load collection for per-tab rotation:", e);
        }
        // If collection is empty, fall through to normal provider
    }

    if (apiRegistry[source]) {
        currentProvider = apiRegistry[source];

        toggleBgEditorVisibility(true);
        if (globalUI.wallpaperRotation) {
            updateRotationUI(source, globalUI.wallpaperRotation);
        }
        updateCustomizationUI(source);

        currentProvider.initUI();

        const fetchRefresh = await isRotationExpired(source, rotation);
        await currentProvider.fetch(fetchRefresh, true);

        startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true, false));
    }
}

// ==========================================
// COLLECTION INTEGRATION EXPORTS
// ==========================================

/**
 * Returns the current provider's data (blob, metadata, etc.) and provider id.
 * Used by bgcollection_ui.js to add the current wallpaper to the collection.
 * @returns {{ providerId: string, blob: Blob, [key: string]: any } | null}
 */
export function getCurrentProviderData() {
    if (!currentProvider || !currentProvider.currentData) return null;
    return { ...currentProvider.currentData, providerId: currentProvider.providerId };
}

export async function applyCollectionItem(item, firstRun = false) {
    if (!item?.blob) {
        if (item?.metadata?.url) {
            try {
                const res = await fetch(item.metadata.url, { mode: "cors" });
                if (!res.ok) throw new Error("Fetch failed");
                item.blob = await res.blob();
                
                const { generateImageThumbnail, getCollection } = await import("/script/settings/wallpaper/bgcollection.js");
                const { saveToStore } = await import("/script/core/db.js");
                item.thumbnail = await generateImageThumbnail(item.blob);
                
                const collection = await getCollection();
                const dbItem = collection.find(c => c.id === item.id);
                if (dbItem) {
                    dbItem.blob = item.blob;
                    dbItem.thumbnail = item.thumbnail;
                    await saveToStore("background_collection", collection);
                }
            } catch (err) {
                console.error("Failed to restore collection item blob", err);
                showNotification(t("setting_panel.api_options.collection.restore_failed", "Không thể khôi phục ảnh từ mạng"), "error");
                return;
            }
        } else {
            return;
        }
    }

    // Save active item ID so it persists across reloads
    const settings = getSettings();
    settings.wallpaperConfig.activeCollectionItemId = item.id;
    if (settings.wallpaperConfig.activeSource !== "collection") {
        settings.wallpaperConfig.activeSource = "collection";
        // Update the UI API selector without triggering a fetch
        const sel = document.getElementById("API_selector");
        if (sel) {
            sel.setAttribute("data-value", "collection");
            const valSpan = sel.querySelector(".selected_value");
            if (valSpan) valSpan.innerText = t("setting_panel.api_selector.collection_option", "Bộ sưu tập");
        }
    }
    saveSettings(settings);

    // If currently on collection provider, update its internal state
    if (currentProvider && currentProvider.providerId === "collection") {
        currentProvider.currentData = { blob: item.blob, type: item.type, providerId: "collection", metadata: item.metadata };
        if (currentProvider.ui.preview) {
            currentProvider.ui.preview.src = URL.createObjectURL(item.thumbnail || item.blob);
        }
        if (currentProvider.updateTooltip) {
            currentProvider.updateTooltip();
        }
    }

    const oldUrl = collectionBlobUrl || currentProvider?.currentBlobUrl;
    const newBlobUrl = URL.createObjectURL(item.blob);
    const type = item.blob.type.startsWith("video/") || item.type === "local_video" ? "video" : "image";

    // Revoke old collection URL (provider URLs are managed by the provider)
    if (collectionBlobUrl) {
        URL.revokeObjectURL(collectionBlobUrl);
    }
    collectionBlobUrl = newBlobUrl;

    await applyNewBackground({ type, blobUrl: newBlobUrl, hideOld: null }, firstRun);
}
