import { getSettings } from "/src/core/storageHandler.js";

export const rotationTimes = {
    1: 15 * 60 * 1000,
    2: 30 * 60 * 1000,
    3: 60 * 60 * 1000,
    4: 120 * 60 * 1000,
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
        // Now all APIs support rotation since it's handled globally
        block.style.display = "block";
    }
}

/**
 * Clear the currently running background rotation timer.
 */
export function stopRotationTimer() {
    if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null;
    }
}

/**
 * Initialize the recurring timer to check whether the background needs rotating based on user settings.
 * Skips starting if the frequency is "never".
 * @param {number|string} rotationFrequency - The chosen frequency (1, 2, 3, 4, 0).
 * @param {Function} loadSourceFunc - The callback function to invoke for fetching and displaying a new background.
 */
export function startRotationTimer(rotationFrequency, loadSourceFunc) {
    stopRotationTimer();

    rotationFrequency = parseInt(rotationFrequency, 10);

    // Skip timer if rotation is "never" (0) or "per new tab" (5)
    if (rotationFrequency !== 0 && rotationFrequency !== 5) {
        const updateTask = async () => {
            const config = getSettings().wallpaperConfig || {};
            const lastUpdated = config.last_rotation_time || 0;
            const elapsed = Date.now() - lastUpdated;
            const limit = rotationTimes[rotationFrequency];

            if (elapsed >= limit) {
                if (loadSourceFunc) {
                    await loadSourceFunc();
                }
            }
        };

        updateTask();
        rotationInterval = setInterval(updateTask, 10000); // Check every 10 seconds
    }
}

