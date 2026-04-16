import { getWeather, getGeocodingData, refreshWeatherData } from "/script/core/apis/weather.js";
import { t } from "/script/core/i18n.js";
import { getSettings, saveSettings } from "/script/settings/utils/storagehandler.js";
import { showNotification } from "/script/settings/utils/UI.js";


/**
 * Initialize weather settings UI and logic.
 */
export function initWeatherSettings() {
    const location_input = document.getElementById("weather_city");
    const city_output = document.getElementById("city_output");
    const selected = document.getElementById("selected");
    const weather_loading = document.getElementById("weather_loading");
    const fahrenheit_toggle = document.getElementById("weather_fahrenheit");
    const use_location_toggle = document.getElementById("weather_use_location");
    let debounceTimer; // Time delay for user input
    let isFetching = false;

    // Auto-load cached weather if available
    const settings = getSettings();
    if (fahrenheit_toggle) fahrenheit_toggle.checked = settings.weather_fahrenheit;
    if (use_location_toggle) use_location_toggle.checked = settings.weather_use_location;

    /**
     * Helper to update UI elements based on weather location mode.
     * @param {boolean} enabled - Whether 'Use Location' is active.
     */
    const updateWeatherUIForLocation = (enabled) => {
        if (enabled) {
            if (location_input) {
                location_input.value = t("setting_panel.weather.current_location");
                location_input.style.fontStyle = "italic";
                location_input.disabled = true;
            }
            if (selected) {
                selected.removeAttribute("data-i18n");
                selected.textContent = t("setting_panel.weather.selected_city", { city: t("setting_panel.weather.current_location") });
            }
        } else {
            if (location_input) {
                location_input.value = "";
                location_input.style.fontStyle = "normal";
                location_input.disabled = false;
            }
            if (selected) {
                selected.setAttribute("data-i18n", "setting_panel.weather.no_city");
                selected.textContent = t("setting_panel.weather.no_city");
            }
        }
    };

    // Handle use_location toggle
    if (use_location_toggle) {
        use_location_toggle.addEventListener("change", async (e) => {
            if (isFetching) {
                e.target.checked = !e.target.checked;
                return;
            }

            const useLocation = e.target.checked;
            
            // Show loading immediately
            if (weather_loading) weather_loading.style.opacity = 1;
            isFetching = true;

            try {
                if (useLocation) {
                    saveSettings({ weather_use_location: true });
                    updateWeatherUIForLocation(true);
                } else {
                    saveSettings({ weather_use_location: false });
                    updateWeatherUIForLocation(false);
                }

                // Trigger refresh - refreshWeatherData will handle geolocation internally if enabled
                await refreshWeatherData(null, true);
            } catch (error) {
                console.error("Weather: Setup failed", error);
            } finally {
                if (weather_loading) weather_loading.style.opacity = 0;
                isFetching = false;
            }
        });
    }

    // Apply initial UI state
    if (settings.weather_use_location) updateWeatherUIForLocation(true);
    else if (location_input) location_input.disabled = false;

    const cachedStr = localStorage.getItem("weather_cache");
    if (cachedStr) {
        try {
            const cache = JSON.parse(cachedStr);
            console.debug("Weather: Loading cached city...", cache.city_name);

            if (selected) {
                selected.removeAttribute("data-i18n");
                const initialCity = getSettings().weather_use_location
                    ? t("setting_panel.weather.current_location")
                    : cache.city_name;
                selected.textContent = t("setting_panel.weather.selected_city", { city: initialCity });
            };

            if (location_input && !getSettings().weather_use_location) {
                location_input.value = cache.city_name.split(",")[0];
            }

            // Initial render
            const currentWeather = getWeather();
            if (currentWeather) renderWeatherUI(currentWeather);

            // Refresh background update
            refreshWeatherData();
        } catch (e) {
            console.error("Weather: Error parsing cache", e);
        }
    }

    // City search logic
    if (location_input) {
        location_input.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            const query = location_input.value.trim();

            if (query.length < 2) {
                if (city_output) city_output.innerHTML = "";
                return;
            }

            debounceTimer = setTimeout(async () => {
                if (weather_loading) weather_loading.style.opacity = 1;

                try {
                    const settings = getSettings();
                    const lang = settings.language || "vi";
                    const data = await getGeocodingData(query, lang === "jp" ? "ja" : lang);

                    if (city_output) {
                        city_output.innerHTML = "";
                        if (data.results) {
                            data.results.forEach((result) => {
                                const div = document.createElement("div");
                                div.className = "city_item";
                                const region = result.admin1 ? `, ${result.admin1}` : "";
                                div.innerHTML = `
                                    <p>${result.name}${region}, ${result.country || ""}</p>
                                    <span class="tooltip">lat: ${result.latitude}, lng: ${result.longitude}</span>
                                `;

                                div.addEventListener("mousedown", async () => {
                                    if (isFetching) return;
                                    isFetching = true;
                                    location_input.value = result.name;
                                    const cityName = `${result.name}${region}, ${result.country || ""}`;

                                    if (selected) {
                                        selected.removeAttribute("data-i18n");
                                        selected.textContent = t("setting_panel.weather.selected_city", { city: cityName });
                                    }

                                    city_output.innerHTML = "";

                                    // Force refresh with loading indicator
                                    if (weather_loading) weather_loading.style.opacity = 1;
                                    await refreshWeatherData(result, true);
                                    if (weather_loading) weather_loading.style.opacity = 0;

                                    showNotification(t("setting_panel.weather.weather_updated_notif"), "success");
                                    isFetching = false;
                                });

                                city_output.appendChild(div);
                            });
                        }
                    }
                } catch (error) {
                    console.error("Geocoding failed:", error);
                } finally {
                    if (weather_loading) weather_loading.style.opacity = 0;
                }
            }, 300);
        });
    }

    // Temperature unit toggle logic
    if (fahrenheit_toggle) {
        fahrenheit_toggle.addEventListener("change", async (e) => {
            if (isFetching) {
                // Revert toggle if fetching
                e.target.checked = !e.target.checked;
                return;
            }

            const isFahrenheit = e.target.checked;
            saveSettings({ weather_fahrenheit: isFahrenheit });

            // Force refresh data to apply new unit
            const cache = localStorage.getItem("weather_cache");
            if (cache) {
                const weatherData = JSON.parse(cache);
                isFetching = true;
                if (weather_loading) weather_loading.style.opacity = 1;
                await refreshWeatherData(weatherData, true);
                if (weather_loading) weather_loading.style.opacity = 0;
                isFetching = false;
            }
        });
    }

    // Listen for updates (from background refresh or other modules)
    document.addEventListener("weather-updated", (e) => {
        const weather = e.detail;
        if (weather) {
            if (selected) {
                selected.removeAttribute("data-i18n");
                selected.textContent = t("setting_panel.weather.selected_city", { city: weather.city });
            }
            if (location_input && weather.city && !getSettings().weather_use_location) {
                location_input.value = weather.city.split(",")[0];
            }
            renderWeatherUI(weather);
        }
    });

    // Listen for all weather errors
    document.addEventListener("weather-error", (e) => {
        const { type, message } = e.detail;
        showNotification(message || t("setting_panel.weather.location_denied"), "error");

        // If it's a location error, or if currently in location mode and an update fails, reset to manual
        if (type === "location" || (type === "update" && getSettings().weather_use_location)) {
            if (use_location_toggle) use_location_toggle.checked = false;
            saveSettings({ weather_use_location: false });
            updateWeatherUIForLocation(false);
        }

        isFetching = false;
        if (weather_loading) weather_loading.style.opacity = 0;
    });
}

