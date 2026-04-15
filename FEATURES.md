# Neko Startpage — Feature Documentation

> Version: v1 · License: AGPLv3 · Created by Natelyt

Neko Startpage is a minimal, highly customizable browser new tab page with a rich set of wallpaper sources, visual effects, widgets, and utility features.

---

## Table of Contents

1. [Settings Panel Overview](#1-settings-panel-overview)
2. [Wallpaper (Hình nền)](#2-wallpaper-tab)
   - [Wallpaper Sources (Providers)](#21-wallpaper-sources)
   - [Wallpaper Rotation](#22-wallpaper-rotation)
   - [Wallpaper Customization](#23-wallpaper-customization)
3. [Appearance (Giao diện)](#3-appearance-tab)
4. [Time (Thời gian)](#4-time-tab)
5. [Weather (Thời tiết)](#5-weather-tab)
6. [Utilities (Tiện ích)](#6-utilities-tab)
7. [Info / System (Thông tin)](#7-info--system-tab)
8. [Particle Effects (Hiệu ứng hình nền)](#8-particle-effects)
9. [Wavy Animation (Rung động)](#9-wavy-animation)
10. [Onload Animation (Hoạt ảnh mở trang)](#10-onload-animation)
11. [Wallpaper Arrangement Editor](#11-wallpaper-arrangement-editor)
12. [Widgets](#12-widgets)
13. [Backup & Restore](#13-backup--restore)
14. [Localization (Ngôn ngữ)](#14-localization)
15. [Storage & Data Model](#15-storage--data-model)
16. [Keyboard Shortcuts](#16-keyboard-shortcuts)
17. [Credits](#17-credits)

---

## 1. Settings Panel Overview

The settings panel is accessed via a **gear icon button** (`#setting_toggle_btn`) located on the screen. It opens a side panel with six tabs:

| Tab Icon | Tab Name | Description |
|---|---|---|
| 🖼️ Image | **Wallpaper** | Manage wallpaper source, rotation, and visual effects |
| ⬜ Widget | **Appearance** | Toggle widgets and configure widget-specific settings |
| 🕐 Clock | **Time** | Configure clock format and display options |
| ☁️ Cloud | **Weather** | Set weather location and units |
| 🔧 Puzzle | **Utilities** | Custom tab title, presentation mode |
| ℹ️ Info | **Info** | Language selector, backup/restore, danger zone, credits |

---

## 2. Wallpaper Tab

### 2.1 Wallpaper Sources

The wallpaper source selector (`#API_selector`) controls which **provider** is currently active. Sources are divided into local and external categories.

#### Local Sources

| Value | Label | Description |
|---|---|---|
| `solid` | Solid Color | A flat color or CSS gradient as background |
| `local_image` | Local Image | Upload an image from your device |
| `local_video` | Local Video | Upload a video (looping, muted) from your device |

##### Solid Color Options
When `solid` is selected, the following sub-settings appear:

| Setting | Description | Default |
|---|---|---|
| **Color Type** (`solid_type_selector`) | Choose between `Solid Color` or `Gradient` | `solid` |
| **Primary Color** (`solid_color_input`) | Color picker for the main background color | `#0c0c0c` |
| **Secondary Color** (`solid_color2_input`) | Second color for gradient mode only | `#1a1a1a` |
| **Angle** (`solid_angle_input`) | Gradient direction in degrees (0–360°) | `135°` |

> Gradient mode applies a `linear-gradient(Xdeg, color1, color2)` CSS value to the background element. A canvas-based preview is rendered in the settings panel.

##### Local Image / Video Options
- A **file picker** button opens the OS file dialog.
- The selected file is stored in **IndexedDB** (via `db.js`) — not in localStorage — to handle large binary data.
- File metadata (size in MB, MIME type) is displayed as a tooltip.
- Video backgrounds play **looped and muted** (`<video loop muted>`).
- **Wallpaper Arrangement** are automatically disabled when a video source is active.

---

#### External Sources

| Value | Label | Description |
|---|---|---|
| `wallhaven` | Wallhaven | Fetches random high-quality wallpapers from [wallhaven.cc](https://wallhaven.cc) |
| `picre` | Picre (Anime) | Fetches random anime-style images from [pic.re](https://pic.re) |

##### Wallhaven — Advanced Settings

| Setting | Description | Default |
|---|---|---|
| **Search Query** (`wh_query`) | Wallhaven search syntax (e.g. `anime`, `landscape`, `-girl`, `type:png`) | Empty (random) |
| **Category: General** (`wh_cat_general`) | Include general-category images | ✅ Enabled |
| **Category: Anime** (`wh_cat_anime`) | Include anime-category images | ❌ Disabled |
| **Category: People** (`wh_cat_people`) | Include people-category images | ❌ Disabled |
| **Min Resolution** (`wh_resolution`) | Minimum image resolution filter | All |

> **Available Resolutions:** All, HD (720p / 1280×720), Full HD (1080p / 1920×1080), 2K (1440p / 2560×1440), 4K (2160p / 3840×2160)

> Wallhaven uses an internal pre-fetch **queue** of 24 images. Image metadata (dimensions, file size, category, queue position) is shown underneath.

##### Action Buttons (Wallhaven & Picre)

| Button | Action |
|---|---|
| **Change Wallpaper** | Fetches a new random image from the active source |
| **View Source** | Opens the source URL in a new tab (e.g. Wallhaven page) |
| **Download** | Downloads the currently displayed image to your device |

---

### 2.2 Wallpaper Rotation

> Only available when **Wallhaven** or **Picre** is the active source.

| Value | Label | Interval |
|---|---|---|
| `0` | Never | Disabled |
| `1` | 15 minutes | 900,000 ms |
| `2` | 30 minutes | 1,800,000 ms |
| `3` | 1 hour | 3,600,000 ms |
| `4` | 2 hours | 7,200,000 ms |

A real-time countdown tooltip (`#rotation_time_tooltip`) shows how many minutes until the next rotation. The timer checks every **60 seconds** and fetches a new image when the chosen interval has elapsed.

---

### 2.3 Wallpaper Customization

| Control | Description |
|---|---|
| **Arrange Wallpaper** (popup) | Opens the [Wallpaper Arrangement Editor](#11-wallpaper-arrangement-editor) |
| **Wavy Animation** (toggle) | Enables/disables the subtle sway animation on the wallpaper |
| **Wavy Settings** (popup) | Opens the [Wavy Animation Editor](#9-wavy-animation) |
| **Onload Animation Settings** (popup) | Opens the [Onload Animation Editor](#10-onload-animation) |
| **Background Effect** (toggle) | Enables/disables the canvas-based [Particle Effects](#8-particle-effects) |
| **Effect Settings** (popup) | Opens the particle effect configuration popup |

> **Note:** Wavy Animation and Wallpaper Arrangement are automatically **disabled** when the source is Solid Color or Local Video.

---

## 3. Appearance Tab

| Setting | ID | Description | Default |
|---|---|---|---|
| **Use Widgets** | `widgets_enabled` | Toggle all UI widgets on the home screen | ✅ Enabled |
| **Hide Settings Toggle** | `toggle_button_opacity` | Hides the gear button when the settings panel is closed | ❌ Disabled |
| **Widgets Settings** | `widget_settings_container` | Expands to show widget-specific settings (populated dynamically by `script/widgets/setting.html`) | — |

---

## 4. Time Tab

A live clock preview card is shown at the top of the tab that updates every second.

| Setting | ID | Description | Default |
|---|---|---|---|
| **Show zero in hours** | `add_zero_hour` | Pads single-digit hours with a leading zero (e.g. `08:30`) | ✅ Enabled |
| **Show seconds** | `show_seconds` | Appends `:SS` to the clock display | ❌ Disabled |
| **Use 12-hour format** | `clock_format_12h` | Switches between 24h and 12h clock | ❌ Disabled (24h) |
| **Show AM/PM** | `show_ampm` | Shows AM/PM suffix in 12h mode | ✅ Enabled |

> Stored as `clock_format: "12h" | "24h"` in settings.

---

## 5. Weather Tab

Weather data is provided by **[Open-Meteo](https://open-meteo.com/)** (free, no API key required). Icons are from **[Meteocons](https://github.com/basmilius/weather-icons)**.

| Setting | ID | Description | Default |
|---|---|---|---|
| **City search** | `weather_city` | Search for a city by name; results from Open-Meteo Geocoding API | — |
| **Use location** | `weather_use_location` | Use browser geolocation instead of manual city | ❌ Disabled |
| **Use Fahrenheit** | `weather_fahrenheit` | Display temperature in °F instead of °C | ❌ Disabled (°C) |

### Weather Display
After selecting a city or enabling geolocation, a **weather card** is shown with:

| Field | Description |
|---|---|
| Current temperature | In °C or °F |
| Feels like | Apparent temperature |
| Humidity | Relative humidity (%) |
| Wind speed | In km/h |
| Rain | In mm |
| Cloud cover | In % |
| Elevation | Location elevation in meters |
| Icon | WMO weather code mapped to a Meteocons SVG |
| Summary | Auto-generated natural language description |

### Weather Caching
- Cached in `localStorage` under the key `weather_cache`.
- **Auto-refreshes** every **15 minutes** in the background.
- On startup, the cached weather data is immediately displayed while a background refresh runs.
- If geolocation fails, falls back to the last cached city coordinates.

### Supported WMO Code Icons
| Weather Condition | Icon |
|---|---|
| Clear | `clear-day` |
| Partly Cloudy | `partly-cloudy-day` |
| Cloudy | `cloudy` |
| Fog | `fog` |
| Drizzle | `drizzle` |
| Rain | `rain` |
| Snow | `snow` |
| Thunderstorm | `thunderstorms` / `thunderstorms-rain` |

---

## 6. Utilities Tab

| Setting | ID | Description | Default |
|---|---|---|---|
| **Tab title** | `tab_title` | Customizes the browser tab title | Empty (uses locale default `"New Tab"`) |
| **Presentation Mode** | `presentation_mode` | Covers the wallpaper with an overlay banner — useful when screen sharing | ❌ Disabled |

> **Keyboard shortcut:** `Ctrl + X` toggles Presentation Mode.

---

## 7. Info / System Tab

### Language Selector
**ID:** `language`

| Language Code | Display Name |
|---|---|
| `en` | English |
| `vi` | Tiếng Việt |
| `jp` | 日本語 |
| `ko` | 한국어 |
| `zh` | 中文 |
| `de` | Deutsch |
| `fr` | Français |

> A page reload is required after changing the language.

### System Backup & Restore

| Button | Description |
|---|---|
| **Export Settings** | Downloads a `neko_backup_YYYY-MM-DD_HHmm.json` file containing all settings and cached API data (excluding heavy local image/video blobs) |
| **Import Settings** | Imports a backup JSON file, restores all settings and IndexedDB data, then prompts for a page reload |

### Danger Zone

| Button | Description |
|---|---|
| **Clear Cache** | Deletes all IndexedDB data (wallpaper cache) and the weather cache from localStorage. Requires confirmation. |
| **Reset Settings** | Clears all localStorage and IndexedDB, then reloads the page. Requires confirmation. |

---

## 8. Particle Effects

A canvas-based overlay rendered on top of the wallpaper via `<div class="particle_container">`. Runs using `requestAnimationFrame` for smooth 60fps animation.

**Toggle:** `#particles_animation` checkbox  
**Editor:** Opened via `#edit_particles_settings`

### Available Effects (Presets)

#### 🔵 Technology (`technology`)
Nodes connected by lines when close enough. Nodes bounce off edges.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Particle Count | 10 – 300 | 30 | Number of nodes |
| Speed | 0.1 – 3.0 | 0.5 | Movement speed multiplier |
| Connection Distance | 1 – 300 | 180 | Max distance to draw connecting lines |

---

#### ❄️ Snowfall (`snow`)
Multi-layered parallax snowflakes with cinematic depth blur effect.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Amount | 10 – 500 | 150 | Number of snowflakes |
| Falling Speed | 0.1 – 5.0 | 1.0 | Speed multiplier |
| Falling Angle | -30 – 30 | 3 | Wind drift direction |
| Opacity | 0.1 – 2.0 | 0.8 | Brightness multiplier |

---

#### 🌫️ Floating Dust (`dust`)
Particles floating upward (like ash or dust), with three depth layers.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Density | 10 – 600 | 120 | Number of dust particles |
| Flying Speed | 0.1 – 5.0 | 0.4 | Upward speed multiplier |
| Wind Direction | -10 – 10 | 3 | Horizontal wind drift |
| Opacity | 0.1 – 2.0 | 0.8 | Brightness multiplier |

---

#### 🌸 Falling Petals (`petals`)
Petal-shaped particles falling and rotating. Each petal has a simulated 3D flip effect.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Amount | 10 – 300 | 50 | Number of petals |
| Falling Speed | 0.1 – 5.0 | 1.0 | Falling speed multiplier |
| Scale | 0.1 – 3.0 | 1.0 | Size multiplier |
| Wind Direction | -30 – 30 | 5 | Wind drift |
| Opacity | 0.1 – 2.0 | 0.8 | Brightness multiplier |
| Color | Color picker | `#ffc0cb` (pink) | Petal color |

---

#### ✨ Fireflies (`fireflies`)
Glowing orbs with pulsing brightness that drift organically.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Count | 10 – 100 | 20 | Number of fireflies |
| Flying Speed | 0.1 – 2.0 | 0.8 | Movement speed |
| Size | 0.1 – 2.0 | 0.8 | Glow radius multiplier |
| Brightness | 0.1 – 1.0 | 0.6 | Opacity multiplier |

---

#### 📺 TV Noise (`noise`)
Animated grain/static overlay simulating an analog TV. Uses pre-rendered noise canvas frames for performance.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Noise Intensity | 0 – 0.4 | 0.1 | Global alpha of the noise overlay |

---

#### 🔲 Vignette (`vignette`)
A smooth radial dark gradient from edges to center, creating a cinematic frame overlay.

| Parameter | Range | Default | Description |
|---|---|---|---|
| Intensity | 0 – 1.0 | 0.5 | Darkness of the edges |
| Darkness Coverage | 0.1 – 1.0 | 0.7 | How far the dark area extends inward |

---

### Particle Editor Controls
- **Preview** button: Applies current settings immediately (live preview).
- **Reset** button: Restores all parameters to the effect's default values.
- **Save** button: Persists settings to localStorage. If the panel was closed without saving, the previous settings are restored.
- **Unsaved changes guard**: Opening the close button with unsaved changes shows a warning notification. A second close press within 5 seconds forces the exit.

---

## 9. Wavy Animation

Applies a subtle CSS `transform` (translate + rotate + scale) animation to the wallpaper layer using `requestAnimationFrame`.

**Toggle:** `#wavy_animation` checkbox  
**Editor:** Opened via `#edit_wavy_settings` button

> Disabled automatically for Solid Color and Local Video sources.

### Wavy Settings

| Parameter | Key | Range | Default | Description |
|---|---|---|---|---|
| Horizontal Amplitude | `amplitudeX` | 0 – 10 | 6 | Max left/right offset in pixels |
| Horizontal Speed | `speedX` | 0.1 – 4.0 | 1.0 | Oscillation frequency on X axis |
| Vertical Amplitude | `amplitudeY` | 0 – 10 | 6 | Max up/down offset in pixels |
| Vertical Speed | `speedY` | 0.1 – 4.0 | 1.2 | Oscillation frequency on Y axis |
| Rotation Angle | `amplitudeRotate` | 0 – 3 | 0.7 | Max rotation in degrees |
| Rotation Speed | `speedRotate` | 0 – 3.0 | 0.8 | Rotation oscillation frequency |
| Scale | `scale` | 1.00 – 1.20 | 1.03 | Subtle zoom to avoid visible borders |

### Editor Buttons

| Button | Description |
|---|---|
| **Defaults** | Restores all values to factory defaults |
| **Apply** | Previews the current values on the live background immediately |
| **Randomize** | Generates a random set of parameter values |
| **Save** | Persists configuration to localStorage |

---

## 10. Onload Animation

A CSS `transform` + `filter` transition played every time a new tab is opened. Applies scale, rotation, and blur to the wallpaper, and fades the overlay.

**Editor:** Opened via `#edit_onload_settings` button

### Presets

| Preset Value | Label | Zoom | Blur | Rotate | Speed | Overlay Speed |
|---|---|---|---|---|---|---|
| `default` | Default | 1× | 0px | 0° | 1s | 1s |
| `zoom_in_light` | Gentle | 1.4× | 10px | 0° | 3s | 1s |
| `zoom_in_heavy` | Cinematic | 2.4× | 16px | 20° | 2.6s | 1s |
| `sleepy` | Sleepy | 1.3× | 30px | 0° | 5s | 2.5s |
| `nature` | Nature | 1.2× | 7px | 0° | 2.5s | 1s |
| `custom` | Custom | User-defined | User-defined | User-defined | User-defined | User-defined |

### Custom Parameters

| Parameter | ID (range / number) | Range | Unit | Description |
|---|---|---|---|---|
| Zoom | `zoom_range` / `zoom_value` | 1 – 3 | × | Starting zoom applied to wallpaper before animation |
| Blur | `blur_range` / `blur_value` | 0 – 30 | px | Starting blur applied to wallpaper |
| Rotation | `rotate_range` / `rotate_value` | -45 – 45 | deg | Starting rotation applied to wallpaper |
| Speed | `speed_range` / `speed_value` | 0.1 – 5 | s | Duration of the wallpaper transition |
| Overlay Speed | `overlay_speed_range` / `overlay_speed_value` | 0.1 – 5 | s | Duration for the overlay to fade out |

### Additional Option

| Setting | ID | Description | Default |
|---|---|---|---|
| **UI appears immediately** | `widget_immediate` | If disabled, widgets wait for the animation to complete before fading in | ✅ Enabled |

---

## 11. Wallpaper Arrangement Editor

A drag-and-drop visual tool to set the **position** (focus point) and **zoom** level of the current static wallpaper.

**Opened via:** `#arrange_wallpaper` button

> Not available when the source is Solid Color or Local Video.

### How It Works
1. A miniaturized view of the full image is displayed.
2. A **draggable lens rectangle** represents the visible viewport portion.
3. Dragging the lens updates `backgroundPosition` (X%, Y%) in real-time.
4. A zoom slider scales the wallpaper up (1×–3×).
5. Pressing **Apply** saves the position to `wallpaperPosition: { x, y, zoom }` in localStorage.
6. Closing without applying reverts all changes.

| Control | Description |
|---|---|
| Drag lens | Sets focal X/Y position (saved as percentage 0–100) |
| **Zoom slider** | Scales the wallpaper (1.00 – 3.00) |
| **Reset** | Resets to `x: 50, y: 50, zoom: 1` |
| **Apply** | Saves current state and closes popup |

---

## 12. Widgets

Widgets are loaded dynamically from `script/widgets/main.html` and styled by `script/widgets/style.css`.

**Toggle:** `#widgets_enabled` checkbox in the Appearance tab.

- When **enabled**, the widget HTML and CSS are injected into `#widgets_container`.
- When **disabled**, the container is cleared and no widget scripts run.
- Widget-specific settings (if any) are loaded from `script/widgets/setting.html` into `#widget_settings_container`.

> The widgets module is designed to be modular. Custom widgets can be added by editing `main.html` and `setting.html` inside `script/widgets/`.

---

## 13. Backup & Restore

### Export
- Triggered by `#export_settings_btn`.
- Exports a combined JSON file named `neko_backup_YYYY-MM-DD_HHmm.json`.
- Contains:
  - `localStorage` — all settings from `neko_settings`.
  - `weatherCache` — cached weather data.
  - `indexedDB` — wallpaper queue data (Wallhaven/Picre), **excluding** raw local image/video blobs and image blob objects to reduce file size.

### Import
- Triggered by `#import_settings_btn` → hidden file input `#import_settings_file`.
- Accepts `.json` files only.
- Restores `localStorage`, `weather_cache`, and all IndexedDB entries.
- Prompts to **reload the page** after successful import.
- Supports both legacy (settings-only) and new (full backup) formats.

---

## 14. Localization

The i18n system in `script/core/i18n.js` loads JSON locale files from `locales/`.

### Supported Languages

| Code | Language | File |
|---|---|---|
| `en` | English | `locales/en.json` |
| `vi` | Vietnamese | `locales/vi.json` |
| `jp` | Japanese | `locales/jp.json` |
| `de` | German | `locales/de.json` |
| `ko` | Korean | *(referenced in selector, locale file may not exist yet)* |
| `zh` | Chinese | *(referenced in selector, locale file may not exist yet)* |
| `fr` | French | *(referenced in selector, locale file may not exist yet)* |

### Usage
- DOM elements use the `data-i18n="key.path"` attribute.
- Input placeholders use `data-i18n-placeholder="key.path"`.
- Dynamic translations use `t("key", { variable: value })` in JavaScript.
- `translateDOM(element)` can be called on any DOM node or DocumentFragment.

---

## 15. Storage & Data Model

### localStorage Key: `neko_settings`

```json
{
  "wallpaperConfig": {
    "source": "wallhaven",
    "rotation": 0
  },
  "solidColor": "#0c0c0c",
  "solidColor2": "#1a1a1a",
  "colorType": "solid",
  "colorAngle": 135,
  "wallpaperPosition": { "x": 50, "y": 50, "zoom": 1 },
  "wavy": {
    "enabled": false,
    "config": null
  },
  "tabTitle": "",
  "presentationMode": false,
  "language": "en",
  "clock_format": "24h",
  "add_zero_hour": false,
  "show_seconds": false,
  "show_ampm": true,
  "wallhavenConfig": {
    "query": "",
    "categories": { "general": true, "anime": false, "people": false },
    "resolution": ""
  },
  "onload": {
    "enabled": false,
    "widget_immediate": true,
    "preset": "default",
    "zoom": 1,
    "rotate": 0,
    "blur": 0,
    "speed": 1,
    "overlay_speed": 1
  },
  "particles": {
    "enabled": false,
    "preset": "technology",
    "config": {
      "count": 100,
      "size": 2,
      "speed": 0.5,
      "lineDist": 100,
      "color": "#ffffff"
    }
  },
  "widgets_enabled": true,
  "weather_fahrenheit": false,
  "weather_use_location": false,
  "hideToggleButton": false
}
```

### localStorage Key: `weather_cache`
```json
{
  "timestamp": 1712345678000,
  "city_name": "Hanoi, Vietnam",
  "latitude": 21.02,
  "longitude": 105.84,
  "data": { /* Open-Meteo API response */ }
}
```

### IndexedDB Store
Used for large binary assets that cannot fit in localStorage.

| Key | Content |
|---|---|
| `wallhaven_data` | Wallhaven image queue (up to 24 entries with blobs) |
| `picre_data` | Current Picre image blob |
| `local_image_data` | User-uploaded local image blob |
| `local_video_data` | User-uploaded local video blob (max ~50 MB) |

---

## 16. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + X` | Open / close the settings panel |
| `Ctrl + X` | Toggle Presentation Mode |

---

## 17. Credits

| Resource | Provider |
|---|---|
| Wallpapers (external) | [Wallhaven](https://wallhaven.cc/) |
| Anime wallpapers | [Pic.re](https://pic.re/) |
| Weather data | [Open-Meteo](https://open-meteo.com/) |
| Weather icons | [Meteocons by Bas Milius](https://github.com/basmilius/weather-icons) |
| Created by | **Natelyt** |

---

*This document was auto-generated from the source code of Neko Startpage v1.*
