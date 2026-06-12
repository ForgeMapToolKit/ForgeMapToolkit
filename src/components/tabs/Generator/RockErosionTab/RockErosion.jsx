// ─── IMPORTS ────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import '../../../shared/shared.css';
import './RockErosion.css';
import { luxuryAlert } from '../../../modals/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibraryOverlay from '../../Libraries/PropsLibrary/PropsLibraryOverlay';
import RockErosionHelpModal from '../../HelpModals/RockErosion_help.jsx';

// ─── IPC HELPER ─────────────────────────────────────────────────────────────
const ipcInvoke = (channel, ...args) =>
  window.electronAPI ? window.electronAPI.invoke(channel, ...args) : Promise.resolve(null);

// ─── DEFAULT CARD CONSTANTS ─────────────────────────────────────────────────
const DEFAULT_ROCK_CARD    = { id: Date.now(),     propName: 'Erosion Rocks', blueprintPaths: [''], color: 'var(--rockerosion-color)', useCustomValues: false, customDensityMultiplier: '1.0', customDiffusion: '0', customDecimalPlacesCoords: '2', customDecimalPlacesHeading: '2' };
const DEFAULT_DEBRIS_CARD  = { id: Date.now() + 1, propName: 'Debris Rocks', blueprintPaths: [''], color: 'var(--rockerosion-color)', spawnMapImage: null, spawnMapData: null, spawnThreshold: '0.1', useCustomValues: false, customDensityMultiplier: '1.0', customDiffusion: '0', customDecimalPlacesCoords: '2', customDecimalPlacesHeading: '2' };
const DEFAULT_SCREE_CARD   = { id: Date.now() + 2, propName: 'Scree Rocks',  blueprintPaths: [''], color: 'var(--rockerosion-color)', spawnMapImage: null, spawnMapData: null, useCustomValues: false, customDensityMultiplier: '1.0', customDiffusion: '0', customDecimalPlacesCoords: '2', customDecimalPlacesHeading: '2' };

// ─── COMPONENT ──────────────────────────────────────────────────────────────
const RockErosionTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  const [mapSize,              setMapSizeState]              = useState(s.re_mapSize              ?? settings?.defaultMapSize      ?? '1024');
  const [mapName,              setMapNameState]              = useState(s.re_mapName              ?? '');
  const [mapsFolderPath,       setMapsFolderPathState]       = useState(s.re_mapsFolderPath       ?? settings?.mapsFolder           ?? '');
  const [mapInfo,              setMapInfo]              = useState(null);
  const [mapOffsetX,           setMapOffsetX]           = useState(0);
  const [mapOffsetY,           setMapOffsetY]           = useState(0);

  // ─── MAP INFO AUTO-FETCH ────────────────────────────────────────────────────
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
        onSharedChange('re_mapSize', String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);
  const [densityMultiplier,    setDensityMultiplierState]    = useState(s.re_densityMultiplier    ?? '1.0');
  const [decimalPlacesCoords,  setDecimalPlacesCoordsState]  = useState(s.re_decimalPlacesCoords  ?? String(settings?.defaultDecimalCoords  ?? '2'));
  const [decimalPlacesHeading, setDecimalPlacesHeadingState] = useState(s.re_decimalPlacesHeading ?? String(settings?.defaultDecimalHeading ?? '2'));
  const [diffusion,            setDiffusionState]            = useState(s.re_diffusion            ?? '0');
  const [gridResolution,       setGridResolutionState]       = useState(s.re_gridResolution       ?? '100');
  const [generateReadme,       setGenerateReadmeState]       = useState(s.re_generateReadme       ?? (settings?.generateReadme !== false));
  const [exportRawLua,         setExportRawLuaState]         = useState(s.re_exportRawLua         ?? false);
  const [sizeBlendSigma,       setSizeBlendSigmaState]       = useState(s.re_sizeBlendSigma       ?? 50);
  const [mirrorMode,           setMirrorModeState]           = useState(s.re_mirrorMode           ?? settings?.defaultMirrorMode ?? 'none');
  const [rockCards,            setRockCardsState]            = useState(s.re_rockCards            ?? [{ ...DEFAULT_ROCK_CARD,   id: Date.now()     }]);
  const [debrisCards,          setDebrisCardsState]          = useState(s.re_debrisCards          ?? [{ ...DEFAULT_DEBRIS_CARD, id: Date.now() + 1 }]);
  const [screeCards,           setScreeCardsState]           = useState(s.re_screeCards           ?? [{ ...DEFAULT_SCREE_CARD,  id: Date.now() + 2 }]);
  const [blueprintMassMap,     setBlueprintMassMapState]     = useState(s.re_blueprintMassMap     ?? {});
  const [blueprintEnergyMap,   setBlueprintEnergyMapState]   = useState(s.re_blueprintEnergyMap   ?? {});

  // ─── SHARED STATE SETTERS ───────────────────────────────────────────────────
  const setMapSize          = v => { setMapSizeState(v);              onSharedChange('re_mapSize', v); };
  const setMapName          = v => { setMapNameState(v);              onSharedChange('re_mapName', v); };
  const setMapsFolderPath   = v => { setMapsFolderPathState(v);       onSharedChange('re_mapsFolderPath', v); };
  const setDensityMultiplier= v => { setDensityMultiplierState(v);    onSharedChange('re_densityMultiplier', v); };
  const setDecimalPlacesCoords  = v => { setDecimalPlacesCoordsState(v);  onSharedChange('re_decimalPlacesCoords', v); };
  const setDecimalPlacesHeading = v => { setDecimalPlacesHeadingState(v); onSharedChange('re_decimalPlacesHeading', v); };
  const setDiffusion        = v => { setDiffusionState(v);            onSharedChange('re_diffusion', v); };
  const setGridResolution   = v => { setGridResolutionState(v);       onSharedChange('re_gridResolution', v); };
  const setGenerateReadme   = v => { setGenerateReadmeState(v);       onSharedChange('re_generateReadme', v); };
  const setExportRawLua     = v => { setExportRawLuaState(v);         onSharedChange('re_exportRawLua', v); };
  const setSizeBlendSigma   = v => { setSizeBlendSigmaState(v);       onSharedChange('re_sizeBlendSigma', v); };
  const setMirrorMode       = v => { setMirrorModeState(v);           onSharedChange('re_mirrorMode', v); };
  const setBlueprintMassMap   = v => { setBlueprintMassMapState(v);   onSharedChange('re_blueprintMassMap',   v); };
  const setBlueprintEnergyMap = v => { setBlueprintEnergyMapState(v); onSharedChange('re_blueprintEnergyMap', v); };
  const setRockCards   = v => { setRockCardsState(prev   => { const next = typeof v === 'function' ? v(prev)   : v; onSharedChange('re_rockCards',   next); return next; }); };
  const setDebrisCards = v => { setDebrisCardsState(prev => { const next = typeof v === 'function' ? v(prev)   : v; onSharedChange('re_debrisCards', next.map(c => ({ ...c, spawnMapImage: null, spawnMapData: null }))); return next; }); };
  const setScreeCards  = v => { setScreeCardsState(prev  => { const next = typeof v === 'function' ? v(prev)   : v; onSharedChange('re_screeCards',  next.map(c => ({ ...c, spawnMapImage: null, spawnMapData: null }))); return next; }); };

  const [seed, setSeed] = useState(Date.now());
const mirrorModeRef = useRef(mirrorMode);
useEffect(() => { mirrorModeRef.current = mirrorMode; }, [mirrorMode]);

  // ─── UI STATE ────────────────────────────────────────────────────────────────
const [showRockBlueprintLibrary, setShowRockBlueprintLibrary] = useState(false);
const [showRockColorPicker, setShowRockColorPicker] = useState(null);
const [rockMarkers, setRockMarkers] = useState([]);

const [libraryTarget, setLibraryTarget] = useState({ type: null, index: null });
const [colorPickerTarget, setColorPickerTarget] = useState({ type: null, index: null });

  const [previewImage, setPreviewImage] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, file: '' });

  const canvasRef = useRef(null);

  const [selectedRock, setSelectedRock] = useState(0);
const [selectedDebrisCard, setSelectedDebrisCard] = useState(0);
const [selectedScreeCard, setSelectedScreeCard] = useState(0);
  const [slopeMask, setSlopeMask] = useState(null);
  const [slopeMaskData, setSlopeMaskData] = useState(null);
  const [flowMask, setFlowMask] = useState(null);
  const [flowMaskData, setFlowMaskData] = useState(null);
  const [erosionWearMap, setErosionWearMap] = useState(null);
  const [erosionWearMapData, setErosionWearMapData] = useState(null);
  const [curvatureMap, setCurvatureMap] = useState(null);
  const [curvatureMapData, setCurvatureMapData] = useState(null);
  const [heightmap, setHeightmap] = useState(null);
  const [heightmapData, setHeightmapData] = useState(null);
  const slopeMaskInputRef = useRef(null);
  const flowMaskInputRef = useRef(null);
  const erosionWearInputRef = useRef(null);
  const curvatureMapInputRef = useRef(null);
  const heightmapInputRef = useRef(null);
