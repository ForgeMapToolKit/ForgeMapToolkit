// ─── Biome Changer ────────────────────────────────────────────────────────────
// Rebuild a map's whole look in one move: pick a biome preset and every layer
// texture, normal, water colour, light and prop is swapped as a coherent set.
// The point is judgement speed — swapping textures by hand leaves water and
// lighting behind, so you never see what the map would actually look like.
//
// Thin orchestration per docs/TAB_CONTRACT.md: state, hooks and handlers here,
// one presentational component per section. All decisions come from
// Shared/MapLogic/biomeLogic; the write is electron/modules/biome.js.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './BiomeChanger.css';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import {
  finalizeMapName, usePersistentState, useMapInfo, useScmapPreview,
  BIOME_LAYER_SLOTS, DEFAULT_CHANNELS,
  guessRoles, presetCoverage, validatePreset,
  planTextureSwap, planPropSwap, buildBiomePatch, describePatch, patchIsEmpty,
  presetFromState, presetToSource,
} from '../../../Shared/MapLogic';
import { BIOME_PRESETS, getPreset } from './biomePresets.js';
import { BiomeChangerHelp, BiomeChangerHelpButton } from './Help.jsx';
import BiomeConfiguration from './Configuration.jsx';
import BiomeSelection from './Selection.jsx';
import BiomeLayers from './Layers.jsx';
import BiomeProps from './Props.jsx';
import BiomeExport from './Export.jsx';

const api = () => window.electronAPI;

// Role colours — §7 Role 2 (data colour): each identifies a concrete object (a
// ground role) and reappears wherever that role does, so it is deliberately not
// --tab-color. Same pattern as TerrainType's SLOT_PALETTE.
const ROLE_COLORS = {
  base: '#8a8f98', grass: '#3cb44b', dirt: '#9a6324', sand: '#ffe119',
  gravel: '#a9a9a9', rock: '#808000', cliff: '#911eb4', snow: '#e8f1f7',
  accent: '#f032e6', macro: '#42d4f4',
};

const BiomeChangerTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  // ── Persistent state ──────────────────────────────────────────────────────
  const [mapName,        setMapName]        = usePersistentState(s, 'bc_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'bc_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [presetId,       setPresetId]       = usePersistentState(s, 'bc_presetId', BIOME_PRESETS[0]?.id ?? '', onSharedChange);
  const [channels,       setChannels]       = usePersistentState(s, 'bc_channels', DEFAULT_CHANNELS, onSharedChange);
  const [roleBySlot,     setRoleBySlot]     = usePersistentState(s, 'bc_roleBySlot', {}, onSharedChange);
  const [adoptScales,    setAdoptScales]    = usePersistentState(s, 'bc_adoptScales', false, onSharedChange);
  const [propPolicy,     setPropPolicy]     = usePersistentState(s, 'bc_propPolicy', 'keep', onSharedChange);
  const [matchReclaim,   setMatchReclaim]   = usePersistentState(s, 'bc_matchReclaim', false, onSharedChange);
  const [newVersion,     setNewVersion]     = usePersistentState(s, 'bc_newVersion', true, onSharedChange);
  const [legendCollapsed, setLegendCollapsed] = usePersistentState(s, 'bc_legendCollapsed', false, onSharedChange);

  useEffect(() => { if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local UI state ────────────────────────────────────────────────────────
  const [biome,     setBiome]     = useState(null);   // read from the map
  const [library,   setLibrary]   = useState([]);     // scanned game props
  const [thumbs,    setThumbs]    = useState({});     // slot → current albedo thumb
  const [toThumbs,  setToThumbs]  = useState({});     // slot → target albedo thumb
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [applying,  setApplying]  = useState(false);
  const [applyMsg,  setApplyMsg]  = useState('');
  const [showHelp,  setShowHelp]  = useState(false);
  const [activeSection, setActiveSection] = useState('config');

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const { mapInfo } = useMapInfo({ mapName, mapsFolderPath, settings, onMapSize: v => onSharedChange('bc_mapSize', v) });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // MapPreview supplies the canvas well but never draws — the host owns the
  // pixels. Here that is just the map's own preview image.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (previewImage) ctx.drawImage(previewImage, 0, 0, cv.width, cv.height);
  }, [previewImage]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const preset   = useMemo(() => getPreset(presetId), [presetId]);
  const coverage = useMemo(() => presetCoverage(preset), [preset]);
  // Every card states its own coverage, not just the selected one — a skeleton
  // must look like a skeleton before you click it.
  const presetCards = useMemo(
    () => BIOME_PRESETS.map(p => ({ ...p, cov: presetCoverage(p) })), [],
  );
  const problems = useMemo(() => (preset ? validatePreset(preset) : []), [preset]);

  const textureRows = useMemo(
    () => planTextureSwap({ state: biome, preset, roleBySlot, adoptScales }),
    [biome, preset, roleBySlot, adoptScales],
  );
  const propPlan = useMemo(
    () => planPropSwap({ state: biome, library, preset, policy: propPolicy, matchReclaim }),
    [biome, library, preset, propPolicy, matchReclaim],
  );
  const patch = useMemo(
    () => buildBiomePatch({ state: biome, preset, roleBySlot, channels, adoptScales, propPlan }),
    [biome, preset, roleBySlot, channels, adoptScales, propPlan],
  );
  const patchRows = useMemo(() => describePatch(patch, propPlan), [patch, propPlan]);

  // A v56 map has no skybox block at all — the channel would fail at apply time,
  // so it is reported as unavailable rather than left to throw.
  const skyboxUnavailable = !!biome && !biome.skybox;
  const ready = !!biome && !!preset && !patchIsEmpty(patch) && !applying
    && problems.length === 0 && !(channels.skybox && skyboxUnavailable);

  // ── Map resolution (same shape as TerrainType's) ───────────────────────────
  const resolveMap = useCallback(async () => {
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

  const loadThumbs = useCallback((paths, mapFolderPath, setter) => {
    api().invoke('resolve-stratum-albedos', { texturePaths: paths, mapFolderPath })
      .then((r) => {
        if (!r?.success) return;
        const bySlot = {};
        BIOME_LAYER_SLOTS.forEach((sl, i) => { if (r.thumbs[i]) bySlot[sl.slot] = r.thumbs[i]; });
        setter(bySlot);
      })
      .catch(() => {});
  }, []);

  // ── Read the map's biome ───────────────────────────────────────────────────
  const readBiome = useCallback(async () => {
    setLoading(true); setError(null); setBiome(null); setThumbs({}); setToThumbs({});
    try {
      const { scmapPath, mapFolderPath } = await resolveMap();
      const res = await api().invoke('biome-read-state', { scmapPath });
      if (!res?.success) throw new Error(res?.error || 'biome-read-state failed');
      setBiome(res);
      setRoleBySlot(guessRoles(res));
      loadThumbs(BIOME_LAYER_SLOTS.map(sl => res.textures?.[sl.texIndex]?.path || ''), mapFolderPath, setThumbs);

      // Prop swapping needs the scanned game library. Cached, so this is cheap;
      // an unscanned install just leaves the prop plan empty and says so.
      api().invoke('library-load')
        .then(r => setLibrary(r?.props || []))
        .catch(() => setLibrary([]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resolveMap, loadThumbs, setRoleBySlot]);

  // Target thumbnails follow the plan, so the Layers rows show before/after.
  useEffect(() => {
    if (!biome) return;
    const paths = BIOME_LAYER_SLOTS.map(sl => textureRows.find(r => r.slot === sl.slot)?.toAlbedo || '');
    if (!paths.some(Boolean)) { setToThumbs({}); return; }
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    loadThumbs(paths, folder ? `${folder}\\${finalizeMapName(mapName)}` : '', setToThumbs);
  }, [biome, textureRows, mapName, mapsFolderPath, settings, loadThumbs]);

  // ── Apply ─────────────────────────────────────────────────────────────────
  const apply = useCallback(async () => {
    if (!ready) return;
    const confirmed = await luxuryConfirm({
      title:   'Apply Biome',
      message: newVersion
        ? `Rebuild "${mapName}" as ${preset.label}?\n\nA new map version is created — the original folder is untouched.`
        : `Rebuild "${mapName}" as ${preset.label}?\n\nThis overwrites the .scmap in place. Back up first.`,
      type: 'warning',
      confirmLabel: 'Apply Biome',
    });
    if (!confirmed) return;

    setApplying(true); setError(null);
    try {
      onRecordSnapshot?.();
      const { mapFolderPath } = await resolveMap();

      // mr-duplicate-map-version is a generic map-folder utility (it only bumps
      // the .vNNNN suffix and copies), not Map-Resizer-specific — reused rather
      // than reimplemented.
      let activeFolder = mapFolderPath;
      let createdName  = null;
      if (newVersion) {
        setApplyMsg('Versioning…');
        const dup = await api().invoke('mr-duplicate-map-version', { mapFolder: mapFolderPath });
        if (!dup?.success) throw new Error(dup.error);
        activeFolder = dup.newMapFolder;
        createdName  = dup.newVersionName;
      }

      const find = await api().invoke('mr-find-scmap', { mapFolder: activeFolder });
      if (!find?.success) throw new Error(find.error);

      setApplyMsg('Unpacking…');
      const up = await api().invoke('scmap-unpack', { scmapPath: find.scmapPath });
      if (!up?.success) throw new Error(up.error || 'unpack failed');

      setApplyMsg('Patching…');
      const res = await api().invoke('biome-apply', { unpackFolder: up.outputFolder, patch });
      if (!res?.success) throw new Error(res.error || 'biome-apply failed');

      setApplyMsg('Packing…');
      const pk = await api().invoke('scmap-pack', { unpackFolder: up.outputFolder, scmapPath: find.scmapPath });
      if (!pk?.success) throw new Error(pk.error || 'pack failed');

      if (createdName) setMapName(createdName);
      await luxuryAlert({
        title:   'Biome Applied',
        message: `${createdName || mapName} is now ${preset.label} — ${res.touched} field group(s) rewritten.`
               + (propPlan.changedInstances ? `\n${propPlan.changedInstances} prop instance(s) remapped.` : ''),
        type: 'success',
      });
      await readBiome();
    } catch (err) {
      setError(err.message);
      await luxuryAlert({ title: 'Apply Failed', message: err.message, type: 'error' });
    } finally {
      setApplying(false); setApplyMsg('');
    }
  }, [ready, newVersion, mapName, preset, patch, propPlan, resolveMap, readBiome, onRecordSnapshot, setMapName]);

  // ── Capture the current map as a preset ───────────────────────────────────
  const capture = useCallback(async () => {
    if (!biome) return;
    const captured = presetFromState({
      state: biome, roleBySlot,
      id: (mapName || 'captured').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label: mapName || 'Captured',
      blurb: `Captured from ${mapName}.`,
    });
    await api().invoke('clipboard-write-text', { text: presetToSource(captured) });
    await luxuryAlert({
      title:   'Preset Copied',
      message: 'The captured biome is on your clipboard as JSON. Paste it into '
             + 'src/components/tabs/MapTools/BiomeChanger/biomePresets.js and give it an id and label.',
      type: 'success',
    });
  }, [biome, roleBySlot, mapName]);

  const setChannel = (id, on) => setChannels({ ...channels, [id]: on });
  const setRole    = (slot, role) => setRoleBySlot({ ...roleBySlot, [slot]: role });
  const resetRoles = () => setRoleBySlot(guessRoles(biome));

  // ── Sections ──────────────────────────────────────────────────────────────
  const changedLayers = textureRows.filter(r => r.changed).length;

  const SECTIONS = [
    { id: 'config',  index: '01', label: 'Configuration', desc: 'Pick the map and read the biome it wears today.',              done: !!biome },
    { id: 'biome',   index: '02', label: 'Biome',         desc: 'Choose the target preset and which channels it may rewrite.', done: !!preset && !coverage.isEmpty },
    { id: 'layers',  index: '03', label: 'Layers',        desc: 'Confirm which role each ground layer plays before swapping.', done: changedLayers > 0 },
    { id: 'props',   index: '04', label: 'Props',         desc: 'Review the blueprint remap and what it does to reclaim.',     done: !channels.props || propPlan.changedInstances > 0 },
    { id: 'output',  index: '05', label: 'Output',        desc: 'Check the change list and rebuild the map.',                  done: false },
  ];

  const sectionContent = {
    config: (
      <BiomeConfiguration
        mapName={mapName} setMapName={setMapName} mapInfo={mapInfo}
        onRead={readBiome} loading={loading} error={error}
        biome={biome} onCapture={capture}
      />
    ),
    biome: (
      <BiomeSelection
        presets={presetCards} presetId={presetId} onSelect={setPresetId}
        coverage={coverage} problems={problems}
        channels={channels} onChannel={setChannel}
        skyboxUnavailable={skyboxUnavailable}
        adoptScales={adoptScales} onAdoptScales={setAdoptScales}
      />
    ),
    layers: (
      <BiomeLayers
        rows={textureRows} onSetRole={setRole} onResetRoles={resetRoles}
        thumbs={thumbs} toThumbs={toThumbs}
        hasBiome={!!biome} presetLabel={preset?.label}
      />
    ),
    props: (
      <BiomeProps
        plan={propPlan} enabled={!!channels.props}
        policy={propPolicy} onPolicy={setPropPolicy}
        matchReclaim={matchReclaim} onMatchReclaim={setMatchReclaim}
        libraryScanned={library.length > 0} hasBiome={!!biome}
      />
    ),
    output: (
      <BiomeExport
        rows={patchRows} ready={ready} applying={applying} applyMsg={applyMsg}
        newVersion={newVersion} onNewVersion={setNewVersion}
        onApply={apply} error={error}
        presetLabel={preset?.label} problems={problems}
        skyboxBlocked={channels.skybox && skyboxUnavailable}
      />
    ),
  };

  // ── Aside: the map itself, so identity stays visible (UI contract §6) ──────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setPreviewImageData(ev.target.result); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Legend = the queued layer changes, coloured by role (data colour, §7 Role 2).
  const legendRows = textureRows
    .filter(r => r.changed)
    .map(r => ({
      id: r.slot,
      color: ROLE_COLORS[r.role] || ROLE_COLORS.base,
      label: r.label,
      meta: r.toAlbedo ? r.toAlbedo.split('/').pop() : '—',
      pts: r.role,
    }));

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      subtitle="Current Map"
      canvasRef={canvasRef}
      containerRef={containerRef}
      showPlaceholder={!previewImageData}
      placeholder="Read a map to see its preview"
      legendTitle="Queued Layers"
      legendRows={legendRows}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      hint={biome
        ? `${biome.size?.[0]}² · v${biome.version} · ${biome.props?.total ?? 0} props · ${changedLayers} layer(s) queued`
        : 'No map read'}
    />
  );

  return (
    <div className="biomechanger-tab trace-tab">
      <BiomeChangerHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />

      <TabLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="BIOME"
        navLabel="Biome changer navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <BiomeChangerHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        contextLabel={SECTIONS.find(sec => sec.id === activeSection)?.label || ''}
        mapContext={mapName}
      />
    </div>
  );
};

export default BiomeChangerTab;
