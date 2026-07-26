// ─── Floating Trees — the judgement half ──────────────────────────────────────
// `floatprops-scan` (electron/modules/floating-props.js) measures geometry and
// refuses to have an opinion; everything that decides what counts as a defect
// lives here, so the tolerance slider re-judges a scanned map with no disk hit.
//
// Vocabulary, all in world units (1 unit = 1 ogrid = 1 heightmap texel):
//
//   airGap  air under an object's base — what a player sees. FLOATING.
//   sink    how far terrain rises above the prop's own ground plane. BURIED.
//   lift    the terrain difference alone, artist offsets removed.
//
// Why both directions matter: the same flat-slab placement that lifts the
// downhill trees of a group also drives the uphill ones into the mountain. One
// is a tree in the sky, the other a tree with no trunk. A mapper fixing the spot
// fixes both, so both are reported from one scan.

/** Air under a trunk, in world units, above which the defect reads as obvious. */
export const FLOAT_OBVIOUS = 1.0;

/**
 * A prop origin further than this off the terrain under it was placed before the
 * terrain moved. Distinct from a group problem: here *every* object floats,
 * including the centre one, and the fix is to re-drop the prop rather than to
 * flatten the ground. The editor writes the snapped height to within rounding
 * (measured median deviation 0.004 units over 12 597 props), so this threshold
 * is generous by two orders of magnitude.
 */
export const ANCHOR_DRIFT = 0.35;

export const FLOAT_VERDICT_LABEL = {
  pass: 'Grounded',
  near: 'Barely visible',
  fail: 'Floating',
  skip: 'Not scanned',
};

/** Single-link clustering radius for hotspots, in world units. */
const HOTSPOT_RADIUS = 14;

const worstOf = (list, key) => list.reduce((m, o) => (o[key] > m ? o[key] : m), 0);

/**
 * Judge a scan.
 *
 * @param {object|null} scan            the `floatprops-scan` response
 * @param {number} tolerance            world units of gap tolerated (clamped to scan.floor)
 * @param {boolean} includeUnderwater   count objects standing below the water plane
 * @param {boolean} includeSingles      count single-mesh props (rocks, lone trees)
 * @returns {{findings: object[], byBlueprint: object[], hotspots: object[],
 *            counts: object, verdict: string|null, effectiveTolerance: number}}
 */
export function judgeFloatingProps({
  scan,
  tolerance = 0.5,
  includeUnderwater = false,
  includeSingles = true,
} = {}) {
  const empty = {
    findings: [], byBlueprint: [], hotspots: [],
    counts: {
      props: 0, floating: 0, buried: 0, anchorDrift: 0,
      floatingObjects: 0, buriedObjects: 0, worstAir: 0, worstSink: 0,
    },
    verdict: null,
    effectiveTolerance: tolerance,
  };
  if (!scan?.props) return empty;

  // The scan discarded everything below its floor, so a tolerance under it would
  // undercount without saying so. Clamping is the honest option.
  const tol = Math.max(tolerance, scan.floor ?? 0);

  const findings = [];
  for (const prop of scan.props) {
    if (!includeSingles && prop.objectCount <= 1) continue;

    const usable = includeUnderwater ? prop.objects : prop.objects.filter(o => !o.underwater);
    const floatingObjects = usable.filter(o => o.airGap >= tol);
    const buriedObjects   = usable.filter(o => o.sink >= tol);
    const drift = Math.abs(prop.anchorOffset) >= ANCHOR_DRIFT;
    if (!floatingObjects.length && !buriedObjects.length && !drift) continue;

    const worstAir  = worstOf(floatingObjects, 'airGap');
    const worstSink = worstOf(buriedObjects, 'sink');

    findings.push({
      ...prop,
      floatingObjects, buriedObjects,
      worstAir, worstSink,
      anchorDrift: drift,
      // A group is the case this tab exists for; a single mesh on a slope is the
      // same measurement but a different conversation, so the two stay labelled.
      isGroup: prop.objectCount > 1,
      kind: floatingObjects.length ? 'floating' : buriedObjects.length ? 'buried' : 'anchor',
      severity: Math.max(worstAir, worstSink, drift ? Math.abs(prop.anchorOffset) : 0),
    });
  }

  findings.sort((a, b) => b.severity - a.severity);

  const counts = {
    props: findings.length,
    floating: findings.filter(f => f.floatingObjects.length).length,
    buried: findings.filter(f => f.buriedObjects.length).length,
    anchorDrift: findings.filter(f => f.anchorDrift).length,
    floatingObjects: findings.reduce((t, f) => t + f.floatingObjects.length, 0),
    buriedObjects: findings.reduce((t, f) => t + f.buriedObjects.length, 0),
    worstAir: findings.reduce((m, f) => Math.max(m, f.worstAir), 0),
    worstSink: findings.reduce((m, f) => Math.max(m, f.worstSink), 0),
  };

  const verdict = !counts.props ? 'pass'
    : counts.worstAir >= FLOAT_OBVIOUS || counts.worstSink >= FLOAT_OBVIOUS ? 'fail'
    : 'near';

  return {
    findings,
    byBlueprint: groupByBlueprint(findings, scan),
    hotspots: findHotspots(findings),
    counts,
    verdict,
    effectiveTolerance: tol,
  };
}

