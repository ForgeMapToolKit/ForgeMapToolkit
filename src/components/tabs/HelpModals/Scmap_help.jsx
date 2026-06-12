import React from "react";

const SCMAP_COLOR       = '#FFFA00';
const SCMAP_GLOW        = 'rgba(255,250,0,0.35)';
const SCMAP_GLOW_STRONG = 'rgba(255,250,0,0.6)';

const SCMAP_HELP_TABS = [
  { id: 'main',     label: '⬡ Interface Guide' },
  { id: 'advanced', label: '⚙ Advanced Guide'  },
];

// ════════════════════════════════════════════════════════════════════════════
const SCMAP_INFO = {

  // ── UNPACK side ───────────────────────────────────────────────────────────
  credits: {
    title: 'Credits — BrewMapTool',
    desc: 'The SCMAP Tool is built on top of BrewMapTool by The-Balthazar, an open-source Supreme Commander map binary parser and writer. All binary read/write logic in scmap.js originates from that project.',
    details: [
      ['Original project', 'github.com/The-Balthazar/BrewMapTool'],
      ['Author',           'The-Balthazar'],
      ['Integration',      'Wrapped into ForgeMapToolkit as an IPC-backed tool'],
    ],
    tip: 'If you encounter a .scmap the tool cannot parse, check if BrewMapTool itself can handle it — the upstream project may have received updates.',
  },
  popout: {
    title: 'Pop Out Window',
    desc: 'Opens the SCMAP Tool in a compact floating window that can be positioned independently of the main toolkit. The pop-out supports the full unpack/pack cycle including drag-and-drop.',
    details: [
      ['Drop .scmap',       'Triggers unpack automatically — same as the main tab'],
      ['Drop folder',       'Triggers pack immediately — output lands in packed/ next to source folder'],
      ['Right-click zone',  'Opens a folder picker for pack (alternative to drag-and-drop)'],
      ['Separate window',   'Runs alongside the main toolkit — useful on a second monitor'],
    ],
    tip: 'Use the pop-out on a second monitor while editing the map in the FA editor. Drop folder → pack → check in FA without switching windows.',
  },
  filedrop: {
    title: 'File Drop Zone — Unpack',
    desc: 'The primary drop target for .scmap files. Clicking opens the OS file browser. Dropping a file here loads it as the unpack source without triggering the unpack — click the Unpack button to start.',
    details: [
      ['Accepts',      '.scmap files only'],
      ['Click',        'Opens file browser (showOpenDialog filtered to .scmap)'],
      ['Drop',         'Loads the file path — then click Unpack'],
      ['Auto-unpack',  'Dropping a file anywhere on the tab (not just here) triggers unpack immediately without clicking'],
    ],
    tip: 'Drop a .scmap anywhere on the tab for the fastest path — no button click needed.',
  },
  pathdisplay: {
    title: 'Output Path Preview',
    desc: 'Shows where the extracted files will land. The path is derived from the source filename: public/scmap/<filename-without-extension>.scmap/',
    details: [
      ['Format',    'public/scmap/<name>.scmap/'],
      ['Created',   'Automatically on first unpack — folder does not need to pre-exist'],
      ['Overwrite', 'Re-unpacking the same file overwrites the folder contents cleanly'],
    ],
    tip: 'The folder name always includes .scmap — so a file called kaali.scmap extracts to a folder called kaali.scmap/ (not kaali/).',
  },
  unpackbtn: {
    title: 'Unpack Button',
    desc: 'Starts the binary extraction. Reads the .scmap file, parses all embedded data blocks (heightmap, normal map, albedo, watermap, etc.) and writes each as a named file to the output folder.',
    details: [
      ['Disabled',     'Until a .scmap file is selected'],
      ['Running',      'Shows spinning ⟳ icon — button disabled during extraction'],
      ['Re-run label', 'After a successful unpack the label changes to "↺ Unpack Again"'],
      ['Auto-open',    'If autoOpenExportFolder is enabled in Settings, opens the output folder in Explorer after completion'],
    ],
    tip: 'The unpack is non-destructive: original .scmap is never modified. Only the output folder is written.',
  },
  unpacklog: {
    title: 'Unpack Log',
    desc: 'Real-time output from the extraction process. Each line corresponds to a progress event emitted via the scmap-progress IPC channel as scmap.js processes the binary.',
    details: [
      ['Green ✓',  'Unpack succeeded — output folder path printed'],
      ['Red ✗',    'Extraction failed — error message from Node.js printed'],
      ['Info lines', 'Progress from scmap.js as each block is parsed'],
      ['Auto-scroll', 'Log scrolls to the bottom automatically as lines arrive'],
    ],
    tip: 'If the log ends with an error, check that the .scmap is a valid SC/FA map binary — files from mods or other games may use different formats.',
  },

  // ── PACK side ─────────────────────────────────────────────────────────────
  maplist: {
    title: 'Unpacked Maps List',
    desc: 'Shows all subdirectories found in public/scmap/ at the time the tab loaded (or after the last Refresh). Each entry was created by a previous unpack run.',
    details: [
      ['Sorted',     'Newest first — by folder modification time (mtime)'],
      ['Refresh',    '↺ button re-reads the directory. External changes are not watched live'],
      ['Date stamp', 'Shown next to each map name — the mtime of the folder'],
      ['Count badge', 'Shows total number of maps found'],
    ],
    tip: 'After unpacking a map the list refreshes automatically. Use the Refresh button if you move or rename folders externally.',
  },
  packbtn: {
    title: 'Pack Button (per-map)',
    desc: 'Triggers the binary assembly for that specific map folder. Calls the scmap-pack IPC handler, which reads all files in the folder (excluding _origin.json), assembles the .scmap binary using scmap.js writeDatastream(), and writes the result.',
    details: [
      ['Primary output',    'public/scmap/packed/<mapname>.scmap'],
      ['Copy-back',         'If mapsFolder is set in Settings, also copies to the matching versioned folder in the game maps directory'],
      ['Disabled state',    'Disabled while any pack is already running (one at a time)'],
      ['Running label',     'Shows ⟳ Packing… on the active row only'],
    ],
    tip: 'Re-packing is always safe. The output file is overwritten cleanly on every run.',
  },
  packoutput: {
    title: 'Output Path Display',
    desc: 'Shows the target directory for packed output. Always public/scmap/packed/ — not configurable. This prevents the EISDIR error that occurs when output resolves to the source folder itself.',
    details: [
      ['Path',    'public/scmap/packed/'],
      ['Created', 'Automatically if it does not exist (mkdirSync recursive)'],
      ['Conflict','Output path is always a file, never collides with the source folder'],
    ],
    tip: 'If you want the .scmap in a different location, use the pop-out window which lets you place output next to the source — but note the pop-out also writes to packed/ to avoid EISDIR.',
  },
  packlog: {
    title: 'Pack Log',
    desc: 'Output from the most recent pack operation. Persists between packs until the next one starts.',
    details: [
      ['Green ✓',  'Pack succeeded — output path and file size (in KB) shown'],
      ['Green ✓ (copy-back)', 'If copy-back happened, a second ✓ line shows the game folder path'],
      ['Red ✗',    'Pack failed — error message printed'],
      ['Small file', 'A very small result (< 1 KB) means the folder was empty or only had _origin.json'],
    ],
    tip: 'After a successful pack, check the file size in the log. If it is suspiciously small, open the output folder and verify the extracted files are all present.',
  },
};

