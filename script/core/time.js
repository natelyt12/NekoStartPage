/**
 * Get current time components.
 * @param {Object} options - Formatting options.
 * @param {string} options.type - Time format: "24h" or "12h".
 * @param {boolean} options.addZero - Whether to prefix single-digit hours with zero.
 * @returns {{ hours: string|number, minutes: string, seconds: string, ampm: string }}
 */
export function initClock(type = "24h", addZero = true, showAmPm = true) {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    let ampm = "";

    if (type === "12h") {
        if (showAmPm) ampm = hours >= 12 ? " PM" : " AM";
        hours = hours % 12 || 12;
    }

    if (addZero) {
        hours = String(hours).padStart(2, "0");
    }
    minutes = String(minutes).padStart(2, "0");
    seconds = String(seconds).padStart(2, "0");

    return { hours, minutes, seconds, ampm };
}

/**
 * Get current date components.
 * @returns {{ day: number, month: number, year: number, dayOfWeek: number }}
 */
export function initDate() {
    const today = new Date();
    return {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        dayOfWeek: today.getDay()
    };
}

/**
 * Helper to get formatted clock based on settings object.
 * @param {Object} settings - The settings object from storage.
 * @returns {Object}
 */
export function getFormattedClock(settings) {
    const type = settings.clock_format || "24h";
    const addZero = settings.add_zero_hour !== false;
    const showSeconds = settings.show_seconds === true;
    const showAmPm = settings.show_ampm !== false;
    return { ...initClock(type, addZero, showAmPm), showSeconds };
}

