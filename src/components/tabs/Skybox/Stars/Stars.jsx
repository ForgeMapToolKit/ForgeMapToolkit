import React, { useState, useEffect, useCallback } from 'react';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './Stars.css';
import { luxuryAlert }                            from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import StarsHelpModal                             from '../../HelpModals/Stars_help.jsx';
import TabLayout                                  from '../../../Shared/Ui/TabLayout/TabLayout';
import { usePersistentState, useMapInfo, kmLabel } from '../../../Shared/MapLogic';

// ── Sektions-Komponenten ──────────────────────────────────────────────────────
import Configuration           from './Configuration.jsx';
import UV, { UVAside }         from './UV.jsx';
import Exclusion, { ExclusionAside } from './Exclusion.jsx';
import Export                  from './Export.jsx';

// ── Utilities ─────────────────────────────────────────────────────────────────
import {
  DEFAULTS, DEFAULT_UV_ROWS, DEFAULT_CURVE_POINTS,
  uvRowsToOptions, uvRowsToWeights, uvRowsFromText,
  buildStars,
} from './generation';
import { exportPlanetsJson, injectStarsIntoScmap } from './injection';

// ─────────────────────────────────────────────────────────────────
// Stars.jsx — Parent (Orchestrierung): State, Hooks, Handler, Overlays.
// Sektionen: Configuration (main-only) / UV (+ UVAside) / Exclusion
// (+ ExclusionAside) / Export. Aside content is per-section, matching
// the Wreckage/RockErosion/Treemap/SkyboxGenerator convention —
// TabLayout's generic caption/mirror header is never used (asideCaption/
// asideMirror stay null); each aside block brings its own in-body
// header via .mp-subtitle.
// ─────────────────────────────────────────────────────────────────
const StarsTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {

  // ── Persistenter State ──────────────────────────────────────────
  const [numStars,        setNumStars]        = usePersistentState(shared, 'st_numStars',        DEFAULTS.numStars,        onSharedChange);
  const [numClusters,     setNumClusters]      = usePersistentState(shared, 'st_numClusters',     DEFAULTS.numClusters,     onSharedChange);
  const [clusterSpread,   setClusterSpread]    = usePersistentState(shared, 'st_clusterSpread',   DEFAULTS.clusterSpread,   onSharedChange);
  const [clusterStdDev,   setClusterStdDev]    = usePersistentState(shared, 'st_clusterStdDev',   DEFAULTS.clusterStdDev,   onSharedChange);
  const [backgroundRatio, setBackgroundRatio]  = usePersistentState(shared, 'st_backgroundRatio', DEFAULTS.backgroundRatio, onSharedChange);
  const [scaleMin,        setScaleMin]         = usePersistentState(shared, 'st_scaleMin',        DEFAULTS.scaleMin,        onSharedChange);
  const [scaleMax,        setScaleMax]         = usePersistentState(shared, 'st_scaleMax',        DEFAULTS.scaleMax,        onSharedChange);
  const [uvOpacity,       setUvOpacity]        = usePersistentState(shared, 'st_uvOpacity',       DEFAULTS.uvOpacity,       onSharedChange);
  const [uvOptions,       setUvOptions]        = usePersistentState(shared, 'st_uvOptions',       DEFAULTS.uvOptions,       onSharedChange);
  const [uvWeights,       setUvWeights]        = usePersistentState(shared, 'st_uvWeights',       DEFAULTS.uvWeights,       onSharedChange);

  // uvRows ist nur eine strukturierte Sicht auf uvOptions/uvWeights
  // (Text-Format) — wird daraus abgeleitet, nicht separat persistiert.
  const [uvRows, setUvRows] = useState(() => {
    try {
      return uvRowsFromText(uvOptions, uvWeights);
    } catch (_) {
      return DEFAULT_UV_ROWS;
    }
  });

  const syncUvRows = (rows) => {
    setUvRows(rows);
    setUvOptions(uvRowsToOptions(rows));
    setUvWeights(uvRowsToWeights(rows));
  };

  // Map-Name: andere Tabs (Scmap/Props/Wreckage) können einen Namen
  // vorgeben, bevor der Nutzer im Stars-Tab selbst etwas eingibt; ist
  // 'st_mapName' einmal gesetzt, hat der eigene persistente Wert Vorrang.
  const externalMapName = shared.sb_mapName || shared.pt_mapName || shared.wr_mapName || '';
  const [mapName, setMapName] = usePersistentState(shared, 'st_mapName', externalMapName, onSharedChange);

  useEffect(() => {
    const ext = shared.sb_mapName || shared.pt_mapName || shared.wr_mapName || '';
    if (ext && !mapName) setMapName(ext);
  }, [shared.sb_mapName, shared.pt_mapName, shared.wr_mapName]);

  const [exportRawJson,  setExportRawJson]  = usePersistentState(shared, 'st_exportRawJson',  false, onSharedChange);
  const [generateReadme, setGenerateReadme] = usePersistentState(shared, 'st_generateReadme', true,  onSharedChange);

  // ── mapInfo-Badge ausschließlich aus useMapInfo (TAB_CONTRACT.md §3) ──
  const { mapInfo } = useMapInfo({
    mapName,
    mapsFolderPath: settings?.mapsFolder || '',
    settings,
    onMapSize: v => onSharedChange('st_mapSize', v),
  });

  // ── Y-Distribution ────────────────────────────────────────────
  const [yMode,       setYMode]       = usePersistentState(shared, 'st_yMode',       'flat',                         onSharedChange);
  const [yMax,        setYMax]        = usePersistentState(shared, 'st_yMax',        '1500',                         onSharedChange);
  const [yCenter,     setYCenter]     = usePersistentState(shared, 'st_yCenter',     '750',                          onSharedChange);
  const [yStdDev,     setYStdDev]     = usePersistentState(shared, 'st_yStdDev',     '300',                          onSharedChange);
  const [yLayers,     setYLayers]     = usePersistentState(shared, 'st_yLayers',     '200, 400, 0.7\n900, 200, 0.3', onSharedChange);
  const [diskCenter,  setDiskCenter]  = usePersistentState(shared, 'st_diskCenter',  '100',                          onSharedChange);
  const [diskStdDev,  setDiskStdDev]  = usePersistentState(shared, 'st_diskStdDev',  '120',                          onSharedChange);
  const [haloStdDev,  setHaloStdDev]  = usePersistentState(shared, 'st_haloStdDev',  '800',                          onSharedChange);
  const [haloRatio,   setHaloRatio]   = usePersistentState(shared, 'st_haloRatio',   '0.15',                         onSharedChange);
  const [curvePoints, setCurvePoints] = usePersistentState(shared, 'st_curvePoints', DEFAULT_CURVE_POINTS, onSharedChange);
  const [yClusterScatter, setYClusterScatter] = usePersistentState(shared, 'st_yClusterScatter', '200', onSharedChange);

  // ── Exclusion zones ───────────────────────────────────────────
  const [exclusionZones,   setExclusionZones]   = usePersistentState(shared, 'st_exclusionZones', [],   onSharedChange);
  const [draftZone,        setDraftZone]         = useState(null);
  const [selectedZoneIdx,  setSelectedZoneIdx]   = useState(null);
  const [exEnabled,        setExEnabled]         = usePersistentState(shared, 'st_exEnabled', true, onSharedChange);

  // ── Active section ────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState('config');

  // ── Help modal ────────────────────────────────────────────────
  const [showHelp,       setShowHelp]       = useState(false);
  const [activeHelpTab,  setActiveHelpTab]  = useState('guide');
  const [helpSelected,   setHelpSelected]   = useState(null);
  const [activeAdvSubTab,setActiveAdvSubTab]= useState('workflow');

  // ── UV / texture ──────────────────────────────────────────────
  // Bewusst NICHT persistiert: Daten-URLs können mehrere MB groß sein
  // und würden den Shared-Store aufblähen.
  const [textureDataUrl, setTextureDataUrl] = useState(null);
  const [texOpacity,     setTexOpacity]     = useState(1);

  // ── Build config bundle für den Generator ──────────────────────
  const buildGenCfg = useCallback(() => ({
    numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
    scaleMin, scaleMax, uvOptions, uvWeights,
    exclusionZones, exEnabled,
    yMode, yMax, yCenter, yStdDev, yLayers,
    diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter,
  }), [numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
       scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
       yMode, yMax, yCenter, yStdDev, yLayers,
       diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter]);

  // ── Export / Inject Handler ─────────────────────────────────────
  const handleExportJson = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();

    if (!mapNameTrimmed) { await luxuryAlert('Please set a Map Name before exporting.', 'Map Name Required', 'warning'); return; }
    if (!mapsFolder)     { await luxuryAlert('Please configure the Maps Folder in Settings before continuing.', 'Maps Folder Not Set', 'warning'); return; }

    try {
      const stars = buildStars(buildGenCfg());
      const { fileName } = await exportPlanetsJson({ mapName: mapNameTrimmed, mapsFolder, stars });
      await luxuryAlert(`✓ ${stars.length} stars exported to ${fileName}`, 'JSON Exported', 'success');
    } catch (e) {
      console.error('[Stars export JSON]', e);
      await luxuryAlert(e.message, 'Export Failed', 'error');
    }
  }, [buildGenCfg, mapName, settings]);

  const handleInjectStars = useCallback(async () => {
    const mapNameTrimmed = mapName.trim();
    const mapsFolder     = (settings?.mapsFolder || '').trim();

    if (!mapNameTrimmed) { await luxuryAlert('Please set a Map Name before generating stars.', 'Map Name Required', 'warning'); return; }
    if (!mapsFolder)     { await luxuryAlert('Please configure the Maps Folder in Settings before continuing.', 'Maps Folder Not Set', 'warning'); return; }

    try {
      const stars = buildStars(buildGenCfg());
      const { finalName, mapFolderPath, scmapName } = await injectStarsIntoScmap({
        mapName: mapNameTrimmed, mapsFolder, stars, settings, onRecordSnapshot,
      });

      if (generateReadme) {
        const ms_rm    = parseFloat(settings?.mapSize) || 1024;
        const kmStr_rm = kmLabel(ms_rm);

        const starLines = stars.slice(0, 5).map((s, i) =>
          `  [${String(i + 1).padStart(2, '0')}] pos(${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})  scale(${s.scale.toFixed(2)})`
        );
        if (stars.length > 5) starLines.push(`  ... and ${stars.length - 5} more`);

        const readmeContent = buildReadme({
          tool:    'Stars Tab',
          mapName: finalName,
          mapSize: `${ms_rm} × ${ms_rm} (${kmStr_rm} km)`,
          sections: [
            { title: 'OUTPUT SUMMARY', entries: [
              ['Stars injected', stars.length],
              ['SCMAP File',     `${scmapName}  ← repacked`],
            ]},
            { title: 'STAR PREVIEW (first 5)', lines: starLines },
          ],
        });
        await writeReadme(`${mapFolderPath}\\Stars_Generation_README.txt`, readmeContent);
      }

      await luxuryAlert(`Successfully injected ${stars.length} stars into ${scmapName}.${generateReadme ? '\n✓ README written to map folder' : ''}`, 'Stars Injected', 'success');
    } catch (e) {
      console.error('[Stars inject]', e);
      await luxuryAlert(e.message, 'Star Inject Failed', 'error');
    }
  }, [buildGenCfg, mapName, settings, generateReadme, onRecordSnapshot]);

  // ── Reset / UV row handlers ──────────────────────────────────────
  const resetDefaults = () => {
    setNumStars(DEFAULTS.numStars); setNumClusters(DEFAULTS.numClusters);
    setClusterSpread(DEFAULTS.clusterSpread); setClusterStdDev(DEFAULTS.clusterStdDev);
    setBackgroundRatio(DEFAULTS.backgroundRatio); setScaleMin(DEFAULTS.scaleMin);
    setScaleMax(DEFAULTS.scaleMax); setUvOpacity(DEFAULTS.uvOpacity);
    syncUvRows(DEFAULT_UV_ROWS);
  };

  const onResetUvRows = () => syncUvRows(DEFAULT_UV_ROWS);
  const onAddUvRow     = () => syncUvRows([...uvRows, { x: '0.0', y: '0.0', z: '0.5', w: '0.5', weight: '0.25' }]);
  const onUpdateUvRow  = (i, field, val) => syncUvRows(uvRows.map((r, j) => j === i ? { ...r, [field]: val } : r));
  const onRemoveUvRow  = (i) => syncUvRows(uvRows.filter((_, j) => j !== i));

  // ── Texture upload ────────────────────────────────────────────
  // DropSlot hands us the File directly (no change event to unwrap).
  // NOTE: `webUtils` wird hier referenziert, ist aber in dieser Datei
  // (auch schon im Original) nicht importiert — bestehender Bug, hier
  // unverändert übernommen, nicht Teil dieser Migration.
  const onUploadImage = useCallback(async (file) => {
    if (!file) return;
    const isDds = file.name.toLowerCase().endsWith('.dds');
    if (isDds) {
      try {
        const filePath = webUtils.getPathForFile(file);
        const result = await window.electronAPI.invoke('dds-to-dataurl', { filePath });
        if (!result?.success) { await luxuryAlert('Failed to load DDS file: ' + (result?.error || 'Unknown error'), 'DDS Load Failed', 'error'); return; }
        setTextureDataUrl(result.dataUrl);
      } catch (err) {
        await luxuryAlert('DDS support requires Electron: ' + err.message, 'Electron Required', 'error');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setTextureDataUrl(ev.target.result);
    reader.readAsDataURL(file);
  }, []);

  const onRemoveTexture = () => setTextureDataUrl(null);

  // ── Section content ───────────────────────────────────────────

  const configProps = {
    mapName, onMapNameChange: setMapName,
    mapInfo,

    numStars,        onNumStarsChange:        setNumStars,
    numClusters,     onNumClustersChange:      setNumClusters,
    clusterSpread,   onClusterSpreadChange:    setClusterSpread,
    clusterStdDev,   onClusterStdDevChange:    setClusterStdDev,
    backgroundRatio, onBackgroundRatioChange:  setBackgroundRatio,
    scaleMin,        onScaleMinChange:         setScaleMin,
    scaleMax,        onScaleMaxChange:         setScaleMax,

    yMode,            onYModeChange:            setYMode,
    yClusterScatter,  onYClusterScatterChange:  setYClusterScatter,
    yMax,             onYMaxChange:             setYMax,
    yCenter,          onYCenterChange:          setYCenter,
    yStdDev,          onYStdDevChange:          setYStdDev,
    yLayers,          onYLayersChange:          setYLayers,
    diskCenter,       onDiskCenterChange:       setDiskCenter,
    diskStdDev,       onDiskStdDevChange:       setDiskStdDev,
    haloStdDev,       onHaloStdDevChange:       setHaloStdDev,
    haloRatio,        onHaloRatioChange:        setHaloRatio,
    curvePoints,      onCurvePointsChange:      setCurvePoints,

    onResetDefaults: resetDefaults,
  };

  const uvProps = {
    uvRows, onResetUvRows, onAddUvRow, onUpdateUvRow, onRemoveUvRow,
  };

  const uvAsideProps = {
    uvOptions, uvOpacity, onUvOpacityChange: setUvOpacity,
    textureDataUrl, onUploadImage, onRemoveTexture,
    texOpacity, onTexOpacityChange: setTexOpacity,
  };

  const exclusionProps = {
    exclusionZones,  onExclusionZonesChange: setExclusionZones,
    exEnabled,       onExEnabledChange:      setExEnabled,
    clusterSpread,
    draftZone,       onDraftZoneChange:      setDraftZone,
    selectedZoneIdx, onSelectedZoneIdxChange: setSelectedZoneIdx,
  };

  const exclusionAsideProps = {
    exclusionZones, draftZone, exEnabled, clusterSpread, selectedZoneIdx,
    onDraftZoneChange: setDraftZone, onSelectedZoneIdxChange: setSelectedZoneIdx,
  };

  const exportProps = {
    ready: !!(mapName?.trim() && (settings?.mapsFolder || '').trim()),
    exportRawJson,   onExportRawJsonChange:   setExportRawJson,
    generateReadme,  onGenerateReadmeChange:  setGenerateReadme,
    onExportJson:    handleExportJson,
    onInjectStars:   handleInjectStars,
  };

  // ── WorkspaceConsole-Sektionen ────────────────────────────────
  const sections = [
    { id: 'config',    index: '01', label: 'Configuration',   desc: 'Set star count, cluster parameters and Y-distribution mode.' },
    { id: 'uv',        index: '02', label: 'UV Texture',      desc: 'Define UV tile coordinates and weights, preview against the texture atlas.' },
    { id: 'exclusion', index: '03', label: 'Exclusion Zones', desc: 'Draw rectangular regions where no stars will be placed.' },
    { id: 'export',    index: '04', label: 'Export',          desc: 'Inject generated stars into the .scmap or export a raw JSON file.' },
  ];

  const sectionContent = {
    config:    <Configuration {...configProps} />,
    uv:        <UV            {...uvProps} />,
    exclusion: <Exclusion     {...exclusionProps} />,
    export:    <Export        {...exportProps} />,
  };

  const asideBySection = {
    uv:        <UVAside        {...uvAsideProps} />,
    exclusion: <ExclusionAside {...exclusionAsideProps} />,
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="stars-tab trace-tab">

      <TabLayout
        sections={sections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={asideBySection[activeSection]}
        asideCaption={null}
        asideMirror={null}
      >
        {sectionContent[activeSection]}
      </TabLayout>

      {/* ── Help Button ── */}
      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help Guide">?</button>

      {/* ── Help Modal ── */}
      {showHelp && (
        <StarsHelpModal
          onClose={() => setShowHelp(false)}
          activeHelpTab={activeHelpTab}
          setActiveHelpTab={setActiveHelpTab}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
          setExclusionZones={setExclusionZones}
        />
      )}
    </div>
  );
};

export default StarsTab;