function ScmapInfoPanel({ sel }) {
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
                <strong style={{ color: SCMAP_COLOR, minWidth: '140px', flexShrink: 0 }}>{label}:</strong>
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

function Sel({ id, sel, setSel, children, style, className }) {
  const active = sel === id;
  return (
    <div
      className={className}
      onClick={e => { e.stopPropagation(); setSel(active ? null : id); }}
      style={{
        cursor: 'pointer',
        outline: active ? `2px solid ${SCMAP_COLOR}` : '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: active ? `0 0 18px ${SCMAP_GLOW}` : 'none',
        transition: 'outline 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >{children}</div>
  );
}

function ScmapHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {
  const sel = SCMAP_INFO[helpSelected] ?? null;

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div
        className="help-modal"
        style={{ '--tab-color': SCMAP_COLOR, '--tab-glow': SCMAP_GLOW, '--tab-glow-strong': SCMAP_GLOW_STRONG }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">⬡ SCMAP Tool — Help Guide</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Tab bar ── */}
        <div className="help-modal-tabs">
          {SCMAP_HELP_TABS.map(t => (
            <button
              key={t.id}
              className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>

        <div className="help-modal-content">

          {/* ══════════════ MAIN TAB — 1:1 UI replica ══════════════ */}
          {activeTab === 'main' && (
            <div style={{ display: 'flex', gap: '40px', height: '100%' }}>

              {/* Left: scrollable 1:1 replica */}
              <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Click any element to learn about it
                </div>

                {/* ── replicate scmap-tab structure ── */}
                <div style={{ width: '760px' }}>

                  {/* Header bar */}
                  <div className="scmap-header-bar">
                    <div className="scmap-header-title">
                      <span className="scmap-header-icon">⬡</span>
                      SCMAP TOOL
                    </div>
                  </div>

                  {/* Credits bar */}
                  <Sel id="credits" sel={helpSelected} setSel={setHelpSelected}>
                    <div className="scmap-credits-bar" style={{ pointerEvents: 'none' }}>
                      <span className="scmap-credits-label">Based on</span>
                      <span className="scmap-credits-link">
                        <span className="scmap-credits-link-icon">↗</span>BrewMapTool
                      </span>
                      <span className="scmap-credits-sep"></span>
                      <span className="scmap-credits-label">by</span>
                      <span className="scmap-credits-link">
                        <span className="scmap-credits-link-icon">↗</span>The-Balthazar
                      </span>
                    </div>
                  </Sel>

                  {/* Popout row */}
                  <Sel id="popout" sel={helpSelected} setSel={setHelpSelected}>
                    <div className="scmap-popout-row" style={{ pointerEvents: 'none' }}>
                      <button className="scmap-popout-btn" style={{ pointerEvents: 'none' }}>
                        <span>⧉</span> POP OUT
                      </button>
                    </div>
                  </Sel>

                  {/* 2-col grid */}
                  <div className="scmap-content-grid">

                    {/* ── LEFT: UNPACK ── */}
                    <div>
                      <div className="scmap-section-card">
                        <div className="scmap-section-title">
                          <span className="scmap-section-icon">⬇</span>
                          Unpack
                        </div>
                        <p className="scmap-section-description">
                          Extract a .scmap binary into editable source files.
                        </p>
                        <hr className="scmap-divider" />

                        {/* File drop zone */}
                        <Sel id="filedrop" sel={helpSelected} setSel={setHelpSelected}>
                          <div className="scmap-file-drop" style={{ pointerEvents: 'none' }}>
                            <div className="scmap-file-drop-icon">⬇</div>
                            <div className="scmap-file-drop-label">DROP .SCMAP HERE</div>
                            <div className="scmap-file-drop-hint">or click to browse</div>
                          </div>
                        </Sel>

                        {/* Path display */}
                        <Sel id="pathdisplay" sel={helpSelected} setSel={setHelpSelected} style={{ marginBottom: 18, marginTop: 8 }}>
                          <div className="scmap-path-display">
                            public/scmap/<span>kaali.scmap</span>/
                          </div>
                        </Sel>

                        {/* Unpack button */}
                        <Sel id="unpackbtn" sel={helpSelected} setSel={setHelpSelected}>
                          <button className="scmap-btn-primary" style={{ pointerEvents: 'none', width: '100%' }}>
                            ⬇ Unpack
                          </button>
                        </Sel>

                        {/* Log */}
                        <Sel id="unpacklog" sel={helpSelected} setSel={setHelpSelected} style={{ marginTop: 12 }}>
                          <div className="scmap-log" style={{ pointerEvents: 'none' }}>
                            <div className="scmap-log-line-info">Unpacking: C:\maps\kaali.scmap</div>
                            <div className="scmap-log-line-info">Writing heightmap (512×512)…</div>
                            <div className="scmap-log-line-info">Writing albedo layer…</div>
                            <div className="scmap-log-line-ok">✓ Done → public/scmap/kaali.scmap/</div>
                          </div>
                        </Sel>
                      </div>
                    </div>

                    {/* ── RIGHT: PACK ── */}
                    <div>
                      <div className="scmap-section-card">
                        <div className="scmap-section-title">
                          <span className="scmap-section-icon">⬆</span>
                          Pack
                        </div>
                        <p className="scmap-section-description">
                          Repack an extracted map folder back into a .scmap binary.
                        </p>
                        <hr className="scmap-divider" />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <label className="scmap-form-label" style={{ margin: 0 }}>
                            Unpacked Maps
                            <span className="scmap-map-count">3</span>
                          </label>
                          <button className="scmap-btn-secondary" style={{ pointerEvents: 'none' }}>↺ Refresh</button>
                        </div>

                        {/* Map list */}
                        <Sel id="maplist" sel={helpSelected} setSel={setHelpSelected}>
                          <div className="scmap-map-list" style={{ pointerEvents: 'none' }}>
                            {[
                              { name: 'kaali.scmap',         mtime: Date.now() - 1000 * 60 * 5 },
                              { name: 'dust_valley.scmap',   mtime: Date.now() - 1000 * 60 * 60 * 2 },
                              { name: 'twin_rivers.scmap',   mtime: Date.now() - 1000 * 60 * 60 * 24 },
                            ].map(({ name, mtime }) => {
                              const d = new Date(mtime);
                              const dateStr = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                                + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                              return (
                                <div className="scmap-map-item" key={name}>
                                  <div className="scmap-map-item-info">
                                    <span className="scmap-map-item-name">{name}</span>
                                    <span className="scmap-map-item-date">{dateStr}</span>
                                  </div>
                                  <Sel id="packbtn" sel={helpSelected} setSel={setHelpSelected} onClick={e => e.stopPropagation()}>
                                    <button className="scmap-btn-secondary" style={{ pointerEvents: 'none' }}>⬆ Pack</button>
                                  </Sel>
                                </div>
                              );
                            })}
                          </div>
                        </Sel>

                        {/* Output path display */}
                        <Sel id="packoutput" sel={helpSelected} setSel={setHelpSelected} style={{ marginTop: '14px' }}>
                          <div className="scmap-path-display" style={{ pointerEvents: 'none' }}>
                            Output → <span>public/scmap/packed/</span>
                          </div>
                        </Sel>

                        {/* Pack log */}
                        <Sel id="packlog" sel={helpSelected} setSel={setHelpSelected} style={{ marginTop: 12 }}>
                          <div className="scmap-log" style={{ pointerEvents: 'none' }}>
                            <div className="scmap-log-line-info">Packing: kaali.scmap</div>
                            <div className="scmap-log-line-ok">✓ Written: …/packed/kaali.scmap (842.3 KB)</div>
                            <div className="scmap-log-line-ok">✓ Copied back → …/kaali.v0001/kaali.scmap</div>
                          </div>
                        </Sel>
                      </div>
                    </div>

                  </div>{/* end scmap-content-grid */}
                </div>{/* end 760px wrapper */}
              </div>{/* end left scrollable area */}

              {/* Right: explanation panel */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: SCMAP_COLOR }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: '260px', lineHeight: 1.7 }}>
                      Click any field, button, or section on the left to learn what it does.
                    </div>
                  </div>
                ) : sel ? (
                  <ScmapInfoPanel sel={sel} />
                ) : null}
              </div>

            </div>
          )}

          {/* ══════════════ ADVANCED GUIDE TAB ══════════════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">
              <div className="help-adv-subtabs">
                {[
                  { id: 'workflow',     label: 'Workflow'         },
                  { id: 'files',        label: 'Extracted Files'  },
                  { id: 'editing',      label: 'Editing Guide'    },
                  { id: 'copyback',     label: 'Copy-back'        },
                  { id: 'troubleshoot', label: 'Troubleshooting'  },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveAdvSubTab(t.id)}
                  >{t.label}</button>
                ))}
              </div>

              {/* ─── WORKFLOW ─── */}

              {/* ─── WORKFLOW ─── */}
              {activeAdvSubTab === 'workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">The complete edit cycle</h2>
                    <p className="help-adv-hero-desc">
                      Everything you need to take a map from binary to edited and back into the game. The SCMAP Tool handles all the file work — you only need to know what to edit and where it ends up.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      {['1. Drop .scmap onto the tab', '2. Files appear in public/scmap/', '3. Edit what you want', '4. Click ⬆ Pack', '5. Game loads the updated map'].map((s, i) => (
                        <div key={s} style={{ padding: '6px 12px', background: `rgba(255,250,0,${0.03 + i * 0.025})`, border: '1px solid rgba(255,250,0,0.18)', fontSize: '0.72rem', color: SCMAP_COLOR, letterSpacing: '0.06em', fontFamily: 'monospace' }}>{s}</div>
                      ))}
                    </div>
                    <div className="help-adv-button-hint">5 steps, full cycle</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Step by step</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'Get the .scmap file', desc: 'Your map\'s .scmap lives inside a versioned subfolder in your FA maps directory. Drop it straight onto the tool from Explorer — no need to copy it anywhere first.', subs: ['Typical path: …\\maps\\kaali.v0001\\kaali.scmap', 'Community maps downloaded via FAF are in the same location after install', 'The original file is never modified — the tool only reads it during unpack'] },
                      { n: '02', title: 'Drop it onto the tab', desc: 'Drag the .scmap anywhere on the SCMAP Tool tab — not just the drop zone, the whole panel works. Unpack starts instantly, no button click needed.', subs: ['You can also click the drop zone to browse for the file', 'Watch the log — each file is listed as it gets extracted', 'Green ✓ Done = all files are on disk and ready to edit', 'If autoOpenExportFolder is on in Settings, Explorer opens the output folder automatically'] },
                      { n: '03', title: 'Edit the extracted files', desc: 'Open the output folder (ForgeMapToolkit/public/scmap/kaali.scmap/) and edit what you need. See the Extracted Files and Editing Guide tabs for a full breakdown of what each file controls.', subs: ['The folder stays until you delete it — edit and re-pack as many times as needed', 'Multiple maps can be unpacked at the same time — each gets its own subfolder', 'Do NOT rename or move the folder — the Pack list uses the folder name to find it', 'Do NOT delete _origin.json — it is needed for automatic copy-back'] },
                      { n: '04', title: 'Pack it back', desc: 'Find your map in the Pack list and click ⬆ Pack. The tool reassembles all files into a .scmap binary and saves it to public/scmap/packed/. With copy-back configured it also writes directly into your game maps folder automatically.', subs: ['Re-packing always overwrites the previous packed file — it is always safe to re-run', 'Check the file size in the log — a valid .scmap is usually several hundred KB to a few MB', 'A result of only a few KB means something went wrong — check the Troubleshooting tab', 'If the map is missing from the list, click ↺ Refresh'] },
                      { n: '05', title: 'Load in FA', desc: 'If copy-back is configured the updated .scmap is already in place — load the map in FA. Without copy-back, manually copy the packed file from public/scmap/packed/ into your map\'s versioned folder.', subs: ['In the FA map editor: File → Reload or close and reopen the map', 'In a lobby: map data is loaded fresh each time, no cache to clear', 'If the map looks unchanged, verify you replaced the right .scmap file'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul style={{ margin: '10px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {s.subs.map((sub, i) => <li key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6 }}>{sub}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Pop-out for fast iteration</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                    {[
                      { color: SCMAP_COLOR,             icon: '📄', title: 'Drop a .scmap', desc: 'Unpacks immediately — same as dropping on the main tab.' },
                      { color: 'rgba(100,200,255,0.85)', icon: '📁', title: 'Drop an unpacked folder', desc: 'Packs immediately. Output goes to packed/ next to the dropped folder.' },
                      { color: 'rgba(255,255,255,0.35)', icon: '🖱',  title: 'Right-click the zone', desc: 'Opens a folder picker if drag-and-drop doesn\'t work on your system.' },
                      { color: 'rgba(255,255,255,0.35)', icon: '🖥',  title: 'Two-monitor setup', desc: 'Pop-out on monitor 2, FA editor on monitor 1. Edit → save → drop folder to pop-out → reload in FA. No alt-tabbing.' },
                    ].map(p => (
                      <div key={p.title} style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${p.color}25`, borderLeft: `3px solid ${p.color}` }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{p.icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.85rem', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>{p.title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['⬡', 'Back up your original .scmap first', 'The tool never modifies the source file during unpack. But once you pack and copy-back, the game .scmap is overwritten. Keep a backup before your first edit session.'],
                      ['⬡', 'Only edit the files you need to change', 'Every file in the extracted folder gets re-packed. Leave files you are not changing exactly as extracted.'],
                      ['⬡', 'Don\'t rename the extracted folder', 'The Pack list identifies maps by folder name. Renaming it means it disappears from the list and the output path breaks.'],
                      ['⬡', 'Check the pack log file size', 'A valid .scmap is usually 200 KB to several MB. If the log shows only a few KB, the folder was nearly empty — re-unpack and check what files are present.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── EXTRACTED FILES ─── */}
              {activeAdvSubTab === 'files' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">What gets extracted</h2>
                    <p className="help-adv-hero-desc">
                      When you unpack a .scmap the tool splits the binary into individual files — one per data layer.
                      Each file controls a different aspect of how the map looks and behaves.
                    </p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>File overview</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {[
                      { file: '_heightmap.raw', badge: 'terrain shape', badgeColor: SCMAP_COLOR, safe: true, desc: 'Controls the actual terrain elevation — every hill, valley, cliff, and flat. A raw 16-bit grayscale image where brighter = higher elevation. Editing this changes the physical shape of the ground including collisions.', tool: 'L3DT, World Machine, or any editor that handles 16-bit RAW', note: 'Size is always (mapWidth÷2 + 1) × (mapHeight÷2 + 1) pixels. A 512×512 ogrid map has a 257×257 heightmap. If the file size changes, the map breaks.' },
                      { file: '_normal.dds', badge: 'surface lighting', badgeColor: 'rgba(100,200,255,0.85)', safe: true, desc: 'Adds fine lighting detail to the terrain surface — how light bounces off slopes and micro-bumps. Does not change the physical terrain shape, only the visual appearance of the ground.', tool: 'Photoshop + NVIDIA Texture Tools, Paint.NET with DDS plugin', note: 'Usually auto-generated from the heightmap. Editing manually is only needed for surface detail that doesn\'t match terrain shape.' },
                      { file: '_albedo.dds', badge: 'terrain colour', badgeColor: 'rgba(100,200,255,0.85)', safe: true, desc: 'The base colour layer of the terrain visible before stratum textures blend on top. Most visible in the minimap thumbnail and at maximum zoom-out distance in-game.', tool: 'Photoshop, GIMP, Paint.NET — any image editor with DDS support', note: null },
                      { file: '_watermap.dds', badge: 'water mask', badgeColor: 'rgba(100,200,255,0.85)', safe: true, desc: 'Controls where water exists and how deep it is. The red channel marks which areas have water; the green channel encodes depth. Edit this to add or remove water areas without using the FA editor.', tool: 'Photoshop or GIMP — edit R and G channels separately', note: 'Painting red=1 somewhere above water level height will not show water in-game — both the mask AND the terrain elevation need to be correct.' },
                      { file: '_save.lua', badge: 'prop placements', badgeColor: 'rgba(255,200,100,0.8)', safe: true, desc: 'A Lua table containing every prop placed on the map: blueprint path, position, rotation, and scale. Often very large. Remove props by deleting their entries, move them by changing position values.', tool: 'Any text editor (Notepad++, VSCode with Lua extension)', note: null },
                      { file: '_scenario.lua', badge: 'map settings', badgeColor: 'rgba(255,200,100,0.8)', safe: true, desc: 'The map\'s name, description, army start positions, player count, and other lobby-visible metadata. Edit this to change the map name, description, or number of spawn points without opening the FA editor.', tool: 'Any text editor', note: null },
                      { file: '_script.lua', badge: 'game logic', badgeColor: 'rgba(255,200,100,0.8)', safe: true, desc: 'The map\'s script: spawns units, triggers events, defines win/loss conditions. Most skirmish maps have a minimal script here. Custom scenario maps have complex scripts.', tool: 'VSCode or any text editor with Lua support', note: 'Errors in this file crash FA when loading the map. Always test after editing.' },
                      { file: '_preview.dds', badge: 'lobby thumbnail', badgeColor: 'rgba(255,100,100,0.7)', safe: false, desc: 'The minimap thumbnail shown in the game lobby. You can replace it but the new image MUST be the exact same pixel dimensions as the original.', tool: 'Photoshop + DDS plugin. Match exact pixel dimensions of the original.', note: 'If dimensions differ, the binary header will be wrong and FA may refuse to load the map.' },
                      { file: '_origin.json', badge: 'tool metadata', badgeColor: 'rgba(255,255,255,0.25)', safe: false, desc: 'Created by ForgeMapToolkit — not part of the original .scmap. Stores the original file path used for automatic copy-back. Automatically excluded from packing.', tool: 'Do not edit or delete.', note: 'Deleting this file disables copy-back for this map.' },
                    ].map(b => (
                      <div key={b.file} style={{ display: 'flex', gap: '20px', padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${b.safe ? b.badgeColor : 'rgba(255,100,100,0.5)'}` }}>
                        <div style={{ minWidth: '170px', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>{b.file}</div>
                          <div style={{ fontSize: '0.62rem', padding: '2px 7px', background: `${b.badgeColor}18`, border: `1px solid ${b.badgeColor}40`, color: b.badgeColor, letterSpacing: '0.06em', fontWeight: 600, display: 'inline-block', textTransform: 'uppercase', marginBottom: '6px' }}>{b.badge}</div>
                          <div style={{ fontSize: '0.65rem', color: b.safe ? 'rgba(180,255,180,0.55)' : 'rgba(255,120,120,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{b.safe ? '✓ safe to edit' : '⚠ caution'}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: '0 0 10px' }}>{b.desc}</p>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
                            <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Tool: </strong>{b.tool}
                          </div>
                          {b.note && <div style={{ fontSize: '0.78rem', color: 'rgba(255,200,100,0.55)', marginTop: '6px' }}>⚠ {b.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── EDITING GUIDE ─── */}
              {activeAdvSubTab === 'editing' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Editing extracted files</h2>
                    <p className="help-adv-hero-desc">
                      Practical guidance for the most common edits — changing terrain, adjusting water, editing map metadata, and tweaking Lua files. Each section covers what to change and what to watch out for.
                    </p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Editing Lua files</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '20px' }}>
                    The Lua files are plain text — open them in any editor. VSCode with the Lua extension is recommended: it highlights syntax errors before you even try to load the map in FA.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${SCMAP_COLOR}` }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>Changing the map name and description</h4>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.84rem', lineHeight: 1.65, marginBottom: '14px' }}>
                        Open _scenario.lua. The <code style={{ color: SCMAP_COLOR }}>name</code> and <code style={{ color: SCMAP_COLOR }}>description</code> fields are what appear in the lobby.
                      </p>
                      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,250,0,0.15)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, overflowX: 'auto', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ color: 'rgba(255,255,255,0.3)' }}>-- _scenario.lua</div>
                        <div>ScenarioInfo = {'{'}</div>
                        <div style={{ paddingLeft: 20 }}>name = <span style={{ color: SCMAP_COLOR }}>"Kaali Desert"</span>,  <span style={{ color: 'rgba(255,255,255,0.3)' }}>-- shown in lobby</span></div>
                        <div style={{ paddingLeft: 20 }}>description = <span style={{ color: SCMAP_COLOR }}>"2v2 desert warfare on the Kaali crater."</span>,</div>
                        <div style={{ paddingLeft: 20 }}>type = <span style={{ color: SCMAP_COLOR }}>"skirmish"</span>,</div>
                        <div style={{ paddingLeft: 20 }}>size = {'{'} <span style={{ color: 'rgba(255,200,100,0.8)' }}>512</span>, <span style={{ color: 'rgba(255,200,100,0.8)' }}>512</span> {'}'},  <span style={{ color: 'rgba(255,255,255,0.3)' }}>-- in ogrids</span></div>
                        <div style={{ paddingLeft: 20 }}>map = <span style={{ color: SCMAP_COLOR }}>"/maps/kaali.v0001/kaali.scmap"</span>,</div>
                        <div style={{ paddingLeft: 20 }}>save = <span style={{ color: SCMAP_COLOR }}>"/maps/kaali.v0001/kaali_save.lua"</span>,</div>
                        <div style={{ paddingLeft: 20 }}>script = <span style={{ color: SCMAP_COLOR }}>"/maps/kaali.v0001/kaali_script.lua"</span>,</div>
                        <div>{'}'}</div>
                      </div>
                    </div>
                    <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${SCMAP_COLOR}` }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>Moving an army start position</h4>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.84rem', lineHeight: 1.65, marginBottom: '14px' }}>
                        Find the marker named <code style={{ color: SCMAP_COLOR }}>ARMY_1</code>, <code style={{ color: SCMAP_COLOR }}>ARMY_2</code>, etc. in _save.lua and change the position vector. X and Z are the horizontal coordinates — Y (height) is ignored, FA snaps spawns to terrain height automatically.
                      </p>
                      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,250,0,0.15)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, overflowX: 'auto', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ color: 'rgba(255,255,255,0.3)' }}>-- inside _save.lua MasterChain markers</div>
                        <div>['ARMY_1'] = {'{'}</div>
                        <div style={{ paddingLeft: 20 }}>type = <span style={{ color: SCMAP_COLOR }}>'Blank Marker'</span>,</div>
                        <div style={{ paddingLeft: 20 }}>position = VECTOR3( <span style={{ color: SCMAP_COLOR }}>128.5</span>, <span style={{ color: 'rgba(255,255,255,0.35)' }}>0</span>, <span style={{ color: SCMAP_COLOR }}>384.5</span> ),</div>
                        <div style={{ paddingLeft: 20 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>--  X coord ↑      Y (ignored) ↑   Z coord ↑</span></div>
                        <div>{'}'}</div>
                      </div>
                      <div className="help-adv-note" style={{ marginTop: '12px' }}>
                        For a 512×512 map, X and Z values range from 0 to 512. Placing a start at X=0 or X=512 puts it at the very edge — use values between ~20 and ~490 to keep spawns away from the border.
                      </div>
                    </div>
                    <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${SCMAP_COLOR}` }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>Removing a prop</h4>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.84rem', lineHeight: 1.65, marginBottom: '14px' }}>
                        Props are defined inside the <code style={{ color: SCMAP_COLOR }}>Props</code> table in _save.lua. Delete the entire entry including its surrounding braces and trailing comma.
                      </p>
                      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,250,0,0.15)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, overflowX: 'auto', color: 'rgba(255,255,255,0.6)' }}>
                        <div>Props = {'{'}</div>
                        <div style={{ paddingLeft: 20, color: 'rgba(255,100,100,0.6)' }}>{'{'} <span style={{ color: 'rgba(255,100,100,0.4)' }}>-- delete from here</span></div>
                        <div style={{ paddingLeft: 40, color: 'rgba(255,100,100,0.6)' }}>bp = '/env/desert/props/rocks/rock01_prop.bp',</div>
                        <div style={{ paddingLeft: 40, color: 'rgba(255,100,100,0.6)' }}>Transform = {'{'} ... {'}'}</div>
                        <div style={{ paddingLeft: 20, color: 'rgba(255,100,100,0.6)' }}>{'}'}, <span style={{ color: 'rgba(255,100,100,0.4)' }}>-- to here (comma included)</span></div>
                        <div style={{ paddingLeft: 20 }}>{'{'} ... {'}'}, <span style={{ color: 'rgba(255,255,255,0.3)' }}>-- next prop stays</span></div>
                        <div>{'}'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>DDS texture files</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
                    The .dds files are standard DirectDraw Surface images. You need a DDS-capable editor to open them.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {[
                      { name: 'Photoshop', note: 'Best option. Use the free NVIDIA Texture Tools Exporter plugin. Supports all DDS compression formats used by FA.' },
                      { name: 'Paint.NET', note: 'Free. DDS plugin available. Handles all FA texture types correctly. Good for quick edits.' },
                      { name: 'GIMP', note: 'Free. Best for watermap editing — its channel editor lets you modify R and G independently with precision.' },
                    ].map(t => (
                      <div key={t.name} style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <h4 style={{ color: SCMAP_COLOR, fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>{t.name}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>{t.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note">
                    When saving: use DXT1 for images without transparency (albedo, normal), DXT5 for images that use an alpha channel. The heightmap (.raw) is NOT a DDS file — never open it with an image editor expecting DDS format.
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Editing the heightmap (.raw)</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '14px' }}>
                    The heightmap is a raw binary file — no header, just width × height pixels of 16-bit grayscale values. Pixel value 0 = lowest point, 65535 = highest. The exact pixel dimensions depend on the map size.
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,250,0,0.15)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, marginBottom: '16px', color: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>-- Heightmap size formula:</div>
                    <div>pixels = (mapOgrids / 2 + 1) × (mapOgrids / 2 + 1)</div>
                    <div style={{ marginTop: 4 }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>-- Examples:</span></div>
                    <div> 256×256 map  →  129×129  pixels  →  33,282 bytes</div>
                    <div> 512×512 map  →  257×257  pixels  →  132,098 bytes</div>
                    <div>1024×1024 map →  513×513  pixels  →  526,338 bytes</div>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7 }}>
                    To open in Photoshop: File → Open As → Raw, enter the correct width and height, set to 16-bit Grayscale, no header offset.
                    Export back as 16-bit RAW with identical dimensions. If the file size changes even by one byte, the map will be broken after packing.
                  </p>
                </div>
              </>)}

              {/* ─── COPY-BACK ─── */}
              {activeAdvSubTab === 'copyback' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Automatic copy-back</h2>
                    <p className="help-adv-hero-desc">
                      Copy-back means: after packing, the finished .scmap is automatically placed into your game maps folder.
                      Once set up, the entire workflow becomes: pack → reload in FA. No manual file moving needed.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,250,0,0.2)', width: '100%' }}>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Pack log with copy-back enabled</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>
                        <div style={{ color: 'rgba(255,250,0,0.5)' }}>Packing: kaali.scmap</div>
                        <div style={{ color: 'rgba(180,255,180,0.85)' }}>✓ Written: …/packed/kaali.scmap (842 KB)</div>
                        <div style={{ color: 'rgba(180,255,180,0.7)' }}>✓ Copied → …/kaali.v0001/kaali.scmap</div>
                      </div>
                    </div>
                    <div className="help-adv-button-hint">Second ✓ = copy-back succeeded</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Setup</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'Set the Maps Folder in Settings', desc: 'Open Settings and set "Maps Folder" to the root folder that contains all your FA map directories — the folder with the versioned subfolders inside it.', subs: ['Correct: C:\\…\\Forged Alliance\\maps  (the folder containing kaali.v0001/, dust_valley.v0002/, etc.)', 'Wrong: C:\\…\\maps\\kaali.v0001  (don\'t point to a specific map folder)', 'The path must exist and be readable by ForgeMapToolkit'] },
                      { n: '02', title: 'How the tool finds your map', desc: 'When you pack, the tool searches mapsFolder for a versioned subfolder matching your map name. It looks for folders named <mapname>.v0001, .v0002, etc. and picks the highest version number it finds.', subs: ['Example: packing "kaali.scmap" looks for kaali.v0001, kaali.v0002, kaali.v0003 — picks the highest', 'If kaali.v0001 and kaali.v0004 both exist, it copies to kaali.v0004', 'If no matching versioned folder exists, copy-back is silently skipped — the packed file stays in packed/ only'] },
                      { n: '03', title: 'Confirm it worked', desc: 'After packing, check the log. Copy-back shows as a second green ✓ line with the full destination path. One ✓ line = packed only. Two ✓ lines = packed and copied to game folder.', subs: ['✓ Written: …/packed/kaali.scmap   (always present on success)', '✓ Copied → …/kaali.v0001/kaali.scmap   (only if copy-back succeeded)', 'If you see only one ✓ and copy-back should have run: check that mapsFolder is set and the versioned folder exists'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul style={{ margin: '10px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {s.subs.map((sub, i) => <li key={i} style={{ color: sub.startsWith('✓') ? 'rgba(180,255,180,0.55)' : 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6, fontFamily: sub.startsWith('✓') || sub.includes(':  ') ? 'monospace' : 'inherit' }}>{sub}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>What copy-back does NOT do</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {[
                      ['Only the .scmap binary is copied', 'Copy-back replaces the .scmap file only. The other files in your map folder (_save.lua, _scenario.lua, _script.lua, etc.) are separate and are never touched. If you edit those files in the extracted folder, copy them manually into the versioned map folder alongside the .scmap.'],
                      ['Does not create the versioned folder', 'If your map has no versioned folder in mapsFolder (it was deleted, or you are setting up a new map), copy-back will silently skip. Create the folder manually — e.g. kaali.v0001/ — and place your Lua files inside it before expecting copy-back to work.'],
                      ['Copy-back is not reversible', 'Once the game .scmap is overwritten there is no undo. The previous version is gone unless you kept a backup. Always back up before the first pack session.'],
                    ].map(([title, desc]) => (
                      <div key={title} style={{ display: 'flex', gap: '16px', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ color: 'rgba(255,200,100,0.7)', fontSize: '1.1rem', flexShrink: 0, paddingTop: '2px' }}>⚠</div>
                        <div>
                          <h4 style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.85rem', marginBottom: '6px' }}>{title}</h4>
                          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── TROUBLESHOOTING ─── */}
              {activeAdvSubTab === 'troubleshoot' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Something went wrong?</h2>
                    <p className="help-adv-hero-desc">
                      Every common error with a clear cause and an exact fix. Check the unpack or pack log first — the error message usually points to which section applies.
                    </p>
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Unpack problems</h3>
                  {[
                    ['Output folder is empty or only has _origin.json', 'The .scmap file could not be parsed. Either it is corrupted, not a real .scmap file (wrong extension on a different file type), or it is a very old SC1 map that uses an unsupported format version.', 'Check that you dropped the actual .scmap binary and not, for example, a shortcut or a .zip. For old SC1 maps, BrewMapTool directly (github.com/The-Balthazar/BrewMapTool) may have better support for older versions.'],
                    ['Access denied / file is in use', 'FA is still running and has the file locked, or a file sync tool (OneDrive, Dropbox) is syncing the maps folder.', 'Close FA completely before unpacking. If the file is in a OneDrive/Dropbox folder, pause sync first, then unpack.'],
                    ['Unpack completes but log shows errors about individual blocks', 'One or more data blocks inside the .scmap could not be parsed. This can happen with FAF-patched maps that have extended format data the tool does not recognise.', 'The successfully extracted blocks are usable. The ones that failed will be missing from the folder. If you need those specific files, check if FAF\'s own tools can extract them.'],
                  ].map(([q, cause, fix]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: SCMAP_COLOR }}>{q}</strong></div>
                      <div className="help-adv-ts-a">
                        <p style={{ marginBottom: '8px' }}>{cause}</p>
                        <p style={{ color: 'rgba(180,255,180,0.65)' }}><strong>Fix: </strong>{fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Pack problems</h3>
                  {[
                    ['Packed .scmap is only 1–5 KB', 'The extracted folder was empty or nearly empty when the tool tried to pack it. Either the original unpack did not write any files, or you are packing the wrong folder.', 'Open the folder in Explorer and verify the files are there (heightmap, Lua files, DDS files). If it is empty, re-unpack. If you see the files but packing still produces a tiny result, try ↺ Refresh in the pack list and try again.'],
                    ['Map not in the Pack list', 'The pack list is populated at tab load and after each unpack. External folder creation or moves are not detected automatically.', 'Click ↺ Refresh. If the folder still doesn\'t appear, verify it is directly inside public/scmap/ — not inside a subfolder of that directory.'],
                    ['Copy-back does not happen', 'mapsFolder is not set, points to the wrong directory, or no versioned subfolder for this map name exists inside it.', 'Check Settings → Maps Folder. It should be the folder that directly contains all your versioned map directories. If the versioned folder does not exist, create it manually.'],
                  ].map(([q, cause, fix]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: SCMAP_COLOR }}>{q}</strong></div>
                      <div className="help-adv-ts-a">
                        <p style={{ marginBottom: '8px' }}>{cause}</p>
                        <p style={{ color: 'rgba(180,255,180,0.65)' }}><strong>Fix: </strong>{fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>FA loads the map but it looks wrong</h3>
                  {[
                    ['Terrain is completely flat after editing the heightmap', 'The _heightmap.raw was saved with the wrong dimensions or wrong bit depth. The file size must match exactly — if it changes by even one byte the terrain data is misaligned.', 'Re-check the heightmap export settings. Use the formula (mapOgrids÷2 + 1) × (mapOgrids÷2 + 1) to verify dimensions. Export as 16-bit grayscale RAW with no header. Confirm the file size matches the original.'],
                    ['Map looks identical despite editing', 'The packed .scmap was not placed in the correct location, or FA is still loading a different version. Also: you may have edited the files but forgotten to re-pack after saving them.', 'Check the pack log — confirm the file was written and copy-back ran. If copy-back is off, manually confirm you copied packed/kaali.scmap into the versioned map folder. When in doubt, check the file modification date in Explorer.'],
                    ['Props are missing or invisible', 'A blueprint path in _save.lua is wrong (typo, wrong capitalisation, or points to a mod prop that is not installed), or a Lua syntax error caused the entire Props table to fail loading.', 'Open _save.lua and check any entries you added or changed. Blueprint paths must be exact. Capitalisation matters on some systems. As a quick test, undo your changes to the Props table and re-pack — if original props appear, the issue is in your edits.'],
                    ['Game crashes when loading the map', 'A syntax error in one of the Lua files (_save.lua, _scenario.lua, or _script.lua) is preventing FA from loading the map. FA gives a Lua error in the log before crashing.', 'Open the edited Lua file in VSCode with the Lua extension. Look for red underlines — common mistakes are missing commas between table entries, mismatched braces {}, or a stray character. Fix the error, re-pack, and test again.'],
                  ].map(([q, cause, fix]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: SCMAP_COLOR }}>{q}</strong></div>
                      <div className="help-adv-ts-a">
                        <p style={{ marginBottom: '8px' }}>{cause}</p>
                        <p style={{ color: 'rgba(180,255,180,0.65)' }}><strong>Fix: </strong>{fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
export default ScmapHelpModal;
