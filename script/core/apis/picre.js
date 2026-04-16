import { getFromStore, saveToStore } from "/script/core/db.js";

const PICRE_STORAGE_KEY = "picre_data";

/**
 * Fetch an image URL and convert it into a Blob object for local storage and caching.
 * @param {string} url - The absolute URL of the image to fetch.
 * @returns {Promise<Blob|null>} A promise that resolves to the binary Blob, or null if fetch fails.
 */
async function fetchImageBlob(url) {
    try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error("Network response was not ok");
        return await response.blob();
    } catch (error) {
        console.error("Error fetching image blob:", error);
        return null;
    }
}

/**
 * Call the Pic.re API to get random anime image metadata, and fetch its image blob.
 * @returns {Promise<Object>} A promise resolving to a standardized object containing the image URL, blob, source URL, and dimensions.
 */
async function fetchPicre() {
    const response = await fetch("https://pic.re/image.json");
    const raw = await response.json();
    const imageUrl = "https://" + raw.file_url;

    const imageBlob = await fetchImageBlob(imageUrl);

    const processed_data = {
        image: imageUrl,
        blob: imageBlob,
        source: raw.source,
        width: raw.width,
        height: raw.height,
        size: raw.file_size,
        last_updated: Date.now(),
    };
    return processed_data;
}

/**
 * Retrieve Pic.re image data, either from IndexedDB cache or by fetching a new image.
 * Will attempt to reconstruct the Blob object if it is missing from a restored backup.
 * @param {boolean} [refresh=false] - If true, ignores the locally cached image and requests a new one.
 * @returns {Promise<Object|null>} A promise resolving to the Pic.re image data payload, or null if an error occurs.
 */
export async function getPicreData(refresh = false) {
    try {
        let picreData = await getFromStore(PICRE_STORAGE_KEY);

        if (!picreData || refresh) {
            picreData = await fetchPicre();
            await saveToStore(PICRE_STORAGE_KEY, picreData);
        } else if (!picreData.blob || !(picreData.blob instanceof Blob)) {
            const blob = await fetchImageBlob(picreData.image);
            if (blob) {
                picreData.blob = blob;
                await saveToStore(PICRE_STORAGE_KEY, picreData);
            } else {
                return null;
            }
        }

        return picreData;
    } catch (error) {
        console.error("Error in getPicreData:", error);
        return null;
    }
}
