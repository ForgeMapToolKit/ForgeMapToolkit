/**
 * seamless.js — force any texture to tile without a visible edge.
 *
 * The classic "offset filter" technique (Photoshop/GIMP's Make Seamless):
 * sample the texture at four points — the pixel itself, and the same pixel
 * shifted by half a tile on X, on Y, and on both (all wrapped with fract(),
 * since render targets here are CLAMP_TO_EDGE, not REPEAT — same trick as
 * tile.js/cirrus.js) — then blend those four toward the tile edges. At u=0
 * and u=1 the blend converges to sampling the SAME point (the texture's own
 * centre), so opposite edges always match exactly; the interior is
 * unaffected wherever the blend weight is 0.
 *
 * `sharpness` reshapes the weight curve (`pow(dist-from-centre, sharpness)`):
 * 1 is the classic Photoshop-style blend spread over the whole tile; higher
 * values pull the blend/ghosting in tight around the actual edges instead of
 * softening the whole image. `strength` just dials how much of the fixed
 * result to use — 0 leaves the input untouched, 1 is fully forced-seamless.
 */

import { registerNode } from '../registry.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform float u_strength;
uniform float u_sharpness;

void main() {
  vec2 p = fract(v_uv);
  vec4 c00 = texture(u_in0, p);
  vec4 c10 = texture(u_in0, fract(p + vec2(0.5, 0.0)));
  vec4 c01 = texture(u_in0, fract(p + vec2(0.0, 0.5)));
  vec4 c11 = texture(u_in0, fract(p + vec2(0.5, 0.5)));

  vec2 w = pow(abs(p - 0.5) * 2.0, vec2(max(u_sharpness, 0.0001)));
  vec4 top = mix(c00, c10, w.x);
  vec4 bot = mix(c01, c11, w.x);
  vec4 seamless = mix(top, bot, w.y);

  fragColor = mix(c00, seamless, u_strength);
}`;

registerNode({
  type: 'seamless',
  category: 'modifier',
  label: 'Seamless',
  accent: '#b98cff',
  params: {
    strength:  { type: 'f', label: 'Strength', default: 1, min: 0, max: 1, step: 0.01 },
    sharpness: { type: 'f', label: 'Edge sharpness', default: 1, min: 0.2, max: 6, step: 0.1 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_strength:  { type: 'f', value: params.strength ?? 1 },
        u_sharpness: { type: 'f', value: params.sharpness ?? 1 },
      },
    });
  },
});
