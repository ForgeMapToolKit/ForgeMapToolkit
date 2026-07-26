/**
 * glow.js — "Glow / Bloom", one input. Bright-pass → blur → add back.
 *
 * Isolates the bright parts of the image (luminance above threshold, softened
 * by knee), blurs them wide, then adds the blur back over the original. Made
 * for skyboxes: star/planet/sun halos, lifting cirrus. Two blur iterations
 * (separable H/V ×2) give a smoother spread than a single 9-tap at large radius.
 *
 * Mode:
 *   Add    — glow accumulates on top (hotter, can blow out).
 *   Screen — glow lightens without clipping to white (softer, safer default).
 */

import { registerNode } from '../registry.js';

const MODES = ['Screen', 'Add'];

const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_thr;
uniform float u_knee;
void main() {
  vec4 c = texture(u_in0, v_uv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(u_thr, u_thr + max(u_knee, 1e-3), l);
  fragColor = vec4(c.rgb * k, c.a * k);
}`;

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
uniform sampler2D u_in1; // blurred glow
uniform float u_intensity;
uniform int   u_mode;
void main() {
  vec4 b = texture(u_in0, v_uv);
  vec3 g = clamp(texture(u_in1, v_uv).rgb * u_intensity, 0.0, 4.0);
  vec3 rgb = u_mode == 1
    ? b.rgb + g                                  // add
    : 1.0 - (1.0 - b.rgb) * (1.0 - clamp(g, 0.0, 1.0)); // screen
  fragColor = vec4(clamp(rgb, 0.0, 1.0), b.a);
}`;

registerNode({
  type: 'glow',
  category: 'modifier',
  label: 'Glow / Bloom',
  accent: '#b98cff',
  params: {
    threshold: { type: 'f', label: 'Threshold', default: 0.6, min: 0, max: 1, step: 0.01 },
    knee:      { type: 'f', label: 'Knee', default: 0.1, min: 0, max: 1, step: 0.01 },
    radius:    { type: 'f', label: 'Radius (px)', default: 8, min: 0.5, max: 32, step: 0.5 },
    intensity: { type: 'f', label: 'Intensity', default: 1, min: 0, max: 4, step: 0.05 },
    mode:      { type: 'select', label: 'Mode', default: 'Screen', options: MODES },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const r = params.radius ?? 8;
    const bright = ctx.program(BRIGHT_FRAG);
    const blur = ctx.program(BLUR_FRAG);
    const tmpA = ctx.allocTarget(target.w, target.h);
    const tmpB = ctx.allocTarget(target.w, target.h);
    try {
      ctx.pass(bright, {
        target: tmpA, inputs: [inputs[0]],
        uniforms: { u_thr: { type: 'f', value: params.threshold ?? 0.6 }, u_knee: { type: 'f', value: params.knee ?? 0.1 } },
      });
      // Two separable blur iterations for a smooth spread.
      for (let it = 0; it < 2; it++) {
        ctx.pass(blur, { target: tmpB, inputs: [tmpA.tex], uniforms: { u_step: { type: 'v2', value: [r / target.w, 0] } } });
        ctx.pass(blur, { target: tmpA, inputs: [tmpB.tex], uniforms: { u_step: { type: 'v2', value: [0, r / target.h] } } });
      }
      ctx.pass(ctx.program(COMBINE_FRAG), {
        target, inputs: [inputs[0], tmpA.tex],
        uniforms: {
          u_intensity: { type: 'f', value: params.intensity ?? 1 },
          u_mode:      { type: 'i', value: Math.max(0, MODES.indexOf(params.mode)) },
        },
      });
    } finally {
      ctx.freeTarget(tmpA);
      ctx.freeTarget(tmpB);
    }
  },
});
