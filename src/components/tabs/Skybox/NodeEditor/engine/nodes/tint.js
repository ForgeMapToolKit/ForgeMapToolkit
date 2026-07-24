/**
 * tint.js — multiply RGB by a colour. One input, one output. Alpha passes.
 * `amount` blends between the original and the tinted result, so you can dial
 * a wash in gradually instead of an all-or-nothing multiply.
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec3  u_tint;
uniform float u_amount;
void main() {
  vec4 c = texture(u_in0, v_uv);
  fragColor = vec4(mix(c.rgb, c.rgb * u_tint, u_amount), c.a);
}`;

registerNode({
  type: 'tint',
  category: 'modifier',
  label: 'Tint',
  accent: '#b98cff',
  params: {
    color:  { type: 'color', label: 'Tint colour', default: '#ffffff' },
    amount: { type: 'f', label: 'Amount', default: 1, min: 0, max: 1, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_tint:   { type: 'v3', value: hexToRgb(params.color) },
        u_amount: { type: 'f', value: params.amount ?? 1 },
      },
    });
  },
});
