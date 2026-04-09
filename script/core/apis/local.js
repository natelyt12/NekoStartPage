import { saveToStore, getFromStore } from "../db.js";
import { t } from "../i18n.js";

/**
 * Open a file picker for the user to select an image file.
 * @returns {Promise<File|null>} A promise that resolves to the selected File object, or null if canceled/invalid.
 */
function chooseImageFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }

            // Check MIME
            if (file.type && !file.type.startsWith("image/")) {
                reject(new Error(t("setting_panel.api_options.local.invalid_image")));
                return;
            }

            resolve(file);
        };

        input.oncancel = () => resolve(null);
        input.click();
    });
}

/**
 * Open a file picker for the user to select a video file.
 * @returns {Promise<File|null>} A promise that resolves to the selected File object, or null if canceled/invalid.
 */
function chooseVideoFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";

        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }

            // Check MIME
            if (file.type && !file.type.startsWith("video/")) {
                reject(new Error(t("setting_panel.api_options.local.invalid_video")));
                return;
            }

            const MAX_SIZE = 50 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                reject(new Error(t("setting_panel.api_options.local.video_too_large")));
                return;
            }

            resolve(file);
        };

        input.oncancel = () => resolve(null);
        input.click();
        input.value = null;
    });
}

/**
 * Generate a base64 encoded thumbnail image from a video file.
 * @param {File} videoFile - The video file to generate a thumbnail from.
 * @returns {Promise<string>} A promise that resolves to a Data URL string containing the JPEG thumbnail.
 */
function generateVideoThumbnail(videoFile) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const videoUrl = URL.createObjectURL(videoFile);
        video.src = videoUrl;

        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";

        video.onloadedmetadata = () => {
            video.currentTime = 0;
        };

        video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            URL.revokeObjectURL(videoUrl);
            video.remove();
            canvas.remove();

            resolve(dataUrl);
        };
        video.onerror = (e) => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error("Không thể tạo thumbnail từ video này"));
        };
        setTimeout(() => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error("Timeout khi tạo thumbnail"));
        }, 5000);
    });
}

/**
 * Retrieve local file data (image or video), either from IndexedDB cache or by prompting the user.
 * @param {string} type - File type to retrieve. Accepts "image" or "video".
 * @param {boolean} [refresh=false] - If true, ignores cache and forces a new file picker prompt.
 * @param {boolean} [firstRun=false] - If true and cache is empty, it returns null without opening a dialog.
 * @returns {Promise<Object|null>} A promise resolving to an object { blob: File, thumbnail?: string }, or null.
 */
export async function getLocalData(type, refresh = false, firstRun = false) {
    if (type === "image") {
        const imgdata = await getFromStore("local_image_data");
        if (imgdata && !refresh) {
            return imgdata;
        } else {
            if (firstRun) return null; // Ngăn chặn tự động mở hộp thoại khi mới vào trang nếu chưa có dữ liệu

            const file = await chooseImageFile();
            if (!file) {
                return null;
            }
            // Chỉ lưu vào Store khi thực sự có file mới
            const newData = { blob: file };
            await saveToStore("local_image_data", newData);

            return newData;
        }
    } else if (type === "video") {
        const viddata = await getFromStore("local_video_data");
        if (viddata && !refresh) {
            return viddata;
        } else {
            if (firstRun) return null; // Ngăn chặn tự động mở hộp thoại khi mới vào trang nếu chưa có dữ liệu

            const file = await chooseVideoFile();
            const thumbnail = file ? await generateVideoThumbnail(file) : null;

            if (!file) {
                return null;
            }
            // Chỉ lưu vào Store khi thực sự có file mới
            const newData = { blob: file, thumbnail: thumbnail };
            await saveToStore("local_video_data", newData);

            return newData;
        }
    }
}
