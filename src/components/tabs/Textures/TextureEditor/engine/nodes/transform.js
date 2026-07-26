/**
 * transform.js — offset / scale / rotate the input in UV space. One input.
 *
 * Two ways to set the offset (plan §6.1): type x/y directly, or tick "Drag in
 * viewport" and drag the object in the preview — TextureEditor.jsx wires that
 * drag straight into params.x/y (Viewport's onObjectDrag), so it's still just
 * numbers in the document, never separate interaction state.
 * Samples the input at the inverse-transformed UV; anything that maps outside
 * [0,1] reads as transparent, so a scaled-down layer sits on a clear field
 * ready for a Blend node.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec2  u_offset;
uniform float u_scale;
uniform float u_rot;   // radians
void main() {
  vec2 p = v_uv - 0.5 - u_offset;
  float c = cos(-u_rot), s = sin(-u_rot);
  p = mat2(c, -s, s, c) * p;
  p = p / max(u_scale, 1e-4) + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { fragColor = vec4(0.0); return; }
  fragColor = texture(u_in0, p);
}`;

registerNode({
  type: 'transform',
  category: 'modifier',
  label: 'Transform',
  accent: '#b98cff',
  params: {
    drag:  { type: 'b', label: 'Drag in viewport', default: false },
    x:     { type: 'f', label: 'Offset X', default: 0, min: -1, max: 1, step: 0.005 },
    y:     { type: 'f', label: 'Offset Y', default: 0, min: -1, max: 1, step: 0.005 },
    scale: { type: 'f', label: 'Scale', default: 1, min: 0.05, max: 4, step: 0.01 },
    rot:   { type: 'f', label: 'Rotation°', default: 0, min: 0, max: 360, step: 1 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_offset: { type: 'v2', value: [params.x ?? 0, params.y ?? 0] },
        u_scale:  { type: 'f', value: params.scale ?? 1 },
        u_rot:    { type: 'f', value: ((params.rot ?? 0) * Math.PI) / 180 },
      },
    });
  },
});
