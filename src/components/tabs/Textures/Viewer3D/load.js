/**
 * load.js — turning a blueprint into something the scene can hold.
 *
 * Pure functions over IPC; no React, no three. The tab calls `loadAsset()` and
 * gets back everything `Scene3D`'s `setMesh` wants, plus the numbers the readout
 * shows.
 *
 * Three channels are involved and none of them is new work per asset:
 *   viewer3d-resolve-blueprint  bp → UniformScale + per-LOD asset paths
 *   viewer3d-load-mesh          .scm → vertex/index arrays
 *   node-editor-load-texture    .dds → RGBA  (general-purpose despite the name)
 */

const ipc = () => window.electronAPI;

/**
 * Does this shader treat the albedo's alpha as a cutout mask?
 *
 * FA puts two unrelated things in that channel and the shader name is what
 * decides which. Measured across the vanilla prop set:
 *
 *   Unit / Aeon / Seraphim        team-colour mask — Aeon_Bus is 100% below
 *                                 alpha 16. Cutting on it erases the mesh.
 *   TMeshAlpha / *Clutter /       genuine cutout — ferns, branches, grass sit
 *   *NormalMappedAlpha / TreeFull between 55% and 87% transparent.
 *   VertexNormal / NormalMapped-  fully opaque alpha; the test is harmless
 *   Terrain / TMeshNoNormals      either way, so it stays off.
 *
 * Statistics alone cannot separate these — a dead tree reads 87/7 transparent
 * to opaque and a Seraphim car 83/11 — so the name is the signal and the
 * texture is only consulted when there is no blueprint at all.
 */
export function shaderCutsAlpha(shaderName) {
  return /alpha|clutter|tree/i.test(String(shaderName || ''));
}

/** Typed arrays cross IPC as base64; unpack without a round trip through atob's string. */
function fromBase64(b64, Ctor) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Ctor(bytes.buffer);
}

function toBase64(bytes) {
  let s = '';
  // Chunked — spreading a multi-megabyte array into String.fromCharCode blows
  // the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Read a dropped File as base64, which is what both loaders accept. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(toBase64(new Uint8Array(r.result)));
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

async function loadMesh(args) {
  const res = await ipc().invoke('viewer3d-load-mesh', args);
  if (!res?.success) throw new Error(res?.error || 'mesh load failed');
  return {
    positions: fromBase64(res.positions, Float32Array),
    normals:   fromBase64(res.normals, Float32Array),
    uvs:       fromBase64(res.uvs, Float32Array),
    indices:   fromBase64(res.indices, Uint16Array),
    bounds:    res.bounds,
    triCount:  res.triCount,
    vertCount: res.vertCount,
    boneNames: res.boneNames || [],
  };
}

/** Returns null rather than throwing — a missing albedo is a grey mesh, not a failure. */
async function loadTexture(args) {
  try {
    const res = await ipc().invoke('node-editor-load-texture', args);
    if (!res?.success) return null;
    return { data: fromBase64(res.rgba, Uint8Array), width: res.width, height: res.height };
  } catch { return null; }
}

/**
 * Load a prop or unit from its blueprint.
 *
 * @param {string} bpPath  in-game path to a `_prop.bp` / `_unit.bp`
 * @param {{prefer?: string[], mapName?: string, lod?: number}} opts
 * @returns {Promise<{mesh, texture, scale, blueprint, lod}>}
 */
export async function loadAsset(bpPath, { prefer = [], mapName = null, lod = 0 } = {}) {
  const bp = await ipc().invoke('viewer3d-resolve-blueprint', { bpPath, mapName, prefer });
  if (!bp?.success) throw new Error(bp?.error || 'blueprint not found');

  const entry = bp.lods[lod] || bp.lods[0];
  if (!entry) throw new Error('blueprint declares no LODs');

  const mesh = await loadMesh({ meshPath: entry.meshPath, mapName, prefer });

  // Declared name first, then the engine's naming convention — units name
  // their LOD0 albedo nowhere and expect it to be found by that convention.
  let texture = null;
  let albedoPath = null;
  for (const candidate of entry.albedoCandidates || []) {
    texture = await loadTexture({ texturePath: candidate, mapName });
    if (texture) { albedoPath = candidate; break; }
  }

  return {
    mesh,
    texture,
    // A blueprint without UniformScale would render twenty times too big; the
    // engine defaults it to 1 in that case, and the readout flags it.
    scale: bp.uniformScale ?? 1,
    alphaCutout: shaderCutsAlpha(entry.shaderName),
    blueprint: {
      name: bp.name,
      uniformScale: bp.uniformScale,
      declaredSize: bp.declaredSize,
      shaderName: entry.shaderName,
      lodCount: bp.lods.length,
      albedoPath,
      meshPath: entry.meshPath,
    },
    lod,
  };
}

/**
 * Load a loose `.scm` (+ optional `.dds`) dropped onto the tab.
 *
 * There is no blueprint here, so there is no UniformScale either — the caller
 * supplies one. That is not a detail the UI can hide: an unscaled prop mesh is
 * roughly twenty times its in-game size.
 */
export async function loadLooseMesh(scmFile, ddsFile, scale) {
  const mesh = await loadMesh({ meshBytes: await fileToBase64(scmFile) });
  const texture = ddsFile
    ? await loadTexture({ texturePath: ddsFile.name, textureBytes: await fileToBase64(ddsFile) })
    : null;
  return {
    mesh,
    texture,
    scale,
    // No shader name to go on — the engine falls back to reading the texture.
    alphaCutout: null,
    blueprint: {
      name: scmFile.name.replace(/\.scm$/i, ''),
      uniformScale: null,
      declaredSize: { x: null, y: null, z: null },
      shaderName: null,
      lodCount: 1,
      albedoPath: ddsFile ? ddsFile.name : null,
      meshPath: scmFile.name,
    },
    lod: 0,
  };
}
