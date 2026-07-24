/**
 * brightnessContrast.js — the two dials Levels doesn't give you directly.
 * One input, one output, alpha passes. Brightness is additive; contrast
 * pivots around mid-grey (0.5) so a contrast change never shifts the midtone.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_brightness, u_contrast;
void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 rgb = (c.rgb - 0.5) * u_contrast + 0.5 + u_brightness;
  fragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`;

registerNode({
  type: 'brightness-contrast',
  category: 'modifier',
  label: 'Brightness / Contrast',
  accent: '#b98cff',
  params: {
    brightness: { type: 'f', label: 'Brightness', default: 0, min: -1, max: 1, step: 0.01 },
    contrast:   { type: 'f', label: 'Contrast', default: 1, min: 0, max: 3, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_brightness: { type: 'f', value: params.brightness ?? 0 },
        u_contrast:   { type: 'f', value: params.contrast ?? 1 },
      },
    });
  },
});
