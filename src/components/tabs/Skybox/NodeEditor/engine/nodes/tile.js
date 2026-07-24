/**
 * tile.js — repeat the input across a grid. One input, one output.
 * `fract(uv * tiles)` keeps every sample inside [0,1), so it tiles cleanly
 * even though the render targets are CLAMP_TO_EDGE (no REPEAT wrap needed).
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec2 u_tiles;
void main() {
  fragColor = texture(u_in0, fract(v_uv * u_tiles));
}`;

registerNode({
  type: 'tile',
  category: 'modifier',
  label: 'Tile',
  accent: '#b98cff',
  params: {
    x: { type: 'i', label: 'Tiles X', default: 2 },
    y: { type: 'i', label: 'Tiles Y', default: 2 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: { u_tiles: { type: 'v2', value: [Math.max(1, params.x || 1), Math.max(1, params.y || 1)] } },
    });
  },
});
