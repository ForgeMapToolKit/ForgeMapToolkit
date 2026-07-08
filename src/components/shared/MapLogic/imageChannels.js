// ── Greyscale mask channel loading + sampling ────────────────────────────────
// Shared by any tab that scatters props from externally-authored mask images
// (e.g. Rock Erosion's Gaea-exported slope/flow/curvature/deposition maps).
// Replaces the copy-pasted FileReader → Image → canvas → getImageData dance
// that used to live inline in RockErosion.jsx (5x) and Trees.jsx.

/**
 * Load an image file into a sampleable channel: a data URL (for previewing)
 * plus the raw ImageData (for brightness sampling).
 * @param {File} file
 * @returns {Promise<{ dataURL:string, imageData:ImageData, width:number, height:number }>}
 */
export function loadImageChannel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataURL = event.target.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve({ dataURL, imageData, width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = dataURL;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Sample a loaded channel at a world-space coordinate, returning a value in
 * [0, 1] (or null if the channel isn't loaded). Greyscale masks are assumed
 * R=G=B, so only the red byte is read.
 * @param {{imageData:ImageData, width:number, height:number}|null} channel
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} mapSize
 * @param {number} [mapOffsetX]
 * @param {number} [mapOffsetY]
 * @param {boolean} [invert]
 */
export function sampleChannel(channel, worldX, worldZ, mapSize, mapOffsetX = 0, mapOffsetY = 0, invert = false) {
  if (!channel?.imageData) return null;
  const { imageData, width, height } = channel;
  const u = (worldX - mapOffsetX) / mapSize;
  const v = (worldZ - mapOffsetY) / mapSize;
  const px = Math.min(width  - 1, Math.max(0, Math.round(u * width)));
  const py = Math.min(height - 1, Math.max(0, Math.round(v * height)));
  const i = (py * width + px) * 4;
  const raw = imageData.data[i] / 255;
  return invert ? 1 - raw : raw;
}
