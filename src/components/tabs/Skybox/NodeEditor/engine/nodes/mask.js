/**
 * mask.js — "Mask", a per-pixel lerp between two inputs gated by a third.
 *
 * `out = mix(A, B, maskValue)` — where the mask is white, B shows; where black,
 * A shows; grey blends between them. Because the mask is a *continuous* 0..1
 * value you get soft transitions for free — feed a Gradient straight in for a
 * feathered edge, or Threshold it first for a hard cut.
 *
 * This is the universal masking primitive for cases where the two inputs are
 * independent images and their own alpha must NOT enter the mix — most notably
 * "apply an adjustment only inside a region": wire the original into A, the
 * adjusted copy into B, and a Region/Gradient mask into `mask`. Combine (the
 * mode-aware compositor) also takes a mask input, but there the over's own alpha
 * gates the blend; here the lerp is pure, which is exactly what an adjustment
 * mask wants.
 *
 * `maskChannel` picks which channel counts as "white": a grey Gradient carries
 * its value in RGB → Luminance; a Threshold writes its result to Alpha → Alpha.
 * Getting this wrong reads a flat channel and nothing appears to happen.
 */

import { registerNode } from '../registry.js';

const SOURCES = ['Luminance', 'Red', 'Green', 'Blue', 'Alpha'];

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0; // A (shown where mask is black)
uniform sampler2D u_in1; // B (shown where mask is white)
uniform sampler2D u_in2; // mask
uniform int u_hasA, u_hasB, u_hasMask;
uniform int u_src;
uniform int u_invert;

float maskValue(vec4 m, int src) {
  if (src == 1) return m.r;
  if (src == 2) return m.g;
  if (src == 3) return m.b;
  if (src == 4) return m.a;
  return dot(m.rgb, vec3(0.2126, 0.7152, 0.0722)); // Luminance (0)
}

void main() {
  vec4 a = u_hasA == 1 ? texture(u_in0, v_uv) : vec4(0.0);
  vec4 b = u_hasB == 1 ? texture(u_in1, v_uv) : vec4(0.0);
  float mv = u_hasMask == 1 ? maskValue(texture(u_in2, v_uv), u_src) : 1.0;
  if (u_invert == 1) mv = 1.0 - mv;
  fragColor = mix(a, b, mv);
}`;

registerNode({
  type: 'mask',
  category: 'compositor',
  label: 'Mask',
  accent: '#ffb454',
  params: {
    maskChannel: { type: 'select', label: 'Mask channel', default: 'Luminance', options: SOURCES },
    invert:      { type: 'b', label: 'Invert mask', default: false },
  },
  inputs: [{ name: 'A' }, { name: 'B' }, { name: 'mask' }],
  render(ctx, { params, inputs, target }) {
    if (!inputs[0] && !inputs[1]) return; // nothing wired → leave cleared
    const any = inputs.find(Boolean);
    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0] || any, inputs[1] || any, inputs[2] || any],
      uniforms: {
        u_hasA:    { type: 'i', value: inputs[0] ? 1 : 0 },
        u_hasB:    { type: 'i', value: inputs[1] ? 1 : 0 },
        u_hasMask: { type: 'i', value: inputs[2] ? 1 : 0 },
        u_src:     { type: 'i', value: Math.max(0, SOURCES.indexOf(params.maskChannel)) },
        u_invert:  { type: 'i', value: params.invert ? 1 : 0 },
      },
    });
  },
});
