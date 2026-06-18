import { t } from "/script/core/i18n.js";
import { openCustomPopup, showNotification } from "/script/core/UI.js";
import {
    getCollection,
    addToCollection,
    removeFromCollection,
    generateImageThumbnail,
    generateVideoThumbnail,
    getImageDimensions,
} from "/script/settings/wallpaper/bgcollection.js";
import { getCurrentProviderData, applyCollectionItem } from "/script/settings/wallpaper/bgapi.js";

// Map to track active thumbnail blob URLs so they can be revoked on cleanup
const activeThumbnailUrls = new Set();

/**
 * Initialize all event listeners related to the Collection UI:
 * - The "Bộ sưu tập" trigger button in the wallpaper sidebar
 * - The "Thêm vào bộ sưu tập" buttons in wallhaven/picre config blocks
 */
export function initCollectionUI() {
    // Main trigger button
    document.getElementById("open_collection_btn")?.addEventListener("mousedown", openCollectionPopup);

    // "Add to collection" buttons inside existing API config blocks
    document.getElementById("wallhaven_add_to_collection")?.addEventListener("mousedown", () => addCurrentWallpaperToCollection());
    document.getElementById("picre_add_to_collection")?.addEventListener("mousedown", () => addCurrentWallpaperToCollection());
}

// ==========================================
// ADD CURRENT WALLPAPER
// ==========================================

/**
 * Add the currently displayed wallpaper (from the active API provider) to the collection.
 */
async function addCurrentWallpaperToCollection() {
    const data = getCurrentProviderData();
    if (!data?.blob) {
        showNotification(t("setting_panel.api_options.collection.no_wallpaper_to_add", "Không có hình nền nào để thêm"), "warning");
        return;
    }

    // Disable all add buttons temporarily to prevent duplicates
    const addBtns = [document.getElementById("wallhaven_add_to_collection"), document.getElementById("picre_add_to_collection")].filter(Boolean);
    addBtns.forEach((b) => (b.disabled = true));

    try {
        const isVideo = data.blob.type.startsWith("video/");
        const thumbnail = isVideo ? await generateVideoThumbnail(data.blob) : await generateImageThumbnail(data.blob);

        await addToCollection({
            type: data.providerId || "unknown",
            blob: data.blob,
            thumbnail,
            metadata: {
                width: data.width || 0,
                height: data.height || 0,
                size: data.blob.size,
                source: data.source || "",
                mimeType: data.blob.type,
            },
        });

        showNotification(t("setting_panel.api_options.collection.added_to_collection", "Đã thêm vào bộ sưu tập!"), "success");
    } catch (err) {
        console.error("[Collection] Error adding current wallpaper:", err);
        showNotification(t("setting_panel.api_options.collection.add_error", "Lỗi khi thêm vào bộ sưu tập"), "error");
    } finally {
        addBtns.forEach((b) => (b.disabled = false));
    }
}

// ==========================================
// POPUP
// ==========================================

async function openCollectionPopup() {
    const tpl = document.getElementById("bg_collection_popup_tpl");
    if (!tpl) {
        console.error("[Collection] Template #bg_collection_popup_tpl not found");
        return;
    }

    // Clone template content into a wrapper div
    const content = tpl.content.cloneNode(true);
    const wrapper = document.createElement("div");
    wrapper.appendChild(content);

    // Query all interactive elements within the cloned content
    const uploadBtn = wrapper.querySelector("#coll_upload_btn");
    const fileInput = wrapper.querySelector("#coll_file_input");
    const addCurrentBtn = wrapper.querySelector("#coll_add_current_btn");
    const grid = wrapper.querySelector("#coll_grid");
    const emptyState = wrapper.querySelector("#coll_empty_state");

    // Localize static texts
    const uploadSpan = wrapper.querySelector("#coll_upload_btn span");
    if (uploadSpan) uploadSpan.textContent = t("setting_panel.api_options.collection.upload_btn", "Tải lên ảnh / video");
    
    const emptyTitle = wrapper.querySelector("#coll_empty_state p");
    if (emptyTitle) emptyTitle.textContent = t("setting_panel.api_options.collection.empty_title", "Bộ sưu tập trống");
    
    const emptyDesc = wrapper.querySelector("#coll_empty_state span");
    if (emptyDesc) emptyDesc.textContent = t("setting_panel.api_options.collection.empty_desc", "Tải lên ảnh/video hoặc thêm hình nền đang hiển thị");

    // Load and render initial collection
    const items = await getCollection();
    renderGrid(items, grid, emptyState);

    // ── Upload handler ──────────────────────────────────
    uploadBtn.addEventListener("mousedown", () => fileInput.click());

    fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        uploadBtn.disabled = true;
        uploadBtn.querySelector("span").textContent = t("setting_panel.api_options.collection.processing", "Đang xử lý...");

        let successCount = 0;

        for (const file of files) {
            try {
                const isVideo = file.type.startsWith("video/");
                const thumbnail = isVideo ? await generateVideoThumbnail(file) : await generateImageThumbnail(file);

                let width = 0,
                    height = 0;
                if (!isVideo) {
                    ({ width, height } = await getImageDimensions(file));
                }

                await addToCollection({
                    type: isVideo ? "local_video" : "local_image",
                    blob: file,
                    thumbnail,
                    metadata: {
                        width,
                        height,
                        size: file.size,
                        source: "local",
                        mimeType: file.type,
                    },
                });
                successCount++;
            } catch (err) {
                console.error(`[Collection] Failed to process file "${file.name}":`, err);
                showNotification(t("setting_panel.api_options.collection.upload_error", { file: file.name }, `Lỗi khi xử lý: ${file.name}`), "error");
            }
        }

        fileInput.value = ""; // reset input so same file can be re-uploaded
        uploadBtn.disabled = false;
        uploadBtn.querySelector("span").textContent = t("setting_panel.api_options.collection.upload_btn", "Tải lên ảnh / video");

        if (successCount > 0) {
            const updated = await getCollection();
            renderGrid(updated, grid, emptyState);
            showNotification(t("setting_panel.api_options.collection.upload_success", { count: successCount }, `Đã tải lên ${successCount} file thành công`), "success");
        }
    });

    openCustomPopup(t("setting_panel.api_options.collection.collection_title", "Bộ sưu tập hình nền"), wrapper, "800px", {
        id: "bg_collection_popup",
        isAlert: true,
        canClose: true,
    });
}

