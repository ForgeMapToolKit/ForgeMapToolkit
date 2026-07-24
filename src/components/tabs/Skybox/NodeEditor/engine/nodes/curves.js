/**
 * curves.js — tonal curve. One input, one output.
 *
 * A piecewise-linear input→output map applied to each RGB channel (alpha
 * passes through). Its sub-editor (CurveEditor) drags control points; the
 * document only ever holds `params.points` (the parametric rule), and the
 * shader evaluates the same curve the editor draws.
 */

import { registerNode } from '../registry.js';
import CurveEditor from '../../ui/CurveEditor.jsx';

const MAX_PTS = 8;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int   u_count;
uniform float u_px[${MAX_PTS}];
uniform float u_py[${MAX_PTS}];

float curve(float v) {
  int n = max(u_count, 1);
  if (v <= u_px[0]) return u_py[0];
  if (v >= u_px[n - 1]) return u_py[n - 1];
  for (int i = 0; i < ${MAX_PTS} - 1; i++) {
    if (i + 1 >= n) break;
    float lo = u_px[i], hi = u_px[i + 1];
    if (v >= lo && v <= hi) {
      float f = hi > lo ? (v - lo) / (hi - lo) : 0.0;
      return mix(u_py[i], u_py[i + 1], f);
    }
  }
  return v;
}

void main() {
  vec4 c = texture(u_in0, v_uv);
  fragColor = vec4(curve(c.r), curve(c.g), curve(c.b), c.a);
}`;

function buildUniforms(params) {
  const pts = [...(params.points || [])].slice(0, MAX_PTS).sort((a, b) => a.x - b.x);
  const count = Math.max(1, pts.length);
  const px = new Float32Array(MAX_PTS);
  const py = new Float32Array(MAX_PTS);
  for (let i = 0; i < count; i++) {
    const p = pts[i] || pts[pts.length - 1];
    px[i] = p.x; py[i] = p.y;
  }
  return {
    u_count: { type: 'i', value: count },
    u_px:    { type: 'fv', value: px },
    u_py:    { type: 'fv', value: py },
  };
}

registerNode({
  type: 'curves',
  category: 'modifier',
  label: 'Curves',
  accent: '#b98cff',
  params: {
    points: {
      type: 'points',
      label: 'Tone curve',
      default: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    },
  },
  inputs: [{ name: 'in' }],
  editor: CurveEditor,
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return;
    ctx.pass(ctx.program(FRAG), { target, inputs: [inputs[0]], uniforms: buildUniforms(params) });
  },
});
