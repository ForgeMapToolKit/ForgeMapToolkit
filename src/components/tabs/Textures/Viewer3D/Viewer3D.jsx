/**
 * Viewer3D.jsx — Parent (Orchestrierung)
 *
 * TAB-CONTRACT: §0-9 (tabs/Textures/Viewer3D/)
 * Prefix: v3_
 *
 * Two workspaces share one Scene3D engine instance, mounted once for the life
 * of the tab:
 *
 *   Layout   — any number of objects stood side by side on the ogrid floor,
 *              so "does this rock read bigger than that tank" is answered by
 *              eye instead of by two numbers you have to compare yourself.
 *   Shading  — one object at a time, with the Texture Editor's own node graph
 *              wired to its albedo and painting the mesh live as you edit.
 *
 * The engine lives here, not in either workspace, so switching tabs never
 * tears down the GL context or re-loads what's already in memory — Layout's
 * objects are exactly what Shading picks from.
 *
 * The 3D rendering is a neutral studio rig, **not** the game shader — the
 * viewport says so. Vanilla props use sixteen different ShaderNames; matching
 * them is a separate phase.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';

import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './Viewer3D.css';

import { usePersistentState } from '../../../Shared/MapLogic';
import { Scene3D } from '../../../Shared/Scene3D';
import PropsLibraryOverlay from '../../../Shared/Libraries/PropsLibrary/PropsLibrary.jsx';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications.js';

import Objects from './Objects.jsx';
import Shading from './Shading.jsx';
import { Viewer3DHelp, Viewer3DHelpButton } from './Help.jsx';

import { loadAsset, loadLooseMesh } from './load.js';
import { REFERENCE_UNITS, unitBlueprintPath, UNIT_PREFER, PROP_PREFER } from './referenceUnits.js';

/** The engine takes flat geometry plus its scale and material hints. */
const toSlot = (asset) => ({
  ...asset.mesh,
  scale: asset.scale,
  texture: asset.texture,
  alphaCutout: asset.alphaCutout,
});

const WORKSPACES = [
  { id: 'layout', label: 'Layout' },
  { id: 'shading', label: 'Shading' },
];

