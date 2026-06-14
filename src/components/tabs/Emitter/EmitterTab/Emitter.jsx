import React, { useState, useRef, useEffect } from 'react';
import '../../../shared/design-system/index.css';
import '../../../shared/shared.css';
import './Emitter.css';
import EmitterLibraryOverlay from '../../Libraries/EmitterLibrary/EmitterLibraryOverlay';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import EmitterHelpModal from '../../HelpModals/Emitter_help.jsx';
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
  MatchingMode, OutputChecklist, EmitterAssignmentOverlay, MapPreview,
} from '../../../shared/entity-console/EntityConsole.jsx';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_RANDOMNESS = { poissonRadius: 0 };

const makeEmitterCard = () => ({
  id: Date.now() + Math.random(),
  label:             '',
  coordinates:       [],
  gridStepX:         '',
  gridStepZ:         '',
  randomness:        { ...DEFAULT_RANDOMNESS },
  color:             `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
  emitterCategories: [],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMirroredCoords = (x, z, mapSize, mode, offsetX = 0) => {
  const ms = parseFloat(mapSize) || 1024;
  const far = 2 * offsetX + ms;
  switch (mode) {
    case 'diagonal':   return { x: far - x, z: far - z };
    case 'horizontal': return { x,           z: far - z };
    case 'vertical':   return { x: far - x,  z           };
    default:           return null;
  }
};

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

  const [mapSize,          setMapSizeState]          = useState(s.em_mapSize          ?? settings?.defaultMapSize ?? '1024');
  const [mapName,          setMapNameState]          = useState(s.em_mapName          ?? '');
  const [mapsFolderPath,   setMapsFolderPathState]   = useState(s.em_mapsFolderPath   ?? '');
  const [mapInfo,              setMapInfo]              = useState(null);
  const [mapOffsetX,           setMapOffsetX]           = useState(0);
  const [mapOffsetY,           setMapOffsetY]           = useState(0);

  useEffect(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) { setMapInfo(null); setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0); return; }
    const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolderPath = folder + '\\' + finalName;
    window.electronAPI.invoke('read-map-info', { mapFolderPath }).then(res => {
      if (res?.success) {
        setMapInfo({ ok: true, mapSize: res.mapSize, km: res.km, playableSize: res.playableSize, playableKm: res.playableKm });
        setMapSize(String(res.playableSize));
        setMapOffsetX(res.x1); setMapOffsetY(res.y1);
        onSharedChange('em_mapSize', String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  const [mirrorMode,       setMirrorModeState]       = useState(s.em_mirrorMode       ?? settings?.defaultMirrorMode ?? 'diagonal');
  const [globalRandomness, setGlobalRandomnessState] = useState(s.em_globalRandomness ?? { ...DEFAULT_RANDOMNESS });
  const [emitterCards,     setEmitterCardsState]     = useState(s.em_emitterCards     ?? [makeEmitterCard()]);
  const [emitterPaths,     setEmitterPathsState]     = useState(s.em_emitterPaths     ?? ['']);
  const [emitterPublicPaths, setEmitterPublicPathsState] = useState(s.em_emitterPublicPaths ?? {});
  const [generateReadme,      setGenerateReadmeState]      = useState(s.em_generateReadme      ?? (settings?.generateReadme !== false));
  const [exportRawLua,        setExportRawLuaState]        = useState(s.em_exportRawLua        ?? false);
  const [emitterCategories,   setEmitterCategoriesState]   = useState(s.em_emitterCategories   ?? {});
  const [emitterMatchingMode, setEmitterMatchingModeState] = useState(s.em_emitterMatchingMode ?? 'smart');
  const [activeSection,       setActiveSection]            = useState('config');

  const setMapSize          = v => { setMapSizeState(v);          onSharedChange('em_mapSize',        v); };
  const setMapName          = v => { setMapNameState(v);          onSharedChange('em_mapName',        v); };
  const setMapsFolderPath   = v => { setMapsFolderPathState(v);   onSharedChange('em_mapsFolderPath', v); };
  const setMirrorMode       = v => { setMirrorModeState(v);       onSharedChange('em_mirrorMode',     v); };
  const setGenerateReadme   = v => { setGenerateReadmeState(v);   onSharedChange('em_generateReadme', v); };
  const setExportRawLua     = v => { setExportRawLuaState(v);     onSharedChange('em_exportRawLua', v); };
  const setEmitterCategories   = v => { setEmitterCategoriesState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('em_emitterCategories', next); return next; }); };
  const setEmitterMatchingMode = v => { setEmitterMatchingModeState(v); onSharedChange('em_emitterMatchingMode', v); };

  const setEmitterPaths = v => {
    setEmitterPathsState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      onSharedChange('em_emitterPaths', next);
      return next;
    });
  };

  const setEmitterPublicPaths = v => {
    setEmitterPublicPathsState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      onSharedChange('em_emitterPublicPaths', next);
      return next;
    });
  };

  const setGlobalRandomness = v => {
    setGlobalRandomnessState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      onSharedChange('em_globalRandomness', next);
      return next;
    });
  };

  const setEmitterCards = v => {
    setEmitterCardsState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      onSharedChange('em_emitterCards', next);
      return next;
    });
  };

  // ── Settings Sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)     setMapsFolderPath(settings.mapsFolder);
    if (settings.generateReadme != null) setGenerateReadme(settings.generateReadme !== false);
    if (settings.defaultMirrorMode != null) setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ── Local UI State ────────────────────────────────────────────────────────────

  const [selectedCard,       setSelectedCard]       = useState(0);
  const [previewImage,       setPreviewImage]       = useState(null);
  const [previewImageData,   setPreviewImageData]   = useState(null);
  const [previewLoading,     setPreviewLoading]     = useState(false);
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [showColorPicker,    setShowColorPicker]    = useState(null);
  const [coordsOpen,         setCoordsOpen]         = useState({});
  const [showEmitterCategoryConfig, setShowEmitterCategoryConfig] = useState(false);
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

  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    } else {
      setPreviewImage(null);
    }
  }, [previewImageData]);

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

  const updateCardRandomness = (idx, field, value) => {
    setEmitterCards(prev => prev.map((c, i) =>
      i !== idx ? c : { ...c, randomness: { ...c.randomness, [field]: value } }
    ));
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

  // ── IPC File Helpers ──────────────────────────────────────────────────────────

  const writeFile = async (filePath, content) => {
    const res = await window.electronAPI.invoke('write-file', { filePath, content });
    if (!res?.success) throw new Error(res?.error || 'write-file failed');
  };

  const ensureDir = async (dirPath) => {
    const res = await window.electronAPI.invoke('ensure-dir', { dirPath });
    if (!res?.success) throw new Error(res?.error || 'ensure-dir failed');
  };

  // ── Category Logic ────────────────────────────────────────────────────────────

  const getAllUniqueCategories = () => {
    const categoriesSet = new Set();
    emitterCards.forEach(card => {
      (card.emitterCategories || []).forEach(cat => {
        if (cat && cat.trim()) categoriesSet.add(cat.trim());
      });
    });
    return Array.from(categoriesSet).sort();
  };

  const getAllEmitterPaths = () => emitterPaths.filter(p => p.trim());

  const toggleEmitterCategory = (emitterPath, category) => {
    setEmitterCategories(prev => {
      const next = { ...prev };
      if (!next[emitterPath]) next[emitterPath] = [];
      const idx = next[emitterPath].indexOf(category);
      next[emitterPath] = idx > -1
        ? next[emitterPath].filter(c => c !== category)
        : [...next[emitterPath], category];
      return next;
    });
  };

  const isEmitterActiveForCategory = (emitterPath, category) => {
    if (!emitterCategories[emitterPath]) return true;
    return !emitterCategories[emitterPath].includes(category);
  };

  const getEmitterNameFromPath = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1].replace('_emit.bp', '').replace(/_/g, ' ');
  };

  const addEmitterCardCategory = (cardIndex) => {
    setEmitterCards(emitterCards.map((c, i) =>
      i === cardIndex ? { ...c, emitterCategories: [...(c.emitterCategories || []), ''] } : c
    ));
  };

  const updateEmitterCardCategory = (cardIndex, catIndex, value) => {
    setEmitterCards(emitterCards.map((c, i) =>
      i === cardIndex ? {
        ...c,
        emitterCategories: (c.emitterCategories || []).map((cat, j) => j === catIndex ? value : cat)
      } : c
    ));
  };

  const deleteEmitterCardCategory = (cardIndex, catIndex) => {
    setEmitterCards(emitterCards.map((c, i) =>
      i === cardIndex ? {
        ...c,
        emitterCategories: (c.emitterCategories || []).filter((_, j) => j !== catIndex)
      } : c
    ));
  };

  const getEmittersForCard = (card) => {
    const validEmitters = getAllEmitterPaths();
    const activeCategories = (card.emitterCategories || []).filter(c => c.trim());
    if (activeCategories.length === 0) return validEmitters;

    if (emitterMatchingMode === 'smart') {
      const perfect = validEmitters.filter(p => activeCategories.every(cat => isEmitterActiveForCategory(p, cat)));
      if (perfect.length > 0) return perfect;
      const partial = validEmitters.filter(p => activeCategories.some(cat => isEmitterActiveForCategory(p, cat)));
      return partial.length > 0 ? partial : validEmitters;
    } else if (emitterMatchingMode === 'simple') {
      const union = validEmitters.filter(p => activeCategories.some(cat => isEmitterActiveForCategory(p, cat)));
      return union.length > 0 ? union : validEmitters;
    } else if (emitterMatchingMode === 'lastCategory') {
      const last = activeCategories[activeCategories.length - 1];
      const match = validEmitters.filter(p => isEmitterActiveForCategory(p, last));
      return match.length > 0 ? match : validEmitters;
    }
    return validEmitters;
  };

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

      const resolvedPublicPaths = { ...emitterPublicPaths };
      const pathsNeedingLookup = emitterPaths.filter(p => p.trim() && !resolvedPublicPaths[p.trim()]);
      if (pathsNeedingLookup.length > 0) {
        const scanRes = await window.electronAPI.invoke('scan-map-emitters', {
          mapsFolder, mapName: finalMapName,
        });
        const scanned = scanRes?.emitters ?? [];
        for (const rawPath of pathsNeedingLookup) {
          const filename = rawPath.replace(/\\/g, '/').split('/').pop();
          const match = scanned.find(
            e => e.source === 'toolkit' && e.publicPath &&
                 e.publicPath.replace(/\\/g, '/').split('/').pop() === filename
          );
          if (match) resolvedPublicPaths[rawPath] = match.publicPath;
        }
      }

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
        const rawPaths = getEmittersForCard(card).filter(p => p.trim());
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

      const existingEntries = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      let maxIdx = 0;
      let hasSingle = false;
      for (const e of (existingEntries?.entries || [])) {
        if (e.name === 'props.lua') hasSingle = true;
        const m = e.name.match(/^props(\d+)\.lua$/);
        if (m) maxIdx = Math.max(maxIdx, parseInt(m[1]));
      }
      const propsLuaFileName = maxIdx > 0 ? `props${maxIdx + 1}.lua`
                             : hasSingle  ? `props1.lua`
                             : `props.lua`;

      let scmapEntry = { name: `${finalMapName} (no SCMAP modified)` };
      if (exportRawLua) {
        await writeFile(`${mapFolderPath}\\${propsLuaFileName}`, propsLuaContent);
      } else {
        const dirEntries = existingEntries?.entries || [];
        const scmapFile = dirEntries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
        if (!scmapFile) throw new Error(`No .scmap file found in ${mapFolderPath}`);
        const scmapPath = `${mapFolderPath}\\${scmapFile.name}`;
        scmapEntry = scmapFile;

        const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
        if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
        const unpackedFolder = unpackRes.outputFolder;

        await writeFile(`${unpackedFolder}\\${propsLuaFileName}`, propsLuaContent);

        const mapNameForPack = unpackedFolder.split(/[\\\/]/).pop();
        const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
        if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);

        const copyBackRes = await window.electronAPI.invoke('copy-file', {
          src:  packRes.outputPath,
          dest: scmapPath,
        });
        if (!copyBackRes?.success) throw new Error('Failed to copy repacked .scmap back to map folder');
      }

      if (generateReadme) {
        const sizeNum   = parseFloat(mapSize) || 1024;
        const kmPerUnit = 20 / 1024;
        const km        = sizeNum * kmPerUnit;
        const kmStr     = Number.isInteger(km) ? `${km}×${km}` : `${km.toFixed(1)}×${km.toFixed(1)}`;

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
    const rand = (parseFloat(card.randomness.poissonRadius) || 0) > 0 ? card.randomness : globalRandomness;
    const coords = generateGridCoords(card.gridStepX, card.gridStepZ, mapSize, mirrorMode, rand, maskImageData, maskWidth, maskHeight, maskScanMode);
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

  // ── Preview Auto-Load ─────────────────────────────────────────────────────────

  const loadPreviewFromScmap = async (mapFolderPath) => {
    try {
      setPreviewLoading(true);
      const dirRes = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirRes?.success) return;
      const scmapEntry = dirRes.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) return;
      const scmapPath = mapFolderPath + '\\' + scmapEntry.name;
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes?.success) return;
      const unpackDir = await window.electronAPI.invoke('list-dir', { dirPath: unpackRes.outputFolder });
      if (!unpackDir?.success) return;
      const previewEntry = unpackDir.entries.find(e => /^previewimage/i.test(e.name));
      if (!previewEntry) return;
      const ddsPath = unpackRes.outputFolder + '\\' + previewEntry.name;
      const ddsRes = await window.electronAPI.invoke('dds-to-dataurl', { filePath: ddsPath });
      if (ddsRes?.success && ddsRes.dataUrl) setPreviewImageData(ddsRes.dataUrl);
    } catch (e) {
      console.warn('[Emitter] preview load failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    setPreviewImageData(null);
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return;
    const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolderPath = folder + '\\' + finalName;
    loadPreviewFromScmap(mapFolderPath);
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="emitter-tab"
      style={{
        '--tab-color':       'var(--emitter-color)',
        '--tab-glow':        'var(--emitter-glow)',
        '--tab-glow-strong': 'var(--emitter-glow-strong)',
      }}
    >
      {/* ── Emitter-Category Assignment Overlay ── */}
      {showEmitterCategoryConfig && (
        <EmitterAssignmentOverlay
          entities={emitterCards}
          getEntityTitle={(card, idx) => card.label?.toUpperCase() || `Emitter ${idx + 1}`}
          getEntityColor={(card) => card.color}
          getEntityCategories={(card) => card.emitterCategories}
          getEmittersForEntity={getEmittersForCard}
          categories={getAllUniqueCategories()}
          emitters={emitterPaths.filter(p => p.trim())}
          isActive={isEmitterActiveForCategory}
          onToggle={toggleEmitterCategory}
          getName={getEmitterNameFromPath}
          entityNoun="emitter"
          sidebarHint="Emitters active per card"
          onClose={() => setShowEmitterCategoryConfig(false)}
          colorVars={{
            '--tab-color':       'var(--emitter-color)',
            '--tab-glow':        'var(--emitter-glow)',
            '--tab-glow-strong': 'var(--emitter-glow-strong)',
          }}
        />
      )}

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
      {!showHelp && !showEmitterLibrary && !showEmitterCategoryConfig && (
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
      <WorkspaceConsole
        sections={[
          { id: 'config',   index: '01', label: 'Configuration', desc: 'Set map name, emitter paths, grid randomness and area mask.', done: !!(mapName.trim() && emitterPaths.some(p => p.trim())) },
          { id: 'emitters', index: '02', label: 'Emitters',      desc: 'Define emitter cards and place coordinates on the canvas.', count: emitterCards.reduce((n, c) => n + c.coordinates.filter(c => c.x && c.z).length, 0), done: emitterCards.some(c => c.coordinates.some(coord => coord.x && coord.z)) },
          { id: 'matching', index: '03', label: 'Matching',      desc: 'Configure how emitters are assigned to card categories.',    done: !!emitterMatchingMode },
          { id: 'export',   index: '04', label: 'Export',        desc: 'Generate emitter prop files and inject them into the .scmap.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="EMITTERS"
        renderEyebrow={(s) => `EMITTER REGISTER — ${s.index} — EMITTER CONSOLE`}
        railStorageKey="em-rail-pinned"
        navLabel="Emitter console navigation"
        bootMs={280}
        mirrorSlot={
          <>
            <select
              className="field-select"
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
                onClick={() => {
                  setPreviewImageData(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Delete Preview
              </button>
            )}
          </>
        }
        previewSlot={
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
        {/* ── 01 CONFIG ── */}
        {activeSection === 'config' && (
          <>
            <div className="form-group">
              <label className="field-label">Map Name</label>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. Hades_Dust.v0002"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
              />
              {mapInfo && (
                <div className="ec-map-info">
                  {mapInfo.ok ? (<>
                    <span className="ec-map-info-tag">Map</span>
                    <span className="ec-map-info-size">{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                    <span className="ec-map-info-sep">·</span>
                    <span>{mapInfo.km} km</span>
                    {mapInfo.playableSize !== mapInfo.mapSize && (<>
                      <span className="ec-map-info-sep">·</span>
                      <span>playable {mapInfo.playableKm} km</span>
                    </>)}
                  </>) : (
                    <span className="ec-map-info-err">{mapInfo.error}</span>
                  )}
                </div>
              )}
              {mapName && (
                <div className="ec-path-hint">
                  {`Saves to: /maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/`}
                </div>
              )}
            </div>

            {/* Global Randomness */}
            <div className="subsection-head">
              <span className="subsection-head-title">Global Randomness</span>
            </div>
            <div className="form-group">
              <label className="field-label">Poisson Min. Distance</label>
              <input
                type="number"
                min="0"
                className="field-input"
                placeholder="0"
                value={globalRandomness.poissonRadius}
                onChange={e => setGlobalRandomness(prev => ({ ...prev, poissonRadius: e.target.value }))}
              />
            </div>

            {/* Area Mask */}
            <div className="subsection-head">
              <span className="subsection-head-title">Area Mask</span>
            </div>
            <div className="em-mask-upload" onClick={() => maskFileInputRef.current?.click()}>
              <span>{maskImageData ? 'Mask loaded — click to replace' : 'Click to upload mask image (B/W)'}</span>
              <input
                ref={maskFileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleMaskUpload}
              />
            </div>
            <div className="form-group">
              <label className="field-label">Dark Pixel Behaviour</label>
              <select
                className="field-select"
                value={maskScanMode}
                onChange={e => setMaskScanMode(e.target.value)}
              >
                <option value="right">Slide Right — shift emitter rightward to next white pixel</option>
                <option value="left">Slide Left — shift emitter leftward to next white pixel</option>
                <option value="ignore">Ignore — skip emitter entirely on dark pixels</option>
              </select>
            </div>
            {maskPreviewUrl && (
              <div className="em-mask-preview">
                <img
                  src={maskPreviewUrl}
                  alt="Area Mask Preview"
                  className="em-mask-img"
                />
                <div className="em-mask-dim">{maskWidth} × {maskHeight} px</div>
              </div>
            )}
            {maskImageData && (
              <button
                className="action-button action-button--danger action-button--full"
                style={{ marginBottom: 'var(--space-md)' }}
                onClick={() => {
                  setMaskImageData(null); setMaskWidth(0); setMaskHeight(0);
                  setMaskPreviewUrl(null);
                  if (maskFileInputRef.current) maskFileInputRef.current.value = '';
                }}
              >Remove Mask</button>
            )}

            {/* Emitter Paths */}
            <div className="subsection-head" style={{ marginTop: 'var(--space-xl)' }}>
              <span className="subsection-head-title">Emitter Paths</span>
            </div>
            <div className="form-group">
              <label className="field-label">Emitters (_emit.bp)</label>
              {emitterPaths.map((path, pi) => (
                <div key={pi} className="ec-input-row">
                  <input
                    type="text"
                    className="field-input field-input--mono"
                    placeholder="/effects/emitters/weather_sand_01_emit.bp"
                    value={path}
                    onChange={e => updateEmitterPath(pi, e.target.value)}
                    onBlur={e => resolveEmitterPath(pi, e.target.value)}
                  />
                  <button className="delete-button" onClick={() => deleteEmitterPath(pi)}>×</button>
                </div>
              ))}
              <button className="action-button action-button--full" style={{ marginBottom: 'var(--space-xs)' }} onClick={addEmitterPath}>
                Add Emitter
              </button>
              <button className="action-button action-button--full" onClick={() => setShowEmitterLibrary(true)}>
                Library
              </button>
            </div>
          </>
        )}

        {/* ── 02 EMITTERS ── */}
        {activeSection === 'emitters' && (
          <>
            <div className="trace-section-head" style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                {emitterCards.length >= 1 && (
                  <button className="action-button action-button--danger" onClick={deleteAllEmitterCards}>
                    Delete All
                  </button>
                )}
              </div>
            </div>

            <EntityCardGrid>
              {emitterCards.map((card, ci) => (
                <EntityCard
                  key={card.id}
                  index={ci}
                  color={card.color}
                  selected={ci === selectedCard}
                  onSelect={() => setSelectedCard(ci)}
                  onDelete={() => deleteEmitterCard(ci)}
                  title={card.label ? card.label.toUpperCase() : `Emitter ${ci + 1}`}
                  availableColors={availableColors}
                  showColorPicker={showColorPicker === ci}
                  onToggleColorPicker={() => setShowColorPicker(showColorPicker === ci ? null : ci)}
                  onPickColor={(c) => { updateCard(ci, 'color', c); setShowColorPicker(null); }}
                >
                  {ci === selectedCard && (<>
                    {/* Label */}
                    <div className="form-group">
                      <label className="field-label">Label</label>
                      <input
                        type="text"
                        className="field-input"
                        placeholder="e.g. Fire Emitters"
                        value={card.label}
                        onChange={e => { e.stopPropagation(); updateCard(ci, 'label', e.target.value); }}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>

                    {/* Categories */}
                    <div className="form-group">
                      <label className="field-label">Emitter Categories (optional)</label>
                      {(card.emitterCategories || []).map((cat, catIdx) => (
                        <div key={catIdx} className="ec-input-row">
                          <input
                            type="text"
                            className="field-input"
                            value={cat}
                            onChange={e => { e.stopPropagation(); updateEmitterCardCategory(ci, catIdx, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            placeholder={`Category ${catIdx + 1} (e.g. Smoke, Fog)`}
                          />
                          <button className="delete-button" onClick={e => { e.stopPropagation(); deleteEmitterCardCategory(ci, catIdx); }}>×</button>
                        </div>
                      ))}
                      <button
                        className="action-button action-button--full"
                        onClick={e => { e.stopPropagation(); addEmitterCardCategory(ci); }}
                      >
                        Add Category
                      </button>
                    </div>

                    {/* Grid Placement */}
                    <div className="subsection-head">
                      <span className="subsection-head-title">Grid Placement</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                      <div className="form-group">
                        <label className="field-label" style={{ fontSize: '0.72rem' }}>X Step</label>
                        <input
                          type="number" min="1"
                          className="field-input field-input--sm"
                          placeholder="64"
                          value={card.gridStepX}
                          onChange={e => { e.stopPropagation(); updateCard(ci, 'gridStepX', e.target.value); }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div className="form-group">
                        <label className="field-label" style={{ fontSize: '0.72rem' }}>Z Step</label>
                        <input
                          type="number" min="1"
                          className="field-input field-input--sm"
                          placeholder="64"
                          value={card.gridStepZ}
                          onChange={e => { e.stopPropagation(); updateCard(ci, 'gridStepZ', e.target.value); }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <button
                      className="action-button action-button--full"
                      style={{ marginBottom: 'var(--space-lg)' }}
                      disabled={!card.gridStepX || !card.gridStepZ}
                      onClick={e => { e.stopPropagation(); handleGenerateGrid(ci); }}
                    >Generate Grid</button>

                    {/* Per-card randomness */}
                    <div className="subsection-head">
                      <span className="subsection-head-title">Card Randomness Override</span>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                      <label className="field-label" style={{ fontSize: '0.72rem' }}>Poisson Min. Distance</label>
                      <input
                        type="number" min="0"
                        className="field-input field-input--sm"
                        placeholder="0"
                        value={card.randomness.poissonRadius}
                        onChange={e => { e.stopPropagation(); updateCardRandomness(ci, 'poissonRadius', e.target.value); }}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>

                    {/* Coordinates */}
                    <CoordinateList
                      coordinates={card.coordinates}
                      fields={[[
                        { key: 'x', label: 'X', placeholder: '256' },
                        { key: 'z', label: 'Z', placeholder: '256' },
                      ]]}
                      open={!!coordsOpen[ci]}
                      onToggle={() => setCoordsOpen(prev => ({ ...prev, [ci]: !prev[ci] }))}
                      labelFor={(coord, coordIdx) => `Point ${coordIdx + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                      onUpdate={(coordIdx, key, val) => updateCoordinate(ci, coordIdx, key, val)}
                      onDelete={(coordIdx) => deleteCoordinate(ci, coordIdx)}
                      onAdd={() => addManualCoordinate(ci)}
                      hasPlaced={card.coordinates.some(c => c.x && c.z)}
                      onDeleteAll={async () => {
                        const ok = await luxuryConfirm('Delete all coordinates for this card?', 'Confirm Delete', 'Delete All', 'Cancel');
                        if (ok) clearCoordinates(ci);
                      }}
                    />
                  </>)}
                </EntityCard>
              ))}
              <AddTile label="Add Emitter Card" onClick={addEmitterCard} />
            </EntityCardGrid>
          </>
        )}

        {/* ── 03 MATCHING ── */}
        {activeSection === 'matching' && (
          <MatchingMode
            value={emitterMatchingMode}
            onChange={setEmitterMatchingMode}
            onConfigure={() => setShowEmitterCategoryConfig(true)}
            modes={[
              { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',  note: 'Card ["Smoke", "Dense"] gets only emitters active for BOTH categories first' },
              { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',  note: 'Card ["Smoke", "Dense"] gets all emitters active for Smoke OR Dense' },
              { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',  note: 'Card ["Smoke", "Dense"] → matches "Dense" only' },
            ]}
          />
        )}

        {/* ── 04 EXPORT ── */}
        {activeSection === 'export' && (
          <OutputChecklist
            ready={emitterCards.some(c => c.coordinates.some(coord => coord.x && coord.z))}
            onCommit={handleGenerate}
            commitLabel="Generate Files"
            commitAriaLabel="Generate emitter files"
            items={[
              { label: 'Generate README file',       checked: generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
              { label: 'Export props.lua (no SCMAP)', checked: exportRawLua,  onToggle: () => setExportRawLua(!exportRawLua) },
            ]}
          />
        )}
      </WorkspaceConsole>
    </div>
  );
};

export default EmitterTab;