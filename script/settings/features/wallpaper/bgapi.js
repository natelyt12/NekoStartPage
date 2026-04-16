import { getPicreData } from "/script/core/apis/picre.js";
import { getWallhavenData, clearWallhavenQueue } from "/script/core/apis/wallheaven.js";
import { getLocalData } from "/script/core/apis/local.js";
import { getSettings, saveSettings } from "/script/settings/utils/storagehandler.js";
import { toggleBgEditorVisibility } from "/script/settings/features/wallpaper/bgeditor.js";
import { updateRotationUI, stopRotationTimer, startRotationTimer, isRotationExpired } from "/script/settings/features/wallpaper/rotation.js";
import { applyOnloadAnimation } from "/script/settings/features/wallpaper/onloadanim.js";
import { showNotification } from "/script/settings/utils/UI.js";
import { t } from "/script/core/i18n.js";

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
// LOGIC CHO LOCAL API (LOCAL_IMAGE & LOCAL_VIDEO)
// ==========================================
class LocalProvider extends BackgroundProvider {
    constructor(uiElements, type) {
        super(uiElements);
        this.type = type; // 'image' hoặc 'video'
        this.providerId = `local_${type}`;
    }

    initUI() {
        const isVideo = this.type === "video";
        this.ui.APIName.innerText = t(isVideo ? "setting_panel.api_selector.local_video_option" : "setting_panel.api_selector.local_image_option");

        toggleConfigUIBlock("local", this.ui);

        const actionKey = isVideo ? "setting_panel.api_options.local.changeVideo" : "setting_panel.api_options.local.changeImage";
        this.ui.local_action_btn.setAttribute("data-i18n", actionKey);
        this.ui.local_action_btn.innerText = t(actionKey);
    }

    async fetch(refresh = true, firstRun = false) {
        this.clearError();
        setDisabled(true, this.ui.local_action_btn, this.ui.API_selector);
        setUILocked(true, false);

        try {
            const newData = await getLocalData(this.type, refresh, firstRun);

            if (!newData) {
                if (!firstRun) showNotification(t("alert.local_file_cancel"), "warning");
                return;
            }

            if (refresh) setUILocked(true, true);
            this.currentData = newData;
            await this.updateUI(newData, firstRun);
        } catch (error) {
            this.handleError(error);
        } finally {
            setDisabled(false, this.ui.local_action_btn, this.ui.API_selector);
            setUILocked(false);
        }
    }

