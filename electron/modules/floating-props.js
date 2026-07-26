'use strict';
/**
 * floating-props.js — Floating Trees: find props whose geometry does not sit on
 * the ground it was placed on.
 *
 *   floatprops-scan   Reads a map folder's .scmap, resolves every distinct prop
 *                     blueprint to its LOD0 mesh, splits each mesh into the
 *                     objects it holds, and measures each object's base against
 *                     the terrain under *that object* — not under the prop.
 *
 * ── Why this is a real defect class ────────────────────────────────────────────
 *
 * The editor places a prop by snapping **one** point to the terrain: the prop's
 * origin. Verified on real maps — `P.y − terrain(P.xz)` over 12 597 props on
 * `dualgap_adaptive` has a median of 0.004 world units, so the stored Y *is* the
 * terrain height at the origin, to within rounding.
 *
 * A tree *group* is a single prop holding a dozen or more trees, and all of them
 * are authored on one flat local plane (median spread of per-tree `baseY` within
 * a group: 0.001 units). Snapping the origin therefore snaps the whole slab. On
 * flat ground that is invisible and correct. Over a cliff, a ramp or a crater
 * rim, the outer trees keep the origin's elevation while the ground beneath them
 * does not — and they hang in the air, or sink into the hill.
 *
 * ── What is measured ───────────────────────────────────────────────────────────
 *
 * For each object in each prop, the base footprint is transformed into world
 * space and the terrain is sampled under it:
 *
 *   trunkBase = P.y + baseY · uniformScale · propScale.y
 *   airGap    = trunkBase − min(terrain over the footprint)   → FLOATING
 *   sink      = max(terrain over the footprint) − P.y         → BURIED
 *   lift      = P.y − terrain(object centre)                  → the terrain effect alone
 *
 * `airGap` is what a player sees, and it has to include `baseY`: artists
 * routinely author a trunk reaching *below* the group plane so its roots stay
 * buried on uneven ground. `Dead01_Group2` sinks three of its twelve trunks by
 * up to 0.33 units this way, and ignoring that reported all twelve as defects on
 * a perfectly fine map. `sink` and `lift` deliberately drop `baseY` for the
 * mirror-image reason — how deep the artist buried a trunk is not the mapper's
 * problem, so measuring "buried" against the group plane keeps the artist's
 * intent out of the verdict.
 *
 * The footprint is sampled at its centre plus a ring, rather than at one point:
 * a trunk standing on a step shows air on its low side while its centre reads
 * clean.
 *
 * ── Split of responsibility ────────────────────────────────────────────────────
 *
 * This module is geometry and I/O; it never decides what counts as too much.
 * Tolerance lives renderer-side (`Shared/MapLogic/floatingPropsLogic.js`) so the
 * slider re-judges a scanned map without touching disk. To keep that possible
 * without shipping 100 000 object records, only objects at or above `floor` are
 * returned — the renderer clamps its tolerance to `floor` so a count can never
 * silently miss an object that was filtered out here.
 *
 * ── One known indeterminacy ────────────────────────────────────────────────────
 *
 * Whether .scm local X/Z map onto world X/Z unmirrored is not provable from the
 * data: all four mirror variants score within 2 % of each other on mean |gap|
 * across three maps, because the residual is dominated by terrain roughness. The
 * plain reading (the rotation vectors are the basis' columns) is used, which is
 * the mathematically natural one and the one that makes a group's centre object
 * read ≈ 0.00. A mirror would reshuffle which object in a group is named, never
 * whether the prop has a problem.
 *
 * Exports: register() — no-op; the handler registers at module load.
 */

const path = require('path');
const fs   = require('fs');
const { ipcMain } = require('electron');
const { log } = require('./logger');
const { readSettings } = require('./settings');
const { withPathGuard: _withPathGuardBase } = require('./security');
const { resolveGameFile } = require('./gamefiles');
const { boneClusters, parseBlueprint } = require('./mesh');
const scmapUtils = require('../../utils/scmap');

function withPathGuard(pathExtractor, handler) {
  return _withPathGuardBase(pathExtractor, handler, readSettings, log);
}