const debrisSpawnMapRefs = useRef({});
const screeSpawnMapRefs = useRef({});
  const previewUploadRef = useRef(null);
  const [rockTypeTab, setRockTypeTab] = useState('erosion');
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('guide');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  const availableColors = [
    '#FFAF00', '#FF7B00', '#FFFA00', '#A5E801', '#538A33', '#8A12BD',
    '#00DDFF', '#3B76FF', '#FE1818', '#3EA387', '#18C748', '#00FF66', '#FFFFFF', '#000000'
  ];

  // ─── SETTINGS SYNC ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)                    setMapsFolderPath(settings.mapsFolder);
    if (settings.defaultMapSize)                setMapSize(settings.defaultMapSize);
    if (settings.defaultDecimalCoords != null)  setDecimalPlacesCoords(String(settings.defaultDecimalCoords));
    if (settings.defaultDecimalHeading != null) setDecimalPlacesHeading(String(settings.defaultDecimalHeading));
    if (settings.generateReadme != null)        setGenerateReadme(settings.generateReadme !== false);
    if (settings.defaultMirrorMode != null)     setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ─── MARKER REGENERATION EFFECT ────────────────────────────────────────────
useEffect(() => {

  const width = slopeMaskData?.width || flowMaskData?.width || erosionWearMapData?.width
    || debrisCards.find(c => c.spawnMapData)?.spawnMapData?.width
    || screeCards.find(c => c.spawnMapData)?.spawnMapData?.width;
  const height = slopeMaskData?.height || flowMaskData?.height || erosionWearMapData?.height
    || debrisCards.find(c => c.spawnMapData)?.spawnMapData?.height
    || screeCards.find(c => c.spawnMapData)?.spawnMapData?.height;

  if (width && height) {
    generateRockMarkers(width, height);
  }
}, [rockCards, debrisCards, screeCards, seed, densityMultiplier, diffusion, mapSize, slopeMaskData, flowMaskData, erosionWearMapData, curvatureMapData, heightmapData]);

  // ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────
  const seededRandom = (seed) => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

// ─── ORIENTATION FROM HEIGHTMAP ────────────────────────────────────────────
const getDownslopeOrientation = (x, y, heightmapData, width, height) => {
  if (!heightmapData) return Math.random() * Math.PI * 2;

  const getHeight = (px, py) => {
    if (px < 0 || px >= width || py < 0 || py >= height) return 0;
    const i = (py * width + px) * 4;
    return heightmapData.data[i];
  };

  const h_center = getHeight(x, y);
  const h_left = getHeight(x - 1, y);
  const h_right = getHeight(x + 1, y);
  const h_up = getHeight(x, y - 1);
  const h_down = getHeight(x, y + 1);

  const dx = (h_right - h_left) / 2;
  const dy = (h_down - h_up) / 2;

  const downslopeAngle = Math.atan2(-dy, -dx);

  const rockOrientation = downslopeAngle + Math.PI / 2;

  const variation = (Math.random() - 0.5) * (Math.PI / 3);

  return rockOrientation + variation;
};

  // ─── MAP UPLOAD HANDLERS ────────────────────────────────────────────────────
const handleSlopeMaskUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setSlopeMask(event.target.result);
      processSlopeMask(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const processSlopeMask = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setSlopeMaskData(data);
    generateRockMarkers(img.width, img.height);
  };
  img.src = imageData;
};

const clearSlopeMask = () => {
  setSlopeMask(null);
  setSlopeMaskData(null);
  const width = flowMaskData?.width || erosionWearMapData?.width;
  const height = flowMaskData?.height || erosionWearMapData?.height;
  if (width && height) generateRockMarkers(width, height);
};

const handleFlowMaskUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setFlowMask(event.target.result);
      processFlowMask(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const processFlowMask = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setFlowMaskData(data);
    generateRockMarkers(img.width, img.height);
  };
  img.src = imageData;
};

const clearFlowMask = () => {
  setFlowMask(null);
  setFlowMaskData(null);
  const width = slopeMaskData?.width || erosionWearMapData?.width || curvatureMapData?.width;
  const height = slopeMaskData?.height || erosionWearMapData?.height || curvatureMapData?.height;
  if (width && height) generateRockMarkers(width, height);
};

const handleErosionWearUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setErosionWearMap(event.target.result);
      processErosionWearMap(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const processErosionWearMap = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setErosionWearMapData(data);
    generateRockMarkers(img.width, img.height);
  };
  img.src = imageData;
};

const clearErosionWearMap = () => {
  setErosionWearMap(null);
  setErosionWearMapData(null);
  const width = slopeMaskData?.width || flowMaskData?.width || curvatureMapData?.width;
  const height = slopeMaskData?.height || flowMaskData?.height || curvatureMapData?.height;
  if (width && height) generateRockMarkers(width, height);
};

const handleCurvatureMapUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setCurvatureMap(event.target.result);
      processCurvatureMap(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const processCurvatureMap = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setCurvatureMapData(data);
    generateRockMarkers(img.width, img.height);
  };
  img.src = imageData;
};

const clearCurvatureMap = () => {
  setCurvatureMap(null);
  setCurvatureMapData(null);
  const width = slopeMaskData?.width || flowMaskData?.width || erosionWearMapData?.width;
  const height = slopeMaskData?.height || flowMaskData?.height || erosionWearMapData?.height;
  if (width && height) generateRockMarkers(width, height);
};

const handleHeightmapUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setHeightmap(event.target.result);
      processHeightmap(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const processHeightmap = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setHeightmapData(data);
    generateRockMarkers(img.width, img.height);
  };
  img.src = imageData;
};

