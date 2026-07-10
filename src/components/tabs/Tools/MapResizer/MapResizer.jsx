import React, { useState, useEffect } from 'react';
import TabLayout         from '../../../Shared/Ui/TabLayout/TabLayout';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './MapResizer.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import MapResizerHelpModal from '../../HelpModals/MapResizer_help.jsx';

// ── Size Options ───────────────────────────────────────────────────────────────

const SIZE_OPTIONS = [
  { value: 128,  label: '128',  km: '2.5 km',  desc: 'Tiny'     },
  { value: 256,  label: '256',  km: '5 km',    desc: 'Small'    },
  { value: 512,  label: '512',  km: '10 km',   desc: 'Standard' },
  { value: 1024, label: '1024', km: '20 km',   desc: 'Large'    },
  { value: 2048, label: '2048', km: '40 km',   desc: 'Huge'     },
  { value: 4096, label: '4096', km: '80 km',   desc: 'Enormous' },
];

// ── SizeButton — uses .station base class for lift/hover/active ────────────────

const SizeButton = ({ option, selected, disabled, isCurrent, onClick }) => (
  <button
    className={[
      'station',
      'mr-size-btn',
      selected  ? 'active'               : '',
      isCurrent ? 'mr-size-btn--current' : '',
    ].filter(Boolean).join(' ')}
    onClick={() => !disabled && onClick(option.value)}
    disabled={disabled}
    title={`${option.label} × ${option.label} — ${option.km}`}
  >
    <span className="mr-size-value">{option.label}</span>
    <span className="mr-size-km">{option.km}</span>
    <span className="mr-size-desc">{isCurrent ? 'current' : option.desc}</span>
  </button>
);

// ── ScaleArrow ─────────────────────────────────────────────────────────────────

