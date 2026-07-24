/**
 * combineRgbAlpha.js — take the colour from one input and the opacity from another.
 *
 * The pairing this exists for: a Gradient supplies the RGB (it is always
 * opaque by design) and an imported vanilla asset — a stock waterramp, say —
 * supplies the alpha curve. Wire the ramp through an Import node and pick which
 * of its channels to read: `Alpha` uses the texture's real alpha, `Red` /
 * `Luminance` read a greyscale mask (which is what Import's "use only alpha
 * channel" produces).
 */

import { registerNode } from '../registry.js';

const SOURCES = ['Alpha', 'Red', 'Luminance'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // rgb
uniform sampler2D u_in1; // alpha source
uniform int   u_src;
uniform int   u_hasRgb, u_hasAlpha;
uniform float u_scale;

void main() {
  vec3 rgb = u_hasRgb == 1 ? texture(u_in0, v_uv).rgb : vec3(0.0);
  float a = 1.0;
  if (u_hasAlpha == 1) {
    vec4 s = texture(u_in1, v_uv);
    if (u_src == 1)      a = s.r;
    else if (u_src == 2) a = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    else                 a = s.a;
  }
  fragColor = vec4(rgb, clamp(a * u_scale, 0.0, 1.0));
}`;

registerNode({
  type: 'combine-rgb-alpha',
  category: 'compositor',
  label: 'Combine RGB + Alpha',
  accent: '#ffb454',
  params: {
    source: { type: 'select', label: 'Alpha from', default: 'Alpha', options: SOURCES },
    scale:  { type: 'f', label: 'Alpha scale', default: 1, min: 0, max: 2, step: 0.01 },
  },
  inputs: [{ name: 'rgb' }, { name: 'alpha' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0] && !inputs[1]) return;
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any],
      uniforms: {
        u_src:      { type: 'i', value: Math.max(0, SOURCES.indexOf(params.source)) },
        u_hasRgb:   { type: 'i', value: inputs[0] ? 1 : 0 },
        u_hasAlpha: { type: 'i', value: inputs[1] ? 1 : 0 },
        u_scale:    { type: 'f', value: params.scale ?? 1 },
      },
    });
  },
});
