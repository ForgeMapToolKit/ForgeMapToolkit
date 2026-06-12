import React from "react";

// ── ContributionsHelpModal ────────────────────────────────────────────────────
function ContribHelpInfoPanel({ sel }) {
  return (
    <div style={{ padding: 0 }}>
      <div className="help-adv-hero" style={{ marginBottom: 24 }}>
        <div className="help-adv-hero-content">
          <h2 className="help-adv-hero-title" style={{ fontSize: '1.6rem' }}>{sel.title}</h2>
          <p className="help-adv-hero-desc">{sel.desc}</p>
        </div>
      </div>
      <div className="help-adv-structure">
        <h3 className="help-adv-section-header">
          <span className="help-adv-section-num">01</span>Details
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: 24 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sel.details.map(([label, value], i) => (
              <li key={i} style={{ display: 'flex', gap: 12, fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tab-color)', minWidth: 140, flexShrink: 0 }}>{label}:</strong>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="help-adv-note" style={{ marginTop: 16 }}>
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}

function ContributionsHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {

  const TABS = [
    { id: 'upload',      label: 'Upload Asset' },
    { id: 'download',    label: 'Download Assets' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'advanced',    label: 'Advanced Guide' },
  ];

  // ── UPLOAD info ────────────────────────────────────────────────────────────
  const UPLOAD_INFO = {
    githubauth: {
      title: 'GitHub Authentication',
      desc: 'Connect your GitHub account to submit assets under your own identity. Without authentication the submit button stays disabled.',
      details: [
        ['Required?',   'Yes — GitHub auth is required to open a PR'],
        ['Flow',        'Device flow: visit github.com/login/device and enter the displayed code'],
        ['Perks',       'Leaderboard entry, tier badge, verified credit on every asset'],
        ['Disconnect',  'Removes stored token — does not delete GitHub data'],
        ['Persistence', 'Token persists between sessions until you disconnect or it expires'],
      ],
      tip: 'Connect once — the token is stored locally and rarely needs re-authentication.',
    },
    displayname: {
      title: 'Display Name',
      desc: 'Alias shown on your contribution when submitting without a GitHub account. Has no effect once GitHub is connected.',
      details: [
        ['Without GitHub', 'Your alias appears as the author name on the PR'],
        ['With GitHub',    'Field hidden — your @username is used automatically'],
        ['No verification','Alias is not verified — connect GitHub for a verified badge'],
      ],
      tip: 'Always connect GitHub for a verified badge and leaderboard entry.',
    },
    assettype: {
      title: 'Asset Type',
      desc: 'Selects which kind of asset you are submitting. Each type has its own required files and folder path in the repository.',
      details: [
        ['Prop',      '/props/{name}/ — _prop.bp, _lod0.scm, _albedo.dds, _normalsTS.dds, _preview.png'],
        ['Skybox',   '/skyboxes/{name}/ — .scmskybox file'],
        ['Emitter',  '/emitters/{category}/{name}/ — .bp + optional normal + ramp textures'],
        ['Texture',  '/textures/{name}/ — _albedo.dds + optional _normalsTS.dds + _preview.png'],
        ['Switching','Resets all upload fields — set the type before uploading files'],
      ],
      tip: 'Switching asset type clears all file slots — choose the correct type first.',
    },
    propmode: {
      title: 'Upload Mode — Single vs Merged Folder',
      desc: 'Single mode uploads one prop with individual file slots. Merged Folder mode accepts a directory with multiple props that share textures.',
      details: [
        ['Single',        'Explicit drop zones for each file — full control per slot'],
        ['Merged Folder', 'Drop a directory with multiple _prop.bp files sharing textures'],
        ['Auto-detect',   'Grouped by shared mesh/texture prefix automatically'],
        ['LOD1',          'Optional second-LOD mesh — single mode only'],
      ],
      tip: 'Use Merged Folder when submitting a biome pack where variants share the same albedo.',
    },
    meshfile: {
      title: 'Mesh File (_lod0.scm)',
      desc: 'The 3D model file for the prop. LOD0 is the highest-detail version shown up close.',
      details: [
        ['Format',    'Supcom Mesh (.scm) — Supreme Commander native binary format'],
        ['Required',  'Yes — prop will not render without a mesh'],
        ['LOD1',      'Optional lower-detail mesh for distance rendering — reduces GPU load'],
        ['Naming',    'Must match prop name: propname_lod0.scm'],
        ['Poly count','Keep LOD0 under ~5 000 tris for performance'],
      ],
      tip: 'LOD1 at ~30% of LOD0 triangle count is a good target for large props.',
    },
    albedofile: {
      title: 'Albedo Texture (_albedo.dds)',
      desc: 'The base colour texture for the prop. This is the file that gets pixel-modified by Custom Props texture adjustments.',
      details: [
        ['Format',     'DDS — DXT1 for opaque, DXT5 if alpha channel carries specular'],
        ['Required',   'Yes'],
        ['Power-of-2', 'Dimensions must be power of 2: 128, 256, 512, 1024, 2048'],
        ['Naming',     'propname_albedo.dds'],
      ],
      tip: 'Use DXT1 for most props — smaller file size, no alpha overhead.',
    },
    normalfile: {
      title: 'Normal Map (_normalsTS.dds)',
      desc: 'Tangent-space normal map adding surface micro-detail without extra geometry. Significantly improves visual quality in FA\'s lighting.',
      details: [
        ['Format',   'DDS DXT5 (tangent-space)'],
        ['Required', 'No — prop renders with flat normals if omitted'],
        ['Suffix',   '_normalsTS — must match FA naming convention exactly'],
      ],
      tip: 'Bake normals from a high-poly sculpt if possible — even subtle detail reads well in FA.',
    },
    bpfile: {
      title: 'Blueprint File (_prop.bp)',
      desc: 'The Lua blueprint defining all prop properties: reclaim values, collision, scale, LOD paths, and physics class.',
      details: [
        ['Format',        'Lua — plain text, FA-native blueprint syntax'],
        ['Required',      'Yes'],
        ['Contents',      'Health, ReclaimMass, ReclaimEnergy, Scale, BlockPath, CollisionShape, LOD paths'],
        ['Auto-generate', 'Custom Props tab can generate a .bp — manual upload is for existing assets'],
      ],
      tip: 'Match reclaim values against vanilla props of similar size for balanced gameplay.',
    },
    previewfile: {
      title: 'Preview Image (_preview.png)',
      desc: 'Screenshot or render shown in the asset browser and detail modal. Should clearly show the prop on a clean background.',
      details: [
        ['Format',     'PNG — transparent or neutral background recommended'],
        ['Required',   'Yes for props and textures'],
        ['Resolution', '512×512 to 1024×1024 recommended'],
        ['Content',    'Clean render on a neutral background — avoid cluttered screenshots'],
      ],
      tip: 'An orthographic render against a dark background reads best in the asset card grid.',
    },
    notesfield: {
      title: 'Notes for Reviewer',
      desc: 'Optional message attached to the pull request. Use to explain origin, license, known issues, or special considerations.',
      details: [
        ['License',     'If based on third-party work, state the license here'],
        ['Attribution', 'Credit the original author if derived from existing work'],
        ['Issues',      'Mention any known visual glitches or incomplete LODs'],
        ['Optional',    'Leave blank if there is nothing to add'],
      ],
      tip: 'Clear notes help reviewers approve faster — especially for license questions.',
    },
    submitbtn: {
      title: 'Submit Button',
      desc: 'Creates a GitHub pull request with all uploaded files. Requires GitHub auth and all required fields to be filled.',
      details: [
        ['Requires',    'GitHub auth + all mandatory files for the chosen asset type'],
        ['Creates',     'A PR on the ForgeMapToolkit-Assets repo under your account'],
        ['PR title',    'Auto-generated from asset type and name'],
        ['After submit','A link to the PR is shown — track review status on GitHub'],
      ],
      tip: 'After submitting, watch the PR on GitHub for reviewer comments or requested changes.',
    },
    skyboxmode: {
      title: 'Skybox Upload',
      desc: 'Submit a .scmskybox file — the native FA skybox format used by the Skybox Generator tab.',
      details: [
        ['Format',    '.scmskybox — JSON-based FA skybox descriptor'],
        ['Required',  '.scmskybox file only — no textures needed'],
        ['Source',    'Export directly from the Skybox Generator tab'],
        ['Repo path', '/skyboxes/{name}/{name}.scmskybox'],
      ],
      tip: 'Export your skybox from the Skybox Generator tab — it produces the exact correct format.',
    },
    emittermode: {
      title: 'Emitter Upload',
      desc: 'Submit a particle emitter blueprint. The .bp file is required; normal and ramp textures are optional.',
      details: [
        ['Required',       '_emitter.bp — Lua blueprint'],
        ['Normal texture', 'Defines the shape/surface of emitted particles'],
        ['Ramp texture',   'Horizontal gradient controlling particle colour over lifetime'],
        ['Repo path',      '/emitters/{category}/{name}/'],
      ],
      tip: 'Always include both textures if the emitter uses them — otherwise the effect renders incorrectly for others.',
    },
  };

  // ── DOWNLOAD info ──────────────────────────────────────────────────────────
  const DOWNLOAD_INFO = {
    filterpanel: {
      title: 'Filter Bar',
      desc: 'Narrow the asset grid by type or search string. Filters apply live as you type.',
      details: [
        ['Type filter', 'Show only Props, Skyboxes, Emitters, or Textures'],
        ['Search',      'Matches asset name and contributor username'],
        ['Combined',    'All active filters apply simultaneously'],
      ],
      tip: 'Search by contributor username to find all assets by a specific person.',
    },
    assetcard: {
      title: 'Asset Card',
      desc: 'Thumbnail preview of a community asset. Click to open the full detail modal with download options.',
      details: [
        ['Preview',    'Uploaded by the contributor — render or screenshot'],
        ['Type badge', 'Prop / Skybox / Emitter / Texture'],
        ['Sub-count',  'Merged-folder assets show how many items are inside'],
        ['Click',      'Opens detail modal with individual or bulk download buttons'],
      ],
      tip: 'Multi-asset folders can be downloaded individually — pick only the variants you need.',
    },
    detailmodal: {
      title: 'Asset Detail Modal',
      desc: 'Full view for a selected asset: large preview, contributor info, file breakdown, and download buttons.',
      details: [
        ['Carousel',    'Multiple preview images — click dots to cycle through'],
        ['Download',    'Writes asset files directly to your local assets folder via IPC'],
        ['Sub-items',   'Merged folders list each prop/emitter individually'],
        ['Skybox load', 'Skybox assets show a "Load into Skybox Generator" button'],
        ['PR link',     'PR number links to GitHub for traceability'],
      ],
      tip: '"Load into Skybox Generator" switches you directly to the Generator tab with the skybox pre-loaded.',
    },
    downloadbtn: {
      title: 'Download Button',
      desc: 'Downloads the asset files from GitHub into your configured local assets directory.',
      details: [
        ['Destination', 'Saved to your ForgeMapToolkit assets folder (configured in Settings)'],
        ['IPC',         'Uses contrib-download-asset IPC channel — no manual file handling'],
        ['Status',      'Button changes to "Downloaded" on success, "Failed" on error'],
        ['Re-download', 'Clicking again after success re-downloads and overwrites existing files'],
      ],
      tip: 'Failed downloads are often transient network issues — retry once before investigating.',
    },
  };

  // ── LEADERBOARD info ───────────────────────────────────────────────────────
  const LB_INFO = {
    leaderboardrow: {
      title: 'Contributor Row',
      desc: 'Each row shows a contributor ranked by approved asset count. Click a row to open their full profile.',
      details: [
        ['Rank',        'Position by approved asset count — ties are possible'],
        ['Avatar',      'GitHub profile picture if connected, initials otherwise'],
        ['Tier badge',  'Colour-coded tier based on approved count threshold'],
        ['Asset types', 'Small type chips show which categories they contributed to'],
        ['Click',       'Opens full contributor profile with all their assets listed'],
      ],
      tip: 'Click any row to see the full contributor profile.',
    },
    tierbadge: {
      title: 'Tier Badge',
      desc: 'Colour-coded rank awarded automatically based on total approved contributions. Recalculates live from the GitHub manifest.',
      details: [
        ['Member',  '5+ approved'],
        ['Bronze',  '15+ approved'],
        ['Silver',  '35+ approved'],
        ['Gold',    '50+ approved'],
        ['Diamond', '75+ approved'],
        ['Emerald', '100+ approved'],
      ],
      tip: 'Tiers update automatically — no manual assignment. Submit more approved assets to advance.',
    },
    contributorprofile: {
      title: 'Contributor Profile',
      desc: 'Full view for a contributor: tier, stats, and a chronological list of all their assets with status badges.',
      details: [
        ['Back button',    'Returns to the leaderboard list'],
        ['Total/Approved', 'Counts of all submitted and approved assets'],
        ['Asset list',     'Chronological list with type, status, date, and file size'],
        ['Status badges',  '"Approved" shown in green — pending PRs may also appear'],
      ],
      tip: 'All contributors with at least one approved asset appear on the leaderboard.',
    },
  };

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div
        className="help-modal"
        style={{ '--tab-color': 'var(--contributions-color)', '--tab-glow': 'var(--contributions-glow)', '--tab-glow-strong': 'var(--contributions-glow-strong)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">Help Guide</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="help-modal-content">

          {/* ══════════════ UPLOAD TAB ══════════════ */}
          {activeTab === 'upload' && (
            <div style={{ display: 'flex', gap: 40, height: '100%' }}>

              {/* Left: 1:1 replica */}
              <div style={{ flex: '0 0 auto', width: 520, overflowY: 'auto', paddingRight: 20, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Click any element to learn about it</div>

                {/* GitHub Auth Panel */}
                <div
                  className="ct-auth-panel ct-auth-disconnected"
                  onClick={() => setHelpSelected('githubauth')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'githubauth' ? '2px solid var(--tab-color)' : 'none', marginBottom: 20 }}
                >
                  <div className="ct-auth-gh-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  </div>
                  <div className="ct-auth-info">
                    <div className="ct-auth-title">Connect GitHub <span className="ct-auth-optional-tag">optional</span></div>
                    <div className="ct-auth-desc">Unlocks leaderboard entry, achievements, and a verified badge on your contributions.</div>
                  </div>
                  <div className="ct-auth-perks">
                    <span className="ct-auth-perk">Leaderboard</span>
                    <span className="ct-auth-perk">Achievements</span>
                    <span className="ct-auth-perk">Verified</span>
                  </div>
                  <button className="ct-auth-btn connect" style={{ pointerEvents: 'none' }}>Connect</button>
                </div>

                {/* Display name */}
                <div className="ct-section" onClick={() => setHelpSelected('displayname')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'displayname' ? '2px solid var(--tab-color)' : 'none', marginBottom: 20 }}>
                  <label className="ct-section-label">DISPLAY NAME <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>(alias, no account needed)</span></label>
                  <input readOnly onChange={() => {}} className="ct-input" style={{ maxWidth: 320, pointerEvents: 'none' }} placeholder="your name or alias" />
                </div>

                {/* Asset type switcher */}
                <div className="ct-section" onClick={() => setHelpSelected('assettype')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'assettype' ? '2px solid var(--tab-color)' : 'none', marginBottom: 20 }}>
                  <label className="ct-section-label">ASSET TYPE</label>
                  <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Prop', 'Skybox', 'Emitter', 'Texture'].map((t, i) => (
                      <button key={t} style={{ flex: 1, padding: '10px 0', background: i === 0 ? 'rgba(165,232,1,0.1)' : 'transparent', border: 'none', borderRight: '1px solid rgba(255,255,255,0.08)', borderBottom: i === 0 ? '2px solid var(--tab-color)' : '2px solid transparent', color: i === 0 ? 'var(--tab-color)' : 'rgba(255,255,255,0.3)', fontFamily: 'Poppins,sans-serif', fontSize: '0.8rem', fontWeight: 600, cursor: 'default', letterSpacing: '0.04em', textTransform: 'uppercase', pointerEvents: 'none' }}>{t}</button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }} />

                {/* Upload mode */}
                <div className="ct-section" onClick={() => setHelpSelected('propmode')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'propmode' ? '2px solid var(--tab-color)' : 'none', marginBottom: 16 }}>
                  <label className="ct-section-label">UPLOAD MODE</label>
                  <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[['Single Prop', true], ['Merged Folder', false]].map(([label, active]) => (
                      <button key={label} style={{ flex: 1, padding: '9px 0', background: active ? 'rgba(165,232,1,0.08)' : 'transparent', border: 'none', borderBottom: active ? '2px solid var(--tab-color)' : '2px solid transparent', color: active ? 'var(--tab-color)' : 'rgba(255,255,255,0.3)', fontFamily: 'Poppins,sans-serif', fontSize: '0.76rem', fontWeight: 600, pointerEvents: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* Drop zones */}
                <div className="ct-dropzone-grid cols-2" style={{ marginBottom: 10 }}>
                  {[
                    { key: 'meshfile',   label: 'Mesh (.scm)',     icon: '⬡', hint: '_lod0.scm (required)' },
                    { key: 'albedofile', label: 'Albedo Texture',  icon: '◈', hint: '_albedo.dds (required)' },
                    { key: 'normalfile', label: 'Normal Map',      icon: '◈', hint: '_normalsTS.dds', optional: true },
                    { key: 'bpfile',     label: 'Blueprint (.bp)', icon: '⬡', hint: '_prop.bp (required)' },
                  ].map(dz => (
                    <div key={dz.key} className={`ct-dropzone${dz.optional ? ' optional' : ''}`}
                      onClick={() => setHelpSelected(dz.key)}
                      style={{ cursor: 'pointer', outline: helpSelected === dz.key ? '2px solid var(--tab-color)' : 'none' }}>
                      <div className="ct-dz-icon">{dz.icon}</div>
                      <div className="ct-dz-label">{dz.label}{dz.optional && <span className="ct-optional-badge">optional</span>}</div>
                      <div className="ct-dz-hint">{dz.hint}</div>
                    </div>
                  ))}
                </div>
                <div className="ct-dropzone" onClick={() => setHelpSelected('previewfile')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'previewfile' ? '2px solid var(--tab-color)' : 'none', marginBottom: 16 }}>
                  <div className="ct-dz-icon">🖼</div>
                  <div className="ct-dz-label">Preview Image</div>
                  <div className="ct-dz-hint">_preview.png (required)</div>
                </div>

                {/* Notes */}
                <div className="ct-section" onClick={() => setHelpSelected('notesfield')}
                  style={{ cursor: 'pointer', outline: helpSelected === 'notesfield' ? '2px solid var(--tab-color)' : 'none', marginBottom: 20 }}>
                  <label className="ct-section-label">NOTES FOR REVIEWER <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(optional)</span></label>
                  <textarea readOnly className="ct-textarea" style={{ pointerEvents: 'none' }} placeholder="License info, source attribution, known issues…" />
                </div>

                {/* Submit row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ flex: 1, fontSize: '0.72rem', color: 'rgba(251,191,36,0.7)', fontStyle: 'italic' }}>Connect your GitHub account above to submit.</span>
                  <button className="ct-btn-submit"
                    onClick={() => setHelpSelected('submitbtn')}
                    style={{ outline: helpSelected === 'submitbtn' ? '2px solid var(--tab-color)' : 'none' }}>
                    Submit Prop
                  </button>
                </div>
              </div>

              {/* Right: explanation */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--tab-color)' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: 260, lineHeight: 1.7 }}>Click any field, button, drop zone, or section on the left to learn what it does.</div>
                  </div>
                ) : (() => { const sel = UPLOAD_INFO[helpSelected]; if (!sel) return null; return <ContribHelpInfoPanel sel={sel} />; })()}
              </div>
            </div>
          )}

          {/* ══════════════ DOWNLOAD TAB ══════════════ */}
          {activeTab === 'download' && (
            <div style={{ display: 'flex', gap: 40, height: '100%' }}>
              <div style={{ flex: '0 0 auto', width: 520, overflowY: 'auto', paddingRight: 20, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Click any element to learn about it</div>

                {/* Filter bar */}
                <div onClick={() => setHelpSelected('filterpanel')}
                  style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', cursor: 'pointer', outline: helpSelected === 'filterpanel' ? '2px solid var(--tab-color)' : 'none', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <input readOnly className="ct-input" style={{ flex: 1, pointerEvents: 'none' }} placeholder="Search assets…" />
                  {['All', 'Prop', 'Skybox', 'Emitter', 'Texture'].map((f, i) => (
                    <button key={f} style={{ padding: '6px 12px', fontSize: '0.72rem', fontFamily: 'Poppins,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', border: 'none', cursor: 'default', background: i === 0 ? 'rgba(165,232,1,0.1)' : 'transparent', borderBottom: i === 0 ? '2px solid var(--tab-color)' : '2px solid transparent', color: i === 0 ? 'var(--tab-color)' : 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>{f}</button>
                  ))}
                </div>

                {/* Asset cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { name: 'Scorched Pine',     type: 'prop',   helpKey: 'assetcard',   sub: null },
                    { name: 'Desert Biome Pack', type: 'prop',   helpKey: 'assetcard',   sub: '4 props' },
                    { name: 'Volcano Skybox',    type: 'skybox', helpKey: 'detailmodal', sub: null },
                  ].map(a => (
                    <div key={a.name} className="ct-dl-card" onClick={() => setHelpSelected(a.helpKey)}
                      style={{ cursor: 'pointer', outline: helpSelected === a.helpKey ? '2px solid var(--tab-color)' : 'none' }}>
                      <div className="ct-dl-card-preview-placeholder" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontSize: '1.4rem', opacity: 0.1, fontFamily: 'monospace' }}>{a.type === 'prop' ? '⬡' : '◎'}</span>
                      </div>
                      <div className="ct-dl-card-body">
                        <div className="ct-dl-card-name">{a.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`ct-status ct-type-${a.type}`} style={{ fontFamily: 'monospace', letterSpacing: '0.06em', fontSize: '0.62rem' }}>{a.type}</span>
                          {a.sub && <span style={{ fontSize: '0.62rem', color: 'rgba(165,232,1,0.5)', fontFamily: 'monospace' }}>{a.sub}</span>}
                        </div>
                      </div>
                      <div className="ct-dl-card-footer">click for details</div>
                    </div>
                  ))}
                </div>

                {/* Download button demo */}
                <div onClick={() => setHelpSelected('downloadbtn')}
                  style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', outline: helpSelected === 'downloadbtn' ? '2px solid var(--tab-color)' : 'none' }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Asset detail — download section:</div>
                  <button className="ct-dl-btn" style={{ pointerEvents: 'none', margin: 0 }}>Download</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--tab-color)' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: 260, lineHeight: 1.7 }}>Click any card, filter, or button on the left to learn about the Download section.</div>
                  </div>
                ) : (() => { const sel = DOWNLOAD_INFO[helpSelected]; if (!sel) return null; return <ContribHelpInfoPanel sel={sel} />; })()}
              </div>
            </div>
          )}

          {/* ══════════════ LEADERBOARD TAB ══════════════ */}
          {activeTab === 'leaderboard' && (
            <div style={{ display: 'flex', gap: 40, height: '100%' }}>
              <div style={{ flex: '0 0 auto', width: 520, overflowY: 'auto', paddingRight: 20, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Click any element to learn about it</div>

                <div className="ct-lb-header-row" style={{ marginBottom: 4 }}>
                  <span>#</span><span>CONTRIBUTOR</span>
                  <span style={{ textAlign: 'right' }}>APPROVED</span>
                  <span style={{ textAlign: 'right' }}>TIER</span>
                </div>
                <div className="ct-lb-divider" style={{ marginBottom: 8 }} />

                {[
                  { rank: 1, user: 'SeraphimNoob01', approved: 42, tier: { label: 'Silver', color: '#cbd5e1' }, types: ['prop','skybox'], rankColor: '#fbbf24', gold: true,  helpKey: 'leaderboardrow' },
                  { rank: 2, user: 'ForgeMaster99',  approved: 18, tier: { label: 'Bronze', color: '#cd7c3f' }, types: ['prop'],          rankColor: '#94a3b8', gold: false, helpKey: 'leaderboardrow' },
                  { rank: 3, user: 'MapWarden',       approved: 7,  tier: { label: 'Member', color: '#e2e8f0' }, types: ['emitter'],       rankColor: '#cd7c3f', gold: false, helpKey: 'contributorprofile' },
                ].map((c, i) => (
                  <div key={c.user} className={`ct-lb-row${c.gold ? ' gold' : ''}`}
                    onClick={() => setHelpSelected(c.helpKey)}
                    style={{ cursor: 'pointer', outline: helpSelected === c.helpKey ? '2px solid var(--tab-color)' : 'none', marginBottom: 4 }}>
                    <div className="ct-lb-rank" style={{ color: c.rankColor }}>{c.rank}</div>
                    <div className="ct-lb-user">
                      <div className="ct-lb-avatar" style={{ background: ['#fbbf24','#94a3b8','#cd7c3f'][i], color: '#0a0a0a', border: `1.5px solid ${c.tier.color}`, boxShadow: `0 0 8px ${c.tier.color}55`, fontSize: '0.6rem', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{c.user.slice(0,2).toUpperCase()}</div>
                      <div>
                        <div className="ct-lb-username">{c.user}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {c.types.map(t => <span key={t} className={`ct-status ct-type-${t}`} style={{ fontFamily: 'monospace', letterSpacing: '0.06em', fontSize: '0.58rem' }}>{t}</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--tab-color)', fontWeight: 700, fontFamily: 'Space Grotesk,monospace' }}>{c.approved}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="ct-tier-badge ct-tier-sm"
                        onClick={e => { e.stopPropagation(); setHelpSelected('tierbadge'); }}
                        style={{ color: c.tier.color, borderColor: c.tier.color+'44', background: c.tier.color+'12', cursor: 'pointer', outline: helpSelected === 'tierbadge' ? '2px solid var(--tab-color)' : 'none' }}>
                        {c.tier.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--tab-color)' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: 260, lineHeight: 1.7 }}>Click any row or tier badge on the left to learn about leaderboard mechanics.</div>
                  </div>
                ) : (() => { const sel = LB_INFO[helpSelected]; if (!sel) return null; return <ContribHelpInfoPanel sel={sel} />; })()}
              </div>
            </div>
          )}

          {/* ══════════════ ADVANCED GUIDE TAB ══════════════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">
              <div className="help-adv-subtabs">
                {[
                  { id: 'workflow',  label: 'Workflow' },
                  { id: 'filetypes', label: 'File Types' },
                  { id: 'github',    label: 'GitHub & PRs' },
                  { id: 'tiers',     label: 'Tier System' },
                  { id: 'structure', label: 'Output Structure' },
                ].map(t => (
                  <button key={t.id} className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`} onClick={() => setActiveAdvSubTab(t.id)}>{t.label}</button>
                ))}
              </div>

              {/* ─── WORKFLOW ─── */}
              {activeAdvSubTab === 'workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Full Contribution Workflow</h2>
                    <p className="help-adv-hero-desc">Complete reference for submitting, reviewing, and downloading community assets — from first upload to in-game use.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button btn-primary">SUBMIT PROP</div>
                    <div className="help-adv-button-hint">3 steps from file to community</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Core Process</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'Authenticate & Prepare', desc: 'Connect your GitHub account via Device Flow in the Upload section. This is required to submit — PRs must be traceable to a GitHub identity.', subs: ['Visit github.com/login/device and enter the displayed code — no password needed', 'Token stored locally until you disconnect — re-auth rarely needed', 'Display Name alias works for testing but provides no leaderboard or tier', 'GitHub connected = verified badge on every approved contribution'] },
                      { n: '02', title: 'Upload Your Asset', desc: 'Select the asset type (Prop, Skybox, Emitter, Texture), fill required file slots, add optional notes, and click Submit.', subs: ['Prop: blueprint + mesh (LOD0) + albedo texture + normal map + preview image', 'Skybox: .scmskybox file only — export directly from the Skybox Generator tab', 'Emitter: .bp blueprint + optional normal and ramp textures', 'Texture: albedo DDS + preview PNG + optional normal map', 'Merged Folder mode: drop a directory with multiple props sharing textures'] },
                      { n: '03', title: 'PR Review & Approval', desc: 'Your submission opens a Pull Request on the ForgeMapToolkit-Assets GitHub repo. A maintainer reviews and merges it.', subs: ['PRs appear on GitHub under your account — link shown after submission', 'Reviewer may request changes: follow up on GitHub comments', 'Approved PRs are merged to main — asset appears in Download Assets immediately', 'Your approved count updates live — tier badges recalculate automatically'] },
                      { n: '04', title: 'Community Use', desc: 'Once approved, anyone can download your asset via the Download Assets tab. Props load into Custom Props; skyboxes load into the Skybox Generator.', subs: ['Download IPC writes files directly to the user\'s local assets folder', 'Skybox assets show a "Load into Skybox Generator" button — one-click workflow', 'Multi-prop bundles can be downloaded individually or all at once', 'Assets remain attributed to you — name and tier appear on the card'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul style={{ margin: '10px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {s.subs.map((sub, i) => <li key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6 }}>{sub}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Troubleshooting</h3>
                  {[
                    ['Submit button stays disabled after connecting GitHub', 'Check that all required files for the chosen asset type are filled in. For Props: blueprint, LOD0 mesh, albedo, and preview are all mandatory. The status line below the submit button shows which condition is blocking.'],
                    ['PR was created but asset does not appear in Download Assets', 'Only merged (approved) PRs appear in the download list. Open PRs are under review. Check the PR link shown after submission for review status and any change requests.'],
                    ['Authentication keeps failing or spinner never resolves', 'The Device Flow times out after ~15 minutes. Click Connect again to restart. Also verify you entered the code at github.com/login/device — not any other page.'],
                    ['Merged Folder mode does not detect my props', 'The tool looks for files named *_prop.bp at root or in subdirectories. Ensure your blueprint files use this exact suffix. Files without _prop.bp in the name are ignored by the folder parser.'],
                    ['Asset preview image not showing in the card', 'The preview must be uploaded as part of the contribution and named correctly: propname_preview.png. Preview images are served from GitHub raw CDN — cache can delay appearance by a few minutes after merge.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: 'var(--tab-color)' }}>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['Always Include a Preview', 'A clear preview image is the single biggest factor in whether others download your asset. Render on a neutral background with good lighting — avoid busy in-game screenshots.'],
                      ['Test Before Submitting', 'Load your prop via the Custom Props tab first. Verify it renders at the correct scale, textures load, and reclaim values are reasonable. Catch issues before they reach reviewers.'],
                      ['Use Descriptive Names', 'Name your asset clearly: Desert_Rock_Large is far more useful than Rock01. Others search the asset list by name — clarity drives downloads.'],
                      ['Credit Your Sources', 'If your asset is based on vanilla FA files, third-party meshes, or modified community work, say so in the Notes field. Include the license. Clear attribution speeds up review.'],
                    ].map(([title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon"></div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── FILE TYPES ─── */}
              {activeAdvSubTab === 'filetypes' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">File Types Reference</h2>
                    <p className="help-adv-hero-desc">Full breakdown of every file format used in contributions — what each file does, how FA reads it, and quality guidelines.</p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Prop Files</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                    {[
                      { file: '_prop.bp',       color: 'var(--tab-color)', role: 'Blueprint',             detail: 'Lua script defining all prop properties: health, reclaim mass/energy/time, collision shape, block path, LOD paths, uniform scale, and physics class. FA reads this on map load to configure the prop entity.' },
                      { file: '_lod0.scm',       color: '#94a3b8',          role: 'High-detail mesh',       detail: 'Binary Supcom Mesh format (.scm). Rendered when the camera is within LOD0 range (~200 units). Keep under ~5 000 tris for good performance. Power-of-2 UV mapping recommended.' },
                      { file: '_lod1.scm',       color: '#64748b',          role: 'Low-detail mesh (opt.)', detail: 'Same format as LOD0. Rendered at distance. Typically 30–40% of LOD0 triangle count. Missing LOD1 causes FA to use LOD0 at all distances — higher GPU cost in large maps.' },
                      { file: '_albedo.dds',     color: 'var(--tab-color)', role: 'Base colour texture',    detail: 'DXT1 (opaque) or DXT5 (alpha in channel 4). Dimensions must be power-of-2. Modified by Custom Props texture adjustments — hue/sat/bri are baked pixel-by-pixel at generation time.' },
                      { file: '_normalsTS.dds',  color: '#94a3b8',          role: 'Normal map',            detail: 'DDS DXT5. Encodes surface normals for micro-detail lighting. Suffix must be _normalsTS — FA resolves the path by convention. Missing normal map = flat shading.' },
                      { file: '_preview.png',    color: '#e2e8f0',          role: 'Thumbnail image',       detail: 'PNG, 512×512 to 1024×1024. Shown in the Download Assets card grid and detail modal. Dark or transparent background recommended.' },
                    ].map(r => (
                      <div key={r.file} style={{ display: 'flex', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ minWidth: 200, flexShrink: 0 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: r.color }}>{r.file}</span>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{r.role}</div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Other Asset Types</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
                    {[
                      { file: '.scmskybox',         color: '#60a5fa', role: 'Skybox descriptor',       detail: 'JSON format native to FA\'s skybox system. Contains cloud, sun, moon, star, horizon, and atmosphere layer configuration. Export from the Skybox Generator tab for the correct structure.' },
                      { file: '_emitter.bp',        color: '#f59e0b', role: 'Emitter blueprint',       detail: 'Lua blueprint defining particle behaviour: spawn rate, velocity, lifetime, size over time, rotation. References normal and ramp texture paths relative to the emitter folder.' },
                      { file: '_normal.dds (emit)', color: '#94a3b8', role: 'Particle surface texture', detail: 'Texture applied to each emitted particle\'s surface. Controls the shape and surface appearance of individual particles.' },
                      { file: '_ramp.dds',          color: '#f97316', role: 'Colour-over-lifetime',    detail: 'Horizontal 1D gradient texture. Left edge = colour at birth, right edge = colour at death. Controls how particle colour evolves during its lifetime.' },
                    ].map(r => (
                      <div key={r.file} style={{ display: 'flex', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ minWidth: 200, flexShrink: 0 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: r.color }}>{r.file}</span>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{r.role}</div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-note" style={{ marginTop: 24 }}>
                  <strong>DXT compression: </strong>DXT1 = 6:1, no alpha — use for all solid props. DXT5 = 4:1, alpha preserved — only when the alpha channel carries specular or opacity. Never submit uncompressed DDS.
                </div>
              </>)}

              {/* ─── GITHUB & PRs ─── */}
              {activeAdvSubTab === 'github' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">GitHub & Pull Request System</h2>
                    <p className="help-adv-hero-desc">How the contribution pipeline maps to GitHub — authentication, PR structure, review flow, and what happens after merge.</p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Device Flow Authentication</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '1', title: 'Click Connect',              desc: 'ForgeMapToolkit requests a device code from GitHub\'s OAuth endpoint. A short alphanumeric code is generated and shown in the app.' },
                      { n: '2', title: 'Visit github.com/login/device', desc: 'Open that URL in any browser — does not need to be on the same machine. Paste the code displayed in the app.' },
                      { n: '3', title: 'Approve the App',             desc: 'GitHub shows the requested permissions. Click Authorize. The app polls GitHub every 5 seconds until it detects approval.' },
                      { n: '4', title: 'Token Stored',                desc: 'A GitHub access token is saved locally. Your username and avatar are fetched and displayed. Token persists until you Disconnect or it expires (90 days of inactivity).' },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content"><h4>{s.title}</h4><p>{s.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>What Happens on Merge</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
                    {[
                      ['Files added to main branch',   'All uploaded files land at their repo path under the merged structure.'],
                      ['Contributor data updated',     'The contributors.json manifest is updated — approved count incremented, asset added to the contributor\'s list.'],
                      ['Asset appears in Downloads',   'ForgeMapToolkit loads from the live GitHub API — approved assets appear in Download Assets within minutes.'],
                      ['Leaderboard updates',          'Tier badges recalculate. If the contributor crosses a tier threshold, their badge upgrades automatically.'],
                    ].map(([title, desc], i) => (
                      <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <strong style={{ color: 'var(--tab-color)', fontSize: '0.82rem', minWidth: 200, flexShrink: 0 }}>{title}</strong>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.83rem', lineHeight: 1.65 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── TIER SYSTEM ─── */}
              {activeAdvSubTab === 'tiers' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Contributor Tier System</h2>
                    <p className="help-adv-hero-desc">Tiers are awarded automatically based on total approved contribution count. They display as colour-coded badges on the leaderboard and asset cards.</p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Tier Thresholds</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
                    {[
                      { tier: 'Emerald', min: 100, color: '#50fa7b', desc: 'Top-tier contributors with 100+ approved assets. Rare — reserved for prolific community builders.' },
                      { tier: 'Diamond', min: 75,  color: '#a9d8ff', desc: 'Elite contributors with an extensive catalogue of approved quality assets.' },
                      { tier: 'Gold',    min: 50,  color: '#fbbf24', desc: 'Highly active contributors with a solid and varied asset catalogue.' },
                      { tier: 'Silver',  min: 35,  color: '#cbd5e1', desc: 'Established contributors with a meaningful body of approved work.' },
                      { tier: 'Bronze',  min: 15,  color: '#cd7c3f', desc: 'Regular contributors who have gone beyond the initial entry threshold.' },
                      { tier: 'Member',  min: 5,   color: '#e2e8f0', desc: 'Entry-level recognition for contributors with at least 5 approved assets.' },
                    ].map(t => (
                      <div key={t.tier} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '14px 20px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${t.color}22` }}>
                        <div style={{ minWidth: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="ct-tier-badge ct-tier-sm" style={{ color: t.color, borderColor: t.color+'44', background: t.color+'12' }}>{t.tier}</span>
                          <span style={{ fontFamily: 'Space Grotesk,monospace', fontSize: '0.9rem', fontWeight: 700, color: t.color }}>{t.min}+</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>approved</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-note" style={{ marginTop: 24 }}>
                  <strong>Live recalculation: </strong>Tiers update automatically when contributors.json is refreshed from GitHub. No manual assignment — the threshold logic runs client-side in real time.
                </div>
              </>)}

              {/* ─── OUTPUT STRUCTURE ─── */}
              {activeAdvSubTab === 'structure' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Repository Output Structure</h2>
                    <p className="help-adv-hero-desc">How submitted files are organised in the ForgeMapToolkit-Assets GitHub repository after a PR is merged.</p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Repository Layout</h3>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px 28px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 2.2, marginTop: 24, overflowX: 'auto' }}>
                    <div style={{ color: 'rgba(255,255,255,0.85)' }}>ForgeMapToolkit-Assets/</div>
                    <div style={{ paddingLeft: 24, marginTop: 4 }}><span style={{ color: 'var(--tab-color)', fontWeight: 600 }}>props/</span></div>
                    <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>scorched_pine/</span></div>
                    {['scorched_pine_prop.bp','scorched_pine_lod0.scm','scorched_pine_albedo.dds','scorched_pine_normalsTS.dds','scorched_pine_preview.png'].map((f, i) => (
                      <div key={f} style={{ paddingLeft: 72 }}><span style={{ color: i===2?'var(--tab-color)':i===4?'#e2e8f0':'rgba(255,255,255,0.45)' }}>├ {f}</span></div>
                    ))}
                    <div style={{ paddingLeft: 24, marginTop: 8 }}><span style={{ color: '#60a5fa', fontWeight: 600 }}>skyboxes/</span></div>
                    <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(96,165,250,0.7)', fontWeight: 600 }}>volcano_dust/</span></div>
                    <div style={{ paddingLeft: 72 }}><span style={{ color: 'rgba(96,165,250,0.55)' }}>└ volcano_dust.scmskybox</span></div>
                    <div style={{ paddingLeft: 24, marginTop: 8 }}><span style={{ color: '#f59e0b', fontWeight: 600 }}>emitters/</span></div>
                    <div style={{ paddingLeft: 48 }}><span style={{ color: 'rgba(245,158,11,0.7)', fontWeight: 600 }}>fire/fire_column/</span></div>
                    {['fire_column.bp','fire_column_normal.dds','fire_column_ramp.dds'].map(f => (
                      <div key={f} style={{ paddingLeft: 72 }}><span style={{ color: 'rgba(245,158,11,0.55)' }}>├ {f}</span></div>
                    ))}
                    <div style={{ paddingLeft: 24, marginTop: 8 }}><span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>contributors.json</span><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginLeft: 12 }}>— live contributor + asset manifest</span></div>
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Troubleshooting Download Failures</h3>
                  {[
                    ['Download button shows "Failed" immediately', 'The IPC channel contrib-download-asset could not reach GitHub raw CDN. Check your network — the most common cause is a firewall blocking raw.githubusercontent.com. Retry once.'],
                    ['Asset downloads but files are in wrong location', 'The download destination is your configured assets folder in Settings. Check that path is correct and writable. If the folder path has spaces or special characters, re-configure it to a plain path.'],
                    ['Merged folder shows wrong prop count', 'The sub-item count is parsed from the asset manifest. If the contributor submitted a folder with misnamed .bp files (missing _prop.bp suffix), the parser may under-count.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: 'var(--tab-color)' }}>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
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

// ── Root ──────────────────────────────────────────────────────────────────────

export default ContributionsHelpModal;
