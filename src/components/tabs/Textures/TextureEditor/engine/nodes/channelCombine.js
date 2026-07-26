/**
 * channelCombine.js — build an RGBA image from four grayscale inputs.
 *
 * Each input contributes its red channel to one output channel (R←in0.r,
 * G←in1.r, …). Missing inputs default to 0 for RGB and 1 for A, so wiring only
 * the alpha slot gives a white-RGB, custom-alpha mask. The counterpart split
 * would need multi-output sockets (not yet in the graph), so this is the
 * combine half of channel-split/combine for now.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0, u_in1, u_in2, u_in3;
uniform vec4 u_has;   // 1 if the matching input is wired, else 0
uniform float u_aDefault;
void main() {
  float r = u_has.x > 0.5 ? texture(u_in0, v_uv).r : 0.0;
  float g = u_has.y > 0.5 ? texture(u_in1, v_uv).r : 0.0;
  float b = u_has.z > 0.5 ? texture(u_in2, v_uv).r : 0.0;
  float a = u_has.w > 0.5 ? texture(u_in3, v_uv).r : u_aDefault;
  fragColor = vec4(r, g, b, a);
}`;

registerNode({
  type: 'channel-combine',
  category: 'compositor',
  label: 'Channel Combine',
  accent: '#ffb454',
  params: {},
  inputs: [{ name: 'R' }, { name: 'G' }, { name: 'B' }, { name: 'A' }],
  render(ctx, { inputs, target }) {
    if (!inputs.some(Boolean)) return;
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any, inputs[2] || any, inputs[3] || any],
      uniforms: {
        u_has: { type: 'v4', value: [inputs[0] ? 1 : 0, inputs[1] ? 1 : 0, inputs[2] ? 1 : 0, inputs[3] ? 1 : 0] },
        u_aDefault: { type: 'f', value: 1 },
      },
    });
  },
});
