/**
 * levels.js — tonal Levels modifier (black/white point, gamma, output range).
 * One input, one output. Applied per RGB channel; alpha passes through.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_inBlack, u_inWhite, u_gamma, u_outBlack, u_outWhite;

void main() {
  vec4 c = texture(u_in0, v_uv);
  float denom = max(u_inWhite - u_inBlack, 1e-4);
  vec3 rgb = clamp((c.rgb - u_inBlack) / denom, 0.0, 1.0);
  rgb = pow(rgb, vec3(1.0 / max(u_gamma, 1e-3)));
  rgb = mix(vec3(u_outBlack), vec3(u_outWhite), rgb);
  fragColor = vec4(rgb, c.a);
}`;

registerNode({
  type: 'levels',
  category: 'modifier',
  label: 'Levels',
  accent: '#c0a0ff',
  params: {
    inBlack:  { type: 'f', label: 'Input black',  default: 0,   min: 0, max: 1, step: 0.01 },
    inWhite:  { type: 'f', label: 'Input white',  default: 1,   min: 0, max: 1, step: 0.01 },
    gamma:    { type: 'f', label: 'Gamma',        default: 1,   min: 0.1, max: 4, step: 0.01 },
    outBlack: { type: 'f', label: 'Output black', default: 0,   min: 0, max: 1, step: 0.01 },
    outWhite: { type: 'f', label: 'Output white', default: 1,   min: 0, max: 1, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return; // nothing wired in → leave target cleared
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0]],
      uniforms: {
        u_inBlack:  { type: 'f', value: params.inBlack },
        u_inWhite:  { type: 'f', value: params.inWhite },
        u_gamma:    { type: 'f', value: params.gamma },
        u_outBlack: { type: 'f', value: params.outBlack },
        u_outWhite: { type: 'f', value: params.outWhite },
      },
    });
  },
});