// Props live in env.scd; naming it first turns a scan of every archive into one
// hit. A hint, never a filter — see gamefiles.js.
const PROP_ARCHIVES = ['env.'];

// Ring samples around a footprint centre. Six is enough to catch a step under a
// trunk and keeps a 100 k-object map at well under a second.
const RING_SAMPLES = 6;

// A footprint smaller than this reads as a point sample; below it the ring would
// sit inside one heightmap texel and measure nothing.
const MIN_FOOTPRINT = 0.15;

// Hard cap on returned prop records, so a wrecked map cannot produce a payload
// that stalls the renderer. Never silent — the response says how many were cut.
const MAX_PROPS = 4000;

/**
 * Bilinear world-height sampler over a .scmap heightmap.
 *
 * One heightmap texel = one world unit, grid anchored at the world origin — the
 * same convention `Shared/MapLogic/terrainSampler.js` documents renderer-side
 * and `map-resizer.js` relies on when resampling `heightmap.raw`.
 */
function createSampler(data) {
  const [sizeX, sizeZ] = data.size;
  const w = sizeX + 1;
  const scale = data.heightmapScale;
  const raw = data.heightmap.data;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const at = (gx, gz) => view.getUint16((gz * w + gx) * 2, true);

  return (worldX, worldZ) => {
    const fx = Math.min(Math.max(worldX, 0), sizeX);
    const fz = Math.min(Math.max(worldZ, 0), sizeZ);
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, sizeX), z1 = Math.min(z0 + 1, sizeZ);
    const tx = fx - x0, tz = fz - z0;
    return (
      at(x0, z0) * (1 - tx) * (1 - tz) + at(x1, z0) * tx * (1 - tz) +
      at(x0, z1) * (1 - tx) * tz       + at(x1, z1) * tx * tz
    ) * scale;
  };
}

/**
 * Resolve one prop blueprint to the geometry the scan needs.
 * Cached per scan: a map references 7–80 distinct blueprints for thousands of
 * placements, so the .scd reads happen once each.
 */
