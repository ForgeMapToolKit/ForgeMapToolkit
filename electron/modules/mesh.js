'use strict';
/**
 * mesh.js — the Supreme Commander Mesh (`.scm`) reader.
 *
 * Format reference: Exotic-Retard/SupCom_Import_Export_Blender, `supcom-importer.py`.
 * The layout, little-endian throughout:
 *
 *   header   '4s11I'                    48 B   magic 'MODL' + 11 uint32
 *   bones    '16f3f4f4l'               108 B   inverse rest matrix, position,
 *                                              quaternion, 4 longs
 *   verts    '3f3f3f3f2f2f4B'           68 B   position, tangent, normal,
 *                                              binormal, uv0, uv1, boneIdx[4]
 *   indices  uint16, three per triangle
 *   info     NUL-separated strings
 *
 * Sections are padded to 32-byte boundaries, so offsets are read from the
 * header rather than computed — `parseScm` checks them against the file length
 * and against each other instead of trusting either.
 *
 * What this deliberately does *not* do: skinning. A prop is a one-bone mesh in
 * practice, so bone names are read (they identify attachment points a blueprint
 * may reference) and the rest of the skeleton is skipped. Units are read the
 * same way and therefore stand in their rest pose — which is what a size
 * reference wants anyway.
 *
 * Channels — see docs/IPC.md:
 *   viewer3d-load-mesh         .scm → flat vertex/index arrays
 *   viewer3d-resolve-blueprint _prop.bp / _unit.bp → scale + per-LOD asset paths
 *
 * Also exported, for callers that need the mesh split into the objects it holds
 * rather than one buffer: `boneClusters()`. See its own comment for why the bone
 * index — and not the triangle topology — is the thing that separates them.
 *
 * The blueprint is not optional context. Mesh coordinates are *not* ogrids: a
 * prop is authored roughly 20× oversized and shrunk by `Display.UniformScale`
 * (present in all 334 vanilla prop blueprints, median 0.05). Aeon_Bus measures
 * 23.56 along Z in its .scm and declares `SizeZ = 1` — 23.56 × 0.05 = 1.18.
 * Draw the mesh unscaled next to a tank and every size judgement is wrong by a
 * factor of twenty, which is precisely the judgement this viewer exists for.
 */

const { ipcMain } = require('electron');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');
const { resolveGameFile, isAbsolute } = require('./gamefiles');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

const HEADER_SIZE = 48;
const VERTEX_SIZE = 68;
const BONE_SIZE   = 108;

/** Offsets of the fields inside one 68-byte vertex record. */
const V_POSITION = 0;
const V_NORMAL   = 24;   // after position (12) and tangent (12)
const V_UV0      = 48;   // after binormal
const V_BONES    = 64;   // boneIdx[4], one byte each — after uv1

/** Offset of the name pointer inside one 108-byte bone record. */
const B_NAME = 92;

/**
 * Parse a `.scm` buffer into flat arrays ready for a GPU buffer.
 *
 * @param {Buffer} buf
 * @returns {{positions: Float32Array, normals: Float32Array, uvs: Float32Array,
 *            indices: Uint16Array, bounds: {min: number[], max: number[]},
 *            vertCount: number, triCount: number, boneNames: string[], version: number}}
 * @throws {Error} on anything that does not read as a MODL file
 */
function parseScm(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < HEADER_SIZE) {
    throw new Error('not a .scm file (too short)');
  }
  if (buf.toString('latin1', 0, 4) !== 'MODL') {
    throw new Error(`not a .scm file (magic "${buf.toString('latin1', 0, 4)}")`);
  }

  const version         = buf.readUInt32LE(4);
  const boneOffset      = buf.readUInt32LE(8);
  const weightedBoneCount = buf.readUInt32LE(12);
  const vertOffset      = buf.readUInt32LE(16);
  // readUInt32LE(20) is the extra-vertex offset — a second, optional vertex
  // stream this reader has no use for.
  const vertCount       = buf.readUInt32LE(24);
  const indexOffset     = buf.readUInt32LE(28);
  const indexCount      = buf.readUInt32LE(32);
  const infoOffset      = buf.readUInt32LE(36);
  const infoCount       = buf.readUInt32LE(40);
  const totalBoneCount  = buf.readUInt32LE(44);

  // A truncated or mis-parsed file usually shows up as an offset past the end
  // or a vertex block that overruns the index block. Both are cheap to check
  // and turn a silent garbage mesh into a readable error.
  if (vertOffset + vertCount * VERTEX_SIZE > buf.length) {
    throw new Error(`vertex block overruns file (${vertCount} verts at ${vertOffset}, file is ${buf.length} B)`);
  }
  if (indexOffset + indexCount * 2 > buf.length) {
    throw new Error(`index block overruns file (${indexCount} indices at ${indexOffset}, file is ${buf.length} B)`);
  }
  if (indexCount % 3 !== 0) {
    throw new Error(`index count ${indexCount} is not a multiple of 3`);
  }

  const positions = new Float32Array(vertCount * 3);
  const normals   = new Float32Array(vertCount * 3);
  const uvs       = new Float32Array(vertCount * 2);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < vertCount; i++) {
    const at = vertOffset + i * VERTEX_SIZE;

    for (let c = 0; c < 3; c++) {
      const v = buf.readFloatLE(at + V_POSITION + c * 4);
      positions[i * 3 + c] = v;
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
      normals[i * 3 + c] = buf.readFloatLE(at + V_NORMAL + c * 4);
    }

    // UVs are passed through unflipped. FA uses the D3D convention (v = 0 is
    // the top row) and so does a DDS file, and three's DataTexture defaults to
    // flipY = false — so raw data row 0 lands at t = 0 and the two conventions
    // already agree. Flipping here would break that pairing; the renderer side
    // documents the other half (Shared/Scene3D/engine.js).
    uvs[i * 2]     = buf.readFloatLE(at + V_UV0);
    uvs[i * 2 + 1] = buf.readFloatLE(at + V_UV0 + 4);
  }

  const indices = new Uint16Array(indexCount);
  for (let i = 0; i < indexCount; i++) indices[i] = buf.readUInt16LE(indexOffset + i * 2);

  // Bone names live in the info section, pointed at by an offset inside each
  // bone record. Reading the name directly off that offset is more robust than
  // assuming the info strings are in bone order.
  const boneNames = [];
  const boneCount = totalBoneCount || weightedBoneCount;
  for (let i = 0; i < boneCount; i++) {
    const at = boneOffset + i * BONE_SIZE;
    if (at + BONE_SIZE > buf.length) break;
    // The four trailing longs are name offset, parent index, and two reserved.
    const nameOffset = buf.readUInt32LE(at + B_NAME);
    if (nameOffset > 0 && nameOffset < buf.length) {
      const end = buf.indexOf(0, nameOffset);
      boneNames.push(buf.toString('latin1', nameOffset, end === -1 ? buf.length : end));
    }
  }

  if (vertCount === 0) { min.fill(0); max.fill(0); }

  return {
    version, positions, normals, uvs, indices,
    bounds: { min, max },
    vertCount,
    triCount: indexCount / 3,
    boneNames,
    infoCount,
    infoOffset,
  };
}

