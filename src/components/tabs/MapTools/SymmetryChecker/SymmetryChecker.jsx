// ─── Symmetry Checker ─────────────────────────────────────────────────────────
// Verifies that a map is actually mirrored — not just that it looks it. Every
// layer FA reads is compared against its own reflection: the heightmap, the
// terrain-type grid, the stratum masks, the water masks, and every placed prop,
// decal, marker and civilian unit.
//
// Read-only by design: nothing here writes to the map. Thin orchestration per
// docs/TAB_CONTRACT.md — state, hooks and handlers here, one component per
// section. The comparison maths lives in Shared/MapLogic/symmetryLogic.js so the
// mode and tolerance controls re-judge a loaded map without touching disk again.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './SymmetryChecker.css';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  finalizeMapName, writeFile,
  usePersistentState, useMapInfo, useScmapPreview,
  SYMMETRY_MODES, symmetryModeById,
  mirrorBox, compareGrid, heightmapView, pairEntities,
  symmetryVerdict, SYMMETRY_VERDICT_LABEL, scoreSymmetryMode, buildSymmetryReport,
} from '../../../Shared/MapLogic';
import { SymmetryHelp, SymmetryHelpButton } from './Help.jsx';
import SymmetryConfiguration from './Configuration.jsx';
import SymmetryFindings from './Findings.jsx';
import SymmetryReport from './Report.jsx';

const api = () => window.electronAPI;

// The eight layers a mirrored map has to agree on. `kind` picks the comparison:
// grids are compared per sample, entities per placed object.
//
// `unit` is what a deviation is measured in for that layer. The heightmap is the
// odd one out: the scmap stores elevation as uint16 × heightmapScale, and a raw
// step is 1/128 of a game unit on every map shipped — a number nobody thinks in.
// So its tolerance is set in game units and converted on the way in, and its
// deviations are reported in game units too.
const LAYERS = [
  { id: 'heightmap',  label: 'Heightmap',    kind: 'grid',   unit: 'game units', why: 'Terrain elevation — the layer a mirrored map is built from.' },
  { id: 'terraintype', label: 'Terrain Type', kind: 'grid',   unit: 'type ids',  why: 'Footfall effects and pathing blockers per cell.' },
  { id: 'strata',     label: 'Texture Masks', kind: 'grid',   unit: 'mask bytes', why: 'How the ground textures are painted (both stratum masks).' },
  { id: 'water',      label: 'Water Masks',  kind: 'grid',   unit: 'mask bytes', why: 'Foam, flatness and depth-bias masks.' },
  { id: 'props',      label: 'Props',        kind: 'entity', unit: 'units',     why: 'Trees, rocks and reclaim inside the .scmap.' },
  { id: 'decals',     label: 'Decals',       kind: 'entity', unit: 'units',     why: 'Painted-on splats and normal decals.' },
  { id: 'markers',    label: 'Markers',      kind: 'entity', unit: 'units',     why: 'Mass, hydro, spawns and every other save.lua marker.' },
  { id: 'units',      label: 'Units',        kind: 'entity', unit: 'units',     why: 'Civilians, wrecks and any pre-placed army unit.' },
];

// Editor-generated navigation grid. These are laid out by the map editor's auto-
// path pass, not by the mapper, and are routinely not mirrored on maps that are
// otherwise perfectly symmetric — on a real 20 km map they outnumber the mass
// and hydro markers five to one and would drown the marker verdict. Excluded by
// default, never silently: the finding says how many were left out.
const PATH_NODE_RE = /path node/i;

const OVERLAY_OPTIONS = [
  { value: 'heightmap',   label: 'Heightmap Δ' },
  { value: 'terraintype', label: 'Terrain Type Δ' },
  { value: 'strata',      label: 'Texture Mask Δ' },
  { value: 'water',       label: 'Water Mask Δ' },
  { value: 'entities',    label: 'Unpaired Entities' },
];

const VERDICT_COLOR = {
  pass: 'var(--status-ok)',
  near: 'var(--status-warn)',
  fail: 'var(--status-err)',
  skip: 'var(--ink-25)',
};

// Error field resolution for the overlay. 512 is finer than the canvas will ever
// show at 1024 CSS px and keeps the field under a megabyte.
const ERROR_SIZE = 512;
// Auto-detect samples rather than reads every cell — six modes over a full
// 1025² heightmap is 6.3 M comparisons per mode, and the ranking does not need
// that resolution to be unambiguous.
const DETECT_TARGET = 256;

