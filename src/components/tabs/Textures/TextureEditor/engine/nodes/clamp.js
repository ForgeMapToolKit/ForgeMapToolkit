/**
 * clamp.js — clamp RGB into [lo, hi]. One input, one output. Alpha passes
 * through. Handy before an export to guarantee a channel stays in range.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_lo, u_hi;
void main() {
  vec4 c = texture(u_in0, v_uv);
  fragColor = vec4(clamp(c.rgb, vec3(u_lo), vec3(u_hi)), c.a);
}`;

registerNode({
  type: 'clamp',
  category: 'modifier',
  label: 'Clamp',
  accent: '#b98cff',
  params: {
    lo: { type: 'f', label: 'Min', default: 0, min: 0, max: 1, step: 0.01 },
    hi: { type: 'f', label: 'Max', default: 1, min: 0, max: 1, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: { u_lo: { type: 'f', value: params.lo ?? 0 }, u_hi: { type: 'f', value: params.hi ?? 1 } },
    });
  },
});