    async updateUI(data, firstRun = false) {
        const isVideo = this.type === "video";
        if (!data || !data.blob) {
            this.ui.local_info_tooltip.innerText = t(
                isVideo ? "setting_panel.api_options.local.noVideoTooltip" : "setting_panel.api_options.local.noImageTooltip",
            );
            return;
        }
        const oldBlob = this.currentBlobUrl;
        let newBlobUrl = null;
        if (data && data.blob) newBlobUrl = URL.createObjectURL(data.blob);

        let payload = { type: isVideo ? "video" : "image", blobUrl: newBlobUrl, hideOld: oldBlob };
        await applyNewBackground(payload, firstRun);

        this.currentData = data;
        this.currentBlobUrl = newBlobUrl;

        if (isVideo) {
            this.ui.preview.src = data.thumbnail || "";
        } else if (newBlobUrl) {
            await this.updatePreviewImage(newBlobUrl);
        }
        const sizeMB = (data.blob.size / 1024 / 1024).toFixed(2);
        this.ui.local_info_tooltip.innerText = t("setting_panel.api_options.local.imageMetadata", { size: sizeMB, type: data.blob.type });
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

    initUI() {
        this.ui.APIName.innerText = t("setting_panel.api_selector.picre_option");
        toggleConfigUIBlock("picre", this.ui);
    }

    async fetch(refresh = false, firstRun = false) {
        this.clearError();
        const buttons = [this.ui.API_selector, this.ui.picre_changewall_btn, this.ui.picre_download_btn, this.ui.picre_source_btn];
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

                const meta = (d) => {
                    if (!d) return t("setting_panel.api_options.picre.noInfo");
                    const known_source_map = { pixiv: "Pixiv", twitter: "X (Twitter)", deviantart: "Deviant Art" };
                    let source_provider = "";
                    if (d.source) {
                        for (const key in known_source_map) {
                            if (d.source.includes(key)) {
                                source_provider = known_source_map[key];
                                break;
                            }
                        }
                    }
                    return t("setting_panel.api_options.picre.imageMetadata", {
                        width: d.width,
                        height: d.height,
                        size: (d.size / 1024 / 1024).toFixed(2),
                        source: source_provider || d.source,
                    });
                };
                this.ui.picre_info_tooltip.innerText = meta(data);
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
        this.ui.APIName.innerText = t("setting_panel.api_selector.wallhaven_option");
        toggleConfigUIBlock("wallhaven", this.ui);
    }

    async fetch(refresh = false, firstRun = false) {
        this.clearError();
        const buttons = [this.ui.API_selector, this.ui.wallhaven_changewall_btn, this.ui.wallhaven_download_btn, this.ui.wallhaven_source_btn];
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
        this.ui.wallhaven_info_tooltip.innerText = ""; // Xóa các tooltip cũ để tránh rối
        this.ui.overlay.style.opacity = 0;
        this.ui.preview.removeAttribute("src");
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
let lastFetchTime = 0;
const COOLDOWN_MS = 5000;

/**
 * Handles the visual countdown on the button and prevents double-clicking.
 * @param {HTMLButtonElement} btn 
 * @param {string} originalTextKey 
 */
function startBtnCooldown(btn, originalTextKey) {
    if (!btn) return;

    let remaining = COOLDOWN_MS / 1000;


    const updateText = () => {
        btn.innerText = `${t(originalTextKey)} (${remaining})`;
    };

    updateText();

    const interval = setInterval(() => {
        remaining--;
        btn.disabled = true;
        if (remaining <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.innerText = t(originalTextKey);
            return;
        }
        updateText();
    }, 1000);
}

function setUILocked(state, showLoadingBar = true) {
    if (state === true) {
        globalUI.wallpaperRotation.disabled = true;
        if (showLoadingBar) globalUI.loading.style.opacity = 1;
        globalUI.API_selector.disabled = true;
        globalUI.arrange_wallpaper.disabled = true;
    } else {
        globalUI.wallpaperRotation.disabled = false;
        globalUI.loading.style.opacity = 0;
        globalUI.API_selector.disabled = false;
        updateCustomizationUI(currentProvider?.providerId || "");
    }
}

async function applyNewBackground(payload, firstRun = false) {
    if (!firstRun) {
        globalUI.overlay.style.opacity = 1;
        await new Promise((resolve) => setTimeout(resolve, 400));
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
}

export function applyWallpaperFilters() {
    const config = getSettings().wallpaperConfig;
    const brightness = config.brightness ?? 1;
    const blur = config.blur ?? 0;
    const contrast = config.contrast ?? 1;
    const saturate = config.saturate ?? 1;
    const hue = config.hue ?? 0;

    const filterStr = `brightness(${brightness}) blur(${blur}px) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hue}deg)`;
    if (globalUI.bg) globalUI.bg.style.filter = filterStr;
    if (globalUI.video) globalUI.video.style.filter = filterStr;
}

function updateCustomizationUI(apiType) {
    const isVideo = apiType === "local_video";
    const isLocal = apiType.startsWith("local_");

    if (globalUI.arrange_wallpaper) globalUI.arrange_wallpaper.disabled = isVideo;
    if (globalUI.wavy_animation) {
        globalUI.wavy_animation.disabled = false;
        const parent = globalUI.wavy_animation.parentElement;
        parent.removeAttribute("disabled");
    }
    if (globalUI.edit_wavy_settings) globalUI.edit_wavy_settings.disabled = false;
    if (globalUI.edit_onload_settings) globalUI.edit_onload_settings.disabled = false;
    if (globalUI.rotation_block) globalUI.rotation_block.style.display = isLocal ? "none" : "block";
}

function toggleConfigUIBlock(apiType, ui) {
    const isShown = apiType && apiType !== "loading" && apiType !== "none";
    ui.apiConfigSection.style.display = isShown ? "block" : "none";

    ui.local_config_ui.style.display = apiType === "local" ? "flex" : "none";
    ui.picre_config_ui.style.display = apiType === "picre" ? "flex" : "none";
    ui.wallhaven_config_ui.style.display = apiType === "wallhaven" ? "flex" : "none";
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

        wh_query: document.getElementById("wh_query"),
        wh_cat_general: document.getElementById("wh_cat_general"),
        wh_cat_anime: document.getElementById("wh_cat_anime"),
        wh_cat_people: document.getElementById("wh_cat_people"),
        wh_resolution: document.getElementById("wh_resolution"),

        local_config_ui: document.getElementById("local_config_ui"),
        picre_config_ui: document.getElementById("picre_config_ui"),
        wallhaven_config_ui: document.getElementById("wallhaven_config_ui"),

        local_action_btn: document.getElementById("local_action_btn"),
        local_info_tooltip: document.getElementById("local_info_tooltip"),

        picre_changewall_btn: document.getElementById("picre_changewall"),
        picre_source_btn: document.getElementById("picre_source"),
        picre_download_btn: document.getElementById("picre_download"),
        picre_info_tooltip: document.getElementById("picre_info_tooltip"),

        wallhaven_changewall_btn: document.getElementById("wallhaven_changewall"),
        wallhaven_source_btn: document.getElementById("wallhaven_source"),
        wallhaven_download_btn: document.getElementById("wallhaven_download"),
        wallhaven_info_tooltip: document.getElementById("wallhaven_info_tooltip"),

        wavy_animation: document.getElementById("wavy_animation"),
        edit_wavy_settings: document.getElementById("edit_wavy_settings"),
        edit_onload_settings: document.getElementById("edit_onload_settings"),
    };

    const initialSettings = getSettings();
    rotationFrequency = initialSettings.wallpaperConfig?.rotation || 0;

    apiRegistry = {
        local_image: new LocalProvider(globalUI, "image"),
        local_video: new LocalProvider(globalUI, "video"),
        picre: new PicreProvider(globalUI),
        wallhaven: new WallhavenProvider(globalUI),
    };

    // Initialize values from settings
    applyWallpaperFilters();

    const setupEventListeners = () => {
        // Shared Action Listeners mapped to current provider
        globalUI.local_action_btn?.addEventListener("mousedown", () => currentProvider?.fetch(true));

        const changeWall = (btn, i18nKey) => {
            const now = Date.now();
            if (now - lastFetchTime < COOLDOWN_MS) return;

            lastFetchTime = now;
            startBtnCooldown(btn, i18nKey);
            currentProvider?.fetch(true);
        };

        const downloadWall = () => currentProvider?.download();
        const viewSrc = () => currentProvider?.viewSource();

        globalUI.picre_changewall_btn?.addEventListener("mousedown", () =>
            changeWall(globalUI.picre_changewall_btn, "setting_panel.api_options.picre.changeWallpaper"));

        globalUI.picre_download_btn?.addEventListener("mousedown", downloadWall);
        globalUI.picre_source_btn?.addEventListener("mousedown", viewSrc);

        globalUI.wallhaven_changewall_btn?.addEventListener("mousedown", () =>
            changeWall(globalUI.wallhaven_changewall_btn, "setting_panel.api_options.wallhaven.changeWallpaper"));
        globalUI.wallhaven_download_btn?.addEventListener("mousedown", downloadWall);
        globalUI.wallhaven_source_btn?.addEventListener("mousedown", viewSrc);

        // Brightness & Blur listeners (removed, moved to filter.js)
    };

    setupEventListeners();

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
            rotationFrequency = parseInt(value, 10);
            const current = getSettings().wallpaperConfig;
            saveSettings({ wallpaperConfig: { ...current, rotation: rotationFrequency } });
            if (currentProvider) {
                startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true));
            }
            return;
        }

