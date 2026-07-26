/**
 * scatter.js — "Scatter" (texture bombing), modelled on Gaea's Bomber.
 *
 * Takes one element (`stamp`, e.g. a star sprite, an SDF shape, an imported
 * decal) and strews copies of it across the field with random position,
 * rotation and scale. Classic texture bombing: the UV plane is a grid of cells,
 * each cell hashes out one stamp instance, and every pixel checks its own cell
 * plus the 8 neighbours (so stamps may overflow a cell) and composites whatever
 * covers it.
 *
 * Inputs:
 *   stamp      — the element to scatter (its alpha is the cut-out).
 *   mask       — optional density field: a cell only spawns where the mask is
 *                bright (stars denser along a band, etc). Uses maskChannel.
 *   background — optional backdrop the stamps land on (else transparent).
 *
 * Notes / honest limits:
 *   - 3×3 neighbourhood assumes a stamp fits within roughly one cell (scale ≲ 1).
 *     Much larger stamps get clipped at the search edge — raise Density instead.
 *   - textureLod(...,0) avoids mip seams from the UV discontinuity at cell edges.
 *   - Tileable wraps cell ids by Density so the result tiles seamlessly (EnvCube,
 *     stratum-style textures). Everything is seeded — no clock, reproducible.
 */

import { registerNode } from '../registry.js';

const MODES = ['Blend', 'Add', 'Subtract', 'Multiply', 'Divide', 'Screen', 'Overlay', 'Max', 'Min', 'Difference'];
const DIST = ['Random', 'Grid'];
const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_stamp; // u_in0
uniform sampler2D u_mask;  // u_in1 (density)
uniform sampler2D u_bg;    // u_in2 (background)
uniform int   u_hasMask, u_hasBg;
uniform float u_density;
uniform float u_jitter;
uniform float u_seed;
uniform int   u_mode;
uniform int   u_maskSrc;
uniform float u_minScale, u_maxScale;
uniform float u_minRot, u_maxRot; // radians
uniform int   u_tileable;
uniform float u_aspect; // w / h

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hash3(vec2 p) {
  return fract(sin(vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)))) * 43758.5453);
}
float maskValue(vec4 m, int s) {
  if (s == 1) return m.r;
  if (s == 2) return m.g;
  if (s == 3) return m.b;
  if (s == 4) return m.a;
  return dot(m.rgb, vec3(0.2126, 0.7152, 0.0722));
}
vec3 blend(vec3 b, vec3 o, int m) {
  if (m == 1) return b + o;
  if (m == 2) return b - o;
  if (m == 3) return b * o;
  if (m == 4) return b / max(o, vec3(1e-4));
  if (m == 5) return 1.0 - (1.0 - b) * (1.0 - o);
  if (m == 6) return mix(2.0*b*o, 1.0 - 2.0*(1.0-b)*(1.0-o), step(0.5, b));
  if (m == 7) return max(b, o);
  if (m == 8) return min(b, o);
  if (m == 9) return abs(b - o);
  return o;
}
vec4 over(vec4 dst, vec4 src, int m) {
  float a = src.a;
  return vec4(mix(dst.rgb, blend(dst.rgb, src.rgb, m), a), dst.a + a * (1.0 - dst.a));
}

void main() {
  vec4 acc = u_hasBg == 1 ? texture(u_bg, v_uv) : vec4(0.0);
  vec2 id0 = floor(v_uv * u_density);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = id0 + vec2(float(i), float(j));
      vec2 hid = u_tileable == 1 ? mod(id, u_density) : id; // wrap the hash for tiling
      vec3 h = hash3(hid + u_seed);
      vec2 center = (id + 0.5 + (h.xy - 0.5) * u_jitter) / u_density;
      if (u_hasMask == 1) {
        float dm = maskValue(texture(u_mask, clamp(center, 0.0, 1.0)), u_maskSrc);
        if (hash1(hid + u_seed + 29.0) > dm) continue; // thin out where dark
      }
      float rot = mix(u_minRot, u_maxRot, hash1(hid + u_seed + 7.0));
      float scl = mix(u_minScale, u_maxScale, h.z);
      if (scl < 1e-4) continue;
      vec2 d = v_uv - center;
      d.x *= u_aspect;
      float s = sin(-rot), c = cos(-rot);
      vec2 rd = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
      vec2 su = rd / (scl / u_density) + 0.5;
      if (all(greaterThanEqual(su, vec2(0.0))) && all(lessThanEqual(su, vec2(1.0)))) {
        acc = over(acc, textureLod(u_stamp, su, 0.0), u_mode);
      }
    }
  }
  fragColor = acc;
}`;

registerNode({
  type: 'scatter',
  category: 'compositor',
  label: 'Scatter',
  accent: '#ffb454',
  params: {
    distribution: { type: 'select', label: 'Distribution', default: 'Random', options: DIST },
    density:      { type: 'f', label: 'Density', default: 8, min: 1, max: 64, step: 1 },
    jitter:       { type: 'f', label: 'Jitter', default: 1, min: 0, max: 1, step: 0.01 },
    blendMode:    { type: 'select', label: 'Blend mode', default: 'Blend', options: MODES },
    minScale:     { type: 'f', label: 'Min scale', default: 0.3, min: 0.01, max: 2, step: 0.01 },
    maxScale:     { type: 'f', label: 'Max scale', default: 0.6, min: 0.01, max: 2, step: 0.01 },
    minRot:       { type: 'f', label: 'Min rotation', default: 0, min: -360, max: 360, step: 1 },
    maxRot:       { type: 'f', label: 'Max rotation', default: 360, min: -360, max: 360, step: 1 },
    seed:         { type: 'f', label: 'Seed', default: 1, min: 0, max: 9999, step: 1 },
    tileable:     { type: 'b', label: 'Tileable', default: true },
    maskChannel:  { type: 'select', label: 'Mask channel', default: 'Luminance', options: SOURCES },
  },
  inputs: [{ name: 'stamp' }, { name: 'mask' }, { name: 'background' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return; // no stamp → nothing to scatter
    const any = inputs.find(Boolean);
    const grid = params.distribution === 'Grid';
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0], inputs[1] || any, inputs[2] || any],
      uniforms: {
        u_hasMask:  { type: 'i', value: inputs[1] ? 1 : 0 },
        u_hasBg:    { type: 'i', value: inputs[2] ? 1 : 0 },
        u_density:  { type: 'f', value: Math.max(1, params.density ?? 8) },
        u_jitter:   { type: 'f', value: grid ? 0 : (params.jitter ?? 1) },
        u_seed:     { type: 'f', value: params.seed ?? 1 },
        u_mode:     { type: 'i', value: Math.max(0, MODES.indexOf(params.blendMode)) },
        u_maskSrc:  { type: 'i', value: Math.max(0, SOURCES.indexOf(params.maskChannel)) },
        u_minScale: { type: 'f', value: params.minScale ?? 0.3 },
        u_maxScale: { type: 'f', value: params.maxScale ?? 0.6 },
        u_minRot:   { type: 'f', value: ((params.minRot ?? 0) * Math.PI) / 180 },
        u_maxRot:   { type: 'f', value: ((params.maxRot ?? 360) * Math.PI) / 180 },
        u_tileable: { type: 'i', value: params.tileable ? 1 : 0 },
        u_aspect:   { type: 'f', value: target.w / target.h },
      },
    });
  },
});
