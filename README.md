# Yumebako

A beautiful, highly customizable, and modern "New Tab" startpage extension for your browser. Built with performance and aesthetics in mind.

## 🚀 Features (Still in development)

- **🖼️ Dynamic Wallpapers**: Support for multiple providers including Local, Collection, Wallhaven, and Picre.
- **☁️ Weather Widget**: Real-time weather updates with automatic geocoding.
- **🕒 Smart Clock**: Customizable time formats, including Lunar date support.
- **🎨 Visual Effects**: Wavy animations, brightness, blur, and color filters to make your wallpaper stand out.
- **🌍 Internationalization (i18n)**: Multi-language support (English, Vietnamese, etc.).
- **⚡ Modern Tech Stack**: Powered by Vite, Lucide Icons, `ofetch`, and `dayjs` for blazing fast performance.

## 📦 Installation

### For Users (Manual Install)
1. Download the latest release from the [Releases](https://github.com/natelyt12/Yumebako/releases) page.
2. Unzip the downloaded file.
3. Open your browser's extensions page (e.g., `chrome://extensions`).
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the unzipped `dist` folder.

### For Developers
1. Clone the repository:
   ```bash
   git clone https://github.com/natelyt12/Yumebako.git
   cd Yumebako
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (with Hot Module Replacement):
   ```bash
   npm run dev
   ```
4. Load the extension in your browser:
   - Go to `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the root `Yumebako` folder (Vite CRX plugin handles the rest).
5. Build for production:
   ```bash
   npm run build
   ```

## Tech Stack
- **Bundler**: [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/)
- **Icons**: [Lucide Icons](https://lucide.dev/)

## ⚖️ License
This project is open-source and licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).
