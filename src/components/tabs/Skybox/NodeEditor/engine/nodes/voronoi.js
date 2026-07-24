/**
 * voronoi.js — Worley (cellular) noise. A Source, the complement to FBM.
 *
 * Scatters one feature point per grid cell and, per pixel, measures distance to
 * the nearest points. Three outputs:
 *   F1 Distance — distance to the nearest point: round blobs / bubbles.
 *   Cells       — a flat random grey per cell: a mosaic / stained-glass field.
 *   Edges       — F2-F1, near 0 on cell borders: cracks, veins, scales.
 * `jitter` slides feature points from the cell centre (1) to a rigid grid (0).
 * Greyscale out (RGB = value, A = 1) — feed into a Gradient map to colour it.
 */

import { registerNode } from '../registry.js';

const MODES = ['F1 Distance', 'Cells', 'Edges'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_scale;
uniform vec2  u_seed;
uniform float u_jitter;
uniform int   u_mode;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = v_uv * u_scale + u_seed;
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  vec2 cell = ip;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(ip + g + u_seed) * u_jitter + (0.5 - 0.5 * u_jitter);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; cell = ip + g; }
      else if (d < f2) { f2 = d; }
    }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
  float v;
  if (u_mode == 1) v = hash1(cell + u_seed);
  else if (u_mode == 2) v = clamp(f2 - f1, 0.0, 1.0);
  else v = clamp(f1, 0.0, 1.0);
  fragColor = vec4(vec3(v), 1.0);
}`;

registerNode({
  type: 'voronoi',
  category: 'source',
  label: 'Voronoi',
  accent: '#5ec8ff',
  params: {
    mode:   { type: 'select', label: 'Output', default: 'F1 Distance', options: MODES },
    scale:  { type: 'f', label: 'Scale', default: 6, min: 0.5, max: 64, step: 0.5 },
    jitter: { type: 'f', label: 'Jitter', default: 1, min: 0, max: 1, step: 0.01 },
    seedX:  { type: 'f', label: 'Seed X', default: 0, min: 0, max: 100, step: 1 },
    seedY:  { type: 'f', label: 'Seed Y', default: 0, min: 0, max: 100, step: 1 },
  },
  inputs: [],
  render(ctx, { params, target }) {
    ctx.pass(ctx.program(FRAG), {
      target,
      uniforms: {
        u_scale:  { type: 'f', value: params.scale ?? 6 },
        u_seed:   { type: 'v2', value: [params.seedX ?? 0, params.seedY ?? 0] },
        u_jitter: { type: 'f', value: params.jitter ?? 1 },
        u_mode:   { type: 'i', value: Math.max(0, MODES.indexOf(params.mode)) },
      },
    });
  },
});
