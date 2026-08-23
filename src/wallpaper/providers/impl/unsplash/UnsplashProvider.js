import { BaseProvider } from "../../BaseProvider.js";
import { getUnsplashData } from "./unsplashAPI.js";
import { t } from "/src/core/i18n.js";
import { getSettings } from "/src/core/storageHandler.js";

export class UnsplashProvider extends BaseProvider {
    constructor() {
        super("unsplash", "Unsplash");
    }

    async init() {
        // No complex init needed for now
    }

    async fetch(options = {}) {
        const { refresh = false } = options;
        const data = await getUnsplashData(refresh);
        if (data?.error) {
            throw new Error(data.error);
        }
        if (!data || !data.blob) {
            throw new Error(t("sp.api.unsplash.no_result", "Không tìm thấy kết quả từ Unsplash."));
        }

        this.currentData = {
            blob: data.blob,
            type: "image",
            source: data.source,
            width: data.width,
            height: data.height,
            size: data.size,
            image: data.image,
            category: data.category,
            author_name: data.author_name,
            author_url: data.author_url,
            description: data.description,
            download_location: data.download_location,
            queue_left: data.queue_left,
            queue_total: data.queue_total,
        };
        return this.currentData;
    }

    async download() {
        // Trigger Unsplash official download endpoint before saving to disk
        if (this.currentData?.download_location) {
            const apiKey = getSettings().unsplashApiKey;
            if (apiKey) {
                fetch(`${this.currentData.download_location}&client_id=${apiKey}`).catch(() => {});
            }
        }
        // Call the parent BaseProvider download method to actually download the blob
        await super.download();
    }

    getCollectionItemData() {
        // Trigger Unsplash official download endpoint when user explicitly adds to collection
        if (this.currentData?.download_location) {
            const apiKey = getSettings().unsplashApiKey;
            if (apiKey) {
                fetch(`${this.currentData.download_location}&client_id=${apiKey}`).catch(() => {});
            }
        }
        return super.getCollectionItemData();
    }

    getMetadataTooltip() {
        if (!this.currentData) return "";
        const d = this.currentData;
        const queueStr = `${(d.queue_total || 30) - (d.queue_left || 0)}/${d.queue_total || 30}`;
        const author = d.author_name || "Unknown";
        let tooltip = `Photo by ${author} | Ratio: ${d.width}x${d.height}`;
        if (d.size) {
            tooltip += ` | Size: ${(d.size / 1024 / 1024).toFixed(2)} MB`;
        }
        tooltip += ` | Queue: ${queueStr}`;
        if (d.description) {
            tooltip += `\nDesc: ${d.description}`;
        }
        return tooltip;
    }

    hasExtraSettings() {
        return false;
    }
}
