import { getAllFromStore, saveToStore, clearStore } from "../../core/db.js";
import { initDate, initClock } from "../../core/time.js";

const STORAGE_KEY = "neko_settings";

// Define default data structure
// NOTE: When adding a new module that requires settings, add its default key here.
const defaultSettings = {
    wallpaperConfig: {
        source: "wallhaven",
        rotation: 0,
    },
    solidColor: "#0c0c0c",
    solidColor2: "#1a1a1a",
    colorType: "solid", // solid | gradient
    colorAngle: 135,
    wallpaperPosition: { x: 50, y: 50, zoom: 1 },
    wavy: { enabled: false, config: null },
    tabTitle: "",
    presentationMode: false,
    language: "en",
    clock_format: "24h",
    add_zero_hour: false,
    show_seconds: false,
    show_ampm: true,
    wallhavenConfig: {
        query: "",
        categories: { general: true, anime: false, people: false },
        resolution: "",
    },
    debugI18n: false,
    onload: {
        enabled: false,
        widget_immediate: true,
        preset: "default",
        zoom: 1,
        rotate: 0,
        blur: 0,
        speed: 1,
        overlay_speed: 1,
    },
    particles: {
        enabled: false,
        preset: "technology",
        config: {
            count: 100,
            size: 2,
            speed: 0.5,
            lineDist: 100,
            color: "#ffffff",
        },
    },
    widgets_enabled: true,
    weather_fahrenheit: false,
    weather_use_location: false,
    hideToggleButton: false,
    // myNewModule: { enabled: true, value: 100 }
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

/**
 * Retrieve all settings from LocalStorage.
 * Automatically merges with defaultSettings to avoid missing keys.
 * @returns {Object} The merged configuration object.
 */
export function getSettings() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return JSON.parse(JSON.stringify(defaultSettings));

    try {
        const parsed = JSON.parse(stored);

        // Migrate legacy string rotation strings to numbers (Support users with old settings)
        if (parsed.wallpaperConfig && typeof parsed.wallpaperConfig.rotation === "string") {
            const LEGACY_ROTATION_MAP = { never: 0, "15min": 1, "30min": 2, "1hour": 3, "2hour": 4 };
            parsed.wallpaperConfig.rotation = LEGACY_ROTATION_MAP[parsed.wallpaperConfig.rotation] ?? 0;
        }

        return deepMerge(defaultSettings, parsed);
    } catch (e) {
        console.error("Settings: Error parsing storage, using defaults", e);
        return JSON.parse(JSON.stringify(defaultSettings));
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
    console.debug("Settings: Saved", partialSettings);
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
    }

    const weatherCacheData = localStorage.getItem("weather_cache");

    const backupData = {
        localStorage: settings,
        weatherCache: weatherCacheData ? JSON.parse(weatherCacheData) : null,
        indexedDB: filteredIdbData,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement("a");

    // Generate filename with timestamp: neko_backup_2024-03-13_1157.json
    const d = initDate();
    const t = initClock("24h", true);
    const timestamp = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}_${t.hours}${t.minutes}`;
    const filename = `neko_backup_${timestamp}.json`;

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

        // Check if new format holds indexedDB array or old format with only settings object
        if (importedData.localStorage && Array.isArray(importedData.indexedDB)) {
            // Restore local storage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData.localStorage));

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
        } else {
            // Old format only overwrites local storage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData));
        }

        console.debug("Settings: Imported successfully");
        return true;
    } catch (error) {
        console.error("Settings: Error parsing imported settings:", error);
        return false;
    }
}
