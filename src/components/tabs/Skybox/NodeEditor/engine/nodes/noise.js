/**
 * noise.js — procedural FBM value noise, with fractal variants. A Source.
 *
 * Hash-based value noise summed over octaves (fractal Brownian motion). Purely
 * a function of UV + params, so it caches and re-renders like any other node.
 * Greyscale out (RGB = value, A = 1); feed it into Levels/Curves, a Gradient
 * map or a Blend to shape it. This is the Phase-2 workhorse for detail.
 *
 * Variant shapes each octave before summing:
 *   FBM     — smooth billows, the classic sum.
 *   Ridged  — 1-|2n-1|, sharp crests (mountains, cirrus filaments, cracks).
 *   Billow  — |2n-1|, puffy lobes (cumulus, rock).
 * gain (persistence) and lacunarity tune how fast amplitude falls / frequency
 * rises across octaves — the two knobs that most change noise character.
 */

import { registerNode } from '../registry.js';

const VARIANTS = ['FBM', 'Ridged', 'Billow'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_scale;
uniform int   u_oct;
uniform vec2  u_seed;
uniform int   u_variant;
uniform float u_gain;
uniform float u_lac;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float shape(float n, int v) {
  if (v == 1) return 1.0 - abs(2.0 * n - 1.0); // ridged
  if (v == 2) return abs(2.0 * n - 1.0);        // billow
  return n;                                     // fbm
}
void main() {
  vec2 p = v_uv * u_scale + u_seed;
  float s = 0.0, amp = 0.5, f = 1.0, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_oct) break;
    s += amp * shape(vnoise(p * f), u_variant);
    norm += amp; f *= u_lac; amp *= u_gain;
  }
  float n = norm > 0.0 ? s / norm : 0.0;
  fragColor = vec4(vec3(n), 1.0);
}`;

registerNode({
  type: 'noise',
  category: 'source',
  label: 'Noise (FBM)',
  accent: '#5ec8ff',
  params: {
    variant:    { type: 'select', label: 'Variant', default: 'FBM', options: VARIANTS },
    scale:      { type: 'f', label: 'Scale', default: 6, min: 0.5, max: 64, step: 0.5 },
    octaves:    { type: 'i', label: 'Octaves', default: 4 },
    gain:       { type: 'f', label: 'Gain', default: 0.5, min: 0.1, max: 0.9, step: 0.01 },
    lacunarity: { type: 'f', label: 'Lacunarity', default: 2, min: 1.2, max: 4, step: 0.1 },
    seedX:      { type: 'f', label: 'Seed X', default: 0, min: 0, max: 100, step: 1 },
    seedY:      { type: 'f', label: 'Seed Y', default: 0, min: 0, max: 100, step: 1 },
  },
  inputs: [],
  render(ctx, { params, target }) {
    ctx.pass(ctx.program(FRAG), {
      target,
      uniforms: {
        u_scale:   { type: 'f', value: params.scale ?? 6 },
        u_oct:     { type: 'i', value: Math.max(1, Math.min(8, params.octaves || 1)) },
        u_seed:    { type: 'v2', value: [params.seedX ?? 0, params.seedY ?? 0] },
        u_variant: { type: 'i', value: Math.max(0, VARIANTS.indexOf(params.variant)) },
        u_gain:    { type: 'f', value: params.gain ?? 0.5 },
        u_lac:     { type: 'f', value: params.lacunarity ?? 2 },
      },
    });
  },
});
