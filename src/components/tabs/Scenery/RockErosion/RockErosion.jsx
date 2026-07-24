// ─── IMPORTS ────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useMemo } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './RockErosion.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibraryOverlay from '../../../Shared/Libraries/PropsLibrary/PropsLibrary';
import RockErosionHelpModal from '../../HelpModals/RockErosion_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, MirrorDropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  ensureDir, writeFile, nextPropsLuaName, kmLabel,
  usePersistentState, useMapInfo, useScmapPreview,
  loadImageChannel, sampleChannel, drawPlacementCanvas,
  useTerrainData, createTerrainSampler,
} from '../../../Shared/MapLogic';
import RockErosionConfiguration from './Configuration.jsx';
import RockErosionChannels from './Channels.jsx';
import RockErosionRules from './Rules.jsx';
import RockErosionExport from './Export.jsx';

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

const COORD_DECIMALS = 2;
const ROTATION_DECIMALS = 4;

const makeRule = () => ({
  id: Date.now() + Math.random(),
  name: '',
  color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
  blueprintPaths: [''],
  channelPrefs: {
    slope:     { mode: 'ignore', strength: 50 },
    flow:      { mode: 'ignore', strength: 50 },
    curvature: { mode: 'ignore', strength: 50 },
  },
  density: 100,
  diffusion: 0,
});

