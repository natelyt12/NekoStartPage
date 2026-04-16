// Open Meteo API Provider
import { t } from "/script/core/i18n.js";
import { getSettings } from "/script/settings/utils/storagehandler.js";

/**
 * Call the Open-Meteo Geocoding API to search for city coordinates by name.
 * @param {string} city_name - The exact or partial name of the city to search for.
 * @param {string} [language="vi"] - The language for the returned results.
 * @returns {Promise<Object>} A promise resolving to an object containing search results.
 */
export async function getGeocodingData(city_name, language = "vi") {
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city_name}&count=8&language=${language}&format=json`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Geocoding failed:", error);
        document.dispatchEvent(new CustomEvent("weather-error", {
            detail: { type: "geocoding", message: t("setting_panel.weather.error", { error: error.message }), error }
        }));
        return { results: [] };
    }
}

/**
 * Call the Open-Meteo Forecast API to get current weather and other metrics.
 * @param {number} latitude - The geographical latitude.
 * @param {number} longitude - The geographical longitude.
 * @returns {Promise<Object>} A promise resolving to the raw weather API response.
 */
async function fetchWeatherAPI(latitude, longitude) {
    const settings = getSettings();
    const unit = settings.weather_fahrenheit ? "fahrenheit" : "celsius";
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,rain,apparent_temperature,weather_code,cloud_cover&forecast_days=1&temperature_unit=${unit}`);
    return await response.json();
}

/**
 * Retrieve and Cache Weather Data.
 * Fetches new data if "refresh" is true or if the 15-minute cache has expired.
 * Also dispatches an event when data updates.
 * @param {Object|null} [locationData=null] - A custom location object from the Geocoding API, if manually selected.
 * @param {boolean} [refresh=false] - If true, force an API call and ignore the expiration check.
 * @returns {Promise<Object|null>} A promise resolving to the weather object, or null if failed.
 */
export async function refreshWeatherData(locationData = null, refresh = false) {
    const settings = getSettings();

    // If direct location data is provided, use it
    if (refresh && locationData) {
        return await updateWeatherCache(locationData);
    }

    // If cache refresh or automatic update
    const cachedData = localStorage.getItem("weather_cache");
    const fifteenMinutes = 15 * 60 * 1000;
    const now = Date.now();

    let weatherObj = cachedData ? JSON.parse(cachedData) : null;
    const isExpired = weatherObj ? (now - weatherObj.timestamp > fifteenMinutes) : true;

    if (refresh || isExpired) {
        // If "Use Location" is enabled, try to get coordinates first
        if (settings.weather_use_location) {
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 20000 });
                });

                const { latitude, longitude } = pos.coords;
                // For auto-location, we might not have a city name immediately, or we can use another API to reverse geocode.
                // But Open-Meteo doesn't need city name for forecast. 
                return await updateWeatherCache({
                    latitude,
                    longitude,
                    city_name: t("setting_panel.weather.current_location") || "Current Location"
                });
            } catch (error) {
                console.error("Geolocation failed:", error);
                document.dispatchEvent(new CustomEvent("weather-error", {
                    detail: { type: "location", message: t("setting_panel.weather.error", { error: error.message }) }
                }));
                // Fallback to cache or manual city if geolocation fails
            }
        }

        // Fallback to updating from existing cache coordinates
        if (weatherObj) {
            try {
                const data = await fetchWeatherAPI(weatherObj.latitude, weatherObj.longitude);
                weatherObj.data = data;
                weatherObj.timestamp = Date.now();
                localStorage.setItem("weather_cache", JSON.stringify(weatherObj));
                document.dispatchEvent(new CustomEvent("weather-updated", { detail: getWeather() }));
                return weatherObj;
            } catch (error) {
                console.error("Failed to update expired weather data:", error);
                document.dispatchEvent(new CustomEvent("weather-error", {
                    detail: { type: "update", message: t("setting_panel.weather.error", { error: error.message }), error }
                }));
            }
        }
    } else if (weatherObj) {
        // Just notify listeners about existing data
        document.dispatchEvent(new CustomEvent("weather-updated", { detail: getWeather() }));
        return weatherObj;
    }

    return null;
}

/**
 * Helper to fetch API and update localStorage cache.
 * @param {Object} locationData 
 */
