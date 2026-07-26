/**
 * renderPreview.js — CPU preview renderers for the Wave Normals tab.
 *
 * The composite renderer reconstructs the surface normal with the *exact*
 * arithmetic from water2.fx (`2·sum.xyz − 4`, swizzle `.xzy`, normalise) rather
 * than an approximation, because judging four layers in isolation tells you
 * nothing about what the engine will show. Everything downstream of the normal
 * — the sun lobe, the sky tint — is an approximation and is labelled as such in
 * the UI; the normal and the foam threshold are not.
 */

import { reconstructWaterNormal, OGRID_METRES } from '../../../Shared/Ocean/faWater.js';

const DEEP = [0.015, 0.075, 0.115];
const SKY  = [0.36, 0.56, 0.80];
const SUN  = [1.7, 1.42, 1.10];

function sunVectors({ sunElev = 20, sunAzim = 215, viewElev = 38 }) {
  const se = (sunElev * Math.PI) / 180;
  const sa = (sunAzim * Math.PI) / 180;
  const ve = (viewElev * Math.PI) / 180;
  return {
    L: [Math.cos(se) * Math.cos(sa), Math.sin(se), Math.cos(se) * Math.sin(sa)],
    V: [0, Math.sin(ve), -Math.cos(ve)],
  };
}

/** Shared shading kernel — GGX sun lobe, Schlick fresnel, foam over the top. */
function shadePixel(n, foam, L, V, a2, out, o) {
  const ndl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const ndv = Math.max(1e-3, n[0] * V[0] + n[1] * V[1] + n[2] * V[2]);
  const fres = 0.02 + 0.98 * Math.pow(1 - ndv, 5);

  let hx = L[0] + V[0], hy = L[1] + V[1], hz = L[2] + V[2];
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl; hy /= hl; hz /= hl;

  const ndh = Math.max(0, n[0] * hx + n[1] * hy + n[2] * hz);
  const d = ndh * ndh * (a2 - 1) + 1;
  const ggx = (a2 / (Math.PI * d * d)) * ndl;

  for (let c = 0; c < 3; c++) {
    let v = DEEP[c] * (0.3 + 0.7 * ndl) * (1 - fres) + SKY[c] * fres + SUN[c] * ggx * 0.02;
    v = v * (1 - foam) + foam * (0.88 + 0.12 * ndl);
    v = Math.pow(Math.max(0, v), 1 / 2.2);
    out[o + c] = Math.min(255, Math.max(0, v * 255 + 0.5)) | 0;
  }
  out[o + 3] = 255;
}

function bilinear(rgba, M, u, v, out) {
  let x = u * M - 0.5, y = v * M - 0.5;
  let i0 = Math.floor(x), j0 = Math.floor(y);
  const fx = x - i0, fy = y - j0;
  i0 = ((i0 % M) + M) % M; j0 = ((j0 % M) + M) % M;
  const i1 = (i0 + 1) % M, j1 = (j0 + 1) % M;

  out.r = out.g = out.b = out.a = 0;
  const tap = (i, j, w) => {
    const p = (j * M + i) * 4;
    out.r += rgba[p] * w; out.g += rgba[p + 1] * w;
    out.b += rgba[p + 2] * w; out.a += rgba[p + 3] * w;
  };
  tap(i0, j0, (1 - fx) * (1 - fy)); tap(i1, j0, fx * (1 - fy));
  tap(i0, j1, (1 - fx) * fy);       tap(i1, j1, fx * fy);
  out.r /= 255; out.g /= 255; out.b /= 255; out.a /= 255;
  return out;
}

/**
 * The composite: all four layers sampled at their own repeatRate over a
 * world-space patch, resolved through the shader's own reconstruction.
 *
 * ── Why this supersamples ──────────────────────────────────────────────────
 * Over a 250 m patch at 512 px, the finest 5 m layer repeats fifty times — ten
 * screen pixels per tile against a 128² texture. Point-sampling that is heavy
 * undersampling: it aliases, and the aliased noise has stable statistics, so
 * changing a fine-detail parameter (choppiness, detail floor) shifts the noise
 * without shifting what the eye reads — the preview looks frozen even though the
 * bake changed. Rendering at `ss`× and box-averaging down turns point sampling
 * into area sampling, which both looks right and makes those changes visible.
 */
export function renderComposite(layers, {
  size = 512, patchMetres = 200, threshold = 1, roughness = 0.12,
  showFoam = true, supersample = 2, ...view
} = {}) {
  const out = new Uint8ClampedArray(size * size * 4);
  if (!layers?.length) return new ImageData(out, size, size);

  const ss = Math.max(1, Math.round(supersample));
  const hi = size * ss;
  const buf = new Uint8ClampedArray(hi * hi * 4);

  const { L, V } = sunVectors(view);
  const a2 = roughness * roughness;
  const taps = layers.map(() => ({ r: 0, g: 0, b: 0, a: 0 }));

  for (let py = 0; py < hi; py++) {
    const Zo = ((py / hi) * patchMetres) / OGRID_METRES;
    for (let px = 0; px < hi; px++) {
      const Xo = ((px / hi) * patchMetres) / OGRID_METRES;

      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        bilinear(l.rgba, l.width, Xo * l.repeatRate, Zo * l.repeatRate, taps[i]);
      }

      const { normal, waveCrest } = reconstructWaterNormal(taps, threshold);
      shadePixel(normal, showFoam ? waveCrest : 0, L, V, a2, buf, (py * hi + px) * 4);
    }
  }

  if (ss === 1) return new ImageData(buf, size, size);

  // box-downsample ss×ss → 1
  const n = ss * ss;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const p = (((y * ss + dy) * hi) + (x * ss + dx)) * 4;
          r += buf[p]; g += buf[p + 1]; b += buf[p + 2]; a += buf[p + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }

  return new ImageData(out, size, size);
}

/**
 * One layer on its own, repeated `tiles`× in each direction so seams — if the
 * engine ever produced any — would be unmissable.
 */
export function renderLayer(layer, {
  size = 512, tiles = 2, channel = 'shaded', roughness = 0.12, ...view
} = {}) {
  const img = new Uint8ClampedArray(size * size * 4);
  if (!layer) return new ImageData(img, size, size);

  const { L, V } = sunVectors(view);
  const a2 = roughness * roughness;
  const M = layer.width;
  const src = layer.rgba;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sx = Math.floor(((px / size) * tiles * M)) % M;
      const sy = Math.floor(((py / size) * tiles * M)) % M;
      const s = (sy * M + sx) * 4;
      const o = (py * size + px) * 4;

      if (channel === 'normal') {
        img[o] = src[s]; img[o + 1] = src[s + 1]; img[o + 2] = src[s + 2]; img[o + 3] = 255;
      } else if (channel === 'foam') {
        const a = src[s + 3];
        img[o] = img[o + 1] = img[o + 2] = a; img[o + 3] = 255;
      } else {
        // A single layer decodes on its own the same way the shader would with
        // three flat neighbours: R→x, G→z, B→up.
        const nx = (src[s] / 255) * 2 - 1;
        const nz = (src[s + 1] / 255) * 2 - 1;
        const ny = (src[s + 2] / 255) * 2 - 1;
        const inv = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
        shadePixel([nx * inv, ny * inv, nz * inv], src[s + 3] / 255, L, V, a2, img, o);
      }
    }
  }

  return new ImageData(img, size, size);
}