        if (id === "API_selector") {
            const current = getSettings().wallpaperConfig;
            saveSettings({ wallpaperConfig: { ...current, source: value } });
        }

        // Handle API switching (Strategy/Polymorphism in action)
        if (apiRegistry[value] && (!currentProvider || currentProvider.providerId !== value)) {
            if (isTransitioning) return;

            stopRotationTimer();
            isTransitioning = true;

            toggleBgEditorVisibility(true);

            currentProvider = apiRegistry[value];
            updateRotationUI(currentProvider.providerId, globalUI.wallpaperRotation);
            updateCustomizationUI(value);

            // Tách biệt hoàn toàn: Hiện UI trước (sync)
            currentProvider.initUI();

            // Sau đó mới tính toán việc tải dữ liệu (async)
            const settings = getSettings();
            const freq = settings.wallpaperConfig?.rotation || 0;
            const isLocal = value === "local_image" || value === "local_video";

            let fetchRefresh = false;
            if (firstRun && !isLocal) {
                fetchRefresh = await isRotationExpired(value, freq);
            }

            await currentProvider.fetch(fetchRefresh, firstRun);

            if (value !== "local_image" && value !== "local_video") {
                startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true, false));
            }

            if (firstRun) {
                updateCustomizationUI(value);
            }
            isTransitioning = false;
        }
    });
}
