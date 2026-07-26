/**
 * gradientMap.js — "Gradient Map", one input. Colourise by a channel.
 *
 * Reads one channel of the input (luminance by default) as a position 0..1
 * along a multi-stop gradient, and outputs that colour. This is how a grey
 * Noise / Voronoi field becomes a finished texture: the value drives the
 * palette. Shares the exact stop encoding and the GradientEditor sub-editor
 * with the Gradient source node — the only difference is that `t` comes from
 * the input instead of from UV + angle.
 *
 * Input alpha passes straight through, so colourising a mask keeps its cut-out.
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';
import GradientEditor from '../../ui/GradientEditor.jsx';

const MAX_STOPS = 8;
const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int   u_hasIn;
uniform int   u_src;
uniform int   u_count;
uniform float u_pos[${MAX_STOPS}];
uniform vec4  u_color[${MAX_STOPS}];

float chan(vec4 c, int s) {
  if (s == 1) return c.r;
  if (s == 2) return c.g;
  if (s == 3) return c.b;
  if (s == 4) return c.a;
  return dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 src = u_hasIn == 1 ? texture(u_in0, v_uv) : vec4(0.0, 0.0, 0.0, 1.0);
  float t = clamp(chan(src, u_src), 0.0, 1.0);

  int n = max(u_count, 1);
  vec4 col = u_color[0];
  if (t <= u_pos[0]) {
    col = u_color[0];
  } else if (t >= u_pos[n - 1]) {
    col = u_color[n - 1];
  } else {
    for (int i = 0; i < ${MAX_STOPS} - 1; i++) {
      if (i + 1 >= n) break;
      float lo = u_pos[i], hi = u_pos[i + 1];
      if (t >= lo && t <= hi) {
        float f = hi > lo ? (t - lo) / (hi - lo) : 0.0;
        col = mix(u_color[i], u_color[i + 1], f);
        break;
      }
    }
  }
  fragColor = vec4(col.rgb, src.a);
}`;

function stopUniforms(params) {
  const stops = [...(params.stops || [])]
    .slice(0, MAX_STOPS)
    .sort((a, b) => a.pos - b.pos);
  const count = Math.max(1, stops.length);
  const pos = new Float32Array(MAX_STOPS);
  const color = new Float32Array(MAX_STOPS * 4);
  for (let i = 0; i < count; i++) {
    const s = stops[i] || stops[stops.length - 1];
    pos[i] = s.pos;
    const [r, g, b] = hexToRgb(s.color);
    color[i * 4] = r; color[i * 4 + 1] = g; color[i * 4 + 2] = b; color[i * 4 + 3] = 1;
  }
  return {
    u_count: { type: 'i', value: count },
    u_pos:   { type: 'fv', value: pos },
    u_color: { type: 'v4v', value: color },
  };
}

registerNode({
  type: 'gradient-map',
  category: 'modifier',
  label: 'Gradient Map',
  accent: '#b98cff',
  params: {
    stops: {
      type: 'stops',
      label: 'Colour stops',
      default: [
        { pos: 0.0, color: '#0a0a1a' },
        { pos: 0.5, color: '#7a4a2a' },
        { pos: 1.0, color: '#ffe8b0' },
      ],
    },
    source: { type: 'select', label: 'Read channel', default: 'Luminance', options: SOURCES },
  },
  inputs: [{ name: 'in' }],
  editor: GradientEditor,
  render(ctx, { params, inputs, target }) {
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: inputs[0] ? [inputs[0]] : [],
      uniforms: {
        ...stopUniforms(params),
        u_hasIn: { type: 'i', value: inputs[0] ? 1 : 0 },
        u_src:   { type: 'i', value: Math.max(0, SOURCES.indexOf(params.source)) },
      },
    });
  },
});
