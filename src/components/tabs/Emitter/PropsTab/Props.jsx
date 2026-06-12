import React, { useState, useRef, useEffect } from 'react';
import '../../../shared/shared.css';
import './Props.css';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import PropsLibraryOverlay from '../../Libraries/PropsLibrary/PropsLibraryOverlay';
import EmitterLibraryOverlay from '../../Libraries/EmitterLibrary/EmitterLibraryOverlay';
import PropsHelpModal from '../../HelpModals/Props_help.jsx';

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

  const [mapSize, setMapSizeState] = useState(s.pt_mapSize ?? settings?.defaultMapSize ?? '1024');
  const [mapName, setMapNameState] = useState(s.pt_mapName ?? '');
  const [mapsFolderPath, setMapsFolderPathState] = useState(s.pt_mapsFolderPath ?? settings?.mapsFolder ?? '');
  const [mapInfo,              setMapInfo]              = useState(null);
  const [mapOffsetX,           setMapOffsetX]           = useState(0);
  const [mapOffsetY,           setMapOffsetY]           = useState(0);

  // ─── MAP INFO AUTO-FETCH ──────────────────────────────────────────────────
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
        onSharedChange('pt_mapSize', String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);
  const [emitterBpFolderPath, setEmitterBpFolderPathState] = useState(s.pt_emitterBpFolderPath ?? '');
  const [emitters, setEmittersState] = useState(s.pt_emitters ?? ['']);
  const [emitterPublicPaths, setEmitterPublicPathsState] = useState(s.pt_emitterPublicPaths ?? {});
  const [props, setPropsState] = useState(s.pt_props ?? [{ ...DEFAULT_PROP, id: Date.now() }]);
  const [emitterCategories, setEmitterCategoriesState] = useState(s.pt_emitterCategories ?? {});
  const [emitterMatchingMode, setEmitterMatchingModeState] = useState(s.pt_emitterMatchingMode ?? 'smart');
  const [generateReadme, setGenerateReadmeState] = useState(s.pt_generateReadme ?? (settings?.generateReadme !== false));
  const [exportRawLua,   setExportRawLuaState]   = useState(s.pt_exportRawLua   ?? false);
  const [mirrorMode,     setMirrorModeState]     = useState(s.pt_mirrorMode     ?? settings?.defaultMirrorMode ?? 'diagonal');

  const setMapSize             = v => { setMapSizeState(v);             onSharedChange('pt_mapSize', v); };
  const setMapName             = v => { setMapNameState(v);             onSharedChange('pt_mapName', v); };
  const setMapsFolderPath      = v => { setMapsFolderPathState(v);      onSharedChange('pt_mapsFolderPath', v); };
  const setEmitterBpFolderPath = v => { setEmitterBpFolderPathState(v); onSharedChange('pt_emitterBpFolderPath', v); };
  const setEmitters            = v => { setEmittersState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('pt_emitters', next); return next; }); };
  const setEmitterPublicPaths  = v => { setEmitterPublicPathsState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('pt_emitterPublicPaths', next); return next; }); };
  const setProps               = v => { setPropsState(prev   => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('pt_props', next); return next; }); };
  const setEmitterCategories   = v => { setEmitterCategoriesState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('pt_emitterCategories', next); return next; }); };
  const setEmitterMatchingMode = v => { setEmitterMatchingModeState(v); onSharedChange('pt_emitterMatchingMode', v); };
  const setGenerateReadme      = v => { setGenerateReadmeState(v);      onSharedChange('pt_generateReadme', v); };
  const setExportRawLua        = v => { setExportRawLuaState(v);        onSharedChange('pt_exportRawLua', v); };
  const setMirrorMode          = v => { setMirrorModeState(v);          onSharedChange('pt_mirrorMode', v); };

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
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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

// ─── PREVIEW IMAGE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    }
  }, [previewImageData]);

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

const getAllUniqueCategories = () => {
  const categoriesSet = new Set();
  props.forEach(prop => {
    if (prop.propCategories && prop.propCategories.length > 0) {
      prop.propCategories.forEach(cat => {
        if (cat && cat.trim()) categoriesSet.add(cat.trim());
      });
    }
  });
  return Array.from(categoriesSet).sort();
};

