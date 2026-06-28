import dayjs from "dayjs";
import { getFormattedClock, initDate } from "/src/core/time.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";
import { EventBus } from "/src/core/eventBus.js";
import { EVENTS } from "/src/core/events.js";
import { t } from "/src/core/i18n.js";
import { toLunar, getLunarYearStem, getLunarYearBranch, stringifyLunar } from "/src/api/lunar_core.js";

let clockInterval = null;
let listenersBound = false;

/* ─── Settings Panel Preview ─────────────────────────── */

export function initTimeSettings() {
    renderTimeUI();

    EventBus.on(EVENTS.TIME_UPDATED, () => {
        renderTimeUI();
    });

    setInterval(() => {
        renderTimeUI();
    }, 1000);


}

function renderTimeUI() {
    const container = document.getElementById("time_output");
    if (!container) return;

    const settings = getSettings();
    const clock = getFormattedClock(settings);
    const date = initDate();

    const lang = getSettings().language || "vi";
    const intlLang = lang === "jp" ? "ja" : lang;
    const dateObj = dayjs().toDate();
    const dateString = new Intl.DateTimeFormat(intlLang, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(dateObj);

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

/* ─── Widget Clock Updates ───────────────────────────── */

export function startClockUpdates() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }

    const updateClock = () => {
        const timeEl = document.getElementById("clock-widget-time");
        const secondsEl = document.getElementById("clock-widget-seconds");
        const ampmEl = document.getElementById("clock-widget-ampm");
        const dateEl = document.getElementById("clock-widget-date");
        const lunarEl = document.getElementById("clock-widget-lunar");

        if (!timeEl && !dateEl) return;

        const settings = getSettings();
        const clock = getFormattedClock(settings);
        const date = initDate();
        const lang = settings.language || "vi";
        const intlLang = lang === "jp" ? "ja" : lang;

        /* ── Digital time ── */
        if (timeEl) {
            timeEl.textContent = `${clock.hours}:${clock.minutes}`;
        }

        if (secondsEl) {
            if (clock.showSeconds) {
                secondsEl.style.display = "";
                secondsEl.textContent = `:${clock.seconds}`;
            } else {
                secondsEl.style.display = "none";
            }
        }

        if (ampmEl) {
            if (clock.ampm) {
                ampmEl.style.display = "";
                ampmEl.textContent = clock.ampm.trim();
            } else {
                ampmEl.style.display = "none";
            }
        }

        if (dateEl) {
            const dateObj = dayjs().toDate();
            dateEl.textContent = new Intl.DateTimeFormat(intlLang, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(dateObj);
        }

        if (lunarEl) {
            try {
                const d = parseInt(date.day, 10);
                const m = parseInt(date.month, 10);
                const y = parseInt(date.year, 10);
                const tz = -(dayjs().toDate().getTimezoneOffset() / 60); // Múi giờ tự động theo máy tính

                const lunar = toLunar({ day: d, month: m, year: y, tz });

                let lunarLang = "en";
                if (lang === "vi") lunarLang = "vi";
                if (lang.startsWith("zh") || lang === "jp" || lang === "ja") lunarLang = "zh";

                // Get Can Chi for the year
                const stem = getLunarYearStem(lunar.year, lunarLang);
                const branch = getLunarYearBranch(lunar.year, lunarLang);

                if (lang === "vi") {
                    const leapStr = lunar.leap ? " (Nhuận)" : "";
                    const yearName = `${stem} ${branch}`;
                    lunarEl.textContent = `Âm lịch: ${lunar.day} tháng ${lunar.month}${leapStr} năm ${yearName}`;
                } else if (lang.startsWith("zh")) {
                    const leapStr = lunar.leap ? "閏" : "";
                    const yearName = `${stem}${branch}`;
                    lunarEl.textContent = `農曆: ${yearName}年${leapStr}${lunar.month}月${lunar.day}日`;
                } else if (lang === "jp" || lang === "ja") {
                    const leapStr = lunar.leap ? "閏" : "";
                    const yearName = `${stem}${branch}`;
                    lunarEl.textContent = `旧暦: ${yearName}年 ${leapStr}${lunar.month}月${lunar.day}日`;
                } else {
                    const leapStr = lunar.leap ? " (Leap)" : "";
                    lunarEl.textContent = `Lunar: ${lunar.month}/${lunar.day}${leapStr} - Year of ${branch}`;
                }
            } catch (e) {
                console.error("Lunar error:", e);
                lunarEl.textContent = "";
            }
        }
    };

    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    if (!listenersBound) {
        listenersBound = true;
        EventBus.on(EVENTS.TIME_UPDATED, updateClock);
        EventBus.on(EVENTS.LANGUAGE_CHANGED, updateClock);
    }
}

export function stopClockUpdates() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

