// ── TerrainType auto-paint: the dominance model ───────────────────────────────
// Given a map's two stratum masks, decide which ground layer is *visually
// dominant* at each terrainType cell, then translate that to the byte the game
// reads from terrainType.raw.
//
// The blend is FA's ordered lerp chain (FaTerrainShader.shader):
//   albedo = lower; albedo = lerp(albedo, stratumN, maskN) for N = 0..7
// so a later stratum with a high mask overdraws earlier ones. The fraction each
// layer contributes to the final pixel is therefore
//   w_i     = mask_i * PROD_{j>i} (1 - mask_j)     // stratum 0..7
//   w_lower = PROD_j (1 - mask_j)                  // base
// and argmax over those nine weights is the dominant layer. See
// docs/TERRAINTYPE_PLAN.md for the full derivation and why this is the correct
// *expected* label even for the height-splat shaders (Terrain1xx/2xx).

// Slot 0 = Lower (base), slots 1..8 = Stratum 0..7. `mask`/`ch` say where each
// stratum's opacity lives: maskLow (textureMaskLow) RGBA = strata 0-3,
// maskHigh (textureMaskHigh) RGBA = strata 4-7. `texIndex` is the scmap
// textures[] slot for the albedo thumbnail (0 = lower, 9 = upper macro).
export const STRATUM_SLOTS = [
  { slot: 0, key: 'lower',    label: 'Lower (Base)', texIndex: 0, mask: null,   ch: -1 },
  { slot: 1, key: 'stratum0', label: 'Stratum 0',    texIndex: 1, mask: 'low',  ch: 0 },
  { slot: 2, key: 'stratum1', label: 'Stratum 1',    texIndex: 2, mask: 'low',  ch: 1 },
  { slot: 3, key: 'stratum2', label: 'Stratum 2',    texIndex: 3, mask: 'low',  ch: 2 },
  { slot: 4, key: 'stratum3', label: 'Stratum 3',    texIndex: 4, mask: 'low',  ch: 3 },
  { slot: 5, key: 'stratum4', label: 'Stratum 4',    texIndex: 5, mask: 'high', ch: 0 },
  { slot: 6, key: 'stratum5', label: 'Stratum 5',    texIndex: 6, mask: 'high', ch: 1 },
  { slot: 7, key: 'stratum6', label: 'Stratum 6',    texIndex: 7, mask: 'high', ch: 2 },
  { slot: 8, key: 'stratum7', label: 'Stratum 7',    texIndex: 8, mask: 'high', ch: 3 },
];

// Which shader names interpret the masks through the sharpening remap
// saturate(2m - 1) (the "halfRange" techniques) vs. using them directly.
// Keyed on the scmap shaderPath / editor TerrainShader (ScmapEditor.cs:1082).
// Unknown shaders default to halfRange (the TTerrainXP convention).
const DIRECT_MASK_SHADERS = new Set([
  // none of the stock techniques feed masks straight through in the albedo path;
  // kept as an explicit hook so a map that clearly reads too sharp can be flipped.
]);

export function shaderUsesHalfRange(shaderPath) {
  const name = String(shaderPath || '').trim();
  if (DIRECT_MASK_SHADERS.has(name)) return false;
  return true;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Compute the dominant stratum slot for every terrainType cell.
 *
 * @param {Uint8Array} maskLow  RGBA, length size*size*4, at terrainType resolution
 * @param {Uint8Array} maskHigh RGBA, length size*size*4, at terrainType resolution
 * @param {number} size         terrainType grid edge (cells per side)
 * @param {{halfRange?:boolean, ignoreStrata?:number[]}} opts
 *   ignoreStrata: stratum indices 0..7 to drop from the blend entirely (mask
 *   forced to 0). Use for a stratum repurposed as a global normal/overlay whose
 *   mask covers the whole map (commonly Stratum 7) — otherwise it wins every
 *   cell AND its full mask starves every other layer's weight via the ordered
 *   lerp, collapsing the result to Default.
 * @returns {{ slot: Uint8Array, coverage: Float32Array }}
 *   slot[i] ∈ 0..8 (0 = lower), coverage[i] = the winning weight ∈ [0,1]
 */
export function computeDominantStratum(maskLow, maskHigh, size, { halfRange = true, ignoreStrata = [] } = {}) {
  const n = size * size;
  const slot = new Uint8Array(n);
  const coverage = new Float32Array(n);
  const m = new Float64Array(8);
  const ignore = new Set(ignoreStrata);

  for (let i = 0; i < n; i++) {
    const b = i * 4;
    m[0] = maskLow[b]     / 255; m[1] = maskLow[b + 1] / 255;
    m[2] = maskLow[b + 2] / 255; m[3] = maskLow[b + 3] / 255;
    m[4] = maskHigh[b]    / 255; m[5] = maskHigh[b + 1] / 255;
    m[6] = maskHigh[b + 2] / 255; m[7] = maskHigh[b + 3] / 255;

    if (halfRange) for (let k = 0; k < 8; k++) m[k] = clamp01(2 * m[k] - 1);
    if (ignore.size) for (let k = 0; k < 8; k++) if (ignore.has(k)) m[k] = 0;

    // suffix product: after visiting stratum k downward, `suffix` holds
    // PROD_{j>k}(1-m_j); w_k = m_k * suffix; final suffix = w_lower.
    let bestSlot = 0;      // lower until beaten
    let bestW = 0;         // filled in after we know w_lower
    let suffix = 1;
    const w = new Float64Array(8);
    for (let k = 7; k >= 0; k--) {
      w[k] = m[k] * suffix;
      suffix *= (1 - m[k]);
    }
    const wLower = suffix;
    bestW = wLower; bestSlot = 0;
    for (let k = 0; k < 8; k++) {
      if (w[k] > bestW) { bestW = w[k]; bestSlot = k + 1; }
    }
    slot[i] = bestSlot;
    coverage[i] = bestW;
  }

  return { slot, coverage };
}

/**
 * Translate dominant slots into the terrainType.raw byte array.
 *
 * @param {{slot:Uint8Array, coverage:Float32Array}} dominance
 * @param {number[]} slotToId  slotToId[0..8] = terrain-type byte for that slot
 *                             (0 / null / undefined = "leave as default")
 * @param {{defaultId?:number, threshold?:number}} opts
 * @returns {Uint8Array} length size*size, one terrainType byte per cell
 */
export function buildTerrainTypeBytes({ slot, coverage }, slotToId, { defaultId = 1, threshold = 0 } = {}) {
  const n = slot.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let id = defaultId;
    if (coverage[i] >= threshold) {
      const mapped = slotToId[slot[i]];
      if (mapped != null && mapped > 0) id = mapped;
    }
    out[i] = id;
  }
  return out;
}
