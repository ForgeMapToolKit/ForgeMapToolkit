/**
 * modes.js — asset-type templates.
 *
 * The mode dropdown is a *template*, not a mode switch (docs/NODE_EDITOR_PLAN.md
 * §7): picking one seeds a fresh graph with the right canvas size and a
 * pre-placed Output node. After that the graph is the only authority —
 * nothing about "waterramp" lives outside the document.
 *
 * The toolbox is never filtered by mode — every registered node is always
 * offered, regardless of which asset you're building (a WaterRamp is 1D but
 * nothing stops you reaching for Noise or Cirrus there; the canvas size is
 * the only real constraint). `palette` on a mode entry is unused now but left
 * as a hook — a future template could still narrow it if one ever needs to.
 *
 * A template returns a full `.fmtgraph`. Node ids are fixed here (n1, n2, …);
 * freshId() picks up from the highest existing id afterwards.
 */

export const MODES = {
  waterramp: {
    key: 'waterramp',
    label: 'WaterRamp',
    canvas: { w: 256, h: 16 },
    palette: null,
    makeGraph() {
      return {
        version: 1,
        mode: 'waterramp',
        canvas: { w: 256, h: 16 },
        nodes: {
          // WaterRamp is a 1D depth lookup: U = water depth (0 = shore, 1 = deep).
          // RGB is the underwater scattered-light colour (Gradient, always opaque);
          // ALPHA is the blend weight terrain.fx uses — lerp(terrain, ramp.rgb,
          // ramp.a·opacity) — shaped separately by the Alpha Ramp node so it can
          // rise from ~0 at the shore to strong in deep water. Colour and opacity
          // are decoupled: two ramps along the same depth axis.
          n1: {
            type: 'gradient',
            params: {
              stops: [
                { pos: 0.0, color: '#4a8a90' },  // shore
                { pos: 0.45, color: '#1d5560' },
                { pos: 1.0, color: '#07222e' },  // deep
              ],
              angle: 90, // horizontal ramp (depth along +X)
            },
            pos: [60, 60],
          },
          n2: {
            type: 'alpha-ramp',
            params: {
              stops: [
                { pos: 0.0, alpha: 0.0 },   // shore — clear, no tint
                { pos: 0.45, alpha: 0.55 },
                { pos: 1.0, alpha: 0.9 },   // deep — strong tint
              ],
              angle: 90,
            },
            pos: [300, 60],
          },
          n3: { type: 'output-waterramp', params: { filename: 'waterramp', format: 'RGBA', mipmaps: false }, pos: [540, 60] },
        },
        edges: [
          { from: ['n1', 'out'], to: ['n2', 'in'] },
          { from: ['n2', 'out'], to: ['n3', 'in'] },
        ],
      };
    },
  },

  envcube: {
    key: 'envcube',
    label: 'EnvCube (Reflection)',
    // A single equirectangular image (NODE_EDITOR_PLAN §8.1) — the exact FA
    // resolution/aspect is open question §14.1; 1024² matches the plan's text.
    canvas: { w: 1024, h: 1024 },
    palette: null,
    makeGraph() {
      return {
        version: 1,
        mode: 'envcube',
        canvas: { w: 1024, h: 1024 },
        nodes: {
          // Sky backdrop → EnvCube output. Planets/moons/cirrus layer in through
          // a Combine node once their source nodes exist (sprite-extract, cirrus).
          n1: { type: 'sky-gradient', params: { scmapMap: '', horizon: '#88aacc', zenith: '#0a1a3a', horizonHeight: 0, zenithHeight: 256, apexHeight: 512 }, pos: [80, 60] },
          n2: { type: 'output-envcube', params: { filename: 'reflection', format: 'DXT5', projection: 'equirect', mipmaps: true }, pos: [460, 60] },
        },
        edges: [{ from: ['n1', 'out'], to: ['n2', 'in'] }],
      };
    },
  },

  texture: {
    key: 'texture',
    label: 'Texture (DDS)',
    canvas: { w: 1024, h: 1024 },
    palette: null,
    makeGraph() {
      return {
        version: 1,
        mode: 'texture',
        canvas: { w: 1024, h: 1024 },
        nodes: {
          n1: {
            type: 'gradient',
            params: {
              stops: [
                { pos: 0.0, color: '#0a1a3a', alpha: 1 },
                { pos: 1.0, color: '#88aacc', alpha: 1 },
              ],
              angle: 0,
            },
            pos: [80, 60],
          },
          n2: { type: 'output-texture', params: { filename: 'texture', format: 'DXT5' }, pos: [460, 60] },
        },
        edges: [{ from: ['n1', 'out'], to: ['n2', 'in'] }],
      };
    },
  },
};

export const MODE_LIST = Object.values(MODES);
export const DEFAULT_MODE = 'waterramp';
