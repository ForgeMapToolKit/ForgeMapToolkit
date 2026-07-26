/**
 * textureImport.js — show a game texture (planet/star atlas, cirrus, cube…).
 *
 * A Source that points at a texture *path* — "/textures/environment/foo.dds"
 * inside a gamedata .scd, "/maps/<map>/env/skybox/bar.dds" next to the map, or
 * an absolute file. Resolving + decoding happens over IPC; the engine's
 * textureStore hands `render` whatever is available right now (a placeholder
 * while it loads) and re-triggers evaluation when the pixels land — so the node
 * stays a pure function of its params.
 */

import { registerNode } from '../registry.js';
import TextureImportEditor from '../../ui/TextureImportEditor.jsx';

const COPY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
uniform int u_alphaOnly;
void main() {
  vec4 c = texture(u_in0, v_uv);
  // "Alpha only" lifts the alpha channel into a visible greyscale mask (A=1) —
  // that's the shape a Combine RGB+A or Combine RGBA node wants to consume, and
  // it makes the channel visible in the preview instead of an invisible ramp.
  fragColor = u_alphaOnly == 1 ? vec4(vec3(c.a), 1.0) : c;
}`;

// Shown while loading / when the path can't be resolved: a faint checker so the
// node reads as "no pixels yet" rather than silently black.
const PLACEHOLDER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_res;
uniform float u_err;
void main() {
  vec2 g = floor(v_uv * u_res / 16.0);
  float c = mod(g.x + g.y, 2.0) * 0.06 + 0.05;
  fragColor = vec4(c + u_err * 0.18, c, c, 1.0);
}`;

registerNode({
  type: 'texture-import',
  category: 'source',
  label: 'Import Texture',
  accent: '#5ec8ff',
  params: {
    path:      { type: 'text', label: 'Texture path', default: '', editorParam: true },
    mapName:   { type: 'text', label: 'Map (for /maps/… paths)', default: '' },
    alphaOnly: { type: 'b', label: 'Use only alpha channel', default: false },
  },
  inputs: [],
  editor: TextureImportEditor,
  render(ctx, { params, target }) {
    const store = ctx.textureStore;
    const entry = store ? store.request(params.path, params.mapName) : null;
    if (entry?.state === 'ready' && entry.tex) {
      ctx.pass(ctx.program(COPY_FRAG), {
        target,
        inputs: [entry.tex],
        uniforms: { u_alphaOnly: { type: 'i', value: params.alphaOnly ? 1 : 0 } },
      });
      return;
    }
    ctx.pass(ctx.program(PLACEHOLDER_FRAG), {
      target,
      uniforms: { u_err: { type: 'f', value: entry?.state === 'error' ? 1 : 0 } },
    });
  },
});
