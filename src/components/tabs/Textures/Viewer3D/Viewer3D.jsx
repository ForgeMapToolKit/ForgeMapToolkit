/**
 * Viewer3D.jsx — Parent (Orchestrierung)
 *
 * TAB-CONTRACT: §0-9 (tabs/Textures/Viewer3D/)
 * Prefix: v3_
 *
 * Ein Prop im Raum statt als flaches Bild: Mesh, Albedo, Bodengitter in Ogrids
 * und ein Referenz-Objekt aus der Installation daneben. Beantwortet die eine
 * Frage, die eine 2D-Vorschau nicht beantworten kann — stimmt der Maßstab.
 *
 * Wie der Texture Editor eine eigene Shell statt `TabLayout` (TAB_CONTRACT §0,
 * Ausnahmeliste): ein Viewport will die Fläche, nicht die Sektions-Rail.
 *
 * Der Modus-Umschalter oben trägt Props / Waves / Sky. Nur Props ist gebaut;
 * die anderen beiden hängen an derselben Scene3D-Engine und kommen später.
 *
 * Die 3D-Darstellung ist eine neutrale Studio-Beleuchtung, **nicht** der
 * Spiel-Shader — der Viewport sagt das auch. Vanilla-Props nutzen sechzehn
 * verschiedene ShaderNames; die anzunähern ist eine eigene Phase.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './Viewer3D.css';

import { usePersistentState } from '../../../Shared/MapLogic';
import { Scene3D } from '../../../Shared/Scene3D';
import PropsLibraryOverlay from '../../../Shared/Libraries/PropsLibrary/PropsLibrary.jsx';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications.js';

import Viewport from './Viewport.jsx';
import Source from './Source.jsx';
import Reference from './Reference.jsx';
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

const MODES = [
  { id: 'props', label: 'Props', ready: true },
  { id: 'waves', label: 'Waves', ready: false },
  { id: 'sky',   label: 'Sky',   ready: false },
];

const Viewer3DTab = ({ settings = {}, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Persistenter State ────────────────────────────────────────────────────
  const [mode, setMode]                 = usePersistentState(s, 'v3_mode', 'props', onSharedChange);
  const [sourceBp, setSourceBp]         = usePersistentState(s, 'v3_sourceBp', '', onSharedChange);
  const [referenceId, setReferenceId]   = usePersistentState(s, 'v3_referenceId', 'UEL0201', onSharedChange);
  const [showReference, setShowReference] = usePersistentState(s, 'v3_showReference', true, onSharedChange);
  const [wireframe, setWireframe]       = usePersistentState(s, 'v3_wireframe', false, onSharedChange);
  const [looseScale, setLooseScale]     = usePersistentState(s, 'v3_looseScale', 0.05, onSharedChange);

  // ── Lokaler UI-State ──────────────────────────────────────────────────────
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  const [subject, setSubject]         = useState(null);   // { blueprint, mesh, texture, scale }
  const [reference, setReference]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const engineRef = useRef(null);
  const hasInstall = !!(settings.faInstallPath || settings.fafPath);

  // ── Engine-Anbindung ──────────────────────────────────────────────────────
  // Scene3D reicht die Engine genau einmal hoch (und null beim Unmount). Alles
  // Weitere läuft imperativ über Refs — ein Szenengraph will keinen Reconciler.
  //
  // `onEngine` muss identitätsstabil sein (sonst remountet Scene3D), darf aber
  // genau deshalb nichts aus dem Render-Closure lesen: es würde für immer den
  // ersten Render sehen. Der aktuelle Stand kommt aus Refs.
  const latest = useRef({});
  latest.current = { subject, reference, showReference, wireframe };

  const onEngine = useCallback((engine) => {
    engineRef.current = engine;
    if (!engine) return;
    // Die Engine ist neu (Mount, StrictMode-Doppelmount, Theme-Wechsel) — was
    // geladen ist, muss zurück in die frische Szene.
    const { subject: sub, reference: ref, showReference: showRef, wireframe: wf } = latest.current;
    engine.setWireframe(wf);
    if (sub) engine.setMesh('subject', toSlot(sub));
    if (ref) engine.setMesh('reference', toSlot(ref));
    engine.setReferenceVisible(showRef);
    engine.frame();
  }, []);

  const applyToScene = useCallback((slot, asset) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMesh(slot, asset ? toSlot(asset) : null);
    engine.setReferenceVisible(showReference);
    engine.frame();
  }, [showReference]);

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadSubjectFromBlueprint = useCallback(async (bpPath) => {
    setLoading(true);
    setError(null);
    try {
      const asset = await loadAsset(bpPath, { prefer: PROP_PREFER });
      setSubject(asset);
      applyToScene('subject', asset);
    } catch (e) {
      setError(e.message);
      setSubject(null);
      applyToScene('subject', null);
    } finally {
      setLoading(false);
    }
  }, [applyToScene]);

  const handleDroppedMesh = useCallback(async (scmFile, ddsFile) => {
    if (!scmFile) return;
    setLoading(true);
    setError(null);
    try {
      const asset = await loadLooseMesh(scmFile, ddsFile, looseScale);
      setSourceBp('');
      setSubject(asset);
      applyToScene('subject', asset);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [applyToScene, looseScale, setSourceBp]);

  // Eine lose .scm bringt keine UniformScale mit — der Regler ist die einzige
  // Quelle dafür, also muss er die Szene sofort nachziehen.
  const handleLooseScale = useCallback((value) => {
    setLooseScale(value);
    if (subject && subject.blueprint.uniformScale == null) {
      const scaled = { ...subject, scale: value };
      setSubject(scaled);
      applyToScene('subject', scaled);
    }
  }, [applyToScene, setLooseScale, subject]);

  const handleLibraryConfirm = useCallback((selected) => {
    setShowLibrary(false);
    const first = selected?.[0];
    const bpPath = first?.gamePath || first?.resolvedPath || first?.id;
    if (!bpPath) return;
    setSourceBp(bpPath);
    loadSubjectFromBlueprint(bpPath);
  }, [loadSubjectFromBlueprint, setSourceBp]);

  // Beim Öffnen des Tabs die zuletzt gewählte Quelle wiederherstellen.
  useEffect(() => {
    if (sourceBp && !subject) loadSubjectFromBlueprint(sourceBp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Referenz-Objekt folgt seiner Auswahl.
  useEffect(() => {
    let cancelled = false;
    if (!referenceId || !hasInstall) {
      setReference(null);
      applyToScene('reference', null);
      return undefined;
    }
    loadAsset(unitBlueprintPath(referenceId), { prefer: UNIT_PREFER })
      .then(asset => {
        if (cancelled) return;
        setReference(asset);
        applyToScene('reference', asset);
      })
      .catch(e => {
        if (cancelled) return;
        setReference(null);
        applyToScene('reference', null);
        luxuryAlert(`Reference unit ${referenceId} could not be read from the installation.\n\n${e.message}`, 'Reference');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId, hasInstall]);

  useEffect(() => { engineRef.current?.setReferenceVisible(showReference); }, [showReference]);
  useEffect(() => { engineRef.current?.setWireframe(wireframe); }, [wireframe]);

  // ── Sektions-Props ────────────────────────────────────────────────────────
  const sourceProps = {
    subject, loading, error, sourceBp, looseScale,
    onOpenLibrary: () => setShowLibrary(true),
    onDroppedMesh: handleDroppedMesh,
    onLooseScale: handleLooseScale,
    onClear: () => { setSourceBp(''); setSubject(null); applyToScene('subject', null); setError(null); },
  };

  const referenceProps = {
    units: REFERENCE_UNITS, referenceId, showReference, reference, hasInstall,
    onSelect: setReferenceId,
    onToggle: setShowReference,
  };

  const viewportProps = {
    subject, reference, showReference, wireframe, loading, error,
    engineRef,
    onEngine,
    onWireframe: setWireframe,
    onFrame: () => engineRef.current?.frame(),
  };

  return (
    <div className="viewer3d-tab">
      <div className="v3-toolbar">
        <div className="v3-tool-group">
          <span className="v3-tool-label">View</span>
          <div className="v3-modes" role="tablist" aria-label="Viewer mode">
            {MODES.map(m => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={`v3-mode${mode === m.id ? ' is-active' : ''}`}
                disabled={!m.ready}
                title={m.ready ? undefined : 'Planned — shares this viewer'}
                onClick={() => m.ready && setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="v3-tool-spacer" />

        <div className="v3-tool-group">
          <Viewer3DHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />
        </div>
      </div>

      <div className="v3-body">
        <Viewport {...viewportProps} SceneComponent={Scene3D} />
        <aside className="v3-side">
          <Source {...sourceProps} />
          <Reference {...referenceProps} />
        </aside>
      </div>

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
