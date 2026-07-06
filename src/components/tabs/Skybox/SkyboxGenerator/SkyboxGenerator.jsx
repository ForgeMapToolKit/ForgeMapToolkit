/**
 * SkyboxGenerator.jsx — Parent (Orchestrierung)
 *
 * TAB-CONTRACT: §0-9 (tabs/Skybox/SkyboxGeneratorTab/)
 * Prefix: sb_
 *
 * Nur: State/Hooks/Handler/Overlays/Render-Shell.
 * Keine Präsentationslogik — alles in Sektionsdateien.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

import '../../../Shared/shared.css';
import './SkyboxGenerator.css';

// ── Shared Infrastruktur ──────────────────────────────────────────────────────
import { usePersistentState, useMapInfo } from '../../../Shared/MapLogic';
import TabLayout                          from '../../../Shared/Ui/TabLayout/TabLayout';

// ── Libraries & Modals ───────────────────────────────────────────────────────
import SkyboxLibrary, { fetchSkyboxLibrary } from '../../../Shared/Libraries/SkyboxLibrary/SkyboxLibrary';
import { luxuryAlert }                       from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';

// ── Sektions-Komponenten ──────────────────────────────────────────────────────
import Configuration, { FullscreenDome } from './Configuration.jsx';
import Cirrus                            from './Cirrus.jsx';
import Planets                           from './Planets.jsx';
import Stars                             from './Stars.jsx';
import Output                            from './Output.jsx';
import Help                              from './Help.jsx';

// ── Utilities ─────────────────────────────────────────────────────────────────
import {
  hexToRgba,
  toHex,
  parseUvOptions,
  parseWeights,
  uvRowsToOptions,
  uvRowsToWeights,
  buildStars,
  generateSkyboxJson,
  buildSkyboxLuaBlock,
  parseCirrusFromText,
  DEFAULT_UV_ROWS,
  CIRRUS_BUILTIN_PRESETS,
  presetToLayers,
  defaultPlanet,
  defaultCirrusLayer,
} from './utils.js';

// ─────────────────────────────────────────────────────────────────
const ASSETS_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main';
const REF_SIZE   = 1024;

// ══════════════════════════════════════════════════════════════════
const SkyboxGeneratorTab = ({
  settings,
  shared = {},
  onSharedChange = () => {},
  onRecordSnapshot = () => {},
}) => {
  const s = shared;

  // ── 2a. Persistenter State (Prefix sb_) ───────────────────────
  const [mapName,       setMapName]       = usePersistentState(s, 'sb_mapName',       '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'sb_mapsFolderPath',
    settings?.mapsFolder || '', onSharedChange);

  const [exportRawScmskybox, setExportRawScmskybox] = usePersistentState(s, 'sb_exportRawScmskybox', false, onSharedChange);
  const [generateReadme,     setGenerateReadme]     = usePersistentState(s, 'sb_generateReadme',     true,  onSharedChange);

  // Atmosphäre
  const [subtractHeight, setSubtractHeight] = usePersistentState(s, 'sb_subtractHeight', '1.2566', onSharedChange);
  const [subdivAxis,     setSubdivAxis]     = usePersistentState(s, 'sb_subdivAxis',     '16',     onSharedChange);
  const [subdivHeight,   setSubdivHeight]   = usePersistentState(s, 'sb_subdivHeight',   '6',      onSharedChange);
  const [horizonHeight,  setHorizonHeight]  = usePersistentState(s, 'sb_horizonHeight',  '-42.5',  onSharedChange);
  const [zenithHeight,   setZenithHeight]   = usePersistentState(s, 'sb_zenithHeight',   '293.507',onSharedChange);
  const [horizonColor,   setHorizonColor]   = usePersistentState(s, 'sb_horizonColor',   '#a5d1d6',onSharedChange);
  const [zenithColor,    setZenithColor]    = usePersistentState(s, 'sb_zenithColor',    '#3869b8',onSharedChange);
  const [decalGlowMult,  setDecalGlowMult]  = usePersistentState(s, 'sb_decalGlowMult',  '0.1',    onSharedChange);
  const [albedo,         setAlbedo]         = usePersistentState(s, 'sb_albedo',
    '/textures/environment/Decal_test_Albedo003.dds', onSharedChange);
  const [glow,           setGlow]           = usePersistentState(s, 'sb_glow',
    '/textures/environment/Decal_test_Glow003.dds',   onSharedChange);

  // Cirrus
  const [cirrusMult,    setCirrusMult]    = usePersistentState(s, 'sb_cirrusMult',    '1.8',      onSharedChange);
  const [cirrusColor,   setCirrusColor]   = usePersistentState(s, 'sb_cirrusColor',   '#ffffff',  onSharedChange);
  const [cirrusTexture, setCirrusTexture] = usePersistentState(s, 'sb_cirrusTexture',
    '/textures/environment/cirrus000.dds', onSharedChange);
  const [cirrusLayers,  setCirrusLayers]  = usePersistentState(s, 'sb_cirrusLayers', [
    { id:1, freqX:0.0001,   freqY:0.0001,   speed:7.8,  dirX:0.432,  dirY:-0.902  },
    { id:2, freqX:0.001011, freqY:0.003189, speed:1.28, dirX:1.0,    dirY:0.0     },
    { id:3, freqX:0.000645, freqY:0.001011, speed:0.0,  dirX:0.95,   dirY:0.312   },
    { id:4, freqX:0.003367, freqY:0.005911, speed:0.55, dirX:0.9996, dirY:0.0297  },
  ], onSharedChange);

  // Cirrus-Presets
  const [activePresetId, setActivePresetId] = usePersistentState(s, 'sb_activePresetId', null, onSharedChange);
  const [customPresets,  setCustomPresets]  = usePersistentState(s, 'sb_customPresets',  [],   onSharedChange);

  // Planeten
  const [planets, setPlanets] = usePersistentState(s, 'sb_planets', [], onSharedChange);

  // Stars
  const [numStars,        setNumStars]        = usePersistentState(s, 'sb_numStars',        '50',    onSharedChange);
  const [numClusters,     setNumClusters]     = usePersistentState(s, 'sb_numClusters',     '10',    onSharedChange);
  const [clusterSpread,   setClusterSpread]   = usePersistentState(s, 'sb_clusterSpread',   '14000', onSharedChange);
  const [clusterStdDev,   setClusterStdDev]   = usePersistentState(s, 'sb_clusterStdDev',   '1800',  onSharedChange);
  const [backgroundRatio, setBackgroundRatio] = usePersistentState(s, 'sb_backgroundRatio', '0.45',  onSharedChange);
  const [scaleMin,        setScaleMin]        = usePersistentState(s, 'sb_scaleMin',        '10',    onSharedChange);
  const [scaleMax,        setScaleMax]        = usePersistentState(s, 'sb_scaleMax',        '30',    onSharedChange);
  const [uvOpacity,       setUvOpacity]       = usePersistentState(s, 'sb_uvOpacity',       '0.25',  onSharedChange);
  const [uvOptions,       setUvOptions]       = usePersistentState(s, 'sb_uvOptions',
    '0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5',
    onSharedChange);
  const [uvWeights,       setUvWeights]       = usePersistentState(s, 'sb_uvWeights',
    '0.25\n0.25\n0.25\n0.25', onSharedChange);
  const [uvRows,          setUvRows]          = usePersistentState(s, 'sb_uvRows',  DEFAULT_UV_ROWS, onSharedChange);
  const [seed,            setSeed]            = usePersistentState(s, 'sb_seed',    42,   onSharedChange);
  const [useSeed,         setUseSeed]         = usePersistentState(s, 'sb_useSeed', false,onSharedChange);
  const [yMode,           setYMode]           = usePersistentState(s, 'sb_yMode',   'flat',onSharedChange);
  const [yMax,            setYMax]            = usePersistentState(s, 'sb_yMax',    '1500',onSharedChange);
  const [yCenter,         setYCenter]         = usePersistentState(s, 'sb_yCenter', '750', onSharedChange);
  const [yStdDev,         setYStdDev]         = usePersistentState(s, 'sb_yStdDev', '300', onSharedChange);
  const [yLayers,         setYLayers]         = usePersistentState(s, 'sb_yLayers',
    '200, 400, 0.7\n900, 200, 0.3', onSharedChange);
  const [diskCenter,      setDiskCenter]      = usePersistentState(s, 'sb_diskCenter', '100',  onSharedChange);
  const [diskStdDev,      setDiskStdDev]      = usePersistentState(s, 'sb_diskStdDev', '120',  onSharedChange);
  const [haloStdDev,      setHaloStdDev]      = usePersistentState(s, 'sb_haloStdDev', '800',  onSharedChange);
  const [haloRatio,       setHaloRatio]       = usePersistentState(s, 'sb_haloRatio',  '0.15', onSharedChange);
  const [curvePoints,     setCurvePoints]     = usePersistentState(s, 'sb_curvePoints', [
    { x: 0.05, y: 0.0 }, { x: 1.0, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.05, y: 1.0 },
  ], onSharedChange);
  const [yClusterScatter, setYClusterScatter] = usePersistentState(s, 'sb_yClusterScatter', '200', onSharedChange);

  // ── 2c. Lokaler UI-State ──────────────────────────────────────
  const [activeSection,    setActiveSection]    = useState('atmosphere');
  const [selectedPlanetId, setSelectedPlanetId] = useState(null);
  const [domeFullscreen,   setDomeFullscreen]   = useState(false);
  const [showDomeLabels,   setShowDomeLabels]   = useState(true);
  const [showSkyboxLibrary,setShowSkyboxLibrary]= useState(false);
  const [showHelp,         setShowHelp]         = useState(false);
  const [exclusionZones,   setExclusionZones]   = useState([]);
  const [draftZone,        setDraftZone]        = useState(null);
  const [selectedZoneIdx,  setSelectedZoneIdx]  = useState(null);
  const [exEnabled,        setExEnabled]        = useState(true);
  const [previewImage,     setPreviewImage]     = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [texOpacity,       setTexOpacity]       = useState(1);
  const [showSavePreset,   setShowSavePreset]   = useState(false);
  const [newPresetName,    setNewPresetName]    = useState('');
  const [importText,       setImportText]       = useState('');
  const [importError,      setImportError]      = useState('');
  const [importDragOver,   setImportDragOver]   = useState(false);

  // Skybox-Library-Cache
  const [skyboxCategories, setSkyboxCategories] = useState([]);
  const [skyboxLibLoading, setSkyboxLibLoading] = useState(false);
  const [skyboxLibLoaded,  setSkyboxLibLoaded]  = useState(false);
  const [skyboxLibError,   setSkyboxLibError]   = useState(null);
  const skyboxLibLoadingRef = useRef(false);

  // ── 2b. Abgeleiteter State ────────────────────────────────────
  // mapSize kommt AUSSCHLIESSLICH aus useMapInfo (Contract §3)
  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName,
    mapsFolderPath,
    settings,
    onMapSize: newSz => {
      // Skalierungslogik beim Größenwechsel
      const oldSz = prevMapSizeRef.current;
      if (newSz && newSz !== oldSz) {
        const factor = newSz / oldSz;
        setHorizonHeight(v => String(parseFloat((parseFloat(v) * factor).toFixed(2))));
        setZenithHeight(v  => String(parseFloat((parseFloat(v) * factor).toFixed(2))));
        setCirrusLayers(ls => ls.map(l => ({
          ...l,
          freqX: parseFloat((parseFloat(l.freqX) / factor).toPrecision(5)),
          freqY: parseFloat((parseFloat(l.freqY) / factor).toPrecision(5)),
          speed: parseFloat((parseFloat(l.speed)  * factor).toPrecision(5)),
        })));
        prevMapSizeRef.current = newSz;
      }
      onSharedChange('sb_mapSize', String(newSz));
    },
  });
  const prevMapSizeRef = useRef(parseFloat(settings?.defaultMapSize ?? '1024') || 1024);
  const scale = (parseFloat(mapSize) || 1024) * 2.288;

  // ── Sync mapName/mapsFolder von anderen Tabs ──────────────────
  useEffect(() => {
    const ext = s.pt_mapName || s.wr_mapName || '';
    if (ext && !mapName) setMapName(ext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pt_mapName, s.wr_mapName]);

  useEffect(() => {
    const ext = s.pt_mapsFolderPath || s.wr_mapsFolderPath || settings?.mapsFolder || '';
    if (ext && !mapsFolderPath) setMapsFolderPath(ext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pt_mapsFolderPath, s.wr_mapsFolderPath, settings?.mapsFolder]);

  // ── Pending community skybox auto-apply ──────────────────────
  useEffect(() => {
    const pending = window._pendingContribSkybox;
    if (!pending) return;
    window._pendingContribSkybox = null;
    applyLibrarySkybox({ scmskyboxData: pending, isCustom: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Custom presets aus history laden ─────────────────────────
  useEffect(() => {
    window.electronAPI.invoke('history-load').then(res => {
      const saved = res?.data?.cirrusCustomPresets;
      if (Array.isArray(saved) && saved.length) setCustomPresets(saved);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!customPresets.length) return;
    window.electronAPI.invoke('history-load').then(res => {
      const base = res?.data || {};
      window.electronAPI.invoke('history-save',
        { data: { ...base, cirrusCustomPresets: customPresets } }).catch(() => {});
    }).catch(() => {});
  }, [customPresets]);



  // ── Editor Live-Bridge ────────────────────────────────────────
  const [bridgeState,     setBridgeState]     = useState('disconnected');
  const [bridgeLoadedMap, setBridgeLoadedMap] = useState('');

  // Ref hält immer den aktuellen bridgeState — wird im Snapshot-Effekt
  // gelesen ohne ihn als Dependency zu listen.
  const bridgeStateRef = useRef('disconnected');

  // Abonniere State-Updates vom Main Process
  useEffect(() => {
    const unsub = window.electronAPI.on('bridge-state-changed', ({ state, loadedMap }) => {
      bridgeStateRef.current = state;
      setBridgeState(state);
      setBridgeLoadedMap(loadedMap ?? '');
    });
    return unsub;
  }, []);

  // Schicke Snapshot bei jeder Atmosphere-Wertänderung, solange live.
  // bridgeState per Ref lesen — nicht als Dependency — damit dieser Effekt
  // nie durch einen State-Wechsel während des Renderns feuert.
  useEffect(() => {
    if (bridgeStateRef.current !== 'live') return;
    const [hr, hg, hb] = [
      parseInt(horizonColor.slice(1,3), 16) / 255,
      parseInt(horizonColor.slice(3,5), 16) / 255,
      parseInt(horizonColor.slice(5,7), 16) / 255,
    ];
    const [zr, zg, zb] = [
      parseInt(zenithColor.slice(1,3), 16) / 255,
      parseInt(zenithColor.slice(3,5), 16) / 255,
      parseInt(zenithColor.slice(5,7), 16) / 255,
    ];
    window.electronAPI.invoke('bridge-send-snapshot', {
      mapName,
      payload: {
        subtractHeight:     parseFloat(subtractHeight)  || 1.2566,
        subdivisionsAxis:   parseInt(subdivAxis)        || 16,
        subdivisionsHeight: parseInt(subdivHeight)      || 6,
        horizonHeight:      parseFloat(horizonHeight)   || 0,
        zenithHeight:       parseFloat(zenithHeight)    || 256,
        horizonColor:       [hr, hg, hb],
        zenithColor:        [zr, zg, zb],
      },
    }).catch(() => {});
  }, [subtractHeight, subdivAxis, subdivHeight,
      horizonHeight, zenithHeight, horizonColor, zenithColor, mapName]);

  // Handler
  const onBridgeConnect = useCallback(() => {
    console.log('[Bridge UI] Connect geklickt, mapName =', JSON.stringify(mapName));
    if (!mapName?.trim()) return;
    window.electronAPI.invoke('bridge-connect', { mapName: mapName.trim() }).catch(() => {});
  }, [mapName]);

  const onBridgeDisconnect = useCallback(() => {
    window.electronAPI.invoke('bridge-disconnect').catch(() => {});
  }, []);
 


  // ── 2d. Handler ───────────────────────────────────────────────

  // UV-Rows synchron halten
  const syncUvRows = useCallback((rows) => {
    setUvRows(rows);
    setUvOptions(uvRowsToOptions(rows));
    setUvWeights(uvRowsToWeights(rows));
  }, [setUvRows, setUvOptions, setUvWeights]);

  // Planeten-CRUD
  const onAddPlanet    = useCallback(() => {
    const np = defaultPlanet();
    setPlanets(ps => [...ps, np]);
    setSelectedPlanetId(np.id);
  }, [setPlanets]);
  const onRemovePlanet = useCallback((id) => {
    setPlanets(ps => {
      const next = ps.filter(p => p.id !== id);
      setSelectedPlanetId(cur => {
        if (cur !== id) return cur;
        return next.length ? next[0].id : null;
      });
      return next;
    });
  }, [setPlanets]);
  const onUpdatePlanet = useCallback((id, field, val) =>
    setPlanets(ps => ps.map(p => p.id === id ? { ...p, [field]: val } : p)), [setPlanets]);
  const onDuplicatePlanet = useCallback((id) => {
    setPlanets(ps => {
      const src = ps.find(p => p.id === id);
      if (!src) return ps;
      const copy = { ...src, id: Date.now() + Math.random() };
      const idx = ps.findIndex(p => p.id === id);
      const next = [...ps.slice(0, idx + 1), copy, ...ps.slice(idx + 1)];
      setSelectedPlanetId(copy.id);
      return next;
    });
  }, [setPlanets]);

  // Cirrus-CRUD
  const onAddCirrus    = useCallback(() =>
    setCirrusLayers(ls => [...ls, { ...defaultCirrusLayer(), id: Date.now() + Math.random() }]),
    [setCirrusLayers]);
  const onRemoveCirrus = useCallback((id) =>
    setCirrusLayers(ls => ls.filter(l => l.id !== id)), [setCirrusLayers]);
  const onUpdateCirrus = useCallback((id, field, val) =>
    setCirrusLayers(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l)),
    [setCirrusLayers]);

  // Cirrus-Presets
  const onApplyPreset = useCallback((preset) => {
    if (activePresetId === preset.id) { setActivePresetId(null); return; }
    setActivePresetId(preset.id);
    setCirrusTexture(preset.texture);
    setCirrusLayers(presetToLayers(preset));
  }, [activePresetId, setActivePresetId, setCirrusTexture, setCirrusLayers]);

  const onSaveCustomPreset = useCallback(() => {
    const name = newPresetName.trim();
    if (!name) return;
    const fromImport = importText.trim() ? parseCirrusFromText(importText) : null;
    const preset = {
      id: 'custom-' + Date.now(),
      label: name,
      texture: fromImport?.texture ?? cirrusTexture,
      layers: (fromImport?.layers ?? cirrusLayers).map(
        ({ freqX, freqY, speed, dirX, dirY }) =>
          ({ freqX: String(freqX), freqY: String(freqY), speed: String(speed),
             dirX: String(dirX), dirY: String(dirY) })),
    };
    setCustomPresets(ps => [...ps, preset]);
    setNewPresetName('');
    setImportText('');
    setImportError('');
    setShowSavePreset(false);
  }, [newPresetName, importText, cirrusTexture, cirrusLayers, setCustomPresets]);

  const onDeleteCustomPreset = useCallback((id) => {
    setCustomPresets(ps => ps.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
    window.electronAPI.invoke('history-load').then(res => {
      const base = res?.data || {};
      const updated = (base.cirrusCustomPresets || []).filter(p => p.id !== id);
      window.electronAPI.invoke('history-save',
        { data: { ...base, cirrusCustomPresets: updated } }).catch(() => {});
    }).catch(() => {});
  }, [activePresetId, setActivePresetId, setCustomPresets]);

  // Stars
  const onResetStarDefaults = useCallback(() => {
    setNumStars('50'); setNumClusters('10'); setClusterSpread('14000');
    setClusterStdDev('1800'); setBackgroundRatio('0.45');
    setScaleMin('10'); setScaleMax('30'); setUvOpacity('0.25');
    syncUvRows(DEFAULT_UV_ROWS);
  }, [syncUvRows, setNumStars, setNumClusters, setClusterSpread, setClusterStdDev,
      setBackgroundRatio, setScaleMin, setScaleMax, setUvOpacity]);

  const onRandomizeSeed = useCallback(() =>
    setSeed(Math.floor(Math.random() * 999999) + 1), [setSeed]);

  // generateStarPlanets — benötigt für Export/Inject
  const generateStarPlanets = useCallback(() => {
    const n = parseInt(numStars) || 50;
    try {
      const stars = buildStars({
        nStars: n, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
        scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
        seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
        diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter,
      });
      return stars.map(s => ({
        Position: { x: s.x, y: s.y, z: s.z },
        Rotation: s.rotation,
        Scale:    { x: s.scale, y: s.scale },
        Uv:       { x: s.uv.x, y: s.uv.y, z: s.uv.z, w: s.uv.w },
      }));
    } catch (e) {
      console.warn('[generateStarPlanets]', e.message);
      return [];
    }
  }, [numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
      scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
      seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
      diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter]);

  // Inject stars
  const onInjectStars = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();
    if (!mapNameTrimmed) { await luxuryAlert('Bitte Map Name setzen.', 'Map Name Required', 'warning'); return; }
    if (!mapsFolder)     { await luxuryAlert('Bitte Maps Folder konfigurieren.', 'Maps Folder Not Set', 'warning'); return; }
    const finalName     = /\.v\d{4}$/.test(mapNameTrimmed) ? mapNameTrimmed : mapNameTrimmed + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;
    try {
      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirEntries?.success) throw new Error('Could not read map folder.');
      const scmapEntry = dirEntries.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error(`No .scmap in ${mapFolderPath}`);
      const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
      const unpackedFolder = unpackRes.outputFolder;
      const dataLuaPath    = `${unpackedFolder}\\data.lua`;
      const readRes        = await window.electronAPI.invoke('read-file', { path: dataLuaPath });
      if (!readRes?.success) throw new Error(`data.lua read failed: ${readRes?.error}`);
      const stars    = buildStars({ nStars: parseInt(numStars)||50, numClusters, clusterSpread,
        clusterStdDev, backgroundRatio, scaleMin, scaleMax, uvOptions, uvWeights,
        exclusionZones, exEnabled, seed, useSeed, yMode, yMax, yCenter, yStdDev,
        yLayers, diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter });
      const planetLuaStr = stars.map(st =>
        `        {\n            position = { ${st.x.toFixed(3)}, ${st.y.toFixed(3)}, ${st.z.toFixed(3)}, },\n` +
        `            rotation = ${st.rotation.toFixed(4)},\n            scale = { ${st.scale.toFixed(2)}, ${st.scale.toFixed(2)}, },\n` +
        `            uv = { ${st.uv.x}, ${st.uv.y}, ${st.uv.z}, ${st.uv.w}, },\n        },\n`
      ).join('');
      let dataLua = readRes.content;
      const planetsRegex = /planets\s*=\s*\{[\s\S]*?\},/;
      if (planetsRegex.test(dataLua)) {
        dataLua = dataLua.replace(planetsRegex, `planets = {\n${planetLuaStr}        },`);
      } else {
        throw new Error('planets section not found in data.lua');
      }
      const writeRes = await window.electronAPI.invoke('write-file', { filePath: dataLuaPath, content: dataLua });
      if (!writeRes?.success) throw new Error(`Write failed: ${writeRes?.error}`);
      const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
      const packRes  = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
      if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);
      const copyRes  = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
      if (!copyRes?.success) throw new Error('Repack copy failed.');
      await luxuryAlert(`✓ ${stars.length} stars injected.`, 'Stars Injected', 'success');
    } catch (e) {
      await luxuryAlert(e.message, 'Inject Failed', 'error');
    }
  }, [mapName, settings, numStars, numClusters, clusterSpread, clusterStdDev,
      backgroundRatio, scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones,
      exEnabled, seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
      diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter]);

  // Export .scmskybox
  const onExportScmskybox = useCallback(async () => {
    if (!mapName?.trim()) { await luxuryAlert('Map Name required.', 'Map Name Required', 'warning'); return; }
    const mapsFolder = (mapsFolderPath || '').trim();
    if (!mapsFolder)     { await luxuryAlert('Maps Folder not set.', 'Maps Folder Not Set', 'warning'); return; }
    const finalName     = /\.v\d{4}$/.test(mapName.trim()) ? mapName.trim() : mapName.trim() + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;
    try {
      const content    = generateSkyboxJson({ mapSize, horizonHeight, horizonColor, zenithColor,
        zenithHeight, subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
        cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets, generateStarPlanets, scale });
      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      let maxIdx = 0, hasSingle = false;
      for (const e of (dirEntries?.entries || [])) {
        if (e.name === 'skybox_export.scmskybox') hasSingle = true;
        const m = e.name.match(/^skybox_export(\d+)\.scmskybox$/);
        if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
      }
      const fileName = maxIdx > 0 ? `skybox_export${maxIdx + 1}.scmskybox`
                     : hasSingle  ? `skybox_export1.scmskybox`
                     : `skybox_export.scmskybox`;
      const writeRes = await window.electronAPI.invoke('write-file',
        { filePath: `${mapFolderPath}\\${fileName}`, content });
      if (!writeRes?.success) throw new Error(`Write failed: ${writeRes?.error}`);
      await luxuryAlert(`✓ Exported to ${fileName}`, 'Exported', 'success');
    } catch (e) {
      await luxuryAlert(e.message, 'Export Failed', 'error');
    }
  }, [mapName, mapsFolderPath, mapSize, horizonHeight, horizonColor, zenithColor,
      zenithHeight, subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
      cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets, generateStarPlanets, scale]);

  // Inject skybox in .scmap
  const onInjectSkybox = useCallback(async () => {
    if (!mapName?.trim()) { await luxuryAlert('Map Name required.', 'Map Name Required', 'warning'); return; }
    const mapsFolder = (mapsFolderPath || '').trim();
    if (!mapsFolder)     { await luxuryAlert('Maps Folder not set.', 'Maps Folder Not Set', 'warning'); return; }
    const finalName     = /\.v\d{4}$/.test(mapName.trim()) ? mapName.trim() : mapName.trim() + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalName}`;
    try {
      const dirEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirEntries?.success) throw new Error('Map folder unreadable.');
      const scmapEntry = dirEntries.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error(`No .scmap in ${mapFolderPath}`);
      const scmapPath    = `${mapFolderPath}\\${scmapEntry.name}`;
      const unpackRes    = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
      const unpackedFolder = unpackRes.outputFolder;
      const snapBefore   = (await window.electronAPI.invoke('scmap-snapshot-folder',
        { folderPath: unpackedFolder }))?.snapshot ?? null;
      const dataLuaPath  = `${unpackedFolder}\\data.lua`;
      const readRes      = await window.electronAPI.invoke('read-file', { path: dataLuaPath });
      if (!readRes?.success) throw new Error(`data.lua read failed: ${readRes?.error}`);
      const luaBlock = buildSkyboxLuaBlock({
        mapSize, horizonHeight, horizonColor, zenithColor, zenithHeight,
        subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
        cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets,
        generateStarPlanets,
      });
      let dataLua = readRes.content;
      const skyboxRegex = /skyBox = \{[\s\S]*?\n    \}/;
      if (skyboxRegex.test(dataLua)) {
        dataLua = dataLua.replace(skyboxRegex, luaBlock);
      } else {
        const anchorRe = /([ \t]*\},\s*\n[ \t]*shaderPath\s*=\s*"[^"]*",\s*\n[ \t]*size\s*=\s*\{[\s\S]*?\},\s*\n)/;
        if (anchorRe.test(dataLua)) {
          dataLua = dataLua.replace(anchorRe, `$1\n${luaBlock},\n`);
        } else {
          throw new Error('skyBox section not found and insert anchor not found.');
        }
      }
      dataLua = dataLua.replace(/(\bversion\s*=\s*)(\d+)(\s*,)/, (m, pre, num, post) =>
        parseInt(num, 10) !== 60 ? `${pre}60${post}` : m);
      const writeRes = await window.electronAPI.invoke('write-file', { filePath: dataLuaPath, content: dataLua });
      if (!writeRes?.success) throw new Error(`Write failed: ${writeRes?.error}`);
      const snapAfter  = (await window.electronAPI.invoke('scmap-snapshot-folder',
        { folderPath: unpackedFolder }))?.snapshot ?? null;
      if (snapBefore && snapAfter) onRecordSnapshot('skybox-generator', finalName, snapBefore, snapAfter);
      const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
      const packRes  = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
      if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);
      const copyRes  = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
      if (!copyRes?.success) throw new Error('Repack copy failed.');
      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder)
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      await luxuryAlert('✓ Skybox injected into .scmap', 'Injected', 'success');
    } catch (e) {
      console.error('[onInjectSkybox]', e);
      await luxuryAlert(e.message, 'Inject Failed', 'error');
    }
  }, [mapName, mapsFolderPath, mapSize, horizonHeight, horizonColor, zenithColor,
      zenithHeight, subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
      cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets, generateStarPlanets,
      onRecordSnapshot]);

  // Apply library skybox
  const applyLibrarySkybox = useCallback(async (skybox) => {
    const d = skybox?.scmskyboxData?.Data ?? skybox?.scmskyboxData ?? {};
    const curSize = parseFloat(mapSize) || 1024;
    const toStr = (v, fb) => v != null ? String(v) : String(fb);
    setSubtractHeight(toStr(d.SubtractHeight, '1.2566'));
    setSubdivAxis(toStr(d.SubdivisionsAxis, '16'));
    setSubdivHeight(toStr(d.SubdivisionsHeight, '6'));
    setHorizonHeight(toStr(d.HorizonHeight, '-42.5'));
    setZenithHeight(toStr(d.ZenithHeight, '293.507'));
    if (d.HorizonColor) setHorizonColor(toHex(d.HorizonColor));
    if (d.ZenithColor)  setZenithColor(toHex(d.ZenithColor));
    setDecalGlowMult(toStr(d.DecalGlowMultiplier, '0.1'));
    if (d.Albedo) setAlbedo(d.Albedo);
    if (d.Glow)   setGlow(d.Glow);
    setCirrusMult(toStr(d.CirrusMultiplier, '1.8'));
    if (d.CirrusColor)   setCirrusColor(toHex(d.CirrusColor));
    if (d.CirrusTexture) setCirrusTexture(d.CirrusTexture);
    const freqFactor  = REF_SIZE / curSize;
    const speedFactor = curSize / REF_SIZE;
    const fileLayers = (d.CirrusLayers || []).map((l, i) => ({
      id:    i + 1,
      freqX: ((l.frequency?.x ?? l.FrequencyX ?? 0.0001) * freqFactor),
      freqY: ((l.frequency?.y ?? l.FrequencyY ?? 0.0001) * freqFactor),
      speed: ((l.Speed ?? l.speed ?? 0) * speedFactor),
      dirX:  l.Direction?.x ?? l.DirectionX ?? 1,
      dirY:  l.Direction?.y ?? l.DirectionY ?? 0,
    }));
    if (fileLayers.length) setCirrusLayers(fileLayers);
    if (d.Planets?.length) {
      setPlanets(d.Planets.map((p, i) => ({
        id:       Date.now() + i + Math.random(),
        x:        String(p.Position?.x ?? p.x ?? 2190.0),
        y:        String(p.Position?.y ?? p.y ?? 570.0),
        z:        String(p.Position?.z ?? p.z ?? -1020.0),
        rotation: String(p.Rotation  ?? p.rotation ?? -1.585),
        scaleX:   String(p.Scale?.x  ?? p.scaleX   ?? 183.0),
        scaleY:   String(p.Scale?.y  ?? p.scaleY   ?? 183.0),
        uvX:      String(p.Uv?.x     ?? p.uvX      ?? 0.0),
        uvY:      String(p.Uv?.y     ?? p.uvY      ?? 0.5),
        uvZ:      String(p.Uv?.z     ?? p.uvZ      ?? 0.5),
        uvW:      String(p.Uv?.w     ?? p.uvW      ?? 0.5),
      })));
    }
    setShowSkyboxLibrary(false);
    setActiveSection('atmosphere');
  }, [mapSize, setSubtractHeight, setSubdivAxis, setSubdivHeight, setHorizonHeight,
      setZenithHeight, setHorizonColor, setZenithColor, setDecalGlowMult, setAlbedo,
      setGlow, setCirrusMult, setCirrusColor, setCirrusTexture, setCirrusLayers, setPlanets]);

  // Skybox-Library
  const loadSkyboxLibrary = useCallback(async ({ forceRefresh = false } = {}) => {
    if (skyboxLibLoadingRef.current) return;
    skyboxLibLoadingRef.current = true;
    setSkyboxLibLoading(true);
    setSkyboxLibError(null);
    try {
      const cats = await fetchSkyboxLibrary({ forceRefresh });
      if (!Array.isArray(cats)) throw new Error('fetchSkyboxLibrary returned non-array');
      setSkyboxCategories(cats);
      setSkyboxLibLoaded(true);
    } catch (e) {
      setSkyboxLibError(e.message);
    } finally {
      skyboxLibLoadingRef.current = false;
      setSkyboxLibLoading(false);
    }
  }, []);

  const onOpenSkyboxLibrary = useCallback(() => {
    setShowSkyboxLibrary(true);
    if (!skyboxLibLoaded && !skyboxLibLoadingRef.current)
      loadSkyboxLibrary({ forceRefresh: false });
  }, [skyboxLibLoaded, loadSkyboxLibrary]);

  // Image upload (UV preview)
  const onImageUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isDds = file.name.toLowerCase().endsWith('.dds');
    if (isDds) {
      try {
        const filePath = webUtils.getPathForFile(file);
        const result = await window.electronAPI.invoke('dds-to-dataurl', { filePath });
        if (!result?.success) { await luxuryAlert('DDS load failed: ' + (result?.error || ''), 'DDS Load Failed', 'error'); return; }
        const img = new Image();
        img.onload = () => { setPreviewImage(img); setPreviewImageData(result.dataUrl); };
        img.src = result.dataUrl;
      } catch (err) {
        await luxuryAlert('DDS requires Electron: ' + err.message, 'Electron Required', 'error');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => { setPreviewImage(img); setPreviewImageData(ev.target.result); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  // ── 2e. Section-Props-Bündel ──────────────────────────────────
const configProps = {
    mapName, setMapName, mapsFolderPath, setMapsFolderPath,
    mapInfo, mapSize, scale,
    subtractHeight, setSubtractHeight,
    subdivAxis, setSubdivAxis,
    subdivHeight, setSubdivHeight,
    horizonHeight, setHorizonHeight,
    zenithHeight, setZenithHeight,
    horizonColor, setHorizonColor,
    zenithColor, setZenithColor,
    decalGlowMult, setDecalGlowMult,
    albedo, setAlbedo,
    glow, setGlow,
    showDomeLabels, setShowDomeLabels,
    domeFullscreen, setDomeFullscreen,
    // Bridge
    bridgeState,
    bridgeLoadedMap,
    onBridgeConnect,
    onBridgeDisconnect,
  };

  const cirrusProps = {
    cirrusMult, setCirrusMult,
    cirrusColor, setCirrusColor,
    cirrusTexture, setCirrusTexture,
    cirrusLayers,
    onAddCirrus, onRemoveCirrus, onUpdateCirrus,
    activePresetId,
    customPresets,
    showSavePreset, setShowSavePreset,
    newPresetName, setNewPresetName,
    importText, setImportText,
    importError, setImportError,
    importDragOver, setImportDragOver,
    onApplyPreset, onSaveCustomPreset, onDeleteCustomPreset,
    parseCirrusFromText,
    CIRRUS_BUILTIN_PRESETS,
  };

  const planetsProps = {
    planets,
    onAddPlanet, onRemovePlanet, onUpdatePlanet, onDuplicatePlanet,
    selectedPlanetId, setSelectedPlanetId,
  };

  const starsProps = {
    numStars, setNumStars,
    numClusters, setNumClusters,
    clusterSpread, setClusterSpread,
    clusterStdDev, setClusterStdDev,
    backgroundRatio, setBackgroundRatio,
    scaleMin, setScaleMin,
    scaleMax, setScaleMax,
    uvOpacity, setUvOpacity,
    uvOptions, uvWeights,
    uvRows, syncUvRows,
    seed, setSeed,
    useSeed, setUseSeed,
    onRandomizeSeed,
    yMode, setYMode,
    yMax, setYMax,
    yCenter, setYCenter,
    yStdDev, setYStdDev,
    yLayers, setYLayers,
    diskCenter, setDiskCenter,
    diskStdDev, setDiskStdDev,
    haloStdDev, setHaloStdDev,
    haloRatio, setHaloRatio,
    curvePoints, setCurvePoints,
    yClusterScatter, setYClusterScatter,
    exclusionZones, setExclusionZones,
    draftZone, setDraftZone,
    selectedZoneIdx, setSelectedZoneIdx,
    exEnabled, setExEnabled,
    previewImage, previewImageData,
    onRemovePreview: () => { setPreviewImage(null); setPreviewImageData(null); },
    texOpacity, setTexOpacity,
    onImageUpload,
    onResetDefaults: onResetStarDefaults,
    onInjectStars,
  };

  const outputProps = {
    mapName, mapsFolderPath,
    exportRawScmskybox, setExportRawScmskybox,
    generateReadme, setGenerateReadme,
    onExportScmskybox,
    onInjectSkybox,
    // Vorschau-JSON live berechnen
    previewJson: (() => {
      try {
        return generateSkyboxJson({ mapSize, horizonHeight, horizonColor, zenithColor,
          zenithHeight, subtractHeight, subdivAxis, subdivHeight, decalGlowMult, albedo, glow,
          cirrusMult, cirrusColor, cirrusTexture, cirrusLayers, planets, generateStarPlanets, scale });
      } catch { return ''; }
    })(),
    // Summary
    planets, cirrusLayers, numStars,
    stParsedUvs: parseUvOptions(uvOptions),
  };

  // ── WorkspaceConsole-Sektionen ────────────────────────────────
  const sections = [
    { id: 'atmosphere', index: '01', label: 'Atmosphere',
      desc: 'Dome geometry, mesh subdivisions, horizon/zenith color and decal.',
      aside: null },
    { id: 'cirrus',     index: '02', label: 'Cirrus',
      desc: 'Cloud layers — frequency, drift speed and direction per layer.',
      aside: null },
    { id: 'planets',    index: '03', label: 'Planets',
      desc: 'Manually placed celestial bodies at exact world coordinates.',
      aside: null },
    { id: 'stars',      index: '04', label: 'Stars',
      desc: 'Procedural star field — distribution, scale, exclusion zones and UVs.',
      aside: null },
    { id: 'output',     index: '05', label: 'Output',
      desc: 'Review the generated Lua block, set export options and generate.',
      aside: null },
  ];

  const sectionContent = {
    atmosphere: <Configuration {...configProps} />,
    cirrus:     <Cirrus        {...cirrusProps}  />,
    planets:    <Planets       {...planetsProps} />,
    stars:      <Stars         {...starsProps}   />,
    output:     <Output        {...outputProps}  />,
  };

  // Aside-Inhalt analog zu sectionContent — aktuell trägt keine Sektion ein
  // aside-Feld (Inhalts-Komponenten für Cirrus/Planets/Stars sind nicht gebaut).
  // Map bleibt als Anschlussstelle stehen, sobald das nachgezogen wird.
  const asideContent = {};

  // ── 2f. Render ────────────────────────────────────────────────
  return (
    <div className="skybox-tab tab-scrollbar">

      {/* Dome Fullscreen Overlay */}
      {domeFullscreen && ReactDOM.createPortal(
        <FullscreenDome
          horizonColor={horizonColor}   setHorizonColor={setHorizonColor}
          zenithColor={zenithColor}     setZenithColor={setZenithColor}
          horizonHeight={horizonHeight} setHorizonHeight={setHorizonHeight}
          zenithHeight={zenithHeight}   setZenithHeight={setZenithHeight}
          subtractHeight={subtractHeight}
          subdivHeight={subdivHeight}
          scale={scale}
          showLabels={showDomeLabels}   setShowLabels={setShowDomeLabels}
          onClose={() => setDomeFullscreen(false)}
        />,
        document.body,
      )}

      {/* Skybox Library Overlay */}
      {showSkyboxLibrary && (
        <SkyboxLibraryOverlay
          onClose={() => setShowSkyboxLibrary(false)}
          onApply={applyLibrarySkybox}
          onReload={() => loadSkyboxLibrary({ forceRefresh: true })}
          categories={skyboxCategories}
          loading={skyboxLibLoading}
          mapName={mapName}
          mapsFolderPath={mapsFolderPath}
        />
      )}

      {/* Help Modal */}
      {showHelp && (
        <SkyboxHelp onClose={() => setShowHelp(false)} />
      )}

      <TabLayout
        sections={sections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        railStorageKey="skybox-gen-section"
        toolbarSlot={
          <>
            <button
              className="skybox-tab-btn library-btn"
              onClick={onOpenSkyboxLibrary}
              style={{ borderColor: 'rgba(59,118,255,0.35)', color: 'var(--skybox-generator-color)' }}
            >
              ⊞ Library
            </button>
            <button className="help-btn" onClick={() => setShowHelp(true)} title="Help Guide">?</button>
          </>
        }
        asideSlot={asideContent[activeSection]}
      >
        {sectionContent[activeSection]}
      </TabLayout>

    </div>
  );
};

export default SkyboxGeneratorTab;
