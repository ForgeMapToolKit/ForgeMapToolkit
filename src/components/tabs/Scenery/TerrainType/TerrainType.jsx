// ─── TerrainType Auto-Paint ───────────────────────────────────────────────────
// Derive a map's terrainType.raw from its stratum masks: assign each texture
// layer a terrain type, and every cell where that layer is visually dominant
// gets painted automatically. Thin orchestration per the tab contract — state,
// hooks and handlers here; each section is its own presentational component.
// See docs/TERRAINTYPE_PLAN.md and docs/TAB_CONTRACT.md.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './TerrainType.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  finalizeMapName, usePersistentState, useMapInfo, useScmapPreview,
  STRATUM_SLOTS, shaderUsesHalfRange, computeDominantStratum, buildTerrainTypeBytes,
} from '../../../Shared/MapLogic';
import { TerrainTypeHelp, TerrainTypeHelpButton } from './Help.jsx';
import TERRAIN_TYPES from './terrainTypes.json';
import TerrainTypeConfiguration from './Configuration.jsx';
import TerrainTypeLayers from './Layers.jsx';
import TerrainTypeExport from './Export.jsx';

const api = () => window.electronAPI;

// Fallback palette so the segmentation is legible before a (possibly near-black)
// editor colour is assigned. Index = slot 0..8.
const SLOT_PALETTE = [
  '#8a8f98', '#e6194B', '#3cb44b', '#ffe119', '#4363d8',
  '#f58231', '#911eb4', '#42d4f4', '#f032e6',
];

const OVERLAY_OPTIONS = [
  { value: 'type',    label: 'Type Colors' },
  { value: 'segment', label: 'Layer Segments' },
];

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];
const PALETTE_RGB = SLOT_PALETTE.map(hexToRgb);

const TerrainTypeTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  const [mapName,        setMapName]        = usePersistentState(s, 'tt_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'tt_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [slotToId,       setSlotToId]       = usePersistentState(s, 'tt_slotToId', {}, onSharedChange);
  const [threshold,      setThreshold]      = usePersistentState(s, 'tt_threshold', 0.5, onSharedChange);
  const [halfRange,      setHalfRange]      = usePersistentState(s, 'tt_halfRange', true, onSharedChange);
  // Strata (index 0..7) dropped from the blend. Stratum 7 is a map-wide normal
  // on most maps — not a ground texture, and its full mask would swamp everything.
  const [ignoredStrata,  setIgnoredStrata]  = usePersistentState(s, 'tt_ignoredStrata', [7], onSharedChange);
  const [overlayMode,    setOverlayMode]    = usePersistentState(s, 'tt_overlayMode', 'type', onSharedChange);
  const [legendCollapsed, setLegendCollapsed] = usePersistentState(s, 'tt_legendCollapsed', false, onSharedChange);

  const { mapInfo } = useMapInfo({ mapName, mapsFolderPath, settings, onMapSize: v => onSharedChange('tt_mapSize', v) });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  const [strata,   setStrata]   = useState(null);
  const [albedoThumbs, setAlbedoThumbs] = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [activeSection, setActiveSection] = useState('config');

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]);

  // ── Derived terrain-type lookups ──────────────────────────────────────────
  const typeById = useMemo(() => {
    const m = {};
    for (const t of TERRAIN_TYPES) m[t.index] = t;
    return m;
  }, []);
  const typeOptions = useMemo(() => {
    const sorted = [...TERRAIN_TYPES].sort(
      (a, b) => (a.styleName.localeCompare(b.styleName)) || (a.index - b.index),
    );
    return [
      { value: 0, label: '— Default —' },
      ...sorted.map(t => ({ value: t.index, label: `${t.blocking ? '🚫 ' : ''}${t.name} · ${t.styleName}` })),
    ];
  }, []);

  // ── Analyze ───────────────────────────────────────────────────────────────
  const resolveScmapPath = useCallback(async () => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) throw new Error('Set a map name and maps folder first.');
    const mapFolderPath = `${folder}\\${finalizeMapName(name)}`;
    const dir = await api().invoke('list-dir', { dirPath: mapFolderPath });
    if (!dir?.success) throw new Error(dir?.error || 'Map folder not found.');
    const entry = dir.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
    if (!entry) throw new Error('No .scmap file in the map folder.');
    return { scmapPath: `${mapFolderPath}\\${entry.name}`, mapFolderPath };
  }, [mapName, mapsFolderPath, settings]);

  const analyze = useCallback(async () => {
    setLoading(true); setError(null); setStrata(null); setAlbedoThumbs({});
    try {
      const { scmapPath, mapFolderPath } = await resolveScmapPath();
      const res = await api().invoke('scmap-read-strata', { scmapPath });
      if (!res?.success) throw new Error(res?.error || 'scmap-read-strata failed');
      const textures = res.textures || [];
      setStrata({
        size: res.size,
        shaderPath: res.shaderPath,
        blurriness: res.blurriness,
        maskResolution: res.maskResolution,
        textures,
        maskLow: new Uint8Array(res.maskLow),
        maskHigh: new Uint8Array(res.maskHigh),
      });
      setHalfRange(shaderUsesHalfRange(res.shaderPath));

      // Best-effort albedo thumbnails from the game files (needs FA install set).
      const texturePaths = STRATUM_SLOTS.map(sl => textures[sl.texIndex]?.path || '');
      api().invoke('resolve-stratum-albedos', { texturePaths, mapFolderPath })
        .then(r => {
          if (!r?.success) return;
          const byslot = {};
          STRATUM_SLOTS.forEach((sl, i) => { if (r.thumbs[i]) byslot[sl.slot] = r.thumbs[i]; });
          setAlbedoThumbs(byslot);
        })
        .catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resolveScmapPath]);

  // ── Dominance model (fast, no IPC) ────────────────────────────────────────
  const dominance = useMemo(() => {
    if (!strata) return null;
    const [w, h] = strata.size;
    const d = computeDominantStratum(strata.maskLow, strata.maskHigh, w, { halfRange, ignoreStrata: ignoredStrata });
    const counts = new Array(9).fill(0);
    for (let i = 0; i < d.slot.length; i++) counts[d.slot[i]]++;
    return { ...d, counts, total: d.slot.length, w, h };
  }, [strata, halfRange, ignoredStrata]);

  const slotToIdArray = useMemo(
    () => STRATUM_SLOTS.map(sl => Number(slotToId[sl.slot]) || 0),
    [slotToId],
  );
  const assignedCount = slotToIdArray.filter(id => id > 0).length;

  // ── Preview: base map + coloured dominance overlay ────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = cv.width; // MapPreview fixes this at 1024
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (previewImage) ctx.drawImage(previewImage, 0, 0, size, size);

    if (!dominance) return;
    const { w, h, slot, coverage } = dominance;
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < slot.length; i++) {
      const sl = slot[i];
      const id = slotToIdArray[sl];
      const applied = coverage[i] >= threshold;
      let r, g, b, a;
      if (overlayMode === 'segment') {
        // Explore mode: every cell tinted by its dominant layer.
        [r, g, b] = PALETTE_RGB[sl];
        a = applied ? 190 : 70;
      } else if (id > 0 && typeById[id]) {
        // Cells that will receive this assigned terrain type — strong where it
        // actually applies (≥ threshold), faint where it would fall to Default.
        [r, g, b] = typeById[id].color;
        a = applied ? 215 : 95;
      } else {
        // Dominant but unassigned → stays Default. Faint structure hint only.
        [r, g, b] = PALETTE_RGB[sl];
        a = applied ? 55 : 25;
      }
      const p = i * 4;
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = a;
    }
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, size, size);
  }, [dominance, slotToIdArray, threshold, overlayMode, previewImage, typeById]);

  const setSlot = (slot, value) => setSlotToId({ ...slotToId, [slot]: value });
  const toggleIgnore = (stratumIdx) => setIgnoredStrata(
    ignoredStrata.includes(stratumIdx)
      ? ignoredStrata.filter(k => k !== stratumIdx)
      : [...ignoredStrata, stratumIdx],
  );

  // ── Apply ─────────────────────────────────────────────────────────────────
  const apply = useCallback(async () => {
    if (!strata || !dominance) return;
    if (assignedCount === 0) {
      await luxuryAlert('Assign a terrain type to at least one layer first.', 'Nothing to apply', 'warning');
      return;
    }
    const ok = await luxuryConfirm(
      `Overwrite terrainType.raw on "${mapName}"?`,
      'Apply Terrain Types', 'Apply', 'Cancel',
    );
    if (!ok) return;

    setApplying(true); setError(null); setApplyMsg('Unpacking…');
    try {
      onRecordSnapshot?.();
      const { scmapPath } = await resolveScmapPath();
      const up = await api().invoke('scmap-unpack', { scmapPath });
      if (!up?.success) throw new Error(up?.error || 'unpack failed');

      const bytes = buildTerrainTypeBytes(dominance, slotToIdArray, { defaultId: 1, threshold });

      setApplyMsg('Writing…');
      const wr = await api().invoke('scmap-write-terraintype', { folder: up.outputFolder, terrainTypeData: bytes, size: strata.size });
      if (!wr?.success) throw new Error(wr?.error || 'write failed');

      setApplyMsg('Packing…');
      const pk = await api().invoke('scmap-pack', { unpackFolder: up.outputFolder, scmapPath });
      if (!pk?.success) throw new Error(pk?.error || 'pack failed');

      await luxuryAlert(`Done — terrainType.raw rewritten (${bytes.length.toLocaleString()} cells).`, 'Success', 'success');
    } catch (err) {
      setError(err.message);
      await luxuryAlert(err.message, 'Apply failed', 'error');
    } finally {
      setApplying(false); setApplyMsg('');
    }
  }, [strata, dominance, slotToIdArray, threshold, mapName, assignedCount, resolveScmapPath, onRecordSnapshot]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setPreviewImageData(ev.target.result); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Sections ──────────────────────────────────────────────────────────────
  const TT_SECTIONS = [
    { id: 'config', index: '01', label: 'Configuration', desc: 'Set the map and read its stratum masks and terrain shader.', done: !!strata },
    { id: 'layers', index: '02', label: 'Layers',        desc: 'Assign a terrain type to each ground layer and tune the dominance blend.', done: assignedCount > 0 },
    { id: 'output', index: '03', label: 'Output',        desc: 'Write the derived terrainType layer back into the map.', done: false },
  ];

  const sectionContent = {
    config: (
      <TerrainTypeConfiguration
        mapName={mapName} setMapName={setMapName} mapInfo={mapInfo}
        onAnalyze={analyze} loading={loading} error={error}
        strata={strata}
      />
    ),
    layers: (
      <TerrainTypeLayers
        slots={STRATUM_SLOTS}
        textures={strata?.textures || []}
        counts={dominance?.counts || new Array(9).fill(0)}
        total={dominance?.total || 0}
        slotToId={slotToId} onSetSlot={setSlot}
        typeOptions={typeOptions} typeById={typeById}
        slotPalette={SLOT_PALETTE}
        maskLow={strata?.maskLow} maskHigh={strata?.maskHigh}
        maskSize={strata?.size?.[0]} albedoThumbs={albedoThumbs}
        ignoredStrata={ignoredStrata} onToggleIgnore={toggleIgnore}
        threshold={threshold} onThreshold={setThreshold}
        halfRange={halfRange} onHalfRange={setHalfRange}
      />
    ),
    output: (
      <TerrainTypeExport
        assignedCount={assignedCount}
        cellCount={dominance?.total || 0}
        threshold={threshold}
        applying={applying} applyMsg={applyMsg}
        onApply={apply}
        ready={!!dominance && assignedCount > 0}
      />
    ),
  };

  // ── Preview slot ──────────────────────────────────────────────────────────
  const overlayControls = (
    <Dropdown options={OVERLAY_OPTIONS} value={overlayMode} onChange={setOverlayMode} ariaLabel="Overlay colouring" />
  );

  const legendRows = dominance
    ? STRATUM_SLOTS
        .filter(sl => dominance.counts[sl.slot] > 0)
        .map(sl => {
          const id = slotToIdArray[sl.slot];
          const chosen = overlayMode === 'type' && id > 0 ? typeById[id] : null;
          const color = chosen ? `rgb(${chosen.color.join(',')})` : SLOT_PALETTE[sl.slot];
          return {
            id: sl.slot,
            color,
            label: chosen ? chosen.name : sl.label,
            pts: `${(100 * dominance.counts[sl.slot] / dominance.total).toFixed(1)}%`,
          };
        })
    : [];

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      controls={overlayControls}
      subtitle="Dominance Preview"
      canvasRef={canvasRef}
      containerRef={canvasContainerRef}
      showPlaceholder={!dominance}
      placeholder="Analyze a map to see the terrain-type segmentation"
      legendTitle="Layer Legend"
      legendRows={legendRows}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      hint={strata ? `${strata.shaderPath || 'shader ?'} · ${assignedCount} layer(s) assigned` : 'No map analyzed'}
    />
  );

  return (
    <div className="terraintype-tab trace-tab">
      <TerrainTypeHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />

      <TabLayout
        sections={TT_SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="TERRAIN"
        navLabel="Terrain type console navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <TerrainTypeHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        contextLabel={TT_SECTIONS.find(sec => sec.id === activeSection)?.label || ''}
        mapContext={mapName}
      />
    </div>
  );
};

export default TerrainTypeTab;