const clearHeightmap = () => {
  setHeightmap(null);
  setHeightmapData(null);
  const width = slopeMaskData?.width || flowMaskData?.width || erosionWearMapData?.width;
  const height = slopeMaskData?.height || flowMaskData?.height || erosionWearMapData?.height;
  if (width && height) generateRockMarkers(width, height);
};

  // ─── CARD MANAGEMENT ─────────────────────────────────────────────────────────
  const addCard = (type) => {
    const newCard = {
      id: Date.now(),
      propName: type === 'debris' ? 'Debris Rocks' : 'Scree Rocks',
      blueprintPaths: [''],
      color: availableColors[Math.floor(Math.random() * availableColors.length)],
      spawnMapImage: null,
      spawnMapData: null,
      useCustomValues: false,
      customDensityMultiplier: '1.0',
      customDiffusion: '0',
      customDecimalPlacesCoords: '2',
      customDecimalPlacesHeading: '2'
    };
    if (type === 'debris') {
      setDebrisCards(prev => [...prev, newCard]);
      setSelectedDebrisCard(debrisCards.length);
    } else {
      setScreeCards(prev => [...prev, newCard]);
      setSelectedScreeCard(screeCards.length);
    }
  };

  const deleteCard = (type, index) => {
    if (type === 'debris') {
      if (debrisCards.length === 1) return;
      setDebrisCards(prev => prev.filter((_, i) => i !== index));
      if (selectedDebrisCard >= index && selectedDebrisCard > 0)
        setSelectedDebrisCard(prev => prev - 1);
    } else {
      if (screeCards.length === 1) return;
      setScreeCards(prev => prev.filter((_, i) => i !== index));
      if (selectedScreeCard >= index && selectedScreeCard > 0)
        setSelectedScreeCard(prev => prev - 1);
    }
  };

  const updateCard = (type, index, field, value) => {
    if (type === 'debris') {
      setDebrisCards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    } else {
      setScreeCards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }
  };

  const addBlueprintPath = (type, cardIndex) => {
    const cards = type === 'debris' ? debrisCards : screeCards;
    const newCards = [...cards];
    newCards[cardIndex].blueprintPaths.push('');
    type === 'debris' ? setDebrisCards(newCards) : setScreeCards(newCards);
  };

  const removeBlueprintPath = (type, cardIndex, pathIndex) => {
    const cards = type === 'debris' ? debrisCards : screeCards;
    const newCards = [...cards];
    if (newCards[cardIndex].blueprintPaths.length > 1)
      newCards[cardIndex].blueprintPaths.splice(pathIndex, 1);
    type === 'debris' ? setDebrisCards(newCards) : setScreeCards(newCards);
  };

  const updateBlueprintPath = (type, cardIndex, pathIndex, value) => {
    const cards = type === 'debris' ? debrisCards : screeCards;
    const newCards = [...cards];
    newCards[cardIndex].blueprintPaths[pathIndex] = value;
    type === 'debris' ? setDebrisCards(newCards) : setScreeCards(newCards);
  };

  const handleSpawnMapUpload = (type, cardIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        updateCard(type, cardIndex, 'spawnMapImage', event.target.result);
        updateCard(type, cardIndex, 'spawnMapData', data);
        triggerRegenerate();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clearSpawnMap = (type, cardIndex) => {
    updateCard(type, cardIndex, 'spawnMapImage', null);
    updateCard(type, cardIndex, 'spawnMapData', null);
    triggerRegenerate();
  };

  const triggerRegenerate = () => {
    const width = slopeMaskData?.width || flowMaskData?.width ||
                  erosionWearMapData?.width || 512;
    const height = slopeMaskData?.height || flowMaskData?.height ||
                   erosionWearMapData?.height || 512;
    generateRockMarkers(width, height);
  };

  // ─── ROCK CARD MANAGEMENT ────────────────────────────────────────────────────
  const addRockCard = () => {
    setRockCards([...rockCards, {
      id: Date.now(),
      propName: '',
      blueprintPaths: [''],
      determineAreaImage: null,
      determineAreaData: null,
      color: availableColors[Math.floor(Math.random() * availableColors.length)],
      useCustomValues: false,
      customDensityMultiplier: '1.0',
      customDiffusion: '0',
      customDecimalPlacesCoords: '2',
      customDecimalPlacesHeading: '2'
    }]);
    setSelectedRock(rockCards.length);
  };

  const deleteRockCard = (index) => {
    if (rockCards.length === 1) return;
    setRockCards(rockCards.filter((_, i) => i !== index));
    if (selectedRock >= index && selectedRock > 0) setSelectedRock(selectedRock - 1);
  };

  const deleteAllRockCards = async () => {
    const confirmed = await luxuryConfirm('Delete all rock cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setRockCards([{ ...DEFAULT_ROCK_CARD, id: Date.now() }]);
    setSelectedRock(0);
  };

  const deleteAllDebrisCards = async () => {
    const confirmed = await luxuryConfirm('Delete all debris cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setDebrisCards([{ ...DEFAULT_DEBRIS_CARD, id: Date.now() }]);
    setSelectedDebrisCard(0);
  };

  const deleteAllScreeCards = async () => {
    const confirmed = await luxuryConfirm('Delete all scree cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setScreeCards([{ ...DEFAULT_SCREE_CARD, id: Date.now() }]);
    setSelectedScreeCard(0);
  };

  const updateRockCard = (index, field, value) => {
    const newCards = [...rockCards];
    newCards[index][field] = value;
    setRockCards(newCards);
  };

  const addRockBlueprintPath = (rockIndex) => {
    const newCards = [...rockCards];
    newCards[rockIndex].blueprintPaths.push('');
    setRockCards(newCards);
  };

  const removeRockBlueprintPath = (rockIndex, pathIndex) => {
    const newCards = [...rockCards];
    if (newCards[rockIndex].blueprintPaths.length > 1) {
      newCards[rockIndex].blueprintPaths.splice(pathIndex, 1);
    }
    setRockCards(newCards);
  };

  const updateRockBlueprintPath = (rockIndex, pathIndex, value) => {
    const newCards = [...rockCards];
    newCards[rockIndex].blueprintPaths[pathIndex] = value;
    setRockCards(newCards);
  };

  // ─── LIBRARY HANDLERS ────────────────────────────────────────────────────────
  const handlePropsLibraryConfirm = (selectedProps) => {
    const { type, index } = libraryTarget;
    const newMassMap   = { ...blueprintMassMap };
    const newEnergyMap = { ...blueprintEnergyMap };
    selectedProps.forEach(prop => {
      const gp = prop.gamePath || prop.id;
      if (gp && prop.reclaimMass   != null) newMassMap[gp]   = prop.reclaimMass;
      if (gp && prop.reclaimEnergy != null) newEnergyMap[gp] = prop.reclaimEnergy;
    });
    setBlueprintMassMap(newMassMap);
    setBlueprintEnergyMap(newEnergyMap);
    if (type === 'erosion') {
      const newCards = [...rockCards];
      newCards[index].blueprintPaths = newCards[index].blueprintPaths.filter(p => p.trim());
      selectedProps.forEach(prop => {
        const gamePath = prop.gamePath || prop.id;
        if (gamePath && !newCards[index].blueprintPaths.includes(gamePath))
          newCards[index].blueprintPaths.push(gamePath);
      });
      if (!newCards[index].blueprintPaths.some(p => !p)) newCards[index].blueprintPaths.push('');
      setRockCards(newCards);
    } else {
      const cards = type === 'debris' ? [...debrisCards] : [...screeCards];
      cards[index].blueprintPaths = cards[index].blueprintPaths.filter(p => p.trim());
      selectedProps.forEach(prop => {
        const gamePath = prop.gamePath || prop.id;
        if (gamePath && !cards[index].blueprintPaths.includes(gamePath))
          cards[index].blueprintPaths.push(gamePath);
      });
      if (!cards[index].blueprintPaths.some(p => !p)) cards[index].blueprintPaths.push('');
      type === 'debris' ? setDebrisCards(cards) : setScreeCards(cards);
    }
  };

  // ─── PREVIEW ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (previewImageData) setPreviewImage(previewImageData);
  }, [previewImageData]);

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
      console.warn('[RockErosion] preview load failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Reset preview when map name or folder changes — then auto-load from scmap
  useEffect(() => {
    setPreviewImageData(null);
    setPreviewImage(null);
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return;
    const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolderPath = folder + '\\' + finalName;
    loadPreviewFromScmap(mapFolderPath);
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  const handlePreviewUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setPreviewImage(imageData);
      localStorage.setItem('shared_preview_image', imageData);
    };
    reader.readAsDataURL(file);
  };

  const deletePreview = () => {
    setPreviewImage(null);
    localStorage.removeItem('shared_preview_image');
  };

  // ─── BLUEPRINT ECONOMY ───────────────────────────────────────────────────────
  const getBlueprintEconomy = (blueprintPath) => {
    const mass   = blueprintMassMap[blueprintPath]   ?? null;
    const energy = blueprintEnergyMap[blueprintPath] ?? null;
    return { mass, energy };
  };

  const massToScale = (() => {
    const values = Object.values(blueprintMassMap).filter(v => v != null && v > 0);
    if (values.length === 0) return () => 1;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median === 0) return () => 1;
    return (mass) => {
      if (mass == null || mass <= 0) return 1;
      const raw = Math.log(mass) / Math.log(median);
      return Math.max(0.5, Math.min(1.75, raw));
    };
  })();

  const getSizeFromBrightness = (brightness, seed) => {
    const t = brightness / 255;
    const sigma = Math.max(1, sizeBlendSigma) / 100;
    const noise = (seededRandom(seed) - 0.5) * sigma * 2;
    const v = Math.max(0, Math.min(1, t + noise));
    return 0.5 + v * 1.25;
  };

  // ─── ROCK MARKER GENERATION ────────────────────────────────────────────────
const generateRockMarkers = (width, height) => {
  const markers = [];
  const mapSizeNum = parseFloat(mapSize);
  const globalDensityMult = parseFloat(densityMultiplier);
  const globalDiffusionAmount = parseFloat(diffusion) / 100;
  let currentSeed = seed;

  const globalGridRes = Math.max(1, parseInt(gridResolution || '256'));
  const cellW = width  / globalGridRes;
  const cellH = height / globalGridRes;
  let rngSeed = seed;
  const rng = () => { rngSeed++; return seededRandom(rngSeed); };
  const samplePoints = [];
  for (let gy = 0; gy < globalGridRes; gy++) {
    for (let gx = 0; gx < globalGridRes; gx++) {
      const px = (gx + rng()) * cellW;
      const py = (gy + rng()) * cellH;
      samplePoints.push([px, py]);
    }
  }

  const getPosition = (px, py, diffAmt, w = width, h = height) => {
    let finalX = (px / w) * mapSizeNum + mapOffsetX;
    let finalZ = (py / h) * mapSizeNum + mapOffsetY;
    if (diffAmt > 0) {
      currentSeed++;
      const rX = mapOffsetX + seededRandom(currentSeed) * mapSizeNum;
      currentSeed++;
      const rZ = mapOffsetY + seededRandom(currentSeed) * mapSizeNum;
      finalX = finalX * (1 - diffAmt) + rX * diffAmt;
      finalZ = finalZ * (1 - diffAmt) + rZ * diffAmt;
    }
    return { finalX, finalZ };
  };

  const hasErosionMaps = slopeMaskData || flowMaskData || erosionWearMapData;
  if (hasErosionMaps) {
    for (const [px, py] of samplePoints) {
      const x = Math.min(width  - 1, Math.round(px));
      const y = Math.min(height - 1, Math.round(py));
        const i = (y * width + x) * 4;

        if (flowMaskData) {
          const fb = flowMaskData.data[i] / 255;
          const fp = 1 / (1 + Math.exp(-10 * (fb - 0.5)));
          currentSeed++;
          if (seededRandom(currentSeed) > fp) continue;
        }

        let slopeProb = 1.0;
        if (slopeMaskData) {
          const sb = slopeMaskData.data[i] / 255;
          slopeProb = sb < 0.5
            ? 0.1 + (sb * 2) * 0.9
            : 1.0 - ((sb - 0.5) * 2) * 0.7;
        }
        currentSeed++;
        if (seededRandom(currentSeed) > slopeProb) continue;

        let curvBonus = 1.0;
        if (curvatureMapData) {
          const cb = curvatureMapData.data[i] / 255;
          curvBonus = cb < 0.5
            ? 1.8 - (cb * 2) * 0.8
            : 1.0 - ((cb - 0.5) * 2) * 0.6;
        }

        rockCards.forEach(card => {
          const valid = card.blueprintPaths.filter(bp => bp && bp.trim());
          if (valid.length === 0) return;

const densityMult = card.useCustomValues
            ? parseFloat(card.customDensityMultiplier)
            : globalDensityMult;
          currentSeed++;
          if (seededRandom(currentSeed) > Math.min(1, densityMult * curvBonus)) return;

          currentSeed++;
          let selectedSize;
          if (erosionWearMapData) {
            const brightness = erosionWearMapData.data[i];
            selectedSize = getSizeFromBrightness(brightness, currentSeed);
          } else {
            const { mass: mFallback } = getBlueprintEconomy(valid[Math.floor(seededRandom(currentSeed) * valid.length)]);
            selectedSize = massToScale(mFallback);
          }

          currentSeed++;
          const blueprint = valid[Math.floor(seededRandom(currentSeed) * valid.length)];
const { mass, energy } = getBlueprintEconomy(blueprint);
          const combinedSize = selectedSize * massToScale(mass);

          const diffAmt = card.useCustomValues
            ? parseFloat(card.customDiffusion) / 100
            : globalDiffusionAmount;
          const { finalX, finalZ } = getPosition(px, py, diffAmt);

          let heading;
          if (heightmapData) {
            heading = getDownslopeOrientation(x, y, heightmapData, width, height);
          } else {
            currentSeed++;
            heading = seededRandom(currentSeed) * Math.PI * 2;
          }

          currentSeed++;
          markers.push({
            id: currentSeed,
            x: finalX, y: 0, z: finalZ,
            heading, blueprint,
            propName: card.propName,
            color: card.color,
            size: combinedSize,
            cardType: 'erosion',
            mass,
            energy,
            customDecimalPlacesCoords: card.useCustomValues ? card.customDecimalPlacesCoords : null,
            customDecimalPlacesHeading: card.useCustomValues ? card.customDecimalPlacesHeading : null
          });
        });
    }
  }

  debrisCards.forEach(card => {
    if (!card.spawnMapData) return;
    const valid = card.blueprintPaths.filter(bp => bp && bp.trim());
    if (valid.length === 0) return;

    const dWidth = card.spawnMapData.width;
    const dHeight = card.spawnMapData.height;
    const dGridRes = Math.max(1, parseInt(gridResolution || '256'));
    const dCellW = dWidth  / dGridRes;
    const dCellH = dHeight / dGridRes;
    let dRngSeed = currentSeed;
    const dRng = () => { dRngSeed++; return seededRandom(dRngSeed); };
    const dSamplePoints = [];
    for (let gy = 0; gy < dGridRes; gy++) {
      for (let gx = 0; gx < dGridRes; gx++) {
        dSamplePoints.push([(gx + dRng()) * dCellW, (gy + dRng()) * dCellH]);
      }
    }
    currentSeed = dRngSeed;
    const threshold = parseFloat(card.spawnThreshold || '0.1');

    for (const [dpx, dpy] of dSamplePoints) {
        const x = Math.min(dWidth  - 1, Math.round(dpx));
        const y = Math.min(dHeight - 1, Math.round(dpy));
        const i = (y * dWidth + x) * 4;

        const spawnBrightness = card.spawnMapData.data[i] / 255;

        if (spawnBrightness < threshold) continue;

        const normalizedProb = (spawnBrightness - threshold) / (1.0 - threshold);
        currentSeed++;
        if (seededRandom(currentSeed) > normalizedProb) continue;

        const densityMult = card.useCustomValues
          ? parseFloat(card.customDensityMultiplier)
          : globalDensityMult;
        currentSeed++;
        if (seededRandom(currentSeed) > Math.min(1, densityMult)) continue;

        currentSeed++;
let selectedSize;
if (erosionWearMapData) {
  const brightness = erosionWearMapData.data[i];
  selectedSize = getSizeFromBrightness(brightness, currentSeed);
} else {
  selectedSize = 1;
}

        currentSeed++;
        const blueprint = valid[Math.floor(seededRandom(currentSeed) * valid.length)];
const { mass, energy } = getBlueprintEconomy(blueprint);
        const combinedSize = selectedSize * massToScale(mass);

        const diffAmt = card.useCustomValues
          ? parseFloat(card.customDiffusion) / 100
          : globalDiffusionAmount;
        const { finalX, finalZ } = getPosition(dpx, dpy, diffAmt, dWidth, dHeight);

        currentSeed++;
        const heading = seededRandom(currentSeed) * Math.PI * 2;

        currentSeed++;
        markers.push({
          id: currentSeed,
          x: finalX, y: 0, z: finalZ,
          heading, blueprint,
          propName: card.propName,
          size: combinedSize,
          color: card.color,
          cardType: 'debris',
          mass,
energy,
          customDecimalPlacesCoords: card.useCustomValues ? card.customDecimalPlacesCoords : null,
          customDecimalPlacesHeading: card.useCustomValues ? card.customDecimalPlacesHeading : null
        });
    }
  });

  screeCards.forEach(card => {
    if (!card.spawnMapData) return;
    const valid = card.blueprintPaths.filter(bp => bp && bp.trim());
    if (valid.length === 0) return;

    const sWidth = card.spawnMapData.width;
    const sHeight = card.spawnMapData.height;
    const sGridRes = Math.max(1, parseInt(gridResolution || '256'));
    const sCellW = sWidth  / sGridRes;
    const sCellH = sHeight / sGridRes;
    let sRngSeed = currentSeed;
    const sRng = () => { sRngSeed++; return seededRandom(sRngSeed); };
    const sSamplePoints = [];
    for (let gy = 0; gy < sGridRes; gy++) {
      for (let gx = 0; gx < sGridRes; gx++) {
        sSamplePoints.push([(gx + sRng()) * sCellW, (gy + sRng()) * sCellH]);
      }
    }
    currentSeed = sRngSeed;
    const threshold = parseFloat(card.spawnThreshold || '0.1');

    for (const [spx, spy] of sSamplePoints) {
        const x = Math.min(sWidth  - 1, Math.round(spx));
        const y = Math.min(sHeight - 1, Math.round(spy));
        const i = (y * sWidth + x) * 4;

        const spawnBrightness = card.spawnMapData.data[i] / 255;

        if (spawnBrightness < threshold) continue;

        const normalizedProb = (spawnBrightness - threshold) / (1.0 - threshold);
        currentSeed++;
        if (seededRandom(currentSeed) > normalizedProb) continue;

        const densityMult = card.useCustomValues
          ? parseFloat(card.customDensityMultiplier)
          : globalDensityMult;
        currentSeed++;
        if (seededRandom(currentSeed) > Math.min(1, densityMult)) continue;

        currentSeed++;
        let selectedSize;
        if (erosionWearMapData) {
          const brightness = erosionWearMapData.data[i];
          selectedSize = getSizeFromBrightness(brightness, currentSeed);
        } else {
          selectedSize = 1;
        }
        currentSeed++;
        const blueprint = valid[Math.floor(seededRandom(currentSeed) * valid.length)];
const { mass, energy } = getBlueprintEconomy(blueprint);
        const combinedSize = selectedSize * massToScale(mass);

        const diffAmt = card.useCustomValues
          ? parseFloat(card.customDiffusion) / 100
          : globalDiffusionAmount;
        const { finalX, finalZ } = getPosition(spx, spy, diffAmt, sWidth, sHeight);

        let heading;
        if (heightmapData) {
          heading = getDownslopeOrientation(x, y, heightmapData, sWidth, sHeight);
        } else {
          currentSeed++;
          heading = seededRandom(currentSeed) * Math.PI * 2;
        }

        currentSeed++;
        markers.push({
          id: currentSeed,
          x: finalX, y: 0, z: finalZ,
          heading, blueprint,
          propName: card.propName,
          size: combinedSize,
          color: card.color,
          cardType: 'scree',
          mass,
energy,
          customDecimalPlacesCoords: card.useCustomValues ? card.customDecimalPlacesCoords : null,
          customDecimalPlacesHeading: card.useCustomValues ? card.customDecimalPlacesHeading : null
        });
    }
  });

const currentMirror = mirrorModeRef.current;
if (currentMirror !== 'none') {
  const baseMarkers = [...markers];
  const mapSizeNum = parseFloat(mapSize);
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
    markers.push({ ...m, id: m.id + 0.5, x: mx, z: mz, heading: mHeading, isMirrored: true });
  });
}

  setRockMarkers(markers);
};

  // ─── RANDOMIZE ─────────────────────────────────────────────────────────────
