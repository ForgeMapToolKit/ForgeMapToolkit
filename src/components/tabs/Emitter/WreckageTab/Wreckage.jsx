import React, { useState, useRef, useEffect } from 'react';
import '../../../shared/shared.css';
import '../../../shared/trace.css';
import './Wreckage.css';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import UnitLibraryOverlay from '../../Libraries/UnitLibrary/UnitLibraryOverlay';
import EmitterLibraryOverlay from '../../Libraries/EmitterLibrary/EmitterLibraryOverlay';
import { WreckageHelp, WreckageHelpButton } from './Wreckage_help';
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
  MatchingMode, OutputChecklist, EmitterAssignmentOverlay, MapPreview,
} from '../../../shared/entity-console/EntityConsole.jsx';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_UNIT = {
  id: Date.now(),
  unitType: '', unitName: '', unitCategories: [],
  coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null }],
  color: `hsl(${Math.random() * 360}, 70%, 60%)`
};

// ── RotationSlideshow ────────────────────────────────────────────────────────

const RotationSlideshow =({ label, images, captions }) => {
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 2500);
    return () => clearInterval(t);
  }, [images.length]);

  const src = `./assets/help/${images[idx]}.png`;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem', color: '#fff' }}>{label}</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          {images.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'background 0.2s' }} />
          ))}
        </div>
      </div>
      <img
        src={src}
        alt={captions[images[idx]]}
        style={{ width: '100%', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
      />
      <div style={{ padding: '8px 14px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', minHeight: '32px' }}>
        {captions[images[idx]]}
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const WreckageTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {
  const s = shared;

  // ── Shared State ──────────────────────────────────────────────────────────────

  const [mapSize,             setMapSizeState]             = useState(s.wr_mapSize             ?? settings?.defaultMapSize ?? '1024');
  const [mapName,             setMapNameState]             = useState(s.wr_mapName             ?? '');
  const [mapsFolderPath,      setMapsFolderPathState]      = useState(s.wr_mapsFolderPath      ?? settings?.mapsFolder     ?? '');
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
        onSharedChange('wr_mapSize', String(res.playableSize));
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found' });
        setMapSize('1024'); setMapOffsetX(0); setMapOffsetY(0);
      }
    }).catch(() => { setMapInfo(null); setMapSize('1024'); });

    // Auto-load preview image from .scmap when map name is entered
    loadPreviewFromScmap(mapFolderPath);
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

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
      if (ddsRes?.success && ddsRes.dataUrl) {
        setPreviewImageData(ddsRes.dataUrl);
      }
    } catch (e) {
      console.warn('[WR] preview load from scmap failed:', e);
    } finally {
      setPreviewLoading(false);
    }
  };
  const [emitterBpFolderPath, setEmitterBpFolderPathState] = useState(s.wr_emitterBpFolderPath ?? '');
  const [emitters,            setEmittersState]            = useState(s.wr_emitters            ?? ['']);
  const [blueprintPaths,      setBlueprintPathsState]      = useState(s.wr_blueprintPaths      ?? ['']);
  const [blueprintPublicPaths, setBlueprintPublicPathsState] = useState(s.wr_blueprintPublicPaths ?? {});
  const [units,               setUnitsState]               = useState(s.wr_units               ?? [{ ...DEFAULT_UNIT, id: Date.now() }]);
  const [emitterCategories,   setEmitterCategoriesState]   = useState(s.wr_emitterCategories   ?? {});
  const [emitterMatchingMode, setEmitterMatchingModeState] = useState(s.wr_emitterMatchingMode ?? 'smart');
  const [generateReadme,      setGenerateReadmeState]      = useState(s.wr_generateReadme      ?? (settings?.generateReadme !== false));
  const [exportRawLua,        setExportRawLuaState]        = useState(s.wr_exportRawLua        ?? false);
  const [mirrorMode,          setMirrorModeState]          = useState(s.wr_mirrorMode          ?? settings?.defaultMirrorMode ?? 'diagonal');

  // ── Shared State Setters ──────────────────────────────────────────────────────

  const setMapSize             = v => { setMapSizeState(v);             onSharedChange('wr_mapSize', v); };
  const setMapName             = v => { setMapNameState(v);             onSharedChange('wr_mapName', v); };
  const setMapsFolderPath      = v => { setMapsFolderPathState(v);      onSharedChange('wr_mapsFolderPath', v); };
  const setEmitterBpFolderPath = v => { setEmitterBpFolderPathState(v); onSharedChange('wr_emitterBpFolderPath', v); };
  const setEmitters            = v => { setEmittersState(prev      => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('wr_emitters', next); return next; }); };
  const setBlueprintPaths      = v => { setBlueprintPathsState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('wr_blueprintPaths', next); return next; }); };
  const setBlueprintPublicPaths = v => { setBlueprintPublicPathsState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('wr_blueprintPublicPaths', next); return next; }); };
  const setUnits               = v => { setUnitsState(prev          => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('wr_units', next); return next; }); };
  const setEmitterCategories   = v => { setEmitterCategoriesState(prev => { const next = typeof v === 'function' ? v(prev) : v; onSharedChange('wr_emitterCategories', next); return next; }); };
  const setEmitterMatchingMode = v => { setEmitterMatchingModeState(v); onSharedChange('wr_emitterMatchingMode', v); };
  const setGenerateReadme      = v => { setGenerateReadmeState(v);      onSharedChange('wr_generateReadme', v); };
  const setExportRawLua        = v => { setExportRawLuaState(v);        onSharedChange('wr_exportRawLua', v); };
  const setMirrorMode          = v => { setMirrorModeState(v);          onSharedChange('wr_mirrorMode', v); };

  // ── Settings Sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder)         setMapsFolderPath(settings.mapsFolder);
    if (settings.defaultMirrorMode != null) setMirrorMode(settings.defaultMirrorMode);
  }, [settings]);

  
  // ── Local UI State ────────────────────────────────────────────────────────────

  const [selectedUnit, setSelectedUnit] = useState(0);
  const [coordsOpen, setCoordsOpen] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showUnitLibrary, setShowUnitLibrary] = useState(false);
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(false);
  const [unitLibrary, setUnitLibrary] = useState({ categories: [] });
  const [emitterLibrary, setEmitterLibrary] = useState([]);
  const [blueprintLibrary, setBlueprintLibrary] = useState({ categories: [] });
  const [selectedBlueprints, setSelectedBlueprints] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [activeSection, setActiveSection] = useState('config');
  const [helpGuideSelected, setHelpGuideSelected] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
const [showEmitterCategoryConfig, setShowEmitterCategoryConfig] = useState(false);

  const mapNameRef = useRef(null);
  const mapSizeRef = useRef(null);
  const emittersRef = useRef(null);
  const unitsRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const coordReadoutRef = useRef(null);
  const mirrorModeRef = useRef(null);
  const generateButtonRef = useRef(null);
  const mapNameValueRef = useRef(mapName);
  useEffect(() => { mapNameValueRef.current = mapName; }, [mapName]);

  // ── Color Options ─────────────────────────────────────────────────────────────

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

  // ── Mirror Rotation ───────────────────────────────────────────────────────────

  const getMirroredRotation = (heading, pitch, roll, mode) => {
    const parseRotation = (val) => {
      if (typeof val === 'string') {
        if (val.includes('math.pi')) {
          return Math.PI;
        }
        return parseFloat(val) || 0;
      }
      return val;
    };

    const h = parseRotation(heading);
    const p = parseRotation(pitch);
    const r = parseRotation(roll);

    let mirroredHeading = h;
    let mirroredPitch = p;
    let mirroredRoll = r;

    switch (mode) {
      case 'diagonal':
        mirroredHeading = -h;
        mirroredPitch = p;
        mirroredRoll = -r;
        break;

      case 'horizontal':
        mirroredHeading = -h;
        mirroredPitch = -p;
        mirroredRoll = r;
        break;

      case 'vertical':
        mirroredHeading = Math.PI - h;
        mirroredPitch = p;
        mirroredRoll = -r;
        break;

      default:
        break;
    }

    const normalize = (angle) => {
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      return angle;
    };

    mirroredHeading = normalize(mirroredHeading);
    mirroredPitch = normalize(mirroredPitch);
    mirroredRoll = normalize(mirroredRoll);

    const formatRotation = (val) => {
      if (Math.abs(val - Math.PI) < 0.001) return 'math.pi';
      if (Math.abs(val + Math.PI) < 0.001) return '-math.pi';
      if (Math.abs(val) < 0.001) return '0.0';
      return val.toFixed(4);
    };

    return {
      heading: formatRotation(mirroredHeading),
      pitch: formatRotation(mirroredPitch),
      roll: formatRotation(mirroredRoll)
    };
  };

  // ── Library Helpers ───────────────────────────────────────────────────────────

  const getUnitNameFromLibrary = (unitId) => {
    if (!unitId || !unitLibrary.categories || unitLibrary.categories.length === 0) {
      return '';
    }
    
    for (const category of unitLibrary.categories) {
      for (const libUnit of category.units || []) {
        if (libUnit.id && libUnit.id.toLowerCase() === unitId.toLowerCase()) {
          return libUnit.name;
        }
      }
    }
    
    return '';
  };

  // ── Search ────────────────────────────────────────────────────────────────────

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const results = [];

    unitLibrary.categories?.forEach(category => {
      category.units?.forEach(unit => {
        const matchesName     = unit.name?.toLowerCase().includes(lowerQuery);
        const matchesId       = unit.id?.toLowerCase().includes(lowerQuery);
        const matchesLayer    = unit.layer?.toLowerCase().includes(lowerQuery);
        const matchesSubLabel = unit.subLabel?.toLowerCase().includes(lowerQuery);
        
        if (matchesName || matchesId || matchesLayer || matchesSubLabel) {
          results.push({ ...unit, categoryName: category.name });
        }
      });
    });

    setSearchResults(results);
  };
  

  // ── Library Adapters ─────────────────────────────────────────────────────────

