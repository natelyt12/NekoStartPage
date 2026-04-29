import { getSettings } from "/script/settings/utils/storagehandler.js";

let currentLocaleStrings = {};

/**
 * Loads the current language JSON file based on settings and applies translations.
 * @param {string|null} [lang=null] - Optional language code to load. If null, use from settings.
 */
export async function initI18n(lang = null) {
    const selectedLang = lang || getSettings().language || "vi";
    try {
        // Assume locales folder is at the root level relative to index.html
        const response = await fetch(`locales/${selectedLang}.json`);
        if (response.ok) {
            currentLocaleStrings = await response.json();
        } else {
            console.warn(`Could not load locales/${lang}.json`);
        }
    } catch (e) {
        console.error("Failed to load language file:", e);
    }

    translateDOM();
}

/**
 * Gets a translated string for a given key, with optional variable injection.
 * @param {string} key - The dot-notation key from the JSON (e.g. "settings.weather")
 * @param {Object} variables - Dictionary of variables to replace (e.g. { size: 5 }) for {{size}}
 * @returns {string} The translated string or the original key if missing.
 */
export function t(key, variables = {}) {
    if (!key) return "";

    const keys = key.split('.');
    let result = currentLocaleStrings;
    for (const k of keys) {
        if (!result || result[k] === undefined) return key;
        result = result[k];
    }

    // Replace {{variables}}
    if (typeof result === 'string' && Object.keys(variables).length > 0) {
        for (const [varName, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${varName}}}`, 'g'), value);
        }
    }

    return result;
}

/**
 * Translates all DOM elements containing exactly the 'data-i18n' attribute.
 * @param {HTMLElement|Document} container - The container to search within, defaults to document.
 */
export function translateDOM(container = document) {
    const isDebug = getSettings().debugI18n;
    if (isDebug) return; // Bỏ qua toàn bộ quá trình dịch nếu đang bật debug

    const elements = container.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
    elements.forEach(el => {
        // Handle innerText
        if (el.hasAttribute('data-i18n')) {
            el.innerText = t(el.getAttribute('data-i18n'));
        }

        // Handle placeholder
        if (el.hasAttribute('data-i18n-placeholder')) {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        }
    });
}
