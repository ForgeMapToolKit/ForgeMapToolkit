import React, { useState, useRef, useEffect } from 'react';
import '../../../Shared/shared.css';
import './Trees.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibrary from '../../../Shared/Libraries/PropsLibrary/PropsLibrary';
import TreesHelpModal from '../../HelpModals/Trees_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { DropSlot, AddTile } from '../../../Shared/Ui/EntityPanel/EntityPanel';

// ─────────────────────────────────────────────────────────────────────────────
// HELP REPLICA — STATIC UI CLONE
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// IPC HELPERS
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CARD CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PROP_CARD = {
  id: Date.now(),
  propName: 'Oak Trees',
  blueprintPaths: [''],
  determineAreaImage: null, determineAreaData: null,
  propDensityMapImage: null, propDensityMapData: null,
  useCustomTreeline: false,
  customTreelineImage: null, customTreelineData: null,
  customTreeline: '200', customTreelineGradient: '30',
  customTreelineMin: '0', customTreelineMinGradient: '30',
  color: '#00FF66',
  customValuesOpen: false, customActiveTab: null,
  customDensityMultiplier: '1.0', customDiffusion: '0',
  customDecimalPlacesCoords: '2', customDecimalPlacesHeading: '2',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TreemapTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {

  const s = shared;

// ─────────────────────────────────────────────────────────────────────────────
// STATE — SHARED / PERSISTENT
// ─────────────────────────────────────────────────────────────────────────────
  const [mapSize,              setMapSizeState]              = useState(s.tm_mapSize              ?? settings?.defaultMapSize      ?? '1024');
  const [mapName,              setMapNameState]              = useState(s.tm_mapName              ?? '');
  const [mapsFolderPath,       setMapsFolderPathState]       = useState(s.tm_mapsFolderPath       ?? settings?.mapsFolder           ?? '');
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
        onSharedChange('tm_mapSize', String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);
  const [densityMultiplier,    setDensityMultiplierState]    = useState(s.tm_densityMultiplier    ?? '1.0');
  const [decimalPlacesCoords,  setDecimalPlacesCoordsState]  = useState(s.tm_decimalPlacesCoords  ?? String(settings?.defaultDecimalCoords  ?? '2'));
  const [decimalPlacesHeading, setDecimalPlacesHeadingState] = useState(s.tm_decimalPlacesHeading ?? String(settings?.defaultDecimalHeading ?? '2'));
  const [treelineMin,          setTreelineMinState]          = useState(s.tm_treelineMin          ?? '0');
  const [treelineMinGradient,  setTreelineMinGradientState]  = useState(s.tm_treelineMinGradient  ?? '30');
  const [diffusion,            setDiffusionState]            = useState(s.tm_diffusion            ?? '0');
  const [gridResolution,       setGridResolutionState]       = useState(s.tm_gridResolution       ?? '100');
  const [mirrorMode,           setMirrorModeState]           = useState(s.tm_mirrorMode ?? settings?.defaultMirrorMode ?? 'none');
  const [treeline,             setTreelineState]             = useState(s.tm_treeline             ?? '200');
  const [treelineGradient,     setTreelineGradientState]     = useState(s.tm_treelineGradient     ?? '30');

  const [generateReadme,       setGenerateReadmeState]       = useState(s.tm_generateReadme       ?? (settings?.generateReadme !== false));
  const [exportRawLua,         setExportRawLuaState]         = useState(s.tm_exportRawLua         ?? false);
  const [propCards,            setPropCardsState]            = useState(s.tm_propCards            ?? [{ ...DEFAULT_PROP_CARD, id: Date.now() }]);
  const [blueprintMassMap,     setBlueprintMassMapState]     = useState(s.tm_blueprintMassMap     ?? {});
  const [blueprintEnergyMap,   setBlueprintEnergyMapState]   = useState(s.tm_blueprintEnergyMap   ?? {});

// ─────────────────────────────────────────────────────────────────────────────
// STATE SETTERS — SYNC TO SHARED
// ─────────────────────────────────────────────────────────────────────────────
  const setMapSize              = v => { setMapSizeState(v);              onSharedChange('tm_mapSize', v); };
  const setMapName              = v => { setMapNameState(v);              onSharedChange('tm_mapName', v); };
  const setMapsFolderPath       = v => { setMapsFolderPathState(v);       onSharedChange('tm_mapsFolderPath', v); };
  const setDensityMultiplier    = v => { setDensityMultiplierState(v);    onSharedChange('tm_densityMultiplier', v); };
  const setDecimalPlacesCoords  = v => { setDecimalPlacesCoordsState(v);  onSharedChange('tm_decimalPlacesCoords', v); };
  const setDecimalPlacesHeading = v => { setDecimalPlacesHeadingState(v); onSharedChange('tm_decimalPlacesHeading', v); };
  const setTreelineMin          = v => { setTreelineMinState(v);          onSharedChange('tm_treelineMin', v); };
  const setTreelineMinGradient  = v => { setTreelineMinGradientState(v);  onSharedChange('tm_treelineMinGradient', v); };
  const setDiffusion            = v => { setDiffusionState(v);            onSharedChange('tm_diffusion', v); };
  const setGridResolution       = v => { setGridResolutionState(v);       onSharedChange('tm_gridResolution', v); };
  const setMirrorMode           = v => { setMirrorModeState(v);           onSharedChange('tm_mirrorMode', v); };
  const setTreeline             = v => { setTreelineState(v);             onSharedChange('tm_treeline', v); };
  const setTreelineGradient     = v => { setTreelineGradientState(v);     onSharedChange('tm_treelineGradient', v); };

  const setGenerateReadme       = v => { setGenerateReadmeState(v);       onSharedChange('tm_generateReadme', v); };
  const setExportRawLua         = v => { setExportRawLuaState(v);         onSharedChange('tm_exportRawLua', v); };
  const setBlueprintMassMap     = v => { setBlueprintMassMapState(v);     onSharedChange('tm_blueprintMassMap', v); };
  const setBlueprintEnergyMap   = v => { setBlueprintEnergyMapState(v);   onSharedChange('tm_blueprintEnergyMap', v); };
  const setPropCards            = v => {

    setPropCardsState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;

      onSharedChange('tm_propCards', next.map(c => ({
        ...c,
        determineAreaImage: null, determineAreaData: null,
        propDensityMapImage: null, propDensityMapData: null,
        customTreelineImage: null, customTreelineData: null,
      })));
      return next;
    });
  };

// ─────────────────────────────────────────────────────────────────────────────
// STATE — LOCAL UI
// ─────────────────────────────────────────────────────────────────────────────
  const [densityMap, setDensityMap] = useState(null);
  const [densityMapData, setDensityMapData] = useState(null);
  const [exclusionZone, setExclusionZone] = useState(null);
  const [exclusionZoneData, setExclusionZoneData] = useState(null);
  const [seed, setSeed] = useState(Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('help-guide');
  const [helpGuideSelected, setHelpGuideSelected] = useState(null);
  const [activeAdvancedSubTab, setActiveAdvancedSubTab] = useState('workflow');
  const [activeSection, setActiveSection] = useState('setup');
  const mirrorModeRef = useRef(mirrorMode);
useEffect(() => { mirrorModeRef.current = mirrorMode; }, [mirrorMode]);

useEffect(() => {
  if (!settings) return;
  if (settings.mapsFolder)                    setMapsFolderPath(settings.mapsFolder);
  if (settings.defaultMapSize)                setMapSize(settings.defaultMapSize);
  if (settings.defaultDecimalCoords != null)  setDecimalPlacesCoords(String(settings.defaultDecimalCoords));
  if (settings.defaultDecimalHeading != null) setDecimalPlacesHeading(String(settings.defaultDecimalHeading));
  if (settings.generateReadme != null)        setGenerateReadme(settings.generateReadme !== false);
  if (settings.defaultMirrorMode != null)     setMirrorMode(settings.defaultMirrorMode);
}, [settings]);

  const [selectedProp, setSelectedProp] = useState(0);
  const [propMarkers, setPropMarkers] = useState([]);

  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(null);

const [previewImage, setPreviewImage] = useState(null);
const [previewImageData, setPreviewImageData] = useState(null);
const [previewLoading, setPreviewLoading] = useState(false);

const [isGenerating, setIsGenerating] = useState(false);
const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, file: '' });

