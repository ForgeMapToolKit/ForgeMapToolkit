/**
 * autoLevel.js — "Auto Level", one input. Stretches the input's own tonal
 * range to fill 0..1, instead of Levels' manually-dragged black/white points.
 *
 * Unlike every other node here, this one genuinely needs to know the whole
 * image's statistics before it can draw a single pixel — a fragment shader
 * only ever sees one texel at a time. So `render()` does something no other
 * node does: it reads the ALREADY-EVALUATED input back to the CPU
 * (`ctx.readPixels(inputTargets[0])` — the raw {tex,fbo,w,h} the evaluator
 * also hands every node, unused until now), builds a 256-bin histogram per
 * channel, finds the `clipPercent` / (100-clipPercent) percentile as the
 * effective black/white point (plain min/max lets one stray hot pixel pin the
 * whole stretch to nothing), then runs a normal shader pass with those as
 * uniforms. This only costs a CPU stall when the node's content hash changes
 * — like every node here, the evaluator caches the result otherwise.
 *
 * `mode`: Per-Channel stretches R/G/B independently (Photoshop's "Auto
 * Levels" — fixes colour casts, can shift colour balance). Luminance derives
 * one stretch factor from luminance and applies it uniformly to all three
 * (Photoshop's "Auto Contrast" — preserves colour, just expands range).
 * `gamma` is a post-stretch power curve, same math as levels.js.
 */

import { registerNode } from '../registry.js';

const MODES = ['Per-Channel', 'Luminance'];
const HIST_BINS = 256;
const MAX_SAMPLES = 250000; // stride-sample huge textures instead of scanning every texel

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform vec3 u_lo, u_hi;
uniform float u_gamma;
void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 rgb = clamp((c.rgb - u_lo) / max(u_hi - u_lo, vec3(1e-4)), 0.0, 1.0);
  rgb = pow(rgb, vec3(1.0 / max(u_gamma, 1e-3)));
  fragColor = vec4(rgb, c.a);
}`;

/** Percentile-clipped [lo,hi] from a 256-bin histogram (0 = ignore stray outliers). */
function clipRange(hist, total, clipPercent) {
  const clip = Math.max(0, Math.min(49, clipPercent)) / 100 * total;
  let lo = 0, hi = HIST_BINS - 1, acc = 0;
  for (; lo < HIST_BINS; lo++) { acc += hist[lo]; if (acc > clip) break; }
  acc = 0;
  for (; hi >= 0; hi--) { acc += hist[hi]; if (acc > clip) break; }
  if (hi <= lo) { lo = 0; hi = HIST_BINS - 1; } // degenerate (flat image) — fall back to full range
  return [lo / (HIST_BINS - 1), hi / (HIST_BINS - 1)];
}

registerNode({
  type: 'auto-level',
  category: 'modifier',
  label: 'Auto Level',
  accent: '#c0a0ff',
  params: {
    mode:        { type: 'select', label: 'Mode', default: 'Per-Channel', options: MODES },
    clipPercent: { type: 'f', label: 'Clip %', default: 0.5, min: 0, max: 10, step: 0.1 },
    gamma:       { type: 'f', label: 'Gamma', default: 1, min: 0.1, max: 4, step: 0.01 },
  },
  inputs: [{ name: 'in' }],
  render(ctx, { params, inputs, inputTargets, target }) {
    if (!inputs[0] || !inputTargets[0]) return;
    const src = inputTargets[0];
    const rgba = ctx.readPixels(src);

    const clip = params.clipPercent ?? 0.5;
    const n = src.w * src.h;
    const stride = Math.max(1, Math.floor(n / MAX_SAMPLES));
    const histR = new Uint32Array(HIST_BINS), histG = new Uint32Array(HIST_BINS), histB = new Uint32Array(HIST_BINS);
    const histL = new Uint32Array(HIST_BINS);
    let total = 0;
    for (let i = 0; i < n; i += stride) {
      const o = i * 4;
      histR[rgba[o]]++; histG[rgba[o + 1]]++; histB[rgba[o + 2]]++;
      histL[Math.min(255, Math.round(0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2]))]++;
      total++;
    }

    let lo, hi;
    if (params.mode === 'Luminance') {
      const [l0, l1] = clipRange(histL, total, clip);
      lo = [l0, l0, l0]; hi = [l1, l1, l1];
    } else {
      const [r0, r1] = clipRange(histR, total, clip);
      const [g0, g1] = clipRange(histG, total, clip);
      const [b0, b1] = clipRange(histB, total, clip);
      lo = [r0, g0, b0]; hi = [r1, g1, b1];
    }

    ctx.pass(ctx.program(FRAG), {
      target,
      inputs: [inputs[0]],
      uniforms: {
        u_lo:    { type: 'v3', value: lo },
        u_hi:    { type: 'v3', value: hi },
        u_gamma: { type: 'f', value: params.gamma ?? 1 },
      },
    });
  },
});
