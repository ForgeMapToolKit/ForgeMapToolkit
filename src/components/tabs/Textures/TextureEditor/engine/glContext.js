/**
 * glContext.js — the WebGL2 core behind the node editor's evaluation engine.
 *
 * Every node in the graph produces exactly one texture. This module is the
 * imperative layer that makes that cheap: a single offscreen WebGL2 context, a
 * shared fullscreen-quad, a program cache keyed by fragment source, and a
 * `pass()` primitive that renders one node's shader into a framebuffer.
 *
 * It is deliberately framework-free (no three.js): a texture-pass DAG wants
 * direct control over framebuffers and render targets, not a scene graph. The
 * existing atmosphere engines use three.js because they draw one animated quad;
 * here we chain dozens of render-to-texture passes, which three's abstractions
 * only get in the way of.
 *
 *   const ctx = createGLContext();
 *   const target = ctx.allocTarget(256, 16);
 *   const prog = ctx.program(FRAG_SRC);
 *   ctx.pass(prog, { target, inputs: [texA], uniforms: { u_gamma: {type:'f', value:1.2} } });
 *   const rgba = ctx.readPixels(target, { flipY: true });   // for export
 *   ctx.blitToCanvas(target.tex, displayCanvas);             // for preview
 *   ctx.dispose();
 *
 * Targets are opaque `{ tex, fbo, w, h }` handles. The caller (the evaluator)
 * owns their lifetime; this module only allocates and frees GL objects.
 */

// Shared fullscreen-quad vertex shader (GLSL ES 3.00). Emits a 0..1 UV where
// (0,0) is bottom-left — the WebGL convention. Node shaders that describe a
// vertical position (gradients, ramps) treat uv.y = 1 as the top of the image;
// export flips rows so the DDS is stored top-down.
const QUAD_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Blit shader used for the preview: sample a texture straight to the canvas.
const BLIT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_in0;
out vec4 fragColor;
void main() { fragColor = texture(u_in0, v_uv); }`;

// Channel-isolate variants of the blit shader, for the viewport's R/G/B/A
// toggle — each just swizzles one channel into a visible grey. 'rgba' reuses
// BLIT_FRAG verbatim so the program cache (keyed by source string) doesn't
// duplicate the default path.
function channelBlitFrag(channel) {
  if (!channel || channel === 'rgba') return BLIT_FRAG;
  const swizzle = { r: 'rrr', g: 'ggg', b: 'bbb', a: 'aaa' }[channel];
  if (!swizzle) return BLIT_FRAG;
  return `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_in0;
