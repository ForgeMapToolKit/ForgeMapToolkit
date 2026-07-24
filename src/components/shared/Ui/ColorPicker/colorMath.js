/**
 * colorMath.js — hex ⇄ HSV conversion for ColorPicker's SV/hue surfaces.
 * Pure functions, no React/DOM — split out so the picker's rendering stays
 * focused on markup and drag handling.
 */

export const hexToHsv = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
};

export const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.max(0, Math.min(255, Math.round(val * 255))).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
};