const canvasRef = useRef(null);
  const densityMapInputRef = useRef(null);
  const exclusionZoneInputRef = useRef(null);
  const [heightmap, setHeightmap] = useState(null);
const [heightmapData, setHeightmapData] = useState(null);
const heightmapInputRef = useRef(null);
  const determineAreaInputRefs = useRef({});
  const propDensityMapInputRefs = useRef({});
  const cardHeightmapInputRefs = useRef({});
  const previewUploadRef = useRef(null);

  const availableColors = [
    '#FFAF00', '#FF7B00', '#FFFA00', '#A5E801', '#538A33', '#8A12BD',
    '#00DDFF', '#3B76FF', '#FE1818', '#3EA387', '#18C748', '#00FF66', '#FFFFFF', '#000000'
  ];

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT — REGENERATE MARKERS ON CHANGE
// ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
  if (densityMapData) {
    generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, propCards);
  }
}, [propCards, seed, densityMultiplier, gridResolution, mapSize, treeline, treelineGradient, treelineMin, treelineMinGradient, heightmapData]);

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT — PREVIEW IMAGE SYNC
// ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (previewImageData) setPreviewImage(previewImageData);
  }, [previewImageData]);

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-LOAD PREVIEW FROM SCMAP
// ─────────────────────────────────────────────────────────────────────────────
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
      console.warn('[Trees] preview load failed:', e);
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
    };
    reader.readAsDataURL(file);
  };

const addPropCard = () => {
  setPropCards([...propCards, {
    id: Date.now(),
    propName: '',
    blueprintPaths: [''],
    determineAreaImage: null,
    determineAreaData: null,
    propDensityMapImage: null,
    propDensityMapData: null,
    color: availableColors[Math.floor(Math.random() * availableColors.length)],
    customValuesOpen: false,
    customActiveTab: null,
    customDensityMultiplier: '1.0',
    customTreelineImage: null, customTreelineData: null,
    useCustomTreeline: false,
    customTreeline: '200', customTreelineGradient: '30',
    customTreelineMin: '0', customTreelineMinGradient: '30',
    customDiffusion: '0',
    customDecimalPlacesCoords: '2',
    customDecimalPlacesHeading: '2',
  }]);
  setSelectedProp(propCards.length);
};

  const deleteAllPropCards = async () => {
    const confirmed = await luxuryConfirm('Delete all prop cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setPropCards([{ ...DEFAULT_PROP_CARD, id: Date.now() }]);
    setSelectedProp(0);
  };

  const deletePropCard = (index) => {
    if (propCards.length === 1) return;
    setPropCards(propCards.filter((_, i) => i !== index));
    if (selectedProp >= index && selectedProp > 0) setSelectedProp(selectedProp - 1);
  };

  const updatePropCard = (index, field, value) => {
    const newCards = [...propCards];
    newCards[index][field] = value;
    setPropCards(newCards);
  };

  const addBlueprintPath = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].blueprintPaths.push('');
    setPropCards(newCards);
  };

  const removeBlueprintPath = (propIndex, pathIndex) => {
    const newCards = [...propCards];
    if (newCards[propIndex].blueprintPaths.length > 1) {
      newCards[propIndex].blueprintPaths.splice(pathIndex, 1);
    }
    setPropCards(newCards);
  };

  const updateBlueprintPath = (propIndex, pathIndex, value) => {
    const newCards = [...propCards];
    newCards[propIndex].blueprintPaths[pathIndex] = value;
    setPropCards(newCards);
  };

  const handlePropsLibraryConfirm = (selectedProps) => {
    const propIndex = showBlueprintLibrary;
    if (propIndex === null || propIndex === undefined) return;
    const newMassMap   = { ...blueprintMassMap };
    const newEnergyMap = { ...blueprintEnergyMap };
    selectedProps.forEach(prop => {
      const gp = prop.gamePath || prop.id;
      if (gp && prop.reclaimMass   != null) newMassMap[gp]   = prop.reclaimMass;
      if (gp && prop.reclaimEnergy != null) newEnergyMap[gp] = prop.reclaimEnergy;
    });
    setBlueprintMassMap(newMassMap);
    setBlueprintEnergyMap(newEnergyMap);
    const newCards = [...propCards];
    newCards[propIndex].blueprintPaths = newCards[propIndex].blueprintPaths.filter(p => p.trim());
    selectedProps.forEach(prop => {
      const gamePath = prop.gamePath || prop.id;
      if (gamePath && !newCards[propIndex].blueprintPaths.includes(gamePath)) {
        newCards[propIndex].blueprintPaths.push(gamePath);
      }
    });
    if (!newCards[propIndex].blueprintPaths.some(p => !p)) {
      newCards[propIndex].blueprintPaths.push('');
    }
    setPropCards(newCards);
  };

  const handleDetermineAreaUpload = (propIndex, e) => {
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
        const newCards = [...propCards];
        newCards[propIndex].determineAreaImage = event.target.result;
        newCards[propIndex].determineAreaData = data;
        setPropCards(newCards);
        if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clearDetermineArea = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].determineAreaImage = null;
    newCards[propIndex].determineAreaData = null;
    setPropCards(newCards);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
  };

  const handlePropDensityMapUpload = (propIndex, e) => {
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
        const newCards = [...propCards];
        newCards[propIndex].propDensityMapImage = event.target.result;
        newCards[propIndex].propDensityMapData = data;
        setPropCards(newCards);
        if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clearPropDensityMap = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].propDensityMapImage = null;
    newCards[propIndex].propDensityMapData = null;
    setPropCards(newCards);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
  };

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
  const seededRandom = (seed) => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

// ─────────────────────────────────────────────────────────────────────────────
// PIXEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
  const isInExclusionZone = (x, y, data, w, h) => {
    if (!data) return false;
    const i = (y * w + x) * 4;
    return ((data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3) > 128;
  };

  const isInDetermineArea = (x, y, data, w, h) => {
    if (!data) return true;
    const i = (y * w + x) * 4;
    return ((data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3) >= 127;
  };

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
const processDensityMap = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setDensityMapData(data);
    generatePropMarkers(data, img.width, img.height);
  };
  img.src = imageData;
};