const handleRandomize = () => {
  setSeed(Date.now());
  const width = slopeMaskData?.width || flowMaskData?.width || erosionWearMapData?.width;
  const height = slopeMaskData?.height || flowMaskData?.height || erosionWearMapData?.height;
  if (width && height) {
    generateRockMarkers(width, height);
  }
};

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ─── CANVAS DRAW ─────────────────────────────────────────────────────────────
  const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      const gridSize = canvas.width / 8;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * gridSize, 0); ctx.lineTo(i * gridSize, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * gridSize); ctx.lineTo(canvas.width, i * gridSize); ctx.stroke();
      }
    };

    const drawMirrorLines = (W, H) => {
      if (mirrorMode === 'none') return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      if (mirrorMode === 'diagonal' || mirrorMode === 'vertical') {
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      }
      if (mirrorMode === 'diagonal' || mirrorMode === 'horizontal') {
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      }
      ctx.restore();
    };

    if (previewImage) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const offsetX = (canvas.width - w) / 2;
        const offsetY = (canvas.height - h) / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, offsetX, offsetY, w, h);
        drawGrid();
        const mapSizeNum = parseFloat(mapSize);
        rockMarkers.forEach(marker => {
          const pixelX = ((marker.x - mapOffsetX) / mapSizeNum) * w + offsetX;
          const pixelY = ((marker.z - mapOffsetY) / mapSizeNum) * h + offsetY;
          ctx.beginPath();
          ctx.arc(pixelX, pixelY, 3, 0, 2 * Math.PI);
          ctx.fillStyle = marker.color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        drawMirrorLines(canvas.width, canvas.height);
      };
      img.src = previewImage;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid();
      if (rockMarkers.length > 0) {
        const mapSizeNum = parseFloat(mapSize);
        rockMarkers.forEach(marker => {
          const pixelX = ((marker.x - mapOffsetX) / mapSizeNum) * canvas.width;
          const pixelY = ((marker.z - mapOffsetY) / mapSizeNum) * canvas.height;
          ctx.beginPath();
          ctx.arc(pixelX, pixelY, 3, 0, 2 * Math.PI);
          ctx.fillStyle = marker.color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
      drawMirrorLines(canvas.width, canvas.height);
    }
  }, [previewImage, rockMarkers, mapSize, mirrorMode]);

  // ─── LUA BUILDER ─────────────────────────────────────────────────────────────
  const buildPropLuaChunk = (markers, coordDecimals, headingDecimals) => {
  let lua = 'return {\n';
  for (const marker of markers) {
    const h = marker.heading;
    const cosH = Math.cos(h);
    const sinH = Math.sin(h);
    const x = marker.x.toFixed(coordDecimals);
    const z = marker.z.toFixed(coordDecimals);
    const rx1 = cosH.toFixed(headingDecimals);
    const rx3 = (-sinH).toFixed(headingDecimals);
    const rz1 = sinH.toFixed(headingDecimals);
    const rz3 = cosH.toFixed(headingDecimals);

    lua += `    {\n`;
    lua += `        path = "${marker.blueprint}",\n`;
    lua += `        position = {\n            ${x},\n            0,\n            ${z},\n        },\n`;
    lua += `        rotationX = {\n            ${rx1},\n            0,\n            ${rx3},\n        },\n`;
    lua += `        rotationY = {\n            0,\n            1,\n            0,\n        },\n`;
    lua += `        rotationZ = {\n            ${rz1},\n            0,\n            ${rz3},\n        },\n`;
    const s = (marker.size != null ? marker.size : 1).toFixed(4);
    lua += `        scale = {\n            ${s},\n            ${s},\n            ${s},\n        },\n`;
    lua += `    },\n`;
  }
  lua += '}\n';
  return lua;
};

  const writeFile = async (filePath, fileContent) => {
    const res = await window.electronAPI.invoke('write-file', { filePath, content: fileContent });
    if (!res?.success) throw new Error(res?.error || 'write-file failed');
  };
  const ensureDir = async (dirPath) => {
    const res = await window.electronAPI.invoke('ensure-dir', { dirPath });
    if (!res?.success) throw new Error(res?.error || 'ensure-dir failed');
  };
  const listDir = async (dirPath) => {
    const res = await window.electronAPI.invoke('list-dir', { dirPath });
    if (!res?.success) throw new Error(res?.error || 'list-dir failed');
    return res.entries;
  };

  // ─── FILE GENERATION ─────────────────────────────────────────────────────────
  const generateFiles = async () => {
    const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert('Please configure the Maps Folder in Settings first.');
      return;
    }
    if (!mapName) {
      await luxuryAlert('Please enter a map name.');
      return;
    }
    if (rockMarkers.length === 0) {
      await luxuryAlert('No rock markers generated. Configure rocks and click Apply first.');
      return;
    }

    let finalMapName = mapName.trim();
    if (!finalMapName.match(/\.v\d{4}$/)) finalMapName += '.v0001';

    setIsGenerating(true);
    try {
      const mapFolderPath = `${mapsFolder}\\${finalMapName}`;
      await ensureDir(mapFolderPath);

      const coordDecimals   = 1;
      const headingDecimals = 1;

      const markersByBlueprint = {};
      rockMarkers.forEach(marker => {
        if (!markersByBlueprint[marker.blueprint])
          markersByBlueprint[marker.blueprint] = { markers: [], propName: marker.propName };
        markersByBlueprint[marker.blueprint].markers.push(marker);
      });

      const CHUNK_SIZE = 5000;
      const total = rockMarkers.length;
      let startIndex = 0;
      try {
        const entries = await listDir(mapFolderPath);
        for (const { name } of entries) {
          const match = name.match(/^props(\d+)\.lua$/);
          if (match) { const n = parseInt(match[1]); if (n >= startIndex) startIndex = n; }
          if (name === 'props.lua') startIndex = Math.max(startIndex, 1);
        }
      } catch (e) {}

      // ── Entweder: Props.lua in mapRoot schreiben (kein SCMAP) ─────────────
      if (exportRawLua) {
        let writtenFiles = [];
        if (total <= CHUNK_SIZE && startIndex === 0) {
          setGenerationProgress({ current: 1, total: 1, file: 'Writing props.lua...' });
          await writeFile(`${mapFolderPath}\\props.lua`, buildPropLuaChunk(rockMarkers, coordDecimals, headingDecimals));
          writtenFiles = ['props.lua'];
        } else {
          const chunks = [];
          for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(rockMarkers.slice(i, i + CHUNK_SIZE));
          for (let i = 0; i < chunks.length; i++) {
            const fileName = `props${startIndex + i + 1}.lua`;
            setGenerationProgress({ current: i + 1, total: chunks.length, file: `Writing ${fileName}...` });
            await writeFile(`${mapFolderPath}\\${fileName}`, buildPropLuaChunk(chunks[i], coordDecimals, headingDecimals));
            writtenFiles.push(fileName);
          }
        }

        if (generateReadme) {
          const now        = new Date();
          const subDivider = '-'.repeat(80);
          const mapSizeNum = parseFloat(mapSize);
          const kmSize     = ((mapSizeNum / 256) * 5).toFixed(mapSizeNum % 256 === 0 ? 0 : 1);
          const byPropName = {};
          Object.entries(markersByBlueprint).forEach(([bp, data]) => {
            const pName = data.propName || 'Unnamed';
            if (!byPropName[pName]) byPropName[pName] = [];
            byPropName[pName].push({ bp, count: data.markers.length });
          });
          const propTable = [];
          Object.keys(byPropName).sort().forEach(pName => {
            const entries    = byPropName[pName];
            const totalCount = entries.reduce((s, e) => s + e.count, 0);
            propTable.push(`  ${pName.padEnd(25)} ${String(totalCount).padStart(6)}`);
            entries.forEach(({ bp, count }) => propTable.push(`    ${String(count).padStart(6)}  ${bp}`));
            propTable.push(`  ${subDivider}`);
          });
          const readmeContent = buildReadme({
            tool:    'Rock Erosion Tab',
            mapName: finalMapName,
            mapSize: `${mapSize} \u00d7 ${mapSize} (${kmSize} km \u00d7 ${kmSize} km)`,
            sections: [
              { title: 'OUTPUT SUMMARY', entries: [
                ['Total Rocks', total],
                ['Mode',        'props.lua (written to map folder, no SCMAP)'],
                ['Files',       writtenFiles.join(', ')],
              ]},
              { title: 'PROP BREAKDOWN', lines: [
                `  ${'Prop Name'.padEnd(25)} ${'Count'.padStart(6)}`,
                `  ${'\u2500'.repeat(50)}`,
                ...propTable,
                `  ${'\u2500'.repeat(50)}`,
              ]},
            ],
          });
          await writeReadme(`${mapFolderPath}\\RockErosion_Generation_README.txt`, readmeContent);
        }

        const currentSettings = await window.electronAPI.invoke('settings-load');
        if (currentSettings?.autoOpenExportFolder)
          await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });

        await luxuryAlert(`\u2713 ${total} rocks written to map folder (${writtenFiles.join(', ')}) \u2014 SCMAP not modified.`);
        return;
      }

      // ── Oder: Props in SCMAP injizieren (kein Lua in mapRoot) ────────────
      let writtenFiles = [];

      setGenerationProgress({ current: 2, total: 4, file: 'Locating .scmap...' });
      const dirEntries = await listDir(mapFolderPath);
      const scmapEntry = dirEntries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath}`);
      const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

      setGenerationProgress({ current: 2, total: 4, file: `Unpacking ${scmapEntry.name}...` });
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
      const unpackedFolder = unpackRes.outputFolder;

      const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapBefore = snapBeforeRes?.snapshot ?? null;

      setGenerationProgress({ current: 3, total: 4, file: 'Writing props into unpacked folder...' });
      if (total <= CHUNK_SIZE && startIndex === 0) {
        await writeFile(`${unpackedFolder}\\props.lua`, buildPropLuaChunk(rockMarkers, coordDecimals, headingDecimals));
        writtenFiles = ['props.lua'];
      } else {
        const chunks = [];
        for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(rockMarkers.slice(i, i + CHUNK_SIZE));
        for (let i = 0; i < chunks.length; i++) {
          const fileName = `props${startIndex + i + 1}.lua`;
          await writeFile(`${unpackedFolder}\\${fileName}`, buildPropLuaChunk(chunks[i], coordDecimals, headingDecimals));
          writtenFiles.push(fileName);
        }
      }

      const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
      const snapAfter = snapAfterRes?.snapshot ?? null;
      if (snapBefore && snapAfter) onRecordSnapshot('rockerosion', finalMapName, snapBefore, snapAfter);

      setGenerationProgress({ current: 4, total: 4, file: `Repacking ${scmapEntry.name}...` });
      const mapNameForPack = unpackedFolder.split(/[\\\/]/).pop();
      const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
      if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);
      const copyBackRes = await window.electronAPI.invoke('copy-file', { src: packRes.outputPath, dest: scmapPath });
      if (!copyBackRes?.success) throw new Error('Failed to copy repacked .scmap back');

      if (generateReadme) {
        const now        = new Date();
        const subDivider = '-'.repeat(80);
        const mapSizeNum = parseFloat(mapSize);
        const kmSize     = ((mapSizeNum / 256) * 5).toFixed(mapSizeNum % 256 === 0 ? 0 : 1);
        const byPropName = {};
        Object.entries(markersByBlueprint).forEach(([bp, data]) => {
          const pName = data.propName || 'Unnamed';
          if (!byPropName[pName]) byPropName[pName] = [];
          byPropName[pName].push({ bp, count: data.markers.length });
        });
        const propTable = [];
        Object.keys(byPropName).sort().forEach(pName => {
          const entries    = byPropName[pName];
          const totalCount = entries.reduce((s, e) => s + e.count, 0);
          propTable.push(`  ${pName.padEnd(25)} ${String(totalCount).padStart(6)}`);
          entries.forEach(({ bp, count }) => propTable.push(`    ${String(count).padStart(6)}  ${bp}`));
          propTable.push(`  ${subDivider}`);
        });
        const readmeContent = buildReadme({
          tool:    'Rock Erosion Tab',
          mapName: finalMapName,
          mapSize: `${mapSize} \u00d7 ${mapSize} (${kmSize} km \u00d7 ${kmSize} km)`,
          sections: [
            { title: 'OUTPUT SUMMARY', entries: [
              ['Total Rocks', total],
              ['Mode',        'SCMAP (props injected directly)'],
              ['Files',       writtenFiles.join(', ')],
            ]},
            { title: 'PROP BREAKDOWN', lines: [
              `  ${'Prop Name'.padEnd(25)} ${'Count'.padStart(6)}`,
              `  ${'\u2500'.repeat(50)}`,
              ...propTable,
              `  ${'\u2500'.repeat(50)}`,
            ]},
          ],
        });
        await writeReadme(`${mapFolderPath}\\RockErosion_Generation_README.txt`, readmeContent);
      }

      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder)
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });

      await luxuryAlert(`\u2713 ${total} rocks injected into ${scmapEntry.name} successfully!`);

    } catch (error) {
      await luxuryAlert('Error: ' + error.message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ current: 0, total: 0, file: '' });
    }
  };

  // ─── COUNTS SUMMARY ──────────────────────────────────────────────────────────
const allCounts = [
  ...rockCards.map(card => ({
    id: card.id,
    propName: card.propName,
    color: card.color,
    type: 'erosion',
    count: rockMarkers.filter(m =>
      m.cardType === 'erosion' && card.blueprintPaths.includes(m.blueprint)
    ).length,
    totalMass: rockMarkers
      .filter(m => m.cardType === 'erosion' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.mass || 0), 0),
    totalEnergy: rockMarkers
      .filter(m => m.cardType === 'erosion' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.energy || 0), 0),
  })),
   ...debrisCards.map(card => ({
    id: card.id,
    propName: card.propName,
    color: card.color,
    type: 'debris',
    count: rockMarkers.filter(m =>
      m.cardType === 'debris' && card.blueprintPaths.includes(m.blueprint)
    ).length,
    totalMass: rockMarkers
      .filter(m => m.cardType === 'debris' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.mass || 0), 0),
    totalEnergy: rockMarkers
      .filter(m => m.cardType === 'debris' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.energy || 0), 0),
  })),
  ...screeCards.map(card => ({
    id: card.id,
    propName: card.propName,
    color: card.color,
    type: 'scree',
    count: rockMarkers.filter(m =>
      m.cardType === 'scree' && card.blueprintPaths.includes(m.blueprint)
    ).length,
    totalMass: rockMarkers
      .filter(m => m.cardType === 'scree' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.mass || 0), 0),
    totalEnergy: rockMarkers
      .filter(m => m.cardType === 'scree' && card.blueprintPaths.includes(m.blueprint))
      .reduce((sum, m) => sum + (m.energy || 0), 0),
  }))
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="rockerosion-tab tab-scrollbar">
      {showRockBlueprintLibrary && (
        <PropsLibraryOverlay
          onConfirm={handlePropsLibraryConfirm}
          onClose={() => setShowRockBlueprintLibrary(false)}
          noTextureEditor
        />
      )}

      <div className="tab-grid">
        <div className="tab-col-config">
          <div className="section-card">
            <h2 className="section-title">
              CONFIGURATION
            </h2>
            <div className="subsection-title">Map Details</div>
            <div className="form-group">
              <label>Map Name</label>
              <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)}
                className="form-input" placeholder="e.g. Hades_Dust.v0002" />
              {mapInfo && (
                <div style={{
                  marginTop: '6px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'monospace',
                }}>
                  {mapInfo.ok ? (<>
                    <span style={{
                      color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit',
                    }}>MAP</span>
                    <span style={{color: 'rgba(255,255,255,0.55)', fontWeight: 600}}>
                      {mapInfo.mapSize} × {mapInfo.mapSize}
                    </span>
                    <span style={{color: 'rgba(255,255,255,0.22)'}}>·</span>
                    <span>{mapInfo.km} km</span>
                    {mapInfo.playableSize !== mapInfo.mapSize && (<>
                      <span style={{color: 'rgba(255,255,255,0.22)'}}>·</span>
                      <span style={{color: 'rgba(255,255,255,0.28)'}}>
                        playable {mapInfo.playableKm} km
                      </span>
                    </>)}
                  </>) : (
                    <span style={{color: 'rgba(255,100,100,0.5)', fontSize: '0.65rem'}}>
                      {mapInfo.error}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="subsection-title">Density</div>
            <div className="re-grid-2">
              <div>
                <label>Density Multiplier</label>
                <input type="number" step="0.1" min="0.00001" value={densityMultiplier}
                  onChange={(e) => setDensityMultiplier(e.target.value)}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) setDensityMultiplier('0.00001'); }} />
              </div>
              <div>
                <label>Diffusion (0–100)</label>
                <input type="number" step="1" min="0" max="100" value={diffusion}
                  onChange={(e) => setDiffusion(e.target.value)}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) setDiffusion('0'); else if (v > 100) setDiffusion('100'); }} />
              </div>
            </div>
            <div className="subsection-title">Grid Resolution</div>
            <div className="form-group">
              <label>
                Grid Resolution
                <span style={{ float: 'right', color: 'var(--rockerosion-color)', fontSize: '0.78rem' }}>
                  {parseInt(gridResolution || '100') ** 2} points
                </span>
              </label>
              <input type="number" step="10" min="1" max="2000" value={gridResolution}
                onChange={(e) => setGridResolution(e.target.value)}
                onBlur={(e) => { const v = parseInt(e.target.value); if (isNaN(v) || v < 1) setGridResolution('1'); else if (v > 2000) setGridResolution('2000'); }}
                className="form-input" />
            </div>
            <div className="subsection-title">Size Blending</div>
            <div className="form-group">
              <label>
                Size Blend Sigma (1–150)
              </label>
              <input type="number" step="1" min="1" max="150" value={sizeBlendSigma}
                className="form-input"
                onChange={(e) => setSizeBlendSigma(parseFloat(e.target.value) || 50)}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 1) setSizeBlendSigma(1); else if (v > 150) setSizeBlendSigma(150); }} />
            </div>

            <button onClick={handleRandomize} className="btn-secondary" style={{ width: '100%' }}>
              Randomize
            </button>
          </div>
          <div className="section-card re-rocktype-block">
            <div className="re-mode-switch-inner">
              <div className="re-mode-switch-title">Rock Type</div>
              <div className="re-mode-buttons">
                {['debris', 'scree', 'erosion'].map(tab => (
                  <div key={tab} className={`re-mode-button${rockTypeTab === tab ? ' active' : ''}`}
                    onClick={() => setRockTypeTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </div>
                ))}
              </div>
            </div>
          {rockTypeTab === 'debris' && (
            <div className="re-tab-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div className="section-title" style={{ margin: 0 }}>Debris Cards</div>
                {debrisCards.length >= 1 && (
                  <button
                    className="btn-delete-text"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', height: 'auto' }}
                    onClick={deleteAllDebrisCards}
                    title="Delete all debris cards"
                  >
                    Delete All
                  </button>
                )}
              </div>
              <div className="treemap-props-container">
              {debrisCards.map((card, idx) => (
                <div key={card.id} className={`treemap-prop-card${selectedDebrisCard === idx ? ' selected' : ''}`}
                  onClick={() => setSelectedDebrisCard(idx)}>
                  <div className="treemap-prop-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div className="treemap-color-indicator" style={{ backgroundColor: card.color }}
                        onClick={(e) => { e.stopPropagation(); setShowRockColorPicker(showRockColorPicker === `debris-${idx}` ? null : `debris-${idx}`); }} />
                      <input value={card.propName}
                        onChange={(e) => { e.stopPropagation(); updateCard('debris', idx, 'propName', e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Debris name..."
                        className="treemap-prop-name-input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {debrisCards.length > 1 && (
                        <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); deleteCard('debris', idx); }}>×</button>
                      )}
                    </div>
                  </div>

                  {showRockColorPicker === `debris-${idx}` && (
                    <div className="treemap-color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                      <div className="treemap-color-grid">
                        {availableColors.map((color, colorIdx) => (
                          <div key={colorIdx} className="treemap-color-option"
                            style={{ backgroundColor: color }}
                            onClick={() => { updateCard('debris', idx, 'color', color); setShowRockColorPicker(null); }} />
                        ))}
                      </div>
                      <input type="text" className="form-input" placeholder="Custom color (#HEX or hsl())"
                        style={{ marginTop: '10px' }}
                        onChange={(e) => { if (e.target.value) updateCard('debris', idx, 'color', e.target.value); }}
                        onClick={(e) => e.stopPropagation()} />
                    </div>
                  )}

                  {selectedDebrisCard === idx && (
                    <div className="treemap-prop-details" onClick={(e) => e.stopPropagation()}>
                      <div className="form-group">
                        <label>Debris Map</label>
                        <input type="file" ref={(el) => debrisSpawnMapRefs.current[idx] = el} accept="image/*"
                          onChange={(e) => handleSpawnMapUpload('debris', idx, e)} style={{ display: 'none' }} />
                        {card.spawnMapImage ? (
                          <div className="re-image-preview">
                            <img src={card.spawnMapImage} alt="Debris Map" />
                            <button className="btn-delete-xs" onClick={(e) => { e.stopPropagation(); clearSpawnMap('debris', idx); }}>×</button>
                          </div>
                        ) : (
                          <button className="btn-secondary" style={{ width: '100%' }}
                            onClick={(e) => { e.stopPropagation(); debrisSpawnMapRefs.current[idx]?.click(); }}>
                            Upload Debris Map
                          </button>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Blueprints</label>
                        {card.blueprintPaths.map((path, pi) => (
                          <div key={pi} className="input-row">
                            <input value={path} onChange={(e) => updateBlueprintPath('debris', idx, pi, e.target.value)}
                              placeholder="/env/Evergreen/Props/Rocks/Rock01_prop.bp" className="form-input"
                              style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8rem' }}
                              onClick={(e) => e.stopPropagation()} />
                            <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); removeBlueprintPath('debris', idx, pi); }}>×</button>
                          </div>
                        ))}
                        <button className="btn-library" style={{ width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); setLibraryTarget({ type: 'debris', index: idx }); setShowRockBlueprintLibrary(true); }}>Library</button>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <button
                          className="btn-secondary"
                          onClick={(e) => { e.stopPropagation(); updateCard('debris', idx, 'useCustomValues', !card.useCustomValues); }}
                          style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            ...(card.useCustomValues ? { borderColor: 'var(--tab-color)', color: 'var(--tab-color)', background: 'color-mix(in srgb, var(--tab-color) 8%, transparent)' } : {})
                          }}
                        >
                          <span>Custom Values</span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{card.useCustomValues ? '▲' : '▼'}</span>
                        </button>
                        {card.useCustomValues && (
                          <div className="re-custom-values-body"
                            onClick={(e) => e.stopPropagation()}>
                            <label>Density Multiplier</label>
                            <input type="number" step="0.1" min="0.00001" value={card.customDensityMultiplier}
                              onChange={(e) => updateCard('debris', idx, 'customDensityMultiplier', e.target.value)} />
                            <label>Diffusion (0–100)</label>
                            <input type="number" step="1" min="0" max="100" value={card.customDiffusion}
                              onChange={(e) => updateCard('debris', idx, 'customDiffusion', e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="treemap-add-prop-card" onClick={() => addCard('debris')}>
                <div className="treemap-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
                <span className="treemap-add-prop-text">ADD DEBRIS CARD</span>
              </div>
              </div>
            </div>
          )}
          {rockTypeTab === 'scree' && (
            <div className="re-tab-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div className="section-title" style={{ margin: 0 }}>Scree Cards</div>
                {screeCards.length >= 1 && (
                  <button
                    className="btn-delete-text"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', height: 'auto' }}
                    onClick={deleteAllScreeCards}
                    title="Delete all scree cards"
                  >
                    Delete All
                  </button>
                )}
              </div>
              <div className="treemap-props-container">
              {screeCards.map((card, idx) => (
                <div key={card.id} className={`treemap-prop-card${selectedScreeCard === idx ? ' selected' : ''}`}
                  onClick={() => setSelectedScreeCard(idx)}>
                  <div className="treemap-prop-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div className="treemap-color-indicator" style={{ backgroundColor: card.color }}
                        onClick={(e) => { e.stopPropagation(); setShowRockColorPicker(showRockColorPicker === `scree-${idx}` ? null : `scree-${idx}`); }} />
                      <input value={card.propName}
                        onChange={(e) => { e.stopPropagation(); updateCard('scree', idx, 'propName', e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Scree name..."
                        className="treemap-prop-name-input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {screeCards.length > 1 && (
                        <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); deleteCard('scree', idx); }}>×</button>
                      )}
                    </div>
                  </div>

                  {showRockColorPicker === `scree-${idx}` && (
                    <div className="treemap-color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                      <div className="treemap-color-grid">
                        {availableColors.map((color, colorIdx) => (
                          <div key={colorIdx} className="treemap-color-option"
                            style={{ backgroundColor: color }}
                            onClick={() => { updateCard('scree', idx, 'color', color); setShowRockColorPicker(null); }} />
                        ))}
                      </div>
                      <input type="text" className="form-input" placeholder="Custom color (#HEX or hsl())"
                        style={{ marginTop: '10px' }}
                        onChange={(e) => { if (e.target.value) updateCard('scree', idx, 'color', e.target.value); }}
                        onClick={(e) => e.stopPropagation()} />
                    </div>
                  )}

                  {selectedScreeCard === idx && (
                    <div className="treemap-prop-details" onClick={(e) => e.stopPropagation()}>
                      <div className="form-group">
                        <label>Scree Map</label>
                        <input type="file" ref={(el) => screeSpawnMapRefs.current[idx] = el} accept="image/*"
                          onChange={(e) => handleSpawnMapUpload('scree', idx, e)} style={{ display: 'none' }} />
                        {card.spawnMapImage ? (
                          <div className="re-image-preview">
                            <img src={card.spawnMapImage} alt="Scree Map" />
                            <button className="btn-delete-xs" onClick={(e) => { e.stopPropagation(); clearSpawnMap('scree', idx); }}>×</button>
                          </div>
                        ) : (
                          <button className="btn-secondary" style={{ width: '100%' }}
                            onClick={(e) => { e.stopPropagation(); screeSpawnMapRefs.current[idx]?.click(); }}>
                            Upload Scree Map
                          </button>
                        )}
                      </div>

                      <div className="form-group">
                        <label>
                          Spawn Threshold (0.0–1.0)
                          <small style={{ display: 'block', opacity: 0.7, marginTop: '4px' }}>
                            Min brightness to spawn. 0.1 = ignore near-black pixels
                          </small>
                        </label>
                        <input type="number" step="0.05" min="0" max="1"
                          value={card.spawnThreshold || '0.1'}
                          onChange={(e) => updateCard('scree', idx, 'spawnThreshold', e.target.value)}
                          className="form-input" />
                      </div>

                      <div className="form-group">
                        <label>Blueprints</label>
                        {card.blueprintPaths.map((path, pi) => (
                          <div key={pi} className="input-row">
                            <input value={path} onChange={(e) => updateBlueprintPath('scree', idx, pi, e.target.value)}
                              placeholder="/env/Evergreen/Props/Rocks/Rock01_prop.bp" className="form-input"
                              style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8rem' }}
                              onClick={(e) => e.stopPropagation()} />
                            <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); removeBlueprintPath('scree', idx, pi); }}>×</button>
                          </div>
                        ))}
                        <button className="btn-library" style={{ width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); setLibraryTarget({ type: 'scree', index: idx }); setShowRockBlueprintLibrary(true); }}>Library</button>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <button
                          className="btn-secondary"
                          onClick={(e) => { e.stopPropagation(); updateCard('scree', idx, 'useCustomValues', !card.useCustomValues); }}
                          style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            ...(card.useCustomValues ? { borderColor: 'var(--tab-color)', color: 'var(--tab-color)', background: 'color-mix(in srgb, var(--tab-color) 8%, transparent)' } : {})
                          }}
                        >
                          <span>Custom Values</span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{card.useCustomValues ? '▲' : '▼'}</span>
                        </button>
                        {card.useCustomValues && (
                          <div className="re-custom-values-body"
                            onClick={(e) => e.stopPropagation()}>
                            <label>Density Multiplier</label>
                            <input type="number" step="0.1" min="0.00001" value={card.customDensityMultiplier}
                              onChange={(e) => updateCard('scree', idx, 'customDensityMultiplier', e.target.value)} />
                            <label>Diffusion (0–100)</label>
                            <input type="number" step="1" min="0" max="100" value={card.customDiffusion}
                              onChange={(e) => updateCard('scree', idx, 'customDiffusion', e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="treemap-add-prop-card" onClick={() => addCard('scree')}>
                <div className="treemap-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
                <span className="treemap-add-prop-text">ADD SCREE CARD</span>
              </div>
              </div>
            </div>
          )}
            {rockTypeTab === 'erosion' && (<>
              <div className="re-tab-section">
              <div className="section-title">Erosion Maps</div>
              <p className="re-section-description">Upload masks to control gravitational rock distribution.</p>

              <div className="re-grid-2">
                <div>
                  <label>Where to spawn?</label>
                  <input type="file" ref={flowMaskInputRef} accept="image/*" onChange={handleFlowMaskUpload} style={{ display: 'none' }} />
                  {flowMask ? (
                    <div className="re-image-preview">
                      <img src={flowMask} alt="Flow Mask" />
                      <button className="btn-delete-xs" onClick={clearFlowMask}>×</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => flowMaskInputRef.current?.click()}>Upload Spawn Map</button>
                  )}
                </div>
                <div>
                  <label>Spawn probability</label>
                  <input type="file" ref={slopeMaskInputRef} accept="image/*" onChange={handleSlopeMaskUpload} style={{ display: 'none' }} />
                  {slopeMask ? (
                    <div className="re-image-preview">
                      <img src={slopeMask} alt="Slope Mask" />
                      <button className="btn-delete-xs" onClick={clearSlopeMask}>×</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => slopeMaskInputRef.current?.click()}>Upload Spawn Probability</button>
                  )}
                </div>
              </div>

              <div className="re-grid-2" style={{ marginTop: '15px' }}>
                <div>
                  <label>Size determination</label>
                  <input type="file" ref={erosionWearInputRef} accept="image/*" onChange={handleErosionWearUpload} style={{ display: 'none' }} />
                  {erosionWearMap ? (
                    <div className="re-image-preview">
                      <img src={erosionWearMap} alt="Erosion Wear" />
                      <button className="btn-delete-xs" onClick={clearErosionWearMap}>×</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => erosionWearInputRef.current?.click()}>Upload Size Determination</button>
                  )}
                </div>
                <div>
                  <label style={{ opacity: 0.8 }}>Clustering (Optional)</label>
                  <input type="file" ref={curvatureMapInputRef} accept="image/*" onChange={handleCurvatureMapUpload} style={{ display: 'none' }} />
                  {curvatureMap ? (
                    <div className="re-image-preview">
                      <img src={curvatureMap} alt="Curvature" />
                      <button className="btn-delete-xs" onClick={clearCurvatureMap}>×</button>
                    </div>
                  ) : (
                    <button className="btn-secondary" style={{ opacity: 0.8 }}
                      onClick={() => curvatureMapInputRef.current?.click()}>Upload Clustering</button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.8 }}>
                  Heightmap (Optional — Realistic Orientation)
                </label>
                <input type="file" ref={heightmapInputRef} accept="image/*" onChange={handleHeightmapUpload} style={{ display: 'none' }} />
                {heightmap ? (
                  <div className="re-image-preview">
                    <img src={heightmap} alt="Heightmap" />
                    <button className="btn-delete-xs" onClick={clearHeightmap}>×</button>
                  </div>
                ) : (
                  <button className="btn-secondary" style={{ width: '100%', opacity: 0.8 }}
                    onClick={() => heightmapInputRef.current?.click()}>Upload Heightmap</button>
                )}
              </div>
            </div>
            <div className="re-tab-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div className="section-title" style={{ margin: 0 }}>Rock Configuration</div>
                {rockCards.length >= 1 && (
                  <button
                    className="btn-delete-text"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', height: 'auto' }}
                    onClick={deleteAllRockCards}
                    title="Delete all rock configuration"
                  >
                    Delete All
                  </button>
                )}
              </div>
              <div className="treemap-props-container">
              {rockCards.map((card, idx) => (
                <div key={card.id} className={`treemap-prop-card${selectedRock === idx ? ' selected' : ''}`}
                  onClick={() => setSelectedRock(idx)}>
                  <div className="treemap-prop-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div className="treemap-color-indicator" style={{ backgroundColor: card.color }}
                        onClick={(e) => { e.stopPropagation(); setShowRockColorPicker(showRockColorPicker === `erosion-${idx}` ? null : `erosion-${idx}`); }} />
                      <input value={card.propName}
                        onChange={(e) => { e.stopPropagation(); updateRockCard(idx, 'propName', e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Rock name..."
                        className="treemap-prop-name-input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {rockCards.length > 1 && (
                        <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); deleteRockCard(idx); }}>×</button>
                      )}
                    </div>
                  </div>

                  {showRockColorPicker === `erosion-${idx}` && (
                    <div className="treemap-color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                      <div className="treemap-color-grid">
                        {availableColors.map((color, colorIdx) => (
                          <div key={colorIdx} className="treemap-color-option"
                            style={{ backgroundColor: color }}
                            onClick={() => { updateRockCard(idx, 'color', color); setShowRockColorPicker(null); }} />
                        ))}
                      </div>
                      <input type="text" className="form-input" placeholder="Custom color (#HEX or hsl())"
                        style={{ marginTop: '10px' }}
                        onChange={(e) => { if (e.target.value) updateRockCard(idx, 'color', e.target.value); }}
                        onClick={(e) => e.stopPropagation()} />
                    </div>
                  )}

                  {selectedRock === idx && (
                    <div className="treemap-prop-details" onClick={(e) => e.stopPropagation()}>
                      <div className="form-group">
                        <label>Blueprints</label>
                        {card.blueprintPaths.map((path, pi) => (
                          <div key={pi} className="input-row">
                            <input value={path} onChange={(e) => updateRockBlueprintPath(idx, pi, e.target.value)}
                              placeholder="/env/Evergreen/Props/Rocks/Rock01_prop.bp" className="form-input"
                              style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8rem' }}
                              onClick={(e) => e.stopPropagation()} />
                            <button className="btn-delete-sm" onClick={(e) => { e.stopPropagation(); removeRockBlueprintPath(idx, pi); }}>×</button>
                          </div>
                        ))}
                        <button className="btn-library" style={{ width: '100%' }}
                          onClick={(e) => { e.stopPropagation(); setLibraryTarget({ type: 'erosion', index: idx }); setShowRockBlueprintLibrary(true); }}>Library</button>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <button
                          className="btn-secondary"
                          onClick={(e) => { e.stopPropagation(); updateRockCard(idx, 'useCustomValues', !card.useCustomValues); }}
                          style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            ...(card.useCustomValues ? { borderColor: 'var(--tab-color)', color: 'var(--tab-color)', background: 'color-mix(in srgb, var(--tab-color) 8%, transparent)' } : {})
                          }}
                        >
                          <span>Custom Values</span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{card.useCustomValues ? '▲' : '▼'}</span>
                        </button>
                        {card.useCustomValues && (
                          <div className="re-custom-values-body"
                            onClick={(e) => e.stopPropagation()}>
                            <label>Density Multiplier</label>
                            <input type="number" step="0.1" min="0.00001" value={card.customDensityMultiplier}
                              onChange={(e) => updateRockCard(idx, 'customDensityMultiplier', e.target.value)}
                              onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) updateRockCard(idx, 'customDensityMultiplier', '0.00001'); }} />
                            <label>Diffusion (0–100)</label>
                            <input type="number" step="1" min="0" max="100" value={card.customDiffusion}
                              onChange={(e) => updateRockCard(idx, 'customDiffusion', e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="treemap-add-prop-card" onClick={addRockCard}>
                <div className="treemap-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
                <span className="treemap-add-prop-text">ADD ROCK CARD</span>
              </div>
              </div>
            </div>
          </>)}

          </div>
          <div className="section-card">
            <label className="checkbox-label" style={{ marginBottom: '12px' }} onClick={() => setGenerateReadme(v => !v)}>
              <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
                {generateReadme && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">Generate README file</span>
            </label>
            <label className="checkbox-label" style={{ marginBottom: '20px' }} onClick={() => setExportRawLua(v => !v)}>
              <div className={`checkbox${exportRawLua ? ' checked' : ''}`}>
                {exportRawLua && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">Export props.lua (no SCMAP)</span>
            </label>

            {isGenerating ? (
              <div style={{ marginTop: '16px' }}>
                <div className="re-progress-title">Generating Files...</div>
                <div className="re-progress-bar">
                  <div className="re-progress-fill"
                    style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }} />
                </div>
                <div className="re-progress-text">
                  {generationProgress.file} ({generationProgress.current}/{generationProgress.total})
                </div>
              </div>
            ) : (
              <button onClick={generateFiles} className="btn-primary btn-lg" style={{ marginTop: '16px' }}>
                GENERATE FILES
              </button>
            )}
          </div>

        </div>
        <div className="re-preview-column">
          <div className="section-card re-preview-card">
            <div className="re-preview-header">
              <div className="section-title" style={{ margin: 0 }}>PREVIEW</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  className="re-mirror-dropdown"
                  value={mirrorMode}
                  onChange={(e) => { setMirrorMode(e.target.value); triggerRegenerate(); }}
                >
                  <option value="none">No Mirror</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
                {previewImage && (
                  <button className="btn-danger-small" onClick={deletePreview}>Delete Preview</button>
                )}
              </div>
            </div>
            <div className="re-upload-area" onClick={() => previewUploadRef.current?.click()}>
              <span>{previewLoading ? 'Loading preview from SCMAP…' : 'Click to upload map image'}</span>
              <input ref={previewUploadRef} type="file" style={{ display: 'none' }}
                accept="image/*" onChange={handlePreviewUpload} />
            </div>
            <div className="re-canvas-wrapper" style={{ position: 'relative', width: '700px', height: '700px' }}>
              <canvas ref={canvasRef} width={800} height={800} style={{ width: '100%', height: '100%', display: 'block' }} />
              {!previewImage && rockMarkers.length === 0 && (
                <div className="re-canvas-placeholder">
                  <p>Upload erosion maps to generate rocks</p>
                </div>
              )}
            </div>
            <div className="preview-legend">
              <div className="preview-legend-title">ROCK LEGEND</div>
              <div className="preview-legend-items">
                {allCounts.every(i => i.count === 0) ? (
                  <div className="preview-legend-item">
                    <div className="preview-legend-color" style={{ backgroundColor: 'var(--rockerosion-color)' }} />
                    <span>Erosion Rocks</span>
                    <span className="preview-coord-count">0 pts</span>
                  </div>
                ) : (
                  allCounts.filter(i => i.count > 0).map((item, idx) => (
                    <div key={`rock-${idx}`} className="preview-legend-item">
                      <div className="preview-legend-color" style={{ backgroundColor: item.color }} />
                      <span>{item.propName || `Rock ${idx + 1}`}</span>
                      <div className="preview-economy-row">
                        {item.totalMass > 0 && (
                          <div className="preview-economy-stat">
                            <img src="assets/icons/Library/mass.png" alt="M" />
                            <span>{item.totalMass.toLocaleString()}</span>
                          </div>
                        )}
                        {item.totalEnergy > 0 && (
                          <div className="preview-economy-stat">
                            <img src="assets/icons/Library/energy.png" alt="E" />
                            <span>{item.totalEnergy.toLocaleString()}</span>
                          </div>
                        )}
                        <span className="preview-coord-count">{item.count} pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="preview-hint-box">
              Upload erosion maps to generate rocks — use Randomize to reseed placement
            </div>

          </div>
        </div>
      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help Guide">?</button>
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

      </div>
    </div>
  );
}

export default RockErosionTab;