/**
 * hsv.js — hue / saturation / value adjust. One input, one output.
 * Hue rotates (0..1 = full turn), saturation and value scale. Alpha passes.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_hue, u_sat, u_val;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 hsv = rgb2hsv(c.rgb);
  hsv.x = fract(hsv.x + u_hue);
  hsv.y = clamp(hsv.y * u_sat, 0.0, 1.0);
  hsv.z = clamp(hsv.z * u_val, 0.0, 1.0);
  fragColor = vec4(hsv2rgb(hsv), c.a);
}`;

registerNode({
  type: 'hsv',
  category: 'modifier',
  label: 'Hue / Sat / Val',
  accent: '#b98cff',
  params: {
    hue: { type: 'f', label: 'Hue shift', default: 0, min: 0, max: 1, step: 0.005 },
    sat: { type: 'f', label: 'Saturation', default: 1, min: 0, max: 2, step: 0.01 },
    val: { type: 'f', label: 'Value', default: 1, min: 0, max: 2, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_hue: { type: 'f', value: params.hue ?? 0 },
        u_sat: { type: 'f', value: params.sat ?? 1 },
        u_val: { type: 'f', value: params.val ?? 1 },
      },
    });
  },
});