const toggleEmitterCategory = (emitterPath, category) => {
  setEmitterCategories(prev => {
    const newConfig = { ...prev };
    if (!newConfig[emitterPath]) newConfig[emitterPath] = [];
    const index = newConfig[emitterPath].indexOf(category);
    if (index > -1) {
      newConfig[emitterPath] = newConfig[emitterPath].filter(c => c !== category);
    } else {
      newConfig[emitterPath] = [...newConfig[emitterPath], category];
    }
    return newConfig;
  });
};

const isEmitterActiveForCategory = (emitterPath, category) => {
  if (!emitterCategories[emitterPath]) return true;
  return !emitterCategories[emitterPath].includes(category);
};

const getEmitterNameFromPath = (path) => {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace('_emit.bp', '').replace('.bp', '').replace(/_/g, ' ');
};

const getEmittersForProp = (prop) => {
  const validEmitters = emitters.filter(p => p.trim());
  if (!prop.propCategories || prop.propCategories.length === 0) return validEmitters;
  const activeCategories = prop.propCategories.filter(c => c.trim());
  if (activeCategories.length === 0) return validEmitters;

  if (emitterMatchingMode === 'smart') {
    const perfectMatch = validEmitters.filter(path =>
      activeCategories.every(cat => isEmitterActiveForCategory(path, cat.trim()))
    );
    if (perfectMatch.length > 0) return perfectMatch;
    const partialMatch = validEmitters.filter(path =>
      activeCategories.some(cat => isEmitterActiveForCategory(path, cat.trim()))
    );
    if (partialMatch.length > 0) return partialMatch;
    return validEmitters;
  } else if (emitterMatchingMode === 'simple') {
    const unionMatch = validEmitters.filter(path =>
      activeCategories.some(cat => isEmitterActiveForCategory(path, cat.trim()))
    );
    return unionMatch.length > 0 ? unionMatch : validEmitters;
  } else if (emitterMatchingMode === 'lastCategory') {
    const lastCat = activeCategories[activeCategories.length - 1].trim();
    const lastMatch = validEmitters.filter(path => isEmitterActiveForCategory(path, lastCat));
    return lastMatch.length > 0 ? lastMatch : validEmitters;
  }
  return validEmitters;
};

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
  const getMirroredCoords = (x, z, mapSize, mode) => {
    const mapSizeNum = parseFloat(mapSize) || 1024;
    switch (mode) {
      case 'diagonal': {
        const far = 2 * mapOffsetX + mapSizeNum;
        return { x: far - x, z: far - z };
      }
      case 'horizontal': {
        const far = 2 * mapOffsetX + mapSizeNum;
        return { x, z: far - z };
      }
      case 'vertical': {
        const far = 2 * mapOffsetX + mapSizeNum;
        return { x: far - x, z };
      }
      default:
        return null;
    }
  };

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
      const mirrored = getMirroredCoords(worldX, worldZ, mapSize, mirrorMode);
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
// ─── SCMAP PREVIEW AUTO-LOAD ─────────────────────────────────────────────
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
      console.warn('[Props] preview load failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Reset preview when map name or folder changes — then auto-load from scmap
  useEffect(() => {
    setPreviewImageData(null);
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return;
    const finalName     = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolderPath = folder + '\\' + finalName;
    loadPreviewFromScmap(mapFolderPath);
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

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
    const width = canvas.width;
    const height = canvas.height;
    const mapSizeNum = parseInt(mapSize) || 1024;

    ctx.clearRect(0, 0, width, height);

    if (previewImage && previewImage.complete) {
      ctx.drawImage(previewImage, 0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * width / 8, 0);      ctx.lineTo(i * width / 8, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * height / 8); ctx.lineTo(width, i * height / 8);    ctx.stroke();
    }

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);

    if (mirrorMode === 'diagonal' || mirrorMode === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
    }

    if (mirrorMode === 'diagonal' || mirrorMode === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    props.forEach((prop, propIdx) => {
      prop.coordinates.forEach((coord, coordIdx) => {
        if (coord.x && coord.z) {
          const x = ((parseFloat(coord.x) - mapOffsetX) / mapSizeNum) * width;
          const z = ((parseFloat(coord.z) - mapOffsetY) / mapSizeNum) * height;

          const r = parseInt(prop.color.match(/hsl\((\d+)/)?.[1] || 0);
          const colorHex = `hsl(${r}, 70%, 60%)`;

          ctx.fillStyle = colorHex;
          ctx.shadowColor = colorHex;
          ctx.shadowBlur = propIdx === selectedProp ? 20 : 15;
          
          ctx.beginPath();
          ctx.arc(x, z, propIdx === selectedProp ? 8 : 6, 0, Math.PI * 2);
          ctx.fill();
          
          if (propIdx === selectedProp) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          if (coord.isMirrored) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 6, z - 6);
            ctx.lineTo(x - 6, z + 6);
            ctx.lineTo(x + 6, z - 6);
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
        }
      });
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }, [props, selectedProp, previewImage, mirrorMode, mapSize]);

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
const ensureDir = (dirPath) => window.electronAPI.invoke('ensure-dir', { dirPath });
const writeFile = (filePath, content) => window.electronAPI.invoke('write-file', { filePath, content });

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
    const resolvedEmitterPublicPaths = { ...emitterPublicPaths };
    const pathsNeedingLookup = activeEmitters.filter(p => !resolvedEmitterPublicPaths[p]);
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
        if (match) resolvedEmitterPublicPaths[rawPath] = match.publicPath;
      }
    }

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
            let availableEmitters = validEmitterPaths;
            const activeCategories = (prop.propCategories ?? []).filter(c => c.trim());

            if (activeCategories.length > 0) {
              if (emitterMatchingMode === 'smart') {
                const perfectMatch = validEmitterPaths.filter(path =>
                  activeCategories.every(cat => isEmitterActiveForCategory(path, cat))
                );
                if (perfectMatch.length > 0) {
                  availableEmitters = perfectMatch;
                } else {
                  const partialMatch = validEmitterPaths.filter(path =>
                    activeCategories.some(cat => isEmitterActiveForCategory(path, cat))
                  );
                  availableEmitters = partialMatch.length > 0 ? partialMatch : validEmitterPaths;
                }
              } else if (emitterMatchingMode === 'simple') {
                const unionMatch = validEmitterPaths.filter(path =>
                  activeCategories.some(cat => isEmitterActiveForCategory(path, cat))
                );
                availableEmitters = unionMatch.length > 0 ? unionMatch : validEmitterPaths;
              } else if (emitterMatchingMode === 'lastCategory') {
                const lastCat = activeCategories[activeCategories.length - 1];
                const lastMatch = validEmitterPaths.filter(path =>
                  isEmitterActiveForCategory(path, lastCat)
                );
                availableEmitters = lastMatch.length > 0 ? lastMatch : validEmitterPaths;
              }
            }

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

    // ── Nächsten freien props-Dateinamen bestimmen ────────────────────────
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

    // ── Schreiben & ggf. SCMAP-Repack ─────────────────────────────────────
    let scmapEntry = { name: `${finalMapName} (no SCMAP modified)` };
    if (exportRawLua) {
      // no-SCMAP: direkt ins Map-Root schreiben, fertig
      await writeFile(`${mapFolderPath}\\${propsLuaFileName}`, propsLuaContent);
    } else {
      // SCMAP-Modus: unpack → direkt in unpack-Ordner schreiben → repack
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

    // ─── README ──────────────────────────────────────────────────────────────
    if (generateReadme) {
      const kmPerUnit = 20 / 1024;
      const km        = (parseFloat(mapSize) || 1024) * kmPerUnit;
      const kmStr     = Number.isInteger(km) ? `${km}×${km}` : `${km.toFixed(1)}×${km.toFixed(1)}`;

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
                <label key={i} className="checkbox-label" style={{ cursor: 'pointer' }}
                  onClick={() => setPropsImportChunks(prev => prev.map((c, j) => j === i ? { ...c, active: !c.active } : c))}>
                  <div className={`checkbox${chunk.active ? ' checked' : ''}`}>
                    {chunk.active && (
                      <svg className="checkbox-check" viewBox="0 0 12 10" fill="none">
                        <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="checkbox-text" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {chunk.name}
                    <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                      ({(chunk.content.match(/path\s*=/g) || []).length} entries)
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowPropsImportModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmPropsImport}>
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

{showEmitterCategoryConfig && (() => {
        const allCategories = getAllUniqueCategories();
        const validEmitters = emitters.filter(p => p.trim());
        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1999 }}
              onClick={() => setShowEmitterCategoryConfig(false)}
            />
            <div
              className="help-modal"
              style={{ '--tab-color': 'var(--props-color)', '--tab-glow': 'var(--props-glow)', '--tab-glow-strong': 'var(--props-glow-strong)',
                width: 'calc(95vw - 500px)', maxWidth: '1500px',

                border: '2px solid rgba(165,232,1,0.25)',
                boxShadow: '0 25px 80px rgba(0,0,0,0.95), 0 0 100px var(--tab-glow)',
                zIndex: 2000,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, transparent, var(--tab-color) 30%, var(--tab-color) 70%, transparent)', boxShadow: '0 0 30px var(--tab-glow-strong)', zIndex: 1 }} />
              <div className="help-modal-header" style={{ background: 'rgba(165,232,1,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <h2 style={{ margin: '0 0 10px', color: 'var(--tab-color)', fontSize: '1.8rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Emitter-Category Assignment
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6 }}>
                      Control which emitters are used for specific prop categories.<br/>
                      Toggle emitter buttons to activate or deactivate them per category.
                    </p>
                  </div>
                  <button className="help-modal-close" onClick={() => setShowEmitterCategoryConfig(false)}>×</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
                {allCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '30px', opacity: 0.3 }}>📂</div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--text-primary)', fontWeight: 600 }}>No Prop Categories Defined</h3>
                    <p style={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto', color: 'var(--text-secondary)' }}>
                      Add categories to your props first.<br/>Go to the Props section and click "+ Add Category".
                    </p>
                  </div>
                ) : validEmitters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '30px', opacity: 0.3 }}>⚡</div>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--text-primary)', fontWeight: 600 }}>No Emitters Configured</h3>
                    <p style={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto', color: 'var(--text-secondary)' }}>
                      Add emitters in the Configuration section first.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Info box */}
                    <div style={{ background: 'rgba(165,232,1,0.05)', border: '1px solid rgba(165,232,1,0.2)', borderLeft: '4px solid var(--tab-color)', padding: '20px 25px', borderRadius: '4px', marginBottom: '10px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 600, color: 'var(--tab-color)' }}>How Assignment Works</p>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.92rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        <li><strong style={{ color: '#fff' }}>Colored button</strong> — emitter IS used for this category</li>
                        <li><strong style={{ color: '#fff' }}>Gray button</strong> — emitter is NOT used for this category</li>
                        <li>All emitters are active by default — deactivate to exclude</li>
                      </ul>
                    </div>

                    {allCategories.map((category, catIdx) => {
                      const activeCount = validEmitters.filter(path => isEmitterActiveForCategory(path, category)).length;
                      return (
                        <div key={catIdx}
                          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '25px 30px', transition: 'all 0.3s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(165,232,1,0.25)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--tab-color)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Space Grotesk, sans-serif', marginBottom: '4px' }}>{category}</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{activeCount} of {validEmitters.length} emitters active</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                            {validEmitters.map((emitterPath, emitterIdx) => {
                              const isActive = isEmitterActiveForCategory(emitterPath, category);
                              const emitterName = getEmitterNameFromPath(emitterPath);
                              return (
                                <button
                                  key={emitterIdx}
                                  onClick={() => toggleEmitterCategory(emitterPath, category)}
                                  title={emitterPath}
                                  style={{
                                    background: isActive ? 'linear-gradient(135deg, rgba(165,232,1,0.25) 0%, rgba(165,232,1,0.12) 100%)' : 'rgba(255,255,255,0.06)',
                                    color: isActive ? 'var(--tab-color)' : 'rgba(255,255,255,0.45)',
                                    border: `2px solid ${isActive ? 'var(--tab-color)' : 'rgba(255,255,255,0.12)'}`,
                                    padding: '12px 16px', borderRadius: '4px', cursor: 'pointer',
                                    fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, letterSpacing: '0.03em',
                                    transition: 'all 0.25s cubic-bezier(0.23,1,0.32,1)',
                                    boxShadow: isActive ? '0 0 18px var(--tab-glow)' : 'none',
                                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                                  }}
                                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(165,232,1,0.3)'; } }}
                                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; } }}
                                >
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emitterName}</span>
                                  {isActive && <span style={{ fontWeight: 700, color: 'var(--tab-color)' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ padding: '18px 30px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {allCategories.length} {allCategories.length === 1 ? 'category' : 'categories'} · {validEmitters.length} emitters · {props.length} props
                </span>
                <button className="btn-primary" onClick={() => setShowEmitterCategoryConfig(false)} style={{ padding: '10px 28px', fontSize: '0.88rem' }}>Done</button>
              </div>
            </div>

            {/* RIGHT SIDEBAR: Live Preview */}
            <div style={{
              position: 'fixed', left: 0, top: 0, bottom: 0, width: '420px',
              background: 'linear-gradient(135deg, rgba(10,10,10,0.98) 0%, rgba(5,5,5,0.98) 100%)',
              borderRight: '2px solid rgba(165,232,1,0.2)', boxShadow: '5px 0 30px rgba(0,0,0,0.8)',
              zIndex: 2001, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg, transparent, var(--tab-color) 30%, var(--tab-color) 70%, transparent)', boxShadow: '0 0 20px var(--tab-glow)' }} />
              <div style={{ padding: '28px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--tab-color)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Space Grotesk, sans-serif' }}>
                  Live Preview
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Emitters that will be used per prop
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {props.map((prop, propIdx) => {
                    const applicable = getEmittersForProp(prop);
                    const hasCats = prop.propCategories && prop.propCategories.some(c => c.trim());
                    return (
                      <div key={prop.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: prop.color, boxShadow: `0 0 8px ${prop.color}`, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prop.propName?.toUpperCase() || `Prop ${propIdx + 1}`}
                            </div>
                            {hasCats && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                                {prop.propCategories.filter(c => c.trim()).map((cat, i) => (
                                  <span key={i} style={{ background: 'rgba(165,232,1,0.12)', border: '1px solid rgba(165,232,1,0.25)', color: 'var(--tab-color)', padding: '1px 7px', borderRadius: '3px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', padding: '6px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                          {applicable.length} emitter{applicable.length !== 1 ? 's' : ''} active
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {applicable.map((p, i) => (
                            <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(165,232,1,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p}>
                              {getEmitterNameFromPath(p)}
                            </div>
                          ))}
                          {applicable.length === 0 && (
                            <div style={{ fontSize: '0.73rem', color: 'rgba(255,193,7,0.7)', fontStyle: 'italic', textAlign: 'center', padding: '6px' }}>No matching emitters</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {props.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.3 }}>🌿</div>
                      <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>No props configured yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

 {showEmitterLibrary && (
  <EmitterLibraryOverlay
    mapName={mapName}
    mapsFolder={mapsFolderPath}
    onConfirm={selectEmitterFromLibrary}
    onClose={() => setShowEmitterLibrary(false)}
  />
)}


      {showBlueprintLibrary === null && !showEmitterLibrary && (
        <button className="help-btn" onClick={() => setShowHelp(true)} title="Help">?</button>
      )}
      <div className="tab-grid">
        <div className="tab-col-config">
          <div className="section-card">
            <h2 className="section-title">
              CONFIGURATION
            </h2>
<div className="form-group">
  <label className="form-label">Map Name</label>
  <input
    type="text"
    className="form-input"
    value={mapName}
    onChange={(e) => setMapName(e.target.value)}
    placeholder="e.g. Hades_Dust.v0002"
  />

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
  {mapName && (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px', fontStyle: 'italic' }}>
      {`Saves to: /maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/`}
    </div>
  )}
</div>



<div className="form-group">
  <label className="form-label">Emitters</label>
              {emitters.map((emitter, idx) => {
                const ABSOLUTE_PREFIXES = ['/maps/', '/effects/', '/env/', '/textures/', '/units/', '/projectiles/'];
                const isAbsolute = ABSOLUTE_PREFIXES.some(p => emitter.startsWith(p));
                const displayValue = (mapName && emitter && !isAbsolute)
                  ? `/maps/${mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001'}/${emitter.startsWith('/') ? emitter.substring(1) : emitter}`
                  : emitter;
                return (
                <div key={idx} className="input-row">
                  <input
                    type="text"
                    className="form-input"
                    value={displayValue}
onChange={(e) => {
  let newVal = e.target.value;
  if (mapName) {
    const finalMapName = mapName.match(/\.v\d{4}$/) ? mapName : mapName + '.v0001';
    const prefix = `/maps/${finalMapName}/`;
    if (newVal.startsWith(prefix)) {
      newVal = '/' + newVal.substring(prefix.length);
    }
  }
  updateEmitter(idx, newVal);
}}
placeholder="/env/Desert/Props/Emitters/DesertBlowingSand02_prop.bp"
                  />
                  
                  <button
                    className="btn-delete-sm"
                    onClick={() => deleteEmitter(idx)}
                  >
                    ×
                  </button>
                </div>
                );
              })}
              <button onClick={addEmitter} className="btn-secondary" style={{ width: '100%', marginBottom: '10px' }}>
                + Add Emitter
              </button>
              <button 
                onClick={() => setShowEmitterLibrary(true)}
                className="btn-library"
                style={{ width: '100%' }}
              >
                Library
              </button>
            </div>
          </div>

          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ margin: 0 }}>PROPS</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  onClick={handleOpenPropsImport}
                  disabled={propsImportLoading}
                  title="Import props from the current map's .scmap"
                >
                  {propsImportLoading ? '…' : '↓ Import from Map'}
                </button>
                {props.length >= 1 && (
                  <button
                    className="btn-delete-text"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', height: 'auto' }}
                    onClick={deleteAllProps}
                    title="Delete all prop cards"
                  >
                    Delete All
                  </button>
                )}
              </div>
            </div>

            <div className="units-grid">
              {props.map((prop, propIdx) => (
                <div 
                  key={prop.id} 
                  className={`item-card ${propIdx === selectedProp ? 'selected' : ''}`}
                  onClick={() => setSelectedProp(propIdx)}
                >
                  <div className="item-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div
                        className="item-card-color-indicator"
                        style={{ backgroundColor: prop.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowColorPicker(showColorPicker === propIdx ? null : propIdx);
                        }}
                      />
                      <span className="item-card-title">
                        Prop {propIdx + 1}
                      </span>
                    </div>
                    <button
                      className="btn-delete-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProp(propIdx);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {showColorPicker === propIdx && (
                    <div 
                      className="item-card-color-picker"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="item-card-color-grid">
                        {availableColors.map((colorOption, cIdx) => (
                          <div
                            key={cIdx}
                            className="item-card-color-option"
                            style={{ backgroundColor: colorOption.color }}
                            onClick={() => {
                              updatePropColor(propIdx, colorOption.color);
                              setShowColorPicker(null);
                            }}
                            title={colorOption.name}
                          />
                        ))}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom color (#HEX or hsl())"
                        style={{ marginTop: '10px' }}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          if (value) updatePropColor(propIdx, value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {propIdx === selectedProp && (
                    <div className="item-card-details">
                      <div className="form-group">
                        <label className="form-label">Prop Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={prop.propName}
                          onChange={(e) => updatePropName(propIdx, e.target.value)}
                          placeholder="e.g. lava_tree01"
                        />
                      </div>
<div className="form-group">
  <label className="form-label">Categories</label>

{(prop.propCategories || []).map((cat, catIdx) => (
  <div key={catIdx} className="input-row" style={{ marginBottom: '8px' }}>
    <input
      type="text"
      className="form-input"
      value={cat}
      onChange={(e) => {
        const newProps = [...props];
        newProps[propIdx].propCategories[catIdx] = e.target.value;
        setProps(newProps);
      }}
      onClick={(e) => e.stopPropagation()}
    />
    <button
      className="btn-delete-sm"
      onClick={(e) => {
        e.stopPropagation();
        const newProps = [...props];
        newProps[propIdx].propCategories.splice(catIdx, 1);
        setProps(newProps);
      }}
    >×</button>
  </div>
))}
<button
  className="btn-secondary"
  onClick={(e) => {
    e.stopPropagation();
    const newProps = [...props];
    if (!newProps[propIdx].propCategories) newProps[propIdx].propCategories = [];
    newProps[propIdx].propCategories.push('');
    setProps(newProps);
  }}
>+ Add Category</button>
</div>
                      <div className="form-group">
                        <label className="form-label">Blueprint Paths</label>
                        {prop.blueprintPaths.map((path, pathIdx) => (
                          <div key={pathIdx} className="input-row">
                            <input
                              type="text"
                              className="form-input"
                              value={path}
                              onChange={(e) => updateBlueprintPath(propIdx, pathIdx, e.target.value)}
                              placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp"
                            />
                            <button
                              className="btn-delete-sm"
                              onClick={() => deleteBlueprintPath(propIdx, pathIdx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            setShowBlueprintLibrary(propIdx);
                          }} 
                          className="btn-library"
                          style={{ width: '100%' }}
                        >
                          Library
                        </button>
                      </div>

                      <div className="form-group">
                                                <div
                          className="subsection-title"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setCoordsOpen(prev => ({ ...prev, [propIdx]: !prev[propIdx] }))}
                        >
                          Coordinates ({prop.coordinates.filter(c => c.x && c.z).length})
                        </div>
                        {coordsOpen[propIdx] && (<>
                          {prop.coordinates.map((coord, coordIdx) => (
                            <div key={coordIdx} className="coordinate-entry">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span className="props-coord-label">
                                  {coord.isMirrored ? `Point ${coordIdx + 1} (mirror)` : `Point ${coordIdx + 1}`}
                                </span>
                                <button
                                  className="btn-delete-xs"
                                  onClick={() => deleteCoordinate(propIdx, coordIdx)}
                                >×</button>
                              </div>
                              <div className="coord-grid">
                                <div className="coord-field">
                                  <label>X</label>
                                  <input
                                    type="text"
                                    className="form-input-sm"
                                    value={coord.x}
                                    onChange={(e) => updateCoordinate(propIdx, coordIdx, 'x', e.target.value)}
                                  />
                                </div>
                                <div className="coord-field">
                                  <label>Y</label>
                                  <input
                                    type="text"
                                    className="form-input-sm"
                                    value={coord.y}
                                    onChange={(e) => updateCoordinate(propIdx, coordIdx, 'y', e.target.value)}
                                  />
                                </div>
                                <div className="coord-field">
                                  <label>Z</label>
                                  <input
                                    type="text"
                                    className="form-input-sm"
                                    value={coord.z}
                                    onChange={(e) => updateCoordinate(propIdx, coordIdx, 'z', e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => addCoordinate(propIdx)}
                              style={{ flex: 1 }}
                            >+ Add Coordinate</button>
                            {prop.coordinates.some(c => c.x && c.z) && (
                              <button
                                className="btn-delete"
                                onClick={async () => {
                                  const ok = await luxuryConfirm('Delete all coordinates for this prop?', 'Confirm Delete', 'Delete All', 'Cancel');
                                  if (ok) deleteAllCoordinates(propIdx);
                                }}
                                style={{ padding: '10px 20px' }}
                              >Delete All</button>
                            )}
                          </div>
                        </>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="item-card-add" onClick={addProp}>
                <div className="item-card-add-icon">
                  <span style={{ fontSize: '2rem' }}>+</span>
                </div>
                <span className="item-card-add-text">ADD PROP TYPE</span>
              </div>
            </div>
          </div>

          <div className="section-card">
  <label className="form-label">
    Emitter Matching Mode
  </label>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
    {[
      { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',    note: 'Prop ["Forest", "Dense"] gets only emitters active for BOTH categories first' },
      { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',    note: 'Prop ["Forest", "Dense"] gets all emitters active for Forest OR Dense' },
      { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',   note: 'Prop ["Forest", "Lava", "Dense"] → matches "Dense" only' },
    ].map(({ key, label, desc, note }) => (
      <div
        key={key}
        onClick={() => setEmitterMatchingMode(key)}
        style={{
          padding: '14px 18px',
          background: emitterMatchingMode === key
            ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
            : 'rgba(255,255,255,0.04)',
          border: `2px solid ${emitterMatchingMode === key ? 'var(--tab-color)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease',
          boxShadow: emitterMatchingMode === key ? '0 0 16px var(--tab-glow)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${emitterMatchingMode === key ? 'var(--tab-color)' : 'rgba(255,255,255,0.4)'}`,
            background: emitterMatchingMode === key ? 'var(--tab-color)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {emitterMatchingMode === key && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#000' }} />}
          </div>
          <strong style={{ fontSize: '0.92rem', color: emitterMatchingMode === key ? 'var(--tab-color)' : '#fff', fontWeight: 600 }}>
            {label}
          </strong>
        </div>
        <p style={{ margin: '0 0 2px 30px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>
        <em style={{ margin: '0 0 0 30px', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block' }}>{note}</em>
      </div>
    ))}
  </div>
  <button 
    onClick={() => setShowEmitterCategoryConfig(true)}
    className="btn-secondary"
    style={{ width: '100%', padding: '18px 40px', fontSize: '0.95rem' }}
  >
    Configure Emitter-Category Assignment
  </button>
</div>

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

                    <div className="section-card">
            <label className="checkbox-label" style={{ marginBottom: '12px' }} onClick={() => setGenerateReadme(!generateReadme)}>
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
            <button onClick={generateFiles} className="btn-primary btn-lg">
              GENERATE FILES
            </button>
          </div>
        </div>

        <div className="tab-col-detail">
          <div className="section-card preview-card">
            <div className="preview-header">
              <h2 className="section-title" style={{ margin: 0 }}>
                PREVIEW
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="btn-toggle"
                  value={mirrorMode}
                  onChange={(e) => setMirrorMode(e.target.value)}
                >
                  <option value="none">No Mirror</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
{previewImageData && (
  <button
    className="btn-delete-text"
    onClick={() => {
      localStorage.removeItem('shared_preview_image');
      setPreviewImage(null);
      setPreviewImageData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }}
  >
    Delete Preview
  </button>
        )}
              </div>
            </div>

            {previewLoading ? (
              <div className="upload-area" style={{ cursor: 'default', opacity: 0.7 }}>
                <span>Loading preview from .scmap…</span>
              </div>
            ) : (
              <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                <span className="upload-icon"></span>
                <span>{previewImageData ? 'Click to replace map image' : 'Click to upload map image manually'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="props-file-input"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            )}

            <div className="props-canvas-container" style={{ position: 'relative', width: '700px', height: '700px' }}>
              <canvas
                ref={canvasRef}
                className="props-preview-canvas"
                width={1024}
                height={1024}
                onClick={handleCanvasClick}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none'
              }}>
                {markers.map(marker => (
                  <div
                    key={marker.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCoordinate(marker.propIdx, marker.coordIdx);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${marker.x}%`,
                      top: `${marker.z}%`,
                      transform: 'translate(-50%, -50%)',
                      width: marker.isSelected ? '16px' : '12px',
                      height: marker.isSelected ? '16px' : '12px',
                      borderRadius: '50%',
                      backgroundColor: marker.color,
                      border: marker.isSelected ? '3px solid white' : '2px solid white',
                      boxShadow: `0 0 ${marker.isSelected ? '20px' : '15px'} ${marker.color}, 0 0 ${marker.isSelected ? '10px' : '5px'} rgba(255,255,255,0.5)`,
                      transition: 'all 0.3s ease',
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                    title={`${marker.propName} — Click to delete`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
                      e.currentTarget.style.boxShadow = `0 0 30px ${marker.color}, 0 0 15px rgba(255,255,255,0.8)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = `0 0 ${marker.isSelected ? '20px' : '15px'} ${marker.color}, 0 0 ${marker.isSelected ? '10px' : '5px'} rgba(255,255,255,0.5)`;
                    }}
                  >
                    {marker.isMirrored && (
                      <div style={{
                        position: 'absolute',
                        inset: '-2px',
                        borderLeft: '2px solid white',
                        borderTop: '2px solid white'
                      }} />
                    )}
                  </div>
                ))}
              </div>

              {!previewImage && props.every(p => p.coordinates.every(c => !c.x)) && (
                <div className="props-canvas-placeholder">
                  Click on canvas to place props
                </div>
              )}
            </div>

            <div className="preview-legend">
              <div className="preview-legend-title">PROP LEGEND</div>
              <div className="preview-legend-items">
                {props.map((prop, idx) => (
                  <div key={prop.id} className="preview-legend-item">
                    <div
                      className="preview-legend-color"
                      style={{ backgroundColor: prop.color }}
                    />
                    <span className={idx === selectedProp ? 'selected' : ''}>
                      {prop.propName || `Prop ${idx + 1}`}
                    </span>
                    <span className="preview-coord-count">
                      {prop.coordinates.filter(c => c.x && c.z).length} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hint-box">
              Click on the canvas to place coordinates - {mirrorMode !== 'none' ? `${mirrorMode} mirroring active` : 'No mirroring'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropsTab;