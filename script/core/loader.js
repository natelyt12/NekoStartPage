/**
 * Injects a CSS file into the document head to load styles dynamically.
 * @param {string} url - The URL or relative path of the CSS file to load.
 */
export function loadCSS(url) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
}

/**
 * Fetches and injects HTML content into a specified DOM element.
 * @param {string} targetElementId - The ID of the DOM element where the HTML will be injected.
 * @param {string} componentUrl - The URL or relative path of the HTML file to fetch.
 * @returns {Promise<boolean>} A promise that resolves to true if successfully loaded, and false if an error occurs.
 */
export async function loadHTML(targetElementId, componentUrl) {
    const targetElement = document.getElementById(targetElementId);

    if (!targetElement) {
        console.error(`Error: Not found element with ID: ${targetElementId}`);
        return false;
    }

    try {
        const response = await fetch(componentUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} on loading ${componentUrl}`);
        }

        const htmlContent = await response.text();

        targetElement.innerHTML = htmlContent;

        console.debug(`Success: Loaded ${componentUrl} into #${targetElementId}`);
        return true;
    } catch (error) {
        console.error(`Error on loading ${componentUrl}: ${error}`);
        return false;
    }
}

/**
 * Removes all content from a specified DOM element.
 * @param {string} targetElementId - The ID of the DOM element to clear.
 */
export function unloadHTML(targetElementId) {
    const targetElement = document.getElementById(targetElementId);
    if (targetElement) {
        targetElement.innerHTML = "";
        console.debug(`Success: Unloaded content from #${targetElementId}`);
    }
}

/**
 * Removes a dynamically loaded CSS link from the document head.
 * @param {string} url - The URL or relative path of the CSS file to unload.
 */
export function unloadCSS(url) {
    const link = document.querySelector(`link[href="${url}"]`);
    if (link) {
        link.remove();
        console.debug(`Success: Unloaded CSS ${url}`);
    }
}
