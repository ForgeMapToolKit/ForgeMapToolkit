import React, { useState, useRef, useEffect } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './Trees.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibraryOverlay from '../../../Shared/Libraries/PropsLibrary/PropsLibrary';
import TreesHelpModal from '../../HelpModals/Trees_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, MirrorDropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  ensureDir, writeFile,
  usePersistentState, useMapInfo, useScmapPreview,
  loadImageChannel, drawPlacementCanvas,
} from '../../../Shared/MapLogic';
import TreesConfiguration from './Configuration.jsx';
import TreesChannels from './Channels.jsx';
import TreesCards from './Cards.jsx';
import TreesExport from './Export.jsx';

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

const availableColors = [
  '#FFAF00', '#FF7B00', '#FFFA00', '#A5E801', '#538A33', '#8A12BD',
  '#00DDFF', '#3B76FF', '#FE1818', '#3EA387', '#18C748', '#00FF66', '#FFFFFF', '#000000'
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TreemapTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  // ─── Shared / persistent state ─────────────────────────────────────────────

  const [mapName,             setMapName]             = usePersistentState(s, 'tm_mapName', '', onSharedChange);
  const [mapsFolderPath,      setMapsFolderPath]      = usePersistentState(s, 'tm_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [densityMultiplier,   setDensityMultiplier]   = usePersistentState(s, 'tm_densityMultiplier', '1.0', onSharedChange);
  const [treelineMin,         setTreelineMin]         = usePersistentState(s, 'tm_treelineMin', '0', onSharedChange);
  const [treelineMinGradient, setTreelineMinGradient] = usePersistentState(s, 'tm_treelineMinGradient', '30', onSharedChange);
  const [diffusion,           setDiffusion]           = usePersistentState(s, 'tm_diffusion', '0', onSharedChange);
  const [gridResolution,      setGridResolution]      = usePersistentState(s, 'tm_gridResolution', '100', onSharedChange);
  const [mirrorMode,          setMirrorMode]          = usePersistentState(s, 'tm_mirrorMode', settings?.defaultMirrorMode ?? 'none', onSharedChange);
  const [treeline,            setTreeline]            = usePersistentState(s, 'tm_treeline', '200', onSharedChange);
  const [treelineGradient,    setTreelineGradient]    = usePersistentState(s, 'tm_treelineGradient', '30', onSharedChange);
  const [generateReadme,      setGenerateReadme]      = usePersistentState(s, 'tm_generateReadme', settings?.generateReadme !== false, onSharedChange);
  const [exportRawLua,        setExportRawLua]        = usePersistentState(s, 'tm_exportRawLua', false, onSharedChange);
  const [blueprintMassMap,    setBlueprintMassMap]    = usePersistentState(s, 'tm_blueprintMassMap', {}, onSharedChange);
  const [blueprintEnergyMap,  setBlueprintEnergyMap]  = usePersistentState(s, 'tm_blueprintEnergyMap', {}, onSharedChange);
  const [legendCollapsed,     setLegendCollapsed]     = usePersistentState(s, 'tm_legendCollapsed', false, onSharedChange);

  // propCards needs bespoke persistence: image/ImageData fields are session-only
  // and must be stripped before they hit the shared store (they're huge and not
  // meaningfully serializable) — usePersistentState has no hook for that, so this
  // one stays hand-rolled exactly like it was before the migration.
  const [propCards, setPropCardsState] = useState(s.tm_propCards ?? [{ ...DEFAULT_PROP_CARD, id: Date.now() }]);
  const setPropCards = (v) => {
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

  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('tm_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // ─── Settings sync ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)                   setMapsFolderPath(settings.mapsFolder);
    if (settings.generateReadme != null)        setGenerateReadme(settings.generateReadme !== false);
    if (settings.defaultMirrorMode != null)     setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ─── Local UI state ─────────────────────────────────────────────────────────

  // Global masks — session-only, not persisted (same choice RockErosion makes
  // for its erosion channels/heightmap: too heavy for the shared store).
  const [densityMap, setDensityMap] = useState(null);
  const [densityMapData, setDensityMapData] = useState(null);
  const [exclusionZone, setExclusionZone] = useState(null);
  const [exclusionZoneData, setExclusionZoneData] = useState(null);
  const [heightmap, setHeightmap] = useState(null);
  const [heightmapData, setHeightmapData] = useState(null);

  const [seed, setSeed] = useState(Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('help-guide');
  const [helpGuideSelected, setHelpGuideSelected] = useState(null);
  const [activeAdvancedSubTab, setActiveAdvancedSubTab] = useState('workflow');
  const [activeSection, setActiveSection] = useState('config');

  const [selectedProp, setSelectedProp] = useState(0);
  const [propMarkers, setPropMarkers] = useState([]);

  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, file: '' });

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mirrorModeRef = useRef(null);           // DOM ref for the MirrorDropdown trigger
  const mirrorModeValueRef = useRef(mirrorMode); // value snapshot for the marker-gen closure
  useEffect(() => { mirrorModeValueRef.current = mirrorMode; }, [mirrorMode]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const seededRandom = (seedVal) => {
    let x = Math.sin(seedVal) * 10000;
    return x - Math.floor(x);
  };

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

  // ─── Marker generation ────────────────────────────────────────────────────
  // Pixel-space sampling grid over the density map's own resolution — unchanged
  // from the pre-migration algorithm. (Not swapped to the world-space
  // sampleChannel() utility RockErosion uses — that operates in a different
  // coordinate space and would subtly change behaviour.)

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
        markers.push({ ...m, id: m.id + 0.5, x: mx, z: mz, heading: mHeading, isMirrored: true });
      });
    }
    setPropMarkers(markers);
  };

  useEffect(() => {
    if (densityMapData) {
      generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, propCards);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propCards, seed, densityMultiplier, gridResolution, mapSize, treeline, treelineGradient, treelineMin, treelineMinGradient, heightmapData]);

  const handleRandomize = () => {
    setSeed(Date.now());
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height);
  };

  // ─── Preview image upload (manual override) ─────────────────────────────────

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

  // ─── Global mask uploads ──────────────────────────────────────────────────

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

  const clearHeightmap = () => {
    setHeightmap(null);
    setHeightmapData(null);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height);
  };

  const handleDensityMapFile = async (file) => {
    if (!file) { clearDensityMap(); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      setDensityMap(dataURL);
      setDensityMapData(imageData);
      generatePropMarkers(imageData, imageData.width, imageData.height);
    } catch (err) {
      await luxuryAlert(`Failed to load density map: ${err.message}`, 'Error', 'error');
    }
  };

  const handleExclusionZoneFile = async (file) => {
    if (!file) { clearExclusionZone(); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      setExclusionZone(dataURL);
      setExclusionZoneData(imageData);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, imageData);
    } catch (err) {
      await luxuryAlert(`Failed to load exclusion zone: ${err.message}`, 'Error', 'error');
    }
  };

  const handleHeightmapFile = async (file) => {
    if (!file) { clearHeightmap(); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      setHeightmap(dataURL);
      setHeightmapData(imageData);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, imageData);
    } catch (err) {
      await luxuryAlert(`Failed to load heightmap: ${err.message}`, 'Error', 'error');
    }
  };

  // ─── Per-card mask uploads ────────────────────────────────────────────────

  const clearCardHeightmap = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].customTreelineImage = null;
    newCards[propIndex].customTreelineData = null;
    newCards[propIndex].useCustomTreeline = false;
    setPropCards(newCards);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
  };

  const clearDetermineArea = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].determineAreaImage = null;
    newCards[propIndex].determineAreaData = null;
    setPropCards(newCards);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
  };

  const clearPropDensityMap = (propIndex) => {
    const newCards = [...propCards];
    newCards[propIndex].propDensityMapImage = null;
    newCards[propIndex].propDensityMapData = null;
    setPropCards(newCards);
    if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, newCards);
  };

  const handleCardHeightmapFile = async (propIndex, file) => {
    if (!file) { clearCardHeightmap(propIndex); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      const nc = [...propCards];
      nc[propIndex].customTreelineImage = dataURL;
      nc[propIndex].customTreelineData = imageData;
      nc[propIndex].useCustomTreeline = true;
      setPropCards(nc);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc);
    } catch (err) {
      await luxuryAlert(`Failed to load custom treeline: ${err.message}`, 'Error', 'error');
    }
  };

  const handleDetermineAreaFile = async (propIndex, file) => {
    if (!file) { clearDetermineArea(propIndex); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      const nc = [...propCards];
      nc[propIndex].determineAreaImage = dataURL;
      nc[propIndex].determineAreaData = imageData;
      setPropCards(nc);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc);
    } catch (err) {
      await luxuryAlert(`Failed to load determine area: ${err.message}`, 'Error', 'error');
    }
  };

  const handlePropDensityMapFile = async (propIndex, file) => {
    if (!file) { clearPropDensityMap(propIndex); return; }
    try {
      const { dataURL, imageData } = await loadImageChannel(file);
      const nc = [...propCards];
      nc[propIndex].propDensityMapImage = dataURL;
      nc[propIndex].propDensityMapData = imageData;
      setPropCards(nc);
      if (densityMapData) generatePropMarkers(densityMapData, densityMapData.width, densityMapData.height, exclusionZoneData, heightmapData, nc);
    } catch (err) {
      await luxuryAlert(`Failed to load prop density map: ${err.message}`, 'Error', 'error');
    }
  };

  // ─── Prop card management ─────────────────────────────────────────────────

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

  // Reset-to-default on last-card delete — same graceful-degrade the shared
  // EntityCard shell uses everywhere else (Wreckage/RockErosion), since the
  // shell's delete button has no way to hide itself for a single remaining card.
  const deletePropCard = (index) => {
    setPropCards(prev => prev.length === 1 ? [{ ...DEFAULT_PROP_CARD, id: Date.now() }] : prev.filter((_, i) => i !== index));
    setSelectedProp(prev => Math.max(0, prev >= index ? prev - 1 : prev));
  };

  const updatePropCard = (index, field, value) => {
    const newCards = [...propCards];
    newCards[index][field] = value;
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

  // ─── Prop counts (legend) ─────────────────────────────────────────────────

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

  // ─── Canvas draw ──────────────────────────────────────────────────────────
  // Background/grid/mirror-lines reuse the shared renderer; the prop markers
  // themselves are drawn as a cheap flat-dot pass — there can be thousands of
  // them, so the glow-heavy per-entity style used for hand-placed points would
  // tank performance (same choice RockErosion makes).

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

    propMarkers.forEach(marker => {
      const x = ((marker.x - mapOffsetX) / mapSizeNum) * canvas.width;
      const z = ((marker.z - mapOffsetY) / mapSizeNum) * canvas.height;
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.fill();
    });
  }, [propMarkers, previewImage, mapSize, mirrorMode, mapOffsetX, mapOffsetY]);

  // ─── Lua output builder ───────────────────────────────────────────────────

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

  // ─── File system helpers (IPC) ────────────────────────────────────────────

  const listDir = async (dirPath) => {
    const res = await window.electronAPI.invoke('list-dir', { dirPath });
    if (!res?.success) throw new Error(res?.error || 'list-dir failed');
    return res.entries;
  };

  // ─── File generation ──────────────────────────────────────────────────────
  // Chunked manually (CHUNK_SIZE=5000, unpack once, write every chunk, repack
  // once) rather than one shared injectPropsLua() call per chunk — that helper
  // only writes a single file with no chunking support, which doesn't fit a
  // procedural scatter that can produce many thousands of markers. Same reason
  // RockErosion hand-rolls this sequence instead of using injectPropsLua.

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

      // ── Either: write props.lua into mapRoot (no SCMAP) ───────────────────
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

      // ── Or: inject props into the SCMAP (no lua in mapRoot) ──────────────
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

  // ─── Section props ────────────────────────────────────────────────────────

  const configProps = {
    mapName, setMapName, mapInfo,
    gridResolution, setGridResolution,
    densityMultiplier, setDensityMultiplier,
    diffusion, setDiffusion,
    onRandomize: handleRandomize,
  };

  const channelsProps = {
    densityMap, onDensityMapUpload: handleDensityMapFile, onDensityMapClear: clearDensityMap,
    heightmap, onHeightmapUpload: handleHeightmapFile, onHeightmapClear: clearHeightmap,
    treeline, setTreeline, treelineGradient, setTreelineGradient,
    treelineMin, setTreelineMin, treelineMinGradient, setTreelineMinGradient,
    exclusionZone, onExclusionZoneUpload: handleExclusionZoneFile, onExclusionZoneClear: clearExclusionZone,
  };

  const cardsProps = {
    propCards, selectedProp, setSelectedProp,
    availableColors, showColorPicker, setShowColorPicker,
    deleteAllPropCards, addPropCard, deletePropCard, updatePropCard,
    removeBlueprintPath, updateBlueprintPath,
    onOpenBlueprintLibrary: (idx) => setShowBlueprintLibrary(idx),
    handleCardHeightmapFile, clearCardHeightmap,
    handleDetermineAreaFile, clearDetermineArea,
    handlePropDensityMapFile, clearPropDensityMap,
  };

  const exportProps = {
    isReady: propCards.some(c => c.blueprintPaths.some(p => p.trim())),
    generateFiles,
    generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
  };

  const sectionContent = {
    config:   <TreesConfiguration {...configProps} />,
    channels: <TreesChannels {...channelsProps} />,
    props:    <TreesCards {...cardsProps} />,
    export:   <TreesExport {...exportProps} />,
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
      legendTitle="Prop Legend"
      legendRows={allCounts.map((item, idx) => ({
        id: item.id,
        color: item.color,
        label: item.propName || `Prop ${idx + 1}`,
        pts: item.count,
        meta: (item.totalMass || item.totalEnergy)
          ? `${item.totalMass.toLocaleString()} M · ${item.totalEnergy.toLocaleString()} E`
          : undefined,
      }))}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      selectedLegendId={propCards[selectedProp]?.id}
      onLegendSelect={(id, idx) => setSelectedProp(idx)}
      hint={isGenerating
        ? `${generationProgress.file} (${generationProgress.current}/${generationProgress.total})`
        : `${propMarkers.length} props · ${mirrorMode !== 'none' ? `${mirrorMode} mirror active` : 'no mirror'}`}
    />
  );

  return (
    <div className="treemap-tab trace-tab">

      {showBlueprintLibrary !== null && (
        <PropsLibraryOverlay
          mapName={mapName}
          mapsFolder={mapsFolderPath}
          noTextureEditor
          onConfirm={handlePropsLibraryConfirm}
          onClose={() => setShowBlueprintLibrary(null)}
        />
      )}

      {showBlueprintLibrary === null && (
        <button className="help-btn" onClick={() => setShowHelp(true)} title="Toggle Help Overlay">?</button>
      )}

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

      <TabLayout
        sections={[
          { id: 'config',   index: '01', label: 'Configuration', desc: 'Set the map name and global density, diffusion and grid parameters.', done: !!mapName.trim() },
          { id: 'channels', index: '02', label: 'Channels',       desc: 'Upload the density map, treeline heightmap and exclusion zone masks.', done: !!densityMap },
          { id: 'props',    index: '03', label: 'Props',          desc: 'Define prop cards with blueprints and per-card overrides, then generate.', count: propMarkers.length, done: propCards.some(c => c.blueprintPaths.some(p => p.trim())) },
          { id: 'export',   index: '04', label: 'Export',         desc: 'Configure export options and generate the files.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="TREEMAP"
        railStorageKey="treemap-rail-pinned"
        navLabel="TreeMap console navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>
    </div>
  );
};

export default TreemapTab;
