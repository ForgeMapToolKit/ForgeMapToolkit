import React from "react";
import '../Tools/PreviewImageTab/PreviewImage.css';

// ── PreviewImageHelpModal ──────────────────────────────────────────────────────

const STEPS = [
  { id: 'unpack',  label: 'Unpacking .scmap'                 },
  { id: 'render',  label: 'Rendering preview via Map Editor' },
  { id: 'convert', label: 'Converting PNG → DDS'             },
  { id: 'replace', label: 'Replacing previewImage.dds'       },
  { id: 'pack',    label: 'Repacking .scmap'                 },
];

const RESOLUTIONS = [
  { label: '512 × 512',   w: 512,  h: 512  },
  { label: '1024 × 1024', w: 1024, h: 1024 },
  { label: '2048 × 2048', w: 2048, h: 2048 },
  { label: '4096 × 4096', w: 4096, h: 4096, warn: true },
];

const GUIDE_INFO = {
  mapname: {
    title: 'Map Name',
    desc: 'The exact folder name of your map inside the /maps directory. All preview files are read from and written back to this folder.',
    details: [
      ['Format',         'MapName.vXXXX — e.g. Hades_Dust.v0002'],
      ['Auto-version',   'Omitting .v0001 appends it automatically'],
      ['Case-sensitive', 'FA is strict — match the folder name exactly'],
      ['Impact',         'Wrong name = .scmap not found, generation blocked'],
    ],
    tip: 'Copy the folder name directly from File Explorer to avoid typos.',
  },
  resolution: {
    title: 'Render Resolution',
    desc: 'Controls the pixel dimensions the Map Editor renders at. Higher resolutions produce sharper lobby previews but take longer to render and convert.',
    details: [
      ['512 × 512',   'Fast — suitable for quick iteration'],
      ['1024 × 1024', 'Recommended — good quality, fast render'],
      ['2048 × 2048', 'High quality — noticeable render time increase'],
      ['4096 × 4096', 'Maximum — causes a brief freeze and RAM spike during lobby loading; use with caution'],
    ],
    tip: '1024 × 1024 is the best balance between quality and performance for most maps.',
  },
  pipeline: {
    title: 'Pipeline',
    desc: 'Shows the five sequential steps the tool runs when generating a preview. Each step must succeed before the next begins.',
    details: [
      ['Pending',  'Step not yet started — shown as step number'],
      ['Running',  'Step currently executing — shown with spinner'],
      ['Done',     'Step completed successfully — shown with checkmark'],
      ['Error',    'Step failed — shown with cross; pipeline halts'],
    ],
    tip: 'If a step fails, the error message below the pipeline tells you exactly which step and why.',
  },
  generatebtn: {
    title: 'Generate Preview',
    desc: 'Validates inputs then runs the full five-step pipeline: unpack → render → convert → inject → repack. The .scmap is overwritten in place with the new preview image.',
    details: [
      ['Requires',     'Map Name set + editor path configured in Settings'],
      ['In-place',     'Overwrites the previewImage.dds inside the .scmap directly'],
      ['Re-run safe',  'Running again always overwrites cleanly — no leftover files'],
      ['Temp cleanup', 'Unpacked files are removed after a successful repack'],
    ],
    tip: 'The map does not need to be open in the FA editor — the tool reads the .scmap from disk directly.',
  },
};

// ── HelpInfoPanel ──────────────────────────────────────────────────────────────

