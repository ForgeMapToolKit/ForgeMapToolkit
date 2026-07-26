/**
 * solidColor.js — a flat colour source.
 * Trivial, but useful as a compositing constant and as a pipeline probe.
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec4 u_color;
void main() { fragColor = u_color; }`;

registerNode({
  type: 'solid-color',
  category: 'source',
  label: 'Solid Colour',
  accent: '#ffcf6b',
  params: {
    color: { type: 'color', label: 'Colour', default: '#808080' },
    alpha: { type: 'f', label: 'Alpha', default: 1, min: 0, max: 1, step: 0.01 },
  },
  inputs: [],
  render(ctx, { params, target }) {
    const [r, g, b] = hexToRgb(params.color);
    ctx.pass(ctx.program(FRAG), {
      target,
      uniforms: { u_color: { type: 'v4', value: [r, g, b, params.alpha ?? 1] } },
    });
  },
});