const UNIT_PREVIEW_BASE_URL = 'https://timmasalme.github.io/ForgeMapToolkit-Assets/units/';

const adaptUnitsToLibrary = (units = []) => {
  const FACTION_TAGS = ['uef','cybran','aeon','seraphim','nomads','operations','civilian','dev'];
  const FACTION_LABELS = {
    uef: 'UEF', cybran: 'Cybran', aeon: 'Aeon', seraphim: 'Seraphim',
    nomads: 'Nomads', operations: 'Operations', civilian: 'Civilian', dev: 'Dev',
  };

  const TYPE_ORDER = {
    land: 0, air: 1, naval: 2,
    factory_land: 3, factory_air: 4, factory_naval: 5,
    structure: 6, experimental: 7, unknown: 8,
  };

  const getUnitType = (u) => {
    const cats = u.bpCategories || [];
    if (cats.includes('FACTORY')) {
      if (cats.includes('AIR'))   return 'factory_air';
      if (cats.includes('NAVAL')) return 'factory_naval';
      return 'factory_land';
    }
    if (cats.includes('EXPERIMENTAL')) return 'experimental';
    if (cats.includes('LAND'))    return 'land';
    if (cats.includes('AIR'))     return 'air';
    if (cats.includes('NAVAL'))   return 'naval';
    if (cats.includes('STRUCTURE')) return 'structure';
    return 'unknown';
  };

  const categoryMap = {};

  for (const u of units) {
    const faction  = u.faction || u.tags?.find(t => FACTION_TAGS.includes(t));
    const catName  = faction ? (FACTION_LABELS[faction] || faction.toUpperCase()) : 'Unknown';
    if (!categoryMap[catName]) categoryMap[catName] = [];

    const unitType  = getUnitType(u);
    const techLabel = u.tech ? `T${u.tech}` : null;
    const typeLabel = {
      land: 'Land', air: 'Air', naval: 'Naval',
      factory_land: 'Land Factory', factory_air: 'Air Factory', factory_naval: 'Naval Factory',
      structure: 'Structure', experimental: 'Experimental', unknown: '',
    }[unitType] || '';
    const subLabel = [techLabel, typeLabel].filter(Boolean).join(' · ');

    const baseName    = u.unitName || u.name || u.id;
    const cats        = u.bpCategories || [];
    const isHQFac     = cats.includes('FACTORY') && cats.includes('STRUCTURE')
                     && !cats.includes('GATE')
                     && !cats.includes('TECH1')
                     && !(u.id || '').toUpperCase().startsWith('Z')
                     && !(baseName || '').toLowerCase().includes('crab');
    const zTier = (() => {
      if (!(u.id || '').toUpperCase().startsWith('Z')) return null;
      const m = (u.id || '').match(/(\d{4})/);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      if (n >= 9600 && n <= 9699) return 'T3';
      if (n >= 9500 && n <= 9599) return 'T2';
      return null;
    })();
    const techFromId  = u.tech && u.tech <= 3 ? (u.tech === 3 ? 'T3' : u.tech === 2 ? 'T2' : null) : null;
    const facTier     = cats.includes('TECH3') ? 'T3' : cats.includes('TECH2') ? 'T2' : zTier || techFromId;
    const isSupportFac = (u.id || '').toUpperCase().startsWith('Z')
                      && (cats.includes('FACTORY') || u.layer === 'structure');
    const displayName = isHQFac && facTier ? `${baseName} ${facTier} HQ`
                      : isSupportFac && facTier ? `${baseName} ${facTier}`
                      : baseName;

    categoryMap[catName].push({
      id:            u.id,
      name:          displayName,
      tech:          u.tech,
      layer:         u.layer,
      unitType,
      tags:          u.tags,
      subLabel,
      bpCategories:   u.bpCategories  || [],
      classification: u.classification || null,
      strategicIcon:  u.strategicIcon  || null,
      preview: `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/units/${u.id.toUpperCase()}.png`,
    });
  }

  const categories = Object.entries(categoryMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, units]) => ({
      name,
      count: units.length,
      units: units.sort((a, b) => {
        const techA = a.tech || 99;
        const techB = b.tech || 99;
        if (techA !== techB) return techA - techB;
        const typeA = TYPE_ORDER[a.unitType] ?? 8;
        const typeB = TYPE_ORDER[b.unitType] ?? 8;
        if (typeA !== typeB) return typeA - typeB;
        return (a.name || '').localeCompare(b.name || '');
      }),
    }));

  return { generated: new Date().toISOString(), categories };
};

const adaptEmittersToLibrary = (emitters = []) =>
  emitters.map(e => ({ name: e.name || e.id, path: e.gamePath || e.id, tags: e.tags }));

const adaptPropsToLibrary = (props = []) => {
  const categoryMap = {};
  for (const p of props) {
    const typeTag = p.tags?.find(t => ['trees','rocks','wreckages','structures','vegetation','markers','misc'].includes(t));
    const catName = typeTag ? typeTag.charAt(0).toUpperCase() + typeTag.slice(1) : 'Misc';
    if (!categoryMap[catName]) categoryMap[catName] = [];
    categoryMap[catName].push({ name: p.name || p.id, path: p.gamePath || p.id, tags: p.tags });
  }
  const categories = Object.entries(categoryMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, props]) => ({ name, count: props.length, props }));
  return { categories };
};

  // ── Library Loader ────────────────────────────────────────────────────────────

const loadLibrariesFromIPC = async () => {
  setLibraryLoading(true);
  try {
    const data = await window.electronAPI.invoke('library-load');
    if (data?.scanned) {
      setUnitLibrary(adaptUnitsToLibrary(data.units));
      setEmitterLibrary(adaptEmittersToLibrary(data.emitters));
      setBlueprintLibrary(adaptPropsToLibrary(data.props));
    } else {
      setUnitLibrary({ categories: [] });
      setEmitterLibrary([]);
      setBlueprintLibrary({ categories: [] });
    }
  } catch (err) {
    setUnitLibrary({ categories: [] });
    setEmitterLibrary([]);
    setBlueprintLibrary({ categories: [] });
  } finally {
    setLibraryLoading(false);
  }
};

const loadUnitLibrary = loadLibrariesFromIPC;

  // ── Library Upload (manual override) ─────────────────────────────────────────

  const handleLibraryUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (type === 'unit') {
        setUnitLibrary(data.categories ? data : adaptUnitsToLibrary(data.units || data));
        await luxuryAlert(
          `Loaded ${data.categories?.length || 0} categories`,
          'Success', 'success'
        );
      } else if (type === 'emitter') {
        setEmitterLibrary(Array.isArray(data) ? data : adaptEmittersToLibrary(data.emitters || []));
        await luxuryAlert(`Loaded ${Array.isArray(data) ? data.length : data.emitters?.length || 0} emitters`, 'Success', 'success');
      } else if (type === 'blueprint') {
        setBlueprintLibrary(data.categories ? data : adaptPropsToLibrary(data.props || data));
        await luxuryAlert(`Loaded blueprint library`, 'Success', 'success');
      }
    } catch (error) {
      await luxuryAlert(`Error loading library file: ${error.message}`, 'Error', 'error');
    }
  };

  

  // ── Library Selection ─────────────────────────────────────────────────────────

  const selectEmitterFromLibrary = (selectedEmitters) => {
    if (!selectedEmitters?.length) return;

    const currentMapName = (mapName || '').trim();
    const finalMapName   = currentMapName.match(/\.v\d{4}$/) ? currentMapName : currentMapName + '.v0001';

    const newEmitterPaths  = [];
    const newPublicPaths   = {};

    for (const emitter of selectedEmitters) {
      if (emitter.source === 'toolkit' && emitter.publicPath) {
        // Custom file from public/emitter — build the in-game map path right away
        const fileName    = (emitter.publicPath.replace(/\\/g, '/')).split('/').pop();
        const mapGamePath = `/maps/${finalMapName}/env/props/emitter/${fileName}`;
        newEmitterPaths.push(mapGamePath);
        newPublicPaths[mapGamePath] = emitter.publicPath;
      } else {
        newEmitterPaths.push(emitter.gamePath || emitter.id || '');
      }
    }

    setBlueprintPublicPaths(prev => ({ ...prev, ...newPublicPaths }));

    setBlueprintPaths(prev => {
      let next = [...prev];
      for (const p of newEmitterPaths) {
        if (!p) continue;
        const emptyIdx = next.findIndex(e => e === '');
        if (emptyIdx !== -1) next[emptyIdx] = p;
        else next.push(p);
      }
      if (!next.some(e => e === '')) next.push('');
      return next;
    });

    // Resolve vanilla _prop.bp paths → their matching _emit.bp
    newEmitterPaths.forEach((p) => {
      if (p.trim().toLowerCase().endsWith('_prop.bp')) {
        window.electronAPI.invoke('resolve-prop-to-emit', { propGamePath: p.trim() }).then(res => {
          if (res?.success && res.emitPath) {
            setBlueprintPaths(prev => prev.map(ep => ep === p ? res.emitPath : ep));
          }
        });
      }
    });

    setShowEmitterLibrary(false);
  };

  // ── Blueprint Selection ───────────────────────────────────────────────────────

  const toggleBlueprintSelection = (emitter) => {
    setSelectedBlueprints(prev => {
      const isSelected = prev.some(e => e.path === emitter.path);
      if (isSelected) {
        return prev.filter(e => e.path !== emitter.path);
      } else {
        return [...prev, emitter];
      }
    });
  };

  // ── Blueprint Confirm ─────────────────────────────────────────────────────────

  const confirmBlueprintSelection = () => {
    if (selectedBlueprints.length === 0) return;

    const newBlueprintPaths = [...blueprintPaths].filter(p => p.trim() !== '');
    
    selectedBlueprints.forEach(emitter => {
      if (!newBlueprintPaths.includes(emitter.path)) {
        newBlueprintPaths.push(emitter.path);
      }
    });

    if (!newBlueprintPaths.some(p => p === '')) {
      newBlueprintPaths.push('');
    }

    setBlueprintPaths(newBlueprintPaths);
    setShowBlueprintLibrary(false);
    setSelectedBlueprints([]);
    setSelectedCategory(null);
  };

  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    }
  }, [previewImageData]);

  // ── Unit Name Migration ───────────────────────────────────────────────────────

