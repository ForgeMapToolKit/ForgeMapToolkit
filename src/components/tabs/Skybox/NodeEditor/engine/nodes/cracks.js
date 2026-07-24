/**
 * cracks.js — "Cracks", a Source. Voronoi cell edges (F2-F1), domain-warped
 * so the lines read as organic fissures instead of straight polygon borders,
 * then thresholded to a clean line width.
 *
 * Greyscale out (RGB = crack value, A = 1) — same convention as Noise/Voronoi,
 * so it composes the same way: feed a Gradient Map to colourise, Threshold to
 * harden further, or straight into an Alpha-consuming node.
 *
 * `warp` bends the sample point through a small value-noise field BEFORE the
 * Voronoi lookup — at warp=0 you get plain polygonal Voronoi edges (the
 * un-warped case is a legitimate look too, e.g. dried-mud tiling), higher
 * values curve the lines. `warpScale` is the warp noise's own frequency,
 * independent of the crack cell `scale` — low warpScale = long lazy bends,
 * high = jittery short wiggles.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_scale;
uniform vec2  u_seed;
uniform float u_jitter;
uniform float u_width;
uniform float u_warp;
uniform float u_warpScale;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float vhash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = vhash(i), b = vhash(i + vec2(1, 0)), c = vhash(i + vec2(0, 1)), d = vhash(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec2 warpOffset(vec2 p) {
  return (vec2(vnoise(p + vec2(11.3, 4.7)), vnoise(p + vec2(53.1, 91.7))) - 0.5) * 2.0;
}

void main() {
  vec2 p = v_uv * u_scale + u_seed;
  p += warpOffset(p * u_warpScale) * u_warp;

  vec2 ip = floor(p), fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(ip + g + u_seed) * u_jitter + (0.5 - 0.5 * u_jitter);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  float edge = sqrt(f2) - sqrt(f1);
  float crack = 1.0 - smoothstep(0.0, max(u_width, 1e-4), edge);
  fragColor = vec4(vec3(crack), 1.0);
}`;

registerNode({
  type: 'cracks',
  category: 'source',
  label: 'Cracks',
  accent: '#5ec8ff',
  params: {
    scale:     { type: 'f', label: 'Scale', default: 8, min: 0.5, max: 64, step: 0.5 },
    jitter:    { type: 'f', label: 'Jitter', default: 1, min: 0, max: 1, step: 0.01 },
    width:     { type: 'f', label: 'Line width', default: 0.08, min: 0.005, max: 0.4, step: 0.005 },
    warp:      { type: 'f', label: 'Warp amount', default: 0.4, min: 0, max: 2, step: 0.01 },
    warpScale: { type: 'f', label: 'Warp scale', default: 1.5, min: 0.1, max: 16, step: 0.1 },
    seedX:     { type: 'f', label: 'Seed X', default: 0, min: 0, max: 100, step: 1 },
    seedY:     { type: 'f', label: 'Seed Y', default: 0, min: 0, max: 100, step: 1 },
  },
  inputs: [],
  render(ctx, { params, target }) {
    ctx.pass(ctx.program(FRAG), {
      target,
      uniforms: {
        u_scale:     { type: 'f', value: params.scale ?? 8 },
        u_seed:      { type: 'v2', value: [params.seedX ?? 0, params.seedY ?? 0] },
        u_jitter:    { type: 'f', value: params.jitter ?? 1 },
        u_width:     { type: 'f', value: params.width ?? 0.08 },
        u_warp:      { type: 'f', value: params.warp ?? 0.4 },
        u_warpScale: { type: 'f', value: params.warpScale ?? 1.5 },
      },
    });
  },
});