out vec4 fragColor;
void main() { fragColor = vec4(texture(u_in0, v_uv).${swizzle}, 1.0); }`;
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`[node-editor] shader compile failed:\n${log}\n--- source ---\n${src}`);
  }
  return sh;
}

export function createGLContext() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    antialias: false,
  });
  if (!gl) throw new Error('[node-editor] WebGL2 is not available');

  // Float-target support is detected but NOT used for allocation yet: readPixels
  // with UNSIGNED_BYTE is only valid against a fixed-point (RGBA8) framebuffer,
  // which both the export readback and the preview blit rely on. Moving
  // intermediates to RGBA16F (to avoid banding compounding across a long chain)
  // is a future step that also needs a float readback + resolve-to-8bit pass.
  const floatLinear = gl.getExtension('EXT_color_buffer_float');

  // One quad, reused by every pass.
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const programCache = new Map(); // fragSrc -> { program, aPos, uniformLocs:Map }

  function program(fragSrc) {
    let entry = programCache.get(fragSrc);
    if (entry) return entry;

    const vs = compileShader(gl, gl.VERTEX_SHADER, QUAD_VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`[node-editor] program link failed:\n${log}`);
    }
    entry = { program: prog, aPos: gl.getAttribLocation(prog, 'a_pos'), uniformLocs: new Map() };
    programCache.set(fragSrc, entry);
    return entry;
  }

  function uniformLoc(entry, name) {
    let loc = entry.uniformLocs.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(entry.program, name);
      entry.uniformLocs.set(name, loc);
    }
    return loc;
  }

  function allocTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { tex, fbo, w, h };
  }

  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  }

  /**
   * Upload a decoded image (HTMLImageElement/ImageBitmap/HTMLCanvasElement)
   * as a fresh render-target-capable texture. Used by source nodes that pull
   * in externally-loaded pixels (e.g. texture-import) rather than rendering
   * their content procedurally. Image must already be decoded (await
   * img.decode() or an onload) before calling this.
   */
  function uploadImageTexture(image) {
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image rows are top-down; uv.y=1 is top
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { tex, fbo, w, h };
  }

  function setUniform(entry, name, u) {
    const loc = uniformLoc(entry, name);
    if (loc === null) return; // optimised out — silently ignore
    const v = u.value;
    switch (u.type) {
      case 'f':    gl.uniform1f(loc, v); break;
      case 'i':    gl.uniform1i(loc, v); break;
      case 'b':    gl.uniform1i(loc, v ? 1 : 0); break;
      case 'v2':   gl.uniform2fv(loc, v); break;
      case 'v3':   gl.uniform3fv(loc, v); break;
      case 'v4':   gl.uniform4fv(loc, v); break;
      case 'fv':   gl.uniform1fv(loc, v); break;    // float[]
      case 'v4v':  gl.uniform4fv(loc, v); break;    // vec4[] (flat)
      default: throw new Error(`[node-editor] unknown uniform type "${u.type}" for ${name}`);
    }
  }

  /**
   * Render one shader pass into `target`.
   * @param {object} entry     from program()
   * @param {object} opts
   * @param {object} opts.target   { fbo, w, h } — required
   * @param {WebGLTexture[]} [opts.inputs]  bound to u_in0, u_in1, … (units 0..N)
   * @param {object} [opts.uniforms]  { name: { type, value } }
   */
  function pass(entry, { target, inputs = [], uniforms = {} }) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    gl.useProgram(entry.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(entry.aPos);
    gl.vertexAttribPointer(entry.aPos, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < inputs.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, inputs[i]);
      const loc = uniformLoc(entry, `u_in${i}`);
      if (loc !== null) gl.uniform1i(loc, i);
    }
    // Common convenience uniform: target resolution.
    const resLoc = uniformLoc(entry, 'u_res');
    if (resLoc !== null) gl.uniform2f(resLoc, target.w, target.h);

    for (const name in uniforms) setUniform(entry, name, uniforms[name]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const blitEntry = () => program(BLIT_FRAG);

  /** Read a target back as RGBA8. `flipY` gives top-down rows (DDS/export order). */
  function readPixels(target, { flipY = false } = {}) {
    const { w, h } = target;
    const out = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!flipY) return out;
    const flipped = new Uint8Array(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      flipped.set(out.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    }
    return flipped;
  }

  /** Blit a texture to a visible 2D-less canvas (its own WebGL context share).
   *  `channel` isolates one channel for the viewport's R/G/B/A toggle. */
  function blitToCanvas(tex, displayCanvas, { channel = 'rgba' } = {}) {
    const w = displayCanvas.width, h = displayCanvas.height;
    // Render into our own drawing buffer, then copy the pixels across. Sharing
    // one GL context across canvases isn't possible, so we read-back + putImage.
    if (!blitToCanvas._t || blitToCanvas._t.w !== w || blitToCanvas._t.h !== h) {
      freeTarget(blitToCanvas._t);
      blitToCanvas._t = allocTarget(w, h);
    }
    const t = blitToCanvas._t;
    pass(program(channelBlitFrag(channel)), { target: t, inputs: [tex] });
    const rgba = readPixels(t, { flipY: true }); // flip so uv.y=1 shows at top
    const g2d = displayCanvas.getContext('2d');
    const img = g2d.createImageData(w, h);
    img.data.set(rgba);
    g2d.putImageData(img, 0, 0);
  }

  /**
   * A|B compare blit: renders texA and texB (same channel filter) and puts
   * texA left of `splitFrac`·width, texB right of it, with a thin white/black
   * divider baked into the pixel data (so it stays exactly in sync with the
   * split with zero extra DOM overlay/measurement code). `splitFrac` is 0..1.
   */
  function blitCompareToCanvas(texA, texB, displayCanvas, splitFrac, { channel = 'rgba' } = {}) {
    const w = displayCanvas.width, h = displayCanvas.height;
    if (!blitCompareToCanvas._t || blitCompareToCanvas._t.w !== w || blitCompareToCanvas._t.h !== h) {
      freeTarget(blitCompareToCanvas._t);
      blitCompareToCanvas._t = allocTarget(w, h);
    }
    const t = blitCompareToCanvas._t;
    const entry = program(channelBlitFrag(channel));
    pass(entry, { target: t, inputs: [texA] });
    const rgbaA = readPixels(t, { flipY: true });
    pass(entry, { target: t, inputs: [texB] });
    const rgbaB = readPixels(t, { flipY: true });

    const splitCol = Math.max(0, Math.min(w, Math.round(w * splitFrac)));
    const row = w * 4;
    const splitBytes = splitCol * 4;
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const base = y * row;
      out.set(rgbaA.subarray(base, base + splitBytes), base);
      out.set(rgbaB.subarray(base + splitBytes, base + row), base + splitBytes);
    }
    // 2px divider (black core, white edges) so it reads on both light and
    // dark image content without needing a themed colour in raw pixel data.
    for (let y = 0; y < h; y++) {
      const base = y * row;
      for (let dx = -1; dx <= 1; dx++) {
        const c = splitCol + dx;
        if (c < 0 || c >= w) continue;
        const i = base + c * 4;
        const v = dx === 0 ? 20 : 240;
        out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
      }
    }
    const g2d = displayCanvas.getContext('2d');
    const img = g2d.createImageData(w, h);
    img.data.set(out);
    g2d.putImageData(img, 0, 0);
  }

  function dispose() {
    freeTarget(blitToCanvas._t);
    freeTarget(blitCompareToCanvas._t);
    for (const { program: p } of programCache.values()) gl.deleteProgram(p);
    programCache.clear();
    gl.deleteBuffer(quadBuf);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  return {
    gl,
    hasFloat: !!floatLinear,
    program,
    allocTarget,
    freeTarget,
    uploadImageTexture,
    pass,
    readPixels,
    blitToCanvas,
    blitCompareToCanvas,
    dispose,
  };
}
