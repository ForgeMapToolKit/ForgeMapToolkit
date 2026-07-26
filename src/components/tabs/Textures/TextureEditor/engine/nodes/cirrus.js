/**
 * cirrus.js — reproduces `sky.fx`'s `CirrusPS` exactly (@D:\fa\effects\sky.fx).
 *
 * ONE cirrus texture is sampled four times, at four independently-scrolling
 * UVs, and each sample reads a DIFFERENT colour channel — layer 1→R, 2→G,
 * 3→B, 4→A (`CirrusPS`: `.r`/`.g`/`.b`/`.a` on the four `tex2D` calls) — then
 * all four are MULTIPLIED, not averaged or summed:
 *
 *     alpha = cirrusMultiplier * c0 * c1 * c2 * c3
 *
 * That product is unforgiving: if ANY one channel is 0 anywhere on the
 * texture, cirrus vanishes there entirely no matter what the other three
 * channels hold — a texture only has real cirrus cover where R, G, B AND A
 * are simultaneously nonzero. A hand-authored cirrus texture needs real noise
 * data in all four channels, everywhere (no dead/black areas in any one
 * channel) — see `channel-combine` + `noise` to build one (four independent
 * noise chains → R/G/B/A), and keep every channel's floor above 0 (Levels'
 * output-black, Brightness, or Clamp) so no channel ever actually hits 0.
 *
 * Output is straight (non-premultiplied) colour + alpha — `CirrusPS` returns
 * `float4(cirrusColor, alpha)` and the engine blends it with standard
 * SrcAlpha/InvSrcAlpha, so this node's `Combine` downstream (which also
 * expects straight alpha) composites it the same way the game does.
 *
 * Per-layer UV (`computeCirrusCoord`): world position is rotated into the
 * layer's own direction (the same reflection-style matrix the shader builds
 * from `direction`), then scaled by an independent frequencyX/Y, then
 * scrolled by `speed·time` along that direction. `time` is a parameter, not a
 * clock — the graph must render the same image twice (NODE_EDITOR_PLAN §1.1),
 * so you scrub it to pick a frame instead of it animating on its own.
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';
import CirrusEditor from '../../ui/CirrusEditor.jsx';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec4  u_freqX, u_freqY; // per layer
uniform vec4  u_dir;            // per-layer direction, radians
uniform vec4  u_speed;
uniform float u_time;
uniform vec3  u_color;
uniform float u_mult;

// Mirrors computeCirrusCoord() in sky.fx: rotate p into the layer's
// direction frame, scale by (freqX,freqY), scroll by speed*time along dir.
float cirrusChannel(vec2 p, float fx, float fy, float dirRad, float speed, int channel) {
  vec2 dir = vec2(cos(dirRad), sin(dirRad));
  vec2 rotated = vec2(dot(p, dir), p.x * dir.y - p.y * dir.x);
  vec2 uv = fract(vec2(fx, fy) * (rotated - u_time * speed * dir));
  vec4 c = texture(u_in0, uv);
  if (channel == 0) return c.r;
  if (channel == 1) return c.g;
  if (channel == 2) return c.b;
  return c.a;
}

void main() {
  float c0 = cirrusChannel(v_uv, u_freqX.x, u_freqY.x, u_dir.x, u_speed.x, 0);
  float c1 = cirrusChannel(v_uv, u_freqX.y, u_freqY.y, u_dir.y, u_speed.y, 1);
  float c2 = cirrusChannel(v_uv, u_freqX.z, u_freqY.z, u_dir.z, u_speed.z, 2);
  float c3 = cirrusChannel(v_uv, u_freqX.w, u_freqY.w, u_dir.w, u_speed.w, 3);
  float alpha = clamp(u_mult * c0 * c1 * c2 * c3, 0.0, 1.0);
  fragColor = vec4(u_color, alpha);
}`;

const v4 = (a, b, c, d) => ({ type: 'v4', value: [a, b, c, d] });
const rad = (d) => ((Number(d) || 0) * Math.PI) / 180;

registerNode({
  type: 'cirrus',
  category: 'modifier',
  label: 'Cirrus',
  accent: '#b98cff',
  params: {
    scmapMap: { type: 'text', label: 'Read from .scmap', default: '', editorParam: true },
    color:    { type: 'color', label: 'Cirrus colour', default: '#ffffff' },
    mult:     { type: 'f', label: 'Multiplier', default: 1, min: 0, max: 4, step: 0.01 },
    time:     { type: 'f', label: 'Time (frame)', default: 0, min: 0, max: 20, step: 0.1 },
    fx1: { type: 'f', label: 'L1 freq X', default: 0.0001, min: 0, max: 0.01, step: 0.0001 },
    fy1: { type: 'f', label: 'L1 freq Y', default: 0.0001, min: 0, max: 0.01, step: 0.0001 },
    d1:  { type: 'f', label: 'L1 direction°', default: 30, min: 0, max: 360, step: 1 },
    s1:  { type: 'f', label: 'L1 speed', default: 0.45, min: 0, max: 8, step: 0.01 },
    fx2: { type: 'f', label: 'L2 freq X', default: 0.001, min: 0, max: 0.01, step: 0.0001 },
    fy2: { type: 'f', label: 'L2 freq Y', default: 0.003, min: 0, max: 0.01, step: 0.0001 },
    d2:  { type: 'f', label: 'L2 direction°', default: 0, min: 0, max: 360, step: 1 },
    s2:  { type: 'f', label: 'L2 speed', default: 0.3, min: 0, max: 8, step: 0.01 },
    fx3: { type: 'f', label: 'L3 freq X', default: 0.0006, min: 0, max: 0.01, step: 0.0001 },
    fy3: { type: 'f', label: 'L3 freq Y', default: 0.001, min: 0, max: 0.01, step: 0.0001 },
    d3:  { type: 'f', label: 'L3 direction°', default: 18, min: 0, max: 360, step: 1 },
    s3:  { type: 'f', label: 'L3 speed', default: 0, min: 0, max: 8, step: 0.01 },
    fx4: { type: 'f', label: 'L4 freq X', default: 0.003, min: 0, max: 0.01, step: 0.0001 },
    fy4: { type: 'f', label: 'L4 freq Y', default: 0.006, min: 0, max: 0.01, step: 0.0001 },
    d4:  { type: 'f', label: 'L4 direction°', default: 114, min: 0, max: 360, step: 1 },
    s4:  { type: 'f', label: 'L4 speed', default: 0.65, min: 0, max: 8, step: 0.01 },
  },
  inputs: [{ name: 'cirrus tex' }],
  editor: CirrusEditor,
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    const dirs = [params.d1, params.d2, params.d3, params.d4].map(rad);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0]],
      uniforms: {
        u_freqX: v4(params.fx1 ?? 0, params.fx2 ?? 0, params.fx3 ?? 0, params.fx4 ?? 0),
        u_freqY: v4(params.fy1 ?? 0, params.fy2 ?? 0, params.fy3 ?? 0, params.fy4 ?? 0),
        u_dir:   v4(...dirs),
        u_speed: v4(params.s1 ?? 0, params.s2 ?? 0, params.s3 ?? 0, params.s4 ?? 0),
        u_time:  { type: 'f', value: params.time ?? 0 },
        u_color: { type: 'v3', value: hexToRgb(params.color) },
        u_mult:  { type: 'f', value: params.mult ?? 1 },
      },
    });
  },
});
