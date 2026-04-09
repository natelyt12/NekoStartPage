// import
import { initI18n } from "./script/core/i18n.js";
import { getSettings } from "./script/settings/utils/storagehandler.js";

await initI18n();

// Load other modules
const settings = getSettings();
const onloadData = settings.onload || {};
const immediate = onloadData.widget_immediate !== false;

// Always load settings handler immediately as it's the core of the app
const loadCore = import("./script/settings/setting_handler.js");
const { initWidget } = await import("./script/widgets/handler.js");

if (immediate) {
    // Load immediately
    await Promise.all([
        loadCore,
        initWidget()
    ]);
} else {
    // Wait for the animation event to load widgets
    await loadCore;
    document.addEventListener("onload-animation-complete", () => {
        initWidget();
    }, { once: true });
}

// Prevent tab
document.addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
        e.preventDefault();
    }
});