/**
 * Roll findings up per blueprint. The usual cause is one asset scattered with
 * one brush stroke across ground it does not fit, so the blueprint is often a
 * better unit of work than the individual placement.
 */
function groupByBlueprint(findings, scan) {
  const placements = new Map((scan?.models || []).map(m => [m.path.toLowerCase(), m]));
  const groups = new Map();

  for (const f of findings) {
    const key = f.path.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      const model = placements.get(key);
      g = {
        path: f.path,
        name: f.name || shortName(f.path),
        objectCount: f.objectCount,
        placements: model?.count ?? 0,
        affected: 0, floatingObjects: 0, buriedObjects: 0, worstAir: 0, worstSink: 0,
      };
      groups.set(key, g);
    }
    g.affected++;
    g.floatingObjects += f.floatingObjects.length;
    g.buriedObjects   += f.buriedObjects.length;
    if (f.worstAir  > g.worstAir)  g.worstAir  = f.worstAir;
    if (f.worstSink > g.worstSink) g.worstSink = f.worstSink;
  }

  return [...groups.values()].sort((a, b) => b.worstAir - a.worstAir || b.affected - a.affected);
}

/**
 * Cluster flagged props into places to visit.
 *
 * A map can produce hundreds of findings from a handful of bad spots — a crater
 * rim, a ramp, one cliff edge — and a list of hundreds of coordinates is not a
 * work plan. Single-link clustering over a `HOTSPOT_RADIUS` grid: neighbours in
 * the eight surrounding cells join the same cluster, so a chain of props along a
 * cliff comes out as one hotspot rather than twenty.
 */
