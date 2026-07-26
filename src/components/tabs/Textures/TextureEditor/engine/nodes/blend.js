/**
 * blend.js — "Combine", the layer-composer (docs/NODE_EDITOR_PLAN.md §5.2).
 *
 * Two inputs — `base` (u_in0) and `over` (u_in1) — composited with a combine
 * mode and an opacity. This is the graph's central compositor: instead of
 * threading blend/opacity across scattered edges, every layer flows through a
 * Combine node. `over`'s own alpha modulates the mix, so a sprite with a
 * cut-out alpha lands on the base cleanly. (Node type stays `layer-composer`
 * — only the label changed, so existing saved graphs keep working; "Blend" is
 * also one of the ten combine modes, which is exactly why the node itself
 * needed a different name than the mode.)
 *
 * If only `base` is wired it passes through; if only `over` is wired it shows
 * over on transparent. Missing both → cleared target.
 */

import { registerNode } from '../registry.js';

// Index order must match `blend()` in the shader below.
const MODES = ['Blend', 'Add', 'Subtract', 'Multiply', 'Divide', 'Screen', 'Overlay', 'Max', 'Min', 'Difference'];
// A mask is just per-pixel opacity — see maskValue() / the `a` term below.
const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // base
uniform sampler2D u_in1; // over
uniform sampler2D u_in2; // mask (optional)
uniform int   u_mode;
uniform float u_opacity;
uniform int   u_hasBase;
uniform int   u_hasOver;
uniform int   u_hasMask;
uniform int   u_maskSrc;

float maskValue(vec4 m, int src) {
  if (src == 1) return m.r;
  if (src == 2) return m.g;
  if (src == 3) return m.b;
  if (src == 4) return m.a;
  return dot(m.rgb, vec3(0.2126, 0.7152, 0.0722)); // Luminance (0)
}

vec3 blend(vec3 b, vec3 o, int m) {
  if (m == 1) return b + o;                          // add
  if (m == 2) return b - o;                          // subtract
  if (m == 3) return b * o;                          // multiply
  if (m == 4) return b / max(o, vec3(1e-4));         // divide
  if (m == 5) return 1.0 - (1.0 - b) * (1.0 - o);    // screen
  if (m == 6) return mix(2.0*b*o, 1.0 - 2.0*(1.0-b)*(1.0-o), step(0.5, b)); // overlay
  if (m == 7) return max(b, o);                      // max (lighten)
  if (m == 8) return min(b, o);                      // min (darken)
  if (m == 9) return abs(b - o);                     // difference
  return o;                                          // blend (normal)
}

void main() {
  vec4 base = u_hasBase == 1 ? texture(u_in0, v_uv) : vec4(0.0);
  if (u_hasOver == 0) { fragColor = base; return; }
  vec4 over = texture(u_in1, v_uv);
  float mv = u_hasMask == 1 ? maskValue(texture(u_in2, v_uv), u_maskSrc) : 1.0;
  float a = over.a * u_opacity * mv;             // mask = per-pixel opacity
  vec3 rgb = mix(base.rgb, blend(base.rgb, over.rgb, u_mode), a);
  float outA = base.a + a * (1.0 - base.a);          // over-composite alpha
  fragColor = vec4(rgb, outA);
}`;

registerNode({
  type: 'layer-composer',
  category: 'compositor',
  label: 'Combine',
  accent: '#ffb454',
  params: {
    mode:        { type: 'select', label: 'Combine mode', default: 'Blend', options: MODES },
    opacity:     { type: 'f', label: 'Opacity', default: 1, min: 0, max: 1, step: 0.01 },
    maskChannel: { type: 'select', label: 'Mask channel', default: 'Luminance', options: SOURCES },
  },
  inputs: [{ name: 'base' }, { name: 'over' }, { name: 'mask' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0] && !inputs[1]) return; // nothing wired → leave cleared
    const modeIdx = Math.max(0, MODES.indexOf(params.mode));
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any, inputs[2] || any],
      uniforms: {
        u_mode:    { type: 'i', value: modeIdx },
        u_opacity: { type: 'f', value: params.opacity ?? 1 },
        u_hasBase: { type: 'i', value: inputs[0] ? 1 : 0 },
        u_hasOver: { type: 'i', value: inputs[1] ? 1 : 0 },
        u_hasMask: { type: 'i', value: inputs[2] ? 1 : 0 },
        u_maskSrc: { type: 'i', value: Math.max(0, SOURCES.indexOf(params.maskChannel)) },
      },
    });
  },
});
