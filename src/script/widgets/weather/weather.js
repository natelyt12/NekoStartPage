import { getWeather, getGeocodingData, refreshWeatherData } from "/src/apis/weather.js";
import { t } from "/src/script/core/i18n.js";
import { getSettings, saveSettings, subscribe } from "/src/script/core/storagehandler.js";
import { EventBus } from "/src/script/core/eventbus.js";
import { EVENTS } from "/src/script/core/events.js";
import { showNotification } from "/src/script/core/UI.js";

let weatherListenersBound = false;

export function initWeatherSettings() {
    const location_input = document.getElementById("weather_city");
    const city_output = document.getElementById("city_output");
    const selected = document.getElementById("selected");
    const weather_loading = document.getElementById("weather_loading");
    const fahrenheit_toggle = document.getElementById("weather_fahrenheit");
    let debounceTimer; // Time delay for user input
    let isFetching = false;

    // Auto-load cached weather if available
    const settings = getSettings();
    if (fahrenheit_toggle) fahrenheit_toggle.checked = settings.widgets?.weather?.config?.fahrenheit === true;

    // Apply initial UI state & Load data
    const cachedStr = localStorage.getItem("weather_cache");
    const manualLoc = settings.widgets?.weather?.config?.manual_location;

    if (location_input) {
        location_input.value = manualLoc ? manualLoc.city_name.split(",")[0] : "";
        location_input.style.fontStyle = "normal";
        location_input.disabled = false;
    }

    if (selected) {
        if (manualLoc) {
            selected.removeAttribute("data-i18n");
            selected.textContent = t("setting_panel.weather.selected_city", { city: manualLoc.city_name });
        } else {
            selected.setAttribute("data-i18n", "setting_panel.weather.no_city");
            selected.textContent = t("setting_panel.weather.no_city");
        }
    }

    if (manualLoc) {
        // Fetch if no cache exists, otherwise just a background refresh
        refreshWeatherData(manualLoc, !cachedStr);
    }

    // Initial render from cache for immediate UI feedback
    if (cachedStr) {
        try {
            const currentWeather = getWeather();
            if (currentWeather) renderWeatherUI(currentWeather);
        } catch (e) {
            console.error("Weather: Initial render failed", e);
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

                                    saveSettings({
                                        widgets: {
                                            ...getSettings().widgets,
                                            weather: {
                                                ...getSettings().widgets?.weather,
                                                config: {
                                                    ...getSettings().widgets?.weather?.config,
                                                    manual_location: {
                                                        city_name: cityName,
                                                        latitude: result.latitude,
                                                        longitude: result.longitude
                                                    }
                                                }
                                            }
                                        }
                                    });

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
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    weather: {
                        ...getSettings().widgets?.weather,
                        config: {
                            ...getSettings().widgets?.weather?.config,
                            fahrenheit: isFahrenheit
                        }
                    }
                }
            });

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

    // Transparent background toggle logic
    const noBgCheckbox = document.getElementById("weather_no_bg");
    if (noBgCheckbox) {
        noBgCheckbox.checked = getSettings().widgets?.weather?.config?.no_bg === true;
        noBgCheckbox.addEventListener("change", (e) => {
            const isNoBg = e.target.checked;
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    weather: {
                        ...getSettings().widgets?.weather,
                        config: {
                            ...getSettings().widgets?.weather?.config,
                            no_bg: isNoBg
                        }
                    }
                }
            });
            applyWeatherNoBg(isNoBg);
        });
    }

    // Listen for updates (from background refresh or other modules)
    EventBus.on(EVENTS.WEATHER_UPDATED, (e) => {
        const weather = e.detail;
        if (weather) {
            if (selected) {
                selected.removeAttribute("data-i18n");
                selected.textContent = t("setting_panel.weather.selected_city", { city: weather.city });
            }
            if (location_input && weather.city) {
                location_input.value = weather.city.split(",")[0];
            }
            renderWeatherUI(weather);
        }
    });

    // Listen for all weather errors
    EventBus.on(EVENTS.WEATHER_ERROR, (e) => {
        const { type, message } = e.detail;
        showNotification(message || t("setting_panel.weather.location_denied"), "error");



        isFetching = false;
        if (weather_loading) weather_loading.style.opacity = 0;
    });


}

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
    </div>`;

    container.innerHTML = html;
}

export function startWeatherUpdates() {
    const updateWeather = () => {
        const contentEl = document.getElementById("weather-widget-content");
        if (!contentEl) return;

        const weather = getWeather();
        if (!weather) {
            contentEl.innerHTML = `
                <div style="opacity: 0.5; font-style: italic; text-align: center; width: 100%;" data-i18n="setting_panel.weather.no_city">
                    ${t("setting_panel.weather.no_city")}
                </div>`;
            return;
        }

        const cityParts = weather.city.split(',');
        const primaryCity = cityParts[0].trim();
        const secondaryCity = cityParts.length > 1 ? `<span style="font-size: 0.7em; font-weight: 300; opacity: 0.6; margin-left: 6px;">${cityParts.slice(1).join(',').trim()}</span>` : "";

        const html = `
        <div class="clock-digital-row" style="display: flex; align-items: center; gap: 8px;">
            <img src="${weather.icon_path}" alt="${weather.icon}" style="width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));">
            <div class="clock-time">
                ${weather.temp}<span style="font-size: 0.5em; opacity: 0.7; margin-left: 2px; vertical-align: top;">°${weather.unit}</span>
            </div>
            <div class="clock-date-group" style="margin-left: 8px; justify-content: center; display: flex; flex-direction: column;">
                <div class="clock-date" style="font-size: 1.2em; font-weight: 500; display: flex; align-items: baseline;">${primaryCity}${secondaryCity}</div>
                <div class="clock-date" style="font-size: 0.9em; font-weight: 300; opacity: 0.8;">${weather.description}</div>
            </div>
        </div>`;

        contentEl.innerHTML = html;
        applyWeatherNoBg(getSettings().widgets?.weather?.config?.no_bg === true);
    };

    updateWeather();

    if (!weatherListenersBound) {
        weatherListenersBound = true;
        EventBus.on(EVENTS.WEATHER_UPDATED, updateWeather);
        EventBus.on(EVENTS.LANGUAGE_CHANGED, updateWeather);
    }
}

export function applyWeatherNoBg(enabled) {
    const widget = document.getElementById("widget-weather");
    if (!widget) return;
    widget.classList.toggle("no-bg", enabled);
}

export function stopWeatherUpdates() {
    // No interval to clear for weather, listener bindings persist
}
