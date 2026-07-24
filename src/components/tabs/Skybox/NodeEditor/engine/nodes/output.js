/**
 * output.js — terminal Output nodes.
 *
 * An Output node is where the graph becomes a SupCom asset. It is a passthrough
 * for rendering (its texture == its input, so the preview can show it), plus
 * metadata the exporter reads: target format and a filename. Its render size is
 * the graph canvas (see graph.canvas), which the toolbar drives per mode.
 *
 * `output-waterramp` and `output-texture` share the same passthrough render and
 * differ only in defaults and the exporter's framing — the format knowledge
 * that makes them SupCom-specific lives in the export step + mode presets, not
 * in a bespoke render path.
 */

import { registerNode } from '../registry.js';

const COPY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
void main() { fragColor = texture(u_in0, v_uv); }`;

const CHECKER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_res;
void main() {
  // Nothing wired in yet — show a faint checker so the output reads as "empty".
  vec2 g = floor(v_uv * u_res / 8.0);
  float c = mod(g.x + g.y, 2.0) * 0.06 + 0.05;
  fragColor = vec4(vec3(c), 1.0);
}`;

function passthrough(ctx, { inputs, target }) {
  if (inputs[0]) {
    ctx.pass(ctx.program(COPY_FRAG), { target, inputs: [inputs[0]] });
  } else {
    ctx.pass(ctx.program(CHECKER_FRAG), { target });
  }
}

registerNode({
  type: 'output-waterramp',
  category: 'output',
  label: 'WaterRamp Output',
  accent: '#00d0a0',
  params: {
    filename: { type: 'text', label: 'File name', default: 'waterramp' },
    format:   { type: 'select', label: 'Format', default: 'RGBA', options: ['RGBA', 'DXT5'] },
    // A WaterRamp is a 1D depth lookup, not a tiled surface texture — the engine
    // never minifies it, so mips only avoid-average adjacent depth stops into
    // each other (the alpha wash-out described in NODE_EDITOR_PLAN.md). Off by
    // default; texture outputs default the opposite way (see below).
    mipmaps:  { type: 'b', label: 'Generate mipmaps', default: false },
  },
  inputs: [{ name: 'in' }],
  outputs: [],
  render: (ctx, args) => passthrough(ctx, args),
});

registerNode({
  type: 'output-texture',
  category: 'output',
  label: 'Texture Output (DDS)',
  accent: '#00d0a0',
  params: {
    filename: { type: 'text', label: 'File name', default: 'texture' },
    format:   { type: 'select', label: 'Format', default: 'DXT5', options: ['RGBA', 'DXT5'] },
    mipmaps:  { type: 'b', label: 'Generate mipmaps', default: true },
  },
  inputs: [{ name: 'in' }],
  outputs: [],
  render: (ctx, args) => passthrough(ctx, args),
});

// EnvCube reflection — a single equirectangular image (NODE_EDITOR_PLAN §8.1),
// so the whole flow stays 2D composition. `projection` is a forward-looking
// label only (equirect is what the render produces); a 6-face cube output is a
// later, optional mode. Render resolution is the graph canvas size.
registerNode({
  type: 'output-envcube',
  category: 'output',
  label: 'EnvCube Output',
  accent: '#00d0a0',
  params: {
    filename:   { type: 'text', label: 'File name', default: 'reflection' },
    format:     { type: 'select', label: 'Format', default: 'DXT5', options: ['RGBA', 'DXT5'] },
    projection: { type: 'select', label: 'Projection', default: 'equirect', options: ['equirect'] },
    mipmaps:    { type: 'b', label: 'Generate mipmaps', default: true },
  },
  inputs: [{ name: 'in' }],
  outputs: [],
  render: (ctx, args) => passthrough(ctx, args),
});