const processExclusionZone = (imageData) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    setExclusionZoneData(data);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, data);
  };
  img.src = imageData;
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKER GENERATION
// ─────────────────────────────────────────────────────────────────────────────
const generatePropMarkers = (imageData, width, height, exclusionData = exclusionZoneData, hmData = heightmapData, cards = propCards) => {
const markers = [];
const mapSizeNum = parseFloat(mapSize);
const globalDensityMult = parseFloat(densityMultiplier);
const globalDiffusionAmount = parseFloat(diffusion) / 100;
let currentSeed = seed;
const treelineValue = parseFloat(treeline);
const gradientWidth = parseFloat(treelineGradient);
const treelineMinValue = parseFloat(treelineMin);
const gradientMinWidth = parseFloat(treelineMinGradient);

const globalGridRes = Math.max(1, parseInt(gridResolution || '100'));
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

currentSeed = seed;
for (const [px, py] of samplePoints) {
  const x = Math.min(width  - 1, Math.round(px));
  const y = Math.min(height - 1, Math.round(py));

  if (exclusionData && isInExclusionZone(x, y, exclusionData, width, height)) continue;

  const i = (y * width + x) * 4;
  const globalBrightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;

  cards.forEach(card => {
    const valid = card.blueprintPaths.filter(bp => bp && bp.trim());
    if (valid.length === 0) return;
    if (card.determineAreaData && !isInDetermineArea(x, y, card.determineAreaData, width, height)) return;

    let brightness;
    if (card.propDensityMapData) {
      const propI = (y * width + x) * 4;
      brightness = (card.propDensityMapData.data[propI] +
                   card.propDensityMapData.data[propI + 1] +
                   card.propDensityMapData.data[propI + 2]) / 3;
    } else {
      brightness = globalBrightness;
    }

    const activeHmData = (card.useCustomTreeline && card.customTreelineData)
      ? card.customTreelineData
      : hmData;
    const activeCutoff = (card.useCustomTreeline && card.customTreelineData)
      ? parseFloat(card.customTreeline)
      : treelineValue;
    const activeGradient = (card.useCustomTreeline && card.customTreelineData)
      ? parseFloat(card.customTreelineGradient)
      : gradientWidth;
    const activeCutoffMin = (card.useCustomTreeline && card.customTreelineData)
      ? parseFloat(card.customTreelineMin)
      : treelineMinValue;
    const activeGradientMin = (card.useCustomTreeline && card.customTreelineData)
      ? parseFloat(card.customTreelineMinGradient)
      : gradientMinWidth;

    let heightFactor = 1.0;
    if (activeHmData) {
      const hmX = Math.min(activeHmData.width  - 1, Math.round(x * (activeHmData.width  / width)));
      const hmY = Math.min(activeHmData.height - 1, Math.round(y * (activeHmData.height / height)));
      const hi = (hmY * activeHmData.width + hmX) * 4;
      const heightBrightness = (activeHmData.data[hi] + activeHmData.data[hi + 1] + activeHmData.data[hi + 2]) / 3;

      const gradientStart = activeCutoff - activeGradient;
      if (heightBrightness >= activeCutoff) {
        heightFactor = 0.0;
      } else if (heightBrightness >= gradientStart && activeGradient > 0) {
        heightFactor = 1.0 - (heightBrightness - gradientStart) / activeGradient;
      }

      const gradientEndMin = activeCutoffMin + activeGradientMin;
      if (heightBrightness <= activeCutoffMin) {
        heightFactor = 0.0;
      } else if (heightBrightness <= gradientEndMin && activeGradientMin > 0) {
        heightFactor = Math.min(heightFactor, (heightBrightness - activeCutoffMin) / activeGradientMin);
      }
    }

    if (heightFactor === 0.0) return;

    const cardDensityMult = card.customValuesOpen
      ? parseFloat(card.customDensityMultiplier)
      : globalDensityMult;

    currentSeed++;
    if (seededRandom(currentSeed) < (brightness / 255) * cardDensityMult * heightFactor) {
      currentSeed++;
      const blueprint = valid[Math.floor(seededRandom(currentSeed) * valid.length)];

      const cardDiffusionAmount = card.customValuesOpen
        ? parseFloat(card.customDiffusion) / 100
        : globalDiffusionAmount;

      let finalX, finalZ;
      const exactX = (px / width) * mapSizeNum + mapOffsetX;
      const exactZ = (py / height) * mapSizeNum + mapOffsetY;

      if (cardDiffusionAmount === 0) {
        finalX = exactX;
        finalZ = exactZ;
      } else if (cardDiffusionAmount === 1) {
        currentSeed++;
        finalX = mapOffsetX + seededRandom(currentSeed) * mapSizeNum;
        currentSeed++;
        finalZ = mapOffsetY + seededRandom(currentSeed) * mapSizeNum;
      } else {
        currentSeed++;
        const randomX = mapOffsetX + seededRandom(currentSeed) * mapSizeNum;
        currentSeed++;
        const randomZ = mapOffsetY + seededRandom(currentSeed) * mapSizeNum;
        finalX = exactX * (1 - cardDiffusionAmount) + randomX * cardDiffusionAmount;
        finalZ = exactZ * (1 - cardDiffusionAmount) + randomZ * cardDiffusionAmount;
      }

      currentSeed++;
      markers.push({
        id: currentSeed,
        x: finalX,
        y: 0,
        z: finalZ,
        heading: seededRandom(currentSeed) * Math.PI * 2,
        blueprint,
        propName: card.propName,
        color: card.color,
        customDecimalPlacesCoords: card.customValuesOpen ? card.customDecimalPlacesCoords : null,
        customDecimalPlacesHeading: card.customValuesOpen ? card.customDecimalPlacesHeading : null
      });
    }
  });
}
const currentMirror = mirrorModeRef.current;
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
    markers.push({ ...m, id: m.id + 0.5, x: mx, z: mz, heading: mHeading, isMirrored: true });
  });
}
setPropMarkers(markers);
}

// ─────────────────────────────────────────────────────────────────────────────
// RANDOMIZE
// ─────────────────────────────────────────────────────────────────────────────
  const handleRandomize = () => {
    setSeed(Date.now());
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height);
  };

// ─────────────────────────────────────────────────────────────────────────────
// DENSITY / EXCLUSION UPLOAD HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
const handleDensityMapUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setDensityMap(event.target.result);
      processDensityMap(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const handleExclusionZoneUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      setExclusionZone(event.target.result);
      processExclusionZone(event.target.result);
    };
    reader.readAsDataURL(file);
  }
};

const clearDensityMap = () => {
  setDensityMap(null);
  setDensityMapData(null);
  setPropMarkers([]);
};

const clearExclusionZone = () => {
  setExclusionZone(null);
  setExclusionZoneData(null);
  if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, null, heightmapData);
};

// ─────────────────────────────────────────────────────────────────────────────
// PROP COUNTS
// ─────────────────────────────────────────────────────────────────────────────
const allCounts = propCards.map(card => {
  const cardMarkers = propMarkers.filter(m => card.blueprintPaths.includes(m.blueprint));
  return {
    id: card.id,
    propName: card.propName,
    color: card.color,
    count:       cardMarkers.length,
    totalMass:   cardMarkers.reduce((sum, m) => sum + (blueprintMassMap[m.blueprint]   || 0), 0),
    totalEnergy: cardMarkers.reduce((sum, m) => sum + (blueprintEnergyMap[m.blueprint] || 0), 0),
  };
});

// DropSlot-compatible handlers (receive File directly, not an Event)
const handleDensityMapFile    = (file) => { if (!file) { clearDensityMap(); return; } const r = new FileReader(); r.onload = ev => { setDensityMap(ev.target.result); processDensityMap(ev.target.result); }; r.readAsDataURL(file); };
const handleExclusionZoneFile = (file) => { if (!file) { clearExclusionZone(); return; } const r = new FileReader(); r.onload = ev => { setExclusionZone(ev.target.result); processExclusionZone(ev.target.result); }; r.readAsDataURL(file); };
const handleHeightmapFile     = (file) => { if (!file) { clearHeightmap(); return; } const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); c.width = img.width; c.height = img.height; ctx.drawImage(img,0,0); const d = ctx.getImageData(0,0,img.width,img.height); setHeightmap(ev.target.result); setHeightmapData(d); if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height); }; img.src = ev.target.result; }; r.readAsDataURL(file); };
const handleCardHeightmapFile = (propIndex, file) => { if (!file) { clearCardHeightmap(propIndex); return; } const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); c.width = img.width; c.height = img.height; ctx.drawImage(img,0,0); const d = ctx.getImageData(0,0,img.width,img.height); const nc = [...propCards]; nc[propIndex].customTreelineImage = ev.target.result; nc[propIndex].customTreelineData = d; nc[propIndex].useCustomTreeline = true; setPropCards(nc); if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc); }; img.src = ev.target.result; }; r.readAsDataURL(file); };
const handleDetermineAreaFile = (propIndex, file) => { if (!file) { clearDetermineArea(propIndex); return; } const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); c.width = img.width; c.height = img.height; ctx.drawImage(img,0,0); const d = ctx.getImageData(0,0,img.width,img.height); const nc = [...propCards]; nc[propIndex].determineAreaImage = ev.target.result; nc[propIndex].determineAreaData = d; setPropCards(nc); if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc); }; img.src = ev.target.result; }; r.readAsDataURL(file); };
const handlePropDensityMapFile = (propIndex, file) => { if (!file) { clearPropDensityMap(propIndex); return; } const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); c.width = img.width; c.height = img.height; ctx.drawImage(img,0,0); const d = ctx.getImageData(0,0,img.width,img.height); const nc = [...propCards]; nc[propIndex].propDensityMapImage = ev.target.result; nc[propIndex].propDensityMapData = d; setPropCards(nc); if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc); }; img.src = ev.target.result; }; r.readAsDataURL(file); };

