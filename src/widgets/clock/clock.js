import dayjs from "dayjs";
import { getFormattedClock, initDate } from "/src/core/time.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";
import { EventBus } from "/src/core/eventBus.js";
import { EVENTS } from "/src/core/events.js";
import { t } from "/src/core/i18n.js";
import { toLunar, getLunarYearStem, getLunarYearBranch, stringifyLunar } from "/src/api/lunar_core.js";
import { createSlider, showNotification } from "/src/core/ui.js";

let clockTimeout = null;
let listenersBound = false;
let currentFont = null;

let currentFontUrl = null;

function applyClockFont(fontName, fontUrl, fontWeight) {
    const clockEl = document.getElementById("widget-clock");
    if (!clockEl) return;

    if (!fontName) {
        clockEl.style.fontFamily = "";
        clockEl.style.removeProperty("--clock-font-weight");
        currentFont = "";
        currentFontUrl = "";
        return;
    }

    const formattedFontName = fontName.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    if (currentFont !== formattedFontName || currentFontUrl !== fontUrl) {
        currentFont = formattedFontName;
        currentFontUrl = fontUrl;
        const fontId = "clock-google-font-link";
        let link = document.getElementById(fontId);
        if (!link) {
            link = document.createElement("link");
            link.id = fontId;
            link.rel = "stylesheet";
            document.head.appendChild(link);
        }
        link.href = fontUrl || `https://fonts.googleapis.com/css2?family=${formattedFontName.replace(/\s+/g, '+')}&display=swap`;
    }

    clockEl.style.fontFamily = `"${formattedFontName}", sans-serif`;
    clockEl.style.setProperty("--clock-font-weight", fontWeight || 300);
}

/* ─── Widget Clock Updates ───────────────────────────── */

