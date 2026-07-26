/**
 * uvRegion.js — crop a sub-rectangle out of an atlas.
 *
 * SupCom stores planets/moons/stars as regions of one atlas texture and
 * addresses them with a `uv = {x, y, z, w}` rectangle (origin + size in UV
 * space) — the same four numbers this node takes, so a value copied out of a
 * map's `skyBox.planets` entry can be pasted straight in. The picked region is
 * stretched to fill the canvas, ready for a Transform + Blend.
 *
 * Quadrant presets cover the common 2×2 atlas layout (the stock
 * Decal_test_Albedo003.dds is laid out that way).
 */

import { registerNode } from '../registry.js';
import UvRegionEditor from '../../ui/UvRegionEditor.jsx';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec4 u_rect;   // x, y, w, h in UV space
void main() {
  vec2 size = max(u_rect.zw, vec2(1e-4));
  fragColor = texture(u_in0, u_rect.xy + v_uv * size);
}`;

registerNode({
  type: 'uv-region',
  category: 'modifier',
  label: 'UV Region',
  accent: '#b98cff',
  params: {
    region: { type: 'uvrect', label: 'Atlas region', default: { x: 0, y: 0, z: 0.5, w: 0.5 }, editorParam: true },
  },
  inputs: [{ name: 'atlas' }],
  editor: UvRegionEditor,
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const r = params.region || {};
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0]],
      uniforms: {
        u_rect: {
          type: 'v4',
          value: [Number(r.x) || 0, Number(r.y) || 0, Number(r.z) || 1, Number(r.w) || 1],
        },
      },
    });
  },
});
