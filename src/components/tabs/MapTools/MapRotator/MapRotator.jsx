import React, { useState, useEffect } from 'react';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './MapRotator.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import { usePersistentState, useMapInfo, finalizeMapName } from '../../../Shared/MapLogic';
import { RotatorHelp, RotatorHelpButton } from './Help.jsx';
import RotatorConfiguration from './Configuration.jsx';
import RotatorOutput from './Output.jsx';
import { normalizeAngle, isQuarterTurn } from './angles.js';

// ── Layer toggle groups ───────────────────────────────────────────────────────
// Built from the current state inside the component so the aside stays a pure
// projection of it.

const MapRotatorTab = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Shared State ────────────────────────────────────────────────────────────

  const [mapName,          setMapName]          = usePersistentState(s, 'mrot_mapName', '', onSharedChange);
  const [mapsFolderPath,   setMapsFolderPath]   = usePersistentState(s, 'mrot_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [angle,            setAngle]            = usePersistentState(s, 'mrot_angle', 90, onSharedChange);
  const [rotateTerrain,    setRotateTerrain]    = usePersistentState(s, 'mrot_rotateTerrain', true, onSharedChange);
  const [rotateProps,      setRotateProps]      = usePersistentState(s, 'mrot_rotateProps', true, onSharedChange);
  const [rotateDecals,     setRotateDecals]     = usePersistentState(s, 'mrot_rotateDecals', true, onSharedChange);
  const [rotateWater,      setRotateWater]      = usePersistentState(s, 'mrot_rotateWater', true, onSharedChange);
  const [patchScripts,     setPatchScripts]     = usePersistentState(s, 'mrot_patchScripts', true, onSharedChange);
  const [rotateMarkers,    setRotateMarkers]    = usePersistentState(s, 'mrot_rotateMarkers', true, onSharedChange);
  const [rotateUnits,      setRotateUnits]      = usePersistentState(s, 'mrot_rotateUnits', true, onSharedChange);
  const [rotateAreas,      setRotateAreas]      = usePersistentState(s, 'mrot_rotateAreas', true, onSharedChange);
  const [rotateSun,        setRotateSun]        = usePersistentState(s, 'mrot_rotateSun', false, onSharedChange);
  const [createNewVersion, setCreateNewVersion] = usePersistentState(s, 'mrot_createNewVersion', true, onSharedChange);

  // ── Settings Sync ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local UI State ──────────────────────────────────────────────────────────

  const [running,       setRunning]       = useState(false);
  const [activeSection, setActiveSection] = useState('configuration');
  const [showHelp,      setShowHelp]      = useState(false);
  // The angle input is edited as text so a half-typed "-" or "" doesn't
  // collapse to 0 mid-keystroke; it commits on blur/Enter.
  const [angleDraft,    setAngleDraft]    = useState(String(angle));
  useEffect(() => { setAngleDraft(String(angle)); }, [angle]);

  // ── Auto-read map info ──────────────────────────────────────────────────────

  const { mapInfo } = useMapInfo({ mapName, mapsFolderPath, settings });

  // ── Source .scmap check ─────────────────────────────────────────────────────
  // useMapInfo only reads save.lua, so a map whose .scmap is one of FAF's co-op
  // placeholders still reports ok. Resolve the .scmap here as well, so the tab
  // can say up front that there is nothing to rotate instead of failing after a
  // new map version has already been copied.

  const [scmapError, setScmapError] = useState(null);

  useEffect(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) { setScmapError(null); return; }
    let cancelled = false;
    window.electronAPI
      .invoke('mr-find-scmap', { mapFolder: folder + '\\' + finalizeMapName(name) })
      .then(res => { if (!cancelled) setScmapError(res?.success ? null : (res?.error || null)); })
      .catch(() => { if (!cancelled) setScmapError(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapName, mapsFolderPath, settings?.mapsFolder]);

  // ── Computed ────────────────────────────────────────────────────────────────

  const normAngle = normalizeAngle(angle);
  const quarter   = isQuarterTurn(normAngle);
  const mapReady  = !!mapInfo?.ok && !scmapError;
  const canRotate = mapReady && !running && normAngle !== 0;

  // ── Rotate Handler ──────────────────────────────────────────────────────────

  const handleRotate = async () => {
    if (!mapInfo?.ok || normAngle === 0) return;
    const folder    = (mapsFolderPath || settings?.mapsFolder || '').trim();
    const mapFolder = folder + '\\' + finalizeMapName(mapName);
    const size      = mapInfo.mapSize;

    // Re-checked rather than trusted from the effect above: duplicating a map
    // version is the first thing this handler does, and anything that fails
    // after that point leaves an orphan version folder behind.
    const preflight = await window.electronAPI.invoke('mr-find-scmap', { mapFolder });
    if (!preflight.success) {
      setScmapError(preflight.error);
      await luxuryAlert({ title: 'Cannot Rotate', message: preflight.error, type: 'error' });
      return;
    }

    const lossNote = quarter
      ? 'This is a quarter turn — nothing is resampled and nothing is clipped.'
      : `This is not a quarter turn: every raster is resampled and the map's corners are clipped.`;

    const confirmed = await luxuryConfirm({
      title:   'Rotate Map',
      message: (createNewVersion
        ? `Rotate "${mapName}" by ${normAngle}° clockwise?\n\nA new map version will be created. The original folder is untouched.`
        : `Rotate "${mapName}" by ${normAngle}° clockwise?\n\nThis overwrites .scmap and Lua files in place. Back up first.`)
        + `\n\n${lossNote}`,
      type:         quarter ? 'warning' : 'error',
      confirmLabel: 'Rotate',
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

      const rotRes = await window.electronAPI.invoke('mrot-rotate-scmap', {
        unpackFolder: unpackRes.outputFolder,
        size, angle: normAngle,
        rotateProps, rotateDecals, rotateWater, rotateTerrain, rotateSun, patchScripts,
      });
      if (!rotRes.success) throw new Error(rotRes.error);

      const packRes = await window.electronAPI.invoke('scmap-pack', {
        unpackFolder: unpackRes.outputFolder,
        scmapPath: findRes.scmapPath,
      });
      if (!packRes.success) throw new Error(packRes.error);

      const saveRes = await window.electronAPI.invoke('mrot-rotate-save-lua', {
        mapFolder: activeMapFolder, size, angle: normAngle,
        rotateMarkers, rotateUnits, rotateAreas,
      });
      if (!saveRes.success) throw new Error(saveRes.error);

      if (newVersionName) setMapName(newVersionName);

      const target  = newVersionName || mapName;
      const skipped = rotRes.ddsSkipped?.length
        ? `\n\nLeft unrotated — a compressed texture can only be turned by a quarter ` +
          `turn: ${rotRes.ddsSkipped.join(', ')}.`
        : '';

      // Only report what the map actually has. Listing "0 props, 0 decals,
      // 0 wave generators" first reads as "nothing happened" on a map that has
      // none of those — which is most terrain-only maps.
      const n = (count, noun, plural) =>
        `${count} ${count === 1 ? noun : (plural || noun + 's')}`;

      const moved = [
        [rotRes.props,          'prop'],
        [rotRes.decals,         'decal'],
        [rotRes.waveGenerators, 'wave generator'],
        [saveRes.markers,       'marker'],
        [saveRes.units,         'unit'],
        [saveRes.areas,         'area'],
      ].filter(([c]) => c > 0).map(([c, noun]) => n(c, noun));

      const movedLine = moved.length
        ? `${moved.join(', ')} moved.`
        : 'This map carries no props, decals, markers or areas — only terrain to turn.';

      const layerLine = `${n(rotRes.rasters?.length ?? 0, 'raster layer')} and ` +
                        `${n(rotRes.ddsRotated?.length ?? 0, 'texture')} turned.`;

      await luxuryAlert({
        title:   'Rotation Complete',
        message: `"${target}" rotated ${normAngle}° clockwise.\n\n` +
                 `${layerLine} ${movedLine}` +
                 skipped +
                 `\n\nThe normal map was turned with the terrain, but its encoded ` +
                 `vectors still face the old direction — re-save the map once in the ` +
                 `FA editor to regenerate them.`,
        type:    'success',
      });

    } catch (err) {
      await luxuryAlert({ title: 'Rotation Failed', message: err.message, type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  // ── Layer toggles ───────────────────────────────────────────────────────────

  const TOGGLE_GROUPS = [
    {
      group: 'SCMAP',
      items: [
        { key: 'terrain', val: rotateTerrain, set: setRotateTerrain, label: 'Rotate Terrain',
          hint: 'Heightmap, terrain types, texture masks, water masks, normal map and the minimap preview.' },
        { key: 'props',   val: rotateProps,   set: setRotateProps,   label: 'Rotate Props',
          hint: 'Moves every prop about the map centre and turns its rotation matrix with it.' },
        { key: 'decals',  val: rotateDecals,  set: setRotateDecals,  label: 'Rotate Decals',
          hint: 'Moves decal positions and adds the turn to their heading. Decal scale is untouched.' },
        { key: 'water',   val: rotateWater,   set: setRotateWater,   label: 'Rotate Water & Waves',
          hint: 'Wave generator positions, headings and velocities, plus the four wave-texture scroll directions.' },
        { key: 'scripts', val: patchScripts,  set: setPatchScripts,  label: 'Patch Prop Scripts',
          hint: 'Rewrites CreateUnitHPR / CreatePropHPR coordinates and headings in each prop\'s _script.lua. Needs Rotate Props.' },
      ],
    },
    {
      group: 'SAVE.LUA',
      items: [
        { key: 'markers', val: rotateMarkers, set: setRotateMarkers, label: 'Rotate Markers',
          hint: 'Spawns, mass, hydro and every other marker — position snapped back onto the half-grid, orientation turned.' },
        { key: 'units',   val: rotateUnits,   set: setRotateUnits,   label: 'Rotate Units',
          hint: 'Pre-placed units and civilians: Position and Orientation.' },
        { key: 'areas',   val: rotateAreas,   set: setRotateAreas,   label: 'Rotate Areas',
          hint: 'Rectangles have no orientation, so a turned one is stored as the bounding box of its rotated corners — exact on a quarter turn, wider on anything else.' },
      ],
    },
    {
      group: 'LIGHTING',
      items: [
        { key: 'sun', val: rotateSun, set: setRotateSun, label: 'Rotate Sun Direction',
          hint: 'Off keeps the sun where it is, so shadows stay consistent with the skybox — which this tool never turns. On preserves the map\'s authored light-and-shadow look instead.' },
      ],
    },
  ];

  const asideSlot = (
    <>
      {TOGGLE_GROUPS.map(({ group, items }) => (
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

  // ── Sections ────────────────────────────────────────────────────────────────

  const sections = [
    {
      id: 'configuration', index: '01', label: 'Configuration',
      desc: 'Select the map and choose how far to turn it.',
      done: mapReady && normAngle !== 0,
    },
    {
      id: 'output', index: '02', label: 'Output',
      desc: 'Set the version behaviour and rotate the map.',
      done: canRotate,
    },
  ];

  const sectionContent = {
    configuration: (
      <RotatorConfiguration
        mapName={mapName} setMapName={setMapName}
        angle={normAngle} setAngle={setAngle}
        angleDraft={angleDraft} setAngleDraft={setAngleDraft}
        mapInfo={mapInfo} scmapError={scmapError} running={running}
      />
    ),
    output: (
      <RotatorOutput
        canRotate={canRotate}
        running={running}
        createNewVersion={createNewVersion}
        setCreateNewVersion={setCreateNewVersion}
        onRotate={handleRotate}
        angle={normAngle}
      />
    ),
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="map-rotator-tab trace-tab">
      <TabLayout
        sections={sections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        navLabel="Map rotator navigation"
        asideSlot={asideSlot}
        asideCaption="LAYERS"
        asideMirror={null}
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <RotatorHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />
      <RotatorHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        mapContext={mapInfo?.ok ? `${mapName} · ${mapInfo.mapSize}²` : null}
      />
    </div>
  );
};

export default MapRotatorTab;
