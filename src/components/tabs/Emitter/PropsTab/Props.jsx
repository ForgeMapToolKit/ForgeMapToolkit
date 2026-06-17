import React, { useState, useRef, useEffect } from 'react';
import '../../../shared/design-system/index.css';
import '../../../shared/shared.css';
import './Props.css';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibraryOverlay from '../../Libraries/PropsLibrary/PropsLibraryOverlay';
import EmitterLibraryOverlay from '../../Libraries/EmitterLibrary/EmitterLibraryOverlay';
import PropsHelpModal from '../../HelpModals/Props_help.jsx';
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import {
  EmitterAssignmentOverlay, MapPreview,
} from '../../../shared/entity-console/EntityConsole.jsx';
import {
  getMirroredCoords, kmLabel,
  ensureDir, writeFile, injectPropsLua, resolveToolkitEmitterPublicPaths,
  drawPlacementCanvas,
  usePersistentState, useMapInfo, useScmapPreview, useEmitterCategories,
} from '../../../shared/map-logic';
import PropsConfiguration from './Props_Configuration.jsx';
import PropsPropList from './Props_PropList.jsx';
import PropsMatching from './Props_Matching.jsx';
import PropsExport from './Props_Export.jsx';

const DEFAULT_PROP = {
  id: Date.now(),
  propName: '',
  propCategories: [],
  blueprintPaths: [''],
  coordinates: [{ x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }],
  color: `hsl(${Math.random() * 360}, 70%, 60%)`
};

const PropsTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  const [mapName,             setMapName]             = usePersistentState(s, 'pt_mapName', '', onSharedChange);
  const [mapsFolderPath,      setMapsFolderPath]      = usePersistentState(s, 'pt_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [emitterBpFolderPath, setEmitterBpFolderPath] = usePersistentState(s, 'pt_emitterBpFolderPath', '', onSharedChange);
  const [emitters,            setEmitters]            = usePersistentState(s, 'pt_emitters', [''], onSharedChange);
  const [emitterPublicPaths,  setEmitterPublicPaths]  = usePersistentState(s, 'pt_emitterPublicPaths', {}, onSharedChange);
  const [props,               setProps]               = usePersistentState(s, 'pt_props', [{ ...DEFAULT_PROP, id: Date.now() }], onSharedChange);
  const [emitterCategories,   setEmitterCategories]   = usePersistentState(s, 'pt_emitterCategories', {}, onSharedChange);
  const [emitterMatchingMode, setEmitterMatchingMode] = usePersistentState(s, 'pt_emitterMatchingMode', 'smart', onSharedChange);
  const [generateReadme,      setGenerateReadme]      = usePersistentState(s, 'pt_generateReadme', settings?.generateReadme !== false, onSharedChange);
  const [exportRawLua,        setExportRawLua]        = usePersistentState(s, 'pt_exportRawLua', false, onSharedChange);
  const [mirrorMode,          setMirrorMode]          = usePersistentState(s, 'pt_mirrorMode', settings?.defaultMirrorMode ?? 'diagonal', onSharedChange);
  const [activePtSection,     setActivePtSection]     = useState('config');

  const { mapInfo, mapSize, mapOffsetX, mapOffsetY } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('pt_mapSize', v),
  });

  // ─── SETTINGS SYNC ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder) setMapsFolderPath(settings.mapsFolder);
    if (settings.emitterBpFolder) setEmitterBpFolderPath(settings.emitterBpFolder);
    if (settings.defaultMirrorMode != null) setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  // ─── EMITTER FOLDER AUTO-DETECT ──────────────────────────────────────────
  useEffect(() => {
    if (emitterBpFolderPath) return;
    try {
      const href = window.location.href;
      const decoded = decodeURIComponent(href.replace(/^file:\/\/\//, ''));
      const appRoot = decoded.replace(/\/dist\/.*$/, '').replace(/\//g, '\\');
      setEmitterBpFolderPath(`${appRoot}\\public\\emitter`);
    } catch (e) { /* ignore */ }
  }, []);


  const [selectedProp, setSelectedProp] = useState(0);
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(null);
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [emitterLibrary, setEmitterLibrary] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
const [activeHelpTab, setActiveHelpTab] = useState('help-guide');
const [activeEmitterHelpSubTab, setActiveEmitterHelpSubTab] = useState('smart');
const [helpGuideSelected, setHelpGuideSelected] = useState(null);
const [activeAdvancedSubTab, setActiveAdvancedSubTab] = useState('workflow');
  const [showEmitterCategoryConfig, setShowEmitterCategoryConfig] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState({});

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const availableColors = [
    { name: 'Trainer', color: '#FFAF00', glow: 'rgba(255, 175, 0, 0.35)' },
    { name: 'Promotions', color: '#FF7B00', glow: 'rgba(255, 123, 0, 0.35)' },
    { name: 'FAF Live', color: '#FFFA00', glow: 'rgba(255, 250, 0, 0.35)' },
    { name: 'Tournament', color: '#A5E801', glow: 'rgba(165, 232, 1, 0.35)' },
    { name: 'Matchmaking', color: '#538A33', glow: 'rgba(83, 138, 51, 0.35)' },
    { name: 'Balance', color: '#8A12BD', glow: 'rgba(138, 18, 189, 0.35)' },
    { name: 'Games', color: '#00DDFF', glow: 'rgba(0, 221, 255, 0.35)' },
    { name: 'Creative', color: '#3B76FF', glow: 'rgba(59, 118, 255, 0.35)' },
    { name: 'Moderation', color: '#FE1818', glow: 'rgba(254, 24, 24, 0.35)' },
    { name: 'DevOps', color: '#3EA387', glow: 'rgba(62, 163, 135, 0.35)' },
    { name: 'Campaign', color: '#18C748', glow: 'rgba(24, 199, 72, 0.35)' },
    { name: 'Association', color: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.35)' },
    { name: 'Black', color: '#000000', glow: 'rgba(0, 0, 0, 0.35)' }
  ];

// ─── LIBRARY LOADERS ─────────────────────────────────────────────────────
const loadEmitterLibrary = async () => {
  if (!emitterBpFolderPath) {
    try {
      const saved = localStorage.getItem('emitter_library');
      if (saved) setEmitterLibrary(JSON.parse(saved));
      else setEmitterLibrary([]);
    } catch (e) {
      setEmitterLibrary([]);
    }
    return;
  }

  try {
    const collectBpFiles = async (dirPath, relativePrefix) => {
      const res = await window.electronAPI.invoke('list-dir', { dirPath });
      if (!res?.success) return [];
      const results = [];
      for (const entry of res.entries) {
        if (entry.isDirectory) {
          const sub = await collectBpFiles(
            `${dirPath}\\${entry.name}`,
            relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name
          );
          results.push(...sub);
        } else if (entry.name.endsWith('.bp')) {
          const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
          results.push({
            name: entry.name.replace('.bp', ''),
            path: relPath, 
            category: relativePrefix || '',
          });
        }
      }
      return results;
    };

    const files = (await collectBpFiles(emitterBpFolderPath, '')).sort((a, b) => a.name.localeCompare(b.name));
    setEmitterLibrary(files);
    localStorage.setItem('emitter_library', JSON.stringify(files));
  } catch (e) {
    console.error('Error reading emitter folder:', e);
    await luxuryAlert(`Error reading emitter.bp folder: ${e.message}`, 'Error', 'error');
  }
};

const handlePropsLibraryConfirm = (selectedProps) => {
  const propIndex = showBlueprintLibrary;
  if (propIndex === null || propIndex === undefined) return;
  const newProps = JSON.parse(JSON.stringify(props));
  newProps[propIndex].blueprintPaths = newProps[propIndex].blueprintPaths.filter(p => p.trim() !== '');

  selectedProps.forEach(prop => {
    const adj = prop.textureAdjustments;
    const hasAdj = adj && (
      adj.hue !== 0 || adj.saturation !== 100 ||
      adj.brightness !== 100 || adj.contrast !== 100 ||
      adj.gamma !== 100 ||
      (adj.tint && adj.tint.opacity > 0) ||
      (adj.selectiveColor && adj.selectiveColor.enabled) ||
      (adj.selection && adj.selection.enabled)
    );

    let gamePath;
    if (hasAdj) {
      const origPath = prop.gamePath || prop.resolvedPath || prop.id;
      const baseName = origPath.split('/').pop()
        .replace(/_prop\.bp$/i, '')
        .replace(/\.bp$/i, '');

      const allUsedPaths = newProps.flatMap(p =>
        (p.pendingTextureOps || []).map(op => op.targetBpPath)
      );

      let customName = `${baseName}_custom`;
      let candidate  = `/env/props/${customName}/${customName}_prop.bp`;
      let idx = 2;
      while (
        newProps[propIndex].blueprintPaths.includes(candidate) ||
        allUsedPaths.includes(candidate)
      ) {
        customName = `${baseName}_custom_${String(idx).padStart(2, '0')}`;
        candidate  = `/env/props/${customName}/${customName}_prop.bp`;
        idx++;
      }
      gamePath = candidate;
    } else {
      gamePath = prop.gamePath || prop.resolvedPath || prop.id;
    }

    if (gamePath && !newProps[propIndex].blueprintPaths.includes(gamePath)) {
      newProps[propIndex].blueprintPaths.push(gamePath);
    }

    if (hasAdj) {
      if (!newProps[propIndex].pendingTextureOps) newProps[propIndex].pendingTextureOps = [];
      newProps[propIndex].pendingTextureOps.push({
        originalProp: prop,
        adjustments:  adj,
        targetBpPath: gamePath,
      });
    }
  });

  if (!newProps[propIndex].blueprintPaths.some(p => p === '')) {
    newProps[propIndex].blueprintPaths.push('');
  }
  setProps(newProps);
};

// ─── LIBRARY HANDLERS ────────────────────────────────────────────────────
  const selectEmitterFromLibrary = (selectedEmitters) => {
    if (!selectedEmitters?.length) return;

    const currentMapName = (mapName || '').trim();
    const finalMapName   = currentMapName.match(/\.v\d{4}$/) ? currentMapName : currentMapName + '.v0001';

    const newPaths      = [];
    const newPublicPaths = {};

    for (const e of selectedEmitters) {
      if (e.source === 'toolkit' && e.publicPath) {
        // Custom file from public/emitter — build the in-game map path immediately
        const fileName    = (e.publicPath.replace(/\\/g, '/')).split('/').pop();
        const mapGamePath = `/maps/${finalMapName}/env/props/emitter/${fileName}`;
        newPaths.push(mapGamePath);
        newPublicPaths[mapGamePath] = e.publicPath;
      } else {
        // Vanilla or map-custom — use gamePath as-is
        newPaths.push(e.gamePath || e.path || e.id || '');
      }
    }

    setEmitterPublicPaths(prev => ({ ...prev, ...newPublicPaths }));

    setEmitters(prev => {
      let next = [...prev];
      for (const p of newPaths) {
        if (!p) continue;
        const emptyIdx = next.findIndex(e => e === '');
        if (emptyIdx !== -1) next[emptyIdx] = p;
        else next.push(p);
      }
      if (!next.some(e => e === '')) next.push('');
      return next;
    });

    setShowEmitterLibrary(false);
  };

  const addEmitter = () => {
    setEmitters([...emitters, '']);
  };

  const updateEmitter = (index, value) => {
    const newEmitters = [...emitters];
    newEmitters[index] = value;
    setEmitters(newEmitters);
  };

  const deleteEmitter = (index) => {
    if (emitters.length === 1) {
      setEmitters(['']);
    } else {
      setEmitters(emitters.filter((_, i) => i !== index));
    }
  };

  const selectEmitterBpFolder = async () => {
    const res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Select Emitter.bp Folder' });
    if (!res.success) return;
    const folderPath = res.path;
    const folderName = folderPath.split('\\').pop() || folderPath.split('/').pop();
    if (!folderName.toLowerCase().includes('emitter')) {
      const ok = await luxuryConfirm(
        `Warning: The selected directory is named "${folderName}".\n\nNormally the "emitter.bp" folder should be selected.\n\nContinue anyway?`,
        'Warning', 'Continue Anyway', 'Cancel'
      );
      if (!ok) return;
    }
    setEmitterBpFolderPath(folderPath);
    await luxuryAlert(`✓ Emitter.bp folder selected: ${folderName}\n\nThis setting is saved and does not need to be set again.`, 'Success', 'success');
  };

  const selectMapsFolder = async () => {
    const res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Select Maps Folder' });
    if (!res.success) return;
    const folderPath = res.path;
    const folderName = folderPath.split('\\').pop() || folderPath.split('/').pop();
    if (folderName.toLowerCase() !== 'maps') {
      const ok = await luxuryConfirm(
        `Warning: The selected directory is named "${folderName}".\n\nNormally the "maps" folder should be selected.\n\nContinue anyway?`,
        'Warning', 'Continue Anyway', 'Cancel'
      );
      if (!ok) return;
    }
    setMapsFolderPath(folderPath);
    await luxuryAlert(`✓ Maps folder selected: ${folderName}\n\nThis setting is saved and does not need to be set again.`, 'Success', 'success');
  };

const {
  getAllUniqueCategories,
  isEmitterActiveForCategory,
  toggleEmitterCategory,
  getEmitterNameFromPath,
  getEmittersForEntity: getEmittersForProp,
} = useEmitterCategories({
  entities: props,
  getCategories: prop => prop.propCategories,
  emitters,
  emitterCategories,
  setEmitterCategories,
  matchingMode: emitterMatchingMode,
});

  const addProp = () => {
const newProp = {
  id: Date.now(),
  propName: '',
  propCategories: [],
  blueprintPaths: [''],
  coordinates: [{ x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }],
  color: `hsl(${Math.random() * 360}, 70%, 60%)`
};
    setProps([...props, newProp]);
    setSelectedProp(props.length);
  };

  const updatePropName = (index, value) => {
    const newProps = [...props];
    newProps[index].propName = value;
    setProps(newProps);
  };

  const updateBlueprintPath = (propIndex, pathIndex, value) => {
    const newProps = [...props];
    newProps[propIndex].blueprintPaths[pathIndex] = value;
    
    const lastPath = newProps[propIndex].blueprintPaths[newProps[propIndex].blueprintPaths.length - 1];
    if (lastPath && lastPath.trim() !== '') {
      newProps[propIndex].blueprintPaths.push('');
    }
    
    setProps(newProps);
  };

  const deleteBlueprintPath = (propIndex, pathIndex) => {
    const newProps = [...props];
    if (newProps[propIndex].blueprintPaths.length === 1) {
      newProps[propIndex].blueprintPaths = [''];
    } else {
      newProps[propIndex].blueprintPaths = newProps[propIndex].blueprintPaths.filter((_, i) => i !== pathIndex);
    }
    setProps(newProps);
  };

  const deleteAllProps = async () => {
    const confirmed = await luxuryConfirm('Delete all prop cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setProps([{ ...DEFAULT_PROP, id: Date.now() }]);
    setSelectedProp(0);
  };

  const deleteProp = (index) => {
    if (props.length === 1) {
setProps([{
  id: Date.now(),
  propName: '',
  propCategories: [],
  blueprintPaths: [''],
  coordinates: [{ x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }],
  color: `hsl(${Math.random() * 360}, 70%, 60%)`
}]);
      setSelectedProp(0);
    } else {
      setProps(props.filter((_, i) => i !== index));
      if (selectedProp >= props.length - 1) {
        setSelectedProp(Math.max(0, props.length - 2));
      }
    }
  };

  const updatePropColor = (index, color) => {
    const newProps = [...props];
    newProps[index].color = color;
    setProps(newProps);
  };

  const addCoordinate = (propIndex) => {
    const newProps = [...props];
    newProps[propIndex].coordinates.push({ x: '', y: '', z: '', isMirrored: false, mirrorPairId: null });
    setProps(newProps);
  };

  const updateCoordinate = (propIndex, coordIndex, field, value) => {
    const newProps = [...props];
    newProps[propIndex].coordinates[coordIndex][field] = value;
    setProps(newProps);
  };

  const deleteCoordinate = (propIndex, coordIndex) => {
    const newProps = [...props];
    const coord = newProps[propIndex].coordinates[coordIndex];

    if (coord.mirrorPairId) {
      const mirrorIndex = newProps[propIndex].coordinates.findIndex((c, idx) =>
        idx !== coordIndex && c.mirrorPairId === coord.mirrorPairId
      );
      if (mirrorIndex !== -1) {
        const indices = [coordIndex, mirrorIndex].sort((a, b) => b - a);
        indices.forEach(idx => {
          if (newProps[propIndex].coordinates.length === 1) {
            newProps[propIndex].coordinates[0] = { x: '', y: '', z: '', isMirrored: false, mirrorPairId: null };
          } else {
            newProps[propIndex].coordinates.splice(idx, 1);
          }
        });
      } else {
        if (newProps[propIndex].coordinates.length === 1) {
          newProps[propIndex].coordinates[0] = { x: '', y: '', z: '', isMirrored: false, mirrorPairId: null };
        } else {
          newProps[propIndex].coordinates.splice(coordIndex, 1);
        }
      }
    } else {
      if (newProps[propIndex].coordinates.length === 1) {
        newProps[propIndex].coordinates[0] = { x: '', y: '', z: '', isMirrored: false, mirrorPairId: null };
      } else {
        newProps[propIndex].coordinates.splice(coordIndex, 1);
      }
    }

    setProps(newProps);
  };

  const deleteAllCoordinates = (propIndex) => {
    const newProps = [...props];
    newProps[propIndex].coordinates = [{ x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }];
    setProps(newProps);
  };

// ─── CANVAS ───────────────────────────────────────────────────────────────
  const handleCanvasClick = (e) => {
    if (selectedProp < 0 || selectedProp >= props.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = ((e.clientX - rect.left) / rect.width) * 1024;
    const canvasZ = ((e.clientY - rect.top) / rect.height) * 1024;

    const mapSizeNum = parseFloat(mapSize) || 1024;
    const scale = mapSizeNum / 1024;

    const worldX = canvasX * scale + mapOffsetX;
    const worldZ = canvasZ * scale + mapOffsetY;

    const clickTolerance = 10 * scale;
    const newProps = [...props];

    // ─── Check if click hits an existing coordinate of the selected prop ──────
    let clickedCoordIndex = -1;
    for (let i = 0; i < newProps[selectedProp].coordinates.length; i++) {
      const coord = newProps[selectedProp].coordinates[i];
      if (coord.x && coord.z) {
        const distance = Math.sqrt(
          Math.pow(worldX - parseFloat(coord.x), 2) +
          Math.pow(worldZ - parseFloat(coord.z), 2)
        );
        if (distance <= clickTolerance) {
          clickedCoordIndex = i;
          break;
        }
      }
    }

    if (clickedCoordIndex !== -1) {
      deleteCoordinate(selectedProp, clickedCoordIndex);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (mirrorMode === 'none') {
      const emptyCoordIndex = newProps[selectedProp].coordinates.findIndex(c => !c.x && !c.z);
      if (emptyCoordIndex !== -1) {
        newProps[selectedProp].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2), y: '2', z: worldZ.toFixed(2),
          isMirrored: false, mirrorPairId: null
        };
      } else {
        newProps[selectedProp].coordinates.push({
          x: worldX.toFixed(2), y: '2', z: worldZ.toFixed(2),
          isMirrored: false, mirrorPairId: null
        });
      }
      setProps(newProps);
    } else {
      const mirrored = getMirroredCoords(worldX, worldZ, mapSize, mirrorMode, mapOffsetX);
      const pairId = `mirror_${Date.now()}_${Math.random()}`;

      const emptyCoordIndex = newProps[selectedProp].coordinates.findIndex(c => !c.x && !c.z);
      if (emptyCoordIndex !== -1) {
        newProps[selectedProp].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2), y: '2', z: worldZ.toFixed(2),
          isMirrored: false, mirrorPairId: pairId
        };
      } else {
        newProps[selectedProp].coordinates.push({
          x: worldX.toFixed(2), y: '2', z: worldZ.toFixed(2),
          isMirrored: false, mirrorPairId: pairId
        });
      }

      newProps[selectedProp].coordinates.push({
        x: mirrored.x.toFixed(2), y: '2', z: mirrored.z.toFixed(2),
        isMirrored: true, mirrorPairId: pairId
      });

      setProps(newProps);
    }
  };
const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        if (typeof imageData === 'string') {
          localStorage.setItem('shared_preview_image', imageData);
          setPreviewImageData(imageData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // ─── CANVAS DRAW ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPlacementCanvas(ctx, {
      width: canvas.width, height: canvas.height,
      mapSize: parseInt(mapSize) || 1024,
      mapOffsetX, mapOffsetY,
      previewImage, mirrorMode,
      entities: props, selectedIdx: selectedProp,
      getColor: prop => {
        const r = parseInt(prop.color.match(/hsl\((\d+)/)?.[1] || 0);
        return `hsl(${r}, 70%, 60%)`;
      },
      getCoords: prop => prop.coordinates,
      grid: { stroke: 'rgba(255,255,255,0.07)', span: 'inner', whenPreview: true },
      borderRect: 'rgba(255, 255, 255, 0.2)',
    });
  }, [props, selectedProp, previewImage, mirrorMode, mapSize, mapOffsetX, mapOffsetY]);

  // ─── OVERLAY MARKERS ─────────────────────────────────────────────────────
  const markers = [];
  props.forEach((prop, propIdx) => {
    prop.coordinates.forEach((coord, coordIdx) => {
      if (coord.x && coord.z) {
        const mapSizeNum = parseInt(mapSize) || 1024;
        const x = ((parseFloat(coord.x) - mapOffsetX) / mapSizeNum) * 100;
        const z = ((parseFloat(coord.z) - mapOffsetY) / mapSizeNum) * 100;

        markers.push({
          id: `${prop.id}-${coordIdx}`,
          x, z,
          color: prop.color,
          propName: prop.propName || `Prop ${propIdx + 1}`,
          isSelected: propIdx === selectedProp,
          isMirrored: coord.isMirrored,
          propIdx,
          coordIdx
        });
      }
    });
  });

// ─── FILE GENERATION ─────────────────────────────────────────────────────
const generateFiles = async () => {
  try {
    if (!mapName || !mapName.trim()) {
      await luxuryAlert('Please enter a map name before generating.', 'Missing Map Name', 'warning');
      return;
    }

    const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert(
        'No Maps folder configured.\n\nPlease set the Maps Folder in Settings.',
        'Missing Maps Folder', 'warning'
      );
      return;
    }

    let finalMapName = mapName.trim();
    if (!finalMapName.match(/\.v\d{4}$/)) {
      finalMapName += '.v0001';
    }

    // ── Copy toolkit emitters (public/emitter/*) → map/env/props/emitter/ ────
    // emitterPublicPaths only contains source=toolkit entries — map-custom
    // and vanilla emitters are already on the map or in game files, skip them.
    const emitterDestDir = `${mapsFolder}\\${finalMapName}\\env\\props\\emitter`;
    const activeEmitters = emitters.filter(e => e.trim());

    // Rebuild missing publicPaths on-the-fly (lost after app restart — not persisted)
    const resolvedEmitterPublicPaths = await resolveToolkitEmitterPublicPaths({
      paths: emitters, knownPublic: emitterPublicPaths,
      mapsFolder, mapName: finalMapName,
    });

    const toolkitEntries = Object.entries(resolvedEmitterPublicPaths).filter(
      ([gamePath]) => activeEmitters.includes(gamePath)
    );

    if (toolkitEntries.length > 0) {
      await ensureDir(emitterDestDir);

      for (const [gamePath, src] of toolkitEntries) {
        const filename = gamePath.replace(/\\/g, '/').split('/').pop();
        const r = await window.electronAPI.invoke('copy-file', { src, dest: `${emitterDestDir}\\${filename}` });
        if (!r?.success) console.warn(`copy-file failed for "${filename}": ${r?.error}`);
      }
    }

    const allTextureOps = [];
    props.forEach(prop => {
      if (prop.pendingTextureOps?.length) {
        allTextureOps.push(...prop.pendingTextureOps);
      }
    });

    if (allTextureOps.length > 0) {
      const result = await window.electronAPI.invoke('generate-prop-files', {
        textureOps: allTextureOps,
        mapsFolder,
        mapName: finalMapName,
      });

      if (!result?.success) {
        const warn = result?.warnings?.join('\n') || result?.error || 'Unknown error';
        const proceed = await luxuryConfirm(
          `Some texture operations had issues:\n\n${warn}\n\nContinue generating marker files anyway?`,
          'Texture Warning', 'Continue', 'Cancel'
        );
        if (!proceed) return;
      }
    }

    let totalFiles = 0;
    props.forEach(prop => {
      const validPaths  = prop.blueprintPaths?.filter(p => p.trim()) ?? [];
      const validCoords = prop.coordinates?.filter(c => c.x && c.z) ?? [];
      totalFiles += validPaths.length * validCoords.length * 2;
    });

    if (totalFiles === 0) {
      await luxuryAlert(
        'No props with valid blueprint paths and coordinates found.',
        'Nothing to Generate', 'warning'
      );
      return;
    }

    const mapFolderPath  = `${mapsFolder}\\${finalMapName}`;
    const emitterDirRoot = `${mapFolderPath}\\env\\props\\emitter`;
    try {
      await ensureDir(emitterDirRoot);
    } catch (err) {
      await luxuryAlert(`Error creating directory:\n${err.message}`, 'Error', 'error');
      return;
    }

    let filesCreated = 0;
    const propsLuaEntries = [];

    for (const prop of props) {
      const validBpPaths = (prop.blueprintPaths ?? []).filter(p => p.trim());
      const validCoords  = (prop.coordinates   ?? []).filter(c => c.x && c.z);
      if (validBpPaths.length === 0 || validCoords.length === 0) continue;

      for (const bpPath of validBpPaths) {
        const bpFilename = bpPath.split('/').pop().replace(/\\/g, '/').split('\\').pop();
        const bpBaseName = bpFilename.replace(/_prop\.bp$/i, '').replace(/\.bp$/i, '');

        let createPropPath;
        if (bpPath.startsWith('/maps/') || bpPath.startsWith('maps/')) {
          createPropPath = bpPath.startsWith('/') ? bpPath : `/${bpPath}`;
        } else if (bpPath.startsWith('/env/') || bpPath.startsWith('env/')) {
          createPropPath = bpPath.startsWith('/') ? bpPath : `/${bpPath}`;
        } else {
          createPropPath = `/maps/${finalMapName}${bpPath.startsWith('/') ? bpPath : `/${bpPath}`}`;
        }

        const bpTypeDirPath = `${emitterDirRoot}\\props\\${bpBaseName}`;
        await ensureDir(bpTypeDirPath);

        for (let coordIdx = 0; coordIdx < validCoords.length; coordIdx++) {
          const coord = validCoords[coordIdx];
          const coordNumber  = String(coordIdx + 1).padStart(2, '0');
          const instanceName = `${bpBaseName}_${coordNumber}`;

          const instanceDirPath = `${bpTypeDirPath}\\${instanceName}`;
          await ensureDir(instanceDirPath);

          const x = parseFloat(coord.x) || 0;
          const y = parseFloat(coord.y) || 2;
          const z = parseFloat(coord.z) || 0;

          const validEmitterPaths = emitters.filter(e => e.trim());
          let emitterPath = '/effects/emitters/destruction_explosion_concussion_ring_03_emit.bp';

          if (validEmitterPaths.length > 0) {
            const availableEmitters = getEmittersForProp(prop);
            emitterPath = availableEmitters[Math.floor(Math.random() * availableEmitters.length)];
          }

          if (emitterPath) {
            if (emitterPath.startsWith('/maps/') ||
                emitterPath.startsWith('/effects/') ||
                emitterPath.startsWith('/env/') ||
                emitterPath.startsWith('/textures/') ||
                emitterPath.startsWith('/units/') ||
                emitterPath.startsWith('/projectiles/')) {
            } else {
              const rel = emitterPath.startsWith('/') ? emitterPath.substring(1) : emitterPath;
              emitterPath = `/maps/${finalMapName}/env/props/emitter/${rel}`;
            }
          }

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
        HelpText = '${instanceName}',
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

${instanceName} = Class(Prop) {

    _onCreateExecuted = false,

    OnCreate = function(self)
        Prop.OnCreate(self)

        if ${instanceName}._onCreateExecuted then
            LOG('${instanceName}: OnCreate skipped (already executed)')
            self:Destroy()
            return
        end

        ${instanceName}._onCreateExecuted = true
        LOG('${instanceName}: OnCreate executed')

        local treeGroup = CreateProp(Vector(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}), '${createPropPath}')

        if treeGroup and treeGroup.Trash then
            treeGroup.Trash:Add(
                CreateEmitterAtBone(treeGroup, -1, -1, '${emitterPath}')
            )
            LOG('${instanceName}: Emitter attached to tree group')
        else
            LOG('${instanceName}: Warning - treeGroup or treeGroup.Trash is nil')
        end

        self:Destroy()
    end,
}

TypeClass = ${instanceName}`;

          await writeFile(`${instanceDirPath}\\${instanceName}_prop.bp`,    propContent);
          filesCreated++;
          await writeFile(`${instanceDirPath}\\${instanceName}_script.lua`, scriptContent);
          filesCreated++;

          const markerBpGamePath = `/maps/${finalMapName}/env/props/emitter/props/${bpBaseName}/${instanceName}/${instanceName}_prop.bp`;
          propsLuaEntries.push({ path: markerBpGamePath, x, z });
        }
      }
    }

    let propsLuaContent = 'return {\n';
    for (const entry of propsLuaEntries) {
      propsLuaContent +=
`    {
        path = "${entry.path}",
        position = {
            ${entry.x.toFixed(3)},
            0,
            ${entry.z.toFixed(3)},
        },
        rotationX = {
            1,
            0,
            0,
        },
        rotationY = {
            0,
            1,
            0,
        },
        rotationZ = {
            0,
            0,
            1,
        },
        scale = {
            1,
            1,
            1,
        },
    },\n`;
    }
    propsLuaContent += '}\n';

    // ── props.lua schreiben (raw oder via SCMAP-Repack) ───────────────────
    const { propsLuaFileName } = await injectPropsLua({
      mapFolderPath, content: propsLuaContent, exportRawLua,
    });

    // ─── README ──────────────────────────────────────────────────────────────
    if (generateReadme) {
      const kmStr = kmLabel(mapSize);

      const outputLines = [`  Total placements : ${propsLuaEntries.length}`];
      if (exportRawLua && propsLuaFileName)
        outputLines.push(`  Raw props.lua    : ${propsLuaFileName}  ← next to .scmap in map folder`);
      outputLines.push(`  Output dir       : env\\props\\emitter\\props\\`);

      const validEmitters = emitters.filter(e => e.trim());
      const emitterLines  = validEmitters.length === 0
        ? ['  (none configured)']
        : validEmitters.map(e => `  • ${e}`);
      emitterLines.push(`  Matching Mode : ${emitterMatchingMode}`);

      const propCardLines = [];
      props.forEach((prop, idx) => {
        const validBpPaths = (prop.blueprintPaths ?? []).filter(p => p.trim());
        const validCoords  = (prop.coordinates   ?? []).filter(c => c.x && c.z);
        if (validBpPaths.length === 0 && validCoords.length === 0) return;
        const label = prop.propName || `Prop ${idx + 1}`;
        propCardLines.push('');
        propCardLines.push(`  [${String(idx + 1).padStart(2, '0')}] ${label}`);
        propCardLines.push(`       Coordinates : ${validCoords.length}`);
        propCardLines.push(`       Blueprint paths (${validBpPaths.length}):`);
        validBpPaths.forEach(p => propCardLines.push(`         • ${p}`));
        if (prop.propCategories?.length > 0)
          propCardLines.push(`       Categories  : ${prop.propCategories.filter(c => c.trim()).join(', ')}`);
        if (prop.pendingTextureOps?.length > 0)
          propCardLines.push(`       Texture ops : ${prop.pendingTextureOps.length} pending`);
      });

      const readmeContent = buildReadme({
        tool:    'Props Tab',
        mapName: finalMapName,
        mapSize: `${mapSize} × ${mapSize} (${kmStr} km)`,
        sections: [
          { title: 'MAP SETTINGS (extra)', entries: [['Maps Folder', mapsFolder], ['Mirror Mode', mirrorMode]] },
          { title: 'OUTPUT SUMMARY',       lines: outputLines },
          { title: 'GLOBAL EMITTER PATHS', lines: emitterLines },
          { title: 'PROP CARDS',           lines: propCardLines },
          { title: 'HOW TO USE', lines: exportRawLua ? [
            `  1. ${propsLuaFileName} has been written to the map root folder.`,
            '     Copy it into the unpacked .scmap folder and repack with BrewMapTool',
            '     or use the SCMAP tab in ForgeMapToolkit to inject it.',
            '  2. Re-generating is always safe — each run writes a new numbered',
            '     props.lua without overwriting existing ones.',
            '  3. Prop/script files are in: env/props/emitter/props/',
          ] : [
            '  1. The .scmap has been repacked with the new props.lua chunk.',
            '  2. Reload the map in the FA editor to see the prop placements.',
            '  3. Re-generating is always safe — each run adds a new numbered',
            '     props.lua chunk without touching existing ones.',
            '  4. Prop/script files are in: env/props/emitter/props/',
          ]},
        ],
        footer: ['Generated by ForgeMapToolkit · github.com/CookiezTerror'],
      });
      await writeReadme(`${mapFolderPath}\\Props_Generation_README.txt`, readmeContent);
    }

    const currentSettings = await window.electronAPI.invoke('settings-load');
    if (currentSettings?.autoOpenExportFolder) {
      await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
    }

    let propsSuccessMsg = `✓ ${propsLuaEntries.length} prop placements generated!\n\nFiles:\n${mapFolderPath}\\env\\props\\emitter\\props\\`;
    if (exportRawLua && propsLuaFileName) propsSuccessMsg += `\n✓ props.lua saved: ${mapFolderPath}\\${propsLuaFileName}`;
    if (generateReadme) propsSuccessMsg += '\n✓ README written to map folder';
    await luxuryAlert(propsSuccessMsg, 'Generation Complete', 'success');


  } catch (error) {
    console.error('Generation error:', error);
    await luxuryAlert(`Error generating files: ${error.message}`, 'Error', 'error');
  }
};

  // ── Import from Map (Props) ────────────────────────────────────────────────
  const [showPropsImportModal, setShowPropsImportModal] = useState(false);
  const [propsImportChunks, setPropsImportChunks]       = useState([]);
  const [propsImportLoading, setPropsImportLoading]     = useState(false);

  const handleOpenPropsImport = async () => {
    const defaultFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();

    const res = await window.electronAPI.invoke('settings-pick-folder', {
      title: 'Select Map Folder to Import From',
      defaultPath: defaultFolder || undefined,
    });
    if (!res?.success) return;

    const mapFolderPath = res.path;
    const folderName    = mapFolderPath.replace(/\\/g, '/').split('/').pop();

    const confirmed = await luxuryConfirm(
      `Import props from "${folderName}"?\n\nThe .scmap will be unpacked and all props*.lua chunks listed. You can choose which ones to import.`,
      'Import from Map', 'info'
    );
    if (!confirmed) return;

    setPropsImportLoading(true);
    try {
      const dirRes = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
      if (!dirRes?.success) throw new Error('Map folder could not be read');
      const scmapEntry = dirRes.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
      if (!scmapEntry) throw new Error('No .scmap file found in the map folder');

      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath: `${mapFolderPath}\\${scmapEntry.name}` });
      if (!unpackRes?.success) throw new Error(`Unpack failed: ${unpackRes?.error}`);

      const unpackedDir = await window.electronAPI.invoke('list-dir', { dirPath: unpackRes.outputFolder });
      const luaFiles = (unpackedDir?.entries || []).filter(e => /^props(\d+)?\.lua$/i.test(e.name));

      if (luaFiles.length === 0) {
        await luxuryAlert('No props*.lua chunks found in the .scmap.', 'Nothing Found', 'warning');
        setPropsImportLoading(false);
        return;
      }

      const chunks = [];
      for (const f of luaFiles) {
        const readRes = await window.electronAPI.invoke('read-file', { path: `${unpackRes.outputFolder}\\${f.name}` });
        chunks.push({ name: f.name, content: readRes?.content || '', active: true });
      }

      setPropsImportChunks(chunks);
      setShowPropsImportModal(true);
    } catch (err) {
      await luxuryAlert(`Import failed: ${err.message}`, 'Error', 'error');
    } finally {
      setPropsImportLoading(false);
    }
  };

  const handleConfirmPropsImport = async () => {
    const activeChunks = propsImportChunks.filter(c => c.active);
    if (activeChunks.length === 0) {
      setShowPropsImportModal(false);
      return;
    }

    const coordsByPath = {};

    for (const chunk of activeChunks) {
      const pathMatches = [...chunk.content.matchAll(/path\s*=\s*"([^"]+)"/g)];
      const posMatches  = [...chunk.content.matchAll(/position\s*=\s*\{([^}]+)\}/g)];
      const len = Math.min(pathMatches.length, posMatches.length);
      for (let i = 0; i < len; i++) {
        const bpPath = pathMatches[i][1];
        const parts  = posMatches[i][1].split(',').map(s => s.trim());
        const x = parts[0] || '0';
        const z = parts[2] || '0';
        if (!coordsByPath[bpPath]) coordsByPath[bpPath] = new Map();
        const key = `${x},${z}`;
        if (!coordsByPath[bpPath].has(key)) coordsByPath[bpPath].set(key, { x, y: parts[1] || '0', z });
      }
    }

    const bpPaths = Object.keys(coordsByPath);
    if (bpPaths.length === 0) {
      await luxuryAlert('No prop entries found in the selected chunks.', 'Nothing Found', 'warning');
      setShowPropsImportModal(false);
      return;
    }

    setProps(prev => {
      let next = [...prev];
      for (const bpPath of bpPaths) {
        const incomingCoords = Array.from(coordsByPath[bpPath].values()).map(c => ({
          x: c.x, y: c.y, z: c.z, isMirrored: false, mirrorPairId: null,
        }));
        const existingIdx = next.findIndex(p => (p.blueprintPaths || []).includes(bpPath));
        if (existingIdx !== -1) {
          const existingKeys = new Set(next[existingIdx].coordinates.map(c => `${c.x},${c.z}`));
          const newCoords = incomingCoords.filter(c => !existingKeys.has(`${c.x},${c.z}`));
          if (newCoords.length > 0) {
            next = next.map((p, i) => i === existingIdx
              ? { ...p, coordinates: [...p.coordinates.filter(c => c.x || c.z), ...newCoords, { x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }] }
              : p
            );
          }
        } else {
          next = [...next, {
            id: Date.now() + Math.random(),
            propName: bpPath.split('/').pop().replace(/_prop\.bp$/i, ''),
            propCategories: [],
            blueprintPaths: [bpPath, ''],
            coordinates: [...incomingCoords, { x: '', y: '', z: '', isMirrored: false, mirrorPairId: null }],
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
          }];
        }
      }
      return next.filter(p => p.blueprintPaths?.some(b => b) || p.coordinates?.some(c => c.x || c.z));
    });

    const totalCoords = Object.values(coordsByPath).reduce((s, m) => s + m.size, 0);
    await luxuryAlert(
      `✓ Import complete!\n\n${bpPaths.length} blueprint path(s), ${totalCoords} coordinate(s) imported.`,
      'Import Successful', 'success'
    );
    setShowPropsImportModal(false);
    setPropsImportChunks([]);
  };

  // ── Section Props ───────────────────────────────────────────────────────────

  const configProps = {
    mapName, setMapName, mapInfo,
    emitters, updateEmitter, deleteEmitter,
    onAddEmitter: addEmitter,
    onOpenLibrary: () => setShowEmitterLibrary(true),
  };

  const propListProps = {
    props, selectedProp, setSelectedProp,
    availableColors, showColorPicker, setShowColorPicker,
    coordsOpen, setCoordsOpen,
    handleOpenPropsImport, propsImportLoading,
    deleteAllProps, addProp, deleteProp, updatePropColor, updatePropName,
    onAddCategory: (propIdx) => setProps(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, propCategories: [...(p.propCategories || []), ''] } : p)),
    onUpdateCategory: (propIdx, catIdx, value) => setProps(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, propCategories: (p.propCategories || []).map((c, j) => j === catIdx ? value : c) } : p)),
    onDeleteCategory: (propIdx, catIdx) => setProps(prev => prev.map((p, i) =>
      i === propIdx ? { ...p, propCategories: (p.propCategories || []).filter((_, j) => j !== catIdx) } : p)),
    updateBlueprintPath, deleteBlueprintPath,
    onOpenBlueprintLibrary: (propIdx) => setShowBlueprintLibrary(propIdx),
    addCoordinate, updateCoordinate, deleteCoordinate, deleteAllCoordinates,
  };

  const matchingProps = {
    emitterMatchingMode, setEmitterMatchingMode,
    onConfigure: () => setShowEmitterCategoryConfig(true),
  };

  const exportProps = {
    ready: props.some(p => p.coordinates.some(c => c.x && c.z)),
    generateFiles,
    generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
  };

  return (
    <div className="props-tab tab-scrollbar" style={{ '--tab-color': 'var(--props-color)', '--tab-glow': 'var(--props-glow)', '--tab-glow-strong': 'var(--props-glow-strong)' }}>
      {/* ── Props Import Modal ── */}
      {showPropsImportModal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000 }}
            onClick={() => setShowPropsImportModal(false)}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--surface-2, #1a1a2e)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px', padding: '28px', zIndex: 1001, minWidth: '420px', maxWidth: '600px',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#fff', letterSpacing: '0.08em' }}>
              SELECT PROPS CHUNKS
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
              All active by default. Deselect chunks you don't want to import.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {propsImportChunks.map((chunk, i) => (
                <div key={i} className={`check-row${chunk.active ? ' checked' : ''}`}
                  onClick={() => setPropsImportChunks(prev => prev.map((c, j) => j === i ? { ...c, active: !c.active } : c))}>
                  <div className="check-box">
                    {chunk.active && <div className="check-tick" />}
                  </div>
                  <span className="check-label" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {chunk.name}
                    <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                      ({(chunk.content.match(/path\s*=/g) || []).length} entries)
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="action-button" onClick={() => setShowPropsImportModal(false)}>Cancel</button>
              <button className="button-solid button-solid--accent" onClick={handleConfirmPropsImport}>
                ✓ Import ({propsImportChunks.filter(c => c.active).length} chunk(s))
              </button>
            </div>
          </div>
        </>
      )}
            {showBlueprintLibrary !== null && (
        <PropsLibraryOverlay
          mapName={mapName}
          mapsFolder={mapsFolderPath}
          noTextureEditor
          onConfirm={handlePropsLibraryConfirm}
          onClose={() => setShowBlueprintLibrary(null)}
          accentColor="var(--props-color)"
          accentGlow="var(--props-glow)"
        />
      )}

{showEmitterCategoryConfig && (
  <EmitterAssignmentOverlay
    entities={props}
    getEntityTitle={(prop, idx) => prop.propName?.toUpperCase() || `Prop ${idx + 1}`}
    getEntityColor={(prop) => prop.color}
    getEntityCategories={(prop) => prop.propCategories}
    getEmittersForEntity={getEmittersForProp}
    categories={getAllUniqueCategories()}
    emitters={emitters.filter(p => p.trim())}
    isActive={isEmitterActiveForCategory}
    onToggle={toggleEmitterCategory}
    getName={getEmitterNameFromPath}
    entityNoun="prop"
    sidebarHint="Emitters active per prop"
    onClose={() => setShowEmitterCategoryConfig(false)}
    colorVars={{
      '--tab-color': 'var(--props-color)',
      '--tab-glow': 'var(--props-glow)',
      '--tab-glow-strong': 'var(--props-glow-strong)',
    }}
  />
)}

 {showEmitterLibrary && (
  <EmitterLibraryOverlay
    mapName={mapName}
    mapsFolder={mapsFolderPath}
    onConfirm={selectEmitterFromLibrary}
    onClose={() => setShowEmitterLibrary(false)}
  />
)}


      {showBlueprintLibrary === null && !showEmitterLibrary && !showEmitterCategoryConfig && (
        <button className="help-btn" onClick={() => setShowHelp(true)} title="Help">?</button>
      )}

      {showHelp && (
        <PropsHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpGuideSelected={helpGuideSelected}
          setHelpGuideSelected={setHelpGuideSelected}
          activeAdvancedSubTab={activeAdvancedSubTab}
          setActiveAdvancedSubTab={setActiveAdvancedSubTab}
          mirrorMode={mirrorMode}
        />
      )}

      <WorkspaceConsole
        sections={[
          { id: 'config',   index: '01', label: 'Configuration', desc: 'Set the map name and assign emitter blueprints.', done: !!(mapName.trim() && emitters.some(p => p.trim())) },
          { id: 'props',    index: '02', label: 'Props',         desc: 'Define prop types and place coordinates on the map canvas.', count: props.reduce((n, p) => n + p.coordinates.filter(c => c.x && c.z).length, 0), done: props.some(p => p.coordinates.some(c => c.x && c.z)) },
          { id: 'matching', index: '03', label: 'Matching',      desc: 'Configure how emitters are assigned to prop categories.', done: !!emitterMatchingMode },
          { id: 'export',   index: '04', label: 'Export',        desc: 'Generate prop marker files and inject them into the .scmap.' },
        ]}
        activeSection={activePtSection}
        onSelect={setActivePtSection}
mirrorSlot={
  <div className="preview-panel-head-controls">
    <select className="field-select" style={{ width: 'auto' }} value={mirrorMode} onChange={(e) => setMirrorMode(e.target.value)}>
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
          localStorage.removeItem('shared_preview_image');
          setPreviewImageData(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          const canvas = canvasRef.current;
          if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
        }}
      >
        Delete Preview
      </button>
    )}
  </div>
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
            onMarkerDelete={(marker) => deleteCoordinate(marker.propIdx, marker.coordIdx)}
            markerTitle={(marker) => `${marker.propName} — Click to delete`}
            showPlaceholder={!previewImage && props.every(p => p.coordinates.every(c => !c.x))}
            placeholder="Click on canvas to place props"
            legendTitle="Prop Legend"
            legendRows={props.map((prop, idx) => ({
              id: prop.id,
              color: prop.color,
              label: prop.propName || `Prop ${idx + 1}`,
              pts: prop.coordinates.filter(c => c.x && c.z).length,
            }))}
            hint={`Click canvas to place · ${mirrorMode !== 'none' ? `${mirrorMode} mirror active` : 'no mirror'}`}
          />
        }
        ghostLabel="PROPS"
        renderEyebrow={(s) => `PROP REGISTER — ${s.index} — PROPS CONSOLE`}
        railStorageKey="pt-rail-pinned"
        navLabel="Props console navigation"
        bootMs={280}
      >
        {activePtSection === 'config' && <PropsConfiguration {...configProps} />}

        {activePtSection === 'props' && <PropsPropList {...propListProps} />}

        {activePtSection === 'matching' && <PropsMatching {...matchingProps} />}

        {activePtSection === 'export' && <PropsExport {...exportProps} />}
      </WorkspaceConsole>
    </div>
  );
};

export default PropsTab;