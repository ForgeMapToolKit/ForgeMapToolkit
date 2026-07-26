/**
 * blur.js — separable Gaussian blur. One input, one output.
 *
 * Two passes through a shared 9-tap kernel (horizontal into a scratch target,
 * then vertical into the output) — O(2·9) samples instead of O(9²). `radius`
 * is in pixels; 0 is a near-identity pass. Alpha is blurred alongside RGB so a
 * cut-out edge softens too.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec2 u_step;   // texel size × radius, in the pass direction
const float W[9] = float[9](0.028, 0.067, 0.124, 0.179, 0.204, 0.179, 0.124, 0.067, 0.028);
void main() {
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 9; i++) {
    sum += texture(u_in0, v_uv + u_step * float(i - 4)) * W[i];
  }
  fragColor = sum;
}`;

registerNode({
  type: 'blur',
  category: 'modifier',
  label: 'Blur',
  accent: '#b98cff',
  params: { radius: { type: 'f', label: 'Radius (px)', default: 2, min: 0, max: 24, step: 0.5 } },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const r = params.radius ?? 0;
    const prog = ctx.program(FRAG);
    const tmp = ctx.allocTarget(target.w, target.h);
    try {
      ctx.pass(prog, { target: tmp, inputs: [inputs[0]], uniforms: { u_step: { type: 'v2', value: [r / target.w, 0] } } });
      ctx.pass(prog, { target, inputs: [tmp.tex], uniforms: { u_step: { type: 'v2', value: [0, r / target.h] } } });
    } finally {
      ctx.freeTarget(tmp);
    }
  },
});