const Viewer3DTab = ({ settings = {}, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;
  const hasInstall = !!(settings.faInstallPath || settings.fafPath);

  // ── Persistenter State ────────────────────────────────────────────────────
  const [workspace, setWorkspace]   = usePersistentState(s, 'v3_workspace', 'layout', onSharedChange);
  const [specs, setSpecs]           = usePersistentState(s, 'v3_objects', [], onSharedChange);
  const [activeId, setActiveId]     = usePersistentState(s, 'v3_activeId', null, onSharedChange);
  const [shadingGraphs, setShadingGraphs] = usePersistentState(s, 'v3_shadingGraphs', {}, onSharedChange);
  const [wireframe, setWireframe]   = usePersistentState(s, 'v3_wireframe', false, onSharedChange);

  // ── Lokaler UI-State ──────────────────────────────────────────────────────
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  // Loose meshes carry no blueprint, so they can never be restored from
  // `specs` after a reload — they live only as long as the tab does.
  const [looseObjects, setLooseObjects] = useState([]); // [{id, label, asset, looseScale}]
  // Runtime load state for the persisted (library/reference) specs, keyed by id.
  const [assets, setAssets] = useState({}); // id -> {loading, asset, error}

  const engineRef = useRef(null);
  const nextIdRef = useRef(null);
  if (nextIdRef.current === null) {
    const seen = [...specs, ...looseObjects].map(o => parseInt(String(o.id).replace(/^obj-/, ''), 10));
    nextIdRef.current = 1 + Math.max(0, ...seen.filter(Number.isFinite));
  }
  const newId = () => `obj-${nextIdRef.current++}`;

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadSpec = useCallback((spec) => {
    setAssets(a => ({ ...a, [spec.id]: { loading: true, asset: null, error: null } }));
    const p = spec.kind === 'reference'
      ? loadAsset(unitBlueprintPath(spec.unitId), { prefer: UNIT_PREFER })
      : loadAsset(spec.bpPath, { prefer: PROP_PREFER });
    p.then(asset => setAssets(a => ({ ...a, [spec.id]: { loading: false, asset, error: null } })))
     .catch(err => setAssets(a => ({ ...a, [spec.id]: { loading: false, asset: null, error: err.message } })));
  }, []);

  // Beim Öffnen des Tabs jede persistierte Quelle neu auflösen — die Meshes
  // selbst werden nie gespeichert, nur wovon sie kommen.
  const restoredRef = useRef(false);
  if (!restoredRef.current) {
    restoredRef.current = true;
    specs.forEach(loadSpec);
  }

  const addLibraryObjects = useCallback((props) => {
    const newSpecs = props.map(p => ({
      id: newId(), kind: 'library', bpPath: p.gamePath || p.resolvedPath || p.id, visible: true,
    })).filter(sp => sp.bpPath);
    setSpecs(list => [...list, ...newSpecs]);
    newSpecs.forEach(loadSpec);
    if (newSpecs.length && !activeId) setActiveId(newSpecs[0].id);
  }, [setSpecs, loadSpec, activeId, setActiveId]);

  const addReferenceObject = useCallback((unitId) => {
    const unit = REFERENCE_UNITS.find(u => u.id === unitId);
    const spec = { id: newId(), kind: 'reference', unitId, visible: true };
    setSpecs(list => [...list, spec]);
    setAssets(a => ({ ...a, [spec.id]: { loading: true, asset: null, error: null } }));
    loadAsset(unitBlueprintPath(unitId), { prefer: UNIT_PREFER })
      .then(asset => setAssets(a => ({ ...a, [spec.id]: { loading: false, asset, error: null } })))
      .catch(err => {
        setAssets(a => ({ ...a, [spec.id]: { loading: false, asset: null, error: err.message } }));
        luxuryAlert(`Reference unit ${unitId} could not be read from the installation.\n\n${err.message}`, 'Reference');
      });
    if (!activeId) setActiveId(spec.id);
  }, [setSpecs, activeId, setActiveId]);

  const addLooseObject = useCallback(async (scmFile, ddsFile, scale) => {
    const id = newId();
    setLooseObjects(list => [...list, { id, label: scmFile.name, asset: null, error: null, loading: true, looseScale: scale }]);
    try {
      const asset = await loadLooseMesh(scmFile, ddsFile, scale);
      setLooseObjects(list => list.map(o => (o.id === id ? { ...o, asset, loading: false } : o)));
      if (!activeId) setActiveId(id);
    } catch (err) {
      setLooseObjects(list => list.map(o => (o.id === id ? { ...o, error: err.message, loading: false } : o)));
    }
  }, [activeId, setActiveId]);

  const setLooseScale = useCallback((id, value) => {
    setLooseObjects(list => list.map(o => (o.id === id && o.asset
      ? { ...o, looseScale: value, asset: { ...o.asset, scale: value } }
      : o)));
  }, []);

  const removeObject = useCallback((id) => {
    engineRef.current?.setObject(id, null);
    setSpecs(list => list.filter(sp => sp.id !== id));
    setAssets(a => { const { [id]: _drop, ...rest } = a; return rest; });
    setLooseObjects(list => list.filter(o => o.id !== id));
    setShadingGraphs(g => { const { [id]: _drop, ...rest } = g; return rest; });
    setActiveId(cur => (cur === id ? null : cur));
  }, [setSpecs, setShadingGraphs, setActiveId]);

  const setVisible = useCallback((id, visible) => {
    setSpecs(list => list.map(sp => (sp.id === id ? { ...sp, visible } : sp)));
    setLooseObjects(list => list.map(o => (o.id === id ? { ...o, visible } : o)));
  }, [setSpecs]);

  // Every object, whichever list it came from, in one shape the rest of the
  // tab reads uniformly.
  const objects = useMemo(() => ([
    ...specs.map(sp => ({
      id: sp.id, kind: sp.kind, visible: sp.visible !== false,
      looseScale: null,
      ...assets[sp.id],
      label: assets[sp.id]?.asset?.blueprint?.name
        || (sp.kind === 'reference' ? REFERENCE_UNITS.find(u => u.id === sp.unitId)?.label : sp.bpPath)
        || sp.bpPath || sp.unitId,
    })),
    ...looseObjects.map(o => ({
      id: o.id, kind: 'loose', visible: o.visible !== false, looseScale: o.looseScale,
      loading: !!o.loading, asset: o.asset, error: o.error, label: o.label,
    })),
  ]), [specs, assets, looseObjects]);

  // ── Engine-Anbindung ──────────────────────────────────────────────────────
  // Scene3D is mounted exactly ONCE below, regardless of which workspace is
  // active — switching Layout ↔ Shading never tears down the GL context or
  // drops what's already loaded, it only changes what sits beside it and
  // which objects are visible right now. The sync state comes from refs so a
  // remount (StrictMode, theme change) fills the fresh scene immediately.
  const latest = useRef({});
  latest.current = { objects, wireframe, workspace, activeId };

  const pushAll = useCallback((engine, { reset = false } = {}) => {
    if (!engine) return;
    const { objects: objs, wireframe: wf, workspace: ws, activeId: aid } = latest.current;
    objs.forEach(o => {
      engine.setObject(o.id, o.asset ? toSlot(o.asset) : null);
      // Shading isolates the one object being adjusted; Layout shows whatever
      // the user toggled on.
      engine.setObjectVisible(o.id, ws === 'shading' ? o.id === aid : o.visible);
    });
    engine.setWireframe(wf);
    engine.frame(ws === 'shading' ? aid : null, { reset });
  }, []);

  const onEngine = useCallback((engine) => {
    engineRef.current = engine;
    pushAll(engine, { reset: true });
  }, [pushAll]);

  // Re-sync whenever the object list, its visibility, or the workspace focus
  // changes — never on every render (the camera would keep snapping back).
  const objectsKey = JSON.stringify(objects.map(o => [o.id, o.visible, !!o.asset]));
  React.useEffect(() => {
    if (engineRef.current) pushAll(engineRef.current);
  }, [objectsKey, workspace, activeId, pushAll]);
  React.useEffect(() => { engineRef.current?.setWireframe(wireframe); }, [wireframe]);

  const loading = objects.some(o => o.loading);
  const visibleCount = objects.filter(o => o.visible && o.asset).length;

  const handleLibraryConfirm = useCallback((selected) => {
    setShowLibrary(false);
    if (selected?.length) addLibraryObjects(selected);
  }, [addLibraryObjects]);

  return (
    <div className="viewer3d-tab">
      <div className="v3-toolbar">
        <div className="v3-tool-group">
          <span className="v3-tool-label">Workspace</span>
          <div className="v3-modes" role="tablist" aria-label="Viewer workspace">
            {WORKSPACES.map(w => (
              <button
                key={w.id}
                role="tab"
                aria-selected={workspace === w.id}
                className={`v3-mode${workspace === w.id ? ' is-active' : ''}`}
                onClick={() => setWorkspace(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="v3-tool-spacer" />

        <div className="v3-tool-group">
          <Viewer3DHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />
        </div>
      </div>

      <div className={`v3-body v3-body--${workspace}`}>
        <div className="v3-viewport">
          <Scene3D onEngine={onEngine} className="v3-canvas" />

          {workspace === 'layout' ? (
            <>
              <div className="v3-readout">
                {visibleCount === 0
                  ? <div className="v3-readout-empty">Pick a prop, or drop a .scm</div>
                  : <div className="v3-readout-name">{visibleCount} object{visibleCount === 1 ? '' : 's'} on the floor</div>}
              </div>
              <div className="v3-viewport-actions">
                <button className="ctrl-btn-meta" onClick={() => engineRef.current?.frame(null, { reset: true })} title="Fit the view to everything on the floor">
                  Frame
                </button>
                <button
                  className={`ctrl-btn-meta${wireframe ? ' is-on' : ''}`}
                  onClick={() => setWireframe(w => !w)}
                  aria-pressed={wireframe}
                >
                  Wireframe
                </button>
              </div>
            </>
          ) : (
            <div className="v3-viewport-actions">
              <button className="ctrl-btn-meta" onClick={() => engineRef.current?.frame(activeId, { reset: true })} title="Fit the view to the shaded object">
                Frame
              </button>
            </div>
          )}

          <div className="v3-disclaimer">Neutral lighting — not the in-game shader</div>
        </div>

        {/* Both panes stay mounted for the life of the tab, same as Scene3D
            above — switching workspace only hides one via `hidden`. Shading
            owns its own WebGL2 context (the node graph's evaluator); unmounting
            it on every tab switch tore that context down and rebuilt it from
            scratch on return, re-fetching and re-decoding the object's texture
            over IPC each time — which showed as a flash of the loading
            placeholder (a faint checker, easy to mistake for "no texture" /
            broken shading) every time you came back to Shading. */}
        <aside className="v3-side" hidden={workspace !== 'layout'}>
          <Objects
            objects={objects}
            hasInstall={hasInstall}
            onOpenLibrary={() => setShowLibrary(true)}
            onAddReference={addReferenceObject}
            onDroppedMesh={(scm, dds) => addLooseObject(scm, dds, 0.05)}
            onLooseScale={setLooseScale}
            onRemove={removeObject}
            onToggleVisible={setVisible}
            onSelect={setActiveId}
            activeId={activeId}
          />
        </aside>
        <div className="v3-shading-pane" hidden={workspace !== 'shading'}>
          <Shading
            objects={objects}
            activeId={activeId}
            onSelect={setActiveId}
            graph={shadingGraphs[activeId] || null}
            onGraphChange={g => setShadingGraphs(all => ({ ...all, [activeId]: g }))}
            onApplyTexture={tex => engineRef.current?.setObjectTexture(activeId, tex)}
          />
        </div>
      </div>

      {loading && (
        <div className="v3-boot-overlay" aria-live="polite">
          <div className="v3-spinner" />
          <div className="v3-boot-label">Loading…</div>
        </div>
      )}

      {showLibrary && (
        <PropsLibraryOverlay
          mapName={null}
          mapsFolder={settings.mapsFolder}
          noTextureEditor
          onConfirm={handleLibraryConfirm}
          onClose={() => setShowLibrary(false)}
          accentColor="var(--tab-color)"
          accentGlow="var(--tab-glow)"
        />
      )}

      <Viewer3DHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default Viewer3DTab;
