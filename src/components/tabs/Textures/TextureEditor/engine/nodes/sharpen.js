/**
 * sharpen.js — unsharp mask. One input, one output.
 *
 * Classic sharpen: blur a copy, then add back the difference between the
 * original and the blur (the high-frequency detail), scaled by amount.
 *   out = base + amount * (base - blurred)
 * `radius` sets the blur scale (what counts as "detail"); `amount` how hard the
 * edges are pushed. Three passes: separable blur (H, V) into scratch, then a
 * combine pass — the same separable trick Blur uses, so it stays O(2·9)+1.
 */

import { registerNode } from '../registry.js';

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec2 u_step;
const float W[9] = float[9](0.028, 0.067, 0.124, 0.179, 0.204, 0.179, 0.124, 0.067, 0.028);
void main() {
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 9; i++) {
    sum += texture(u_in0, v_uv + u_step * float(i - 4)) * W[i];
  }
  fragColor = sum;
}`;

const COMBINE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // base
uniform sampler2D u_in1; // blurred
uniform float u_amount;
void main() {
  vec4 b = texture(u_in0, v_uv);
  vec4 g = texture(u_in1, v_uv);
  fragColor = clamp(b + (b - g) * u_amount, 0.0, 1.0);
}`;

registerNode({
  type: 'sharpen',
  category: 'modifier',
  label: 'Sharpen',
  accent: '#b98cff',
  params: {
    amount: { type: 'f', label: 'Amount', default: 1, min: 0, max: 4, step: 0.05 },
    radius: { type: 'f', label: 'Radius (px)', default: 2, min: 0.5, max: 12, step: 0.5 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const r = params.radius ?? 2;
    const blur = ctx.program(BLUR_FRAG);
    const tmpH = ctx.allocTarget(target.w, target.h);
    const tmpV = ctx.allocTarget(target.w, target.h);
    try {
      ctx.pass(blur, { target: tmpH, inputs: [inputs[0]],  uniforms: { u_step: { type: 'v2', value: [r / target.w, 0] } } });
      ctx.pass(blur, { target: tmpV, inputs: [tmpH.tex],   uniforms: { u_step: { type: 'v2', value: [0, r / target.h] } } });
      ctx.pass(ctx.program(COMBINE_FRAG), {
        target,
        inputs: [inputs[0], tmpV.tex],
        uniforms: { u_amount: { type: 'f', value: params.amount ?? 1 } },
      });
    } finally {
      ctx.freeTarget(tmpH);
      ctx.freeTarget(tmpV);
    }
  },
});
