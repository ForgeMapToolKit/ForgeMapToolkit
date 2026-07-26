/**
 * layers.js — the Photoshop layer stack as one node (NODE_EDITOR_PLAN §5.2).
 *
 * Four inputs composited bottom→top: `base` is the backdrop, then layer 1, 2, 3
 * paint over it in order, each with its own mode and opacity. That ordering is
 * the point — "cirrus one level above the planet" is just which socket you wire
 * it to, instead of a chain of Blend nodes whose order you have to read off the
 * edges.
 *
 * Each layer's own alpha still gates it, so a UV-cropped planet on a
 * transparent field drops in without a mask.
 */

import { registerNode } from '../registry.js';

const MODES = ['Blend', 'Add', 'Subtract', 'Multiply', 'Divide', 'Screen', 'Overlay', 'Max', 'Min', 'Difference'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0, u_in1, u_in2, u_in3;
uniform vec4 u_has;      // which sockets are wired (base, l1, l2, l3)
uniform vec3 u_mode;     // mode per layer 1..3 (float-encoded enum)
uniform vec3 u_opacity;  // opacity per layer 1..3

vec3 blend(vec3 b, vec3 o, int m) {
  if (m == 1) return b + o;
  if (m == 2) return b - o;
  if (m == 3) return b * o;
  if (m == 4) return b / max(o, vec3(1e-4));
  if (m == 5) return 1.0 - (1.0 - b) * (1.0 - o);
  if (m == 6) return mix(2.0*b*o, 1.0 - 2.0*(1.0-b)*(1.0-o), step(0.5, b));
  if (m == 7) return max(b, o);
  if (m == 8) return min(b, o);
  if (m == 9) return abs(b - o);
  return o;
}

vec4 over(vec4 dst, vec4 src, int mode, float opacity) {
  float a = src.a * opacity;
  return vec4(mix(dst.rgb, blend(dst.rgb, src.rgb, mode), a), dst.a + a * (1.0 - dst.a));
}

void main() {
  vec4 c = u_has.x > 0.5 ? texture(u_in0, v_uv) : vec4(0.0);
  if (u_has.y > 0.5) c = over(c, texture(u_in1, v_uv), int(u_mode.x + 0.5), u_opacity.x);
  if (u_has.z > 0.5) c = over(c, texture(u_in2, v_uv), int(u_mode.y + 0.5), u_opacity.y);
  if (u_has.w > 0.5) c = over(c, texture(u_in3, v_uv), int(u_mode.z + 0.5), u_opacity.z);
  fragColor = c;
}`;

const modeIdx = (v) => Math.max(0, MODES.indexOf(v));

registerNode({
  type: 'layers',
  category: 'compositor',
  label: 'Layers',
  accent: '#ffb454',
  params: {
    mode1: { type: 'select', label: 'Layer 1 mode', default: 'Blend', options: MODES },
    op1:   { type: 'f', label: 'Layer 1 opacity', default: 1, min: 0, max: 1, step: 0.01 },
    mode2: { type: 'select', label: 'Layer 2 mode', default: 'Blend', options: MODES },
    op2:   { type: 'f', label: 'Layer 2 opacity', default: 1, min: 0, max: 1, step: 0.01 },
    mode3: { type: 'select', label: 'Layer 3 mode', default: 'Blend', options: MODES },
    op3:   { type: 'f', label: 'Layer 3 opacity', default: 1, min: 0, max: 1, step: 0.01 },
  },
  inputs: [{ name: 'base' }, { name: 'layer 1' }, { name: 'layer 2' }, { name: 'layer 3' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs.some(Boolean)) return;
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any, inputs[2] || any, inputs[3] || any],
      uniforms: {
        u_has:     { type: 'v4', value: [inputs[0] ? 1 : 0, inputs[1] ? 1 : 0, inputs[2] ? 1 : 0, inputs[3] ? 1 : 0] },
        u_mode:    { type: 'v3', value: [modeIdx(params.mode1), modeIdx(params.mode2), modeIdx(params.mode3)] },
        u_opacity: { type: 'v3', value: [params.op1 ?? 1, params.op2 ?? 1, params.op3 ?? 1] },
      },
    });
  },
});
