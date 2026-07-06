import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import './Stars.css';
import { luxuryAlert }                            from '../../../Shared/Ui/Notifications/notifications';
import { generateReadme as buildReadme, writeReadme } from '../../../../../utils/readmeGenerator';
import StarsHelpModal                             from '../../HelpModals/Stars_help.jsx';
import TabLayout                                  from '../../../Shared/Ui/TabLayout/TabLayout';
import { usePersistentState, useMapInfo, kmLabel } from '../../../Shared/MapLogic';

// ── Sektions-Komponenten ──────────────────────────────────────────────────────
import Configuration from './Configuration.jsx';
import UV            from './UV.jsx';
import Exclusion     from './Exclusion.jsx';
import Export        from './Export.jsx';

// ── Utilities ─────────────────────────────────────────────────────────────────
import {
  DEFAULTS, DEFAULT_UV_ROWS, DEFAULT_CURVE_POINTS,
  uvRowsToOptions, uvRowsToWeights, uvRowsFromText,
  buildStars,
} from './generation';
import { exportPlanetsJson, injectStarsIntoScmap } from './injection';

// ─────────────────────────────────────────────────────────────────
// Stars.jsx — Parent (Orchestrierung): State, Hooks, Handler, Overlays.
//
// Migration note (Schritt 1+2/N — siehe Chat-Verlauf):
//   Schritt 1: die früher hier lokal definierten Stücke (YCurveEditor-
//   Komponente, UV-Parsing, Stern-Generator, kompletter unpack→patch→
//   pack→copy-back-IPC-Flow, Config-/UV-Sektionen als Inline-JSX)
//   wurden ausgelagert nach starsGeneration.js / starsInjection.js /
//   Stars_Configuration.jsx / Stars_UV.jsx / YCurveEditor.jsx.
//   Schritt 2: State-Vertrag (TAB_CONTRACT.md §3) — der lokale
//   `mkState`-Wrapper ist raus, jedes persistente Feld läuft jetzt
//   über `usePersistentState(shared, key, initial, onSharedChange)`
//   aus shared/map-logic mit einheitlichem `st_`-Prefix; `mapInfo`
//   kommt ausschließlich aus `useMapInfo`.
//   ⚠ Ich habe den Quellcode von usePersistentState/useMapInfo nicht
//   gesehen — Signatur/Verhalten ist 1:1 aus TAB_CONTRACT.md §2
//   übernommen (inkl. Unterstützung für funktionale Updates wie
//   useState). Bitte gegen die echte Implementierung / eine andere
//   migrierte Sektion (PropsTab/Props_Configuration) gegenprüfen,
//   bevor das gemerged wird.
//   Bewusst NICHT über usePersistentState: `textureDataUrl`/
//   `texOpacity` (potenziell große Daten-URLs — sollen den Shared-
//   State nicht aufblähen) sowie rein transiente UI-Auswahl/Drag-
//   Zustände (`draftZone`, `selectedZoneIdx`, `activeSection`,
//   Help-Modal-State). ExclusionSection/ExportSection sind weiterhin
//   inline im Parent (nächster Schritt).
// ─────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════
const StarsTab = ({ settings, shared = {}, onSharedChange = () => {}, onRecordSnapshot = () => {} }) => {

  // ── Persistenter State ──────────────────────────────────────────
  // Jedes Feld, das die Stern-Generierung reproduzierbar definiert,
  // läuft über usePersistentState mit eindeutigem 'st_'-Prefix
  // (TAB_CONTRACT.md §3). Rein transiente UI-/Auswahl-Zustände bleiben
  // bewusst plain useState (siehe Datei-Kopfkommentar).
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

  // ── Seed ──────────────────────────────────────────────────────
  const [seed,    setSeed]    = usePersistentState(shared, 'st_seed',    42,    onSharedChange);
  const [useSeed, setUseSeed] = usePersistentState(shared, 'st_useSeed', false, onSharedChange);

  const randomizeSeed = () => setSeed(Math.floor(Math.random() * 999999) + 1);

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
  const [curvePoints, setCurvePoints] = usePersistentState(shared, 'st_curvePoints', DEFAULT_CURVE_POINTS,           onSharedChange);
  const [yClusterScatter, setYClusterScatter] = usePersistentState(shared, 'st_yClusterScatter', '200', onSharedChange);

  // ── Exclusion zones ───────────────────────────────────────────
  // Die Zonen selbst + der Enabled-Schalter definieren die Generierung
  // und werden persistiert; Auswahl/Entwurf bleiben transient.
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
  // und würden den Shared-Store aufblähen (siehe Datei-Kopfkommentar).
  const [textureDataUrl, setTextureDataUrl] = useState(null);
  const [texOpacity,     setTexOpacity]     = useState(1);

  const fileInputRef = useRef(null);

  // ── Build config bundle für den Generator ──────────────────────
  // Ein gemeinsames cfg-Objekt für Export- und Inject-Handler, damit
  // buildStars (aus starsGeneration.js) konsistent mit denselben
  // Parametern aufgerufen wird.
  const buildGenCfg = useCallback(() => ({
    numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
    scaleMin, scaleMax, uvOptions, uvWeights,
    exclusionZones, exEnabled,
    seed, useSeed,
    yMode, yMax, yCenter, yStdDev, yLayers,
    diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter,
  }), [numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio,
       scaleMin, scaleMax, uvOptions, uvWeights, exclusionZones, exEnabled,
       seed, useSeed, yMode, yMax, yCenter, yStdDev, yLayers,
       diskCenter, diskStdDev, haloStdDev, haloRatio, curvePoints, yClusterScatter]);

  // ── Export / Inject Handler ─────────────────────────────────────
  // Der frühere komplette unpack→patch→pack→copy-back-IPC-Flow lebt
  // jetzt in starsInjection.js (siehe TAB_CONTRACT.md §6); hier wird
  // er nur noch aufgerufen.
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
  // NOTE: `webUtils` wird hier referenziert, ist aber in dieser Datei
  // (auch schon im Original) nicht importiert — bestehender Bug, hier
  // unverändert übernommen, nicht Teil dieses Migrationsschritts.
  const onUploadImage = async e => {
    const file = e.target.files[0];
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
  };

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
    onResetCurve: () => setCurvePoints(DEFAULT_CURVE_POINTS),

    seed, onSeedChange: setSeed,
    useSeed, onUseSeedChange: setUseSeed, onRandomizeSeed: randomizeSeed,

    onResetDefaults: resetDefaults,
  };

  const uvProps = {
    uvRows, onResetUvRows, onAddUvRow, onUpdateUvRow, onRemoveUvRow,
    uvOptions, uvOpacity, onUvOpacityChange: setUvOpacity,
    textureDataUrl, onUploadImage, onRemoveTexture,
    texOpacity, onTexOpacityChange: setTexOpacity,
    fileInputRef,
  };

  const exclusionProps = {
    exclusionZones,  onExclusionZonesChange: setExclusionZones,
    exEnabled,       onExEnabledChange:      setExEnabled,
    clusterSpread,
    draftZone,       onDraftZoneChange:      setDraftZone,
    selectedZoneIdx, onSelectedZoneIdxChange: setSelectedZoneIdx,
  };

  const exportProps = {
    exportRawJson,   onExportRawJsonChange:   setExportRawJson,
    generateReadme,  onGenerateReadmeChange:  setGenerateReadme,
    onExportJson:    handleExportJson,
    onInjectStars:   handleInjectStars,
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="stars-tab tab-scrollbar"
      style={{
        '--tab-color':       'var(--stars-color)',
        '--tab-glow':        'var(--stars-glow)',
        '--tab-glow-strong': 'var(--stars-glow-strong)',
      }}
    >
      <TabLayout
        sections={[
          { id: 'config',    index: '01', label: 'Configuration',   desc: 'Set star count, cluster parameters and Y-distribution mode.' },
          { id: 'uv',        index: '02', label: 'UV Texture',      desc: 'Define UV tile coordinates, weights and preview the texture atlas.' },
          { id: 'exclusion', index: '03', label: 'Exclusion Zones', desc: 'Draw rectangular regions where no stars will be placed.' },
          { id: 'export',    index: '04', label: 'Export',          desc: 'Inject generated stars into the .scmap or export a raw JSON file.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="STARS"
        renderEyebrow={(s) => `STAR REGISTER — ${s.index} — STARS CONSOLE`}
        railStorageKey="st-rail-pinned"
        navLabel="Stars console navigation"
        bootMs={280}
      >
        {activeSection === 'config'    && <div className="section-card"><Configuration {...configProps} /></div>}
        {activeSection === 'uv'        && <div className="section-card"><UV {...uvProps} /></div>}
        {activeSection === 'exclusion' && <div className="section-card"><Exclusion {...exclusionProps} /></div>}
        {activeSection === 'export'    && <div className="section-card"><Export {...exportProps} /></div>}
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
