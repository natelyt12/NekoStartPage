import { getSettings, saveSettings } from "/src/core/storageHandler.js";
import { clearWallhavenQueue } from "./wallhavenAPI.js";

/**
 * Create and return the Wallhaven Extra Settings UI element from template.
 * @param {Object} providerInstance
 * @returns {HTMLElement|DocumentFragment|null}
 */
export function createWallhavenSettingsUI(providerInstance) {
    const template = document.getElementById("tpl_wallhaven_settings");
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const config = getSettings().wallhavenConfig || { categories: {} };

    const queryInput = clone.querySelector("#wh_query");
    const catGeneral = clone.querySelector("#wh_cat_general");
    const catAnime = clone.querySelector("#wh_cat_anime");
    const catPeople = clone.querySelector("#wh_cat_people");
    const resolutionBtn = clone.querySelector("#wh_resolution");

    if (queryInput) queryInput.value = config.query || "";
    if (catGeneral) catGeneral.checked = config.categories.general !== false;
    if (catAnime) catAnime.checked = config.categories.anime !== false;
    if (catPeople) catPeople.checked = config.categories.people === true;

    if (resolutionBtn) {
        const valSpan = resolutionBtn.querySelector(".selected_value");
        if (config.resolution && config.resolution !== "any") {
            const opt = clone.querySelector(`.dropdown_item[data-value="${config.resolution}"]`);
            if (opt) {
                if (valSpan) valSpan.innerText = opt.innerText;
                resolutionBtn.setAttribute("data-selected", config.resolution);
            }
        } else {
            if (valSpan) {
                valSpan.setAttribute("data-i18n", "sp.api.wallhaven.resolution_any");
                valSpan.innerText = "Tất cả";
            }
            resolutionBtn.setAttribute("data-selected", "any");
        }
    }

    const saveWallhavenConfig = async () => {
        const s = getSettings();
        if (!s.wallhavenConfig) s.wallhavenConfig = { categories: {} };
        s.wallhavenConfig.query = queryInput ? queryInput.value.trim() : "";
        s.wallhavenConfig.categories.general = catGeneral ? catGeneral.checked : true;
        s.wallhavenConfig.categories.anime = catAnime ? catAnime.checked : true;
        s.wallhavenConfig.categories.people = catPeople ? catPeople.checked : false;
        s.wallhavenConfig.resolution = resolutionBtn ? (resolutionBtn.getAttribute("data-selected") || "any") : "any";

        saveSettings({ wallhavenConfig: s.wallhavenConfig });
        await clearWallhavenQueue();
    };

    if (queryInput) queryInput.addEventListener("change", saveWallhavenConfig);
    if (catGeneral) catGeneral.addEventListener("change", saveWallhavenConfig);
    if (catAnime) catAnime.addEventListener("change", saveWallhavenConfig);
    if (catPeople) catPeople.addEventListener("change", saveWallhavenConfig);
    if (resolutionBtn) {
        const observer = new MutationObserver(() => saveWallhavenConfig());
        observer.observe(resolutionBtn, { attributes: true, attributeFilter: ["data-selected"] });
    }

    return clone;
}
