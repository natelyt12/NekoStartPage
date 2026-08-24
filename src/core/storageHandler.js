import { getAllFromStore, saveToStore, clearStore } from "/src/core/db.js";
import { initDate, initClock } from "/src/core/time.js";

const STORAGE_KEY = "bako_settings";

// Define default data structure
// NOTE: When adding a new module that requires settings, add its default key here.
const defaultSettings = {
    wallpaperConfig: {
        source: "wallhaven",
        rotation: 0,
        brightness: 1,
        blur: 0,
        contrast: 1,
        saturate: 1,
        chroma: 0,
        bloom: 0,
        mode: "cover",
    },
    wallpaperPosition: { x: 50, y: 50, zoom: 1, mode: "cover" },
    wavy: {
        enabled: false,
        parallaxEnabled: false,
        config: {
            amplitudeX: 6,
            speedX: 1,
            amplitudeY: 6,
            speedY: 1.2,
            amplitudeRotate: 0.7,
            speedRotate: 0.8,
            parallaxInertia: 0.03,
            parallaxAmplitude: -30,
            scale: 1.07
        }
    },
    tabTitle: "",
    presentationMode: false,
    language: "en",
    wallhavenConfig: {
        query: "neko",
        categories: { general: false, anime: true, people: false },
        resolution: "1920x1080",
        sorting: "random",
        topRange: "1M"
    },
    debugI18n: false,
    onload: {
        enabled: false,
        widget_immediate: true,
        preset: "zoom_in_light",
        zoom: 1.2,
        rotate: 0,
        blur: 10,
        speed: 3,
        overlay_speed: 1,
        bg_easing: "var(--expo_out)",
        overlay_easing: "var(--sine_in_out)"
    },
    particles: {
        enabled: false,
        preset: "technology",
        config: {
            count: 100,
            size: 2,
            speed: 0.5,
            lineDist: 100,
            color: "#ffffff"
        }
    },
    widgets: {
        enabled: false,
        grid_size: 10,
        grid_padding: 0,
        clock: {
            enabled: false,
            position: { anchor: "bottom-left", offsetX: 0, offsetY: 0 },
            config: {
                format: "24h",
                add_zero_hour: false,
                show_seconds: false,
                show_ampm: true,
                font: ""
            }
        },
        date: {
            enabled: false,
            position: { anchor: "bottom-left", offsetX: 0, offsetY: 80 },
            config: {}
        },
        lunar: {
            enabled: false,
            position: { anchor: "bottom-left", offsetX: 0, offsetY: 120 },
            config: {}
        },
        weather: {
            enabled: false,
            position: { anchor: "top-right", offsetX: 20, offsetY: 20 },
            config: {
                fahrenheit: false,
                manual_location: null
            }
        }
    },
    hideToggleButton: false
};

/**
 * Utility for deep merging settings objects automatically
 */
function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target, source) {
    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    const output = { ...target };
    Object.keys(source).forEach((key) => {
        if (isObject(source[key]) && isObject(target[key])) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    });
    return output;
}

let settingsCache = null;
const keyListeners = new Map();

/**
 * Retrieve all settings from LocalStorage.
 * Automatically merges with defaultSettings to avoid missing keys.
 * @returns {Object} The merged configuration object.
 */
export function getSettings() {
    if (settingsCache) return settingsCache;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        settingsCache = JSON.parse(JSON.stringify(defaultSettings));
        return settingsCache;
    }

    try {
        const parsed = JSON.parse(stored);

        // Migrate legacy string rotation strings to numbers (Support users with old settings)
        if (parsed.wallpaperConfig && typeof parsed.wallpaperConfig.rotation === "string") {
            const LEGACY_ROTATION_MAP = { never: 0, "15min": 1, "30min": 2, "1hour": 3, "2hour": 4 };
            parsed.wallpaperConfig.rotation = LEGACY_ROTATION_MAP[parsed.wallpaperConfig.rotation] ?? 0;
        }

        settingsCache = deepMerge(defaultSettings, parsed);
        return settingsCache;
    } catch (e) {
        console.error("Settings: Error parsing storage, using defaults", e);
        settingsCache = JSON.parse(JSON.stringify(defaultSettings));
        return settingsCache;
    }
}

/**
 * Save merged settings into LocalStorage.
 * @param {Object} partialSettings - Partial object containing new updates.
 */