function findHotspots(findings) {
  const cellOf = (v) => Math.floor(v / HOTSPOT_RADIUS);
  const cells = new Map();
  findings.forEach((f, i) => {
    const key = `${cellOf(f.position[0])},${cellOf(f.position[2])}`;
    let bucket = cells.get(key);
    if (!bucket) { bucket = []; cells.set(key, bucket); }
    bucket.push(i);
  });

  const parent = findings.map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };

  for (const [key, bucket] of cells) {
    const [cx, cz] = key.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const other = cells.get(`${cx + dx},${cz + dz}`);
        if (!other) continue;
        for (const a of bucket) {
          for (const b of other) {
            if (a >= b) continue;
            const fa = findings[a], fb = findings[b];
            if (Math.hypot(fa.position[0] - fb.position[0], fa.position[2] - fb.position[2]) <= HOTSPOT_RADIUS) {
              union(a, b);
            }
          }
        }
      }
    }
  }

  const byRoot = new Map();
  findings.forEach((f, i) => {
    const r = find(i);
    let list = byRoot.get(r);
    if (!list) { list = []; byRoot.set(r, list); }
    list.push(f);
  });

  return [...byRoot.values()].map(list => {
    let sx = 0, sz = 0, worstAir = 0, worstSink = 0, objects = 0;
    for (const f of list) {
      sx += f.position[0]; sz += f.position[2];
      objects += f.floatingObjects.length + f.buriedObjects.length;
      if (f.worstAir  > worstAir)  worstAir  = f.worstAir;
      if (f.worstSink > worstSink) worstSink = f.worstSink;
    }
    const radius = list.reduce((m, f) =>
      Math.max(m, Math.hypot(f.position[0] - sx / list.length, f.position[2] - sz / list.length)), 0);
    return {
      x: sx / list.length,
      z: sz / list.length,
      radius,
      props: list.length,
      objects,
      worstAir, worstSink,
      severity: Math.max(worstAir, worstSink),
      blueprints: [...new Set(list.map(f => f.name || shortName(f.path)))],
    };
  }).sort((a, b) => b.severity - a.severity);
}

const shortName = (p) => (p || '').replace(/\\/g, '/').split('/').pop() || '—';

