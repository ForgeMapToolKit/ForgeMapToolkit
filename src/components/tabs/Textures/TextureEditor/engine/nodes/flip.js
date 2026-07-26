/**
 * flip.js — mirror the input horizontally, vertically, or diagonally.
 *
 * One dropdown, one input, one output. Diagonal transposes x/y (mirrors
 * along the top-left→bottom-right axis) rather than doing a 180° rotate —
 * that's what "horizontal + vertical" combined would give you instead.
 *
 * Naming follows the mirror axis, not the direction of movement: "Vertical"
 * mirrors across the vertical center line (swaps left/right), "Horizontal"
 * mirrors across the horizontal center line (swaps top/bottom).
 */

import { registerNode } from '../registry.js';

const MODES = ['Vertical', 'Horizontal', 'Diagonal'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int u_mode;
void main() {
  vec2 p = v_uv;
  if (u_mode == 0) p = vec2(1.0 - p.x, p.y);
  else if (u_mode == 1) p = vec2(p.x, 1.0 - p.y);
  else p = p.yx;
  fragColor = texture(u_in0, p);
}`;

registerNode({
  type: 'flip',
  category: 'modifier',
  label: 'Flip',
  accent: '#b98cff',
  params: {
    mode: { type: 'select', label: 'Direction', default: 'Vertical', options: MODES },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_mode: { type: 'i', value: Math.max(0, MODES.indexOf(params.mode)) },
      },
    });
  },
});