// ─────────────────────────────────────────────────────────────────────────────
// HEIGHTMAP HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
const handleHeightmapUpload = (e) => {
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
      setHeightmap(event.target.result);
      setHeightmapData(data);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const clearHeightmap = () => {
  setHeightmap(null);
  setHeightmapData(null);
  if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height);
};

const handleCardHeightmapUpload = (propIndex, e) => {
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
      const newCards = [...propCards];
      newCards[propIndex].customTreelineImage = event.target.result;
      newCards[propIndex].customTreelineData = data;
      newCards[propIndex].useCustomTreeline = true;
      setPropCards(newCards);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const clearCardHeightmap = (propIndex) => {
  const newCards = [...propCards];
  newCards[propIndex].customTreelineImage = null;
  newCards[propIndex].customTreelineData = null;
  newCards[propIndex].useCustomTreeline = false;
  setPropCards(newCards);
  if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
};

// ─────────────────────────────────────────────────────────────────────────────
// FILE SYSTEM HELPERS (IPC)
// ─────────────────────────────────────────────────────────────────────────────
const writeFile = async (filePath, content) => {
  const res = await window.electronAPI.invoke('write-file', { filePath, content });
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

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT — CANVAS DRAW
// ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

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
        const mapSizeNum = parseFloat(mapSize);
        propMarkers.forEach(marker => {
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
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      const gridSize = canvas.width / 8;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(i * gridSize, 0); ctx.lineTo(i * gridSize, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * gridSize); ctx.lineTo(canvas.width, i * gridSize); ctx.stroke();
      }

      if (propMarkers.length > 0) {
        const mapSizeNum = parseFloat(mapSize);
        propMarkers.forEach(marker => {
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
  }, [previewImage, propMarkers, mapSize, mirrorMode]);

// ─────────────────────────────────────────────────────────────────────────────
// LUA OUTPUT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
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
    lua += `        scale = {\n            1,\n            1,\n            1,\n        },\n`;
    lua += `    },\n`;
  }
  lua += '}\n';
  return lua;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILE GENERATION
// ─────────────────────────────────────────────────────────────────────────────
const generateFiles = async () => {
  const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
  if (!mapsFolder) {
    await luxuryAlert('No maps folder configured. Please set the Maps Folder in Settings.');
    return;
  }
  if (!mapName) {
    await luxuryAlert('Please enter a map name.');
    return;
  }
  if (propMarkers.length === 0) {
    await luxuryAlert('No prop markers generated. Upload a density map and configure props first.');
    return;
  }

  let finalMapName = mapName.trim();
  if (!finalMapName.match(/\.v\d{4}$/)) {
    finalMapName += '.v0001';
  }

  setIsGenerating(true);

  try {
    const mapFolderPath = `${mapsFolder}\\${finalMapName}`;
    await ensureDir(mapFolderPath);

    const coordDecimals = 1;
    const headingDecimals = 1;

    const markersByBlueprint = {};
    propMarkers.forEach(marker => {
      if (!markersByBlueprint[marker.blueprint]) {
        markersByBlueprint[marker.blueprint] = { markers: [], propName: marker.propName };
      }
      markersByBlueprint[marker.blueprint].markers.push(marker);
    });

    const CHUNK_SIZE = 5000;
    const total = propMarkers.length;

    let startIndex = 0;
    try {
      const entries = await listDir(mapFolderPath);
      for (const { name } of entries) {
        const match = name.match(/^props(\d+)\.lua$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= startIndex) startIndex = num;
        }
        if (name === 'props.lua') startIndex = Math.max(startIndex, 1);
      }
    } catch (e) {}

    // ── Entweder: Props.lua in mapRoot schreiben (kein SCMAP) ─────────────
    if (exportRawLua) {
      let writtenFiles = [];
      if (total <= CHUNK_SIZE && startIndex === 0) {
        setGenerationProgress({ current: 1, total: 1, file: 'Writing props.lua…' });
        const content = buildPropLuaChunk(propMarkers, coordDecimals, headingDecimals);
        await writeFile(`${mapFolderPath}\\props.lua`, content);
        writtenFiles = ['props.lua'];
      } else {
        const chunks = [];
        for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(propMarkers.slice(i, i + CHUNK_SIZE));
        for (let i = 0; i < chunks.length; i++) {
          const fileName = `props${startIndex + i + 1}.lua`;
          setGenerationProgress({ current: i + 1, total: chunks.length, file: `Writing ${fileName}…` });
          const content = buildPropLuaChunk(chunks[i], coordDecimals, headingDecimals);
          await writeFile(`${mapFolderPath}\\${fileName}`, content);
          writtenFiles.push(fileName);
        }
      }

      if (generateReadme) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const divider    = '='.repeat(80);
        const subDivider = '-'.repeat(80);
        const mapSizeNum = parseFloat(mapSize);
        const kmSize = ((mapSizeNum / 256) * 5).toFixed(mapSizeNum % 256 === 0 ? 0 : 1);
        const byPropName = {};
        Object.entries(markersByBlueprint).forEach(([bp, data]) => {
          const name = data.propName || 'Unnamed';
          if (!byPropName[name]) byPropName[name] = [];
          byPropName[name].push({ bp, count: data.markers.length });
        });
        const propTable = [];
        Object.keys(byPropName).sort().forEach(name => {
          const entries = byPropName[name];
          const totalCount = entries.reduce((s, e) => s + e.count, 0);
          propTable.push(`  ${name.padEnd(25)} ${String(totalCount).padStart(6)}    (${entries.length} blueprint${entries.length > 1 ? 's' : ''})`);
          entries.forEach(({ bp, count }) => {
            propTable.push(`  ${''.padEnd(25)} ${String(count).padStart(6)}    ${bp}`);
          });
          propTable.push(`  ${subDivider}`);
        });
        const BLUEPRINT_INDENT = '                        ';
        const propCardDetails = propCards
          .filter(c => c.blueprintPaths.some(p => p.trim()))
          .map((card, i) => {
            const validBps = card.blueprintPaths.filter(p => p.trim());
            const bpBlock = validBps.length === 0
              ? '(none)'
              : validBps[0] + (validBps.length > 1
                  ? '\n' + validBps.slice(1).map(bp => `${BLUEPRINT_INDENT}  ${bp}`).join('\n')
                  : '');
            const lines = [];
            lines.push(`  [${i + 1}] ${card.propName || 'Unnamed'}`);
            lines.push(`      Blueprints        : ${bpBlock}`);
            if (card.customValuesOpen) {
              lines.push(`      Density Mult.     : ${card.customDensityMultiplier}`);
              lines.push(`      Diffusion         : ${card.customDiffusion}%`);
              lines.push(`      Decimal Coords    : ${card.customDecimalPlacesCoords}`);
              lines.push(`      Decimal Heading   : ${card.customDecimalPlacesHeading}`);
            } else {
              lines.push(`      Custom Values     : No (using global)`);
            }
            if (card.customTreelineOpen && card.customTreelineImage)
              lines.push(`      Custom Treeline   : Yes (Cutoff ${card.customTreeline}, Min ${card.customTreelineMin})`);
            if (card.determineAreaImage)  lines.push(`      Determine Area    : Yes`);
            if (card.propDensityMapImage) lines.push(`      Prop Density Map  : Yes`);
            return lines.join('\n');
          }).join('\n\n');
        const readmeContent = buildReadme({
          tool:    'Trees Tab',
          mapName: finalMapName,
          mapSize: `${mapSize} × ${mapSize} (${kmSize} km × ${kmSize} km)`,
          sections: [
            { title: 'MAP SETTINGS (extra)', entries: [
              ['Mirror Mode', mirrorMode === 'none' ? 'None' : mirrorMode.charAt(0).toUpperCase() + mirrorMode.slice(1)],
              ['Total Props', total],
              ['Mode',        'props.lua (written to map folder, no SCMAP)'],
              ['Files',       writtenFiles.join(', ')],
            ]},
            { title: 'PROP BREAKDOWN', lines: [
              `  ${'Prop Name'.padEnd(25)} ${'Count'.padStart(6)}    Blueprint Path`,
              `  ${subDivider}`,
              ...propTable,
              `  ${subDivider}`,
              `  ${'TOTAL'.padEnd(25)} ${String(total).padStart(6)}`,
            ]},
            { title: 'GENERATION SETTINGS', entries: [
              ['Global Density Multiplier', densityMultiplier],
              ['Global Diffusion',          `${diffusion}%`],
              ['Treeline Cutoff',           treeline],
              ['Treeline Gradient',         treelineGradient],
              ['Treeline Min',              treelineMin],
              ['Treeline Min Gradient',     treelineMinGradient],
            ]},
            { title: 'PROP CARD SETTINGS', lines: propCardDetails.split('\n') },
          ],
          footer: ['Generated by ForgeMapToolkit · timmasalme'],
        });
        await writeReadme(`${mapFolderPath}\\TreeMap_Generation_README.txt`, readmeContent);
      }

      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      await luxuryAlert(`✓ ${total} props written to map folder (${writtenFiles.join(', ')}) — SCMAP not modified.`);
      return;
    }

    // ── Oder: Props in SCMAP injizieren (kein Lua in mapRoot) ────────────
    let writtenFiles = [];

    setGenerationProgress({ current: 2, total: 4, file: 'Locating .scmap…' });
    const dirEntries = await listDir(mapFolderPath);
    const scmapEntry = dirEntries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
    if (!scmapEntry) throw new Error(`No .scmap file found in ${mapFolderPath}`);
    const scmapPath = `${mapFolderPath}\\${scmapEntry.name}`;

    setGenerationProgress({ current: 2, total: 4, file: `Unpacking ${scmapEntry.name}…` });
    const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
    if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
    const unpackedFolder = unpackRes.outputFolder;

    const snapBeforeRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
    const snapBefore = snapBeforeRes?.snapshot ?? null;

    setGenerationProgress({ current: 3, total: 4, file: 'Writing props into unpacked folder…' });
    if (total <= CHUNK_SIZE && startIndex === 0) {
      const content = buildPropLuaChunk(propMarkers, coordDecimals, headingDecimals);
      await writeFile(`${unpackedFolder}\\props.lua`, content);
      writtenFiles = ['props.lua'];
    } else {
      const chunks = [];
      for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(propMarkers.slice(i, i + CHUNK_SIZE));
      for (let i = 0; i < chunks.length; i++) {
        const fileName = `props${startIndex + i + 1}.lua`;
        const content = buildPropLuaChunk(chunks[i], coordDecimals, headingDecimals);
        await writeFile(`${unpackedFolder}\\${fileName}`, content);
        writtenFiles.push(fileName);
      }
    }

    const snapAfterRes = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: unpackedFolder });
    const snapAfter = snapAfterRes?.snapshot ?? null;
    if (snapBefore && snapAfter) onRecordSnapshot('treemap', finalMapName, snapBefore, snapAfter);

    setGenerationProgress({ current: 4, total: 4, file: `Repacking ${scmapEntry.name}…` });
    const mapNameForPack = unpackedFolder.split(/[\\\/]/).pop();
    const packRes = await window.electronAPI.invoke('scmap-pack', { mapName: mapNameForPack });
    if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);

    const copyBackRes = await window.electronAPI.invoke('copy-file', {
      src: packRes.outputPath,
      dest: scmapPath,
    });
    if (!copyBackRes?.success) throw new Error('Failed to copy repacked .scmap back to map folder');

    if (generateReadme) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const divider    = '='.repeat(80);
      const subDivider = '-'.repeat(80);
      const mapSizeNum = parseFloat(mapSize);
      const kmSize = ((mapSizeNum / 256) * 5).toFixed(mapSizeNum % 256 === 0 ? 0 : 1);

      const byPropName = {};
      Object.entries(markersByBlueprint).forEach(([bp, data]) => {
        const name = data.propName || 'Unnamed';
        if (!byPropName[name]) byPropName[name] = [];
        byPropName[name].push({ bp, count: data.markers.length });
      });

      const propTable = [];
      Object.keys(byPropName).sort().forEach(name => {
        const entries = byPropName[name];
        const totalCount = entries.reduce((s, e) => s + e.count, 0);
        propTable.push(`  ${name.padEnd(25)} ${String(totalCount).padStart(6)}    (${entries.length} blueprint${entries.length > 1 ? 's' : ''})`);
        entries.forEach(({ bp, count }) => {
          propTable.push(`  ${''.padEnd(25)} ${String(count).padStart(6)}    ${bp}`);
        });
        propTable.push(`  ${subDivider}`);
      });

      const BLUEPRINT_INDENT = '                        ';
      const propCardDetails = propCards
        .filter(c => c.blueprintPaths.some(p => p.trim()))
        .map((card, i) => {
          const validBps = card.blueprintPaths.filter(p => p.trim());
          const bpBlock = validBps.length === 0
            ? '(none)'
            : validBps[0] + (validBps.length > 1
                ? '\n' + validBps.slice(1).map(bp => `${BLUEPRINT_INDENT}  ${bp}`).join('\n')
                : '');
          const lines = [];
          lines.push(`  [${i + 1}] ${card.propName || 'Unnamed'}`);
          lines.push(`      Blueprints        : ${bpBlock}`);
          if (card.customValuesOpen) {
            lines.push(`      Density Mult.     : ${card.customDensityMultiplier}`);
            lines.push(`      Diffusion         : ${card.customDiffusion}%`);
            lines.push(`      Decimal Coords    : ${card.customDecimalPlacesCoords}`);
            lines.push(`      Decimal Heading   : ${card.customDecimalPlacesHeading}`);
          } else {
            lines.push(`      Custom Values     : No (using global)`);
          }
          if (card.customTreelineOpen && card.customTreelineImage)
            lines.push(`      Custom Treeline   : Yes (Cutoff ${card.customTreeline}, Min ${card.customTreelineMin})`);
          if (card.determineAreaImage)  lines.push(`      Determine Area    : Yes`);
          if (card.propDensityMapImage) lines.push(`      Prop Density Map  : Yes`);
          return lines.join('\n');
        }).join('\n\n');

      const readmeContent = buildReadme({
        tool:    'Trees Tab',
        mapName: finalMapName,
        mapSize: `${mapSize} × ${mapSize} (${kmSize} km × ${kmSize} km)`,
        sections: [
          { title: 'MAP SETTINGS (extra)', entries: [
            ['Mirror Mode', mirrorMode === 'none' ? 'None' : mirrorMode.charAt(0).toUpperCase() + mirrorMode.slice(1)],
            ['Total Props', total],
            ['Mode',        'SCMAP (props injected directly)'],
            ['Files',       writtenFiles.join(', ')],
          ]},
          { title: 'PROP BREAKDOWN', lines: [
            `  ${'Prop Name'.padEnd(25)} ${'Count'.padStart(6)}    Blueprint Path`,
            `  ${subDivider}`,
            ...propTable,
            `  ${subDivider}`,
            `  ${'TOTAL'.padEnd(25)} ${String(total).padStart(6)}`,
          ]},
          { title: 'GENERATION SETTINGS', entries: [
            ['Global Density Multiplier', densityMultiplier],
            ['Global Diffusion',          `${diffusion}%`],
            ['Treeline Cutoff',           treeline],
            ['Treeline Gradient',         treelineGradient],
            ['Treeline Min',              treelineMin],
            ['Treeline Min Gradient',     treelineMinGradient],
          ]},
          { title: 'PROP CARD SETTINGS', lines: propCardDetails.split('\n') },
          { title: 'TROUBLESHOOTING', lines: [
            `  Props not appearing in-game`,
            `  ${subDivider}`,
            `  - Verify the .scmap was packed correctly — check that repacking did not fail.`,
            `  - Check that blueprint paths are valid game paths.`,
            ``,
            `  Props appear at wrong positions`,
            `  ${subDivider}`,
            `  - Map Size must match the actual scenario size. Current value: ${mapSize}.`,
            `  - Mirror mode was ${mirrorMode === 'none' ? 'inactive' : `active (${mirrorMode})`}.`,
            ``,
            `  Too many or too few props`,
            `  ${subDivider}`,
            `  - Adjust the Density Multiplier (current: ${densityMultiplier}).`,
            `  - Check the Density Map brightness -- darker areas produce fewer props.`,
            ``,
            `  ${subDivider}`,
            `  For further help contact @timmasalme in the FAF Discord.`,
            `  FAF Discord: https://discord.gg/XyCssf8r8e`,
            `  Mapping-General: https://discord.com/channels/197033481883222026/364688036224827392`,
          ]},
        ],
        footer: ['Generated by ForgeMapToolkit · timmasalme'],
      });

      await writeReadme(`${mapFolderPath}\\TreeMap_Generation_README.txt`, readmeContent);
    }

    const currentSettings = await window.electronAPI.invoke('settings-load');
    if (currentSettings?.autoOpenExportFolder) {
      await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
    }

    await luxuryAlert(`✓ ${total} props injected into ${scmapEntry.name} successfully!`);

  } catch (error) {
    await luxuryAlert('Error: ' + error.message);
  } finally {
    setIsGenerating(false);
    setGenerationProgress({ current: 0, total: 0, file: '' });
  }
};

  return (
    <div className="treemap-theme">

      {showHelp && (
        <TreesHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpGuideSelected={helpGuideSelected}
          setHelpGuideSelected={setHelpGuideSelected}
          activeAdvancedSubTab={activeAdvancedSubTab}
          setActiveAdvancedSubTab={setActiveAdvancedSubTab}
        />
      )}

      {showBlueprintLibrary !== null && (
        <PropsLibraryOverlay
          mapName={mapName}
          mapsFolder={mapsFolderPath}
          noTextureEditor
          onConfirm={handlePropsLibraryConfirm}
          onClose={() => setShowBlueprintLibrary(null)}
        />
      )}

      <button className="help-btn" onClick={() => setShowHelp(true)} title="Toggle Help Overlay">?</button>

      <TabLayout
        sections={[
          { id: 'setup', index: '01', label: 'Setup', desc: 'Configure map target, density map, treeline heightmap, exclusion zone and generation parameters.' },
          { id: 'props', index: '02', label: 'Props', desc: 'Define prop cards with blueprints and per-card overrides, then generate.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="TREEMAP"
        railStorageKey="treemap-rail-pinned"
        navLabel="TreeMap navigation"
        previewCaption=""
        mirrorSlot={
          <div className="preview-panel-head-controls">
            <select
              className="field-select"
              style={{ width: 'auto' }}
              value={mirrorMode}
              onChange={(e) => { setMirrorMode(e.target.value); if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height); }}
            >
              <option value="none">No Mirror</option>
              <option value="diagonal">Diagonal</option>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
            {previewImage && (
              <button
                className="action-button action-button--danger"
                style={{ padding: '4px 10px', fontSize: '0.62rem' }}
                onClick={async () => {
                  const confirmed = await luxuryConfirm('Remove preview image?', 'Confirm Remove', 'Remove Preview', 'Cancel');
                  if (confirmed) {
                    setPreviewImage(null); setPreviewImageData(null);
                    if (previewUploadRef.current) previewUploadRef.current.value = '';
                    const canvas = canvasRef.current;
                    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
                  }
                }}
              >
                Remove Preview
              </button>
            )}
            <input ref={previewUploadRef} type="file" style={{ display: 'none' }} accept="image/*" onChange={handlePreviewUpload} />
          </div>
        }
        previewSlot={
          <div className="tm-preview-body">
            <button className="action-button tm-upload-btn" onClick={() => previewUploadRef.current?.click()}>
              {previewLoading ? 'Loading…' : 'Upload Map Image'}
            </button>
            <div className="tm-canvas-wrap">
              <canvas ref={canvasRef} width={800} height={800} />
              {!previewImage && propMarkers.length === 0 && (
                <div className="tm-canvas-empty">Upload a density map to place props</div>
              )}
            </div>
            <div className="preview-legend">
              <div className="preview-legend-title">PROP LEGEND</div>
              <div className="preview-legend-items">
                {allCounts.every(i => i.count === 0) ? (
                  <div className="preview-legend-item">
                    <div className="preview-legend-color" style={{ backgroundColor: 'var(--tab-color)' }} />
                    <span>Props</span>
                    <span className="preview-coord-count">0 pts</span>
                  </div>
                ) : (
                  allCounts.filter(i => i.count > 0).map((item, idx) => (
                    <div key={`prop-${idx}`} className="preview-legend-item">
                      <div className="preview-legend-color" style={{ backgroundColor: item.color }} />
                      <span>{item.propName || `Prop ${idx + 1}`}</span>
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
          </div>
        }
      >

        {activeSection === 'setup' && (
          <>
            <div className="form-group">
              <label className="field-label">Map Name</label>
              <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)}
                className="field-input" placeholder="e.g. Hades_Dust.v0002" />
              {mapInfo && (
                <div className="tm-map-info">
                  {mapInfo.ok ? (<>
                    <span className="tm-map-info-tag">MAP</span>
                    <span className="tm-map-info-size">{mapInfo.mapSize} × {mapInfo.mapSize}</span>
                    <span className="tm-map-info-dot">·</span>
                    <span>{mapInfo.km} km</span>
                    {mapInfo.playableSize !== mapInfo.mapSize && (<>
                      <span className="tm-map-info-dot">·</span>
                      <span className="tm-map-info-playable">playable {mapInfo.playableKm} km</span>
                    </>)}
                  </>) : (
                    <span className="tm-map-info-err">{mapInfo.error}</span>
                  )}
                </div>
              )}
            </div>

            <div className="subsection-head">
              <span className="subsection-head-title">DENSITY</span>
            </div>
            <div className="form-group">
              <label className="field-label">Density Map</label>
              <DropSlot
                label="Density Map"
                hint="image/*"
                accept={() => true}
                acceptInput="image/*"
                value={densityMap ? { name: 'density-map' } : null}
                onChange={handleDensityMapFile}
                doneText={densityMap ? 'Density Map loaded' : undefined}
                onClear={clearDensityMap}
              />
            </div>
            <div className="tm-density-params-row">
              <div className="form-group">
                <label className="field-label">Density Mult.</label>
                <input type="number" step="0.1" min="0.00001" value={densityMultiplier}
                  onChange={(e) => setDensityMultiplier(e.target.value)}
                  onBlur={(e) => { const val = parseFloat(e.target.value); if (isNaN(val) || val <= 0) setDensityMultiplier('0.00001'); }}
                  className="field-input" />
              </div>
              <div className="form-group">
                <label className="field-label">Diffusion (0–100)</label>
                <input type="number" step="1" min="0" max="100" value={diffusion}
                  onChange={(e) => setDiffusion(e.target.value)}
                  onBlur={(e) => { const val = parseFloat(e.target.value); if (isNaN(val) || val < 0) setDiffusion('0'); else if (val > 100) setDiffusion('100'); }}
                  className="field-input" />
              </div>
              <div className="form-group">
                <label className="field-label">Grid Res. <span className="tm-grid-point-count">{parseInt(gridResolution || '100') ** 2} pts</span></label>
                <input type="number" step="10" min="1" max="2000" value={gridResolution}
                  onChange={(e) => setGridResolution(e.target.value)}
                  onBlur={(e) => { const val = parseInt(e.target.value); if (isNaN(val) || val < 1) setGridResolution('1'); else if (val > 2000) setGridResolution('2000'); }}
                  className="field-input" />
              </div>
            </div>

            <div className="subsection-head">
              <span className="subsection-head-title">TREELINE HEIGHTMAP</span>
            </div>
            <input type="file" ref={heightmapInputRef} accept="image/*" onChange={handleHeightmapUpload} style={{ display: 'none' }} />
            <DropSlot
              label="Treeline Heightmap"
              hint="image/*"
              accept={() => true}
              acceptInput="image/*"
              value={heightmap ? { name: 'heightmap' } : null}
              onChange={handleHeightmapFile}
              doneText={heightmap ? 'Heightmap loaded' : undefined}
              onClear={clearHeightmap}
              className="tm-drop-slot"
            />
            {heightmap && (
              <>
                <div className="form-group">
                  <label className="field-label">Treeline Cutoff (0–255) <span className="tm-slider-value">{treeline}</span></label>
                  <input type="range" min="0" max="255" step="1" value={treeline} onChange={(e) => setTreeline(e.target.value)} />
                  <input type="number" min="0" max="255" step="1" value={treeline} onChange={(e) => setTreeline(e.target.value)} className="field-input tm-slider-number" />
                </div>
                <div className="form-group">
                  <label className="field-label">Gradient Width <span className="tm-slider-value">{treelineGradient}</span></label>
                  <input type="range" min="0" max="255" step="1" value={treelineGradient} onChange={(e) => setTreelineGradient(e.target.value)} />
                  <input type="number" min="0" max="255" step="1" value={treelineGradient} onChange={(e) => setTreelineGradient(e.target.value)} className="field-input tm-slider-number" />
                </div>
                <div className="form-group">
                  <label className="field-label">Treeline Min (0–255) <span className="tm-slider-value">{treelineMin}</span></label>
                  <input type="range" min="0" max="255" step="1" value={treelineMin} onChange={(e) => setTreelineMin(e.target.value)} />
                  <input type="number" min="0" max="255" step="1" value={treelineMin} onChange={(e) => setTreelineMin(e.target.value)} className="field-input tm-slider-number" />
                </div>
                <div className="form-group">
                  <label className="field-label">Min Gradient Width <span className="tm-slider-value">{treelineMinGradient}</span></label>
                  <input type="range" min="0" max="255" step="1" value={treelineMinGradient} onChange={(e) => setTreelineMinGradient(e.target.value)} />
                  <input type="number" min="0" max="255" step="1" value={treelineMinGradient} onChange={(e) => setTreelineMinGradient(e.target.value)} className="field-input tm-slider-number" />
                </div>
              </>
            )}

            <div className="subsection-head">
              <span className="subsection-head-title">EXCLUSION ZONE</span>
            </div>
            <input type="file" ref={exclusionZoneInputRef} accept="image/*" onChange={handleExclusionZoneUpload} style={{ display: 'none' }} />
            <DropSlot
              label="Exclusion Zone"
              hint="image/*"
              accept={() => true}
              acceptInput="image/*"
              value={exclusionZone ? { name: 'exclusion-zone' } : null}
              onChange={handleExclusionZoneFile}
              doneText={exclusionZone ? 'Exclusion Zone loaded' : undefined}
              onClear={clearExclusionZone}
              className="tm-drop-slot"
            />

            <button onClick={handleRandomize} className="action-button action-button--full" style={{ marginTop: '20px' }}>
              Randomize
            </button>
          </>
        )}

        {activeSection === 'props' && (
          <>
            <div className="subsection-head">
              <span className="subsection-head-title">PROP CARDS</span>
              {propCards.length >= 1 && (
                <button className="action-button action-button--danger tm-delete-all-btn" onClick={deleteAllPropCards} title="Delete all prop cards">
                  Delete All
                </button>
              )}
            </div>

            {propCards.map((card, idx) => (
              <div
                key={card.id}
                className={`ec-card${idx === selectedProp ? ' ec-card--selected' : ''}`}
                onClick={() => setSelectedProp(idx)}
              >
                <div className="ec-card-header">
                  <div className="ec-card-header-left">
                    <div
                      className="ec-card-color-dot"
                      style={{ backgroundColor: card.color }}
                      onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === idx ? null : idx); }}
                    />
                    <input
                      value={card.propName}
                      onChange={(e) => { e.stopPropagation(); updatePropCard(idx, 'propName', e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Prop name..."
                      className="treemap-prop-name-input"
                    />
                  </div>
                  <div className="ec-card-header-actions">
                    {propCards.length > 1 && (
                      <button
                        className="delete-button"
                        onClick={(e) => { e.stopPropagation(); deletePropCard(idx); }}
                      >×</button>
                    )}
                  </div>
                </div>

                {showColorPicker === idx && (
                  <div className="ec-color-picker" onClick={(e) => e.stopPropagation()}>
                    <div className="ec-color-grid">
                      {availableColors.map((color, colorIdx) => (
                        <div
                          key={colorIdx}
                          className="ec-color-option"
                          style={{ backgroundColor: color }}
                          onClick={() => { updatePropCard(idx, 'color', color); setShowColorPicker(null); }}
                        />
                      ))}
                    </div>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Custom color (#HEX or hsl())"
                      style={{ marginTop: 'var(--space-sm)' }}
                      onChange={(e) => { if (e.target.value) updatePropCard(idx, 'color', e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {selectedProp === idx && (
                  <div className="ec-card-details" onClick={(e) => e.stopPropagation()}>
                    <div className="form-group">
                      <label className="field-label">Blueprints</label>
                      {card.blueprintPaths.map((path, pi) => (
                        <div key={pi} className="ec-input-row">
                          <input
                            className="field-input field-input--mono"
                            value={path}
                            onChange={(e) => updateBlueprintPath(idx, pi, e.target.value)}
                            placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            className="delete-button"
                            onClick={(e) => { e.stopPropagation(); removeBlueprintPath(idx, pi); }}
                          >×</button>
                        </div>
                      ))}
                      <button
                        className="action-button action-button--full"
                        onClick={(e) => { e.stopPropagation(); setShowBlueprintLibrary(idx); }}
                      >Library</button>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <button
                        className={`field-select treemap-cv-toggle${card.customValuesOpen ? ' treemap-cv-open' : ''}`}
                        onClick={(e) => { e.stopPropagation(); const next = !card.customValuesOpen; updatePropCard(idx, 'customValuesOpen', next); updatePropCard(idx, 'customActiveTab', next ? 'density' : null); }}
                      >
                        <span>Custom Values</span>
                        <span className="treemap-cv-toggle-chevron">{card.customValuesOpen ? '▲' : '▼'}</span>
                      </button>
                      {card.customValuesOpen && (
                        <div className="treemap-cv-body" onClick={(e) => e.stopPropagation()}>

                          {/* ── Tab selector ── */}
                          <div className="treemap-cv-tab-bar">
                            {[
                              { id: 'density',        label: 'Density' },
                              { id: 'treeline',       label: 'Treeline',        active: !!card.customTreelineImage },
                              { id: 'determineArea',  label: 'Determine Area',  active: !!card.determineAreaImage },
                              { id: 'propDensityMap', label: 'Prop Density Map',active: !!card.propDensityMapImage },
                            ].map(tab => (
                              <button
                                key={tab.id}
                                className={`treemap-cv-tab${card.customActiveTab === tab.id ? ' treemap-cv-tab--active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); updatePropCard(idx, 'customActiveTab', card.customActiveTab === tab.id ? null : tab.id); }}
                              >
                                {tab.label}
                                {tab.active && <span className="treemap-cv-tab-dot" />}
                              </button>
                            ))}
                          </div>

                          {/* ── Density ── */}
                          {card.customActiveTab === 'density' && (
                            <div className="treemap-cv-panel">
                              <div className="treemap-cv-row">
                                <div className="form-group">
                                  <label className="field-label">Density Multiplier</label>
                                  <input
                                    type="number" step="0.1" min="0.00001"
                                    value={card.customDensityMultiplier}
                                    onChange={(e) => updatePropCard(idx, 'customDensityMultiplier', e.target.value)}
                                    onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) updatePropCard(idx, 'customDensityMultiplier', '0.00001'); }}
                                    className="field-input"
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="field-label">Diffusion (0–100)</label>
                                  <input
                                    type="number" step="1" min="0" max="100"
                                    value={card.customDiffusion}
                                    onChange={(e) => updatePropCard(idx, 'customDiffusion', e.target.value)}
                                    onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) updatePropCard(idx, 'customDiffusion', '0'); else if (v > 100) updatePropCard(idx, 'customDiffusion', '100'); }}
                                    className="field-input"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── Custom Treeline ── */}
                          {card.customActiveTab === 'treeline' && (
                            <div className="treemap-cv-panel">
                              <input type="file" ref={(el) => cardHeightmapInputRefs.current[idx] = el} accept="image/*" onChange={(e) => handleCardHeightmapUpload(idx, e)} style={{ display: 'none' }} />
                              <DropSlot
                                label="Custom Heightmap"
                                hint="image/*"
                                accept={() => true}
                                acceptInput="image/*"
                                value={card.customTreelineImage ? { name: 'heightmap' } : null}
                                onChange={(file) => handleCardHeightmapFile(idx, file)}
                                doneText={card.customTreelineImage ? 'Heightmap loaded' : undefined}
                                onClear={() => clearCardHeightmap(idx)}
                                className="tm-drop-slot"
                              />
                              <label className="field-label">
                                Treeline Cutoff (0–255)
                                <span className="tm-slider-value">{card.customTreeline}</span>
                              </label>
                              <input type="range" min="0" max="255" step="1" value={card.customTreeline} onChange={(e) => updatePropCard(idx, 'customTreeline', e.target.value)} />
                              <input type="number" min="0" max="255" step="1" value={card.customTreeline} onChange={(e) => updatePropCard(idx, 'customTreeline', e.target.value)} className="field-input tm-slider-number" />
                              <label className="field-label">
                                Treeline Min (0–255)
                                <span className="tm-slider-value">{card.customTreelineMin}</span>
                              </label>
                              <input type="range" min="0" max="255" step="1" value={card.customTreelineMin} onChange={(e) => updatePropCard(idx, 'customTreelineMin', e.target.value)} />
                              <input type="number" min="0" max="255" step="1" value={card.customTreelineMin} onChange={(e) => updatePropCard(idx, 'customTreelineMin', e.target.value)} className="field-input tm-slider-number" />
                              <label className="field-label">
                                Min Gradient Width
                                <span className="tm-slider-value">{card.customTreelineMinGradient}</span>
                              </label>
                              <input type="range" min="0" max="255" step="1" value={card.customTreelineMinGradient} onChange={(e) => updatePropCard(idx, 'customTreelineMinGradient', e.target.value)} />
                              <input type="number" min="0" max="255" step="1" value={card.customTreelineMinGradient} onChange={(e) => updatePropCard(idx, 'customTreelineMinGradient', e.target.value)} className="field-input tm-slider-number" />
                            </div>
                          )}

                          {/* ── Determine Area ── */}
                          {card.customActiveTab === 'determineArea' && (
                            <div className="treemap-cv-panel">
                              <input type="file" ref={(el) => determineAreaInputRefs.current[idx] = el} accept="image/*" onChange={(e) => handleDetermineAreaUpload(idx, e)} style={{ display: 'none' }} />
                              <DropSlot
                                label="Determine Area"
                                hint="image/*"
                                accept={() => true}
                                acceptInput="image/*"
                                value={card.determineAreaImage ? { name: 'determine-area' } : null}
                                onChange={(file) => handleDetermineAreaFile(idx, file)}
                                doneText={card.determineAreaImage ? 'Area loaded' : undefined}
                                onClear={() => clearDetermineArea(idx)}
                                className="tm-drop-slot"
                              />
                            </div>
                          )}

                          {/* ── Prop Density Map ── */}
                          {card.customActiveTab === 'propDensityMap' && (
                            <div className="treemap-cv-panel">
                              <input type="file" ref={(el) => propDensityMapInputRefs.current[idx] = el} accept="image/*" onChange={(e) => handlePropDensityMapUpload(idx, e)} style={{ display: 'none' }} />
                              <DropSlot
                                label="Prop Density Map"
                                hint="image/*"
                                accept={() => true}
                                acceptInput="image/*"
                                value={card.propDensityMapImage ? { name: 'density-map' } : null}
                                onChange={(file) => handlePropDensityMapFile(idx, file)}
                                doneText={card.propDensityMapImage ? 'Density Map loaded' : undefined}
                                onClear={() => clearPropDensityMap(idx)}
                                className="tm-drop-slot"
                              />
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <AddTile label="ADD PROP CARD" onClick={addPropCard} />

            <div className="subsection-head" style={{ marginTop: 'var(--space-xl)' }}>
              <span className="subsection-head-title">EXPORT</span>
            </div>

            <label className="checkbox-label" style={{ marginBottom: '10px' }} onClick={() => setGenerateReadme(!generateReadme)}>
              <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
                {generateReadme && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">Generate README file</span>
            </label>
            <label className="checkbox-label" style={{ marginBottom: '20px' }} onClick={() => setExportRawLua(!exportRawLua)}>
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
              <div>
                <div className="treemap-generating-label">Generating &amp; Injecting…</div>
                <div className="treemap-progress-bar">
                  <div className="treemap-progress-fill" style={{ width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%` }} />
                </div>
                <div className="treemap-progress-text">
                  {generationProgress.file} ({generationProgress.current}/{generationProgress.total})
                </div>
              </div>
            ) : (
              <button className="commit-button" onClick={generateFiles}>
                <span className="commit-button-label">GENERATE FILES</span>
                <span className="commit-button-status">TreeMap</span>
                <span className="commit-button-bloom" />
                <span className="commit-button-line" />
              </button>
            )}
          </>
        )}

      </TabLayout>
    </div>
  );
};

export default TreemapTab;