const ScaleArrow = ({ fromSize, toSize }) => {
  if (!fromSize || !toSize) return (
    <div className="mr-scale-arrow mr-scale-arrow--neutral">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  );
  const factor = toSize / fromSize;
  const isUp   = factor > 1;
  const isDown = factor < 1;
  const label  = factor === 1 ? '×1' : `×${factor % 1 === 0 ? factor : factor.toFixed(2)}`;
  return (
    <div className={`mr-scale-arrow ${isUp ? 'mr-scale-arrow--up' : isDown ? 'mr-scale-arrow--down' : 'mr-scale-arrow--neutral'}`}>
      <span className="mr-scale-factor">{label}</span>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

const MapResizerTab = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Shared State ──────────────────────────────────────────────────────────────

  const [mapName,          setMapNameState]          = useState(s.mr_mapName          ?? '');
  const [mapsFolderPath,   setMapsFolderPathState]   = useState(s.mr_mapsFolderPath   ?? settings?.mapsFolder ?? '');
  const [targetSize,       setTargetSizeState]       = useState(s.mr_targetSize       ?? 512);
  const [scaleProps,       setScalePropsState]       = useState(s.mr_scaleProps       ?? true);
  const [scaleDecals,      setScaleDecalsState]      = useState(s.mr_scaleDecals      ?? true);
  const [scaleMarkers,     setScaleMarkersState]     = useState(s.mr_scaleMarkers     ?? true);
  const [scaleAreas,       setScaleAreasState]       = useState(s.mr_scaleAreas       ?? true);
  const [scaleTextures,    setScaleTexturesState]    = useState(s.mr_scaleTextures    ?? true);
  const [scaleSkybox,      setScaleSkyboxState]      = useState(s.mr_scaleSkybox      ?? true);
  const [scaleFog,         setScaleFogState]         = useState(s.mr_scaleFog         ?? true);
  const [createNewVersion, setCreateNewVersionState] = useState(s.mr_createNewVersion ?? true);

  const setMapName          = v => { setMapNameState(v);          onSharedChange('mr_mapName', v); };
  const setMapsFolderPath   = v => { setMapsFolderPathState(v);   onSharedChange('mr_mapsFolderPath', v); };
  const setTargetSize       = v => { setTargetSizeState(v);       onSharedChange('mr_targetSize', v); };
  const setScaleProps       = v => { setScalePropsState(v);       onSharedChange('mr_scaleProps', v); };
  const setScaleDecals      = v => { setScaleDecalsState(v);      onSharedChange('mr_scaleDecals', v); };
  const setScaleMarkers     = v => { setScaleMarkersState(v);     onSharedChange('mr_scaleMarkers', v); };
  const setScaleAreas       = v => { setScaleAreasState(v);       onSharedChange('mr_scaleAreas', v); };
  const setScaleTextures    = v => { setScaleTexturesState(v);    onSharedChange('mr_scaleTextures', v); };
  const setScaleSkybox      = v => { setScaleSkyboxState(v);      onSharedChange('mr_scaleSkybox', v); };
  const setScaleFog         = v => { setScaleFogState(v);         onSharedChange('mr_scaleFog', v); };
  const setCreateNewVersion = v => { setCreateNewVersionState(v); onSharedChange('mr_createNewVersion', v); };

  // ── Settings Sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local UI State ────────────────────────────────────────────────────────────

  const [mapInfo,         setMapInfo]         = useState(null);
  const [running,         setRunning]         = useState(false);
  const [activeSection,   setActiveSection]   = useState('configuration');
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('guide');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  // ── Auto-read map info ────────────────────────────────────────────────────────

  useEffect(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) { setMapInfo(null); return; }
    const finalName = /\.v\d{4}$/.test(name) ? name : name + '.v0001';
    const mapFolder = folder + '\\' + finalName;
    window.electronAPI.invoke('read-map-info', { mapFolderPath: mapFolder }).then(res => {
      if (res?.success) {
        setMapInfo({ ok: true, fromSize: res.mapSize, km: res.km, playableSize: res.playableSize, mapFolder });
      } else {
        setMapInfo({ ok: false, error: 'save.lua not found or unreadable' });
      }
    }).catch(() => setMapInfo(null));
  }, [mapName, mapsFolderPath, settings?.mapsFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ──────────────────────────────────────────────────────────────────

  const factor    = mapInfo?.ok ? targetSize / mapInfo.fromSize : null;
  const sameSize  = factor === 1;
  const canResize = mapInfo?.ok && !running && !sameSize;

  // ── Resize Handler ────────────────────────────────────────────────────────────

  const handleResize = async () => {
    if (!mapInfo?.ok) return;
    const { mapFolder, fromSize } = mapInfo;
    const f = targetSize / fromSize;

    const confirmed = await luxuryConfirm({
      title:        'Resize Map',
      message:      createNewVersion
        ? `Resize "${mapName}" from ${fromSize} → ${targetSize}?\n\nA new map version will be created. The original folder is untouched.`
        : `Resize "${mapName}" from ${fromSize} → ${targetSize}?\n\nThis overwrites .scmap and Lua files in place. Back up first.`,
      type:         'warning',
      confirmLabel: 'Resize',
    });
    if (!confirmed) return;

    setRunning(true);

    try {
      let activeMapFolder = mapFolder;
      let newVersionName  = null;

      if (createNewVersion) {
        const dupRes = await window.electronAPI.invoke('mr-duplicate-map-version', { mapFolder });
        if (!dupRes.success) throw new Error(dupRes.error);
        activeMapFolder = dupRes.newMapFolder;
        newVersionName  = dupRes.newVersionName;
      }

      const findRes = await window.electronAPI.invoke('mr-find-scmap', { mapFolder: activeMapFolder });
      if (!findRes.success) throw new Error(findRes.error);

      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath: findRes.scmapPath });
      if (!unpackRes.success) throw new Error(unpackRes.error);

      const scaleRes = await window.electronAPI.invoke('mr-scale-scmap', {
        unpackFolder: unpackRes.outputFolder,
        fromSize, toSize: targetSize, factor: f,
        scaleProps, scaleDecals, scaleTextures, scaleSkybox, scaleFog,
      });
      if (!scaleRes.success) throw new Error(scaleRes.error);

      const packRes = await window.electronAPI.invoke('scmap-pack', {
        unpackFolder: unpackRes.outputFolder,
        scmapPath: findRes.scmapPath,
      });
      if (!packRes.success) throw new Error(packRes.error);

      const saveRes = await window.electronAPI.invoke('mr-scale-save-lua', {
        mapFolder: activeMapFolder, factor: f, toSize: targetSize, scaleMarkers, scaleAreas,
      });
      if (!saveRes.success) throw new Error(saveRes.error);

      const scenRes = await window.electronAPI.invoke('mr-update-scenario-lua', {
        mapFolder: activeMapFolder, toSize: targetSize, factor: f,
      });
      if (!scenRes.success) throw new Error(scenRes.error);

      setMapInfo(prev => ({ ...prev, fromSize: targetSize }));

      if (newVersionName) {
        setMapName(newVersionName);
      }

      await luxuryAlert({
        title:   'Resize Complete',
        message: newVersionName
          ? `"${newVersionName}" created and resized to ${targetSize} × ${targetSize} (${SIZE_OPTIONS.find(o => o.value === targetSize)?.km ?? ''}).`
          : `"${mapName}" resized to ${targetSize} × ${targetSize} (${SIZE_OPTIONS.find(o => o.value === targetSize)?.km ?? ''}).`,
        type:    'success',
      });

    } catch (err) {
      await luxuryAlert({ title: 'Resize Failed', message: err.message, type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  // ── Scale option groups ───────────────────────────────────────────────────────

  const SCALE_GROUPS = [
    {
      group: 'SCMAP',
      items: [
        { key: 'props',    val: scaleProps,    set: setScaleProps,    label: 'Scale Props',                 hint: 'Moves all scmap prop X/Z positions by the scale factor.' },
        { key: 'decals',   val: scaleDecals,   set: setScaleDecals,   label: 'Scale Decals',                hint: 'Moves and resizes all decal positions and scale values.' },
        { key: 'textures', val: scaleTextures, set: setScaleTextures, label: 'Scale Terrain Tex / Normals', hint: 'Scales tile sizes of normals[] and textures[] in data.lua. scale=0 preserved; mapinfo/mapnormal forced to toSize+1.' },
      ],
    },
    {
      group: 'LUA',
      items: [
        { key: 'markers',  val: scaleMarkers,  set: setScaleMarkers,  label: 'Scale Markers',               hint: 'Scales VECTOR3 positions (spawn, mex, hydro…) in save.lua.' },
        { key: 'areas',    val: scaleAreas,    set: setScaleAreas,    label: 'Scale Areas',                 hint: 'Scales all RECTANGLE coordinates in save.lua.' },
      ],
    },
    {
      group: 'SKYBOX / FOG',
      items: [
        { key: 'skybox',   val: scaleSkybox,   set: setScaleSkybox,   label: 'Scale Skybox',                hint: 'Dome scale (size × 2.288), position (size/2), horizonHeight / zenithHeight × factor, cirrus freq ÷ factor, cirrus speed × factor.' },
        { key: 'fog',      val: scaleFog,      set: setScaleFog,      label: 'Scale Fog of War',            hint: 'Multiplies fogStart and fogEnd in data.lua by the scale factor. E.g. fogEnd 150 on a ×4 resize → 600.' },
      ],
    },
  ];

  // ── Aside (scale layer toggles, grouped) ─────────────────────────────────────

  const asideSlot = (
    <>
      {SCALE_GROUPS.map(({ group, items }) => (
        <div className="ctrl-block" key={group}>
          <div className="mp-subtitle">{group}</div>
          {items.map(({ key, val, set, label, hint }) => (
            <button
              key={key}
              type="button"
              className={`ctrl-toggle-row${val ? ' on' : ''}`}
              role="switch"
              aria-checked={val}
              onClick={() => !running && set(!val)}
            >
              <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
              <span className="ctrl-toggle-text">
                <span className="ctrl-toggle-label">{label}</span>
                <span className="ctrl-toggle-sub">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </>
  );

  // ── Sections ──────────────────────────────────────────────────────────────────

  const sections = [
    {
      id:    'configuration',
      index: '01',
      label: 'Configuration',
      desc:  'Select the map and choose a target size.',
      done:  !!mapInfo?.ok,
    },
    {
      id:    'output',
      index: '02',
      label: 'Output',
      desc:  'Set the version behaviour and resize the map.',
      done:  mapInfo?.ok && !running && !sameSize,
    },
  ];

  const sectionContent = {
    configuration: (
      <div className="ctrl-col">

        {/* Map Name */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Map</div>
          <div className="ctrl-content">
            <div className="ctrl-field">
              <div className="ctrl-label">Map Name</div>
              <input
                className="ctrl-input"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="Hades_Dust.v0002"
                disabled={running}
              />
            </div>
          </div>
        </div>

        {/* Target size */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Target Size</div>
          <div className="ctrl-content">
            <div className="mr-size-grid">
              {SIZE_OPTIONS.map(opt => (
                <SizeButton
                  key={opt.value}
                  option={opt}
                  selected={targetSize === opt.value}
                  isCurrent={mapInfo?.ok && mapInfo.fromSize === opt.value}
                  disabled={running || (mapInfo?.ok && mapInfo.fromSize === opt.value)}
                  onClick={setTargetSize}
                />
              ))}
            </div>

            {sameSize && mapInfo?.ok && (
              <div className="mr-same-size-warning">
                Target equals current size — choose a different size.
              </div>
            )}

            {/* Size preview — current → target */}
            <div className="mr-size-preview">
              <div className="mr-size-preview-side">
                <span className="mr-size-preview-label">Current</span>
                <span className="mr-size-preview-value">{mapInfo?.ok ? mapInfo.fromSize : '—'}</span>
                {mapInfo?.ok && <span className="mr-size-preview-km">{mapInfo.km}</span>}
              </div>
              <ScaleArrow fromSize={mapInfo?.ok ? mapInfo.fromSize : null} toSize={targetSize} />
              <div className="mr-size-preview-side">
                <span className="mr-size-preview-label">Target</span>
                <span className="mr-size-preview-value">{targetSize}</span>
                <span className="mr-size-preview-km">{SIZE_OPTIONS.find(o => o.value === targetSize)?.km ?? ''}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    ),
    output: (
      <div className="ctrl-col">
        <OutputChecklist
          ready={canResize}
          onCommit={handleResize}
          commitLabel={running ? 'Resizing…' : 'Resize Map'}
          commitAriaLabel="Resize the map to the selected target size"
          notReadyText={running ? '●' : 'Not Ready'}
          optionsLabel="Version"
          filesLabel="Resize"
          items={[
            {
              label:    'Create new version',
              sub:      createNewVersion
                ? 'A new versioned folder (e.g. map.v0007) is created — original is untouched.'
                : 'The existing map folder is overwritten in place. Back up first.',
              checked:  createNewVersion,
              onToggle: () => !running && setCreateNewVersion(!createNewVersion),
            },
          ]}
        />
      </div>
    ),
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="map-resizer-tab trace-tab">
      <TabLayout
        sections={sections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        railStorageKey="mapresizer-rail-pinned"
        navLabel="Map resizer navigation"
        asideSlot={asideSlot}
        asideCaption={null}
        asideMirror={null}
      >
        {sectionContent[activeSection]}
      </TabLayout>

      {/* ── Help Button ── */}
      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help">?</button>

      {/* ── Help Modal ── */}
      {showHelp && (
        <MapResizerHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={(t) => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}
    </div>
  );
};

export default MapResizerTab;