// ── boneClusters ────────────────────────────────────────────────────────────
/**
 * Split a `.scm` into the individual objects it holds — for a tree *group*, the
 * separate trees.
 *
 * **The bone index is what separates them, not the triangle topology.** Union-
 * find over shared vertices looks like the obvious answer and is wrong by an
 * order of magnitude: `Oak01_Group1_lod0.scm` holds 8 trees and 280 connected
 * components, because every leaf card is its own unwelded quad. Each vertex's
 * `boneIdx[0]`, in contrast, partitions that file into exactly 8 groups of 194
 * verts — one per `Oak01_s*_*` bone. Checked across Evergreen, Desert, Tundra
 * and Lava groups: the bone count is always `1 root + n objects`, or `n` when
 * the root carries geometry of its own (`DC01_GroupA`).
 *
 * Vertices are already in **mesh-local** space, not bone-local — the per-bone
 * centroid lands on the tree, so no skinning transform is needed (and the bone
 * records' own `position` field does *not* agree with the geometry: Oak bone 1
 * reads (3.28, −16.29, −10.41) for a tree whose verts sit at (−0.27, −0.31)).
 * Reading the vertices is therefore both simpler and the only correct option.
 *
 * Y is up and every tree's base sits on one shared local plane: measured over
 * 4 391 multi-tree props on `dualgap_adaptive`, the spread of per-tree `baseY`
 * within a group has a median of 0.001 world units. That flat plane is exactly
 * why a group floats over a cliff — see `floating-props.js`.
 *
 * `x`/`z`/`radius` describe the **base footprint** (the lowest tenth of the
 * object's height), not the whole hull: a leaning canopy drags a full centroid
 * metres off the trunk it is supposed to stand on.
 *
 * @param {Buffer} buf
 * @returns {{clusters: Array<{bone: number, name: string, vertCount: number,
 *            x: number, z: number, baseY: number, height: number, radius: number}>,
 *            vertCount: number, boneCount: number}}
 * @throws {Error} on anything that does not read as a MODL file
 */
function boneClusters(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < HEADER_SIZE) {
    throw new Error('not a .scm file (too short)');
  }
  if (buf.toString('latin1', 0, 4) !== 'MODL') {
    throw new Error(`not a .scm file (magic "${buf.toString('latin1', 0, 4)}")`);
  }

  const boneOffset        = buf.readUInt32LE(8);
  const weightedBoneCount = buf.readUInt32LE(12);
  const vertOffset        = buf.readUInt32LE(16);
  const vertCount         = buf.readUInt32LE(24);
  const totalBoneCount    = buf.readUInt32LE(44);

  if (vertOffset + vertCount * VERTEX_SIZE > buf.length) {
    throw new Error(`vertex block overruns file (${vertCount} verts at ${vertOffset}, file is ${buf.length} B)`);
  }

  const boneCount = totalBoneCount || weightedBoneCount;
  const names = [];
  for (let i = 0; i < boneCount; i++) {
    const at = boneOffset + i * BONE_SIZE;
    if (at + BONE_SIZE > buf.length) break;
    const nameOffset = buf.readUInt32LE(at + B_NAME);
    if (nameOffset > 0 && nameOffset < buf.length) {
      const end = buf.indexOf(0, nameOffset);
      names.push(buf.toString('latin1', nameOffset, end === -1 ? buf.length : end));
    } else {
      names.push('');
    }
  }

  // Bucket the vertices by bone in one pass. `boneIdx` is a byte, so a mesh
  // with more than 256 bones cannot address them all — no vanilla group comes
  // close (the largest seen is 23), and an out-of-range index falls back to
  // bucket 0 rather than dropping the vertex.
  const buckets = new Map();
  for (let i = 0; i < vertCount; i++) {
    const at = vertOffset + i * VERTEX_SIZE;
    let b = buf.readUInt8(at + V_BONES);
    if (b >= boneCount) b = 0;
    let bucket = buckets.get(b);
    if (!bucket) { bucket = []; buckets.set(b, bucket); }
    bucket.push(at);
  }

  const clusters = [];
  for (const [bone, offsets] of buckets) {
    let baseY = Infinity, topY = -Infinity;
    for (const at of offsets) {
      const y = buf.readFloatLE(at + V_POSITION + 4);
      if (y < baseY) baseY = y;
      if (y > topY)  topY = y;
    }

    // The base footprint: everything within the lowest tenth of the object's
    // height. The 0.01 floor keeps a flat object (a decal-like card) from
    // collapsing to a single vertex.
    const cut = baseY + Math.max((topY - baseY) * 0.10, 0.01);
    const base = offsets.filter(at => buf.readFloatLE(at + V_POSITION + 4) <= cut);
    const src  = base.length >= 3 ? base : offsets;

    let cx = 0, cz = 0;
    for (const at of src) {
      cx += buf.readFloatLE(at + V_POSITION);
      cz += buf.readFloatLE(at + V_POSITION + 8);
    }
    cx /= src.length;
    cz /= src.length;

    let radius = 0;
    for (const at of src) {
      const dx = buf.readFloatLE(at + V_POSITION) - cx;
      const dz = buf.readFloatLE(at + V_POSITION + 8) - cz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > radius) radius = d;
    }

    clusters.push({
      bone,
      name: names[bone] || `bone${bone}`,
      vertCount: offsets.length,
      x: cx, z: cz,
      baseY,
      height: topY - baseY,
      radius,
    });
  }

  clusters.sort((a, b) => a.bone - b.bone);
  return { clusters, vertCount, boneCount };
}

