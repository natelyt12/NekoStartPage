import { getFormattedClock, initDate } from "/script/core/time.js";
import { getSettings } from "/script/core/storagehandler.js";
import { t } from "/script/core/i18n.js";

let clockInterval = null;
let listenersBound = false;

export function initTimeSettings() {
    renderTimeUI();

    document.addEventListener("time-updated", () => {
        renderTimeUI();
    });

    setInterval(() => {
        renderTimeUI();
    }, 1000);

    document.addEventListener("language-changed", () => {
        renderTimeUI();
    });
}

function renderTimeUI() {
    const container = document.getElementById("time_output");
    if (!container) return;

    const settings = getSettings();
    const clock = getFormattedClock(settings);
    const date = initDate();

    const dayOfWeek = t(`setting_panel.time.days.${date.dayOfWeek}`);
    const dateString = `${dayOfWeek}, ${date.day}/${date.month}/${date.year}`;

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

export function startClockUpdates() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }

    const updateClock = () => {
        const timeEl = document.getElementById("clock-widget-time");
        const secondsEl = document.getElementById("clock-widget-seconds");
        const dateEl = document.getElementById("clock-widget-date");
        if (!timeEl && !dateEl) return;

        const settings = getSettings();
        const clock = getFormattedClock(settings);
        const date = initDate();

        if (timeEl) {
            let ampmSpan = "";
            if (clock.ampm) {
                ampmSpan = ` <span class="clock-ampm">${clock.ampm}</span>`;
            }
            timeEl.innerHTML = `${clock.hours}:${clock.minutes}${ampmSpan}`;
        }

        if (secondsEl) {
            if (clock.showSeconds) {
                secondsEl.style.display = "";
                secondsEl.textContent = `:${clock.seconds}`;
            } else {
                secondsEl.style.display = "none";
            }
        }

        if (dateEl) {
            const dayOfWeek = t(`setting_panel.time.days.${date.dayOfWeek}`);
            const dateString = `${dayOfWeek}, ${date.day}/${date.month}/${date.year}`;
            dateEl.textContent = dateString;
        }
    };

    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    if (!listenersBound) {
        listenersBound = true;
        document.addEventListener("time-updated", updateClock);
        document.addEventListener("language-changed", updateClock);
    }
}

export function stopClockUpdates() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}
