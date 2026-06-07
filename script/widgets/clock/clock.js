import { getFormattedClock, initDate } from "/script/core/time.js";
import { getSettings, saveSettings } from "/script/core/storagehandler.js";
import { t } from "/script/core/i18n.js";

let clockInterval = null;
let listenersBound = false;

/* ─── Settings Panel Preview ─────────────────────────── */

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

    // Restore & wire no-bg checkbox
    const noBgCheckbox = document.getElementById("clock_no_bg");
    if (noBgCheckbox) {
        noBgCheckbox.checked = getSettings().clock_no_bg === true;
        applyClockNoBg(noBgCheckbox.checked);

        noBgCheckbox.addEventListener("change", (e) => {
            saveSettings({ clock_no_bg: e.target.checked });
            applyClockNoBg(e.target.checked);
        });
    }
}

function applyClockNoBg(enabled) {
    const widget = document.getElementById("widget-clock");
    if (!widget) return;
    widget.classList.toggle("no-bg", enabled);
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

/* ─── Analog Clock Helpers ───────────────────────────── */

/**
 * Build tick marks (60 minute + 12 hour) into the SVG.
 * Called once on first render.
 */
function buildTicks() {
    const g = document.getElementById("clock-ticks");
    if (!g || g.dataset.built) return;
    g.dataset.built = "1";

    const cx = 100, cy = 100, r = 86;

    for (let i = 0; i < 60; i++) {
        const angle = (i * 6 - 90) * (Math.PI / 180);
        const isHour = i % 5 === 0;
        const innerR = isHour ? r - 10 : r - 5;

        const x1 = cx + innerR * Math.cos(angle);
        const y1 = cy + innerR * Math.sin(angle);
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("class", isHour ? "clock-tick-major" : "clock-tick-minor");
        g.appendChild(line);
    }
}

/**
 * Rotate an SVG line hand around the clock center (100, 100).
 * @param {SVGLineElement} el
 * @param {number} angleDeg  Degrees from 12-o'clock (clockwise)
 * @param {number} length    Distance from center to tip
 * @param {number} tail      Distance from center to tail (behind center), default 0
 */
function setHandAngle(el, angleDeg, length, tail = 0) {
    if (!el) return;
    const rad = (angleDeg - 90) * (Math.PI / 180);
    const cx = 100, cy = 100;
    el.setAttribute("x1", cx - tail * Math.cos(rad));
    el.setAttribute("y1", cy - tail * Math.sin(rad));
    el.setAttribute("x2", cx + length * Math.cos(rad));
    el.setAttribute("y2", cy + length * Math.sin(rad));
}

/* ─── Widget Clock Updates ───────────────────────────── */

export function startClockUpdates() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }

    // Apply no-bg immediately from saved settings
    applyClockNoBg(getSettings().clock_no_bg === true);

    const updateClock = () => {
        const timeEl    = document.getElementById("clock-widget-time");
        const secondsEl = document.getElementById("clock-widget-seconds");
        const ampmEl    = document.getElementById("clock-widget-ampm");
        const dateEl    = document.getElementById("clock-widget-date");

        if (!timeEl && !dateEl) return;

        // Build ticks once
        buildTicks();

        const settings = getSettings();
        const clock = getFormattedClock(settings);
        const date = initDate();
        const now = new Date();

        /* ── Digital part ── */
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
            const dayOfWeek = t(`setting_panel.time.days.${date.dayOfWeek}`);
            dateEl.textContent = `${dayOfWeek}, ${date.day}/${date.month}/${date.year}`;
        }

        /* ── Analog hands ── */
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds();

        // Smooth continuous rotation
        const hourAngle   = (h * 30) + (m * 0.5) + (s * (0.5 / 60));
        const minuteAngle = (m * 6)  + (s * 0.1);
        const secondAngle = s * 6;

        const hourHand   = document.getElementById("clock-hand-hour");
        const minuteHand = document.getElementById("clock-hand-minute");
        const secondHand = document.getElementById("clock-hand-second");

        setHandAngle(hourHand,   hourAngle,   46, 0);
        setHandAngle(minuteHand, minuteAngle, 64, 0);
        setHandAngle(secondHand, secondAngle, 70, 12); // second hand has a small tail
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