// ── viewer3d-load-mesh ──────────────────────────────────────────────────────
// Takes an in-game path (`/env/…/x_lod0.scm`) or an absolute path; the guard
// only applies to the latter, exactly as node-editor-load-texture does it.
// Typed arrays travel as base64 — same convention as that handler's `rgba`.
// `meshBytes` covers the drag-and-drop case. A file dropped from the Desktop
// sits outside every allowlisted root, so asking the guard to open it by path
// would — correctly — be refused; the renderer reads it and sends the bytes
// instead, and no filesystem access happens here at all.
ipcMain.handle('viewer3d-load-mesh', withPathGuard(
  ({ meshPath, meshBytes }) =>
    (!meshBytes && isAbsolute(String(meshPath || '').replace(/\\/g, '/')) ? [meshPath] : []),
  async (event, { meshPath, meshBytes = null, mapName = null, prefer = [] } = {}) => {
    try {
      let buf;
      if (meshBytes) {
        buf = Buffer.from(meshBytes, 'base64');
      } else {
        if (!/\.scm$/i.test(String(meshPath || ''))) {
          return { success: false, error: 'only .scm meshes are supported' };
        }
        const settings = readSettings();
        buf = await resolveGameFile(meshPath, settings, mapName, { prefer });
        if (!buf) return { success: false, error: `mesh not found: ${meshPath}` };
      }

      const m = parseScm(buf);
      return {
        success:   true,
        version:   m.version,
        vertCount: m.vertCount,
        triCount:  m.triCount,
        bounds:    m.bounds,
        boneNames: m.boneNames,
        positions: Buffer.from(m.positions.buffer).toString('base64'),
        normals:   Buffer.from(m.normals.buffer).toString('base64'),
        uvs:       Buffer.from(m.uvs.buffer).toString('base64'),
        indices:   Buffer.from(m.indices.buffer).toString('base64'),
      };
    } catch (err) {
      log.warn('[viewer3d] load-mesh failed:', err.message);
      return { success: false, error: err.message };
    }
  },
));

// ── Blueprints ──────────────────────────────────────────────────────────────
// A `.bp` is Lua, but only a handful of scalar fields matter here and they are
// all flat `Key = value` lines. Full Lua evaluation would buy nothing and cost
// a sandbox, so this reads the fields directly — the same choice patchBpText()
// in props.js already makes.

const num = (text, key) => {
  const m = new RegExp(`\\b${key}\\s*=\\s*(-?[\\d.]+(?:[eE][+-]?\\d+)?)`).exec(text);
  return m ? parseFloat(m[1]) : null;
};
const str = (text, key) => {
  const m = new RegExp(`\\b${key}\\s*=\\s*'([^']*)'`).exec(text);
  return m ? m[1] : null;
};

/** The balanced `{ … }` groups directly inside the `LODs = { … }` table. */
function lodBlocks(text) {
  const start = /LODs\s*=\s*\{/.exec(text);
  if (!start) return [];
  const blocks = [];
  let depth = 0, groupStart = -1;
  for (let i = start.index + start[0].length - 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      depth++;
      if (depth === 2) groupStart = i;
    } else if (ch === '}') {
      depth--;
      if (depth === 1 && groupStart !== -1) { blocks.push(text.slice(groupStart, i + 1)); groupStart = -1; }
      if (depth === 0) break;
    }
  }
  return blocks;
}

