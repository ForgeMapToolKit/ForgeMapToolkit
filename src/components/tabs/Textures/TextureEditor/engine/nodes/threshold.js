/**
 * threshold.js — turn brightness into alpha, with a cutoff.
 *
 * The missing piece for building a cirrus texture from noise (see cirrus.js's
 * header on why every channel needs real, everywhere-nonzero data): a `Noise`
 * node makes a grayscale cloud field, but Cirrus wants *alpha* — dense/bright
 * areas opaque, thin/dark areas transparent. This reads one channel
 * (luminance by default) and maps it through a soft threshold into alpha;
 * RGB passes through untouched, so a `Tint` node downstream can still recolour
 * it. `invert` flips which side of the cutoff is opaque (white→opaque is the
 * cloud-mask default; black→opaque is occasionally what you want instead —
 * the smoke look in the reference screenshot's channels, say).
 */

import { registerNode } from '../registry.js';

const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int   u_src;
uniform float u_threshold;
uniform float u_softness;
uniform int   u_invert;
void main() {
  vec4 c = texture(u_in0, v_uv);
  float v = c.a;
  if (u_src == 1) v = c.r;
  else if (u_src == 2) v = c.g;
  else if (u_src == 3) v = c.b;
  else if (u_src == 0) v = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));

  float half_ = max(u_softness, 0.0005) * 0.5;
  float a = smoothstep(u_threshold - half_, u_threshold + half_, v);
  if (u_invert == 1) a = 1.0 - a;
  fragColor = vec4(c.rgb, a);
}`;

registerNode({
  type: 'alpha-threshold',
  category: 'modifier',
  label: 'Threshold',
  accent: '#b98cff',
  params: {
    source:    { type: 'select', label: 'Read channel', default: 'Luminance', options: SOURCES },
    threshold: { type: 'f', label: 'Threshold', default: 0.5, min: 0, max: 1, step: 0.01 },
    softness:  { type: 'f', label: 'Softness (feather)', default: 0.1, min: 0, max: 1, step: 0.01 },
    invert:    { type: 'b', label: 'Invert (dark = opaque)', default: false },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), {
      target, inputs: [inputs[0]],
      uniforms: {
        u_src:       { type: 'i', value: Math.max(0, SOURCES.indexOf(params.source)) },
        u_threshold: { type: 'f', value: params.threshold ?? 0.5 },
        u_softness:  { type: 'f', value: params.softness ?? 0.1 },
        u_invert:    { type: 'i', value: params.invert ? 1 : 0 },
      },
    });
  },
});
