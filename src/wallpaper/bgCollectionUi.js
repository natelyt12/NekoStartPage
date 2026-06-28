import { t } from "/src/core/i18n.js";
import { openCustomPopup, showNotification } from "/src/core/ui.js";
import { Icons } from "/src/core/icon.js";
import {
    getCollection,
    addToCollection,
    removeFromCollection,
    removeMultipleFromCollection,
    generateImageThumbnail,
    generateVideoThumbnail,
    getImageDimensions,
} from "/src/wallpaper/bgCollection.js";
import { getCurrentProviderData, applyCollectionItem } from "/src/wallpaper/bgApi.js";

// Map to track active thumbnail blob URLs so they can be revoked on cleanup
const activeThumbnailUrls = new Set();

let isSelectMode = false;
let selectedItemIds = new Set();
let bulkDeleteBtnRef = null;
let uploadBtnRef = null;
let popupSectionRef = null;
let activePopupObj = null;

function updateBulkDeleteBtn() {
    if (!bulkDeleteBtnRef) return;
    if (isSelectMode) {
        bulkDeleteBtnRef.style.display = "flex";
        bulkDeleteBtnRef.disabled = selectedItemIds.size === 0;
        const span = bulkDeleteBtnRef.querySelector("span");
        if(span) {
            if (selectedItemIds.size > 0) {
                span.textContent = t("setting_panel.api_options.collection.delete_selected_count", {count: selectedItemIds.size}, `Xóa ${selectedItemIds.size} mục`);
            } else {
                span.textContent = t("setting_panel.api_options.collection.delete_selected", "Xóa mục đã chọn");
            }
        }
    } else {
        bulkDeleteBtnRef.style.display = "none";
    }
}

async function animateGridReflow(gridElement, asyncCallback, containerEl = null) {
    // FLIP - First: record positions before any DOM changes
    const oldPositions = new Map();
    Array.from(gridElement.children).forEach(child => {
        const id = child.dataset.id;
        if (id) oldPositions.set(id, child.getBoundingClientRect());
    });

    // FLIP - Last: await the async DOM update so all cards are in the DOM
    await asyncCallback();

    // FLIP - Invert + Play
    Array.from(gridElement.children).forEach(child => {
        const id = child.dataset.id;
        if (id && oldPositions.has(id)) {
            const oldPos = oldPositions.get(id);
            const newPos = child.getBoundingClientRect();
            const dx = oldPos.left - newPos.left;
            const dy = oldPos.top - newPos.top;
            if (dx !== 0 || dy !== 0) {
                child.style.transition = "none";
                child.style.transform = `translate(${dx}px, ${dy}px)`;
                // First rAF: let browser paint the displaced frame
                requestAnimationFrame(() => {
                    // Second rAF: animate to final position
                    requestAnimationFrame(() => {
                        child.style.transition = "transform 0.35s cubic-bezier(0.2, 0, 0, 1)";
                        child.style.transform = "";
                        setTimeout(() => { child.style.transition = ""; }, 350);
                    });
                });
            }
        }
    });
}

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
    document.getElementById("reddit_add_to_collection")?.addEventListener("mousedown", () => addCurrentWallpaperToCollection());
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
    const addBtns = [
        document.getElementById("wallhaven_add_to_collection"), 
        document.getElementById("picre_add_to_collection"),
        document.getElementById("reddit_add_to_collection")
    ].filter(Boolean);
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
                url: data.image || "",
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

