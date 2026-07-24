/**
 * warp.js — "Warp / Displace", offset a texture's lookup by a second field.
 *
 * `out(uv) = in(uv + offset)`. Two ways to build the offset:
 *   Vector (RG)  — reads the warp field's R,G as a 2D vector (0.5 = no shift).
 *                  This is domain warping: feed Noise in to get turbulent,
 *                  marbled, flame-like distortion.
 *   Directional  — reads one channel (luminance by default) as a scalar and
 *                  pushes along a fixed angle. This is displacement: a height
 *                  field shoves pixels one way, like parallax or drift.
 *
 * Amount is in UV units (0.1 = up to a tenth of the image). Sampling past the
 * edge clamps (targets are CLAMP_TO_EDGE), so keep amount modest or the border
 * smears — same trade-off as Transform.
 */

import { registerNode } from '../registry.js';

const MODES = ['Vector (RG)', 'Directional'];
const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // source
uniform sampler2D u_in1; // warp field
uniform int   u_hasWarp;
uniform int   u_mode;
uniform int   u_src;
uniform float u_amount;
uniform float u_angle; // radians

float chan(vec4 c, int s) {
  if (s == 1) return c.r;
  if (s == 2) return c.g;
  if (s == 3) return c.b;
  if (s == 4) return c.a;
  return dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 off = vec2(0.0);
  if (u_hasWarp == 1) {
    vec4 w = texture(u_in1, v_uv);
    if (u_mode == 0) {
      off = (w.rg - 0.5) * 2.0 * u_amount;
    } else {
      float m = (chan(w, u_src) - 0.5) * 2.0 * u_amount;
      off = vec2(cos(u_angle), sin(u_angle)) * m;
    }
  }
  fragColor = texture(u_in0, v_uv + off);
}`;

registerNode({
  type: 'warp',
  category: 'modifier',
  label: 'Warp / Displace',
  accent: '#b98cff',
  params: {
    mode:   { type: 'select', label: 'Mode', default: 'Vector (RG)', options: MODES },
    source: { type: 'select', label: 'Channel (directional)', default: 'Luminance', options: SOURCES },
    amount: { type: 'f', label: 'Amount', default: 0.1, min: 0, max: 0.5, step: 0.005 },
    angle:  { type: 'f', label: 'Angle (directional)', default: 0, min: 0, max: 360, step: 1 },
  },
  inputs: [{ name: 'in' }, { name: 'warp' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0], inputs[1] || any],
      uniforms: {
        u_hasWarp: { type: 'i', value: inputs[1] ? 1 : 0 },
        u_mode:    { type: 'i', value: Math.max(0, MODES.indexOf(params.mode)) },
        u_src:     { type: 'i', value: Math.max(0, SOURCES.indexOf(params.source)) },
        u_amount:  { type: 'f', value: params.amount ?? 0.1 },
        u_angle:   { type: 'f', value: ((params.angle ?? 0) * Math.PI) / 180 },
      },
    });
  },
});
