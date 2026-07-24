/**
 * colorUtil.js — hex ⇄ float-rgb conversion shared by nodes and sub-editors.
 * Nodes store colours as `#rrggbb` hex in params (JSON-friendly, picker-native)
 * and convert to 0..1 floats only when building uniforms.
 */

export function hexToRgb(hex) {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
