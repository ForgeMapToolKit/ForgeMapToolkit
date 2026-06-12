import React from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// HelpInfoPanel — right-hand explanation pane
// ══════════════════════════════════════════════════════════════════════════════

function HelpInfoPanel({ sel }) {
  if (!sel) return null;
  return (
    <div className="help-adv-layout" style={{ padding: 0 }}>
      <div className="help-adv-hero" style={{ marginBottom: '24px' }}>
        <div className="help-adv-hero-content">
          <h2 className="help-adv-hero-title" style={{ fontSize: '1.6rem' }}>{sel.title}</h2>
          <p className="help-adv-hero-desc">{sel.desc}</p>
        </div>
      </div>
      <div className="help-adv-structure">
        <h3 className="help-adv-section-header">
          <span className="help-adv-section-num">01</span>Details
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sel.details.map(([label, value], i) => (
              <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tab-color)', minWidth: '120px', flexShrink: 0 }}>{label}:</strong>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="help-adv-note" style={{ marginTop: '16px' }}>
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}

// ── Info data ─────────────────────────────────────────────────────────────────

const GUIDE_INFO = {
  mapname: {
    title: 'Map Name',
    desc:  'The exact folder name of your map inside the /maps directory. The tool reads save.lua from this folder to detect the current map size and writes all resized files back here.',
    details: [
      ['Format',         'MapName.vXXXX — e.g. Hades_Dust.v0002'],
      ['Auto-version',   'Omitting .v0001 appends it automatically'],
      ['Case-sensitive', 'FA is strict — match the folder name exactly'],
      ['Impact',         'Wrong name = save.lua not found, resize blocked'],
    ],
    tip: 'Copy the folder name directly from File Explorer to avoid typos.',
  },
  mapbadge: {
    title: 'Map Status Badge',
    desc:  'Appears after typing a map name. Shows whether save.lua was found and what current playable size was read from it.',
    details: [
      ['Green check', 'save.lua found — current size read successfully'],
      ['Red cross',   'save.lua not found or unreadable — check the map name'],
      ['Size shown',  'Playable grid size in tiles (e.g. 512) and approximate km'],
    ],
    tip: 'If the badge stays red, open the map in the FA editor once to generate save.lua.',
  },
  sizepreview: {
    title: 'Size Preview',
    desc:  'Shows the current map size on the left, the selected target size on the right, and a centre arrow labelled with the multiplication factor.',
    details: [
      ['Pink arrow up',    'Upscale — all coordinates multiplied by the factor'],
      ['Orange arrow down','Downscale — all coordinates divided by the factor'],
      ['Neutral arrow',    'No map detected yet, or same-size selection'],
      ['Scale label',      'e.g. x2 means every coordinate is doubled'],
    ],
    tip: 'A x4 upscale on a 512 map gives you a 2048 map with all markers scaled accordingly.',
  },
  targetsize: {
    title: 'Target Size',
    desc:  'The new playable grid size to resize the map to. Six standard FA sizes are available. The current size is shown greyed-out and cannot be selected.',
    details: [
      ['128 — 2.5 km', 'Tiny skirmish'],
      ['256 — 5 km',   'Small'],
      ['512 — 10 km',  'Standard'],
      ['1024 — 20 km', 'Large'],
      ['2048 — 40 km', 'Huge'],
      ['4096 — 80 km', 'Enormous'],
    ],
    tip: 'The scale factor between current and target is shown in the size preview arrow.',
  },
  scaleprops: {
    title: 'Scale Props',
    desc:  'Scales all prop X, Y, and Z position coordinates stored in the props.lua files that were unpacked from the .scmap. All three axes are multiplied so props follow the rescaled heightmap.',
    details: [
      ['Affects',      'props.lua / props1.lua / props2.lua in the unpacked .scmap'],
      ['X, Y, Z',      'All three position components multiplied by the factor'],
      ['Rotation',     'Quaternion direction vectors — not scaled'],
      ['Mesh scale',   'Per-prop scale field — not scaled'],
      ['On',           'Props stay correctly distributed across the new map area'],
      ['Off',          'Props cluster at old coordinates — misplaced at new size'],
    ],
    tip: 'Disable only when you plan to manually reposition props in the FA editor afterwards.',
  },
  scaledecals: {
    title: 'Scale Decals',
    desc:  'Scales decal positions and their footprint size values stored in the decals.lua files unpacked from the .scmap.',
    details: [
      ['Affects',           'decals.lua / decals1.lua / decals2.lua'],
      ['Position X, Y, Z',  'All three position components multiplied by factor'],
      ['scale[1]',          'Footprint width — multiplied by factor'],
      ['scale[3]',          'Footprint depth — multiplied by factor'],
      ['scale[2]',          'Vertical projection depth — not scaled'],
      ['Rotation',          'Y-axis radians — not scaled'],
    ],
    tip: 'Nearly always leave this enabled — misplaced decals are tedious to fix manually.',
  },
  scalemarkers: {
    title: 'Scale Markers',
    desc:  "Scales all VECTOR3 position values in the map's _save.lua — spawn points, mass extractors, hydros, and custom waypoints.",
    details: [
      ['Affects',  "_save.lua  ['position'] = VECTOR3( X, Y, Z )"],
      ['X, Y, Z',  'All three components multiplied by factor'],
      ['Includes', 'Spawn positions, mass extractors, hydrocarbon plants, waypoints'],
      ['On',       'Markers land at correct proportional positions on the new grid'],
      ['Off',      'Markers stay at old coordinates — clustered in one corner of the new map'],
    ],
    tip: 'This is one of the most critical options — almost always leave it enabled.',
  },
  scaleareas: {
    title: 'Scale Areas',
    desc:  "Scales all RECTANGLE coordinate values in the map's _save.lua — named trigger areas and play boundaries.",
    details: [
      ['Affects',      "_save.lua  RECTANGLE( x1, y1, x2, y2 )"],
      ['All 4 values', 'x1, y1, x2, y2 all multiplied by factor'],
      ['Typical use',  'Play area border, spawn exclusion zones, scripted trigger regions'],
      ['On',           'Area corners scale proportionally with the map'],
      ['Off',          'Areas stay at old dimensions — triggers fire at wrong positions'],
    ],
    tip: 'Leave enabled for any map with scripted triggers or survival-style area boundaries.',
  },
  scaletextures: {
    title: 'Scale Terrain Textures / Normals',
    desc:  'Scales the tile size values of terrain texture and normal-map layers in data.lua so the visual tiling density stays consistent after the resize.',
    details: [
      ['Affects',    'normals[].scale and textures[].scale in data.lua'],
      ['Formula',    'scale = old_scale × factor for each layer'],
      ['Zero guard', 'Entries with scale = 0 are left untouched (disabled layers)'],
      ['mapinfo guard', 'mapinfo.dds / mapnormal.dds are set to toSize + 1 (map-resolution textures, not tile-frequency values)'],
      ['On',         'Terrain tiles at the same apparent density on the new map'],
      ['Off',        'Textures tile at the old world-unit frequency — appears stretched or dense'],
    ],
    tip: 'Disable intentionally if you want a different tiling density at the new size.',
  },
  scaleskybox: {
    title: 'Scale Skybox',
    desc:  'Adjusts skybox dome and atmospheric parameters in data.lua proportionally to the new map size.',
    details: [
      ['Dome scale',      'Set to toSize × 2.288245'],
      ['Dome position',   'Recentred at toSize / 2 on X and Z'],
      ['horizonHeight',   'Multiplied by factor'],
      ['zenithHeight',    'Multiplied by factor'],
      ['Cirrus frequency','Divided by factor — keeps cloud detail density constant'],
      ['Cirrus speed',    'Multiplied by factor — keeps apparent cloud drift speed constant'],
    ],
    tip: 'Disable if you prefer to hand-tune the skybox atmosphere after the resize.',
  },
  scalefog: {
    title: 'Scale Fog of War',
    desc:  'Multiplies fogStart and fogEnd in data.lua by the scale factor so visibility distance stays proportional to the new map size.',
    details: [
      ['Affects',  'fogStart and fogEnd top-level fields in data.lua'],
      ['Formula',  'new = old × factor  (fogStart = 0 stays 0)'],
      ['Example',  'fogEnd 150 on a x4 resize becomes 600'],
      ['On',       'Visibility range expands proportionally — same relative sight lines'],
      ['Off',      'Fog cuts in at old world-unit distances — very tight on large maps'],
    ],
    tip: 'Disable if you want deliberately short sight lines as a design choice on the new map.',
  },
  resizebtn: {
    title: 'Resize Map',
    desc:  'Validates all inputs, shows a confirmation dialog, then runs the full six-step resize pipeline. All .scmap binary layers and Lua files are updated in a single run.',
    details: [
      ['Requires',       'Map Name set + save.lua readable + target size different from current'],
      ['Confirmation',   'Shows from-size, to-size and a backup reminder before modifying anything'],
      ['In-place write', 'Overwrites .scmap and _save.lua / data.lua / _scenario.lua directly, unless Create New Version is enabled — then a new versioned folder is written and the original is untouched'],
      ['Pipeline',       'mr-find-scmap → scmap-unpack → mr-scale-scmap → scmap-pack → mr-scale-save-lua → mr-update-scenario-lua'],
      ['Re-run safe',    'Running the same resize again always overwrites cleanly'],
    ],
    tip: 'Back up the map folder manually before resizing — no automatic backup is created.',
  },
};

// ── MapResizerHelpModal ───────────────────────────────────────────────────────

function MapResizerHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {

  const TABS = [
    { id: 'guide',    label: 'Help Guide'     },
    { id: 'advanced', label: 'Advanced Guide'  },
  ];

  // Replica checkbox helper — purely visual, no interaction
  const ReplicaCheckbox = ({ label, hint, selKey }) => (
    <div
      style={{ cursor: 'pointer', outline: helpSelected === selKey ? '2px solid #00DDFF' : 'none', padding: '2px 4px' }}
      onClick={() => setHelpSelected(selKey)}
    >
      <label className="checkbox-label" style={{ pointerEvents: 'none' }}>
        <div className="checkbox checked">
          <svg className="checkbox-check" viewBox="0 0 12 10" fill="none">
            <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <span className="checkbox-text" style={{ color: '#00DDFF' }}>{label}</span>
          <p className="form-help" style={{ marginTop: 3, marginBottom: 0 }}>{hint}</p>
        </div>
      </label>
    </div>
  );

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div
        className="help-modal"
        style={{ '--tab-color': '#00DDFF', '--tab-glow': 'rgba(0,221,255,0.25)', '--tab-glow-strong': 'rgba(0,221,255,0.55)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">Map Resizer — Help</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tab bar */}
        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => { setActiveTab(t.id); setHelpSelected(null); }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="help-modal-content" style={{ padding: 0 }}>

          {/* ════════════ HELP GUIDE ════════════ */}
          {activeTab === 'guide' && (
            <div style={{ display: 'flex', gap: 0, height: 'calc(90vh - 135px)' }}>

              {/* Left col — 1:1 replica, exactly 50% */}
              <div style={{ flex: '0 0 50%', overflowY: 'auto', padding: '30px 30px 30px 40px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Click any element to learn about it
                </div>

                {/* ── Replica: Target Size + Scale Options side by side (mirrors tab-grid) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

                  {/* Left sub-col: Map Selection + Target Size + Resize button */}
                  <div>
                    {/* Map Selection */}
                    <div className="section-card" style={{ marginBottom: 16, cursor: 'default' }}>
                      <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Map Selection</h3>

                      <div
                        className="form-group"
                        style={{ marginBottom: 12, cursor: 'pointer', outline: helpSelected === 'mapname' ? '2px solid #00DDFF' : 'none' }}
                        onClick={() => setHelpSelected('mapname')}
                      >
                        <label className="form-label">Map Name</label>
                        <input readOnly onChange={() => {}} className="form-input" value=""
                          placeholder="my_map  (or my_map.v0001)"
                          style={{ pointerEvents: 'none', fontSize: '0.88rem', padding: '10px 14px' }} />
                        <p className="form-help">Version suffix (.v0001) added automatically if omitted.</p>
                      </div>

                      <div
                        className="mr-map-badge ok"
                        style={{ cursor: 'pointer', outline: helpSelected === 'mapbadge' ? '2px solid #00DDFF' : 'none' }}
                        onClick={() => setHelpSelected('mapbadge')}
                      >
                        <span className="mr-map-badge-icon">✓</span>
                        <span>Current size: <strong>512 × 512</strong><span className="mr-map-badge-km"> (10 km)</span></span>
                      </div>
                    </div>
                    <div className="section-card" style={{ marginBottom: 16, cursor: 'default' }}>
                      <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Target Size</h3>

                      <div
                        className="mr-size-preview"
                        style={{ cursor: 'pointer', outline: helpSelected === 'sizepreview' ? '2px solid #00DDFF' : 'none', marginBottom: 14, padding: '16px 12px' }}
                        onClick={() => setHelpSelected('sizepreview')}
                      >
                        <div className="mr-size-preview-side">
                          <span className="mr-size-preview-label">Current</span>
                          <span className="mr-size-preview-value">512</span>
                          <span className="mr-size-preview-km">10 km</span>
                        </div>
                        <div className="mr-scale-arrow mr-scale-arrow--up">
                          <span className="mr-scale-factor">×2</span>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="mr-size-preview-side">
                          <span className="mr-size-preview-label">Target</span>
                          <span className="mr-size-preview-value">1024</span>
                          <span className="mr-size-preview-km">20 km</span>
                        </div>
                      </div>

                      <div
                        className="mr-size-grid"
                        style={{ cursor: 'pointer', outline: helpSelected === 'targetsize' ? '2px solid #00DDFF' : 'none' }}
                        onClick={() => setHelpSelected('targetsize')}
                      >
                        {[
                          { v: 128,  l: '128',  km: '2.5 km', d: 'Tiny'    },
                          { v: 256,  l: '256',  km: '5 km',   d: 'Small'   },
                          { v: 512,  l: '512',  km: '10 km',  d: 'current' },
                          { v: 1024, l: '1024', km: '20 km',  d: 'Large'   },
                          { v: 2048, l: '2048', km: '40 km',  d: 'Huge'    },
                          { v: 4096, l: '4096', km: '80 km',  d: 'Enormous'},
                        ].map(({ v, l, km, d }) => (
                          <div key={v} className={`mr-size-btn${v === 1024 ? ' selected' : ''}${v === 512 ? ' current' : ''}`} style={{ pointerEvents: 'none' }}>
                            <span className="mr-size-value">{l}</span>
                            <span className="mr-size-km">{km}</span>
                            <span className="mr-size-desc">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Resize button */}
                    <div style={{ position: 'relative' }}>
                      <button className="btn-primary btn-lg" style={{ pointerEvents: 'none', width: '100%' }}>Resize Map</button>
                      <div
                        style={{ position: 'absolute', inset: 0, cursor: 'pointer', outline: helpSelected === 'resizebtn' ? '2px solid #00DDFF' : 'none' }}
                        onClick={() => setHelpSelected('resizebtn')}
                      />
                    </div>
                  </div>

                  {/* Right sub-col: Scale Options */}
                  <div className="section-card" style={{ cursor: 'default' }}>
                    <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Scale Options</h3>

                    <div className="subsection-title" style={{ fontSize: '0.8rem', marginTop: 4, marginBottom: 10 }}>SCMAP</div>
                    <div className="mr-options-stack" style={{ marginBottom: 8 }}>
                      <ReplicaCheckbox selKey="scaleprops"   label="Scale Props"   hint="Moves all scmap prop X/Z positions by the scale factor." />
                      <ReplicaCheckbox selKey="scaledecals"  label="Scale Decals"  hint="Moves and resizes all decal positions and scale values." />
                    </div>

                    <div className="subsection-title" style={{ fontSize: '0.8rem', marginBottom: 10 }}>LUA</div>
                    <div className="mr-options-stack" style={{ marginBottom: 8 }}>
                      <ReplicaCheckbox selKey="scalemarkers"  label="Scale Markers"               hint="Scales VECTOR3 positions (spawn, mex, hydro…) in save.lua." />
                      <ReplicaCheckbox selKey="scaleareas"    label="Scale Areas"                 hint="Scales all RECTANGLE coordinates in save.lua." />
                      <ReplicaCheckbox selKey="scaletextures" label="Scale Terrain Tex / Normals" hint="Scales tile sizes of normals[] and textures[] in data.lua." />
                    </div>

                    <div className="subsection-title" style={{ fontSize: '0.8rem', marginBottom: 10 }}>SKYBOX / FOG</div>
                    <div className="mr-options-stack">
                      <ReplicaCheckbox selKey="scaleskybox" label="Scale Skybox"     hint="Dome scale, horizon/zenith heights, cirrus freq + speed." />
                      <ReplicaCheckbox selKey="scalefog"    label="Scale Fog of War" hint="Multiplies fogStart and fogEnd in data.lua by the scale factor." />
                    </div>
                  </div>

                </div>{/* end two-col grid */}

              </div>{/* end left col */}

              {/* Right col — explanation panel, exactly 50% */}
              <div style={{ flex: '0 0 50%', overflowY: 'auto', padding: '30px 40px 30px 30px' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: '#00DDFF' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: '260px', lineHeight: 1.7 }}>Click any field, button, checkbox, or section on the left to learn what it does.</div>
                  </div>
                ) : (
                  <HelpInfoPanel sel={GUIDE_INFO[helpSelected]} />
                )}
              </div>

            </div>
          )}

          {/* ════════════ ADVANCED GUIDE ════════════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout" style={{ padding: '40px' }}>

              {/* Sub-tab switcher */}
              <div className="help-adv-subtabs">
                {[
                  { id: 'workflow',  label: 'Workflow'        },
                  { id: 'pipeline',  label: 'Resize Pipeline'  },
                  { id: 'scmap',     label: '.scmap Format'   },
                  { id: 'luafiles',  label: 'Lua Files'       },
                  { id: 'options',   label: 'Scale Options'   },
                ].map(t => (
                  <button key={t.id}
                    className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveAdvSubTab(t.id)}
                  >{t.label}</button>
                ))}
              </div>

              {/* ─── WORKFLOW ─── */}
              {activeAdvSubTab === 'workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">End-to-End Workflow</h2>
                    <p className="help-adv-hero-desc">
                      Complete reference for resizing any FA map — from entering the map name to verifying the result in-game.
                      No external tool required: heightmaps, textures, props, decals, markers, areas, skybox and fog are all
                      processed internally in a single run.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="btn-primary help-adv-fake-button" style={{ background: '#00DDFF', color: '#000', border: 'none' }}>
                      Resize Map
                    </div>
                    <span className="help-adv-button-hint">4 steps — under 30 seconds on modern hardware.</span>
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Step by Step</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'Set Map Name',
                        desc: 'Enter the exact map folder name (e.g. Hades_Dust.v0002). The tool reads save.lua from that folder to determine the current playable size. The .v0001 version suffix is appended automatically if omitted.',
                        subs: ['Must match /maps folder name exactly — FA is case-sensitive', 'Omitting .v0001 appends it automatically', 'Wrong name = save.lua not found, resize blocked', 'Green badge confirms current size was read successfully'] },
                      { n: '02', title: 'Select Target Size',
                        desc: 'Click one of the six size presets. The current size is greyed-out and cannot be chosen. The centre arrow shows the scale factor.',
                        subs: ['Sizes: 128 / 256 / 512 / 1024 / 2048 / 4096 — standard FA grid dimensions', 'Scale factor shown: x2 means every coordinate is doubled', 'Downscaling works exactly the same as upscaling', 'Resize button stays disabled while current = target'] },
                      { n: '03', title: 'Review Scale Options',
                        desc: 'All options default to enabled. Disable any you want to preserve — e.g. uncheck Skybox to keep the existing atmosphere, or uncheck Fog to control visibility manually.',
                        subs: ['Props + Decals: .scmap binary coordinate data', 'Markers + Areas: _save.lua VECTOR3 / RECTANGLE values', 'Textures: terrain tile frequencies in data.lua', 'Skybox + Fog: atmospheric parameters in data.lua'] },
                      { n: '04', title: 'Click Resize Map',
                        desc: 'A confirmation dialog lists the operation. Confirm to run the full pipeline. The .scmap and Lua files are overwritten in place — back up your map folder first.',
                        subs: ['No automatic backup — do it yourself before running', 'Pipeline: unpack → scale → repack → update Lua', 'A success alert confirms completion; the size badge updates', 'Re-running is always safe — files overwritten cleanly'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul>{s.subs.map((sub, i) => <li key={i}>{sub}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Troubleshooting</h3>
                  {[
                    ['save.lua not found', 'The map folder must contain a save.lua generated by the FA editor. Open the map in the editor at least once — it creates save.lua on first save. Check the map name spelling and version suffix.'],
                    ['DDS textures look blurry after upscale', 'Install sharp (npm i sharp in the app directory). Without sharp, only the DDS header is patched — pixel data is not resampled. With sharp, bilinear resampling is applied to all .dds layers.'],
                    ['Markers appear at wrong positions', 'Scale Markers was off during resize, or the map was at a different size than reported. Re-run with Scale Markers enabled.'],
                    ['Resize fails mid-way', 'The .scmap file may be locked by the FA editor. Close the editor completely and retry. Check the error message for which pipeline step failed.'],
                    ['Props misaligned after resize', 'Scale Props was disabled. Re-run with Scale Props enabled, or reposition manually in the FA editor.'],
                    ['Terrain textures look wrong after resize', 'Scale Terrain Tex / Normals was off. Re-run with it enabled, or manually adjust texture tile sizes in data.lua.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: '#00DDFF' }}>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      { title: 'Back Up First',            desc: 'Copy the entire map folder before resizing. The tool overwrites files in place with no automatic backup. One copy is enough — the resize is deterministic and re-runnable.' },
                      { title: 'Prefer Integer Factors',   desc: 'Use x2 or x4 scale factors (e.g. 512→1024, 256→1024) for the cleanest heightmap and texture scaling. Non-integer factors introduce rounding that may cause minor terrain artefacts.' },
                      { title: 'Leave All Options On',     desc: 'The defaults are correct for the vast majority of resizes. Only disable specific options when you have a concrete reason — e.g. intentionally keeping a hand-tuned skybox.' },
                      { title: 'Verify in FA After',       desc: 'Load the map in the FA editor after resizing to confirm spawn points, mass extractors, and area borders are in the expected positions.' },
                      { title: 'Re-runs Are Safe',         desc: 'Resizing the same map twice always produces the same output. If something looks wrong, fix the options and re-run without restoring the backup.' },
                      { title: 'Install sharp For Quality',desc: 'Without the sharp npm package only DDS headers are patched — pixel data is not resampled. Install sharp for proper bilinear texture upscaling.' },
                    ].map(({ title, desc }) => (
                      <div key={title} className="help-adv-practice-card">
                        <h4>{title}</h4>
                        <p>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── RESIZE PIPELINE ─── */}
              {activeAdvSubTab === 'pipeline' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Internal Resize Pipeline</h2>
                    <p className="help-adv-hero-desc">
                      The resize runs in six sequential IPC steps — each step is atomic. If any step fails the pipeline stops and the error is reported.
                      All intermediate files are written to a temp folder and cleaned up after packing.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase" style={{ minWidth: 220 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 16px', background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(0,221,255,0.22)', fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(0,221,255,0.7)' }}>
                      {['mr-find-scmap', 'scmap-unpack', 'mr-scale-scmap', 'scmap-pack', 'mr-scale-save-lua', 'mr-update-scenario-lua'].map(s => <div key={s}>{s}</div>)}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Pipeline Steps</h3>
                  <div className="help-adv-card-grid">
                    {[
                      { title: 'mr-find-scmap',
                        desc: 'Locates the .scmap file inside the map folder. Maps typically have one .scmap named after the map folder.',
                        features: ['Scans mapFolder for *.scmap', 'Returns the resolved absolute path', 'Fails if no .scmap is found — check the map folder contents'] },
                      { title: 'scmap-unpack',
                        desc: 'Reads and decompresses the .scmap binary into individual layer files in a temp directory.',
                        features: ['heightmap.raw — 16-bit unsigned LE, (size+1) x (size+1)', 'props.lua / props1.lua / props2.lua — split prop lists', 'decals.lua / decals1.lua / decals2.lua — split decal lists', 'data.lua — terrain layers, skybox, fog, water settings', 'normalMap, waterMap, terrainType — raw binary rasters'] },
                      { title: 'mr-scale-scmap',
                        desc: 'The main scaling step. Processes each data section in the unpacked folder according to the scale options selected.',
                        features: ['data.lua size header updated to new grid dimension', 'Props: all position components (X, Y, Z) multiplied by factor', 'Decals: position (X,Y,Z) and footprint scale (X, Z) multiplied by factor', 'Terrain normals[].scale and textures[].scale multiplied by factor (scale=0 preserved; mapinfo.dds/mapnormal.dds set to toSize+1)', 'Skybox: dome scale (×2.288245), position, horizonHeight, zenithHeight, cirrus freq/speed updated', 'Fog: fogStart and fogEnd multiplied by factor', 'All raw binary rasters bilinearly resampled to new dimensions (nearest-neighbour for terrainType)'] },
                      { title: 'scmap-pack',
                        desc: 'Reads the modified layer files and repackages them into the .scmap binary format, overwriting the original file.',
                        features: ['Writes all layer sections in the correct binary order', 'Updates internal size header to the new grid dimension', 'Overwrites the original .scmap file in place', 'Temp folder cleaned up after successful pack'] },
                      { title: 'mr-scale-save-lua',
                        desc: "Parses and rewrites the map's _save.lua — multiplying all VECTOR3 marker positions and RECTANGLE area coordinates by the factor.",
                        features: ["Pattern matched: ['position'] = VECTOR3( X, Y, Z )", 'All three components (X, Y, Z) multiplied by factor — Y must scale to match the rescaled heightmap', 'Pattern matched: RECTANGLE( x1, y1, x2, y2 ) — all four values multiplied', 'File written back in place preserving all other Lua structure'] },
                      { title: 'mr-update-scenario-lua',
                        desc: "Updates the map's _scenario.lua with new size metadata and scales norush radii.",
                        features: ['size = { N, N } updated to { toSize, toSize }', 'All norushradius values multiplied by factor', 'No other scenario settings modified', 'Required for FA to correctly report map size in lobby'] },
                    ].map(({ title, desc, features }) => (
                      <div key={title} className="help-adv-card">
                        <div className="help-adv-card-header">
                          <div className="help-adv-code-label" style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)', padding: 0, background: 'none', border: 'none', letterSpacing: '0.04em' }}>{title}</div>
                        </div>
                        <div className="help-adv-card-body">
                          <p className="help-adv-card-desc">{desc}</p>
                          <ul className="help-adv-card-features">{features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── SCMAP FORMAT ─── */}
              {activeAdvSubTab === 'scmap' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">.scmap Binary Format</h2>
                    <p className="help-adv-hero-desc">
                      The .scmap is Supreme Commander's proprietary map binary. It stores all terrain, decoration and lighting data in a
                      single file using a section-based layout. Understanding this format explains what gets scaled and why.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase" style={{ minWidth: 200 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: 'rgba(0,221,255,0.65)', lineHeight: 1.9 }}>
                      {['[header — 4 bytes magic]', '[heightmap — 16-bit raw]', '[texture layers — DDS]', '[normal maps — DDS]', '[water layers — raw]', '[props — split .lua files]', '[decals — split .lua files]'].map(s => <div key={s}>{s}</div>)}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Section Reference</h3>
                  <div className="help-adv-card-grid">
                    {[
                      { title: 'Heightmap',
                        desc: '16-bit unsigned integer raster. One sample per terrain tile. Defines absolute terrain elevation across the playable grid.',
                        features: ['Format: 16-bit LE, (size+1) x (size+1) samples', 'Range: 0–65535 mapped to game units vertically', 'On resize: bilinearly resampled to (newSize+1) x (newSize+1)', 'Without sharp: pure-JS bilinear resampler used as fallback'] },
                      { title: 'Texture Layers (Albedo)',
                        desc: 'Up to 10 terrain texture layer slots stored as DDS inside the binary. Each layer tiles independently across the heightmap.',
                        features: ['Format: DDS DXT1/5 per layer', 'Tile frequency set in data.lua normals[]/textures[] — not in .scmap itself', 'On resize: DDS pixel data bilinearly resampled if sharp is available', 'Scale Terrain Tex adjusts data.lua tile sizes independently'] },
                      { title: 'Normal Map Layers',
                        desc: 'Per-layer tangent-space normal maps used by the terrain shader for micro-surface detail.',
                        features: ['Format: DDS DXT5 per layer', 'Same tile frequency as the corresponding albedo layer', 'Resampled on resize identically to albedo layers', 'Not user-editable through the tool — internal pipeline only'] },
                      { title: 'Water / Wave / Foam',
                        desc: 'Binary sections defining water surface rendering parameters and per-pixel wave pattern data.',
                        features: ['waterMap.dds — per-tile water visibility mask', 'waterFoamMask.raw, waterFlatness.raw, waterDepthBias.raw — uint8 rasters at size/2', 'All water rasters bilinearly resampled to new dimensions', 'Water surface elevation value preserved as-is'] },
                      { title: 'Props',
                        desc: 'Prop placements stored as split Lua files (props.lua, props1.lua, …). Each entry stores position, rotation direction vectors, and per-prop mesh scale.',
                        features: ['Position X, Y, Z: all three multiplied by factor (if Scale Props enabled)', 'Rotation (rotationX, rotationY, rotationZ): unit direction vectors — not scaled', 'Per-prop mesh scale field: not scaled', 'Blueprint path string: unchanged — same game assets used'] },
                      { title: 'Decals',
                        desc: 'Decal placements stored as split Lua files (decals.lua, decals1.lua, …). Each entry stores position, rotation, and footprint scale.',
                        features: ['Position X, Y, Z: all three multiplied by factor (if Scale Decals enabled)', 'scale[1] footprint width: multiplied by factor', 'scale[3] footprint depth: multiplied by factor', 'scale[2] vertical projection depth: not scaled', 'Rotation (Y-axis radians): not scaled'] },
                    ].map(({ title, desc, features }) => (
                      <div key={title} className="help-adv-card">
                        <div className="help-adv-card-header">
                          <h4>{title}</h4>
                        </div>
                        <div className="help-adv-card-body">
                          <p className="help-adv-card-desc">{desc}</p>
                          <ul className="help-adv-card-features">{features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── LUA FILES ─── */}
              {activeAdvSubTab === 'luafiles' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Lua File Reference</h2>
                    <p className="help-adv-hero-desc">
                      FA maps use three Lua files alongside the .scmap binary. The resizer rewrites coordinate and size data in all three.
                      Understanding what each file stores explains what the Lua scale options do and which fields are actually patched.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase" style={{ minWidth: 220 }}>
                    <div className="help-adv-file-tree">
                      <div className="help-adv-file-tree-header">map folder</div>
                      {[
                        { cls: 'highlight', name: '_save.lua',     badge: 'VECTOR3 + RECT scaled' },
                        { cls: 'highlight', name: 'data.lua',      badge: 'tex + skybox + fog'    },
                        { cls: 'highlight', name: '_scenario.lua', badge: 'size + norushradius'   },
                        { cls: 'file',      name: 'map.scmap',     badge: 'binary — separate step'},
                      ].map(({ cls, name, badge }) => (
                        <div key={name} className={`help-adv-file-item ${cls}`}>
                          <span>{name}</span>
                          <span className="help-adv-file-badge">{badge}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>_save.lua — Markers and Areas</h3>
                  <div className="help-adv-card-grid">
                    {[
                      { title: 'VECTOR3 Markers',
                        desc: "All named position markers stored as three-component vectors. Multiplied by factor when Scale Markers is enabled.",
                        features: ["Pattern: ['position'] = VECTOR3( X, Y, Z )", 'X, Y, Z all multiplied by factor', 'Y must scale alongside X/Z — markers would sit below the raised heightmap otherwise', 'Includes: spawn positions, mass extractors, hydros, waypoints, camera positions'] },
                      { title: 'RECTANGLE Areas',
                        desc: "Named rectangular trigger areas defined by four corner coordinates. All four values multiplied by factor when Scale Areas is enabled.",
                        features: ['Pattern: RECTANGLE( x1, y1, x2, y2 )', 'All four corner coordinates multiplied by factor', 'Includes: AREA_1 play boundary, spawn exclusion zones, scripted trigger regions', 'Values written with 2 decimal places'] },
                    ].map(({ title, desc, features }) => (
                      <div key={title} className="help-adv-card">
                        <div className="help-adv-card-header"><h4>{title}</h4></div>
                        <div className="help-adv-card-body">
                          <p className="help-adv-card-desc">{desc}</p>
                          <ul className="help-adv-card-features">{features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h3 className="help-adv-section-header" style={{ marginTop: 40 }}><span className="help-adv-section-num">2</span>data.lua — Terrain, Skybox, Fog</h3>
                  <div className="help-adv-card-grid">
                    {[
                      { title: 'Terrain Texture Tile Sizes',
                        desc: 'Each terrain layer has an independent tile scale controlling how often the texture repeats. Scaled when Scale Terrain Tex / Normals is enabled.',
                        features: ['Fields: normals[N].scale and textures[N].scale', 'Formula: new_scale = old_scale × factor', 'Entries with scale = 0 preserved unchanged (disabled layers)', 'mapinfo.dds / mapnormal.dds: set to toSize + 1 (map-resolution textures, not tile-frequency)', 'Operated on via regex directly on the Lua string — avoids floating-point serialisation loss'] },
                      { title: 'Skybox Parameters',
                        desc: 'Atmospheric dome parameters adjusted proportionally when Scale Skybox is enabled.',
                        features: ['skyBox.scale = toSize × 2.288245  (dome radius)', 'skyBox.position = { toSize/2, 0, toSize/2 }  (centred)', 'horizonHeight and zenithHeight × factor', 'cirrusLayers frequency x/y ÷ factor  (cloud density preserved)', 'cirrusLayers speed × factor  (drift speed preserved)'] },
                      { title: 'Fog of War',
                        desc: 'World-unit distances at which the fog gradient begins and ends. Scaled when Scale Fog of War is enabled.',
                        features: ['fogStart × factor  (0 stays 0)', 'fogEnd × factor', 'Example: fogEnd 150 on a x4 resize becomes 600', 'Both values written with 4 decimal places'] },
                    ].map(({ title, desc, features }) => (
                      <div key={title} className="help-adv-card">
                        <div className="help-adv-card-header"><h4>{title}</h4></div>
                        <div className="help-adv-card-body">
                          <p className="help-adv-card-desc">{desc}</p>
                          <ul className="help-adv-card-features">{features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="help-adv-note" style={{ marginTop: 0 }}>
                    <strong>_scenario.lua</strong> is updated in the final pipeline step — size = {'{ toSize, toSize }'} is rewritten and all norushradius values are multiplied by factor. No other scenario settings are modified.
                  </div>
                </div>
              </>)}

              {/* ─── SCALE OPTIONS ─── */}
              {activeAdvSubTab === 'options' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Scale Option Deep Dive</h2>
                    <p className="help-adv-hero-desc">
                      Every scale option maps directly to a specific data section. Understanding which option affects which file and field
                      helps you make informed choices about what to enable or disable for a given resize goal.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase" style={{ minWidth: 200 }}>
                    <div className="help-adv-code-sample">
                      <div className="help-adv-code-label">option → file → field</div>
                      <pre>{`Props       → props*.lua   → position\nDecals      → decals*.lua  → position, scale\nMarkers     → _save.lua    → VECTOR3\nAreas       → _save.lua    → RECTANGLE\nTex/Normals → data.lua     → .scale\nSkybox      → data.lua     → skyBox.*\nFog         → data.lua     → fogStart, fogEnd`}</pre>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>What Happens When Each Option Is Off?</h3>
                  <div className="help-adv-ts-grid">
                    {[
                      { label: 'Scale Props',
                        a: 'All prop placements stay at their original grid coordinates. On a x2 upscale the props will be clustered in the bottom-left quarter of the new map. Re-enable and re-run, or reposition manually in the FA editor.' },
                      { label: 'Scale Decals',
                        a: 'Decals stay at original positions and their painted footprint scale is not adjusted. Roads, craters and markings appear at original density and position — visually misaligned at the new map size.' },
                      { label: 'Scale Markers',
                        a: 'Spawn points, mass extractors and hydros remain at the old coordinates — clustered near one edge of the new map. Almost always undesired. Only disable if you plan to manually place all markers afterwards.' },
                      { label: 'Scale Areas',
                        a: 'Named trigger rectangles remain at old dimensions. Triggers fire at incorrect positions, and the play-area boundary may not encompass the new map size.' },
                      { label: 'Scale Terrain Tex / Normals',
                        a: 'Texture tile frequencies stay at old world-unit values. On an upscale the terrain textures appear stretched and low-density. Disable intentionally if you want a coarser texture look at the larger size.' },
                      { label: 'Scale Skybox',
                        a: 'The skybox dome stays at old dimensions — it appears undersized and the horizon line sits at the wrong height relative to the terrain. Disable only if you intend to fully hand-tune the atmosphere after the resize.' },
                      { label: 'Scale Fog of War',
                        a: 'fogStart and fogEnd stay at old world-unit values. On a large map this creates very short sight lines. Disable intentionally for maps where tight visibility is a design goal.' },
                    ].map(({ label, a }) => (
                      <div key={label} className="help-adv-ts-item">
                        <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: '#00DDFF' }}>{label} — what happens when OFF?</strong></div>
                        <div className="help-adv-ts-a"><p>{a}</p></div>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note">
                    <strong>Rule of thumb: </strong>Leave all options enabled for a clean full-map resize. Disable individual options only when you have a specific post-resize plan for that data section.
                  </div>
                </div>
              </>)}

            </div>
          )}{/* end advanced */}

        </div>{/* end help-modal-content */}
      </div>{/* end help-modal */}
    </>
  );
}

export default MapResizerHelpModal;