export function saveSettings(partialSettings) {
    const current = getSettings();
    // Use shallow merge on save to prevent accidentally merging removed arrays.
    const updated = { ...current, ...partialSettings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    settingsCache = updated;
    console.debug("Settings: Saved and notifying listeners", partialSettings);

    // Notify key listeners
    Object.keys(partialSettings).forEach((key) => {
        if (keyListeners.has(key)) {
            keyListeners.get(key).forEach((callback) => {
                try {
                    callback(updated[key], updated);
                } catch (e) {
                    console.error(`Error notifying listener for key ${key}:`, e);
                }
            });
        }
    });
}

/**
 * Subscribe to changes on a specific settings key.
 * The callback is immediately fired with the current value.
 * @param {string} key - The settings key to listen to.
 * @param {Function} callback - Callback function receiving (newValue, allSettings).
 * @returns {Function} Unsubscribe function.
 */
export function subscribe(key, callback) {
    if (!keyListeners.has(key)) {
        keyListeners.set(key, new Set());
    }
    keyListeners.get(key).add(callback);

    // Immediately trigger with current value for initial setup
    const currentSettings = getSettings();
    try {
        callback(currentSettings[key], currentSettings);
    } catch (e) {
        console.error(`Error in initial callback for key ${key}:`, e);
    }

    return () => {
        const set = keyListeners.get(key);
        if (set) {
            set.delete(callback);
        }
    };
}

/**
 * Export current settings and DB data to a JSON file format.
 * @returns {Promise<void>}
 */
export async function exportSettings() {
    const settings = getSettings();
    const idbData = await getAllFromStore();

    // Exclude local API data (heavy images, videos) from backup file
    const filteredIdbData = idbData ? idbData.filter((item) => item.key !== "local_image_data" && item.key !== "local_video_data") : [];

    // Exclude blob objects from backup to reduce JSON export size
    for (let item of filteredIdbData) {
        if (item.key === "wallhaven_data" && item.value?.current?.blob) {
            delete item.value.current.blob;
        }
        if (item.key === "picre_data" && item.value?.blob) {
            delete item.value.blob;
        }
        if (item.key === "background_collection" && Array.isArray(item.value)) {
            item.value = item.value.filter(bg => bg.type && !bg.type.startsWith("local"));
            item.value.forEach(bg => {
                delete bg.blob;
                delete bg.thumbnail;
            });
        }
    }

    const weatherCacheData = localStorage.getItem("weather_cache");

    const backupData = {
        localStorage: settings,
        weatherCache: weatherCacheData ? JSON.parse(weatherCacheData) : null,
        indexedDB: filteredIdbData,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement("a");

    // Generate filename with timestamp: bako_backup_2024-03-13_1157.json
    const d = initDate();
    const t = initClock("24h", true);
    const timestamp = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}_${t.hours}${t.minutes}`;
    const filename = `bako_backup_${timestamp}.json`;

    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Import settings from JSON string content.
 * @param {string} jsonString - JSON content string.
 * @returns {Promise<boolean>} Resolves to true if imported successfully.
 */
export async function importSettings(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);
        let newLocalStorageData = null;

        // Check if new format holds indexedDB array or old format with only settings object
        if (importedData.localStorage && Array.isArray(importedData.indexedDB)) {
            // Restore local storage
            newLocalStorageData = importedData.localStorage;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocalStorageData));

            // Restore weather cache if present
            if (importedData.weatherCache) {
                localStorage.setItem("weather_cache", JSON.stringify(importedData.weatherCache));
            } else {
                localStorage.removeItem("weather_cache");
            }

            // Restore IndexedDB
            await clearStore();
            for (const item of importedData.indexedDB) {
                if (item && item.key) {
                    await saveToStore(item.key, item.value);
                }
            }

            // Attempt to recover blobs from background_collection
            try {
                const { recoverCollectionBlobs } = await import("/src/wallpaper/providers/impl/collection/collectionDb.js");
                await recoverCollectionBlobs();
            } catch (err) {
                console.error("Failed to recover collection blobs during import:", err);
            }
        } else {
            // Old format only overwrites local storage
            newLocalStorageData = importedData;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocalStorageData));
        }

        // Update settingsCache and notify all registered key listeners
        settingsCache = deepMerge(defaultSettings, newLocalStorageData);
        console.debug("Settings: Imported successfully, notifying all listeners");

        keyListeners.forEach((callbacks, key) => {
            callbacks.forEach((callback) => {
                try {
                    callback(settingsCache[key], settingsCache);
                } catch (e) {
                    console.error(`Error notifying listener for key ${key} during import:`, e);
                }
            });
        });

        return true;
    } catch (error) {
        console.error("Settings: Error parsing imported settings:", error);
        return false;
    }
}
