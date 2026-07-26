/**
 * skyGradient.js — vertical sky backdrop for an EnvCube (docs NODE_EDITOR_PLAN §8.1).
 *
 * A Source (no inputs): a horizon→zenith vertical gradient, the base layer a
 * reflection is composited onto. In-game the sky dome is vertex-coloured by
 * WORLD HEIGHT — colour is `horizonColor` at `horizonHeight`, blends linearly
 * to `zenithColor` at `zenithHeight`, and clamps flat beyond that (`midColor`
 * exists in data.lua but the shader never reads it — it's dead data, so this
 * node doesn't have a mid stop at all).
 *
 * A texture's V axis isn't world height directly — it runs from the dome's
 * base (horizonHeight, v=0) to its actual mesh apex (apexHeight, v=1), so
 * reproducing the exact in-game proportions needs where zenithHeight falls in
 * that range: `t = (zenithHeight - horizonHeight) / (apexHeight - horizonHeight)`.
 * Read the real horizonHeight/zenithHeight/apexHeight off a map (its own
 * `sky-gradient` sub-editor) and this node lands the transition at the same
 * point in the frame the game does.
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';
import SkyGradientEditor from '../../ui/SkyGradientEditor.jsx';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec3  u_horizon, u_zenith;
uniform float u_zenithFrac; // texture-v fraction at which zenith colour is reached
void main() {
  float t = clamp(v_uv.y / max(u_zenithFrac, 1e-4), 0.0, 1.0);
  fragColor = vec4(mix(u_horizon, u_zenith, t), 1.0);
}`;

registerNode({
  type: 'sky-gradient',
  category: 'source',
  label: 'Sky Gradient',
  accent: '#5ec8ff',
  params: {
    scmapMap:      { type: 'text', label: 'Read from .scmap', default: '', editorParam: true },
    horizon:       { type: 'color', label: 'Horizon', default: '#88aacc' },
    zenith:        { type: 'color', label: 'Zenith', default: '#0a1a3a' },
    horizonHeight: { type: 'f', label: 'Horizon height', default: 0, min: -2000, max: 2000, step: 1 },
    zenithHeight:  { type: 'f', label: 'Zenith height', default: 256, min: -2000, max: 4000, step: 1 },
    apexHeight:    { type: 'f', label: 'Dome apex height', default: 512, min: 1, max: 8000, step: 1 },
  },
  inputs: [],
  editor: SkyGradientEditor,
  render(ctx, { params, target }) {
    const hH = Number(params.horizonHeight) || 0;
    const zH = Number(params.zenithHeight) || 0;
    const aH = Number(params.apexHeight) || 1;
    const zenithFrac = Math.max(0, Math.min(1, (zH - hH) / Math.max(1e-4, aH - hH)));
    ctx.pass(ctx.program(FRAG), {
      target,
      uniforms: {
        u_horizon:    { type: 'v3', value: hexToRgb(params.horizon) },
        u_zenith:     { type: 'v3', value: hexToRgb(params.zenith) },
        u_zenithFrac: { type: 'f', value: zenithFrac },
      },
    });
  },
});
