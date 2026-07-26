/**
 * swirl.js — "Swirl" (twirl distortion), one input. Modelled on Gaea's Swirl.
 *
 * Rotates the lookup around a centre by an angle that falls off with distance:
 * strong at the centre, zero past the radius. `out(uv) = in(rotate(uv))`. The
 * t² falloff keeps the middle spinning hard while the edge stays put, so it
 * reads as a vortex rather than a flat rotation.
 *
 * Distance is measured in aspect-corrected space (u_aspect = w/h) so the swirl
 * stays circular even on a non-square canvas (a 256×16 WaterRamp would otherwise
 * smear into an extreme ellipse). Sampling past the edge clamps.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int   u_hasIn;
uniform float u_angle;   // radians
uniform float u_radius;  // UV, aspect-corrected (square) space
uniform vec2  u_center;
uniform float u_aspect;  // w / h

void main() {
  if (u_hasIn == 0) { fragColor = vec4(0.0); return; }
  vec2 d = v_uv - u_center;
  d.x *= u_aspect;
  float r = length(d);
  float t = clamp(1.0 - r / max(u_radius, 1e-4), 0.0, 1.0);
  float ang = u_angle * t * t;
  float s = sin(ang), c = cos(ang);
  vec2 rd = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  rd.x /= u_aspect;
  fragColor = texture(u_in0, u_center + rd);
}`;

registerNode({
  type: 'swirl',
  category: 'modifier',
  label: 'Swirl',
  accent: '#b98cff',
  params: {
    degrees: { type: 'f', label: 'Degrees', default: 133, min: -720, max: 720, step: 1 },
    scale:   { type: 'f', label: 'Scale %', default: 100, min: 0, max: 200, step: 1 },
    x:       { type: 'f', label: 'Center X %', default: 50, min: 0, max: 100, step: 1 },
    y:       { type: 'f', label: 'Center Y %', default: 50, min: 0, max: 100, step: 1 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0]],
      uniforms: {
        u_hasIn:  { type: 'i', value: 1 },
        u_angle:  { type: 'f', value: ((params.degrees ?? 0) * Math.PI) / 180 },
        u_radius: { type: 'f', value: (params.scale ?? 100) / 100 },
        u_center: { type: 'v2', value: [(params.x ?? 50) / 100, (params.y ?? 50) / 100] },
        u_aspect: { type: 'f', value: target.w / target.h },
      },
    });
  },
});