const shortName = (p) => (p || '').replace(/\\/g, '/').split('/').pop() || '—';

const SymmetryCheckerTab = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Persistent state ────────────────────────────────────────────────────────
  const [mapName,        setMapName]        = usePersistentState(s, 'sy_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'sy_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [mode,           setMode]           = usePersistentState(s, 'sy_mode', 'point', onSharedChange);
  const [autoMode,       setAutoMode]       = usePersistentState(s, 'sy_autoMode', true, onSharedChange);
  const [heightTolerance, setHeightTolerance] = usePersistentState(s, 'sy_heightTolerance', 0.05, onSharedChange);
  const [maskTolerance,  setMaskTolerance]  = usePersistentState(s, 'sy_maskTolerance', 4, onSharedChange);
  const [worldTolerance, setWorldTolerance] = usePersistentState(s, 'sy_worldTolerance', 0.5, onSharedChange);
  const [usePlayable,    setUsePlayable]    = usePersistentState(s, 'sy_usePlayable', false, onSharedChange);
  const [checkY,         setCheckY]         = usePersistentState(s, 'sy_checkY', false, onSharedChange);
  const [includePathNodes, setIncludePathNodes] = usePersistentState(s, 'sy_includePathNodes', false, onSharedChange);
  const [overlayMode,    setOverlayMode]    = usePersistentState(s, 'sy_overlayMode', 'heightmap', onSharedChange);
  const [legendCollapsed, setLegendCollapsed] = usePersistentState(s, 'sy_legendCollapsed', false, onSharedChange);

  const { mapInfo } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('sy_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [map,      setMap]      = useState(null);   // the raw read, kept for re-judging
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [activeSection, setActiveSection] = useState('config');
  const [selectedLayer, setSelectedLayer] = useState(null);

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]);

  // ── Read the map ────────────────────────────────────────────────────────────
  const mapFolderPath = useMemo(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return '';
    return `${folder}\\${finalizeMapName(name)}`;
  }, [mapName, mapsFolderPath, settings]);

  const analyze = useCallback(async () => {
    if (!mapFolderPath) {
      setError('Set a map name and maps folder first.');
      return;
    }
    setLoading(true); setError(null); setMap(null); setSelectedLayer(null);
    try {
      const res = await api().invoke('symmetry-read-map', { mapFolderPath });
      if (!res?.success) throw new Error(res?.error || 'symmetry-read-map failed');
      setMap({
        ...res,
        heights: res.heightmap ? heightmapView(res.heightmap) : null,
        terrain: res.terrainType ? new Uint8Array(res.terrainType) : null,
        low:     res.maskLow  ? new Uint8Array(res.maskLow)  : null,
        high:    res.maskHigh ? new Uint8Array(res.maskHigh) : null,
        foam:    res.waterFoamMask ? new Uint8Array(res.waterFoamMask) : null,
        flat:    res.waterFlatness ? new Uint8Array(res.waterFlatness) : null,
        bias:    res.waterDepthBiasMask ? new Uint8Array(res.waterDepthBiasMask) : null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mapFolderPath]);

  const box = useMemo(
    () => (map ? mirrorBox({ size: map.size[0], playable: map.playable, usePlayable }) : null),
    [map, usePlayable],
  );

  // Height tolerance is authored in game units; the grid stores raw uint16 steps.
  const heightSteps = useMemo(() => {
    const scale = map?.heightmapScale || (1 / 128);
    return Math.round(heightTolerance / scale);
  }, [map, heightTolerance]);

  // ── Auto-detect: which symmetry does this map actually have? ─────────────────
  // Subsampled so all six modes stay instant; the ranking is what matters here,
  // not the exact deviation, which the per-layer pass measures at full detail.
  const detected = useMemo(() => {
    if (!map || !box) return [];
    const n = map.size[0];
    const hStep = Math.max(1, Math.round((n + 1) / DETECT_TARGET));
    const tStep = Math.max(1, Math.round(n / DETECT_TARGET));

    return SYMMETRY_MODES.map(m => {
      const h = map.heights
        ? compareGrid({ values: map.heights, n: n + 1, mode: m.id, tolerance: heightSteps, step: hStep })
        : null;
      const t = map.terrain
        ? compareGrid({ values: map.terrain, n, mode: m.id, tolerance: 0, step: tStep })
        : null;
      const p = map.props?.length
        ? pairEntities({
            items: map.props, mode: m.id, box, tolerance: worldTolerance,
            keyOf: it => (it.path || '').toLowerCase(),
          })
        : null;
      return {
        id: m.id,
        short: m.short,
        score: scoreSymmetryMode({
          heightRatio: h?.ratio, terrainRatio: t?.ratio, propRatio: p?.ratio,
        }),
      };
    }).sort((a, b) => b.score - a.score);
  }, [map, box, heightSteps, worldTolerance]);

  const bestMode = detected[0]?.id ?? null;
  const activeMode = autoMode && bestMode ? bestMode : mode;

  // ── The findings ────────────────────────────────────────────────────────────
  const findings = useMemo(() => {
    if (!map || !box) return [];
    const n = map.size[0];
    const half = n >> 1;
    const out = [];

    // A layer built from several grids gets one overlay field: the worst
    // deviation of any of them per cell.
    const mergeError = (fields) => {
      const first = fields.find(Boolean);
      if (!first) return null;
      const out = new Float32Array(first);
      for (const f of fields) {
        if (!f || f === first) continue;
        for (let i = 0; i < out.length && i < f.length; i++) if (f[i] > out[i]) out[i] = f[i];
      }
      return out;
    };

    const gridFinding = (def, res, fmt) => ({
      ...def,
      verdict: symmetryVerdict(res),
      headline: res.compared
        ? (res.mismatched
            ? `${res.mismatched.toLocaleString()} of ${res.compared.toLocaleString()} samples differ`
            : `all ${res.compared.toLocaleString()} samples match`)
        : 'no data in this map',
      stats: res,
      detail: res.mismatched ? fmt(res) : [],
    });

    // 1 — Heightmap. Reported in game units throughout: a raw step is 1/128 of a
    //     unit, so "off by 300 steps" means nothing and "off by 2.3 units" is a
    //     cliff. Smoothing a ramp after mirroring shifts thousands of samples by
    //     a fraction of a unit, which is why this layer has a real tolerance.
    if (map.heights) {
      const res = compareGrid({
        values: map.heights, n: n + 1, mode: activeMode,
        tolerance: heightSteps, errorSize: ERROR_SIZE,
      });
      const scale = map.heightmapScale || 1;
      out.push(gridFinding(LAYERS[0], res, r => [
        `worst deviation ${(r.maxDelta * scale).toFixed(3)} game units (${r.maxDelta} raw steps)`,
        `mean deviation over mismatched samples ${(r.meanDelta * scale).toFixed(3)} units`,
        `tolerance ${heightTolerance.toFixed(2)} units = ${heightSteps} raw step(s)`,
        ...r.worst.slice(0, 5).map(w => `at ${w.x}, ${w.z} — Δ${((w.delta) * scale).toFixed(3)} units`),
      ]));
    }

    // 2 — Terrain type. Byte identity only; a "close" type id is a different
    //     material, so a tolerance would be meaningless here.
    if (map.terrain) {
      const res = compareGrid({ values: map.terrain, n, mode: activeMode, tolerance: 0, errorSize: ERROR_SIZE });
      out.push(gridFinding(LAYERS[1], res, r => [
        'terrain types are compared exactly — a different id is a different material',
        ...r.worst.slice(0, 5).map(w => `at ${w.x}, ${w.z} — type ${w.a} vs ${w.b}`),
      ]));
    }

    // 3 — Stratum masks. Both DDS masks together, four channels each; the worst
    //     channel decides. DXT compression makes single-byte noise normal, so
    //     this layer rides the same grid tolerance.
    if (map.low && map.high) {
      const a = compareGrid({ values: map.low,  n, mode: activeMode, tolerance: maskTolerance, channels: 4, errorSize: ERROR_SIZE });
      const b = compareGrid({ values: map.high, n, mode: activeMode, tolerance: maskTolerance, channels: 4, errorSize: ERROR_SIZE });
      const merged = {
        compared: a.compared + b.compared,
        mismatched: a.mismatched + b.mismatched,
        maxDelta: Math.max(a.maxDelta, b.maxDelta),
        meanDelta: (a.meanDelta + b.meanDelta) / 2,
        rms: Math.max(a.rms, b.rms),
        ratio: (a.mismatched + b.mismatched) / (a.compared + b.compared),
        error: mergeError([a.error, b.error]), errorSize: a.errorSize,
        worst: [...a.worst, ...b.worst].sort((x, y) => y.delta - x.delta).slice(0, 12),
      };
      out.push(gridFinding(LAYERS[2], merged, r => [
        `worst channel deviation ${r.maxDelta} of 255`,
        `masks resampled from ${map.maskResolution?.[0] ?? '?'}² to the ${n}² terrain grid`,
        `tolerance ${maskTolerance} of 255 — DXT compression puts a step or two of noise on every mask`,
      ]));
    } else if (map.maskError) {
      out.push({ ...LAYERS[2], verdict: 'skip', headline: map.maskError, stats: null, detail: [] });
    }

    // 4 — Water masks: three half-resolution grids checked as one layer.
    if (map.foam && map.flat && map.bias) {
      const parts = [map.foam, map.flat, map.bias].map(v =>
        compareGrid({ values: v, n: half, mode: activeMode, tolerance: maskTolerance, errorSize: ERROR_SIZE }));
      const merged = {
        compared: parts.reduce((t, p) => t + p.compared, 0),
        mismatched: parts.reduce((t, p) => t + p.mismatched, 0),
        maxDelta: Math.max(...parts.map(p => p.maxDelta)),
        meanDelta: parts.reduce((t, p) => t + p.meanDelta, 0) / parts.length,
        rms: Math.max(...parts.map(p => p.rms)),
        ratio: parts.reduce((t, p) => t + p.mismatched, 0) / parts.reduce((t, p) => t + p.compared, 0),
        error: mergeError(parts.map(p => p.error)), errorSize: parts[0].errorSize,
        worst: parts.flatMap(p => p.worst).sort((x, y) => y.delta - x.delta).slice(0, 12),
      };
      const names = ['foam', 'flatness', 'depth bias'];
      out.push(gridFinding(LAYERS[3], merged, () => [
        ...parts.map((p, i) => `${names[i]}: ${p.mismatched.toLocaleString()} / ${p.compared.toLocaleString()} off, worst Δ${p.maxDelta}`),
        `each mask is ${half}² — half the terrain grid`,
      ]));
    }

    // 5–8 — Entities. Same pairing for all four; only the identity key differs,
    //       because "the same thing" means a different field per list.
    const entityFinding = (def, items, keyOf, labelOf, extra = []) => {
      if (!items?.length) {
        return { ...def, verdict: 'skip', headline: 'none in this map', stats: null, detail: extra };
      }
      const r = pairEntities({
        items, mode: activeMode, box,
        tolerance: worldTolerance,
        yTolerance: checkY ? worldTolerance : -1,
        keyOf, labelOf,
      });
      const groups = new Map();
      for (const u of r.unpaired) groups.set(u.kind, (groups.get(u.kind) || 0) + 1);
      return {
        ...def,
        verdict: r.unpaired.length ? (r.ratio <= 0.001 ? 'near' : 'fail') : 'pass',
        headline: r.unpaired.length
          ? `${r.unpaired.length.toLocaleString()} of ${r.total.toLocaleString()} have no mirror partner`
          : `all ${r.total.toLocaleString()} paired`,
        stats: { compared: r.total, mismatched: r.unpaired.length, maxDelta: r.maxOffset, ratio: r.ratio },
        entity: r,
        detail: [
          ...(r.selfPaired ? [`${r.selfPaired.toLocaleString()} sit on the mirror axis (correct, counted as paired)`] : []),
          ...(r.maxOffset > 0 ? [`largest partner offset among matched: ${r.maxOffset.toFixed(3)} units`] : []),
          ...[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([k, v]) => `${v}× unpaired · ${shortName(k)}`),
          ...extra,
        ],
      };
    };

    out.push(entityFinding(LAYERS[4], map.props, it => (it.path || '').toLowerCase(), it => shortName(it.path)));
    out.push(entityFinding(LAYERS[5], map.decals, it => `${it.type}|${(it.texture || '').toLowerCase()}`, it => shortName(it.texture) || `type ${it.type}`));

    const saveNote = map.saveError ? [map.saveError] : [];

    const pathNodes = map.markers.filter(m => PATH_NODE_RE.test(m.type || ''));
    const markerScope = includePathNodes
      ? map.markers
      : map.markers.filter(m => !PATH_NODE_RE.test(m.type || ''));
    const scopeNote = pathNodes.length
      ? [includePathNodes
          ? `including ${pathNodes.length.toLocaleString()} editor-generated path node(s)`
          : `${pathNodes.length.toLocaleString()} editor-generated path node(s) excluded — turn them on in Configuration`]
      : [];
    out.push(entityFinding(LAYERS[6], markerScope, it => (it.type || '').toLowerCase(), it => `${it.name} · ${it.type}`, [...scopeNote, ...saveNote]));

    out.push(entityFinding(LAYERS[7], map.units, it => (it.type || '').toLowerCase(), it => `${it.type} · ${it.army}`, saveNote));

    return out;
  }, [map, box, activeMode, heightSteps, heightTolerance, maskTolerance, worldTolerance, checkY, includePathNodes]);

  const failing = findings.filter(f => f.verdict === 'fail');
  const checked = findings.filter(f => f.verdict !== 'skip');
  const overallVerdict = !map ? null : failing.length ? 'fail'
    : findings.some(f => f.verdict === 'near') ? 'near' : 'pass';

  // ── Overlay canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = cv.width;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (previewImage) ctx.drawImage(previewImage, 0, 0, size, size);
    if (!map) return;

    // Mirror axis guides — drawn for whichever reflections the mode requires.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    for (const basis of symmetryModeById(activeMode).basis) {
      ctx.beginPath();
      if (basis === 'vertical' || basis === 'point') { ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); }
      if (basis === 'horizontal' || basis === 'point') { ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); }
      if (basis === 'diag-main') { ctx.moveTo(0, 0); ctx.lineTo(size, size); }
      if (basis === 'diag-anti') { ctx.moveTo(size, 0); ctx.lineTo(0, size); }
      ctx.stroke();
    }
    ctx.restore();

    if (overlayMode === 'entities') {
      // Unpaired entities: a dot where the orphan is, a ring where its partner
      // should have been, a line between the two.
      for (const f of findings) {
        if (!f.entity?.unpaired?.length) continue;
        const toPx = (v) => (v / map.size[0]) * size;
        ctx.save();
        for (const u of f.entity.unpaired.slice(0, 4000)) {
          const x = toPx(u.position[0]), z = toPx(u.position[2]);
          if (u.expected) {
            const ex = toPx(u.expected.x), ez = toPx(u.expected.z);
            ctx.strokeStyle = 'rgba(255,99,99,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(ex, ez); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,99,99,0.7)';
            ctx.beginPath(); ctx.arc(ex, ez, 4, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.fillStyle = 'rgba(255,99,99,0.9)';
          ctx.beginPath(); ctx.arc(x, z, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      return;
    }

    const f = findings.find(x => x.id === overlayMode);
    const field = f?.stats?.error;
    const es = f?.stats?.errorSize;
    if (!field || !es) return;

    // Deviation heatmap. Normalised against the layer's own worst deviation so a
    // map that is off by 3 steps everywhere still reads, instead of vanishing
    // against the 16-bit range.
    const peak = Math.max(1, f.stats.maxDelta);
    const img = ctx.createImageData(es, es);
    for (let i = 0; i < field.length; i++) {
      const v = field[i];
      const p = i * 4;
      if (v <= 0) { img.data[p + 3] = 0; continue; }
      const t = Math.min(1, v / peak);
      img.data[p]     = 255;
      img.data[p + 1] = Math.round(210 * (1 - t));
      img.data[p + 2] = Math.round(120 * (1 - t));
      img.data[p + 3] = Math.round(90 + 150 * t);
    }
    const tmp = document.createElement('canvas');
    tmp.width = es; tmp.height = es;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, size, size);
  }, [findings, overlayMode, previewImage, map, activeMode]);

  // ── Report ──────────────────────────────────────────────────────────────────
  const reportText = useMemo(() => {
    if (!map) return '';
    return buildSymmetryReport({
      mapName: finalizeMapName(mapName),
      meta: { scmapName: map.scmapName, saveName: map.saveName, version: map.version, size: map.size },
      mode: activeMode,
      tolerance: { height: heightTolerance, mask: maskTolerance, world: worldTolerance },
      findings, detected,
    });
  }, [map, mapName, activeMode, heightTolerance, maskTolerance, worldTolerance, findings, detected]);

  const copyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setSaveMsg('Copied to clipboard');
    } catch (err) {
      setSaveMsg(`Copy failed: ${err.message}`);
    }
  }, [reportText]);

  const saveReport = useCallback(async () => {
    if (!reportText || !mapFolderPath) return;
    setSaveMsg('Writing…');
    try {
      const target = `${mapFolderPath}\\${finalizeMapName(mapName)}_symmetry.txt`;
      await writeFile(target, reportText);
      setSaveMsg(`Saved → ${finalizeMapName(mapName)}_symmetry.txt`);
      await luxuryAlert(`Report written to:\n${target}`, 'Report Saved', 'success');
    } catch (err) {
      setSaveMsg('');
      await luxuryAlert(err.message, 'Could not save report', 'error');
    }
  }, [reportText, mapFolderPath, mapName]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setPreviewImageData(ev.target.result); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Sections ────────────────────────────────────────────────────────────────
  const SECTIONS = [
    { id: 'config',   index: '01', label: 'Configuration', desc: 'Pick the map, the mirror mode and how exact a match has to be.', done: !!map },
    { id: 'findings', index: '02', label: 'Findings',      desc: 'Every layer with its verdict, deviation and worst offenders.',   done: !!map && !failing.length },
    { id: 'report',   index: '03', label: 'Report',        desc: 'The full result as text — copy it or write it beside the map.',  done: false },
  ];

  const sectionContent = {
    config: (
      <SymmetryConfiguration
        mapName={mapName} setMapName={setMapName} mapInfo={mapInfo}
        onAnalyze={analyze} loading={loading} error={error}
        map={map}
        mode={mode} setMode={setMode}
        autoMode={autoMode} setAutoMode={setAutoMode}
        detected={detected} activeMode={activeMode}
        heightTolerance={heightTolerance} setHeightTolerance={setHeightTolerance}
        heightSteps={heightSteps}
        maskTolerance={maskTolerance} setMaskTolerance={setMaskTolerance}
        worldTolerance={worldTolerance} setWorldTolerance={setWorldTolerance}
        usePlayable={usePlayable} setUsePlayable={setUsePlayable}
        checkY={checkY} setCheckY={setCheckY}
        includePathNodes={includePathNodes} setIncludePathNodes={setIncludePathNodes}
      />
    ),
    findings: (
      <SymmetryFindings
        findings={findings}
        selectedLayer={selectedLayer}
        onSelectLayer={setSelectedLayer}
        activeMode={activeMode}
        overallVerdict={overallVerdict}
        checkedCount={checked.length}
        failingCount={failing.length}
        hasMap={!!map}
      />
    ),
    report: (
      <SymmetryReport
        reportText={reportText}
        hasMap={!!map}
        saveMsg={saveMsg}
        onCopy={copyReport}
        onSave={saveReport}
        overallVerdict={overallVerdict}
        failing={failing}
      />
    ),
  };

  // ── Preview slot ────────────────────────────────────────────────────────────
  const legendRows = findings.map(f => ({
    id: f.id,
    color: VERDICT_COLOR[f.verdict],
    label: f.label,
    meta: SYMMETRY_VERDICT_LABEL[f.verdict],
    pts: f.stats?.mismatched != null ? f.stats.mismatched.toLocaleString() : '—',
  }));

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      controls={<Dropdown options={OVERLAY_OPTIONS} value={overlayMode} onChange={setOverlayMode} ariaLabel="Deviation overlay" />}
      subtitle="Deviation Map"
      canvasRef={canvasRef}
      containerRef={canvasContainerRef}
      showPlaceholder={!map}
      placeholder="Check a map to see where it breaks symmetry"
      legendTitle="Layer Verdicts"
      legendRows={legendRows}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      selectedLegendId={selectedLayer}
      onLegendSelect={(id) => { setSelectedLayer(id); setActiveSection('findings'); }}
      hint={map
        ? `${symmetryModeById(activeMode).short} · ${checked.length} layer(s) checked · ${failing.length} asymmetric`
        : 'No map checked'}
    />
  );

  return (
    <div className="symmetrychecker-tab trace-tab">
      <SymmetryHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />

      <TabLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="SYMMETRY"
        navLabel="Symmetry checker console navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <SymmetryHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        contextLabel={SECTIONS.find(sec => sec.id === activeSection)?.label || ''}
        mapContext={mapName}
      />
    </div>
  );
};

export default SymmetryCheckerTab;