useEffect(() => {
  const needsMigration = units.some(u => u.unitType && !u.unitName);
  if (needsMigration && unitLibrary.categories && unitLibrary.categories.length > 0) {
    const updatedUnits = units.map(unit => {
      if (unit.unitType && !unit.unitName) {
        const foundName = getUnitNameFromLibrary(unit.unitType);
        if (foundName) {
          return { ...unit, unitName: foundName };
        }
      }
      return unit;
    });
    setUnits(updatedUnits);
  }
}, [unitLibrary]);

  // ── Library Mount & Scan Listener ─────────────────────────────────────────────

useEffect(() => {
  loadLibrariesFromIPC();

  const onScanComplete = (_, result) => {
    if (result?.success) {
      loadLibrariesFromIPC();
    }
  };
  window.electronAPI.on('library-scan-complete', onScanComplete);
  return () => window.electronAPI.removeAllListeners('library-scan-complete');
}, []);

  // ── Canvas Draw ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1024;
    const height = 1024;

    ctx.clearRect(0, 0, width, height);

    if (previewImage && previewImage.complete) {
      ctx.drawImage(previewImage, 0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = width / 8;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(width, i * gridSize);
        ctx.stroke();
      }
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

    units.forEach((unit, unitIdx) => {
      unit.coordinates.forEach((coord) => {
        if (!coord.x || !coord.z) return;

        const x = ((parseFloat(coord.x) - mapOffsetX) / parseFloat(mapSize)) * width;
        const z = ((parseFloat(coord.z) - mapOffsetY) / parseFloat(mapSize)) * height;

        ctx.fillStyle = unit.color;
        ctx.shadowColor = unit.color;
        ctx.shadowBlur = unitIdx === selectedUnit ? 20 : 15;
        
        ctx.beginPath();
        ctx.arc(x, z, unitIdx === selectedUnit ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        
        if (unitIdx === selectedUnit) {
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
      });
    });
  }, [units, selectedUnit, previewImage, mapSize, mirrorMode]);

  // ── Emitter Management ───────────────────────────────────────────────────────

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

  // ── Blueprint Path Management ─────────────────────────────────────────────────

  const resolveEmitterPath = (pathIndex, value) => {
    if (!value.trim().toLowerCase().endsWith('_prop.bp')) return;
    window.electronAPI.invoke('resolve-prop-to-emit', { propGamePath: value.trim() }).then(res => {
      if (res?.success && res.emitPath) {
        setBlueprintPaths(prev => prev.map((p, i) => i === pathIndex ? res.emitPath : p));
      }
    });
  };

  const updateBlueprintPath = (pathIndex, value) => {
    const newPaths = [...blueprintPaths];
    newPaths[pathIndex] = value;
    
    const lastPath = newPaths[newPaths.length - 1];
    if (lastPath && lastPath.trim() !== '') {
      newPaths.push('');
    }
    
    setBlueprintPaths(newPaths);
  };

  const deleteBlueprintPath = (pathIndex) => {
    const newPaths = [...blueprintPaths];
    if (newPaths.length === 1) {
      newPaths[0] = '';
    } else {
      newPaths.splice(pathIndex, 1);
    }
    setBlueprintPaths(newPaths);
  };

  
const WR_SECTIONS = [
  {
    id:     'config',
    index:  '01',
    label:  'Configuration',
    desc:   'Set the map name and assign emitter blueprints for this wreckage register.',
    // 'done' lights the tick green when the minimum required fields are set
    done:   !!(mapName && blueprintPaths.some(p => p.trim())),
    locked: false,
  },
  {
    id:     'units',
    index:  '02',
    label:  'Units',
    desc:   'Define unit types and place their coordinates on the map canvas.',
    // Count badge shows how many units have at least one placed coordinate
    count:  units.filter(u => u.coordinates.some(c => c.x && c.z)).length,
    done:   units.some(u => u.coordinates.some(c => c.x && c.z)),
    locked: false,
  },
  {
    id:     'matching',
    index:  '03',
    label:  'Matching',
    desc:   'Choose how emitters are matched to unit categories.',
    done:   !!emitterMatchingMode,
    locked: false,
  },
  {
    id:     'output',
    index:  '04',
    label:  'Output',
    desc:   'Configure export options before generating the Lua files.',
    done:   false,
    locked: false,
  },
];

const isReady = !!(
  mapName.trim() &&
  blueprintPaths.some(p => p.trim()) &&
  units.some(u => u.coordinates.some(c => c.x && c.z))
);

  // ── Unit Management ───────────────────────────────────────────────────────────

const addUnit = () => {
  const newUnit = {
    id: Date.now(),
    unitType: '',
    unitCategories: [], // NEU
    unitName: '',
    coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null }],
    color: `hsl(${Math.random() * 360}, 70%, 60%)`
  };
  setUnits([...units, newUnit]);
  setSelectedUnit(units.length);
};

  const addUnitCategory = (unitIndex) => {
  const newUnits = [...units];
  if (!newUnits[unitIndex].unitCategories) {
    newUnits[unitIndex].unitCategories = [];
  }
  newUnits[unitIndex].unitCategories.push('');
  setUnits(newUnits);
};

const updateUnitCategory = (unitIndex, categoryIndex, value) => {
  const newUnits = [...units];
  if (!newUnits[unitIndex].unitCategories) {
    newUnits[unitIndex].unitCategories = [];
  }
  newUnits[unitIndex].unitCategories[categoryIndex] = value;
  setUnits(newUnits);
};

const deleteUnitCategory = (unitIndex, categoryIndex) => {
  const newUnits = [...units];
  if (newUnits[unitIndex].unitCategories && newUnits[unitIndex].unitCategories.length > 0) {
    newUnits[unitIndex].unitCategories.splice(categoryIndex, 1);
    setUnits(newUnits);
  }
};

const updateUnit = (index, field, value) => {
  const newUnits = [...units];
  newUnits[index][field] = value;
  
  if (field === 'unitType') {
    const foundName = getUnitNameFromLibrary(value);
    newUnits[index].unitName = foundName;
  }
  
  setUnits(newUnits);
};

const deleteAllUnits = async () => {
    const confirmed = await luxuryConfirm('Delete all unit cards?', 'Confirm Delete', 'Delete All', 'Cancel');
    if (!confirmed) return;
    setUnits([{ ...DEFAULT_UNIT, id: Date.now() }]);
    setSelectedUnit(0);
  };

const deleteUnit = (index) => {
  if (units.length === 1) {
    setUnits([{
      id: Date.now(),
      unitType: '',
      unitCategories: [], // NEU
      unitName: '',
      coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null }],
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    }]);
    setSelectedUnit(0);
  } else {
    setUnits(units.filter((_, i) => i !== index));
    if (selectedUnit >= index && selectedUnit > 0) {
      setSelectedUnit(selectedUnit - 1);
    }
  }
};

  const addCoordinate = (unitIndex) => {
    const newUnits = [...units];
    newUnits[unitIndex].coordinates.push({
      x: '', 
      y: '', 
      z: '', 
      heading: 'math.pi', 
      pitch: '0.0', 
      roll: 'math.pi', 
      isMirrored: false,
      mirrorPairId: null
    });
    setUnits(newUnits);
  };

  // ── Category Logic ────────────────────────────────────────────────────────────

