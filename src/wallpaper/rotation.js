import { getPicreData } from "/src/api/picre.js";
import { getWallhavenData } from "/src/api/wallheaven.js";
import { t } from "/src/core/i18n.js";

export const rotationTimes = {
    1: 15 * 60 * 1000,
    2: 30 * 60 * 1000,
    3: 60 * 60 * 1000,
    4: 120 * 60 * 1000,
};

const SUPPORTED_ROTATION_APIS = {
    "picre": { getData: getPicreData },
    "wallhaven": { getData: getWallhavenData },
    "collection": { getData: async () => ({ last_updated: Date.now() }) }
};

let rotationInterval = null;

/**
 * Show or hide the rotation frequency dropdown based on whether the current API supports rotation.
 * @param {string} currentAPI - The unique string identifier for the currently active background API.
 * @param {HTMLElement} wallpaperRotationBtn - The DOM element acting as the target for rotation frequency selection.
 */
export function updateRotationUI(currentAPI, wallpaperRotationBtn) {
    if (!wallpaperRotationBtn) return;

    const block = document.getElementById("rotation_setting_block");
    if (block) {
        block.style.display = SUPPORTED_ROTATION_APIS[currentAPI] ? "block" : "none";
    }
}

/**
 * Clear the currently running background rotation timer.
 * Prevents multiple intervals from stacking or background fetching when disabled.
 */
export function stopRotationTimer() {
    if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null;
    }
    const tooltip = document.getElementById("rotation_time_tooltip");
    if (tooltip) tooltip.style.display = "none";
}

/**
 * Initialize the recurring timer to check whether the background needs rotating based on user settings.
 * Skips starting if the frequency is "never".
 * @param {string} currentAPI - The current active API string identifier.
 * @param {string} rotationFrequency - The chosen frequency ("15min", "30min", "1hour", "2hour", "never").
 * @param {Function} loadSourceFunc - The API-specific callback function to invoke for fetching and displaying a new background.
 */
export function startRotationTimer(currentAPI, rotationFrequency, loadSourceFunc) {
    stopRotationTimer();

    const tooltip = document.getElementById("rotation_time_tooltip");
    
    // Ensure rotationFrequency is an integer
    rotationFrequency = parseInt(rotationFrequency, 10);

    // Skip timer if rotation is "never" (0) or "per new tab" (5)
    if (rotationFrequency !== 0 && rotationFrequency !== 5 && SUPPORTED_ROTATION_APIS[currentAPI]) {
        if (tooltip) tooltip.style.display = "block";

        const updateTask = async () => {
            if (!SUPPORTED_ROTATION_APIS[currentAPI]) {
                stopRotationTimer();
                return;
            }

            const data = await SUPPORTED_ROTATION_APIS[currentAPI].getData();
            if (!data || !data.last_updated) return;

            const elapsed = Date.now() - data.last_updated;
            const limit = rotationTimes[rotationFrequency];

            if (tooltip) {
                const remaining = Math.max(0, limit - elapsed);
                const remainingMinutes = Math.ceil(remaining / 60000);
                tooltip.innerText = t("sp.wallpaper_rotation.remaining_tooltip", { minutes: remainingMinutes });
            }

            if (elapsed >= limit) {
                if (loadSourceFunc) {
                    await loadSourceFunc(true);
                }
            }
        };

        updateTask();
        rotationInterval = setInterval(updateTask, 10000); // Check every 10 seconds
    } else {
        if (tooltip) tooltip.style.display = "none";
    }
}

/**
 * Check if the active background provider's data is expired based on current rotation settings.
 * @param {string} currentAPI - The unique identifier of the background API.
 * @param {number|string} rotationFrequency - The frequency key from settings.
 * @returns {Promise<boolean>} True if expired or no data, false otherwise.
 */
export async function isRotationExpired(currentAPI, rotationFrequency) {
    rotationFrequency = parseInt(rotationFrequency, 10);
    if (rotationFrequency === 0 || !SUPPORTED_ROTATION_APIS[currentAPI]) return false;

    const data = await SUPPORTED_ROTATION_APIS[currentAPI].getData();
    if (!data || !data.last_updated) return true;

    const elapsed = Date.now() - data.last_updated;
    const limit = rotationTimes[rotationFrequency];

    return elapsed >= limit;
}