// ==========================================
// GRID RENDERING
// ==========================================

async function renderGrid(items, grid, emptyState) {
    // Revoke all previous thumbnail blob URLs to prevent memory leaks
    activeThumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    activeThumbnailUrls.clear();

    grid.innerHTML = "";

    if (!items || items.length === 0) {
        emptyState.style.display = "flex";
        grid.style.display = "none";
        return;
    }

    emptyState.style.display = "none";
    grid.style.display = "grid";

    const { getSettings } = await import("/script/core/storagehandler.js");
    const activeId = getSettings().wallpaperConfig?.activeCollectionItemId;

    items.forEach((item) => {
        const card = createCard(item, grid, emptyState, activeId);
        grid.appendChild(card);
    });
}

function createCard(item, grid, emptyState, activeId) {
    const isVideo = item.blob?.type?.startsWith("video/") || item.type === "local_video";

    const card = document.createElement("div");
    card.className = "bg_coll_card";
    card.dataset.id = item.id;

    // ── Thumbnail ──────────────────────────────────────
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "bg_coll_thumb_wrapper";

    const thumbImg = document.createElement("img");
    thumbImg.className = "bg_coll_thumb";
    thumbImg.alt = "";
    thumbImg.loading = "lazy";

    if (item.thumbnail) {
        const url = URL.createObjectURL(item.thumbnail);
        activeThumbnailUrls.add(url);
        thumbImg.src = url;
    } else if (!isVideo && item.blob) {
        // Fallback: use blob directly for small images
        const url = URL.createObjectURL(item.blob);
        activeThumbnailUrls.add(url);
        thumbImg.src = url;
    }

    // ── Actions overlay ────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "bg_coll_card_actions";

    const setBtn = document.createElement("button");
    setBtn.className = "bg_coll_set_btn";
    setBtn.textContent =
        item.id === activeId
            ? t("setting_panel.api_options.collection.currentWallpaper", "Đã đặt")
            : t("setting_panel.api_options.collection.setWallpaper", "Đặt làm nền");
    if (item.id === activeId) setBtn.disabled = true;

    setBtn.addEventListener("mousedown", async (e) => {
        e.stopPropagation();
        if (card.classList.contains("bg_coll_card_active")) return;

        const originalText = setBtn.textContent;
        setBtn.disabled = true;
        setBtn.textContent = t("setting_panel.api_options.collection.processing", "Đang xử lý...");

        try {
            await applyCollectionItem(item);

            // Reset old active buttons
            grid.querySelectorAll(".bg_coll_card_active").forEach((c) => {
                c.classList.remove("bg_coll_card_active");
                const oldBtn = c.querySelector(".bg_coll_set_btn");
                if (oldBtn) {
                    oldBtn.disabled = false;
                    oldBtn.textContent = t("setting_panel.api_options.collection.setWallpaper", "Đặt làm nền");
                }
            });

            // Set new active state
            card.classList.add("bg_coll_card_active");
            setBtn.textContent = t("setting_panel.api_options.collection.currentWallpaper", "Đã đặt");
            // keep it disabled
        } catch (err) {
            setBtn.disabled = false;
            setBtn.textContent = originalText;
            showNotification(t("setting_panel.api_options.collection.apply_error", "Lỗi khi áp dụng hình nền"), "error");
        }
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "bg_coll_remove_btn";
    removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>`;
    removeBtn.addEventListener("mousedown", async (e) => {
        e.stopPropagation();

        const dialogContent = document.createElement("div");
        dialogContent.className = "popup_body";
        dialogContent.innerHTML = `
            <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">${t("alert.delete_collection_msg", "Bạn có chắc chắn muốn xóa hình nền này khỏi bộ sưu tập không?")}</p>
            <div class="actions" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="confirm_cancel_btn" class="secondary_btn">${t("alert.confirm_cancel", "Hủy")}</button>
                <button id="confirm_ok_btn" style="background: rgba(255, 60, 60, 0.2); border-color: rgba(255, 60, 60, 0.3); color: #ffa0a0;">${t("alert.delete_confirm_btn", "Xóa")}</button>
            </div>
        `;

        const popup = openCustomPopup(t("alert.delete_collection_title", "Xác nhận xóa"), dialogContent, "400px", { isAlert: true, canClose: false });

        dialogContent.querySelector("#confirm_cancel_btn").onmousedown = () => popup.closePopup();
        dialogContent.querySelector("#confirm_ok_btn").onmousedown = () => {
            popup.closePopup();

            card.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            card.style.opacity = "0";
            card.style.transform = "scale(0.9)";

            setTimeout(async () => {
                const remaining = await removeFromCollection(item.id);
                if (card.classList.contains("bg_coll_card_active") && remaining.length > 0) {
                    // Fallback to first image if active is deleted
                    await applyCollectionItem(remaining[0]);
                }
                renderGrid(remaining, grid, emptyState);
            }, 200);
        };
    });

    const actionRow = document.createElement("div");
    actionRow.className = "bg_coll_action_row";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "bg_coll_download_btn";
    downloadBtn.title = t("setting_panel.api_options.collection.downloadTooltip", "Tải về");
    downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"></path></svg>`;
    downloadBtn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        if (item.blob) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(item.blob);
            a.download = `wallpaper_${item.id}.jpg`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } else {
            showNotification(t("setting_panel.api_options.collection.download_error", "Không tìm thấy dữ liệu ảnh để tải"), "error");
        }
    });

    const sourceBtn = document.createElement("button");
    sourceBtn.className = "bg_coll_source_btn";
    sourceBtn.title = t("setting_panel.api_options.collection.sourceTooltip", "Xem nguồn");
    sourceBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,90.34a8,8,0,0,1,0,11.32l-64,64a8,8,0,0,1-11.32-11.32l64-64A8,8,0,0,1,165.66,90.34ZM215.6,40.4a56,56,0,0,0-79.2,0L106.34,70.45a8,8,0,0,0,11.32,11.32l30.06-30a40,40,0,0,1,56.57,56.56l-30.07,30.06a8,8,0,0,0,11.31,11.32L215.6,119.6a56,56,0,0,0,0-79.2ZM138.34,174.22l-30.06,30.06a40,40,0,1,1-56.56-56.57l30.05-30.05a8,8,0,0,0-11.32-11.32L40.4,136.4a56,56,0,0,0,79.2,79.2l30.06-30.07a8,8,0,0,0-11.32-11.31Z"></path></svg>`;
    if (item.metadata?.source) {
        sourceBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            window.open(item.metadata.source, "_blank");
        });
    } else {
        sourceBtn.disabled = true;
    }

    actionRow.append(downloadBtn, sourceBtn, removeBtn);
    actions.append(setBtn, actionRow);

    if (item.id === activeId) {
        card.classList.add("bg_coll_card_active");
    }

    // ── Info bar ───────────────────────────────────────
    const info = document.createElement("div");
    info.className = "bg_coll_info";

    const typeKey = isVideo ? "typeVideo" : "typeImage";
    const mediaType = t(`setting_panel.api_options.collection.${typeKey}`);

    const srcVal =
        item.metadata?.source === "local"
            ? t("setting_panel.api_options.collection.sourceLocal")
            : item.type || item.metadata?.source || t("setting_panel.api_options.collection.sourceUnknown");

    const sizeMB = item.metadata?.size ? (item.metadata.size / 1024 / 1024).toFixed(1) + " MB" : "";
    const res = item.metadata?.width && item.metadata?.height ? `${item.metadata.width}x${item.metadata.height}` : "";

    const metaText = [sizeMB, res].filter(Boolean).join(" | ");
    info.innerHTML = `
        <span class="bg_coll_info_src">${mediaType} | ${srcVal}</span>
        <span style="flex-grow:1"></span>
        <span class="bg_coll_info_meta">${metaText}</span>
    `;

    thumbWrapper.append(thumbImg, actions);
    card.append(thumbWrapper, info);
    return card;
}
