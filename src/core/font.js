/**
 * Parses and validates a Google Font input (either a URL or a font name)
 * and resolves its available font weights.
 * 
 * @param {string} input - The Google Font URL or Font Name string.
 * @returns {Promise<{name: string, url: string | null, min: number, max: number}>} - The resolved font metadata.
 */
export async function resolveGoogleFont(input) {
    // Chuẩn hóa tên Font (Capitalize Each Word)
    const fontName = input.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    if (fontName === "") {
        return { name: "", url: null, min: 100, max: 900 };
    }

    // Fetch CSS from Google Fonts API to validate and extract weights
    const testUrl = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;

    const response = await fetch(testUrl);
    if (!response.ok) {
        throw new Error("Font not found");
    }

    const cssText = await response.text();
    let minWeight = 400;
    let maxWeight = 400;

    const weightMatches = cssText.match(/font-weight:\s*(\d+)/g);
    if (weightMatches) {
        const weights = weightMatches.map(w => parseInt(w.match(/\d+/)[0]));
        minWeight = Math.min(...weights);
        maxWeight = Math.max(...weights);
    }

    return { name: fontName, url: testUrl, min: minWeight, max: maxWeight };
}