const getAllUniqueCategories = () => {
  const categoriesSet = new Set();
  units.forEach(unit => {
    if (unit.unitCategories && unit.unitCategories.length > 0) {
      unit.unitCategories.forEach(cat => {
        if (cat && cat.trim()) {
          categoriesSet.add(cat.trim());
        }
      });
    }
  });
  return Array.from(categoriesSet).sort();
};
const getEmittersForUnit = (unit) => {
  const validEmitters = blueprintPaths.filter(p => p.trim());
  
  if (!unit.unitCategories || unit.unitCategories.length === 0) {
    return validEmitters; // Fallback: all emitters
  }
  
  const activeCategories = unit.unitCategories.filter(c => c.trim());
  
  if (activeCategories.length === 0) {
    return validEmitters; // Fallback: all emitters
  }
  
  if (emitterMatchingMode === 'smart') {
    const perfectMatch = validEmitters.filter(path => {
      return activeCategories.every(category => 
        isEmitterActiveForCategory(path, category.trim())
      );
    });
    
    if (perfectMatch.length > 0) {
      return perfectMatch;
    }
    
    const partialMatch = validEmitters.filter(path => {
      return activeCategories.some(category => 
        isEmitterActiveForCategory(path, category.trim())
      );
    });
    
    if (partialMatch.length > 0) {
      return partialMatch;
    }
    
    return validEmitters;
    
  } else if (emitterMatchingMode === 'simple') {
    const unionMatch = validEmitters.filter(path => {
      return activeCategories.some(category => 
        isEmitterActiveForCategory(path, category.trim())
      );
    });
    
    if (unionMatch.length > 0) {
      return unionMatch;
    }
    
    return validEmitters;
    
  } else if (emitterMatchingMode === 'lastCategory') {
    const lastCategory = activeCategories[activeCategories.length - 1].trim();
    
    const lastCategoryMatch = validEmitters.filter(path => {
      return isEmitterActiveForCategory(path, lastCategory);
    });
    
    if (lastCategoryMatch.length > 0) {
      return lastCategoryMatch;
    }
    
    return validEmitters;
  }
  
  return validEmitters;
};

  // ── Coordinate CRUD ───────────────────────────────────────────────────────────

  const updateCoordinate = (unitIndex, coordIndex, field, value) => {
    const newUnits = [...units];
    const coord = newUnits[unitIndex].coordinates[coordIndex];
    
    newUnits[unitIndex].coordinates[coordIndex][field] = value;
    
    if (!coord.isMirrored && mirrorMode !== 'none') {
      
      if (field === 'x' || field === 'z') {
        const newX = parseFloat(newUnits[unitIndex].coordinates[coordIndex].x);
        const newZ = parseFloat(newUnits[unitIndex].coordinates[coordIndex].z);
        
        if (!isNaN(newX) && !isNaN(newZ)) {
          const newMirrored = getMirroredCoords(newX, newZ, mapSize, mirrorMode);
          
          if (newMirrored) {
            let mirrorIndex = -1;
            
            if (coord.mirrorPairId) {
              mirrorIndex = newUnits[unitIndex].coordinates.findIndex((c, idx) => 
                idx !== coordIndex &&
                c.isMirrored === true &&
                c.mirrorPairId === coord.mirrorPairId
              );
            }
            
            if (mirrorIndex !== -1) {
              newUnits[unitIndex].coordinates[mirrorIndex].x = newMirrored.x.toFixed(2);
              newUnits[unitIndex].coordinates[mirrorIndex].z = newMirrored.z.toFixed(2);
              newUnits[unitIndex].coordinates[mirrorIndex].y = newUnits[unitIndex].coordinates[coordIndex].y;
              
              const mirroredRotation = getMirroredRotation(
                newUnits[unitIndex].coordinates[coordIndex].heading,
                newUnits[unitIndex].coordinates[coordIndex].pitch,
                newUnits[unitIndex].coordinates[coordIndex].roll,
                mirrorMode
              );
              newUnits[unitIndex].coordinates[mirrorIndex].heading = mirroredRotation.heading;
              newUnits[unitIndex].coordinates[mirrorIndex].pitch = mirroredRotation.pitch;
              newUnits[unitIndex].coordinates[mirrorIndex].roll = mirroredRotation.roll;
            } else {
              const pairId = coord.mirrorPairId || `mirror_${Date.now()}_${Math.random()}`;
              
              if (!coord.mirrorPairId) {
                newUnits[unitIndex].coordinates[coordIndex].mirrorPairId = pairId;
              }
              
              const originalCoord = newUnits[unitIndex].coordinates[coordIndex];
              
              const mirroredRotation = getMirroredRotation(
                originalCoord.heading,
                originalCoord.pitch,
                originalCoord.roll,
                mirrorMode
              );
              
              newUnits[unitIndex].coordinates.push({
                x: newMirrored.x.toFixed(2),
                y: originalCoord.y || '26',
                z: newMirrored.z.toFixed(2),
                heading: mirroredRotation.heading,
                pitch: mirroredRotation.pitch,
                roll: mirroredRotation.roll,
                isMirrored: true,
                mirrorPairId: pairId
              });
            }
          }
        }
      }
      

      if (['y', 'heading', 'pitch', 'roll'].includes(field) && coord.mirrorPairId) {
        const mirrorIndex = newUnits[unitIndex].coordinates.findIndex((c, idx) => 
          idx !== coordIndex &&
          c.isMirrored === true &&
          c.mirrorPairId === coord.mirrorPairId
        );
        
        if (mirrorIndex !== -1) {
          if (field === 'y') {
            newUnits[unitIndex].coordinates[mirrorIndex][field] = value;
          } else {
            const mirroredRotation = getMirroredRotation(
              newUnits[unitIndex].coordinates[coordIndex].heading,
              newUnits[unitIndex].coordinates[coordIndex].pitch,
              newUnits[unitIndex].coordinates[coordIndex].roll,
              mirrorMode
            );
            newUnits[unitIndex].coordinates[mirrorIndex].heading = mirroredRotation.heading;
            newUnits[unitIndex].coordinates[mirrorIndex].pitch = mirroredRotation.pitch;
            newUnits[unitIndex].coordinates[mirrorIndex].roll = mirroredRotation.roll;
          }
        }
      }
    }
    
    setUnits(newUnits);
  };

  const deleteCoordinate = (unitIndex, coordIndex) => {
    const newUnits = [...units];
    const coord = newUnits[unitIndex].coordinates[coordIndex];
    
    if (coord.mirrorPairId) {
      const mirrorIndex = newUnits[unitIndex].coordinates.findIndex((c, idx) => 
        idx !== coordIndex &&
        c.mirrorPairId === coord.mirrorPairId
      );
      
      if (mirrorIndex !== -1) {
        const indices = [coordIndex, mirrorIndex].sort((a, b) => b - a);
        indices.forEach(idx => {
          if (newUnits[unitIndex].coordinates.length === 1) {
            newUnits[unitIndex].coordinates[0] = {
              x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null
            };
          } else {
            newUnits[unitIndex].coordinates.splice(idx, 1);
          }
        });
      } else {
        if (newUnits[unitIndex].coordinates.length === 1) {
          newUnits[unitIndex].coordinates[0] = {
            x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null
          };
        } else {
          newUnits[unitIndex].coordinates.splice(coordIndex, 1);
        }
      }
    } else {
      if (newUnits[unitIndex].coordinates.length === 1) {
        newUnits[unitIndex].coordinates[0] = {
          x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null
        };
      } else {
        newUnits[unitIndex].coordinates.splice(coordIndex, 1);
      }
    }
    
    setUnits(newUnits);
  };

  const deleteAllCoordinates = (unitIndex) => {
    const newUnits = [...units];
    newUnits[unitIndex].coordinates = [{
      x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null
    }];
    setUnits(newUnits);
  };

  // ── Mirror Coords ─────────────────────────────────────────────────────────────

  const getMirroredCoords = (x, z, mapSize, mode) => {
    const mapSizeNum = parseFloat(mapSize) || 1024;
    const far = 2 * mapOffsetX + mapSizeNum; 
    switch (mode) {
      case 'diagonal':
        return { x: far - x, z: far - z };
      case 'horizontal':
        return { x, z: far - z };
      case 'vertical':
        return { x: far - x, z };
      default:
        return null;
    }
  };

    // ── Emitter Category Logic ────────────────────────────────────────────────────

const toggleEmitterCategory = (emitterPath, category) => {
  setEmitterCategories(prev => {
    const newConfig = { ...prev };
    
    if (!newConfig[emitterPath]) {
      newConfig[emitterPath] = [];
    }
    
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
  if (!emitterCategories[emitterPath]) {
    return true;
  }
  return !emitterCategories[emitterPath].includes(category);
};

const getEmitterNameFromPath = (path) => {
  const pathParts = path.split('/');
  const filename = pathParts[pathParts.length - 1];
  return filename.replace('_emit.bp', '').replace(/_/g, ' ');
};

  // ── Canvas Click ──────────────────────────────────────────────────────────────

  const handleCanvasClick = (e) => {
    if (selectedUnit < 0 || selectedUnit >= units.length) return;

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
    const newUnits = [...units];
    
    let clickedCoordIndex = -1;
    for (let i = 0; i < newUnits[selectedUnit].coordinates.length; i++) {
      const coord = newUnits[selectedUnit].coordinates[i];
      if (coord.x && coord.z) {
        const coordX = parseFloat(coord.x);
        const coordZ = parseFloat(coord.z);
        const distance = Math.sqrt(
          Math.pow(worldX - coordX, 2) + Math.pow(worldZ - coordZ, 2)
        );
        
        if (distance <= clickTolerance) {
          clickedCoordIndex = i;
          break;
        }
      }
    }

    if (clickedCoordIndex !== -1) {
      deleteCoordinate(selectedUnit, clickedCoordIndex);
      return;
    }

    if (mirrorMode === 'none') {
      const emptyCoordIndex = newUnits[selectedUnit].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newUnits[selectedUnit].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false,
          mirrorPairId: null
        };
      } else {
        newUnits[selectedUnit].coordinates.push({
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false,
          mirrorPairId: null
        });
      }
      
      setUnits(newUnits);
    } else {
      const mirrored = getMirroredCoords(worldX, worldZ, mapSize, mirrorMode);
      const pairId = `mirror_${Date.now()}_${Math.random()}`;
      
      const mirroredRotation = getMirroredRotation('math.pi', '0.0', 'math.pi', mirrorMode);
      
      const emptyCoordIndex = newUnits[selectedUnit].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newUnits[selectedUnit].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false,
          mirrorPairId: pairId
        };
      } else {
        newUnits[selectedUnit].coordinates.push({
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false,
          mirrorPairId: pairId
        });
      }
      
      newUnits[selectedUnit].coordinates.push({
        x: mirrored.x.toFixed(2),
        y: '26',
        z: mirrored.z.toFixed(2),
        heading: mirroredRotation.heading,
        pitch: mirroredRotation.pitch,
        roll: mirroredRotation.roll,
        isMirrored: true,
        mirrorPairId: pairId
      });
      
      setUnits(newUnits);
    }
  };

  // ── Markers ───────────────────────────────────────────────────────────────────

  const markers = units.flatMap((unit, unitIdx) =>
    unit.coordinates
      .filter(coord => coord.x && coord.z)
      .map((coord, coordIdx) => {
        const actualCoordIdx = unit.coordinates.indexOf(coord);
        
        return {
          id: `${unit.id}-${coordIdx}`,
          x: ((parseFloat(coord.x) - mapOffsetX) / parseFloat(mapSize)) * 100,
          z: ((parseFloat(coord.z) - mapOffsetY) / parseFloat(mapSize)) * 100,
          color: unit.color,
          unitType: unit.unitType || `Unit ${unitIdx + 1}`,
          isSelected: unitIdx === selectedUnit,
          isMirrored: coord.isMirrored,
          unitIdx: unitIdx,
          coordIdx: actualCoordIdx
        };
      })
  );

  // ── Image Upload ──────────────────────────────────────────────────────────────

const handleImageUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result;
      if (typeof imageData === 'string') {
        localStorage.setItem('shared_preview_image', imageData);
        setPreviewImageData(imageData);
      }
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  } catch (error) {
    await luxuryAlert(`Error loading image: ${error.message}`, 'Error', 'error');
  }
};

  // ── IPC File Helpers ──────────────────────────────────────────────────────────

  const writeFile   = async (filePath, content) => { const r = await window.electronAPI.invoke('write-file',  { filePath, content }); if (!r?.success) throw new Error(r?.error || 'write-file failed'); };
  const ensureDir   = async (dirPath)           => { const r = await window.electronAPI.invoke('ensure-dir',  { dirPath });           if (!r?.success) throw new Error(r?.error || 'ensure-dir failed'); };
  const copyFile    = async (src, dest)          => { const r = await window.electronAPI.invoke('copy-file',   { src, dest });         if (!r?.success) throw new Error(r?.error || 'copy-file failed'); };
  const listDir     = async (dirPath)            => { const r = await window.electronAPI.invoke('list-dir',    { dirPath });           if (!r?.success) throw new Error(r?.error || 'list-dir failed'); return r.entries; };

  // ── Folder Pickers ────────────────────────────────────────────────────────────

  const selectEmitterBpFolder = async () => {
    const res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Select Emitter.bp Folder' });
    if (!res.success) return;
    const folderPath = res.path;
    const folderName = folderPath.split('\\').pop() || folderPath.split('/').pop();
    if (!folderName.toLowerCase().includes('emitter')) {
      const ok = await luxuryConfirm(`Warning: Folder is named "${folderName}", not "emitter.bp".\n\nContinue anyway?`, 'Warning', 'Continue Anyway', 'Cancel');
      if (!ok) return;
    }
    setEmitterBpFolderPath(folderPath);
    await luxuryAlert(`✓ Emitter.bp folder selected: ${folderName}`, 'Success', 'success');
  };

  const selectMapsFolder = async () => {
    const res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Select Maps Folder' });
    if (!res.success) return;
    const folderPath = res.path;
    const folderName = folderPath.split('\\').pop() || folderPath.split('/').pop();
    if (folderName.toLowerCase() !== 'maps') {
      const ok = await luxuryConfirm(`Warning: Folder is named "${folderName}", not "maps".\n\nContinue anyway?`, 'Warning', 'Continue Anyway', 'Cancel');
      if (!ok) return;
    }
    setMapsFolderPath(folderPath);
    await luxuryAlert(`✓ Maps folder selected: ${folderName}`, 'Success', 'success');
  };

  // ── Generate ──────────────────────────────────────────────────────────────────

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
      
      const validEmitterPaths = blueprintPaths.filter(e => e.trim());
      
      let totalUnitFiles = 0;
      units.forEach((unit) => {
        if (!unit.unitType) return;
        const validCoords = unit.coordinates.filter(c => c.x && c.z);
        totalUnitFiles += validCoords.length * 2;
      });
      
      const mapFolderPath = `${mapsFolder}\\${finalMapName}`;
      const wreckagesDirPath = `${mapFolderPath}\\env\\props\\emitter\\wreckages`;
      try {
        await ensureDir(wreckagesDirPath);
      } catch (err) {
        await luxuryAlert(`Error creating map directory "${finalMapName}":\n${err.message}`, 'Error', 'error');
        return;
      }

      let filesCreated = 0;
      let emittersCopied = 0;
      let emittersFailed = [];
      const propsLuaEntries = []; // { path, x, z } für SCMAP props.lua

      // ── Copy toolkit emitters (public/emitter/*) → map/env/props/emitter/ ────
      // blueprintPublicPaths may be empty after app restart (not persisted).
      // Rebuild missing entries on-the-fly from the current emitterLibrary scan.
      const resolvedPublicPaths = { ...blueprintPublicPaths };
      for (const gamePath of validEmitterPaths) {
        if (resolvedPublicPaths[gamePath]) continue; // already known
        const filename = gamePath.replace(/\\/g, '/').split('/').pop();
        const match = emitterLibrary.find(
          e => e.source === 'toolkit' && e.publicPath &&
               e.publicPath.replace(/\\/g, '/').split('/').pop() === filename
        );
        if (match) resolvedPublicPaths[gamePath] = match.publicPath;
      }

      const toolkitEntries = Object.entries(resolvedPublicPaths).filter(
        ([gamePath]) => validEmitterPaths.includes(gamePath)
      );

      if (toolkitEntries.length > 0) {
        const emitterDestDir = `${mapFolderPath}\\env\\props\\emitter`;
        await ensureDir(emitterDestDir);

        for (const [gamePath, src] of toolkitEntries) {
          const filename = gamePath.replace(/\\/g, '/').split('/').pop();
          try {
            await copyFile(src, `${emitterDestDir}\\${filename}`);
            emittersCopied++;
          } catch (err) {
            emittersFailed.push(filename);
          }
        }
      }
      
      for (const unit of units) {
        if (!unit.unitType) continue;
        const validCoords = unit.coordinates.filter(c => c.x && c.z);
        if (validCoords.length === 0) continue;
        const unitId = unit.unitType.toLowerCase();

        let unitDirPath = wreckagesDirPath;
        if (unit.unitCategories && unit.unitCategories.length > 0) {
          const categories = unit.unitCategories.filter(cat => cat.trim() !== '');
          for (const category of categories) {
            unitDirPath = `${unitDirPath}\\${category.trim()}`;
          }
        }
        unitDirPath = `${unitDirPath}\\${unitId}`;
        await ensureDir(unitDirPath);
        
        for (let coordIdx = 0; coordIdx < validCoords.length; coordIdx++) {
          const coord = validCoords[coordIdx];
          const coordNumber = String(coordIdx + 1).padStart(2, '0');
          const instanceName = `${unitId}_${coordNumber}`;
          
          const instanceDirPath = `${unitDirPath}\\${instanceName}`;
          await ensureDir(instanceDirPath);
          
          const x = parseFloat(coord.x) || 0;
          const y = parseFloat(coord.y) || 26;
          const z = parseFloat(coord.z) || 0;
          const heading = coord.heading || 'math.pi';
          const pitch = coord.pitch || '0.0';
          const roll = coord.roll || 'math.pi';
          
let emitterPath = '/effects/emitters/destruction_explosion_concussion_ring_03_emit.bp';
if (validEmitterPaths.length > 0) {
  let availableEmitters = validEmitterPaths;
  
  if (unit.unitCategories && unit.unitCategories.length > 0) {
    const activeCategories = unit.unitCategories.filter(c => c.trim());
    
    if (activeCategories.length > 0) {
      
      if (emitterMatchingMode === 'smart') {
        
        const perfectMatch = validEmitterPaths.filter(path => {
          return activeCategories.every(category => 
            isEmitterActiveForCategory(path, category.trim())
          );
        });
        
        if (perfectMatch.length > 0) {
          availableEmitters = perfectMatch;
        } else {
          const partialMatch = validEmitterPaths.filter(path => {
            return activeCategories.some(category => 
              isEmitterActiveForCategory(path, category.trim())
            );
          });
          
          if (partialMatch.length > 0) {
            availableEmitters = partialMatch;
          } else {
            availableEmitters = validEmitterPaths;
          }
        }
        
      } else if (emitterMatchingMode === 'simple') {
        
        const unionMatch = validEmitterPaths.filter(path => {
          return activeCategories.some(category => 
            isEmitterActiveForCategory(path, category.trim())
          );
        });
        
        if (unionMatch.length > 0) {
          availableEmitters = unionMatch;
        } else {
          availableEmitters = validEmitterPaths;
        }
      
        } else if (emitterMatchingMode === 'lastCategory') {
  
  const lastCategory = activeCategories[activeCategories.length - 1].trim();
  
  const lastCategoryMatch = validEmitterPaths.filter(path => {
    return isEmitterActiveForCategory(path, lastCategory);
  });
  
  if (lastCategoryMatch.length > 0) {
    availableEmitters = lastCategoryMatch;
  } else {
    availableEmitters = validEmitterPaths;
  }
}
    }
  }
  
  const randomIndex = Math.floor(Math.random() * availableEmitters.length);
  emitterPath = availableEmitters[randomIndex];
}

          if (emitterPath && !emitterPath.startsWith('/maps/') &&
              !emitterPath.startsWith('/effects/') &&
              !emitterPath.startsWith('/env/') &&
              !emitterPath.startsWith('/textures/') &&
              !emitterPath.startsWith('/units/') &&
              !emitterPath.startsWith('/projectiles/')) {
            const relativePath = emitterPath.startsWith('/') ? emitterPath.substring(1) : emitterPath;
            emitterPath = `/maps/${finalMapName}/env/props/emitter/${relativePath}`;
          }
          
          const propContent = `PropBlueprint {
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
          
          const scriptContent = `local Prop = import('/lua/sim/Prop.lua').Prop

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

        local unit = CreateUnitHPR('${unitId}', 'ARMY_17', ${x.toFixed(1)}, ${y}, ${z.toFixed(1)}, ${heading}, ${pitch}, ${roll})

        if unit and unit.DoNotCreateWreckage then
            unit:DoNotCreateWreckage(true)
        else
            LOG('${instanceName}: Warning - unit does not support DoNotCreateWreckage')
        end

        local wreck = unit:CreateWreckageProp(0)
        unit:Destroy()

        if wreck and wreck.Trash then
            wreck.Trash:Add(CreateEmitterAtBone(wreck, 0, -1, '${emitterPath}'))
        else
            LOG('${instanceName}: Warning - wreck or wreck.Trash is nil')
        end

        self:Destroy()
    end,
}

TypeClass = ${instanceName}`;
          
          await writeFile(`${instanceDirPath}\\${instanceName}_prop.bp`, propContent);
          filesCreated++;
          await writeFile(`${instanceDirPath}\\${instanceName}_script.lua`, scriptContent);
          filesCreated++;

          const relInstancePath = instanceDirPath
            .replace(mapFolderPath, '')
            .replace(/\\/g, '/')
            .replace(/^\//, '');
          const markerBpGamePath = `/maps/${finalMapName}/${relInstancePath}/${instanceName}_prop.bp`;
          propsLuaEntries.push({ path: markerBpGamePath, x, z });
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
      // scmapEntry wird in der Success-Message verwendet

      if (generateReadme) {
        const kmPerUnit = 20 / 1024;
        const km        = (parseFloat(mapSize) || 1024) * kmPerUnit;
        const kmStr     = Number.isInteger(km) ? `${km}×${km}` : `${km.toFixed(1)}×${km.toFixed(1)}`;

        const outputSummaryLines = [];
        outputSummaryLines.push(`  Total placements : ${propsLuaEntries.length}`);
        if (exportRawLua && propsLuaFileName)
          outputSummaryLines.push(`  Raw props.lua    : ${propsLuaFileName}  ← next to .scmap in map folder`);
        outputSummaryLines.push(`  Output dir       : env\\props\\emitter\\wreckages\\`);
        if (emittersCopied > 0) outputSummaryLines.push(`  Emitters copied  : ${emittersCopied}`);
        if (emittersFailed.length > 0) outputSummaryLines.push(`  Emitters failed  : ${emittersFailed.join(', ')}`);

        const validEmitterPaths2 = blueprintPaths.filter(e => e.trim());
        const emitterLines = validEmitterPaths2.length === 0
          ? ['  (none configured)']
          : validEmitterPaths2.map(e => `  • ${e}`);
        emitterLines.push(`  Matching Mode : ${emitterMatchingMode}`);

        const unitCardLines = [];
        units.forEach((unit, idx) => {
          if (!unit.unitType) return;
          const validCoords = unit.coordinates.filter(c => c.x && c.z);
          const unitName    = unit.unitType || `Unit ${idx + 1}`;
          const unitLabel   = unitName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          const cats        = (unit.unitCategories || []).filter(c => c.trim());
          const bpPaths     = (blueprintPaths || []).filter(p => p.trim());
          unitCardLines.push('');
          unitCardLines.push(`  [${String(idx + 1).padStart(2, '0')}] ${unitName}`);
          unitCardLines.push(`       Folder      : env/props/emitter/wreckages/${unitLabel}/`);
          unitCardLines.push(`       Coordinates : ${validCoords.length}`);
          if (bpPaths.length > 0) {
            unitCardLines.push(`       Blueprint paths (${bpPaths.length}):`);
            bpPaths.forEach(p => unitCardLines.push(`         • ${p}`));
          }
          if (cats.length > 0) unitCardLines.push(`       Categories  (${cats.length}): ${cats.join(', ')}`);
          const rand = unit.randomness?.maxDeviation > 0 ? unit.randomness : null;
          if (rand) unitCardLines.push(`       Randomness  : ±${rand.maxDeviation} (X), ±${rand.maxDeviation} (Z)`);
        });

        const howToUseLines = exportRawLua ? [
          `  1. ${propsLuaFileName} has been written to the map root folder.`,
          '     Copy it into the unpacked .scmap folder and repack with BrewMapTool',
          '     or use the SCMAP tab in ForgeMapToolkit to inject it.',
          '  2. Re-generating is always safe — each run writes a new numbered',
          '     props.lua without overwriting existing ones.',
          '  3. Wreckage prop/script files are in the output folder.',
        ] : [
          '  1. The .scmap has been repacked with the new props.lua chunk.',
          '     No manual work required. To undo or modify this, check the History tab.',
          '  2. Re-generating is always safe — each run adds a new numbered',
          '     props.lua chunk without touching existing ones.',
          '  3. Wreckage prop/script files are in the output folder.',
        ];

        const readmeContent = buildReadme({
          tool:    'Wreckage Tab',
          mapName: finalMapName,
          mapSize: `${mapSize} × ${mapSize} (${kmStr} km)`,
          sections: [
            { title: 'MAP SETTINGS (extra)',  entries: [['Mirror Mode', mirrorMode]] },
            { title: 'OUTPUT SUMMARY',        lines: outputSummaryLines },
            { title: 'EMITTER PATHS',         lines: emitterLines },
            { title: 'UNIT CARDS',            lines: unitCardLines },
            { title: 'HOW TO USE',            lines: howToUseLines },
          ],
          footer: [
            'Generated by ForgeMapToolkit · Seraphim-Noob',
            'SCMAP-Tool — original foundation by The-Balthazar (https://github.com/The-Balthazar)',
            'Translation & implementation by Seraphim-Noob',
          ],
        });
        await writeReadme(`${mapFolderPath}\\Wreckage_Generation_README.txt`, readmeContent);
      }

      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      let successMessage = `✓ ${propsLuaEntries.length} wreckage placements generated!\n\n`;
      successMessage += `Prop/script files:\n${wreckagesDirPath}\\\n`;
      if (exportRawLua && propsLuaFileName) successMessage += `\n✓ props.lua saved: ${mapFolderPath}\\${propsLuaFileName}`;
      if (emittersCopied > 0) successMessage += `\n✓ Copied ${emittersCopied} emitter file(s)`;
      if (emittersFailed.length > 0) {
        successMessage += `\n⚠ Failed to copy ${emittersFailed.length} emitter file(s):\n`;
        emittersFailed.forEach(f => { successMessage += `  - ${f}\n`; });
      }
      if (generateReadme) successMessage += '\n✓ README written to map folder';
      await luxuryAlert(successMessage, 'Generation Complete', 'success');

    } catch (error) {
      await luxuryAlert(`Error generating files: ${error.message}`, 'Error', 'error');
    }
  };

  // ── Import from Map ────────────────────────────────────────────────────────
  const handleImportFromMap = async () => {
    const defaultFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();

    const res = await window.electronAPI.invoke('settings-pick-folder', {
      title: 'Select Map Folder to Import From',
      defaultPath: defaultFolder || undefined,
    });
    if (!res?.success) return;

    const mapFolderPath = res.path;
    const folderName    = mapFolderPath.replace(/\\/g, '/').split('/').pop();
    const finalMapName  = folderName;

    const confirmed = await luxuryConfirm(
      `Import wreckages from "${folderName}"?\n\n_script.lua and _save.lua will be read. Found entries will be added as new unit cards. Existing cards are kept, duplicates are skipped.`,
      'Import from Map',
      'info'
    );
    if (!confirmed) return;

    try {
      // { unitType → Set<"x,y,z"> }
      const coordsByUnit = {};

      // ── 1. _script.lua lesen — CreateWreck(CreateUnitHPR(...)) ────────────
      const scriptName = finalMapName.replace(/\.v\d{4}$/, '') + '_script.lua';
      const scriptPath = `${mapFolderPath}\\${scriptName}`;
      const scriptRes  = await window.electronAPI.invoke('read-file', { path: scriptPath });
      if (scriptRes?.success && scriptRes.content) {
        // CreateWreck(CreateUnitHPR('unitid','ARMY_17', x, y, z, h, p, r), decay)
        const re = /CreateWreck\s*\(\s*CreateUnitHPR\s*\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.+-]+)\s*,\s*([\d.pimath.+-]+)\s*,\s*([\d.pimath.+-]+)\s*,\s*([\d.pimath.+-]+)/g;
        let m;
        while ((m = re.exec(scriptRes.content)) !== null) {
          const [, type, x, y, z, heading, pitch, roll] = m;
          const t = type.toLowerCase();
          if (!coordsByUnit[t]) coordsByUnit[t] = new Map();
          const key = `${x},${y},${z}`;
          if (!coordsByUnit[t].has(key)) coordsByUnit[t].set(key, { x, y, z, heading, pitch, roll });
        }
      }

      // ── 2. _save.lua lesen — UNIT_XXXX Blöcke ────────────────────────────
      const saveName = finalMapName.replace(/\.v\d{4}$/, '') + '_save.lua';
      const savePath = `${mapFolderPath}\\${saveName}`;
      const saveRes  = await window.electronAPI.invoke('read-file', { path: savePath });
      if (saveRes?.success && saveRes.content) {
        // type = 'unitid', Position = { x, y, z }, Orientation = { h, p, r }
        const reBlock = /type\s*=\s*'([^']+)'[\s\S]*?Position\s*=\s*\{([^}]+)\}[\s\S]*?Orientation\s*=\s*\{([^}]+)\}/g;
        let m;
        while ((m = reBlock.exec(saveRes.content)) !== null) {
          const [, type, posStr, oriStr] = m;
          const [x, y, z] = posStr.split(',').map(s => s.trim());
          const [h, p, r]  = oriStr.split(',').map(s => s.trim());
          const t = type.toLowerCase();
          if (!coordsByUnit[t]) coordsByUnit[t] = new Map();
          const key = `${x},${y},${z}`;
          if (!coordsByUnit[t].has(key)) {
            coordsByUnit[t].set(key, {
              x, y, z,
              heading: h || '0.0',
              pitch:   p || '0.0',
              roll:    r || '0.0',
            });
          }
        }
      }

      const unitTypes = Object.keys(coordsByUnit);
      if (unitTypes.length === 0) {
        await luxuryAlert('No wreckage entries found in _script.lua or _save.lua.', 'Nothing Found', 'warning');
        return;
      }

      // ── 3. In Units-State eintragen ───────────────────────────────────────
      setUnits(prev => {
        let next = [...prev];
        for (const unitType of unitTypes) {
          const incomingCoords = Array.from(coordsByUnit[unitType].values()).map(c => ({
            x: c.x, y: c.y, z: c.z,
            heading: c.heading || 'math.pi',
            pitch:   c.pitch   || '0.0',
            roll:    c.roll    || 'math.pi',
            isMirrored: false,
            mirrorPairId: null,
          }));

          const existingIdx = next.findIndex(u => u.unitType.toLowerCase() === unitType);
          if (existingIdx !== -1) {
            // Karte existiert bereits — nur neue Koordinaten anfügen
            const existingKeys = new Set(
              next[existingIdx].coordinates.map(c => `${c.x},${c.y},${c.z}`)
            );
            const newCoords = incomingCoords.filter(c => !existingKeys.has(`${c.x},${c.y},${c.z}`));
            if (newCoords.length > 0) {
              next = next.map((u, i) => i === existingIdx
                ? { ...u, coordinates: [...u.coordinates.filter(c => c.x || c.z), ...newCoords, { x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null }] }
                : u
              );
            }
          } else {
            // Neue Karte anlegen
            next = [...next, {
              id: Date.now() + Math.random(),
              unitType: unitType.toUpperCase(),
              unitName: '',
              unitCategories: [],
              coordinates: [...incomingCoords, { x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false, mirrorPairId: null }],
              color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            }];
          }
        }
        // Leere Placeholder-Karte am Ende entfernen falls vorhanden
        return next.filter(u => u.unitType || u.coordinates.some(c => c.x || c.z));
      });

      const totalCoords = Object.values(coordsByUnit).reduce((sum, m) => sum + m.size, 0);
      await luxuryAlert(
        `✓ Import complete!\n\n${unitTypes.length} unit type(s), ${totalCoords} coordinate(s) imported.`,
        'Import Successful', 'success'
      );
    } catch (err) {
      await luxuryAlert(`Import failed: ${err.message}`, 'Error', 'error');
    }
  };

  // ── Live register readouts ───────────────────────────────────────────────
  const wrTotalPoints  = units.reduce((s, u) => s + u.coordinates.filter(c => c.x && c.z).length, 0);
  const wrEmitterCount = blueprintPaths.filter(p => p.trim()).length;

  // Live coordinate readout — written straight to the DOM (no re-render per
  // mousemove; the readout is an instrument needle, not React state)
  const handleCanvasMove = (e) => {
    const canvas = canvasRef.current;
    const out = coordReadoutRef.current;
    if (!canvas || !out) return;
    const rect = canvas.getBoundingClientRect();
    const scale = (parseFloat(mapSize) || 1024) / 1024;
    const wx = ((e.clientX - rect.left) / rect.width) * 1024 * scale + mapOffsetX;
    const wz = ((e.clientY - rect.top) / rect.height) * 1024 * scale + mapOffsetY;
    out.textContent = `X ${wx.toFixed(1)} · Z ${wz.toFixed(1)}`;
  };
  const handleCanvasLeave = () => {
    if (coordReadoutRef.current) coordReadoutRef.current.textContent = '— · —';
  };

  // ── Section content map — each section's JSX ────────────────────────────────

  const sectionContent = {

    config: (
      <>
        <div style={{ marginBottom: '20px' }}>
          <label className="field-label">Map Name</label>
          <input
            type="text"
            className="field-input"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder="e.g. Hades_Dust.v0002"
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

        <div ref={emittersRef}>
          <label className="field-label">Emitters</label>
          {blueprintPaths.map((path, idx) => {
            let displayPath = path;
            if (mapName && path &&
                !path.startsWith('/maps/') &&
                !path.startsWith('/effects/') &&
                !path.startsWith('/env/') &&
                !path.startsWith('/textures/') &&
                !path.startsWith('/units/') &&
                !path.startsWith('/projectiles/')) {
              let finalMapName = mapName.trim();
              if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                finalMapName += '.v0001';
              }
              const relativePath = path.startsWith('/') ? path.substring(1) : path;
              displayPath = `/maps/${finalMapName}/${relativePath}`;
            }
            return (
              <div key={idx} className="ec-input-row">
                <input
                  type="text"
                  className="field-input"
                  value={displayPath}
                  onChange={(e) => {
                    let newPath = e.target.value;
                    if (mapName && newPath.startsWith('/maps/')) {
                      let finalMapName = mapName.trim();
                      if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                        finalMapName += '.v0001';
                      }
                      const prefix = `/maps/${finalMapName}/`;
                      if (newPath.startsWith(prefix)) {
                        newPath = '/' + newPath.substring(prefix.length);
                      }
                    }
                    updateBlueprintPath(idx, newPath);
                  }}
                  onBlur={(e) => {
                    let val = e.target.value;
                    if (mapName && val.startsWith('/maps/')) {
                      let finalMapName = mapName.trim();
                      if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) finalMapName += '.v0001';
                      const prefix = `/maps/${finalMapName}/`;
                      if (val.startsWith(prefix)) val = '/' + val.substring(prefix.length);
                    }
                    resolveEmitterPath(idx, val);
                  }}
                  placeholder="/effects/emitters/weather_sand_01_emit.bp"
                />
                <button className="delete-button" onClick={() => deleteBlueprintPath(idx)}>×</button>
              </div>
            );
          })}

          <button
            onClick={() => { const newPaths = [...blueprintPaths]; newPaths.push(''); setBlueprintPaths(newPaths); }}
            className="action-button action-button--full"
            style={{ marginBottom: '8px' }}
          >
            Add Emitter
          </button>

          <button
            onClick={() => setShowEmitterLibrary(true)}
            className="action-button action-button--full"
          >
            Library
          </button>
        </div>
      </>
    ),

    units: (
      <>
        <div className="trace-section-head" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="action-button"
              onClick={handleImportFromMap}
              title="Import wreckages from the current map's _script.lua and _save.lua"
            >
              Import from Map
            </button>
            {units.length >= 1 && (
              <button className="action-button action-button--danger" onClick={deleteAllUnits}>Delete All</button>
            )}
          </div>
        </div>

        <EntityCardGrid>
          {units.map((unit, unitIdx) => (
            <EntityCard
              key={unit.id}
              index={unitIdx}
              color={unit.color}
              selected={unitIdx === selectedUnit}
              onSelect={() => setSelectedUnit(unitIdx)}
              onDelete={() => deleteUnit(unitIdx)}
              title={unit.unitName ? `${unit.unitName} (${unit.unitType})` : unit.unitType || `Unit ${unitIdx + 1}`}
              availableColors={availableColors}
              showColorPicker={showColorPicker === unitIdx}
              onToggleColorPicker={() => setShowColorPicker(showColorPicker === unitIdx ? null : unitIdx)}
              onPickColor={(color) => { updateUnit(unitIdx, 'color', color); setShowColorPicker(null); }}
            >
              <div style={{ marginBottom: '8px' }}>
                <div className="ec-input-row">
                  <input
                    type="text"
                    className="field-input"
                    value={unit.unitType}
                    onChange={(e) => updateUnit(unitIdx, 'unitType', e.target.value)}
                    placeholder="UEL0203"
                    onClick={(e) => e.stopPropagation()}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button
                    className="action-button"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUnit(unitIdx);
                      setShowUnitLibrary(true);
                      loadUnitLibrary();
                    }}
                  >
                    Library
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <label className="field-label" style={{ marginBottom: '10px' }}>Unit Categories (optional)</label>
                {unit.unitCategories && unit.unitCategories.map((category, catIdx) => (
                  <div key={catIdx} className="ec-input-row">
                    <input
                      type="text"
                      className="field-input"
                      value={category}
                      onChange={(e) => updateUnitCategory(unitIdx, catIdx, e.target.value)}
                      placeholder={`Category ${catIdx + 1} (e.g., Land, T2)`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="delete-button"
                      onClick={(e) => { e.stopPropagation(); deleteUnitCategory(unitIdx, catIdx); }}
                    >×</button>
                  </div>
                ))}
                <button
                  className="action-button action-button--full"
                  onClick={(e) => { e.stopPropagation(); addUnitCategory(unitIdx); }}
                >Add Category</button>
              </div>

              {unit.unitCategories && unit.unitCategories.length > 0 && (
                <div className="ec-cat-path">
                  wreckages/{unit.unitCategories.filter(c => c.trim()).join('/')}/{unit.unitType || 'unit_id'}
                </div>
              )}

              {unitIdx === selectedUnit && (
                <CoordinateList
                  coordinates={unit.coordinates}
                  fields={[
                    [
                      { key: 'x', label: 'X', placeholder: '256' },
                      { key: 'y', label: 'Y', placeholder: '26' },
                      { key: 'z', label: 'Z', placeholder: '256' },
                    ],
                    [
                      { key: 'heading', label: 'Heading', placeholder: 'math.pi' },
                      { key: 'pitch', label: 'Pitch', placeholder: '0.0' },
                      { key: 'roll', label: 'Roll', placeholder: 'math.pi' },
                    ],
                  ]}
                  open={!!coordsOpen[unitIdx]}
                  onToggle={() => setCoordsOpen(prev => ({ ...prev, [unitIdx]: !prev[unitIdx] }))}
                  labelFor={(coord, ci) => `Point ${ci + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                  onUpdate={(ci, key, value) => updateCoordinate(unitIdx, ci, key, value)}
                  onDelete={(ci) => deleteCoordinate(unitIdx, ci)}
                  onAdd={() => addCoordinate(unitIdx)}
                  hasPlaced={unit.coordinates.some(c => c.x && c.z)}
                  onDeleteAll={async () => {
                    const confirmed = await luxuryConfirm('Delete all coordinates for this unit?', 'Confirm Delete', 'Delete All', 'Cancel');
                    if (confirmed) deleteAllCoordinates(unitIdx);
                  }}
                />
              )}
            </EntityCard>
          ))}

          <AddTile label="Add Unit Type" onClick={addUnit} />
        </EntityCardGrid>
      </>
    ),

    matching: (
      <MatchingMode
        value={emitterMatchingMode}
        onChange={setEmitterMatchingMode}
        onConfigure={() => setShowEmitterCategoryConfig(true)}
        modes={[
          { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',  note: 'Unit ["Land","T3"] gets emitters active for BOTH first' },
          { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',  note: 'Unit ["Land","T3"] gets all emitters active for Land OR T3' },
          { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',  note: 'Unit ["Land","T2","Heavy"] → matches "Heavy" only' },
        ]}
      />
    ),

    output: (
      <OutputChecklist
        ready={isReady}
        onCommit={generateFiles}
        commitLabel="Generate Wreckage"
        commitAriaLabel="Generate wreckage files"
        items={[
          { label: 'Generate README file', checked: generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
          { label: 'Export props.lua (no SCMAP)', checked: exportRawLua, onToggle: () => setExportRawLua(!exportRawLua) },
        ]}
      />
    ),
  };

  // ── Preview slot — map canvas, markers, legend, hint ─────────────────────────

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      onUploadClick={() => fileInputRef.current?.click()}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      canvasRef={canvasRef}
      onCanvasClick={handleCanvasClick}
      containerRef={canvasContainerRef}
      onCanvasMove={handleCanvasMove}
      onCanvasLeave={handleCanvasLeave}
      readoutRef={coordReadoutRef}
      markers={markers}
      onMarkerDelete={(marker) => deleteCoordinate(marker.unitIdx, marker.coordIdx)}
      markerTitle={(marker) => `${marker.unitType} - Click to delete`}
      showPlaceholder={!previewImage && units.every(u => u.coordinates.every(c => !c.x))}
      placeholder="Click on canvas to place units"
      legendTitle="Unit Legend"
      legendRows={units.map((unit, idx) => ({
        id: unit.id,
        color: unit.color,
        label: unit.unitName ? `${unit.unitName} (${unit.unitType.toUpperCase()})` : unit.unitType.toUpperCase() || `Unit ${idx + 1}`,
        pts: unit.coordinates.filter(c => c.x && c.z).length,
      }))}
      hint={`Click canvas to place · ${mirrorMode !== 'none' ? `${mirrorMode} mirror active` : 'no mirror'}`}
    />
  );

  // ── Mirror slot — select in preview header ────────────────────────────────────

  const mirrorSlot = (
    <div className="preview-panel-head-controls">
      <select
        ref={mirrorModeRef}
        className="field-select"
        style={{ width: 'auto' }}
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
          className="action-button action-button--danger"
          style={{ padding: '4px 10px', fontSize: '0.62rem' }}
          onClick={() => {
            localStorage.removeItem('shared_preview_image');
            setPreviewImageData(null);
            setPreviewImage(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        >
          Remove Preview
        </button>
      )}
    </div>
  );

  return (
    <div className="wr-tab trace-tab">
      {!showUnitLibrary && !showEmitterLibrary && !showBlueprintLibrary && (
        <WreckageHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />
      )}

{showUnitLibrary && (
  <UnitLibraryOverlay
    unitLibrary={unitLibrary}
    libraryLoading={libraryLoading}
    onSelect={(unit) => {
      const newUnits = [...units];
      if (selectedUnit >= 0 && selectedUnit < newUnits.length) {
        newUnits[selectedUnit].unitType = unit.id;
        newUnits[selectedUnit].unitName = unit.name;
        setUnits(newUnits);
      }
      setShowUnitLibrary(false);
      setSelectedCategory(null);
      setSearchQuery('');
      setSearchResults([]);
    }}
    onClose={() => {
      setShowUnitLibrary(false);
      setSelectedCategory(null);
      setSearchQuery('');
      setSearchResults([]);
    }}
    onReload={async () => {
      setLibraryLoading(true);
      try {
        await window.electronAPI.invoke('library-scan');
        await loadLibrariesFromIPC();
      } catch (e) {
      } finally {
        setLibraryLoading(false);
      }
    }}
  />
)}

{showEmitterLibrary && (
  <EmitterLibraryOverlay
    mapName={mapName}
    mapsFolder={mapsFolderPath}
    onConfirm={selectEmitterFromLibrary}
    onClose={() => setShowEmitterLibrary(false)}
    accentColor="var(--wreckages-color)"
    accentGlow="var(--wreckages-glow)"
  />
)}

{showEmitterCategoryConfig && (
  <EmitterAssignmentOverlay
    entities={units}
    getEntityTitle={(unit, idx) => unit.unitType?.toUpperCase() || `Unit ${idx + 1}`}
    getEntityColor={(unit) => unit.color}
    getEntityCategories={(unit) => unit.unitCategories}
    getEmittersForEntity={getEmittersForUnit}
    categories={getAllUniqueCategories()}
    emitters={blueprintPaths.filter(p => p.trim())}
    isActive={isEmitterActiveForCategory}
    onToggle={toggleEmitterCategory}
    getName={getEmitterNameFromPath}
    entityNoun="unit"
    sidebarHint="Emitters active per unit"
    onClose={() => setShowEmitterCategoryConfig(false)}
    colorVars={{
      '--tab-color': 'var(--wreckages-color)',
      '--tab-glow': 'var(--wreckages-glow)',
      '--tab-glow-strong': 'var(--wreckages-glow-strong)',
    }}
  />
)}

      {showBlueprintLibrary && (
        <>
          <div className="wr-lib-overlay" onClick={() => setShowBlueprintLibrary(false)} />
          <div className="wr-lib-sidebar">
            <div className="wr-lib-header">
              <span className="wr-lib-title">Emitter Library</span>
              <button className="help-modal-close" onClick={() => setShowBlueprintLibrary(false)}>×</button>
            </div>

            <div className="wr-lib-body">
              <div style={{ marginBottom: '16px' }}>
                <label className="action-button action-button--full" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>
                  Load Library JSON
                  <input type="file" accept=".json" onChange={(e) => handleLibraryUpload(e, 'blueprint')} style={{ display: 'none' }} />
                </label>
              </div>

              {selectedBlueprints.length > 0 && (
                <div className="wr-selection-bar">
                  <span>{selectedBlueprints.length} emitter(s) selected</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-button" onClick={() => setSelectedBlueprints([])}>Clear All</button>
                    <button className="button-solid button-solid--accent" onClick={confirmBlueprintSelection}>Add to Config</button>
                  </div>
                </div>
              )}

              <div>
                {blueprintLibrary && blueprintLibrary.length > 0 ? (
                  blueprintLibrary.map((emitter, idx) => {
                    const isSelected = selectedBlueprints.some(e => e.path === emitter.path);
                    return (
                      <div
                        key={idx}
                        className={`wr-emitter-row${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleBlueprintSelection(emitter)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="wr-emitter-name">{emitter.name}</div>
                          <div className="wr-emitter-path">{emitter.path}</div>
                        </div>
                        {isSelected && <span className="wr-check">✓</span>}
                      </div>
                    );
                  })
                ) : (
                  <div className="wr-empty-state">
                    <p>No emitter library loaded.</p>
                    <p>Upload a library JSON file to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}


      {/* ── Console shell — generic gold-standard layout ──────────────── */}
      <WorkspaceConsole
        sections={WR_SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        previewSlot={previewSlot}
        mirrorSlot={mirrorSlot}
        ghostLabel="WRECKAGES"
        renderEyebrow={(s) => `EMITTER REGISTER — ${s.index} — WRECKAGE CONSOLE`}
        railStorageKey="wrc-rail-pinned"
        navLabel="Wreckage console navigation"
      >
        {sectionContent[activeSection]}
      </WorkspaceConsole>

      <WreckageHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default WreckageTab;