async function resolveModel(bpPath, settings, mapName) {
  const bpBuf = await resolveGameFile(bpPath, settings, mapName, { prefer: PROP_ARCHIVES });
  if (!bpBuf) return { error: 'blueprint not found' };

  const bp = parseBlueprint(bpBuf.toString('utf8'), bpPath);
  const meshPath = bp.lods[0]?.meshPath;
  if (!meshPath) return { error: 'blueprint declares no LODs' };

  const meshBuf = await resolveGameFile(meshPath, settings, mapName, { prefer: PROP_ARCHIVES });
  if (!meshBuf) return { error: `mesh not found: ${meshPath}` };

  let split;
  try {
    split = boneClusters(meshBuf);
  } catch (err) {
    return { error: `mesh unreadable: ${err.message}` };
  }

  return {
    name: bp.name,
    meshPath,
    // A missing UniformScale means 1 in the engine. No vanilla prop omits it,
    // and a custom prop that does is almost certainly authored at world scale.
    uniformScale: bp.uniformScale ?? 1,
    clusters: split.clusters,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// floatprops-scan
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('floatprops-scan', withPathGuard(
  ({ mapFolderPath }) => [mapFolderPath],
  async (event, { mapFolderPath, floor = 0.2 } = {}) => {
    try {
      let entries;
      try { entries = fs.readdirSync(mapFolderPath); }
      catch (_) { return { success: false, error: `Map folder not found: ${mapFolderPath}` }; }

      const scmapName = entries.find(f => f.toLowerCase().endsWith('.scmap'));
      if (!scmapName) return { success: false, error: `No .scmap in ${mapFolderPath}` };

      const data = scmapUtils.readDatastream(fs.readFileSync(path.join(mapFolderPath, scmapName)));
      if (!data.heightmap?.data) return { success: false, error: 'the .scmap carries no heightmap' };

      const settings = readSettings();
      const mapName  = path.basename(mapFolderPath);
      const height   = createSampler(data);
      const water    = data.waterSettings?.waterPresent ? data.waterSettings.elevation : null;
      const cut      = Math.max(Number(floor) || 0, 0.01);

      const models = new Map();   // lowercased bp path -> resolved model | { error }
      const props  = [];
      let objectTotal = 0, truncated = 0;

      for (let i = 0; i < data.props.length; i++) {
        const prop = data.props[i];
        const bpPath = String(prop.path || '');
        if (!bpPath) continue;

        const key = bpPath.toLowerCase();
        let model = models.get(key);
        if (!model) {
          model = await resolveModel(bpPath, settings, mapName);
          model.path = bpPath;
          model.count = 0;
          models.set(key, model);
        }
        model.count++;
        if (model.error) continue;

        const [px, py, pz] = prop.position;
        const rx = prop.rotationX, rz = prop.rotationZ;
        const ps = prop.scale;
        const s  = model.uniformScale;

        const offenders = [];
        for (const c of model.clusters) {
          objectTotal++;

          // Local base centroid → world. The three rotation vectors are the
          // basis' columns, so a local offset is their weighted sum.
          const lx = c.x * s * ps[0];
          const lz = c.z * s * ps[2];
          const wx = px + rx[0] * lx + rz[0] * lz;
          const wz = pz + rx[2] * lx + rz[2] * lz;

          const r = Math.max(c.radius * s * Math.max(ps[0], ps[2]), MIN_FOOTPRINT);
          const centre = height(wx, wz);
          let tMin = centre, tMax = centre;
          for (let k = 0; k < RING_SAMPLES; k++) {
            const a = (k / RING_SAMPLES) * Math.PI * 2;
            const t = height(wx + Math.cos(a) * r, wz + Math.sin(a) * r);
            if (t < tMin) tMin = t;
            if (t > tMax) tMax = t;
          }

          const trunkBase = py + c.baseY * s * ps[1];
          const airGap = trunkBase - tMin;
          const sink   = tMax - py;
          if (airGap < cut && sink < cut) continue;

          offenders.push({
            name: c.name,
            x: wx, z: wz,
            dist: Math.hypot(wx - px, wz - pz),
            airGap, sink,
            lift: py - centre,
            radius: r,
            height: c.height * s * ps[1],
            underwater: water != null && centre < water,
          });
        }

        if (!offenders.length) continue;
        if (props.length >= MAX_PROPS) { truncated++; continue; }

        offenders.sort((a, b) => b.airGap - a.airGap);
        props.push({
          index: i,
          path: bpPath,
          name: model.name,
          position: [px, py, pz],
          heading: Math.atan2(rx[2], rx[0]) * (180 / Math.PI),
          objectCount: model.clusters.length,
          anchorOffset: py - height(px, pz),
          objects: offenders,
        });
      }

      const modelList = [...models.values()].map(m => ({
        path: m.path,
        name: m.name ?? null,
        count: m.count,
        objectCount: m.clusters?.length ?? 0,
        uniformScale: m.uniformScale ?? null,
        meshPath: m.meshPath ?? null,
        error: m.error ?? null,
      })).sort((a, b) => b.count - a.count);

      const unresolved = modelList.filter(m => m.error);
      log.info(`[floatprops] ${scmapName} — ${data.props.length} props, ${objectTotal} objects, ` +
               `${props.length} flagged at floor ${cut}${truncated ? `, ${truncated} cut` : ''}` +
               `${unresolved.length ? `, ${unresolved.length} blueprint(s) unresolved` : ''}`);

      return {
        success: true,
        scmapName,
        version: data.version,
        size: data.size,
        heightmapScale: data.heightmapScale,
        water: { present: !!data.waterSettings?.waterPresent, elevation: water },
        propTotal: data.props.length,
        objectTotal,
        floor: cut,
        models: modelList,
        props,
        truncated,
      };
    } catch (err) {
      log.error('[floatprops] floatprops-scan failed:', err);
      return { success: false, error: err.message };
    }
  },
));

function register() {
  // handler registered at module load via ipcMain.handle above
}

module.exports = { register, createSampler };
