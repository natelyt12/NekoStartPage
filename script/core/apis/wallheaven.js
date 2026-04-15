import { getFromStore, saveToStore } from "../db.js";
import { getSettings } from "../../settings/utils/storagehandler.js";
import { t } from "../i18n.js";

const WALLHAVEN_STORAGE_KEY = "wallhaven_data";

/**
 * Fetch an image URL and convert it into a Blob object for local storage and caching.
 * @param {string} url - The absolute URL of the image to fetch.
 * @returns {Promise<Blob|null>} A promise that resolves to the binary Blob, or null if fetch fails.
 */
async function fetchImageBlob(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(t("setting_panel.api_options.error"));
        return await response.blob();
    } catch (error) {
        console.error("Error fetching image blob:", error);
        return null;
    }
}

/**
 * Fetch a queue of 24 random images from the Wallhaven API based on user settings.
 * Applies purity (SFW only) and ratio (16x9) filters by default.
 * @returns {Promise<Array<Object>>} A promise resolving to an array of image metadata objects.
 */
async function fetchWallhavenQueue() {
    try {
        const s = getSettings().wallhavenConfig || {
            query: "",
            categories: { general: true, anime: true, people: false },
            resolution: ""
        };

        const cats = `${s.categories.general ? '1' : '0'}${s.categories.anime ? '1' : '0'}${s.categories.people ? '1' : '0'}`;

        const params = new URLSearchParams({
            sorting: 'random',
            categories: cats,
            purity: '100',
            ratios: '16x9'
        });

        if (s.query) params.append("q", s.query);
        if (s.resolution) params.append("atleast", s.resolution);

        const url = `https://wallhaven.cc/api/v1/search?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(t("setting_panel.api_options.error"));

        const json = await response.json();
        return json.data;
    } catch (error) {
        console.error("Error fetching wallhaven queue:", error);
        return [];
    }
}

/**
 * Clear the current Wallhaven image queue from IndexedDB.
 * Used when user changes search settings to force a fresh queue load.
 * @returns {Promise<void>} A promise that resolves when the queue is cleared.
 */
export async function clearWallhavenQueue() {
    let storeData = await getFromStore(WALLHAVEN_STORAGE_KEY) || { queue: [], current: null };
    storeData.queue = [];
    await saveToStore(WALLHAVEN_STORAGE_KEY, storeData);
}

/**
 * Retrieve the next Wallhaven image from the queue or fetch a new queue if empty.
 * Returns local cache if not forced to refresh. Reconstructs missing blobs if imported from a backup.
 * @param {boolean} [refresh=false] - If true, pops the next image from the queue instead of returning the current one.
 * @returns {Promise<Object>} A promise resolving to the Wallhaven image data payload, or an error object.
 */
export async function getWallhavenData(refresh = false) {
    try {
        let storeData = await getFromStore(WALLHAVEN_STORAGE_KEY) || { queue: [], current: null };

        if (!storeData.queue) storeData.queue = [];

        if (refresh || !storeData.current) {
            // Nếu hết queue, lấy mẻ 24 ảnh mới
            if (storeData.queue.length === 0) {
                storeData.queue = await fetchWallhavenQueue();
                storeData.queue_total = storeData.queue.length;
            }

            if (storeData.queue.length > 0) {
                const nextItem = storeData.queue.shift();

                if (nextItem && nextItem.path) {
                    const blob = await fetchImageBlob(nextItem.path);

                    if (blob) {
                        storeData.current = {
                            image: nextItem.path,
                            blob: blob,
                            source: nextItem.short_url,
                            width: nextItem.dimension_x,
                            height: nextItem.dimension_y,
                            size: nextItem.file_size,
                            last_updated: Date.now(),
                            category: nextItem.category,
                            queue_left: storeData.queue.length,
                            queue_total: storeData.queue_total || 24
                        };
                    } else {
                        return { error: t("setting_panel.api_options.error") };
                    }
                } else {
                    return { error: t("setting_panel.api_options.wallhaven.corrupted_data") };
                }
            } else {
                return { error: t("setting_panel.api_options.wallhaven.no_result") };
            }
        } else if (!storeData.current.blob || !(storeData.current.blob instanceof Blob)) {
            const blob = await fetchImageBlob(storeData.current.image);
            if (blob) {
                storeData.current.blob = blob;
            } else {
                return { error: t("setting_panel.api_options.wallhaven.corrupted_data") };
            }
        }

        await saveToStore(WALLHAVEN_STORAGE_KEY, storeData);
        return storeData.current;
    } catch (error) {
        console.error("Error in getWallhavenData:", error);
        return { error: t("setting_panel.api_options.error") };
    }
}