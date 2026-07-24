/**
 * alphaSubtract.js — carve real transparency gaps into an alpha channel.
 *
 * A Threshold'd noise mask on its own rarely produces true 0 regions — FBM
 * noise clusters around its mean, so even a well-tuned cutoff mostly yields a
 * soft gradient hovering above zero, not real holes. This node fixes that by
 * subtracting a SECOND mask's value straight out of `base`'s alpha: wherever
 * the subtract input is strong, alpha gets pushed toward (and past) 0,
 * punching an actual gap rather than just dimming.
 *
 * Typical use: base = Noise → Threshold (the cloud shape), subtract =
 * a different Noise → Threshold (an independent "hole" pattern, different
 * seed/scale so the gaps don't just retrace the cloud shape itself). RGB
 * passes through untouched — this only ever touches alpha.
 */

import { registerNode } from '../registry.js';

const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // base
uniform sampler2D u_in1; // subtract mask
uniform int   u_src;
uniform float u_amount;
uniform int   u_hasBase, u_hasMask;

void main() {
  vec4 base = u_hasBase == 1 ? texture(u_in0, v_uv) : vec4(0.0);
  if (u_hasMask == 0) { fragColor = base; return; }
  vec4 m = texture(u_in1, v_uv);
  float v = m.a;
  if (u_src == 1) v = m.r;
  else if (u_src == 2) v = m.g;
  else if (u_src == 3) v = m.b;
  else if (u_src == 0) v = dot(m.rgb, vec3(0.2126, 0.7152, 0.0722));
  float outA = clamp(base.a - v * u_amount, 0.0, 1.0);
  fragColor = vec4(base.rgb, outA);
}`;

registerNode({
  type: 'alpha-subtract',
  category: 'compositor',
  label: 'Alpha Subtract',
  accent: '#ffb454',
  params: {
    source: { type: 'select', label: 'Mask from', default: 'Luminance', options: SOURCES },
    amount: { type: 'f', label: 'Amount', default: 1, min: 0, max: 4, step: 0.01 },
  },
  inputs: [{ name: 'base' }, { name: 'subtract' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0] && !inputs[1]) return;
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any],
      uniforms: {
        u_src:     { type: 'i', value: Math.max(0, SOURCES.indexOf(params.source)) },
        u_amount:  { type: 'f', value: params.amount ?? 1 },
        u_hasBase: { type: 'i', value: inputs[0] ? 1 : 0 },
        u_hasMask: { type: 'i', value: inputs[1] ? 1 : 0 },
      },
    });
  },
});