/**
 * Render weather information into the settings panel.
 * @param {Object} weather - The formatted weather object.
 */
function renderWeatherUI(weather) {
    const container = document.getElementById("weather_output");
    if (!container || !weather) return;


    const html = `
    <div class="weather_card_sample">
        <div class="weather_header">
            <div class="temp_group">
                <span class="current_temp">${weather.temp}<span class="unit">°${weather.unit}</span></span>
                <span class="feels_like">${t("setting_panel.weather.feels_like")} ${weather.feels_like}°${weather.unit}</span>
            </div>
            <div class="icon_group">
                <img src="${weather.icon_path}" alt="${weather.icon}" class="weather_icon_lg">
            </div>
        </div>

        <div class="weather_details_grid">
            <div class="stat_item">
                <span class="stat_label">${t("setting_panel.weather.humidity")}</span>
                <span class="stat_value">${weather.humidity}%</span>
            </div>
            <div class="stat_item">
                <span class="stat_label">${t("setting_panel.weather.wind")}</span>
                <span class="stat_value">${weather.wind} km/h</span>
            </div>
            <div class="stat_item">
                <span class="stat_label">${t("setting_panel.weather.rain")}</span>
                <span class="stat_value">${weather.rain} mm</span>
            </div>
            <div class="stat_item">
                <span class="stat_label">${t("setting_panel.weather.cloud")}</span>
                <span class="stat_value">${weather.cloud}%</span>
            </div>
            <div class="stat_item">
                <span class="stat_label">${t("setting_panel.weather.elevation")}</span>
                <span class="stat_value">${weather.elevation}m</span>
            </div>
        </div>

        <div class="weather_summary">
            ${weather.description}
        </div>
    </div>`;

    container.innerHTML = html;
}