function HelpInfoPanel({ sel }) {
  if (!sel) return (
    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.88rem', paddingTop: '40px', textAlign: 'center', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      Click any element to learn about it
    </div>
  );
  return (
    <div className="help-adv-layout" style={{ padding: 0, gap: 28 }}>
      <div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          {sel.title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.75, margin: 0 }}>{sel.desc}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sel.details.map(([label, value], i) => (
            <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--tab-color)', minWidth: '120px', flexShrink: 0 }}>{label}:</strong>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="help-adv-note">
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}

function PreviewImageHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected }) {

  const TABS = [
    { id: 'guide',    label: 'Help Guide'    },
    { id: 'advanced', label: 'Advanced Guide' },
  ];

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div
        className="help-modal"
        style={{ '--tab-color': '#FF007A', '--tab-glow': 'rgba(255,0,122,0.35)', '--tab-glow-strong': 'rgba(255,0,122,0.60)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="help-modal-header">
          <h2 className="help-modal-title">Help Guide</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`help-modal-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>

        <div className="help-modal-content">

          {/* ══ GUIDE TAB ══ */}
          {activeTab === 'guide' && (
            <div className="tab-grid tab-grid--help" style={{ height: '100%', alignItems: 'start' }}>

              {/* Left: interactive replica */}
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', paddingRight: '30px', overflowY: 'auto' }}>
                <div style={{ padding: '8px 0 18px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Click any element to learn about it
                </div>

                {/* Map name + resolution */}
                <div className="section-card" style={{ marginBottom: 16 }}>
                  <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 14 }}>Map Configuration</h3>
                  <div
                    className="form-group"
                    style={{ cursor: 'pointer', outline: helpSelected === 'mapname' ? '2px solid var(--tab-color)' : 'none' }}
                    onClick={() => setHelpSelected('mapname')}
                  >
                    <label className="form-label">Map Name</label>
                    <input readOnly onChange={() => {}} className="form-input" placeholder="e.g. Hades_Dust.v0002" value="" />
                    <div className="form-help">Version suffix (.v0001) is added automatically if omitted.</div>
                  </div>

                  <div
                    className="form-group"
                    style={{ marginBottom: 0, cursor: 'pointer', outline: helpSelected === 'resolution' ? '2px solid var(--tab-color)' : 'none' }}
                    onClick={() => setHelpSelected('resolution')}
                  >
                    <label className="form-label">Render Resolution</label>
                    <div className="pi-resolution-grid">
                      {RESOLUTIONS.map((r, i) => (
                        <div key={r.label} className={`pi-res-btn${i === 1 ? ' active' : ''}`}>{r.label}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pipeline */}
                <div
                  className="section-card"
                  style={{ marginBottom: 16, cursor: 'pointer', outline: helpSelected === 'pipeline' ? '2px solid var(--tab-color)' : 'none' }}
                  onClick={() => setHelpSelected('pipeline')}
                >
                  <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 14 }}>Pipeline</h3>
                  <div className="pi-steps">
                    {STEPS.map((step, idx) => (
                      <div key={step.id} className={`pi-step pi-step--${idx === 0 ? 'done' : idx === 1 ? 'running' : 'pending'}`}>
                        <div className="pi-step-num">
                          {idx === 0 ? '✓' : idx === 1 ? <span className="pi-spinner" ></span> : idx + 1}
                        </div>
                        <div className="pi-step-label">{step.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <div
                  style={{ cursor: 'pointer', outline: helpSelected === 'generatebtn' ? '2px solid var(--tab-color)' : 'none' }}
                  onClick={() => setHelpSelected('generatebtn')}
                >
                  <button className="btn-primary btn-lg" style={{ width: '100%' }}>Generate Preview</button>
                </div>
              </div>

              {/* Right: info panel */}
              <div style={{ overflowY: 'auto', paddingLeft: '10px' }}>
                <HelpInfoPanel sel={GUIDE_INFO[helpSelected]} />
              </div>
            </div>
          )}

          {/* ══ ADVANCED TAB ══ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">

              {/* Hero */}
              <div className="help-adv-hero">
                <div className="help-adv-hero-content">
                  <h2 className="help-adv-hero-title">Preview Image Generation</h2>
                  <p className="help-adv-hero-desc">
                    The tool automates the full pipeline for baking a new preview image into a Supreme Commander .scmap —
                    from invoking the Map Editor CLI renderer through to repacking the binary file.
                    No manual file swapping required.
                  </p>
                </div>
                <div className="help-adv-button-showcase" style={{ minWidth: 200 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: 'rgba(255,0,122,0.65)', lineHeight: 1.9 }}>
                    {['scmap-unpack', 'preview-render', 'png-to-preview-dds', '(inject)', 'scmap-pack'].map(s => <div key={s}>{s}</div>)}
                  </div>
                </div>
              </div>

              {/* Pipeline steps */}
              <div>
                <h3 className="help-adv-section-header">
                  <span className="help-adv-section-num">1</span>Pipeline Steps
                </h3>
                <div className="help-adv-card-grid">
                  {[
                    {
                      title: 'scmap-unpack',
                      desc: 'Reads and decompresses the .scmap binary into individual layer files in a temp directory.',
                      features: [
                        'Locates the .scmap by map name inside the configured maps folder',
                        'Decompresses all binary sections to a temp folder',
                        'previewImage.dds is extracted here and will be replaced in-place',
                        'Temp folder is cleaned up after a successful repack',
                      ],
                    },
                    {
                      title: 'preview-render',
                      desc: 'Invokes FAForeverMapEditor via CLI to render an orthographic top-down view of the map at the selected resolution.',
                      features: [
                        'Requires the Map Editor path to be set in Settings → Game Paths',
                        'Reads the _scenario.lua to locate and load the map',
                        'Output is either a PNG or a DDS depending on editor version',
                        'If the editor writes DDS directly, the convert step is skipped',
                      ],
                    },
                    {
                      title: 'png-to-preview-dds',
                      desc: 'Converts the rendered PNG to an uncompressed A8R8G8B8 DDS — the exact pixel format Supreme Commander expects for preview images.',
                      features: [
                        'Output written directly as previewImage.dds into the unpack folder',
                        'Skipped automatically if the editor already produced a DDS',
                        'A8R8G8B8 uncompressed — no DXT compression on preview images',
                        'Dimensions match the selected render resolution exactly',
                      ],
                    },
                    {
                      title: 'scmap-pack',
                      desc: 'Reads the modified layer files and repackages them back into the .scmap binary, overwriting the original file.',
                      features: [
                        'Writes all layer sections in the correct binary order',
                        'Overwrites the original .scmap in the map folder directly',
                        'Temp folder cleaned up after successful pack',
                        'Re-run safe — always overwrites cleanly',
                      ],
                    },
                  ].map(({ title, desc, features }) => (
                    <div key={title} className="help-adv-card">
                      <div className="help-adv-card-header">
                        <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{title}</div>
                      </div>
                      <div className="help-adv-card-body">
                        <p className="help-adv-card-desc">{desc}</p>
                        <ul className="help-adv-card-features">
                          {features.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution reference */}
              <div>
                <h3 className="help-adv-section-header">
                  <span className="help-adv-section-num">2</span>Resolution Reference
                </h3>
                <div className="help-adv-ts-grid">
                  {[
                    ['512 × 512',   'Fastest render and conversion. Noticeably pixelated in lobby at high zoom. Useful for rapid iteration during development.'],
                    ['1024 × 1024', 'Recommended. Good sharpness in lobby, fast render time. Loads instantly with no RAM impact.'],
                    ['2048 × 2048', 'High quality. Render time increases noticeably. Loads cleanly with no performance issues.'],
                    ['4096 × 4096', 'Maximum resolution. Causes a brief but noticeable freeze when loading in lobby due to texture upload size, and a measurable RAM spike. Memory does not appear to deallocate cleanly. Hard-capped in this tool at 1024 — use external tools if 4096 output is specifically required.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q">
                        <span className="help-adv-ts-icon">▸</span>
                        <strong style={{ color: 'var(--tab-color)' }}>{q}</strong>
                      </div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Troubleshooting */}
              <div>
                <h3 className="help-adv-section-header">
                  <span className="help-adv-section-num">3</span>Troubleshooting
                </h3>
                <div className="help-adv-ts-grid">
                  {[
                    ['Render step fails immediately', 'The Map Editor path is not configured or points to the wrong executable. Set it under Settings → Game Paths. The tool requires FAForeverMapEditor.exe specifically.'],
                    ['.scmap not found', 'Check the map name spelling and version suffix. The folder must exist inside the configured maps folder. The .scmap filename must match the folder name.'],
                    ['Preview looks black or corrupt', 'The editor may have failed silently. Check that the map loads correctly in the FA editor itself first. Some maps with missing assets render incorrectly.'],
                    ['Pack step fails', 'The .scmap may be locked by the FA editor. Close the editor completely and retry.'],
                    ['Preview not updated in lobby', 'FA caches preview images. Restart the FA client fully after updating the .scmap to see the new preview.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q">
                        <span className="help-adv-ts-icon">▸</span>
                        <strong style={{ color: 'var(--tab-color)' }}>{q}</strong>
                      </div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best practices */}
              <div>
                <h3 className="help-adv-section-header">
                  <span className="help-adv-section-num">4</span>Best Practices
                </h3>
                <div className="help-adv-practice-grid">
                  {[
                    { title: 'Use 1024 by Default',    desc: 'Normal maps load instantly. 1024 is the sweet spot — sharp enough for lobby use with no loading penalty.' },
                    { title: 'Finalize Map First',      desc: 'Generate the preview as one of the final steps before publishing. Terrain, prop, and decal changes will not be reflected until you re-generate.' },
                    { title: 'Editor Must Be Closed',   desc: 'The FA editor locks .scmap files while open. Always close it before generating a new preview to avoid pack failures.' },
                    { title: 'Re-runs Are Safe',        desc: 'Running the tool multiple times always overwrites cleanly. No temp files accumulate and no manual cleanup is needed.' },
                    { title: 'Restart FA After Update', desc: 'The FA client caches preview images per session. Restart FA fully to see the updated preview in the lobby browser.' },
                    { title: 'Avoid 4096',              desc: '4096 × 4096 previews cause a freeze and RAM spike on load and may not deallocate cleanly. Stay at 1024 or 2048 for release maps.' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="help-adv-practice-card">
                      <h4>{title}</h4>
                      <p>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default PreviewImageHelpModal;
