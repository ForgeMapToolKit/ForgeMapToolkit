/**
 * invert.js — invert RGB (alpha passes through). One input, one output.
 * `amount` blends between the original and the inverted colour.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_amount;
void main() {
  vec4 c = texture(u_in0, v_uv);
  fragColor = vec4(mix(c.rgb, 1.0 - c.rgb, u_amount), c.a);
}`;

registerNode({
  type: 'invert',
  category: 'modifier',
  label: 'Invert',
  accent: '#b98cff',
  params: { amount: { type: 'f', label: 'Amount', default: 1, min: 0, max: 1, step: 0.01 } },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: { u_amount: { type: 'f', value: params.amount ?? 1 } },
    });
  },
});
