/**
 * alphaRamp.js — positional alpha ramp modifier.
 *
 * A Modifier node (one input, one output): keeps the input's RGB untouched and
 * replaces its alpha with a multi-stop ramp along the same directional axis
 * `gradient` uses (`u_angle`, 0 = bottom→top). This decouples "where is the
 * colour" from "where is the opacity" — e.g. a WaterRamp's colour gradient and
 * its shore→deep opacity falloff no longer have to share stop positions, which
 * is what forced every `gradient` colour stop to also carry an `alpha` value.
 */

import { registerNode } from '../registry.js';
import AlphaRampEditor from '../../ui/AlphaRampEditor.jsx';

const MAX_STOPS = 8;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int   u_count;
uniform float u_pos[${MAX_STOPS}];
uniform float u_alpha[${MAX_STOPS}];
uniform float u_angle;   // degrees; 0 = bottom→top

void main() {
  vec4 c = texture(u_in0, v_uv);

  float a = radians(u_angle);
  vec2 dir = vec2(sin(a), cos(a));
  float t = clamp(dot(v_uv - 0.5, dir) + 0.5, 0.0, 1.0);

  int n = max(u_count, 1);
  float outA = u_alpha[0];
  if (t <= u_pos[0]) {
    outA = u_alpha[0];
  } else if (t >= u_pos[n - 1]) {
    outA = u_alpha[n - 1];
  } else {
    for (int i = 0; i < ${MAX_STOPS} - 1; i++) {
      if (i + 1 >= n) break;
      float lo = u_pos[i], hi = u_pos[i + 1];
      if (t >= lo && t <= hi) {
        float f = hi > lo ? (t - lo) / (hi - lo) : 0.0;
        outA = mix(u_alpha[i], u_alpha[i + 1], f);
        break;
      }
    }
  }
  fragColor = vec4(c.rgb, outA);
}`;

function buildUniforms(params) {
  const stops = [...(params.stops || [])]
    .slice(0, MAX_STOPS)
    .sort((a, b) => a.pos - b.pos);
  const count = Math.max(1, stops.length);
  const pos = new Float32Array(MAX_STOPS);
  const alpha = new Float32Array(MAX_STOPS);
  for (let i = 0; i < count; i++) {
    const s = stops[i] || stops[stops.length - 1];
    pos[i] = s.pos;
    alpha[i] = s.alpha ?? 1;
  }
  return {
    u_count: { type: 'i', value: count },
    u_pos:   { type: 'fv', value: pos },
    u_alpha: { type: 'fv', value: alpha },
    u_angle: { type: 'f', value: params.angle ?? 0 },
  };
}

registerNode({
  type: 'alpha-ramp',
  category: 'modifier',
  label: 'Alpha Ramp',
  accent: '#ff9f5e',
  params: {
    stops: {
      type: 'stops',
      label: 'Alpha stops',
      default: [
        { pos: 0.0, alpha: 0.0 },
        { pos: 1.0, alpha: 1.0 },
      ],
    },
    angle: { type: 'f', label: 'Angle', default: 0, min: 0, max: 360, step: 1 },
  },
  inputs: [{ name: 'in' }],
  editor: AlphaRampEditor,
  render(ctx, { params, inputs, target }) {
    if (!inputs[0]) return; // nothing wired in → leave target cleared
    ctx.pass(ctx.program(FRAG), { target, inputs: [inputs[0]], uniforms: buildUniforms(params) });
  },
});