const availableColors = [
  { name: 'Amber',    color: '#FFAF00', glow: 'rgba(255,175,0,0.35)'   },
  { name: 'Orange',   color: '#FF7B00', glow: 'rgba(255,123,0,0.35)'   },
  { name: 'Yellow',   color: '#FFFA00', glow: 'rgba(255,250,0,0.35)'   },
  { name: 'Lime',     color: '#A5E801', glow: 'rgba(165,232,1,0.35)'   },
  { name: 'Moss',     color: '#538A33', glow: 'rgba(83,138,51,0.35)'   },
  { name: 'Violet',   color: '#8A12BD', glow: 'rgba(138,18,189,0.35)'  },
  { name: 'Cyan',     color: '#00DDFF', glow: 'rgba(0,221,255,0.35)'   },
  { name: 'Blue',     color: '#3B76FF', glow: 'rgba(59,118,255,0.35)'  },
  { name: 'Red',      color: '#FE1818', glow: 'rgba(254,24,24,0.35)'   },
  { name: 'Teal',     color: '#3EA387', glow: 'rgba(62,163,135,0.35)'  },
  { name: 'Green',    color: '#18C748', glow: 'rgba(24,199,72,0.35)'   },
  { name: 'White',    color: '#FFFFFF', glow: 'rgba(255,255,255,0.35)' },
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

const RockErosionTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  const [mapName,        setMapName]        = usePersistentState(s, 're_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath]  = usePersistentState(s, 're_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [mirrorMode,     setMirrorMode]      = usePersistentState(s, 're_mirrorMode', settings?.defaultMirrorMode ?? 'none', onSharedChange);
  const [gridResolution, setGridResolution]  = usePersistentState(s, 're_gridResolution', '128', onSharedChange);
  const [generateReadme, setGenerateReadme]  = usePersistentState(s, 're_generateReadme', settings?.generateReadme !== false, onSharedChange);
  const [exportRawLua,   setExportRawLua]    = usePersistentState(s, 're_exportRawLua', false, onSharedChange);
  const [rules,          setRules]           = usePersistentState(s, 're_rules', [makeRule()], onSharedChange);
  const [blueprintMassMap,   setBlueprintMassMap]   = usePersistentState(s, 're_blueprintMassMap', {}, onSharedChange);
  const [blueprintEnergyMap, setBlueprintEnergyMap] = usePersistentState(s, 're_blueprintEnergyMap', {}, onSharedChange);
  const [legendCollapsed, setLegendCollapsed] = usePersistentState(s, 're_legendCollapsed', false, onSharedChange);

  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('re_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // Real terrain elevation — same source as TreeMap. Markers get placed at
  // their actual in-game height, and the slope channel falls back to the
  // real heightmap gradient when no Gaea slope export has been uploaded.
  const { terrain, terrainError } = useTerrainData({ mapName, mapsFolderPath, settings });
  const terrainSampler = useMemo(() => createTerrainSampler(terrain), [terrain]);
  useEffect(() => {
    if (terrainError) console.warn('[RockErosion] Real terrain elevation unavailable, falling back to y=0:', terrainError);
  }, [terrainError]);

  // ─── SETTINGS SYNC ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)                setMapsFolderPath(settings.mapsFolder);
    if (settings.generateReadme != null)     setGenerateReadme(settings.generateReadme !== false);
    if (settings.defaultMirrorMode != null)  setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ─── UI STATE ────────────────────────────────────────────────────────────────
  const [selectedRule, setSelectedRule]     = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showLibrary, setShowLibrary]       = useState(null);
  const [seed, setSeed]                     = useState(Date.now());
  const [rockMarkers, setRockMarkers]       = useState([]);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, file: '' });
  const [activeSection, setActiveSection]   = useState('config');
  const [showHelp, setShowHelp]             = useState(false);
  const [activeHelpTab, setActiveHelpTab]   = useState('guide');
  const [helpSelected, setHelpSelected]     = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  // Erosion channels — Slope / Flow / Curvature / Deposition (gating + size),
  // each { dataURL, imageData, width, height, invert } or null. Heightmap is
  // separate — orientation only, no invert concept.
  const [channels, setChannels] = useState({ slope: null, flow: null, curvature: null, deposition: null });
  const [heightmap, setHeightmap] = useState(null);

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const mirrorModeRef = useRef(null);
  const fileInputRef = useRef(null);
  const mirrorModeValueRef = useRef(mirrorMode);
  useEffect(() => { mirrorModeValueRef.current = mirrorMode; }, [mirrorMode]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  const seededRandom = (seedVal) => {
    const x = Math.sin(seedVal) * 10000;
    return x - Math.floor(x);
  };

  const getBlueprintEconomy = (blueprintPath) => ({
    mass:   blueprintMassMap[blueprintPath]   ?? null,
    energy: blueprintEnergyMap[blueprintPath] ?? null,
  });

  const massToScale = (mass) => {
    const values = Object.values(blueprintMassMap).filter(v => v != null && v > 0);
    if (values.length === 0 || mass == null || mass <= 0) return 1;
    const sorted  = [...values].sort((a, b) => a - b);
    const median  = sorted[Math.floor(sorted.length / 2)];
    if (median === 0) return 1;
    const raw = Math.log(mass) / Math.log(median);
    return Math.max(0.5, Math.min(1.75, raw));
  };

  // Deposition/Sediment reading (0-1) → visual size. No artificial noise —
  // Gaea's real signal is read literally; size variety instead comes from
  // this plus whichever blueprint (with its own mass) got picked below.
  const getSizeFromDeposition = (value01) => 0.5 + value01 * 1.25;

  // Downslope orientation from the heightmap — unchanged concept from the
  // old tab, just resampled through the shared world→pixel mapping.
  const getDownslopeOrientation = (worldX, worldZ, mapSizeNum, rngFn) => {
    if (!heightmap?.imageData) return rngFn() * Math.PI * 2;
    const { imageData, width, height } = heightmap;
    const px = Math.min(width  - 1, Math.max(0, Math.round(((worldX - mapOffsetX) / mapSizeNum) * width)));
    const py = Math.min(height - 1, Math.max(0, Math.round(((worldZ - mapOffsetY) / mapSizeNum) * height)));
    const getH = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return imageData.data[(y * width + x) * 4];
    };
    const dx = (getH(px + 1, py) - getH(px - 1, py)) / 2;
    const dy = (getH(px, py + 1) - getH(px, py - 1)) / 2;
    const downslopeAngle = Math.atan2(-dy, -dx);
    const variation = (rngFn() - 0.5) * (Math.PI / 3);
    return downslopeAngle + Math.PI / 2 + variation;
  };

  // ─── PLACEMENT ALGORITHM ─────────────────────────────────────────────────────
  // One shared jittered world-space grid, one seeded RNG stream, read by every
  // rule — this is what makes rules spatially coherent with each other (the
  // old tab's Debris/Scree cards each sampled their own independent grid at
  // their own spawn-map's pixel resolution, so categories didn't actually
  // relate to one another spatially).

  const generateMarkers = () => {
    const mapSizeNum = parseFloat(mapSize) || 1024;
    const res = Math.max(1, parseInt(gridResolution || '128', 10));
    const cell = mapSizeNum / res;
    let rngSeed = seed;
    const rng = () => { rngSeed += 1; return seededRandom(rngSeed); };

    const factor = (pref, value) => {
      if (!pref || pref.mode === 'ignore' || value == null) return 1;
      const strength = Math.max(0, Math.min(100, parseFloat(pref.strength) || 0)) / 100;
      const directed = pref.mode === 'preferHigh' ? value : 1 - value;
      return (1 - strength) + directed * strength;
    };

    const markers = [];

    for (let gz = 0; gz < res; gz++) {
      for (let gx = 0; gx < res; gx++) {
        const worldX = mapOffsetX + (gx + rng()) * cell;
        const worldZ = mapOffsetY + (gz + rng()) * cell;

        // Prefer a manually-uploaded Gaea slope export when present; otherwise
        // fall back to the real heightmap gradient straight out of the .scmap,
        // so the slope preference works even without an external Gaea pass.
        const slopeVal       = channels.slope
          ? sampleChannel(channels.slope, worldX, worldZ, mapSizeNum, mapOffsetX, mapOffsetY, channels.slope?.invert)
          : (terrainSampler ? Math.min(1, terrainSampler.sampleSlopeDegrees(worldX, worldZ) / 90) : null);
        const flowVal       = sampleChannel(channels.flow,       worldX, worldZ, mapSizeNum, mapOffsetX, mapOffsetY, channels.flow?.invert);
        const curvatureVal  = sampleChannel(channels.curvature,  worldX, worldZ, mapSizeNum, mapOffsetX, mapOffsetY, channels.curvature?.invert);
        const depositionVal = sampleChannel(channels.deposition, worldX, worldZ, mapSizeNum, mapOffsetX, mapOffsetY, channels.deposition?.invert);

        for (const rule of rules) {
          const valid = rule.blueprintPaths.filter(p => p && p.trim());
          if (valid.length === 0) continue;

          const density = Math.max(0, Math.min(100, parseFloat(rule.density) || 0)) / 100;
          const prob = density
            * factor(rule.channelPrefs.slope, slopeVal)
            * factor(rule.channelPrefs.flow, flowVal)
            * factor(rule.channelPrefs.curvature, curvatureVal);

          if (rng() > Math.min(1, prob)) continue;

          const selectedSize = depositionVal != null
            ? getSizeFromDeposition(depositionVal)
            : 1;

          const blueprint = valid[Math.floor(rng() * valid.length)];
          const { mass, energy } = getBlueprintEconomy(blueprint);
          const combinedSize = selectedSize * massToScale(mass);

          const diffAmt = Math.max(0, Math.min(100, parseFloat(rule.diffusion) || 0)) / 100;
          let finalX = worldX, finalZ = worldZ;
          if (diffAmt > 0) {
            const rX = mapOffsetX + rng() * mapSizeNum;
            const rZ = mapOffsetY + rng() * mapSizeNum;
            finalX = worldX * (1 - diffAmt) + rX * diffAmt;
            finalZ = worldZ * (1 - diffAmt) + rZ * diffAmt;
          }

          const heading = getDownslopeOrientation(worldX, worldZ, mapSizeNum, rng);

          rngSeed += 1;
          markers.push({
            id: rngSeed, x: finalX, y: terrainSampler ? terrainSampler.sampleHeight(finalX, finalZ) : 0, z: finalZ, heading, blueprint,
            ruleId: rule.id, ruleName: rule.name, color: rule.color,
            size: combinedSize, mass, energy,
          });
        }
      }
    }

    // Mirror pass — ported unchanged from the old tab.
    const currentMirror = mirrorModeValueRef.current;
    if (currentMirror !== 'none') {
      const baseMarkers = [...markers];
      baseMarkers.forEach(m => {
        let mx, mz, mHeading;
        switch (currentMirror) {
          case 'diagonal':
            mx = (2 * mapOffsetX + mapSizeNum) - m.x;
            mz = (2 * mapOffsetY + mapSizeNum) - m.z;
            mHeading = -m.heading;
            break;
          case 'horizontal':
            mx = m.x;
            mz = (2 * mapOffsetY + mapSizeNum) - m.z;
            mHeading = -m.heading;
            break;
          case 'vertical':
            mx = (2 * mapOffsetX + mapSizeNum) - m.x;
            mz = m.z;
            mHeading = Math.PI - m.heading;
            break;
          default:
            return;
        }
        mHeading = ((mHeading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const my = terrainSampler ? terrainSampler.sampleHeight(mx, mz) : m.y;
        markers.push({ ...m, id: m.id + 0.5, x: mx, y: my, z: mz, heading: mHeading, isMirrored: true });
      });
    }

    setRockMarkers(markers);
  };

  useEffect(() => {
    generateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, channels, heightmap, seed, gridResolution, mapSize, mapOffsetX, mapOffsetY, mirrorMode, terrainSampler]);

  const handleRandomize = () => setSeed(Date.now());

  // ─── CHANNEL UPLOADS ─────────────────────────────────────────────────────────

  const onChannelUpload = async (key, file) => {
    try {
      const loaded = await loadImageChannel(file);
      setChannels(prev => ({ ...prev, [key]: { ...loaded, invert: false } }));
    } catch (err) {
      await luxuryAlert(`Failed to load ${key} channel: ${err.message}`, 'Error', 'error');
    }
  };
  const onChannelClear = (key) => setChannels(prev => ({ ...prev, [key]: null }));
  const onToggleInvert = (key) => setChannels(prev => ({
    ...prev, [key]: prev[key] ? { ...prev[key], invert: !prev[key].invert } : prev[key],
  }));
  const hasChannel = (key) => !!channels[key];

  const onHeightmapUpload = async (file) => {
    try {
      const loaded = await loadImageChannel(file);
      setHeightmap(loaded);
    } catch (err) {
      await luxuryAlert(`Failed to load heightmap: ${err.message}`, 'Error', 'error');
    }
  };
  const onHeightmapClear = () => setHeightmap(null);

  // ─── RULE MANAGEMENT ─────────────────────────────────────────────────────────

  const addRule = () => {
    setRules(prev => [...prev, makeRule()]);
    setSelectedRule(rules.length);
  };

  const deleteAllRules = async () => {
    const confirmed = await luxuryConfirm('Delete all placement rules?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setRules([makeRule()]);
    setSelectedRule(0);
  };

  const deleteRule = (index) => {
    setRules(prev => prev.length === 1 ? [makeRule()] : prev.filter((_, i) => i !== index));
    setSelectedRule(prev => Math.max(0, prev >= index ? prev - 1 : prev));
  };

  const updateRule = (index, field, value) => {
    setRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const updateChannelPref = (index, channelKey, next) => {
    setRules(prev => prev.map((r, i) => i === index
      ? { ...r, channelPrefs: { ...r.channelPrefs, [channelKey]: next } }
      : r));
  };

  const updateBlueprintPath = (index, pathIndex, value) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const paths = [...r.blueprintPaths];
      paths[pathIndex] = value;
      const last = paths[paths.length - 1];
      if (last && last.trim() !== '') paths.push('');
      return { ...r, blueprintPaths: paths };
    }));
  };

  const deleteBlueprintPath = (index, pathIndex) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const paths = r.blueprintPaths.length === 1 ? [''] : r.blueprintPaths.filter((_, j) => j !== pathIndex);
      return { ...r, blueprintPaths: paths };
    }));
  };

  // ─── LIBRARY ─────────────────────────────────────────────────────────────────

  const handlePropsLibraryConfirm = (selectedProps) => {
    const index = showLibrary;
    if (index == null) return;
    const newMassMap   = { ...blueprintMassMap };
    const newEnergyMap = { ...blueprintEnergyMap };
    selectedProps.forEach(prop => {
      const gp = prop.gamePath || prop.id;
      if (gp && prop.reclaimMass   != null) newMassMap[gp]   = prop.reclaimMass;
      if (gp && prop.reclaimEnergy != null) newEnergyMap[gp] = prop.reclaimEnergy;
    });
    setBlueprintMassMap(newMassMap);
    setBlueprintEnergyMap(newEnergyMap);

    setRules(prev => prev.map((r, i) => {
      if (i !== index) return r;
      let paths = r.blueprintPaths.filter(p => p.trim());
      selectedProps.forEach(prop => {
        const gamePath = prop.gamePath || prop.id;
        if (gamePath && !paths.includes(gamePath)) paths.push(gamePath);
      });
      if (!paths.some(p => !p)) paths.push('');
      return { ...r, blueprintPaths: paths };
    }));
    setShowLibrary(null);
  };

  // ─── IMAGE UPLOAD (map preview) ──────────────────────────────────────────────

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result;
      if (typeof imageData === 'string') {
        localStorage.setItem('shared_preview_image', imageData);
        setPreviewImageData(imageData);
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── CANVAS DRAW ─────────────────────────────────────────────────────────────
  // Background/grid/mirror-lines reuse the shared renderer; the rock markers
  // themselves are drawn as a cheap flat-dot pass (there can be thousands of
  // them — the shared per-entity glow style used for hand-placed points would
  // tank performance and turn into a solid blob at this density).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const mapSizeNum = parseFloat(mapSize) || 1024;

    drawPlacementCanvas(ctx, {
      width: canvas.width, height: canvas.height,
      mapSize: mapSizeNum, mapOffsetX, mapOffsetY,
      previewImage, mirrorMode,
      entities: [], selectedIdx: -1,
      getColor: () => '', getCoords: () => [],
    });

    rockMarkers.forEach(marker => {
      const x = ((marker.x - mapOffsetX) / mapSizeNum) * canvas.width;
      const z = ((marker.z - mapOffsetY) / mapSizeNum) * canvas.height;
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.fill();
    });
  }, [rockMarkers, previewImage, mapSize, mirrorMode, mapOffsetX, mapOffsetY]);

  // ─── LUA BUILDER ─────────────────────────────────────────────────────────────

  const buildPropLuaChunk = (markers) => {
    let lua = 'return {\n';
    for (const marker of markers) {
      const h = marker.heading;
      const cosH = Math.cos(h).toFixed(ROTATION_DECIMALS);
      const sinH = Math.sin(h).toFixed(ROTATION_DECIMALS);
      const negSinH = (-Math.sin(h)).toFixed(ROTATION_DECIMALS);
      const x = marker.x.toFixed(COORD_DECIMALS);
      const y = (marker.y || 0).toFixed(COORD_DECIMALS);
      const z = marker.z.toFixed(COORD_DECIMALS);
      const s = (marker.size != null ? marker.size : 1).toFixed(ROTATION_DECIMALS);
      lua += `    {\n`;
      lua += `        path = "${marker.blueprint}",\n`;
      lua += `        position = {\n            ${x},\n            ${y},\n            ${z},\n        },\n`;
      lua += `        rotationX = {\n            ${cosH},\n            0,\n            ${negSinH},\n        },\n`;
      lua += `        rotationY = {\n            0,\n            1,\n            0,\n        },\n`;
      lua += `        rotationZ = {\n            ${sinH},\n            0,\n            ${cosH},\n        },\n`;
      lua += `        scale = {\n            ${s},\n            ${s},\n            ${s},\n        },\n`;
      lua += `    },\n`;
    }
    lua += '}\n';
    return lua;
  };

  const listDir = async (dirPath) => {
    const res = await window.electronAPI.invoke('list-dir', { dirPath });
    if (!res?.success) throw new Error(res?.error || 'list-dir failed');
    return res.entries;
  };

  // ─── FILE GENERATION ─────────────────────────────────────────────────────────
  // Chunked manually (rather than one injectPropsLua() call per chunk) because
  // a full-map procedural scatter can produce many thousands of markers —
  // unpacking/repacking the .scmap once per chunk would be wasteful.

  const generateFiles = async () => {
    const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!mapsFolder) { await luxuryAlert('Please configure the Maps Folder in Settings first.'); return; }
    if (!mapName) { await luxuryAlert('Please enter a map name.'); return; }
    if (rockMarkers.length === 0) { await luxuryAlert('No rocks generated. Add a Placement Rule with blueprint paths first.'); return; }

    let finalMapName = mapName.trim();
    if (!finalMapName.match(/\.v\d{4}$/)) finalMapName += '.v0001';

    setIsGenerating(true);
    try {
      const mapFolderPath = `${mapsFolder}\\${finalMapName}`;
      await ensureDir(mapFolderPath);

      const markersByBlueprint = {};
      rockMarkers.forEach(marker => {
        if (!markersByBlueprint[marker.blueprint]) {
          markersByBlueprint[marker.blueprint] = { markers: [], ruleName: marker.ruleName };
        }
        markersByBlueprint[marker.blueprint].markers.push(marker);
      });

      const CHUNK_SIZE = 5000;
      const total = rockMarkers.length;
      const entries = await listDir(mapFolderPath);
      const firstName = nextPropsLuaName(entries);
      const startIndex = firstName === 'props.lua' ? 0 : parseInt(firstName.match(/^props(\d+)\.lua$/)?.[1] || '0', 10) - 1;

      let writtenFiles = [];
      const chunks = [];
      for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(rockMarkers.slice(i, i + CHUNK_SIZE));

      let unpackedFolder = null;
      let scmapPath = null;
      let scmapEntryName = null;
      let snapBefore = null;

      if (!exportRawLua) {
        setGenerationProgress({ current: 1, total: chunks.length + 2, file: 'Locating .scmap...' });
        const scmapEntry = entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
        if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath}`);
        scmapEntryName = scmapEntry.name;
        scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

        setGenerationProgress({ current: 1, total: chunks.length + 2, file: `Unpacking ${scmapEntry.name}...` });
        const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
        if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
        unpackedFolder = unpackRes.outputFolder;

        const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
        snapBefore = snapBeforeRes?.snapshot ?? null;
      }

      for (let i = 0; i < chunks.length; i++) {
        const fileName = startIndex === 0 && i === 0 ? 'props.lua' : `props${startIndex + i + 1}.lua`;
        setGenerationProgress({ current: i + 1, total: chunks.length + (exportRawLua ? 0 : 2), file: `Writing ${fileName}...` });
        const destDir = exportRawLua ? mapFolderPath : unpackedFolder;
        await writeFile(`${destDir}\\${fileName}`, buildPropLuaChunk(chunks[i]));
        writtenFiles.push(fileName);
      }

      if (!exportRawLua) {
        const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
        const snapAfter = snapAfterRes?.snapshot ?? null;
        if (snapBefore && snapAfter) onRecordSnapshot('rockerosion', finalMapName, snapBefore, snapAfter);

        setGenerationProgress({ current: chunks.length + 1, total: chunks.length + 2, file: `Repacking ${scmapEntryName}...` });
        const mapNameForPack = unpackedFolder.split(/[\\/]/).pop();
        const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
        if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);
        const copyBackRes = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
        if (!copyBackRes?.success) throw new Error('Failed to copy repacked .scmap back');
      }

      if (generateReadme) {
        const byRuleName = {};
        Object.entries(markersByBlueprint).forEach(([bp, data]) => {
          const name = data.ruleName || 'Unnamed';
          if (!byRuleName[name]) byRuleName[name] = [];
          byRuleName[name].push({ bp, count: data.markers.length });
        });
        const propTable = [];
        Object.keys(byRuleName).sort().forEach(name => {
          const ruleEntries = byRuleName[name];
          const totalCount = ruleEntries.reduce((sum, e) => sum + e.count, 0);
          propTable.push(`  ${name.padEnd(25)} ${String(totalCount).padStart(6)}`);
          ruleEntries.forEach(({ bp, count }) => propTable.push(`    ${String(count).padStart(6)}  ${bp}`));
          propTable.push(`  ${'-'.repeat(80)}`);
        });
        const readmeContent = buildReadme({
          tool: 'Rock Erosion Tab',
          mapName: finalMapName,
          mapSize: `${mapSize} × ${mapSize} (${kmLabel(mapSize)} km)`,
          sections: [
            { title: 'OUTPUT SUMMARY', entries: [
              ['Total Rocks', total],
              ['Mode', exportRawLua ? 'props.lua (written to map folder, no SCMAP)' : 'SCMAP (props injected directly)'],
              ['Files', writtenFiles.join(', ')],
            ]},
            { title: 'RULE BREAKDOWN', lines: [
              `  ${'Rule Name'.padEnd(25)} ${'Count'.padStart(6)}`,
              `  ${'─'.repeat(50)}`,
              ...propTable,
              `  ${'─'.repeat(50)}`,
            ]},
          ],
        });
        await writeReadme(`${mapFolderPath}\\RockErosion_Generation_README.txt`, readmeContent);
      }

      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      await luxuryAlert(
        exportRawLua
          ? `✓ ${total} rocks written to map folder (${writtenFiles.join(', ')}) — SCMAP not modified.`
          : `✓ ${total} rocks injected into ${scmapEntryName} successfully!`,
        'Generation Complete', 'success'
      );
    } catch (error) {
      await luxuryAlert('Error: ' + error.message, 'Error', 'error');
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ current: 0, total: 0, file: '' });
    }
  };

  // ─── SECTION PROPS ───────────────────────────────────────────────────────────

  const configProps = {
    mapName, setMapName, mapInfo,
    gridResolution, setGridResolution,
    onRandomize: handleRandomize,
  };

  const channelsProps = {
    channels, onChannelUpload, onChannelClear, onToggleInvert,
    heightmap, onHeightmapUpload, onHeightmapClear,
  };

  const rulesProps = {
    rules, selectedRule, setSelectedRule,
    availableColors, showColorPicker, setShowColorPicker,
    hasChannel,
    deleteAllRules, addRule, deleteRule, updateRule, updateChannelPref,
    updateBlueprintPath, deleteBlueprintPath,
    onOpenBlueprintLibrary: (index) => setShowLibrary(index),
  };

  const exportProps = {
    isReady: rules.some(r => r.blueprintPaths.some(p => p.trim())),
    generateFiles,
    generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
  };

  const sectionContent = {
    config:   <RockErosionConfiguration {...configProps} />,
    channels: <RockErosionChannels {...channelsProps} />,
    rules:    <RockErosionRules {...rulesProps} />,
    export:   <RockErosionExport {...exportProps} />,
  };

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      onUploadClick={() => fileInputRef.current?.click()}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      controls={<MirrorDropdown value={mirrorMode} onChange={setMirrorMode} triggerRef={mirrorModeRef} />}
      subtitle="Map Preview"
      canvasRef={canvasRef}
      containerRef={canvasContainerRef}
      markers={[]}
      onMarkerDelete={() => {}}
      legendTitle="Rule Legend"
      legendRows={rules.map(rule => {
        const ruleMarkers = rockMarkers.filter(m => m.ruleId === rule.id);
        const totalMass   = ruleMarkers.reduce((sum, m) => sum + (m.mass   || 0), 0);
        const totalEnergy = ruleMarkers.reduce((sum, m) => sum + (m.energy || 0), 0);
        return {
          id: rule.id,
          color: rule.color,
          label: rule.name || 'Unnamed Rule',
          pts: ruleMarkers.length,
          meta: (totalMass || totalEnergy)
            ? `${totalMass.toLocaleString()} M · ${totalEnergy.toLocaleString()} E`
            : undefined,
        };
      })}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      selectedLegendId={rules[selectedRule]?.id}
      onLegendSelect={(id, idx) => setSelectedRule(idx)}
      hint={isGenerating
        ? `${generationProgress.file} (${generationProgress.current}/${generationProgress.total})`
        : `${rockMarkers.length} rocks · ${mirrorMode !== 'none' ? `${mirrorMode} mirror active` : 'no mirror'}`}
    />
  );

  return (
    <div className="rockerosion-tab trace-tab">
      {showLibrary !== null && (
        <PropsLibraryOverlay
          mapName={mapName}
          mapsFolder={mapsFolderPath}
          onConfirm={handlePropsLibraryConfirm}
          onClose={() => setShowLibrary(null)}
          accentColor="var(--rockerosion-color)"
          accentGlow="var(--rockerosion-glow)"
        />
      )}

      {showLibrary === null && (
        <button className="help-btn" onClick={() => setShowHelp(true)} title="Help">?</button>
      )}

      {showHelp && (
        <RockErosionHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

      <TabLayout
        sections={[
          { id: 'config',   index: '01', label: 'Configuration',   desc: 'Set the map name, grid resolution and size variance.', done: !!mapName.trim() },
          { id: 'channels', index: '02', label: 'Erosion Channels', desc: "Upload Gaea's slope, flow, curvature, deposition and heightmap exports.", done: Object.values(channels).some(Boolean) },
          { id: 'rules',    index: '03', label: 'Placement Rules',  desc: 'Define named rules — each a channel preference + blueprint pool.', count: rockMarkers.length, done: rules.some(r => r.blueprintPaths.some(p => p.trim())) },
          { id: 'export',   index: '04', label: 'Export',          desc: 'Generate rock props and inject them into the .scmap.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="EROSION"
        navLabel="Rock Erosion console navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>
    </div>
  );
};

export default RockErosionTab;
