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

  /**
   * The 3D Viewer's Shading workspace (Tabs/Textures/Viewer3D/Shading.jsx).
   *
   * Unlike the other templates this one has a *host*: the viewer owns which
   * asset is being shaded and keeps the `src` node's path in step with the
   * selected object, while the output feeds straight back onto the mesh in the
   * viewport above. The fixed node ids are the contract for that — `src` is the
   * one the host writes, everything downstream is the user's to rearrange.
   *
   * freshId() only ever reuses ids matching /^[a-z]+\d+$/, so these unnumbered
   * ids can never collide with a node added later.
   */
  propalbedo: {
    key: 'propalbedo',
    label: 'Asset Shading',
    canvas: { w: 512, h: 512 },
    palette: null,
    makeGraph() {
      return {
        version: 1,
        mode: 'propalbedo',
        canvas: { w: 512, h: 512 },
        nodes: {
          // Path stays empty: the viewer fills it from the selected object's
          // blueprint. A hard-coded default here would render a wrong texture
          // confidently for the second between mount and the first sync.
          //
          // x-positions start past 244px (the toolbox dock's width, TextureEditor.css
          // `.ne-palette-dock`) — spawning `src` under x=60 put it permanently behind
          // the always-open toolbox, unreachable and invisible.
          src: { type: 'texture-import', params: { path: '', mapName: '', alphaOnly: false }, pos: [340, 70] },
          hue: { type: 'hsv', params: { hue: 0, sat: 1, val: 1 }, pos: [580, 70] },
          lum: { type: 'brightness-contrast', params: { brightness: 0, contrast: 1 }, pos: [810, 70] },
          out: { type: 'output-texture', params: { filename: 'albedo', format: 'DXT5', mipmaps: true }, pos: [1040, 70] },
        },
        edges: [
          { from: ['src', 'out'], to: ['hue', 'in'] },
          { from: ['hue', 'out'], to: ['lum', 'in'] },
          { from: ['lum', 'out'], to: ['out', 'in'] },
        ],
      };
    },
  },
};

export const MODE_LIST = Object.values(MODES);
export const DEFAULT_MODE = 'waterramp';

/** The node id the Shading workspace writes its source texture path into. */
export const SOURCE_NODE_ID = 'src';