/**
 * A bare `foo.dds` is relative to the blueprint; `/env/…/foo.dds` is absolute.
 * Grouped props reach out of their folder (`Groups/../Cactus01_albedo.dds`), so
 * `..` has to collapse — 40 of the vanilla albedo references miss otherwise.
 */
function assetPath(name, bpDir) {
  if (!name) return null;
  const raw = name.replace(/\\/g, '/');
  const joined = raw.startsWith('/') ? raw : `${bpDir}/${raw}`;
  const out = [];
  for (const seg of joined.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

/**
 * Read the parts of a blueprint the viewer needs.
 *
 * @param {string} text    blueprint source
 * @param {string} bpPath  its game path, used to resolve relative asset names
 *                         and to derive mesh names by convention
 */
function parseBlueprint(text, bpPath) {
  const clean  = String(bpPath || '').replace(/\\/g, '/').replace(/^\/+/, '/');
  const bpDir  = clean.slice(0, clean.lastIndexOf('/')) || '';
  const base   = clean.slice(clean.lastIndexOf('/') + 1).replace(/_(prop|unit)\.bp$/i, '').replace(/\.bp$/i, '');

  const lods = lodBlocks(text).map((block, i) => {
    const declaredAlbedo = assetPath(str(block, 'AlbedoName'), bpDir);
    return {
      // 319 of 334 vanilla props leave MeshName out and rely on the
      // `<base>_lod<n>.scm` convention; the 15 that don't are effect-only props
      // pointing at a shared mesh, and those do name it.
      meshPath:   assetPath(str(block, 'MeshName'), bpDir) || `${bpDir}/${base}_lod${i}.scm`,
      albedoPath: declaredAlbedo,
      // Unit blueprints name the texture only on LOD1 and let the engine derive
      // LOD0's — `UEL0201_Albedo.dds` beside the blueprint, with no lod suffix
      // on the first one. Without this the reference units all render grey.
      albedoCandidates: [
        declaredAlbedo,
        `${bpDir}/${base}${i === 0 ? '' : `_lod${i}`}_albedo.dds`,
      ].filter(Boolean),
      normalPath: assetPath(str(block, 'NormalsName') || str(block, 'NormalName'), bpDir),
      specPath:   assetPath(str(block, 'SpecularName') || str(block, 'SpecName'), bpDir),
      shaderName: str(block, 'ShaderName'),
      lodCutoff:  num(block, 'LODCutoff'),
    };
  });

  return {
    name: base,
    // A missing UniformScale means 1 in the engine, but no vanilla prop omits
    // it — treat a missing one as suspicious rather than silently scaling by 1.
    uniformScale: num(text, 'UniformScale'),
    // The pathing footprint in ogrids — what blocks movement, not the mesh
    // extent. Worth showing next to the measured bbox, but not a check on it:
    // plenty of vanilla props leave it at the template 0.5/1 regardless of how
    // big the object actually is (Aeon_Dock is 4.3 ogrids wide and says 0.5).
    declaredSize: { x: num(text, 'SizeX'), y: num(text, 'SizeY'), z: num(text, 'SizeZ') },
    lods,
  };
}

// ── viewer3d-resolve-blueprint ──────────────────────────────────────────────
ipcMain.handle('viewer3d-resolve-blueprint', withPathGuard(
  ({ bpPath }) => (isAbsolute(String(bpPath || '').replace(/\\/g, '/')) ? [bpPath] : []),
  async (event, { bpPath, mapName = null, prefer = [] } = {}) => {
    try {
      if (!/\.bp$/i.test(String(bpPath || ''))) {
        return { success: false, error: 'not a blueprint path' };
      }
      const settings = readSettings();
      const buf = await resolveGameFile(bpPath, settings, mapName, { prefer });
      if (!buf) return { success: false, error: `blueprint not found: ${bpPath}` };
      return { success: true, ...parseBlueprint(buf.toString('utf8'), bpPath) };
    } catch (err) {
      log.warn('[viewer3d] resolve-blueprint failed:', err.message);
      return { success: false, error: err.message };
    }
  },
));

function register() {
  // handlers registered at module load time above
}

module.exports = { parseScm, boneClusters, parseBlueprint, register };
