import { getFormattedClock, initDate } from "/script/core/time.js";
import { getSettings } from "/script/settings/utils/storagehandler.js";
import { t } from "/script/core/i18n.js";

/**
 * Initialize time settings UI and logic.
 */
export function initTimeSettings() {
    // Initial render
    renderTimeUI();

    // Listen for updates from core or settings changes
    document.addEventListener("time-updated", () => {
        renderTimeUI();
    });

    // Update every second to keep the sample clock accurate (especially when "Show Seconds" is on)
    setInterval(() => {
        renderTimeUI();
    }, 1000);

    // Handle hot language change
    document.addEventListener("language-changed", () => {
        renderTimeUI();
    });
}

/**
 * Render time information into the settings panel.
 * The box contains the current time and full date.
 */
function renderTimeUI() {
    const container = document.getElementById("time_output");
    if (!container) return;

    const settings = getSettings();
    const clock = getFormattedClock(settings);
    const date = initDate();

    // Format date string: "Thứ X, ngày D tháng M năm Y" or similar
    // We'll use a simple format for now since we don't have a full i18n date formatter yet
    const dayOfWeek = t(`setting_panel.time.days.${date.dayOfWeek}`);
    const dateString = `${dayOfWeek}, ${date.day}/${date.month}/${date.year}`;

    // Check for 12h/24h for the suffix
    const timeDisplay = `${clock.hours}:${clock.minutes}${clock.showSeconds ? `:${clock.seconds}` : ''}`;
    const ampmDisplay = clock.ampm ? `<span class="unit">${clock.ampm}</span>` : '';

    const html = `
    <div class="weather_card_sample time_card_sample">
        <div class="weather_header">
            <div class="temp_group">
                <span class="current_temp">${timeDisplay}${ampmDisplay}</span>
                <span class="feels_like">${dateString}</span>
            </div>
        </div>
    </div>`;

    container.innerHTML = html;
}
