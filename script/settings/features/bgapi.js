import { getPicreData } from "../../core/apis/picre.js";
import { getWallhavenData, clearWallhavenQueue } from "../../core/apis/wallheaven.js";
import { getLocalData } from "../../core/apis/local.js";
import { getSettings, saveSettings } from "../utils/storagehandler.js";
import { toggleBgEditorVisibility } from "./bgeditor.js";
import { updateRotationUI, stopRotationTimer, startRotationTimer } from "./rotation.js";
import { applyOnloadAnimation } from "./onloadanim.js";
import { showNotification } from "../utils/UI.js";
import { t } from "../../core/i18n.js";

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
    async activate(firstRun) {
        throw new Error("activate() must be implemented by subclass");
    }
    async fetch(refresh) {
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

        // Chuẩn hóa message: Nếu là Timeout thì lấy key timeout, còn lại dùng lỗi mặc định của provider hoặc message error truyền vào
        let displayMsg = error.message;
        if (displayMsg === "Timeout") {
            displayMsg = t("setting_panel.api_options.error_timeout");
        } else if (displayMsg === "default" || !displayMsg) {
            displayMsg = t("setting_panel.api_options.error", { provider: this.providerId });
        }

        // Hiển thị ra Notification
        showNotification(`${this.providerId}: ${displayMsg}`, "error");

        // Hiển thị ra Tooltip trung tâm của Setting Section
        if (this.ui.api_error_tooltip) {
            this.ui.api_error_tooltip.innerText = `${this.providerId}: ${displayMsg}`;
            this.ui.api_error_tooltip.style.display = "block";
        }

        toggleLoadingUI(false);
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
        a.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        URL.revokeObjectURL(url);
    }

    viewSource() {
        if (this.currentData?.source) window.open(this.currentData.source);
    }

    async renderImageToDOM(blobUrl) {
        let tempImg = new Image();
        tempImg.src = blobUrl;
        try {
            await tempImg.decode();
            this.ui.bg.style.backgroundImage = `url(${blobUrl})`;
            this.ui.preview.src = blobUrl;
        } catch (e) {
            this.ui.bg.style.backgroundImage = `url(${blobUrl})`;
            this.ui.preview.src = blobUrl;
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

    async activate(firstRun = false) {
        const isVideo = this.type === "video";
        this.ui.APIName.innerText = t(isVideo ? "setting_panel.api_selector.local_video_option" : "setting_panel.api_selector.local_image_option");

        toggleLoadingUI(true);
        toggleConfigUIBlock("local", this.ui);
        this.ui.video.style.display = isVideo ? "block" : "none";

        const actionKey = isVideo ? "setting_panel.api_options.local.changeVideo" : "setting_panel.api_options.local.changeImage";
        this.ui.local_action_btn.setAttribute("data-i18n", actionKey);
        this.ui.local_action_btn.innerText = t(actionKey);

        const initialData = await getLocalData(this.type, false, firstRun);
        this.currentData = initialData;

        // If switching but no file exists in storage, notify user
        if (!initialData && !firstRun) {
            showNotification(t("alert.local_file_cancel"), "warning");
        }

        await this.updateUI(initialData);
        toggleLoadingUI(false);
    }

    async fetch(refresh = true) {
        this.clearError();
        this.cleanup();
        toggleLoadingUI(true);
        setDisabled(true, this.ui.local_action_btn, this.ui.API_selector);

        try {
            // getLocalData now returns null if the user cancels the picker.
            const newData = await getLocalData(this.type, true);

            if (!newData) {
                showNotification(t("alert.local_file_cancel"), "warning");
                return;
            }

            this.currentData = newData;
            await this.activate(false);
        } catch (error) {
            this.handleError(error);
        } finally {
            setDisabled(false, this.ui.local_action_btn, this.ui.API_selector);
            toggleLoadingUI(false);
        }
    }

    async updateUI(data) {
        const isVideo = this.type === "video";
        if (!data || !data.blob) {
            this.ui.local_info_tooltip.innerText = t(
                isVideo ? "setting_panel.api_options.local.noVideoTooltip" : "setting_panel.api_options.local.noImageTooltip",
            );
            return;
        }
        this.cleanup();
        this.currentBlobUrl = URL.createObjectURL(data.blob);

        if (isVideo) {
            this.ui.preview.src = data.thumbnail || "";
            this.ui.video.src = this.currentBlobUrl;
            this.ui.video.play();
        } else {
            await this.renderImageToDOM(this.currentBlobUrl);
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

    async activate(firstRun = false) {
        this.ui.APIName.innerText = t("setting_panel.api_selector.picre_option");
        toggleConfigUIBlock("picre", this.ui);
        await this.fetch();
    }

    async fetch(refresh = false) {
        this.clearError();
        const buttons = [this.ui.API_selector, this.ui.picre_changewall_btn, this.ui.picre_download_btn, this.ui.picre_source_btn];
        toggleLoadingUI(true);
        setDisabled(true, ...buttons);

        try {
            const [data] = await Promise.all([withTimeout(getPicreData(refresh)), new Promise((resolve) => setTimeout(resolve, 300))]);

            if (!data || !data.blob) throw new Error("default");

            this.cleanup();
            this.currentData = data;

            if (data?.blob) {
                this.currentBlobUrl = URL.createObjectURL(data.blob);
                await this.renderImageToDOM(this.currentBlobUrl);

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
            toggleLoadingUI(false);
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

    async activate(firstRun = false) {
        this.ui.APIName.innerText = t("setting_panel.api_selector.wallhaven_option");
        toggleConfigUIBlock("wallhaven", this.ui);
        await this.fetch();
    }

    async fetch(refresh = false) {
        this.clearError();
        const buttons = [this.ui.API_selector, this.ui.wallhaven_changewall_btn, this.ui.wallhaven_download_btn, this.ui.wallhaven_source_btn];
        toggleLoadingUI(true);
        setDisabled(true, ...buttons);

        try {
            const [data] = await Promise.all([withTimeout(getWallhavenData(refresh)), new Promise((resolve) => setTimeout(resolve, 300))]);

            if (data?.error) throw new Error(data.error);
            if (!data || !data.blob) throw new Error(t("setting_panel.api_options.wallhaven.no_result"));

            this.cleanup();
            this.currentData = data;

            if (data?.blob) {
                this.currentBlobUrl = URL.createObjectURL(data.blob);
                await this.renderImageToDOM(this.currentBlobUrl);
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
            toggleLoadingUI(false);
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
// LOGIC CHO COLOR (Màu đơn sắc & Gradient)
// ==========================================
class SolidColorProvider extends BackgroundProvider {
    constructor(uiElements) {
        super(uiElements);
        this.providerId = "solid";
        this.initColorSettings();
    }

    initColorSettings() {
        const settings = getSettings();
        const color1 = settings.solidColor || "#0c0c0c";
        const color2 = settings.solidColor2 || "#1a1a1a";
        const angle = settings.colorAngle || 135;

        // Setup UI values
        if (this.ui.solid_color_input) {
            this.ui.solid_color_input.value = color1;
            this.ui.solid_color_preview.style.backgroundColor = color1;
        }
        if (this.ui.solid_color2_input) {
            this.ui.solid_color2_input.value = color2;
            this.ui.solid_color2_preview.style.backgroundColor = color2;
        }
        if (this.ui.solid_angle_input) {
            this.ui.solid_angle_input.value = angle;
            if (this.ui.solid_angle_display) this.ui.solid_angle_display.innerText = `${angle}°`;
        }

        const updatePreview = () => {
            const c1 = this.ui.solid_color_input.value;
            const c2 = this.ui.solid_color2_input.value;
            const deg = parseInt(this.ui.solid_angle_input.value);
            const t = getSettings().colorType || "solid";

            this.ui.solid_color_preview.style.backgroundColor = c1;
            this.ui.solid_color2_preview.style.backgroundColor = c2;
            if (this.ui.solid_angle_display) this.ui.solid_angle_display.innerText = `${deg}°`;

            this.ui.solid_color2_row.style.display = t === "gradient" ? "flex" : "none";
            this.ui.solid_angle_row.style.display = t === "gradient" ? "flex" : "none";

            saveSettings({ solidColor: c1, solidColor2: c2, colorAngle: deg });
            this.applyColor(c1, c2, t, deg);
        };

        this.ui.solid_color_input?.addEventListener("input", updatePreview);
        this.ui.solid_color2_input?.addEventListener("input", updatePreview);
        this.ui.solid_angle_input?.addEventListener("input", updatePreview);

        // Activation color picker trigger
        const setupPicker = (input) => {
            input?.parentElement?.parentElement?.addEventListener("mousedown", (e) => {
                if (e.target !== input) input?.click();
            });
        };
        setupPicker(this.ui.solid_color_input);
        setupPicker(this.ui.solid_color2_input);
    }

    applyColor(color1, color2, type, angle = 135) {
        this.ui.bg.style.backgroundColor = "";
        if (type === "gradient") {
            const grad = `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
            this.ui.bg.style.backgroundImage = grad;
        } else {
            this.ui.bg.style.backgroundImage = "none";
            this.ui.bg.style.backgroundColor = color1;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext("2d");
        if (type === "gradient") {
            const rad = (angle - 90) * Math.PI / 180;
            const x2 = 80 + 80 * Math.cos(rad);
            const y2 = 45 + 45 * Math.sin(rad);
            const x1 = 80 - 80 * Math.cos(rad);
            const y1 = 45 - 45 * Math.sin(rad);

            const grd = ctx.createLinearGradient(x1, y1, x2, y2);
            grd.addColorStop(0, color1);
            grd.addColorStop(1, color2);
            ctx.fillStyle = grd;
        } else {
            ctx.fillStyle = color1;
        }
        ctx.fillRect(0, 0, 160, 90);
        this.ui.preview.src = canvas.toDataURL();
    }

    async activate(firstRun = false) {
        this.ui.APIName.innerText = t("setting_panel.api_selector.solid_option");
        toggleConfigUIBlock("solid", this.ui);
        const settings = getSettings();
        const color1 = settings.solidColor || "#0c0c0c";
        const color2 = settings.solidColor2 || "#1a1a1a";
        const type = settings.colorType || "solid";
        const angle = settings.colorAngle || 135;

        this.ui.solid_color2_row.style.display = type === "gradient" ? "flex" : "none";
        this.ui.solid_angle_row.style.display = type === "gradient" ? "flex" : "none";

        this.applyColor(color1, color2, type, angle);
        toggleLoadingUI(false);
    }

    async fetch(refresh = false) {
        // No fetch needed
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

function toggleLoadingUI(state) {
    if (state === true) {
        globalUI.wallpaperRotation.disabled = true;
        globalUI.preview.style.opacity = 0;
        globalUI.overlay.style.opacity = 1;
        globalUI.loading.style.opacity = 1;
        globalUI.API_selector.disabled = true;
        globalUI.arrange_wallpaper.disabled = true;
    } else {
        globalUI.wallpaperRotation.disabled = false;
        globalUI.preview.style.opacity = 1;
        globalUI.overlay.style.opacity = 0;
        globalUI.loading.style.opacity = 0;
        globalUI.API_selector.disabled = false;
        updateCustomizationUI(currentProvider?.providerId || "");
    }
}

function updateCustomizationUI(apiType) {
    const isSolid = apiType === "solid";
    const isVideo = apiType === "local_video";

    if (globalUI.arrange_wallpaper) globalUI.arrange_wallpaper.disabled = isSolid;
    if (globalUI.wavy_animation) {
        const state = isSolid || isVideo;
        globalUI.wavy_animation.disabled = state;
        const parent = globalUI.wavy_animation.parentElement;
        if (state) parent.setAttribute("disabled", "");
        else parent.removeAttribute("disabled");
    }
    if (globalUI.edit_wavy_settings) globalUI.edit_wavy_settings.disabled = isSolid || isVideo;
    if (globalUI.edit_onload_settings) globalUI.edit_onload_settings.disabled = isSolid;
}

function toggleConfigUIBlock(apiType, ui) {
    const isShown = apiType && apiType !== "loading" && apiType !== "none";
    ui.apiConfigSection.style.display = isShown ? "block" : "none";

    ui.local_config_ui.style.display = apiType === "local" ? "flex" : "none";
    ui.picre_config_ui.style.display = apiType === "picre" ? "flex" : "none";
    ui.wallhaven_config_ui.style.display = apiType === "wallhaven" ? "flex" : "none";
    ui.solid_config_ui.style.display = apiType === "solid" ? "flex" : "none";
}

let imageLoadingTimeout = null;
async function performTransitionFade(newApiType, firstRun = false) {
    if (imageLoadingTimeout) clearTimeout(imageLoadingTimeout);

    if (globalUI.rotation_block) {
        const isLocal = newApiType.startsWith("local_");
        const isSolid = newApiType === "solid";
        globalUI.rotation_block.style.display = (isLocal || isSolid) ? "none" : "block";
    }

    if (firstRun) {
        if (currentProvider) currentProvider.cleanup();
        if (newApiType !== "local_video") {
            globalUI.video.style.display = "none";
            globalUI.video.pause();
        }
        toggleLoadingUI(false);
        return;
    }

    toggleLoadingUI(true);
    toggleConfigUIBlock("loading", globalUI);

    await new Promise((resolve) => {
        imageLoadingTimeout = setTimeout(() => {
            if (currentProvider) currentProvider.cleanup();
            if (newApiType === "local_video" && globalUI.video.paused) {
                globalUI.video.style.display = "block";
            } else {
                globalUI.video.style.display = "none";
                globalUI.video.pause();
            }
            toggleLoadingUI(false);
            resolve();
        }, 600);
    });
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

        solid_config_ui: document.getElementById("solid_config_ui"),
        solid_color_input: document.getElementById("solid_color_input"),
        solid_color_preview: document.getElementById("solid_color_preview"),
        solid_color2_row: document.getElementById("solid_color2_row"),
        solid_color2_input: document.getElementById("solid_color2_input"),
        solid_color2_preview: document.getElementById("solid_color2_preview"),
        solid_type_selector: document.getElementById("solid_type_selector"),
        solid_angle_row: document.getElementById("solid_angle_row"),
        solid_angle_input: document.getElementById("solid_angle_input"),
        solid_angle_display: document.getElementById("solid_angle_display"),

        wavy_animation: document.getElementById("wavy_animation"),
        edit_wavy_settings: document.getElementById("edit_wavy_settings"),
        edit_onload_settings: document.getElementById("edit_onload_settings"),
    };

    // If initial source is solid, make overlay transparent immediately to avoid black flash
    const initialSettings = getSettings();
    if (initialSettings.wallpaperConfig?.source === "solid") {
        globalUI.overlay.style.backgroundColor = "transparent";
    }

    apiRegistry = {
        local_image: new LocalProvider(globalUI, "image"),
        local_video: new LocalProvider(globalUI, "video"),
        solid: new SolidColorProvider(globalUI),
        picre: new PicreProvider(globalUI),
        wallhaven: new WallhavenProvider(globalUI),
    };

    const setupEventListeners = () => {
        // Shared Action Listeners mapped to current provider
        globalUI.local_action_btn?.addEventListener("mousedown", () => currentProvider?.fetch(true));

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
            // Set overlay background color based on source
            if (value === "solid") {
                globalUI.overlay.style.backgroundColor = "transparent";
            } else {
                globalUI.overlay.style.backgroundColor = "";
            }
        }

        if (id === "solid_type_selector") {
            saveSettings({ colorType: value });
            if (currentProvider && currentProvider.providerId === "solid") {
                currentProvider.activate();
            }
        }

        // Handle API switching (Strategy/Polymorphism in action)
        if (apiRegistry[value] && (!currentProvider || currentProvider.providerId !== value)) {
            if (isTransitioning) return;

            stopRotationTimer();
            isTransitioning = true;

            toggleBgEditorVisibility(value !== "local_video");

            await performTransitionFade(value, firstRun);
            currentProvider = apiRegistry[value];
            updateRotationUI(currentProvider.providerId, globalUI.wallpaperRotation);
            updateCustomizationUI(value);

            await currentProvider.activate(firstRun);

            if (value !== "local_image" && value !== "local_video") {
                startRotationTimer(currentProvider.providerId, rotationFrequency, () => currentProvider.fetch(true));
            }

            if (firstRun) {
                applyOnloadAnimation();
                updateCustomizationUI(value);
            }
            isTransitioning = false;
        }
    });
}
