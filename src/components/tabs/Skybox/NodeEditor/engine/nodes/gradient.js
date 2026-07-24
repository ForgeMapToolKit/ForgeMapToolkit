/**
 * gradient.js — multi-stop gradient source.
 *
 * A Source node (no inputs): produces a directional gradient across up to 8
 * colour stops. This is the backbone of the WaterRamp output and the sky
 * backdrop of an EnvCube. Its sub-editor (GradientEditor) lets you drag stops;
 * every drag only writes into `params.stops` (the parametric rule).
 */

import { registerNode } from '../registry.js';
import { hexToRgb } from '../colorUtil.js';
import GradientEditor from '../../ui/GradientEditor.jsx';

const MAX_STOPS = 8;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform int   u_count;
uniform float u_pos[${MAX_STOPS}];
uniform vec4  u_color[${MAX_STOPS}];
uniform float u_angle;   // degrees; 0 = bottom→top

void main() {
  float a = radians(u_angle);
  vec2 dir = vec2(sin(a), cos(a));
  float t = clamp(dot(v_uv - 0.5, dir) + 0.5, 0.0, 1.0);

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
  fragColor = col;
}`;

function buildUniforms(params) {
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
    color[i * 4] = r; color[i * 4 + 1] = g; color[i * 4 + 2] = b;
    color[i * 4 + 3] = 1; // Gradient is pure colour — opacity lives in the Alpha Ramp node.
  }
  return {
    u_count: { type: 'i', value: count },
    u_pos:   { type: 'fv', value: pos },
    u_color: { type: 'v4v', value: color },
    u_angle: { type: 'f', value: params.angle ?? 0 },
  };
}

registerNode({
  type: 'gradient',
  category: 'source',
  label: 'Gradient',
  accent: '#5ec8ff',
  params: {
    stops: {
      type: 'stops',
      label: 'Colour stops',
      default: [
        { pos: 0.0, color: '#0a2a4a' },
        { pos: 1.0, color: '#3fd0e0' },
      ],
    },
    angle: { type: 'f', label: 'Angle', default: 0, min: 0, max: 360, step: 1 },
  },
  inputs: [],
  editor: GradientEditor,
  render(ctx, { params, target }) {
    ctx.pass(ctx.program(FRAG), { target, uniforms: buildUniforms(params) });
  },
});