/** The run as plain text — the tab's only output; it never writes to the map. */
export function buildFloatingPropsReport({ mapName, scan, judged, tolerance, options }) {
  const L = [];
  const rule = '='.repeat(56);
  const thin = '-'.repeat(56);
  const { counts, findings, byBlueprint, hotspots, effectiveTolerance } = judged;

  L.push('ForgeMapToolkit — Floating Trees Report');
  L.push(rule);
  L.push(`Map            ${mapName}`);
  if (scan?.scmapName) L.push(`SCMAP          ${scan.scmapName}  (v${scan.version})`);
  if (scan?.size)      L.push(`Grid           ${scan.size[0]} × ${scan.size[1]}`);
  L.push(`Props          ${scan.propTotal.toLocaleString()} placed · ${scan.objectTotal.toLocaleString()} objects measured`);
  L.push(`Tolerance      ${effectiveTolerance.toFixed(2)} world units` +
         (effectiveTolerance > tolerance ? `  (raised from ${tolerance.toFixed(2)} — the scan floor)` : ''));
  L.push(`Scope          ${options.includeSingles ? 'groups and single meshes' : 'groups only'}` +
         ` · underwater ${options.includeUnderwater ? 'counted' : 'ignored'}`);
  if (scan?.water?.present) L.push(`Water          plane at ${scan.water.elevation.toFixed(2)}`);

  L.push('');
  L.push('Result');
  L.push(thin);
  L.push(`  ${FLOAT_VERDICT_LABEL[judged.verdict] ?? '—'}`);
  // Not a partition — a prop can hold trees in the air *and* trees in the hill,
  // so these two numbers legitimately sum past the total. Worded to say so.
  L.push(`  ${counts.props.toLocaleString()} prop(s) flagged — ` +
         `${counts.floating.toLocaleString()} with air under an object, ` +
         `${counts.buried.toLocaleString()} with terrain over one` +
         (counts.anchorDrift ? `, ${counts.anchorDrift.toLocaleString()} off their own terrain` : ''));
  L.push(`  ${counts.floatingObjects.toLocaleString()} object(s) in the air, worst ${counts.worstAir.toFixed(2)} units`);
  L.push(`  ${counts.buriedObjects.toLocaleString()} object(s) in the ground, worst ${counts.worstSink.toFixed(2)} units`);

  if (hotspots.length) {
    L.push('');
    L.push(`Hotspots  (${hotspots.length} place(s) to visit)`);
    L.push(thin);
    for (const h of hotspots.slice(0, 25)) {
      L.push(`  ${fmtPos(h.x, h.z).padEnd(18)} ${h.props.toString().padStart(4)} prop(s), ` +
             `${h.objects.toString().padStart(4)} object(s), worst ${fmtGap(h.worstAir, h.worstSink)}`);
      L.push(`  ${' '.repeat(18)} ${h.blueprints.slice(0, 4).join(', ')}` +
             (h.blueprints.length > 4 ? ` +${h.blueprints.length - 4} more` : ''));
    }
    if (hotspots.length > 25) L.push(`  …and ${hotspots.length - 25} more`);
  }

  if (byBlueprint.length) {
    L.push('');
    L.push('By blueprint');
    L.push(thin);
    for (const b of byBlueprint.slice(0, 25)) {
      L.push(`  ${b.name.slice(0, 30).padEnd(31)} ${b.affected.toString().padStart(5)} / ` +
             `${b.placements.toString().padStart(5)} placement(s) · ${b.objectCount} object(s) each · ` +
             `worst ${fmtGap(b.worstAir, b.worstSink)}`);
    }
    if (byBlueprint.length > 25) L.push(`  …and ${byBlueprint.length - 25} more`);
  }

  if (findings.length) {
    L.push('');
    L.push('Worst placements');
    L.push(thin);
    for (const f of findings.slice(0, 40)) {
      const what = [
        f.floatingObjects.length ? `${f.floatingObjects.length}/${f.objectCount} floating` : null,
        f.buriedObjects.length ? `${f.buriedObjects.length}/${f.objectCount} buried` : null,
      ].filter(Boolean).join(', ') || 'origin off terrain';
      L.push(`  #${String(f.index).padEnd(7)} ${(f.name || shortName(f.path)).slice(0, 28).padEnd(29)} ` +
             `${fmtPos(f.position[0], f.position[2]).padEnd(18)} ` +
             `${what.padEnd(26)} worst ${fmtGap(f.worstAir, f.worstSink)}`);
      if (f.anchorDrift) {
        L.push(`  ${' '.repeat(9)} origin sits ${f.anchorOffset.toFixed(2)} off the terrain under it — re-drop this prop`);
      }
      for (const o of f.floatingObjects.slice(0, 3)) {
        L.push(`  ${' '.repeat(9)} ${o.name.slice(0, 24).padEnd(25)} at ${fmtPos(o.x, o.z)} ` +
               `${o.dist.toFixed(1)} from origin — ${o.airGap.toFixed(2)} of air`);
      }
    }
    if (findings.length > 40) L.push(`  …and ${(findings.length - 40).toLocaleString()} more`);
  }

  const unresolved = (scan.models || []).filter(m => m.error);
  if (unresolved.length) {
    L.push('');
    L.push('Not measured');
    L.push(thin);
    for (const m of unresolved) L.push(`  ${m.count.toString().padStart(5)}× ${m.path} — ${m.error}`);
  }
  if (scan.truncated) {
    L.push('');
    L.push(`NOTE: ${scan.truncated.toLocaleString()} further flagged prop(s) were not returned — the scan caps its result set.`);
  }

  L.push('');
  L.push(thin);
  L.push(counts.props
    ? `RESULT: ${counts.props.toLocaleString()} prop(s) do not sit on their ground, across ${hotspots.length} place(s).`
    : 'RESULT: every measured object sits on the terrain beneath it.');
  return L.join('\n');
}

const fmtPos = (x, z) => `${x.toFixed(1)}, ${z.toFixed(1)}`;

/**
 * Format an air/sink pair, naming only the side that exists. Printing
 * "+0.00 / −0.87" for a purely buried finding reads as a measurement of nothing.
 */
function fmtGap(air, sink) {
  const parts = [];
  if (air  > 0) parts.push(`+${air.toFixed(2)} air`);
  if (sink > 0) parts.push(`−${sink.toFixed(2)} buried`);
  return parts.join(' / ') || '—';
}
