import React, { useState, useRef, useEffect } from 'react';

// ── Styles ────────────────────────────────────────────────────────────────────
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './Emitter.css';

// ── Shared UI ─────────────────────────────────────────────────────────────────
import TabLayout                              from '../../../Shared/Ui/TabLayout/TabLayout.jsx';
import { MapPreview } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

// ── Libraries ─────────────────────────────────────────────────────────────────
import EmitterLibraryOverlay from '../../../Shared/Libraries/EmitterLibrary/EmitterLibrary.jsx';

// ── Map Logic ─────────────────────────────────────────────────────────────────
import {
  getMirroredCoords, kmLabel,
  ensureDir, writeFile, injectPropsLua,
  resolveToolkitEmitterPublicPaths, drawPlacementCanvas,
  usePersistentState, useMapInfo, useScmapPreview,
} from '../../../Shared/MapLogic';

// ── Utilities ─────────────────────────────────────────────────────────────────
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import { luxuryAlert, luxuryConfirm }                from '../../../Shared/Ui/Notifications/notifications';

// ── Help ──────────────────────────────────────────────────────────────────────
import EmitterHelpModal from '../../HelpModals/Emitter_help.jsx';

// ── Sections ──────────────────────────────────────────────────────────────────
import EmitterConfiguration from './Configuration.jsx';
import EmitterEmitters      from './Emitters.jsx';
import EmitterExport        from './Export.jsx';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_RANDOMNESS = { poissonRadius: 0 };

