import { getFromStore, saveToStore } from "/src/core/db.js";

const COLLECTION_KEY = "background_collection";

/**
 * Load the full collection array from IndexedDB.
 * @returns {Promise<Array>}
 */
export async function getCollection() {
    const data = await getFromStore(COLLECTION_KEY);
    return Array.isArray(data) ? data : [];
}

/**
 * Add a new item to the collection.
 * @param {{ type: string, blob: Blob, thumbnail: Blob|null, metadata: Object }} item
 * @returns {Promise<Object>} The saved item (with generated id).
 */
export async function addToCollection(item) {
    const collection = await getCollection();
    const newItem = {
        id: String(Date.now()) + "_" + Math.random().toString(36).slice(2, 7),
        type: item.type || "unknown",
        blob: item.blob,
        thumbnail: item.thumbnail || null,
        metadata: item.metadata || {},
    };
    collection.push(newItem);
    await saveToStore(COLLECTION_KEY, collection);
    return newItem;
}

/**
 * Remove an item from the collection by its id.
 * @param {string} id
 * @returns {Promise<Array>} Remaining items.
 */
export async function removeFromCollection(id) {
    const collection = await getCollection();
    const remaining = collection.filter((item) => item.id !== id);
    await saveToStore(COLLECTION_KEY, remaining);
    return remaining;
}

/**
 * Remove multiple items from the collection by their ids.
 * @param {Array<string>} ids
 * @returns {Promise<Array>} Remaining items.
 */
export async function removeMultipleFromCollection(ids) {
    const collection = await getCollection();
    const remaining = collection.filter((item) => !ids.includes(item.id));
    await saveToStore(COLLECTION_KEY, remaining);
    return remaining;
}

/**
 * Generate a compressed JPEG thumbnail Blob for an image blob.
 * Resizes to max 320px wide while preserving aspect ratio.
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export function generateImageThumbnail(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const MAX_W = 640;
            const scale = Math.min(1, MAX_W / img.naturalWidth);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);

            canvas.toBlob(
                (thumbBlob) => {
                    canvas.remove();
                    if (thumbBlob) resolve(thumbBlob);
                    else reject(new Error("Không thể tạo thumbnail ảnh"));
                },
                "image/jpeg",
                0.85
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Không thể load ảnh để tạo thumbnail"));
        };

        img.src = url;
    });
}

/**
 * Generate a compressed JPEG thumbnail Blob from a video file using canvas.
 * Uses toBlob() instead of toDataURL() for better memory efficiency.
 * @param {File|Blob} videoFile
 * @returns {Promise<Blob>}
 */
export function generateVideoThumbnail(videoFile) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const videoUrl = URL.createObjectURL(videoFile);

        const cleanup = () => {
            URL.revokeObjectURL(videoUrl);
            video.remove();
        };

        let timeoutId = setTimeout(() => {
            cleanup();
            canvas.remove();
            reject(new Error("Timeout khi tạo thumbnail video"));
        }, 10000);

        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";

        video.onloadedmetadata = () => {
            video.currentTime = 0.5;
        };

        video.onseeked = () => {
            clearTimeout(timeoutId);

            const MAX_W = 640;
            const scale = Math.min(1, MAX_W / (video.videoWidth || 640));
            canvas.width = Math.round((video.videoWidth || 640) * scale);
            canvas.height = Math.round((video.videoHeight || 360) * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            cleanup();
            canvas.toBlob(
                (thumbBlob) => {
                    canvas.remove();
                    if (thumbBlob) resolve(thumbBlob);
                    else reject(new Error("Không thể tạo thumbnail video"));
                },
                "image/jpeg",
                0.85
            );
        };

        video.onerror = () => {
            clearTimeout(timeoutId);
            cleanup();
            canvas.remove();
            reject(new Error("Không thể đọc video để tạo thumbnail"));
        };
    });
}

/**
 * Get natural dimensions of an image Blob.
 * @param {Blob} blob
 * @returns {Promise<{width: number, height: number}>}
 */
export function getImageDimensions(blob) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 0, height: 0 });
        };
        img.src = url;
    });
}