export async function openCollectionPopup() {
    const tpl = document.getElementById("bg_collection_popup_tpl");
    if (!tpl) {
        console.error("[Collection] Template #bg_collection_popup_tpl not found");
        return;
    }

    // Clone template content into a wrapper div
    const content = tpl.content.cloneNode(true);
    const wrapper = document.createElement("div");
    wrapper.appendChild(content);

    // Query all interactive elements within    // Upload UI setup
    const uploadBtn = wrapper.querySelector("#coll_upload_btn");
    uploadBtnRef = uploadBtn;
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

    // Bulk Delete UI setup
    isSelectMode = false;
    selectedItemIds.clear();

    const selectModeBtn = wrapper.querySelector("#coll_select_mode_btn");
    const bulkDeleteBtn = wrapper.querySelector("#coll_bulk_delete_btn");
    bulkDeleteBtnRef = bulkDeleteBtn;

    if (selectModeBtn && bulkDeleteBtn) {
        const selectSpan = selectModeBtn.querySelector("span");
        
        selectModeBtn.addEventListener("mousedown", () => {
            isSelectMode = !isSelectMode;
            if (isSelectMode) {
                selectSpan.textContent = t("setting_panel.api_options.collection.cancel_select_mode", "Hủy chọn");
                grid.classList.add("bg_coll_select_mode");
                if (uploadBtnRef) uploadBtnRef.style.display = "none";
                updateBulkDeleteBtn();
            } else {
                selectSpan.textContent = t("setting_panel.api_options.collection.select_mode", "Chọn nhiều");
                grid.classList.remove("bg_coll_select_mode");
                selectedItemIds.clear();
                if (uploadBtnRef) uploadBtnRef.style.display = "flex";
                updateBulkDeleteBtn();
                grid.querySelectorAll(".bg_coll_card_selected").forEach(c => c.classList.remove("bg_coll_card_selected"));
            }
        });

        bulkDeleteBtn.addEventListener("mousedown", () => {
            if (selectedItemIds.size === 0) return;

            const dialogContent = document.createElement("div");
            dialogContent.className = "popup_body";
            dialogContent.innerHTML = `
                <p style="margin: 0px 4px; opacity: 0.8; line-height: 1.5;">${t("setting_panel.api_options.collection.bulk_delete_confirm_msg", {count: selectedItemIds.size}, "Bạn có chắc chắn muốn xóa " + selectedItemIds.size + " hình nền đã chọn không?")}</p>
                <div class="actions" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="confirm_cancel_btn" class="secondary_btn">${t("alert.confirm_cancel", "Hủy")}</button>
                    <button id="confirm_ok_btn" style="background: rgba(255, 60, 60, 0.2); border-color: rgba(255, 60, 60, 0.3); color: #ffa0a0;">${t("alert.delete_confirm_btn", "Xóa")}</button>
                </div>
            `;

            const confirmPopup = openCustomPopup(t("setting_panel.api_options.collection.bulk_delete_confirm_title", "Xác nhận xóa nhiều"), dialogContent, "400px", { isAlert: true, canClose: false });

            dialogContent.querySelector("#confirm_cancel_btn").onmousedown = () => confirmPopup.closePopup();
            dialogContent.querySelector("#confirm_ok_btn").onmousedown = async () => {
                confirmPopup.closePopup();
                const idsToDelete = Array.from(selectedItemIds);
                
                idsToDelete.forEach(id => {
                    const c = grid.querySelector(`.bg_coll_card[data-id="${id}"]`);
                    if(c) {
                        c.style.transition = "opacity 0.2s ease, transform 0.2s ease";
                        c.style.opacity = "0";
                        c.style.transform = "scale(0.9)";
                    }
                });

                setTimeout(async () => {
                    const remaining = await removeMultipleFromCollection(idsToDelete);
                    const { getSettings, saveSettings } = await import("/src/core/storageHandler.js");
                    const settings = getSettings();
                    const activeId = settings.wallpaperConfig?.activeCollectionItemId;
                    
                    if (idsToDelete.includes(activeId)) {
                        if (remaining.length > 0) {
                            await applyCollectionItem(remaining[0]);
                        } else {
                            settings.wallpaperConfig.source = "wallhaven";
                            saveSettings(settings);
                            const sel = document.getElementById("API_selector");
                            if (sel) {
                                sel.setAttribute("data-value", "wallhaven");
                                const valSpan = sel.querySelector(".selected_value");
                                if (valSpan) valSpan.innerText = t("setting_panel.api_selector.wallhaven_option", "Wallhaven");
                            }
                            showNotification(t("setting_panel.api_options.collection.empty_fallback", "Bộ sưu tập trống, đã chuyển về Wallhaven"), "warning");
                        }
                    }
                    
                    isSelectMode = false;
                    selectSpan.textContent = t("setting_panel.api_options.collection.select_mode", "Chọn nhiều");
                    grid.classList.remove("bg_coll_select_mode");
                    selectedItemIds.clear();
                    if (uploadBtnRef) uploadBtnRef.style.display = "flex";
                    updateBulkDeleteBtn();
                    await animateGridReflow(grid, async () => {
                        await renderGrid(remaining, grid, emptyState);
                        if (activePopupObj?.recenter) activePopupObj.recenter();
                    });
                }, 200);
            };
        });
    }

    const style = document.createElement("style");
    style.textContent = `
        .bg_coll_select_mode .bg_coll_card_actions, .bg_coll_select_mode .bg_coll_set_btn {
            display: none !important;
        }
        .bg_coll_card_selected .bg_coll_thumb_wrapper::after {
            content: "";
            position: absolute;
            top: 8px;
            left: 8px;
            background-color: var(--accent);
            background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23ffffff' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: center;
            background-size: 16px 16px;
            color: var(--bg);
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        .bg_coll_card_selected .bg_coll_thumb {
            opacity: 0.5;
        }
        .bg_coll_select_mode .bg_coll_card {
            cursor: default;
        }
    `;
    wrapper.appendChild(style);

    // Load and render initial collection
    const items = await getCollection();
    await renderGrid(items, grid, emptyState);

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

                if (isVideo && file.size > 100 * 1024 * 1024) {
                    showNotification(t("setting_panel.api_options.local.video_too_large"), "error");
                    continue;
                } else if (isVideo && file.size > 50 * 1024 * 1024) {
                    showNotification(t("setting_panel.api_options.local.video_large_warning"), "warning");
                }

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
            await animateGridReflow(grid, async () => {
                await renderGrid(updated, grid, emptyState);
                if (activePopupObj?.recenter) activePopupObj.recenter();
            });
            showNotification(t("setting_panel.api_options.collection.upload_success", { count: successCount }, `Đã tải lên ${successCount} file thành công`), "success");
        }
    });

    activePopupObj = openCustomPopup(t("setting_panel.api_options.collection.collection_title", "Bộ sưu tập hình nền"), wrapper, "800px", {
        id: "bg_collection_popup",
        isAlert: true,
        canClose: true,
    });
    popupSectionRef = activePopupObj.popupSection;
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

    const { getSettings } = await import("/src/core/storageHandler.js");
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
    } else if (item.metadata?.url) {
        // Fallback: use online URL if blob/thumbnail is missing (e.g. restored from backup)
        thumbImg.src = item.metadata.url;
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
        if (isSelectMode) return;
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
    removeBtn.innerHTML = Icons.collectionRemove;
    removeBtn.addEventListener("mousedown", async (e) => {
        e.stopPropagation();
        if (isSelectMode) return;

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
                if (card.classList.contains("bg_coll_card_active")) {
                    if (remaining.length > 0) {
                        // Fallback to first image if active is deleted
                        await applyCollectionItem(remaining[0]);
                    } else {
                        // Fallback to wallhaven when collection becomes empty
                        const { getSettings, saveSettings } = await import("/src/core/storageHandler.js");
                        const settings = getSettings();
                        settings.wallpaperConfig.source = "wallhaven";
                        saveSettings(settings);

                        const sel = document.getElementById("API_selector");
                        if (sel) {
                            sel.setAttribute("data-value", "wallhaven");
                            const valSpan = sel.querySelector(".selected_value");
                            if (valSpan) valSpan.innerText = t("setting_panel.api_selector.wallhaven_option", "Wallhaven");
                        }
                        showNotification(t("setting_panel.api_options.collection.empty_fallback", "Bộ sưu tập trống, đã chuyển về Wallhaven"), "warning");
                    }
                }
                await animateGridReflow(grid, async () => {
                    await renderGrid(remaining, grid, emptyState);
                    if (activePopupObj?.recenter) activePopupObj.recenter();
                });
            }, 200);
        };
    });

    const actionRow = document.createElement("div");
    actionRow.className = "bg_coll_action_row";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "bg_coll_download_btn";
    downloadBtn.title = t("setting_panel.api_options.collection.downloadTooltip", "Tải về");
    downloadBtn.innerHTML = Icons.collectionDownload;
    
    if (item.type && item.type.startsWith("local")) {
        downloadBtn.disabled = true;
    } else {
        downloadBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            if (isSelectMode) return;
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
    }

    const sourceBtn = document.createElement("button");
    sourceBtn.className = "bg_coll_source_btn";
    sourceBtn.title = t("setting_panel.api_options.collection.sourceTooltip", "Xem nguồn");
    sourceBtn.innerHTML = Icons.collectionSource;
    if (item.metadata?.source && !(item.type && item.type.startsWith("local"))) {
        sourceBtn.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            if (isSelectMode) return;
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

    card.addEventListener("mousedown", (e) => {
        if (!isSelectMode) return;
        e.preventDefault();
        if (selectedItemIds.has(item.id)) {
            selectedItemIds.delete(item.id);
            card.classList.remove("bg_coll_card_selected");
        } else {
            selectedItemIds.add(item.id);
            card.classList.add("bg_coll_card_selected");
        }
        updateBulkDeleteBtn();
    });

    return card;
}