export function startClockUpdates() {
    if (clockTimeout) {
        clearTimeout(clockTimeout);
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

        applyClockFont(
            settings.widgets?.clock?.config?.font,
            settings.widgets?.clock?.config?.font_url,
            settings.widgets?.clock?.config?.font_weight
        );

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

    const scheduleNextUpdate = () => {
        updateClock();
        const delay = 1000 - new Date().getMilliseconds();
        clockTimeout = setTimeout(scheduleNextUpdate, delay);
    };

    scheduleNextUpdate();

    if (!listenersBound) {
        listenersBound = true;
        EventBus.on(EVENTS.TIME_UPDATED, updateClock);
        EventBus.on(EVENTS.LANGUAGE_CHANGED, updateClock);
    }
}

export function stopClockUpdates() {
    if (clockTimeout) {
        clearTimeout(clockTimeout);
        clockTimeout = null;
    }
}

export function initClockSettings() {
    const addZeroHourbox = document.getElementById("add_zero_hour");
    if (addZeroHourbox) {
        addZeroHourbox.checked = getSettings().widgets?.clock?.config?.add_zero_hour !== false;
        addZeroHourbox.addEventListener("change", (e) => {
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    clock: {
                        ...getSettings().widgets?.clock,
                        config: {
                            ...getSettings().widgets?.clock?.config,
                            add_zero_hour: e.target.checked
                        }
                    }
                }
            });
            EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
        });
    }

    const showSecondsbox = document.getElementById("show_seconds");
    if (showSecondsbox) {
        showSecondsbox.checked = getSettings().widgets?.clock?.config?.show_seconds === true;
        showSecondsbox.addEventListener("change", (e) => {
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    clock: {
                        ...getSettings().widgets?.clock,
                        config: {
                            ...getSettings().widgets?.clock?.config,
                            show_seconds: e.target.checked
                        }
                    }
                }
            });
            EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
        });
    }

    const clock12hBox = document.getElementById("clock_format_12h");
    if (clock12hBox) {
        clock12hBox.checked = getSettings().widgets?.clock?.config?.format === "12h";
        clock12hBox.addEventListener("change", (e) => {
            const format = e.target.checked ? "12h" : "24h";
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    clock: {
                        ...getSettings().widgets?.clock,
                        config: {
                            ...getSettings().widgets?.clock?.config,
                            format: format
                        }
                    }
                }
            });
            EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
        });
    }

    const showAmPmBox = document.getElementById("show_ampm");
    if (showAmPmBox) {
        showAmPmBox.checked = getSettings().widgets?.clock?.config?.show_ampm !== false;
        showAmPmBox.addEventListener("change", (e) => {
            saveSettings({
                widgets: {
                    ...getSettings().widgets,
                    clock: {
                        ...getSettings().widgets?.clock,
                        config: {
                            ...getSettings().widgets?.clock?.config,
                            show_ampm: e.target.checked
                        }
                    }
                }
            });
            EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
        });
    }

    const clockFontInput = document.getElementById("clock_google_font");
    const clockApplyFontBtn = document.getElementById("clock_apply_font");
    const weightSliderContainer = document.getElementById("clock_font_weight_slider_container");
    let weightSliderObj = null;

    if (clockFontInput && clockApplyFontBtn) {
        clockFontInput.value = getSettings().widgets?.clock?.config?.font || "";

        const renderWeightSlider = (minWeight, maxWeight, currentWeight) => {
            if (!weightSliderContainer) return;
            weightSliderContainer.innerHTML = "";
            weightSliderContainer.style.display = "block";
            
            weightSliderObj = createSlider({
                label: "Font Weight",
                dataI18n: "setting_panel.time.font_weight",
                min: minWeight,
                max: maxWeight,
                step: 100,
                value: currentWeight || 300,
                defaultValue: 300,
                onChange: (val) => {
                    saveSettings({
                        widgets: {
                            ...getSettings().widgets,
                            clock: {
                                ...getSettings().widgets?.clock,
                                config: {
                                    ...getSettings().widgets?.clock?.config,
                                    font_weight: val
                                }
                            }
                        }
                    });
                    EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
                }
            });
            weightSliderContainer.appendChild(weightSliderObj);
        };

        const parseGoogleFontInput = (input) => {
            let fontUrl = null;
            let fontName = input;
            let minWeight = 100;
            let maxWeight = 900;

            if (input.startsWith("http")) {
                try {
                    const url = new URL(input);
                    const familyParam = url.searchParams.get("family");
                    if (familyParam) {
                        const parts = familyParam.split(":");
                        fontName = parts[0].replace(/\+/g, ' ');
                        fontUrl = input;
                        
                        if (parts[1]) {
                            const wghtMatch = parts[1].match(/wght@([\d;,\.]+)/);
                            if (wghtMatch) {
                                const wStr = wghtMatch[1];
                                if (wStr.includes("..")) {
                                    const [min, max] = wStr.split("..").map(Number);
                                    minWeight = min; maxWeight = max;
                                } else {
                                    const nums = wStr.match(/\d{3}/g);
                                    if (nums) {
                                        const weights = nums.map(Number);
                                        minWeight = Math.min(...weights);
                                        maxWeight = Math.max(...weights);
                                    }
                                }
                            } else {
                                minWeight = 400; maxWeight = 400;
                            }
                        } else {
                            minWeight = 400; maxWeight = 400;
                        }
                    }
                } catch (e) {}
            } else {
                fontName = input.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            return { name: fontName, url: fontUrl, min: minWeight, max: maxWeight };
        };

        const initSliderFromSettings = () => {
            const cfg = getSettings().widgets?.clock?.config || {};
            const fontName = cfg.font;
            const fontUrl = cfg.font_url;
            const currentWeight = cfg.font_weight || 300;
            const minW = cfg.font_weight_min;
            const maxW = cfg.font_weight_max;
            
            if (!fontName) {
                // Default Lexend font
                renderWeightSlider(100, 900, currentWeight);
            } else if (fontUrl && minW !== undefined && maxW !== undefined && minW !== maxW) {
                renderWeightSlider(minW, maxW, currentWeight);
            } else if (fontUrl) {
                // Fallback for custom pasted links before this update
                const parsed = parseGoogleFontInput(fontUrl);
                if (parsed.min !== parsed.max) {
                    renderWeightSlider(parsed.min, parsed.max, currentWeight);
                } else {
                    if (weightSliderContainer) weightSliderContainer.style.display = "none";
                }
            } else {
                if (weightSliderContainer) weightSliderContainer.style.display = "none";
            }
        };

        const saveFont = async () => {
            const rawValue = clockFontInput.value.trim();
            const parsed = parseGoogleFontInput(rawValue);
            
            if (!parsed.url) clockFontInput.value = parsed.name;

            const saveAndEmit = (name, url, minW, maxW) => {
                saveSettings({
                    widgets: {
                        ...getSettings().widgets,
                        clock: {
                            ...getSettings().widgets?.clock,
                            config: {
                                ...getSettings().widgets?.clock?.config,
                                font: name,
                                font_url: url,
                                font_weight_min: minW,
                                font_weight_max: maxW
                            }
                        }
                    }
                });
                if (minW !== maxW && minW !== undefined) {
                    renderWeightSlider(minW, maxW, getSettings().widgets?.clock?.config?.font_weight || 300);
                } else {
                    if (weightSliderContainer) weightSliderContainer.style.display = "none";
                }
                EventBus.emit(EVENTS.TIME_UPDATED, null, "clock.js");
            };

            if (parsed.name === "") {
                saveAndEmit("", null, 100, 900);
                return;
            }

            const testUrl = parsed.url || `https://fonts.googleapis.com/css2?family=${parsed.name.replace(/\s+/g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
            
            try {
                const response = await fetch(testUrl);
                if (!response.ok) throw new Error("Font not found");
                
                const cssText = await response.text();
                
                if (!parsed.url) {
                    const weightMatches = cssText.match(/font-weight:\s*(\d+)/g);
                    if (weightMatches) {
                        const weights = weightMatches.map(w => parseInt(w.match(/\d+/)[0]));
                        parsed.min = Math.min(...weights);
                        parsed.max = Math.max(...weights);
                        parsed.url = testUrl;
                    } else {
                        parsed.min = 400;
                        parsed.max = 400;
                    }
                }
                
                saveAndEmit(parsed.name, parsed.url, parsed.min, parsed.max);

            } catch (err) {
                showNotification(t("sp.time.font_not_found").replace("{font}", parsed.name), "error");
                clockFontInput.value = "";
                saveAndEmit("", null, 100, 900);
            }
        };

        clockApplyFontBtn.addEventListener("mousedown", saveFont);
        clockFontInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveFont();
        });

        initSliderFromSettings();
    }
}
