import React, { useState, useEffect } from 'react';
import WorkspaceConsole from '../../../shared/WorkspaceConsole/WorkspaceConsole.jsx';
import './MapResizer.css';
import { luxuryAlert, luxuryConfirm } from '../../../modals/notifications';
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

// ── SizeButton ─────────────────────────────────────────────────────────────────

const SizeButton = ({ option, selected, disabled, isCurrent, onClick }) => (
  <button
    className={`mr-size-btn${selected ? ' selected' : ''}${isCurrent ? ' current' : ''}${disabled ? ' disabled' : ''}`}
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
  }, [settings]);

  // ── Local UI State ────────────────────────────────────────────────────────────

  const [activeSection,   setActiveSection]   = useState('map-setup');
  const [mapInfo,         setMapInfo]         = useState(null);
  const [running,         setRunning]         = useState(false);
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
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

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
      ],
    },
    {
      group: 'LUA',
      items: [
        { key: 'markers',  val: scaleMarkers,  set: setScaleMarkers,  label: 'Scale Markers',               hint: 'Scales VECTOR3 positions (spawn, mex, hydro…) in save.lua.' },
        { key: 'areas',    val: scaleAreas,    set: setScaleAreas,    label: 'Scale Areas',                 hint: 'Scales all RECTANGLE coordinates in save.lua.' },
        { key: 'textures', val: scaleTextures, set: setScaleTextures, label: 'Scale Terrain Tex / Normals', hint: 'Scales tile sizes of normals[] and textures[] in data.lua. scale=0 preserved; mapinfo/mapnormal forced to toSize+1.' },
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

  // ── Sections ──────────────────────────────────────────────────────────────────

  const mapSetupDone = mapInfo?.ok && !sameSize;

  const SECTIONS = [
    {
      id:    'map-setup',
      index: '01',
      label: 'Map & Size',
      desc:  'Select the map and choose a target resolution.',
      done:  mapSetupDone,
    },
    {
      id:    'scale-options',
      index: '02',
      label: 'Scale Options',
      desc:  'Choose which map layers are scaled proportionally.',
    },
  ];

  // ── Preview slot — size preview widget ───────────────────────────────────────

  const previewSlot = (
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
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="map-resizer-tab"
      style={{
        '--tab-color':       'var(--mapresizer-color)',
        '--tab-glow':        'var(--mapresizer-glow)',
        '--tab-glow-strong': 'var(--mapresizer-glow-strong)',
      }}
    >
      <WorkspaceConsole
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="RESIZE"
        renderEyebrow={(s) => `MAP RESIZER — ${s.index} — ${s.label.toUpperCase()} CONSOLE`}
        railStorageKey="mapresizer-rail-pinned"
        navLabel="Map resizer navigation"
        previewSlot={previewSlot}
      >

        {/* ── Section 01: Map & Size ── */}
        {activeSection === 'map-setup' && (
          <div className="mr-section-body">

            {/* Map Name */}
            <div className="form-group">
              <label className="field-label">Map Name</label>
              <input
                className="field-input"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="Hades_Dust.v0002"
                disabled={running}
              />
            </div>

            {/* Map info badge */}
            {mapInfo && (
              <div className={`mr-map-badge ${mapInfo.ok ? 'ok' : 'error'}`}>
                <span className="mr-map-badge-icon">{mapInfo.ok ? '✓' : '✗'}</span>
                {mapInfo.ok
                  ? <span>
                      Map size: <strong>{mapInfo.fromSize} × {mapInfo.fromSize}</strong>
                      {mapInfo.playableSize && mapInfo.playableSize !== mapInfo.fromSize &&
                        <span className="mr-map-badge-km"> (playable: {mapInfo.playableSize})</span>
                      }
                    </span>
                  : <span>{mapInfo.error}</span>
                }
              </div>
            )}

            <div className="divider" style={{ margin: '20px 0' }} />

            {/* Size grid */}
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

            <div className="divider" style={{ margin: '20px 0' }} />

            {/* Create new version */}
            <label className="checkbox-label" onClick={() => !running && setCreateNewVersion(!createNewVersion)}>
              <div className={`checkbox${createNewVersion ? ' checked' : ''}`}>
                {createNewVersion && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <span className="checkbox-text">Create new version</span>
                <p className="field-hint" style={{ marginTop: 3, marginBottom: 0 }}>
                  {createNewVersion
                    ? 'A new versioned folder (e.g. map.v0007) is created — original is untouched.'
                    : 'The existing map folder is overwritten in place. Back up first.'}
                </p>
              </div>
            </label>

            {/* Resize CTA */}
            <button
              className="button-solid button-solid--accent button-solid--full"
              onClick={handleResize}
              disabled={!canResize}
              style={{ marginTop: 20 }}
            >
              {running ? 'Resizing…' : 'Resize Map'}
            </button>

          </div>
        )}

        {/* ── Section 02: Scale Options ── */}
        {activeSection === 'scale-options' && (
          <div className="mr-section-body">
            {SCALE_GROUPS.map(({ group, items }, gi) => (
              <div key={group}>
                <div className="subsection-head" style={gi > 0 ? { marginTop: 28 } : {}}>
                  <span className="subsection-head-title">{group}</span>
                </div>
                <div className="mr-options-stack">
                  {items.map(({ key, val, set, label, hint }) => (
                    <label key={key} className="checkbox-label" onClick={() => !running && set(!val)}>
                      <div className={`checkbox${val ? ' checked' : ''}`}>
                        {val && (
                          <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <span className="checkbox-text">{label}</span>
                        <p className="field-hint" style={{ marginTop: 3, marginBottom: 0 }}>{hint}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </WorkspaceConsole>

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