const makeEmitterCard = () => ({
  id:           Date.now() + Math.random(),
  label:        '',
  coordinates:  [],
  gridStepX:    '',
  gridStepZ:    '',
  color:        `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
  cardEmitters: [],
});

// ── Grid Generator (Poisson Disk Sampling) ────────────────────────────────────

const generateGridCoords = (stepX, stepZ, mapSize, mirrorMode, rand, maskImageData, maskWidth, maskHeight, maskScanMode = 'right') => {
  const ms  = parseFloat(mapSize) || 1024;
  const sx  = parseFloat(stepX), sz = parseFloat(stepZ);
  if (!sx || !sz || sx <= 0 || sz <= 0) return [];

  const radius = parseFloat(rand?.poissonRadius) || 0;

  const candidates = [];
  for (let gx = 0; gx < ms; gx += sx) {
    for (let gz = 0; gz < ms; gz += sz) {
      if (radius > 0) {
        const angle = Math.random() * 2 * Math.PI;
        const dist  = Math.random() * radius;
        candidates.push({ x: gx + Math.cos(angle) * dist, z: gz + Math.sin(angle) * dist });
      } else {
        candidates.push({ x: gx, z: gz });
      }
    }
  }

  const accepted = [];
  const cellSize = radius > 0 ? radius / Math.SQRT2 : 1;
  const gridW    = Math.ceil(ms / cellSize);
  const gridH    = Math.ceil(ms / cellSize);
  const grid     = new Array(gridW * gridH).fill(null);

  const gridKey  = (px, pz) => {
    const col = Math.floor(px / cellSize);
    const row = Math.floor(pz / cellSize);
    return row * gridW + col;
  };

  const tooClose = (px, pz) => {
    if (radius <= 0) return false;
    const col0 = Math.max(0, Math.floor(px / cellSize) - 2);
    const col1 = Math.min(gridW - 1, Math.floor(px / cellSize) + 2);
    const row0 = Math.max(0, Math.floor(pz / cellSize) - 2);
    const row1 = Math.min(gridH - 1, Math.floor(pz / cellSize) + 2);
    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        const pt = grid[r * gridW + c];
        if (pt && Math.hypot(pt.x - px, pt.z - pz) < radius) return true;
      }
    }
    return false;
  };

  for (const cand of candidates) {
    let rx = Math.max(0, Math.min(ms - 0.01, cand.x));
    let rz = Math.max(0, Math.min(ms - 0.01, cand.z));

    if (tooClose(rx, rz)) continue;

    if (maskImageData && maskWidth && maskHeight) {
      const bright = (testX) => {
        const px = Math.min(maskWidth  - 1, Math.floor((testX / ms) * maskWidth));
        const pz = Math.min(maskHeight - 1, Math.floor((rz    / ms) * maskHeight));
        const i  = (pz * maskWidth + px) * 4;
        return (maskImageData[i] + maskImageData[i + 1] + maskImageData[i + 2]) / 3;
      };
      if (maskScanMode === 'ignore') {
        if (bright(rx) <= 127) continue;
      } else if (maskScanMode === 'right') {
        let scanX = rx;
        while (scanX < ms) { if (bright(scanX) > 127) break; scanX += 1; }
        if (scanX >= ms) continue;
        rx = scanX;
      } else {
        let scanX = rx;
        while (scanX >= 0) { if (bright(scanX) > 127) break; scanX -= 1; }
        if (scanX < 0) continue;
        rx = scanX;
      }
    }

    grid[gridKey(rx, rz)] = { x: rx, z: rz };
    accepted.push({ x: rx, z: rz });
  }

  const coords = [];
  for (const pt of accepted) {
    const pairId = mirrorMode !== 'none' ? `g_${pt.x}_${pt.z}_${Date.now()}_${Math.random()}` : null;
    coords.push({ x: pt.x.toFixed(2), z: pt.z.toFixed(2), isMirrored: false, mirrorPairId: pairId });
    if (mirrorMode !== 'none') {
      const m = getMirroredCoords(pt.x, pt.z, ms, mirrorMode, 0);
      if (m) coords.push({ x: m.x.toFixed(2), z: m.z.toFixed(2), isMirrored: true, mirrorPairId: pairId });
    }
  }
  return coords;
};

// ── Component ─────────────────────────────────────────────────────────────────

const EmitterTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  // ── Shared State ──────────────────────────────────────────────────────────────

  const [mapName,             setMapName]             = usePersistentState(s, 'em_mapName', '', onSharedChange);
  const [mapsFolderPath,      setMapsFolderPath]      = usePersistentState(s, 'em_mapsFolderPath', '', onSharedChange);
  const [mirrorMode,          setMirrorMode]          = usePersistentState(s, 'em_mirrorMode', settings?.defaultMirrorMode ?? 'diagonal', onSharedChange);
  const [globalRandomness,    setGlobalRandomness]    = usePersistentState(s, 'em_globalRandomness', { ...DEFAULT_RANDOMNESS }, onSharedChange);
  const [emitterCards,        setEmitterCards]        = usePersistentState(s, 'em_emitterCards', [makeEmitterCard()], onSharedChange);
  const [emitterPaths,        setEmitterPaths]        = usePersistentState(s, 'em_emitterPaths', [''], onSharedChange);
  const [emitterPublicPaths,  setEmitterPublicPaths]  = usePersistentState(s, 'em_emitterPublicPaths', {}, onSharedChange);
  const [generateReadme,      setGenerateReadme]      = usePersistentState(s, 'em_generateReadme', settings?.generateReadme !== false, onSharedChange);
  const [exportRawLua,        setExportRawLua]        = usePersistentState(s, 'em_exportRawLua', false, onSharedChange);
  const [activeSection,       setActiveSection]       = useState('config');

  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('em_mapSize', v),
  });

  // ── Settings Sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)     setMapsFolderPath(settings.mapsFolder);
    if (settings.generateReadme != null) setGenerateReadme(settings.generateReadme !== false);
    if (settings.defaultMirrorMode != null) setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ── Local UI State ────────────────────────────────────────────────────────────

  const [selectedCard,       setSelectedCard]       = useState(0);
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [showColorPicker,    setShowColorPicker]    = useState(null);
  const [coordsOpen,         setCoordsOpen]         = useState({});
  const [maskScanMode,       setMaskScanMode]       = useState('right');
  const [maskImageData,      setMaskImageData]      = useState(null);
  const [maskWidth,          setMaskWidth]          = useState(0);
  const [maskHeight,         setMaskHeight]         = useState(0);
  const [maskPreviewUrl,     setMaskPreviewUrl]     = useState(null);
  const maskFileInputRef = useRef(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const [activeHelpTab,      setActiveHelpTab]      = useState('emittertab');
  const [emitterHelpSelected, setEmitterHelpSelected] = useState(null);
  const [activeAdvSubTab,    setActiveAdvSubTab]    = useState('workflow');

  const canvasRef    = useRef(null);
  const fileInputRef = useRef(null);
  const mirrorRef    = useRef(mirrorMode);
  useEffect(() => { mirrorRef.current = mirrorMode; }, [mirrorMode]);
  const mapNameRef = useRef(mapName);
  useEffect(() => { mapNameRef.current = mapName; }, [mapName]);

  const markers = emitterCards.flatMap((card, ci) =>
    card.coordinates
      .filter(coord => coord.x && coord.z)
      .map((coord, coordIdx) => {
        const actualIdx = card.coordinates.indexOf(coord);
        const ms = parseFloat(mapSize) || 1024;
        return {
          id:         `${card.id}-${coordIdx}`,
          x:          ((parseFloat(coord.x) - mapOffsetX) / ms) * 100,
          z:          ((parseFloat(coord.z) - mapOffsetY) / ms) * 100,
          color:      card.color,
          label:      card.label || `Card ${ci + 1}`,
          isSelected: ci === selectedCard,
          isMirrored: coord.isMirrored,
          entityIdx:  ci,
          coordIdx:   actualIdx,
        };
      })
  );

  // ── Canvas Draw ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPlacementCanvas(ctx, {
      width: 1024, height: 1024,
      mapSize: parseFloat(mapSize) || 1024,
      mapOffsetX, mapOffsetY,
      previewImage, mirrorMode,
      entities: emitterCards, selectedIdx: selectedCard,
      getColor: card => card.color,
      getCoords: card => card.coordinates,
    });
  }, [emitterCards, selectedCard, previewImage, mapSize, mirrorMode, mapOffsetX, mapOffsetY]);

  // ── Canvas Click ──────────────────────────────────────────────────────────────

  const handleCanvasClick = (e) => {
    if (selectedCard < 0 || selectedCard >= emitterCards.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const ms     = parseFloat(mapSize) || 1024;
    const worldX = ((e.clientX - rect.left)  / rect.width)  * ms + mapOffsetX;
    const worldZ = ((e.clientY - rect.top)   / rect.height) * ms + mapOffsetY;
    const tol    = 10 * (ms / 1024);
    const card   = emitterCards[selectedCard];

    let hitIdx = -1;
    for (let i = 0; i < card.coordinates.length; i++) {
      const c = card.coordinates[i];
      if (c.x && c.z && Math.hypot(worldX - parseFloat(c.x), worldZ - parseFloat(c.z)) <= tol) {
        hitIdx = i; break;
      }
    }
    if (hitIdx !== -1) { deleteCoordinate(selectedCard, hitIdx); return; }

    const pairId    = mirrorMode !== 'none' ? `m_${Date.now()}_${Math.random()}` : null;
    const newCoords = [...card.coordinates, { x: worldX.toFixed(2), z: worldZ.toFixed(2), isMirrored: false, mirrorPairId: pairId }];
    if (mirrorMode !== 'none') {
      const m = getMirroredCoords(worldX, worldZ, ms, mirrorMode, mapOffsetX);
      if (m) newCoords.push({ x: m.x.toFixed(2), z: m.z.toFixed(2), isMirrored: true, mirrorPairId: pairId });
    }
    setEmitterCards(prev => prev.map((c, i) => i === selectedCard ? { ...c, coordinates: newCoords } : c));
  };

  // ── Coordinate CRUD ───────────────────────────────────────────────────────────

  const deleteCoordinate = (ci, coordIdx) => {
    setEmitterCards(prev => prev.map((card, i) => {
      if (i !== ci) return card;
      const coord = card.coordinates[coordIdx];
      let nc = [...card.coordinates];
      if (coord.mirrorPairId) {
        const mi = nc.findIndex((c, j) => j !== coordIdx && c.mirrorPairId === coord.mirrorPairId);
        [coordIdx, mi !== -1 ? mi : -1]
          .filter(j => j >= 0)
          .sort((a, b) => b - a)
          .forEach(j => nc.splice(j, 1));
      } else {
        nc.splice(coordIdx, 1);
      }
      return { ...card, coordinates: nc };
    }));
  };

  const updateCoordinate = (ci, coordIdx, field, value) => {
    setEmitterCards(prev => prev.map((card, i) =>
      i !== ci ? card : {
        ...card,
        coordinates: card.coordinates.map((c, j) => j === coordIdx ? { ...c, [field]: value } : c)
      }
    ));
  };

  const addManualCoordinate = (ci) => {
    setEmitterCards(prev => prev.map((card, i) =>
      i !== ci ? card : {
        ...card,
        coordinates: [...card.coordinates, { x: '', z: '', isMirrored: false, mirrorPairId: null }]
      }
    ));
  };

  const clearCoordinates = (ci) => {
    setEmitterCards(prev => prev.map((c, i) => i !== ci ? c : { ...c, coordinates: [] }));
  };

  // ── Card CRUD ─────────────────────────────────────────────────────────────────

  const addEmitterCard = () => {
    const card = makeEmitterCard();
    setEmitterCards(prev => [...prev, card]);
    setSelectedCard(emitterCards.length);
  };

  const deleteAllEmitterCards = async () => {
    const confirmed = await luxuryConfirm('Delete all emitter cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setEmitterCards([makeEmitterCard()]);
    setSelectedCard(0);
  };

  const deleteEmitterCard = (idx) => {
    setEmitterCards(prev => prev.length === 1 ? [makeEmitterCard()] : prev.filter((_, i) => i !== idx));
    setSelectedCard(c => Math.max(0, c >= idx ? c - 1 : c));
  };

  const updateCard = (idx, field, value) => {
    setEmitterCards(prev => prev.map((c, i) => i !== idx ? c : { ...c, [field]: value }));
  };

  // ── Emitter Paths ─────────────────────────────────────────────────────────────

  const addEmitterPath = () => setEmitterPaths(prev => [...prev, '']);

  const updateEmitterPath = (pi, value) => {
    setEmitterPaths(prev => prev.map((p, j) => j === pi ? value : p));
  };

  const resolveEmitterPath = (pi, value) => {
    if (!value.trim().toLowerCase().endsWith('_prop.bp')) return;
    window.electronAPI.invoke('resolve-prop-to-emit', { propGamePath: value.trim() }).then(res => {
      if (res?.success && res.emitPath) {
        setEmitterPaths(prev => prev.map((p, j) => j === pi ? res.emitPath : p));
      }
    });
  };

  const deleteEmitterPath = (pi) => {
    setEmitterPaths(prev => {
      if (prev.length === 1) return [''];
      return prev.filter((_, j) => j !== pi);
    });
  };

  // ── Card Emitter Toggles ──────────────────────────────────────────────────────

  const toggleCardEmitter = (cardIdx, path) => {
    setEmitterCards(prev => prev.map((c, i) => {
      if (i !== cardIdx) return c;
      const active = (c.cardEmitters || []).includes(path);
      return {
        ...c,
        cardEmitters: active
          ? c.cardEmitters.filter(p => p !== path)
          : [...(c.cardEmitters || []), path],
      };
    }));
  };

  const getEmitterNameFromPath = (path) =>
    path.replace(/\\/g, '/').split('/').pop().replace(/_emit\.bp$/i, '').replace(/_prop\.bp$/i, '');

  // ── Generate ──────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert('Maps folder is not configured. Please set the Maps Folder in settings.');
      return;
    }
    const name = mapName?.trim();
    if (!name) {
      await luxuryAlert('Please enter a Map Name before generating.', 'Missing Map Name', 'warning');
      return;
    }

    const validCards = emitterCards.filter(card => card.coordinates.some(c => c.x && c.z));
    if (validCards.length === 0) {
      await luxuryAlert('No emitter cards with coordinates found.', 'Nothing to Generate', 'warning');
      return;
    }
    if (!emitterPaths.some(p => p.trim())) {
      await luxuryAlert('No emitter paths configured. Add at least one emitter path in the Configuration section.', 'Missing Emitter Paths', 'warning');
      return;
    }

    const propBpPaths = emitterPaths.filter(p => p.trim().toLowerCase().endsWith('_prop.bp'));
    if (propBpPaths.length > 0) {
      const confirmed = await luxuryConfirm(
        `${propBpPaths.length} emitter path(s) end in _prop.bp:\n\n${propBpPaths.slice(0, 3).join('\n')}${propBpPaths.length > 3 ? `\n…and ${propBpPaths.length - 3} more` : ''}\n\nCreateEmitterAtBone requires a _emit.bp effect path, not a prop wrapper. The emitters will likely not appear in-game.\n\nDo you want to continue anyway?`,
        '_prop.bp paths detected',
        'warning'
      );
      if (!confirmed) return;
    }

    const finalMapName = name.match(/\.v\d{4}$/) ? name : name + '.v0001';
    const mapFolderPath = `${mapsFolder}\\${finalMapName}`;

    setIsGenerating(true);

    try {
      await ensureDir(mapFolderPath);

      const emitterDestDir = `${mapFolderPath}\\env\\props\\emitter`;
      await ensureDir(emitterDestDir);

      const resolvedPublicPaths = await resolveToolkitEmitterPublicPaths({
        paths: emitterPaths, knownPublic: emitterPublicPaths,
        mapsFolder, mapName: finalMapName,
      });

      for (const rawPath of emitterPaths.filter(p => p.trim())) {
        const srcAbsolute = resolvedPublicPaths[rawPath];
        if (!srcAbsolute) continue;
        const bpFileName = rawPath.replace(/\\/g, '/').split('/').pop();
        const dest       = `${emitterDestDir}\\${bpFileName}`;
        await window.electronAPI.invoke('copy-file', { src: srcAbsolute, dest });
      }

      const propsLuaEntries = [];

      for (const card of validCards) {
        const coords   = card.coordinates.filter(c => c.x && c.z);
        const rawPaths = (card.cardEmitters?.length > 0 ? card.cardEmitters : emitterPaths).filter(p => p.trim());
        if (coords.length === 0 || rawPaths.length === 0) continue;

        const cardLabel = (card.label || 'emitter')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '');

        const cardDirPath = `${mapFolderPath}\\env\\props\\emitter\\plain\\${cardLabel}`;
        await ensureDir(cardDirPath);

        const emitterPropPaths = [];

        for (let ei = 0; ei < rawPaths.length; ei++) {
          const emitterNumber = String(ei + 1).padStart(2, '0');
          const pairDirPath   = `${cardDirPath}\\emitter_${emitterNumber}`;
          await ensureDir(pairDirPath);

          let emitterPath = rawPaths[ei];
          if (!emitterPath.startsWith('/maps/') &&
              !emitterPath.startsWith('/effects/') &&
              !emitterPath.startsWith('/env/')) {
            const bpFileName = emitterPath.replace(/\\/g, '/').split('/').pop();
            emitterPath = `/maps/${finalMapName}/env/props/emitter/${bpFileName}`;
          }

          const pairName    = `${cardLabel}_emitter_${emitterNumber}`;
          const propContent =
`PropBlueprint {
    Display = {
        Mesh = {
            IconFadeInZoom = 4,
            LODs = {
                {
                    AlbedoName = '/env/common/props/marker01_albedo.dds',
                    MeshName = '/env/common/props/marker01_lod0.scm',
                    ShaderName = 'TMeshNoNormals',
                },
            },
        },
        UniformScale = 0,
    },
    Economy = {
        ReclaimEnergyMax = 0,
        ReclaimMassMax = 0,
    },
    Interface = {
        HelpText = '${pairName}',
    },
    Physics = {
        BlockPath = false,
    },
    SizeX = 1,
    SizeY = 1,
    SizeZ = 1,
}`;

          const scriptContent =
`local Prop = import('/lua/sim/Prop.lua').Prop

${pairName} = Class(Prop) {
    OnCreate = function(self)
        Prop.OnCreate(self)
        CreateEmitterAtBone(self, -2, -1, '${emitterPath}')
    end,
}

TypeClass = ${pairName}`;

          await writeFile(`${pairDirPath}\\emitter_prop.bp`,    propContent);
          await writeFile(`${pairDirPath}\\emitter_script.lua`, scriptContent);

          emitterPropPaths.push(
            `/maps/${finalMapName}/env/props/emitter/plain/${cardLabel}/emitter_${emitterNumber}/emitter_prop.bp`
          );
        }

        for (const coord of coords) {
          const assignedPath = emitterPropPaths[Math.floor(Math.random() * emitterPropPaths.length)];
          propsLuaEntries.push({ path: assignedPath, x: coord.x, z: coord.z });
        }
      }

      let propsLuaContent = 'return {\n';
      for (const entry of propsLuaEntries) {
        propsLuaContent +=
`    {
        path = "${entry.path}",
        position = {
            ${entry.x},
            0,
            ${entry.z},
        },
        rotationX = { 1, 0, 0, },
        rotationY = { 0, 1, 0, },
        rotationZ = { 0, 0, 1, },
        scale = { 1, 1, 1, },
    },\n`;
      }
      propsLuaContent += '}\n';

      const { propsLuaFileName } = await injectPropsLua({
        mapFolderPath, content: propsLuaContent, exportRawLua,
      });

      if (generateReadme) {
        const kmStr = kmLabel(mapSize);

        const outputLines = [`  Total placements : ${propsLuaEntries.length}`];
        if (exportRawLua && propsLuaFileName)
          outputLines.push(`  Raw props.lua    : ${propsLuaFileName}  ← next to .scmap in map folder`);
        outputLines.push(`  Output dir       : env\\props\\emitter\\plain\\`);

        const cardLines = [];
        validCards.forEach((card, idx) => {
          const label     = card.label || `Card ${idx + 1}`;
          const coords    = card.coordinates.filter(c => c.x && c.z);
          const cardLabel = label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          cardLines.push('');
          cardLines.push(`  [${String(idx + 1).padStart(2, '0')}] ${label}`);
          cardLines.push(`       Folder     : env/props/emitter/plain/${cardLabel}/`);
          cardLines.push(`       Coordinates: ${coords.length}`);
          const cats = (card.emitterCategories || []).filter(c => c.trim());
          if (cats.length > 0) cardLines.push(`       Categories (${cats.length}): ${cats.join(', ')}`);
          const rand = (parseFloat(card.randomness?.poissonRadius) || 0) > 0 ? card.randomness : globalRandomness;
          if ((parseFloat(rand?.poissonRadius) || 0) > 0)
            cardLines.push(`       Randomness : Poisson Min. Distance = ${rand.poissonRadius} units`);
        });
        const globalPaths = emitterPaths.filter(p => p.trim());
        cardLines.push('');
        cardLines.push(`  GLOBAL EMITTER PATHS (${globalPaths.length}):`);
        globalPaths.forEach(p => cardLines.push(`    • ${p}`));

        const readmeContent = buildReadme({
          tool:    'Emitter Tab',
          mapName: finalMapName,
          mapSize: `${mapSize} × ${mapSize} (${kmStr} km)`,
          sections: [
            { title: 'MAP SETTINGS (extra)', entries: [['Mirror Mode', mirrorMode], ['Mask Mode', maskScanMode]] },
            { title: 'OUTPUT SUMMARY',       lines: outputLines },
            { title: 'EMITTER CARDS',        lines: cardLines },
            { title: 'HOW TO USE', lines: exportRawLua ? [
              `  1. ${propsLuaFileName} has been written to the map root folder.`,
              '     Copy it into the unpacked .scmap folder and repack with BrewMapTool',
              '     or use the SCMAP tab in ForgeMapToolkit to inject it.',
              '  2. Re-generating is always safe — each run writes a new numbered',
              '     props.lua without overwriting existing ones.',
              '  3. Prop/script files are in the output directory listed above.',
            ] : [
              '  1. The .scmap has been repacked with the new props.lua chunk.',
              '     No manual work required. To undo or modify this, check the History tab.',
              '  2. Re-generating is always safe — each run adds a new numbered',
              '     props.lua chunk without touching existing ones.',
              '  3. Prop/script files are in the output directory listed above.',
            ]},
          ],
          footer: [
            'Generated by ForgeMapToolkit · Seraphim-Noob',
            'SCMAP-Tool — original foundation by The-Balthazar (https://github.com/The-Balthazar)',
            'Translation & implementation by Seraphim-Noob',
          ],
        });
        await writeReadme(`${mapFolderPath}\\Emitter_Generation_README.txt`, readmeContent);
      }

      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      let emSuccessMsg = `✓ ${propsLuaEntries.length} emitter placements generated!\n\nFiles:\n${mapFolderPath}\\env\\props\\emitter\\plain\\`;
      if (exportRawLua && propsLuaFileName) emSuccessMsg += `\n✓ props.lua saved: ${mapFolderPath}\\${propsLuaFileName}`;
      if (generateReadme) emSuccessMsg += '\n✓ README written to map folder';
      await luxuryAlert(emSuccessMsg, 'Generation Complete', 'success');

    } catch (err) {
      await luxuryAlert(`Generation failed: ${err?.message ?? err}`, 'Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Generate Grid ─────────────────────────────────────────────────────────────

  const handleGenerateGrid = async (ci) => {
    const card = emitterCards[ci];
    const coords = generateGridCoords(card.gridStepX, card.gridStepZ, mapSize, mirrorMode, globalRandomness, maskImageData, maskWidth, maskHeight, maskScanMode);
    if (coords.length === 0) {
      await luxuryAlert('No coordinates generated. Check that X/Z Step values are valid.', 'Warning', 'warning');
      return;
    }
    setEmitterCards(prev => prev.map((c, i) => i !== ci ? c : { ...c, coordinates: coords }));
  };

  // ── Library ───────────────────────────────────────────────────────────────────

  const handleLibraryConfirm = (selected) => {
    if (!selected?.length) { setShowEmitterLibrary(false); return; }

    const currentMapName = (mapName || '').trim();
    const finalMapName   = currentMapName.match(/\.v\d{4}$/) ? currentMapName : currentMapName + '.v0001';

    const newPaths       = [];
    const newPublicPaths = {};

    for (const e of selected) {
      if (e.source === 'toolkit' && e.publicPath) {
        const fileName    = (e.publicPath.replace(/\\/g, '/')).split('/').pop();
        const mapGamePath = `/maps/${finalMapName}/env/props/emitter/${fileName}`;
        newPaths.push(mapGamePath);
        newPublicPaths[mapGamePath] = e.publicPath;
      } else {
        newPaths.push(e.gamePath || e.id || '');
      }
    }

    setEmitterPaths(prev => {
      const existing = prev.filter(p => p.trim());
      const toAdd = newPaths.filter(p => p && !existing.includes(p));
      return [...existing, ...toAdd, ''];
    });
    setEmitterPublicPaths(prev => ({ ...prev, ...newPublicPaths }));

    newPaths.forEach((p) => {
      if (p.trim().toLowerCase().endsWith('_prop.bp')) {
        window.electronAPI.invoke('resolve-prop-to-emit', { propGamePath: p.trim() }).then(res => {
          if (res?.success && res.emitPath) {
            setEmitterPaths(prev => prev.map(ep => ep === p ? res.emitPath : ep));
          }
        });
      }
    });

    setShowEmitterLibrary(false);
  };

  // ── Image Upload ──────────────────────────────────────────────────────────────

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreviewImageData(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleMaskUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      setMaskPreviewUrl(dataUrl);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        setMaskImageData(data.data);
        setMaskWidth(img.width);
        setMaskHeight(img.height);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // ── Color Options ─────────────────────────────────────────────────────────────

  const availableColors = [
    { color: '#FFAF00', glow: 'rgba(255,175,0,0.35)'   },
    { color: '#FF7B00', glow: 'rgba(255,123,0,0.35)'   },
    { color: '#FFFA00', glow: 'rgba(255,250,0,0.35)'   },
    { color: '#A5E801', glow: 'rgba(165,232,1,0.35)'   },
    { color: '#538A33', glow: 'rgba(83,138,51,0.35)'   },
    { color: '#8A12BD', glow: 'rgba(138,18,189,0.35)'  },
    { color: '#00DDFF', glow: 'rgba(0,221,255,0.35)'   },
    { color: '#3B76FF', glow: 'rgba(59,118,255,0.35)'  },
    { color: '#FE1818', glow: 'rgba(254,24,24,0.35)'   },
    { color: '#3EA387', glow: 'rgba(62,163,135,0.35)'  },
    { color: '#18C748', glow: 'rgba(24,199,72,0.35)'   },
    { color: '#00FF66', glow: 'rgba(0,255,102,0.35)'   },
    { color: '#FFFFFF', glow: 'rgba(255,255,255,0.35)' },
    { color: '#FF69B4', glow: 'rgba(255,105,180,0.35)' },
  ];

  // ── Section Props ───────────────────────────────────────────────────────────

  const configProps = {
    mapName, setMapName, mapInfo,
    emitterPaths, updateEmitterPath, resolveEmitterPath, deleteEmitterPath,
    onAddEmitter: addEmitterPath,
    onOpenLibrary: () => setShowEmitterLibrary(true),
  };

  const emittersProps = {
    emitterCards, selectedCard, setSelectedCard,
    availableColors, showColorPicker, setShowColorPicker,
    coordsOpen, setCoordsOpen,
    deleteAllEmitterCards, addEmitterCard, deleteEmitterCard, updateCard,
    handleGenerateGrid,
    addManualCoordinate, updateCoordinate, deleteCoordinate, clearCoordinates,
    emitterPaths, toggleCardEmitter, getEmitterNameFromPath,
    globalRandomness, setGlobalRandomness,
    maskFileInputRef, maskImageData, handleMaskUpload,
    maskScanMode, setMaskScanMode, maskPreviewUrl, maskWidth, maskHeight,
    onRemoveMask: () => {
      setMaskImageData(null); setMaskWidth(0); setMaskHeight(0);
      setMaskPreviewUrl(null);
      if (maskFileInputRef.current) maskFileInputRef.current.value = '';
    },
  };

  const exportProps = {
    ready: emitterCards.some(c => c.coordinates.some(coord => coord.x && coord.z)),
    handleGenerate,
    generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="emitter-tab trace-tab">
      {/* ── Library overlay ── */}
      {showEmitterLibrary && (
        <EmitterLibraryOverlay
          onConfirm={handleLibraryConfirm}
          onClose={() => setShowEmitterLibrary(false)}
          mapName={mapName}
          mapsFolder={settings?.mapsFolder ?? ''}
          accentColor="var(--emitter-color)"
          accentGlow="var(--emitter-glow)"
        />
      )}

      {/* ── Help button ── */}
      {!showHelp && !showEmitterLibrary && (
        <button className="help-btn" onClick={() => setShowHelp(true)} title="Toggle Help Overlay">?</button>
      )}

      {/* ── Help modal ── */}
      {showHelp && (
        <EmitterHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={(t) => { setActiveHelpTab(t); setEmitterHelpSelected(null); }}
          helpSelected={emitterHelpSelected}
          setHelpSelected={setEmitterHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

      {/* ── WorkspaceConsole shell ── */}
      <TabLayout
        sections={[
          { id: 'config',   index: '01', label: 'Configuration', desc: 'Set map name and emitter paths.', done: !!(mapName.trim() && emitterPaths.some(p => p.trim())) },
          { id: 'emitters', index: '02', label: 'Emitters',      desc: 'Configure emitter cards and place coordinates on the canvas.', count: emitterCards.reduce((n, c) => n + c.coordinates.filter(c => c.x && c.z).length, 0), done: emitterCards.some(c => c.coordinates.some(coord => coord.x && coord.z)) },
          { id: 'export',   index: '03', label: 'Export',        desc: 'Generate emitter prop files and inject them into the .scmap.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="EMITTERS"
        asideCaption={null}
        railStorageKey="em-rail-pinned"
        navLabel="Emitter console navigation"

        asideMirror={
          <div className="preview-panel-head-controls">
            <select
              className="field-select"
              style={{ width: 'auto' }}
              value={mirrorMode}
              onChange={e => setMirrorMode(e.target.value)}
            >
              <option value="none">No Mirror</option>
              <option value="diagonal">Diagonal</option>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
            {previewImageData && (
              <button
                className="action-button action-button--danger"
                style={{ padding: '4px 10px', fontSize: '0.62rem' }}
                onClick={() => {
                  setPreviewImageData(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Delete Preview
              </button>
            )}
          </div>
        }
        asideSlot={
          <MapPreview
            previewLoading={previewLoading}
            previewImageData={previewImageData}
            onUploadClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            onImageUpload={handleImageUpload}
            canvasRef={canvasRef}
            onCanvasClick={handleCanvasClick}
            markers={markers}
            onMarkerDelete={(marker) => deleteCoordinate(marker.entityIdx, marker.coordIdx)}
            markerTitle={(marker) => `${marker.label} — Click to delete`}
            showPlaceholder={!previewImage && emitterCards.every(c => c.coordinates.every(coord => !coord.x))}
            placeholder="Click on canvas to place emitters"
            legendTitle="Emitter Legend"
            legendRows={emitterCards.map((card, i) => ({
              id:    card.id,
              color: card.color,
              label: card.label || `Emitter ${i + 1}`,
              pts:   card.coordinates.filter(c => c.x && c.z).length,
            }))}
            hint={`Click canvas to place · ${mirrorMode !== 'none' ? `${mirrorMode} mirror active` : 'no mirror'}`}
          />
        }
      >
        {activeSection === 'config'   && <EmitterConfiguration {...configProps} />}
        {activeSection === 'emitters' && <EmitterEmitters {...emittersProps} />}
        {activeSection === 'export'   && <EmitterExport {...exportProps} />}
      </TabLayout>
    </div>
  );
};

export default EmitterTab;