async function updateWeatherCache(locationData) {
    try {
        const data = await fetchWeatherAPI(locationData.latitude, locationData.longitude);
        let formattedCityName = locationData.city_name;
        if (!formattedCityName && locationData.name) {
            const region = locationData.admin1 ? `, ${locationData.admin1}` : "";
            formattedCityName = `${locationData.name}${region}, ${locationData.country || ""}`;
        }

        const weatherObj = {
            timestamp: Date.now(),
            city_name: formattedCityName || "Unknown",
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            data: data
        };

        localStorage.setItem("weather_cache", JSON.stringify(weatherObj));
        document.dispatchEvent(new CustomEvent("weather-updated", { detail: getWeather() }));
        return weatherObj;
    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        document.dispatchEvent(new CustomEvent("weather-error", {
            detail: { type: "fetch", message: t("setting_panel.weather.error", { error: error.message }) }
        }));
        return null;
    }
}


/**
 * Map the WMO weather code to the corresponding icon filename.
 * @param {number} code - WMO weather interpretation code.
 * @param {number} isDay - 1 for day, 0 for night.
 * @returns {string} The SVG filename corresponding to the weather condition.
 */
function getWeatherIcon(code) {
    const iconMap = {
        0: 'clear-day',
        1: 'partly-cloudy-day',
        2: 'partly-cloudy-day',
        3: 'cloudy',
        45: 'fog', 48: 'fog',
        51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
        61: 'rain', 63: 'rain', 65: 'rain',
        71: 'snow', 73: 'snow', 75: 'snow',
        77: 'rain', 80: 'rain', 81: 'rain', 82: 'rain',
        78: 'rain',
        95: 'thunderstorms', 96: 'thunderstorms-rain', 99: 'thunderstorms-rain'
    };

    // Return filename, default 'not-available' if not found
    return (iconMap[code] || 'not-available') + '.svg';
}

/**
 * Generate a natural-sounding description of the current weather based on conditions.
 * @param {Object} data - The weather forecast data object from the API.
 * @returns {string} A localized text string describing the weather.
 */
function generateNaturalDescription(data) {
    const settings = getSettings();
    const unit = settings.weather_fahrenheit ? "F" : "C";

    // Rain logic
    const rainStatus = data.current.rain > 0
        ? t("setting_panel.weather.summary_rain.raining", { rain: data.current.rain })
        : t("setting_panel.weather.summary_rain.dry");

    // Temperature logic
    const feel = data.current.apparent_temperature;
    let tempStatusKey = "hot";

    // Scale threshold if using Fahrenheit
    const threshold = settings.weather_fahrenheit ? { cold: 59, pleasant: 77, warm: 90 } : { cold: 15, pleasant: 25, warm: 32 };

    if (feel < threshold.cold) tempStatusKey = "cold";
    else if (feel < threshold.pleasant) tempStatusKey = "pleasant";
    else if (feel < threshold.warm) tempStatusKey = "warm";

    const tempStatus = t(`setting_panel.weather.summary_temp.${tempStatusKey}`);

    return t("setting_panel.weather.summary_template", {
        rain_status: rainStatus,
        temp_status: tempStatus,
        feel,
        unit,
        humidity: data.current.relative_humidity_2m
    });
}

/**
 * Retrieve the current weather state for external modules or widgets.
 * Safe to call frequently as it only reads from the stringified localStorage.
 * @returns {Object|null} Formatted weather information for UI display, or null if no cache exists.
 */
export function getWeather() {
    const cachedStr = localStorage.getItem("weather_cache");
    if (!cachedStr) return null;

    try {
        const weatherObj = JSON.parse(cachedStr);
        const data = weatherObj.data;
        const current = data.current;

        const description = generateNaturalDescription(data);
        const icon = getWeatherIcon(current.weather_code);
        
        // If "Use Location" is on, always use translated placeholder instead of cached string
        const displayCity = getSettings().weather_use_location 
            ? t("setting_panel.weather.current_location") 
            : weatherObj.city_name;

        return {
            city: displayCity,
            temp: current.temperature_2m,
            feels_like: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            wind: current.wind_speed_10m,
            rain: current.rain,
            cloud: current.cloud_cover,
            elevation: data.elevation,
            icon: icon,
            icon_path: `../../assets/weather_icons/${icon}`,
            description: description,
            unit: getSettings().weather_fahrenheit ? "F" : "C",
            timestamp: weatherObj.timestamp
        };
    } catch (e) {
        console.error("Error parsing weather cache", e);
        document.dispatchEvent(new CustomEvent("weather-error", {
            detail: { type: "parse", message: t("setting_panel.weather.error", { error: e.message }) }
        }));
        return null;
    }
}
