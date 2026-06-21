import { getFromStore, saveToStore } from "/script/core/db.js";
import { getSettings } from "/script/core/storagehandler.js";
import { t } from "/script/core/i18n.js";

const REDDIT_STORAGE_KEY = "reddit_data";

/**
 * Fetch an image URL and convert it into a Blob object for local storage and caching.
 */
async function fetchImageBlob(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch image");
        return await response.blob();
    } catch (error) {
        console.error("Error fetching image blob:", error);
        return null;
    }
}

let lastFetchTime = 0;
const FETCH_COOLDOWN_MS = 10000; // 10 seconds cooldown

/**
 * Fetch a queue of images from a specific subreddit.
 */
async function fetchRedditQueue() {
    try {
        const now = Date.now();
        if (now - lastFetchTime < FETCH_COOLDOWN_MS) {
            throw new Error(t("setting_panel.api_options.error_ratelimit", "Vui lòng đợi 5 giây trước khi lấy thêm ảnh từ Reddit để tránh bị chặn."));
        }
        lastFetchTime = now;

        const settings = getSettings();
        const config = settings.redditConfig || { subreddit: "EarthPorn" };
        
        const subreddit = config.subreddit || "EarthPorn";
        
        // Always fetch from 'hot' for the best quality/freshness balance
        const url = `https://api.reddit.com/r/${subreddit}/hot.json?limit=100`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Reddit API error");

        const json = await response.json();
        const posts = json.data.children;

        const queue = [];

        for (const post of posts) {
            const data = post.data;

            // Lọc rác
            if (data.is_video) continue;
            if (data.over_18) continue; // Lọc NSFW

            let imgUrl = data.url;

            // Sửa link imgur nếu cần
            if (imgUrl.includes("imgur.com") && !imgUrl.includes("i.imgur.com") && !imgUrl.match(/\.(jpg|jpeg|png)$/i)) {
                imgUrl = imgUrl.replace("imgur.com", "i.imgur.com") + ".jpg";
            }

            // Kiểm tra đuôi ảnh
            if (!imgUrl.match(/\.(jpg|jpeg|png)$/i)) continue;

            // Kiểm tra kích thước (chỉ lấy ảnh ngang hoặc ảnh lớn)
            const width = data.preview?.images?.[0]?.source?.width;
            const height = data.preview?.images?.[0]?.source?.height;
            if (width && width < 1280) continue; // Ít nhất phải HD

            queue.push({
                path: imgUrl,
                short_url: `https://reddit.com${data.permalink}`,
                dimension_x: width || 1920,
                dimension_y: height || 1080,
                category: subreddit,
                author: data.author,
                title: data.title,
                file_size: 0 // Reddit doesn't provide file size in json
            });

            // Lấy tối đa 50 ảnh vào hàng đợi
            if (queue.length >= 50) break;
        }

        return queue;
    } catch (error) {
        console.error("Error fetching Reddit queue:", error);
        return [];
    }
}

export async function clearRedditQueue() {
    let storeData = await getFromStore(REDDIT_STORAGE_KEY) || { queue: [], current: null };
    storeData.queue = [];
    await saveToStore(REDDIT_STORAGE_KEY, storeData);
}

export async function getRedditData(refresh = false) {
    try {
        let storeData = await getFromStore(REDDIT_STORAGE_KEY) || { queue: [], current: null };
        if (!storeData.queue) storeData.queue = [];

        // Khôi phục Blob nếu cần (VD khi load lại trang)
        if (!refresh && storeData.current) {
            if (!storeData.current.blob || !(storeData.current.blob instanceof Blob)) {
                const blob = await fetchImageBlob(storeData.current.image);
                if (!blob) return { error: "Corrupted data" };
                storeData.current.blob = blob;
                await saveToStore(REDDIT_STORAGE_KEY, storeData);
            }
            return storeData.current;
        }

        // Tải mảng mới nếu rỗng
        if (storeData.queue.length === 0) {
            storeData.queue = await fetchRedditQueue();
            storeData.queue_total = storeData.queue.length;
        }

        if (storeData.queue.length === 0) {
            return { error: "No results found on Reddit" };
        }

        // Lấy NGẪU NHIÊN 1 ảnh từ mảng thay vì pop tuyến tính
        const randomIndex = Math.floor(Math.random() * storeData.queue.length);
        const nextItem = storeData.queue.splice(randomIndex, 1)[0]; // Rút phần tử ra khỏi mảng

        if (!nextItem || !nextItem.path) {
            return { error: "Corrupted data" };
        }

        const blob = await fetchImageBlob(nextItem.path);
        if (!blob) {
            return { error: "Failed to load image" };
        }

        storeData.current = {
            image: nextItem.path,
            blob: blob,
            source: nextItem.short_url,
            width: nextItem.dimension_x,
            height: nextItem.dimension_y,
            size: nextItem.file_size,
            last_updated: Date.now(),
            category: nextItem.category,
            author: nextItem.author,
            title: nextItem.title,
            queue_left: storeData.queue.length,
            queue_total: storeData.queue_total || 50
        };

        await saveToStore(REDDIT_STORAGE_KEY, storeData);
        return storeData.current;
    } catch (error) {
        console.error("Error in getRedditData:", error);
        return { error: "Network error" };
    }
}
