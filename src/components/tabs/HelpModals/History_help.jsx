import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const HIST_COLOR       = '#FF8AFF';
const HIST_GLOW        = 'rgba(255,138,255,0.35)';
const HIST_GLOW_STRONG = 'rgba(255,138,255,0.6)';

const HIST_HELP_TABS = [
  { id: 'main',     label: '⊞ Interface Guide' },
  { id: 'advanced', label: '⚙ Advanced Guide'  },
];

const HIST_INFO = {

  search: {
    title: 'Search',
    desc: 'Filters the snapshot list in real time. Type any part of a map name or a tab name (e.g. "kaali", "Props", "Wreckages") and the list updates instantly to show only matching entries.',
    details: [
      ['Matches', 'Map name and tab name — both fields are searched'],
      ['Case',    'Case-insensitive — "kaali" matches "Kaali"'],
      ['Clear',   'Delete the text to show all entries again'],
    ],
    tip: 'If you are looking for changes from a specific tab, type the tab name directly — it is faster than using the filter pills.',
  },

  filterpills: {
    title: 'Tab Filter Pills',
    desc: 'Narrows the snapshot list to show only entries that came from a specific toolkit tab. Only tabs that actually have saved snapshots appear as pills — tabs with no history are hidden.',
    details: [
      ['"All" pill',    'Shows every snapshot from every tab, sorted newest first'],
      ['Colored pills', 'Each tab has its own accent color — the active pill glows'],
      ['Clear button',  'Only visible when a specific tab is selected (not "All")'],
    ],
    tip: 'When "All" is active, each entry card shows a colored badge telling you which tab generated it.',
  },

  entrycard: {
    title: 'Snapshot Entry Card',
    desc: 'Each card represents one complete generate run. It shows the map name, the exact timestamp, and colored chips counting how many files changed. Clicking a card loads the full diff in the right panel.',
    details: [
      ['Map name',    'Derived from the scmap folder name'],
      ['Timestamp',   'Date and time down to the second (DD.MM.YY HH:MM:SS)'],
      ['+N chip',     'Files added — green'],
      ['-N chip',     'Files removed — red'],
      ['~N chip',     'Files modified — amber'],
      ['"no changes"','Shown in faint text when the generation produced zero file changes'],
    ],
    tip: 'A card showing only "no changes" means you ran Generate but the output files were bit-for-bit identical to before — usually because nothing in the settings changed.',
  },

  clearhistory: {
    title: 'Clear History',
    desc: 'Removes all snapshots for the currently selected tab. Requires a confirmation step — you have to click "Yes, clear" to confirm. The action cannot be undone.',
    details: [
      ['Scope',     'Clears only the tab currently selected in the filter pills'],
      ['"All" view', 'No clear button — select a specific tab first'],
      ['Persistent', 'History is saved to disk — clearing removes it permanently'],
    ],
    tip: 'There is no bulk "clear all" option. If you need to clear everything, select each tab individually and clear them one at a time.',
  },

  detailheader: {
    title: 'Detail Header',
    desc: 'Shows the summary information for the selected snapshot: map name, timestamp, folder path, summary pills, and the source tab badge.',
    details: [
      ['Dot color',    'Matches the accent color of the tab that generated this snapshot'],
      ['Folder path',  'The folder on disk where the scmap files live'],
      ['Summary pills','Quick count of added / removed / modified files for this snapshot'],
      ['Tab badge',    'Shows which toolkit tab triggered this snapshot (e.g. "Wreckages")'],
    ],
    tip: 'The folder path in the header is the same path that the Lua editor uses to save files — if this path is missing, the Save & Repack button will be inactive.',
  },

  filecard: {
    title: 'File Change Card',
    desc: 'Each row represents one file that changed in this snapshot. The row shows the filename, the file category label, the before/after size, and action hints. Clicking opens the content view.',
    details: [
      ['Lua files',   'Click to open the full-screen split editor — left pane = before (read-only), right pane = after (editable)'],
      ['Binary files','Click to expand a size comparison — no text diff available for .dds or .raw'],
      ['Text files',  'Click to expand an inline side-by-side diff'],
      ['↩ Undo',      'Appears on modified Lua files — restores the before-state content to disk and repacks'],
    ],
    tip: 'Binary files (DDS, RAW) can only show size changes — the actual pixel data is not diffed. If a DDS file shows a size delta of 0 but you know it changed, it was re-saved at identical file size.',
  },

  diffview: {
    title: 'Side-by-Side Diff',
    desc: 'Shows exactly which lines changed between before and after. The diff is computed using a line-level LCS algorithm, with a secondary character-level diff applied to lines that were replaced (one removed + one added at the same position).',
    details: [
      ['Left pane',   'Before — removed lines highlighted in red'],
      ['Right pane',  'After — added lines highlighted in green'],
      ['Equal lines', 'Shown in both panes, dimmed'],
      ['Hatched cell','The other side has a line here, but this side does not'],
      ['Char diff',   'Red strikethrough = removed chars within a line; green bg = added chars'],
      ['Context',     'By default ±2 lines around each change — click "show all N lines" to expand'],
    ],
    tip: 'The diff toolbar shows "+N lines / -N lines" counts. Click "show all N lines" to see the full file with all equal lines visible.',
  },

  luaeditor: {
    title: 'Lua Editor — Split View',
    desc: 'A full-screen editor that opens when you click a .lua file. Split into a read-only before pane on the left and an editable after pane on the right. Both panes scroll in sync.',
    details: [
      ['Left pane (Before)', 'Read-only. Shows the file as it was before the generation. Removed lines have a red bar in the gutter.'],
      ['Right pane (After)', 'Editable. Fully live — type directly into it. Added lines have a green bar in the gutter.'],
      ['Syntax highlight',   'Keywords, strings, numbers, comments, operators — all tokenised client-side'],
      ['Scroll sync',        'Scrolling either pane moves both simultaneously'],
      ['Save & Repack',      'Writes the edited content to disk and re-packs the scmap folder automatically'],
      ['ESC / click outside','Closes the editor. Unsaved changes are lost.'],
    ],
    tip: 'The editor uses virtualised rendering — even files with 10,000+ lines open instantly. Only the lines near the viewport are actually rendered.',
  },

  savepack: {
    title: 'Save & Repack',
    desc: 'Writes your edited Lua content back to disk and immediately re-packs the entire scmap folder into a fresh .scmap binary. Two steps happen in sequence — first the file write, then the scmap-pack IPC call.',
    details: [
      ['Active when',    'You have made at least one change in the right (After) pane'],
      ['Step 1',         'Writes edited content to the .lua file path using write-file IPC'],
      ['Step 2',         'Calls scmap-pack on the parent folder — same as clicking ⬆ Pack in the SCMAP Tool'],
      ['On success',     'Button label changes to "saved & repacked" briefly'],
      ['On failure',     'Error message shown at top of editor with exact reason'],
      ['Inactive when',  'folderPath is null — the file path is unknown and the save cannot target a location'],
    ],
    tip: 'After saving, the new snapshot created by Save & Repack appears in the History list under the "History" source tab — so you can always compare your manual edits against the original.',
  },

  unchanged: {
    title: 'Unchanged Files',
    desc: 'Files that were identical before and after the generation are listed here as compact pills instead of full rows. This keeps the detail view focused on what actually changed.',
    details: [
      ['Pill format',  'Just the filename — no size, no diff, no actions'],
      ['Still tracked', 'These files ARE in the snapshot — they just produced no diff'],
    ],
    tip: 'A high number of unchanged files alongside zero modified files usually means the generation ran but found no setting changes to apply — check if your configuration actually changed before generating.',
  },
};

function HistInfoPanel({ sel }) {
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
                <strong style={{ color: HIST_COLOR, minWidth: '150px', flexShrink: 0 }}>{label}:</strong>
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

function HSel({ id, sel, setSel, children, style, className }) {
  const active = sel === id;
  return (
    <div
      className={className}
      onClick={e => { e.stopPropagation(); setSel(active ? null : id); }}
      style={{
        cursor: 'pointer',
        outline: active ? `2px solid ${HIST_COLOR}` : '2px solid transparent',
        outlineOffset: '2px',
        boxShadow: active ? `0 0 18px ${HIST_GLOW}` : 'none',
        transition: 'outline 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >{children}</div>
  );
}

function HistoryHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected }) {
  const [activeAdvSubTab,setActiveAdvSubTab] = useState('snapshots');

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const sel = HIST_INFO[helpSelected] ?? null;

  return ReactDOM.createPortal(
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div
        className="help-modal"
        style={{ '--tab-color': HIST_COLOR, '--tab-glow': HIST_GLOW, '--tab-glow-strong': HIST_GLOW_STRONG }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">⊞ History — Help Guide</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Tab bar ── */}
        <div className="help-modal-tabs">
          {HIST_HELP_TABS.map(t => (
            <button
              key={t.id}
              className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => { setActiveTab(t.id); setHelpSelected(null); }}
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

                <div style={{ width: '760px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                  {/* ── LEFT COLUMN ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

                    {/* Filter card */}
                    <div className="hist-card" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      <h2 className="hist-section-title" style={{ pointerEvents: 'none' }}>
                        HISTORY
                        <span className="hist-title-badge">4 snapshots</span>
                        <button className="hist-help-btn" style={{ opacity: 0.4 }}>?</button>
                      </h2>

                      {/* Search */}
                      <HSel id="search" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto', marginBottom: 16 }}>
                        <div className="hist-form-group" style={{ pointerEvents: 'none', marginBottom: 0 }}>
                          <label className="hist-form-label">Search</label>
                          <input readOnly onChange={() => {}} className="hist-search-input" placeholder="Filter by map name or tab…"
                            style={{ outline: helpSelected === 'search' ? `2px solid ${HIST_COLOR}` : 'none' }} />
                        </div>
                      </HSel>

                      {/* Filter pills */}
                      <HSel id="filterpills" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                        <div className="hist-filter-row" style={{ pointerEvents: 'none' }}>
                          <button className="hist-filter-pill active" style={{ pointerEvents: 'none' }}>All</button>
                          {['Wreckages','Props','SCMAP Tool'].map(label => (
                            <button key={label} className="hist-filter-pill" style={{ pointerEvents: 'none' }}>{label}</button>
                          ))}
                        </div>
                      </HSel>

                      {/* Clear history */}
                      <HSel id="clearhistory" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto', marginTop: 12 }}>
                        <div className="hist-clear-row" style={{ pointerEvents: 'none' }}>
                          <button className="hist-clear-btn" style={{ pointerEvents: 'none' }}>Clear history</button>
                        </div>
                      </HSel>
                    </div>

                    {/* Entry list card */}
                    <div className="hist-card" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      <h2 className="hist-section-title" style={{ pointerEvents: 'none' }}>
                        ALL GENERATIONS
                        <span className="hist-title-badge">4 entries</span>
                      </h2>
                      <div className="hist-entry-list" style={{ pointerEvents: 'none' }}>
                        {[
                          { map: 'kaali.scmap', ts: '12.06.25  14:32:01', a: 2, r: 0, m: 3, col: '#FFFA00', tab: 'SCMAP Tool', sel: true },
                          { map: 'kaali.scmap', ts: '12.06.25  14:28:44', a: 0, r: 0, m: 1, col: '#a78bfa', tab: 'Wreckages',  sel: false },
                          { map: 'dust_valley', ts: '11.06.25  09:15:22', a: 5, r: 2, m: 0, col: '#f472b6', tab: 'Props',      sel: false },
                          { map: 'twin_rivers', ts: '10.06.25  18:44:59', a: 0, r: 0, m: 0, col: '#60a5fa', tab: 'Emitter',    sel: false },
                        ].map((e, i) => (
                          <HSel key={i} id="entrycard" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                            <div className={`hist-entry-card${e.sel ? ' selected' : ''}`} style={{ pointerEvents: 'none' }}>
                              <div className="hist-entry-header">
                                <div className="hist-entry-dot" style={{ background: e.sel ? e.col : 'transparent', border: `1.5px solid ${e.sel ? e.col : 'rgba(255,255,255,0.12)'}`, color: e.col }} />
                                <div className="hist-entry-info">
                                  <span className="hist-entry-map">{e.map}</span>
                                  <span className="hist-entry-ts">{e.ts}</span>
                                  <div className="hist-entry-badges">
                                    <span className="hist-source-badge" style={{ background:`${e.col}18`, color:e.col, borderColor:`${e.col}30` }}>{e.tab}</span>
                                    {e.a > 0 && <span className="hist-stat-chip add">+{e.a}</span>}
                                    {e.r > 0 && <span className="hist-stat-chip rem">-{e.r}</span>}
                                    {e.m > 0 && <span className="hist-stat-chip mod">~{e.m}</span>}
                                    {e.a+e.r+e.m===0 && <span style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.12)'}}>no changes</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </HSel>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT COLUMN ── */}
                  <div>
                    <div className="hist-card hist-card-fill" style={{ pointerEvents: 'none', userSelect: 'none', minHeight: '500px' }}>

                      {/* Detail header */}
                      <HSel id="detailheader" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                        <div className="hist-detail-header" style={{ pointerEvents: 'none' }}>
                          <div className="hist-detail-dot" style={{ background: '#FFFA00', boxShadow: '0 0 10px #FFFA00' }}/>
                          <div className="hist-detail-info">
                            <div className="hist-detail-map">kaali.scmap</div>
                            <div className="hist-detail-ts">12.06.25  14:32:01</div>
                            <div className="hist-detail-path">…/public/scmap/kaali.scmap/</div>
                            <div className="hist-summary-row">
                              <span className="hist-summary-pill add">+2 added</span>
                              <span className="hist-summary-pill mod">~3 modified</span>
                            </div>
                          </div>
                          <div className="hist-tab-badge" style={{ background: 'rgba(255,250,0,0.1)', color: '#FFFA00', borderColor: 'rgba(255,250,0,0.3)' }}>SCMAP Tool</div>
                        </div>
                      </HSel>

                      {/* File cards */}
                      <div className="hist-detail-scroll" style={{ maxHeight: '320px', pointerEvents: 'none' }}>

                        {/* Added section */}
                        <div className="hist-detail-section">
                          <h3 className="hist-detail-section-title">
                            Added Files
                            <span style={{ fontSize:'0.6rem', padding:'1px 8px', background:'rgba(74,222,128,0.1)', color:'var(--diff-add)', border:'1px solid rgba(74,222,128,0.3)', marginLeft:8, fontWeight:600 }}>2</span>
                          </h3>
                          {['kaali_watermap.dds','kaali_albedo_new.dds'].map((name, i) => (
                            <HSel key={name} id="filecard" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                              <div className="hist-file-row" style={{ pointerEvents: 'none' }}>
                                <span className="hist-file-dot" style={{ background: 'var(--diff-add)' }}></span>
                                <span className="hist-file-name">{name}</span>
                                <span className="hist-file-cat" style={{ color: 'rgba(255,255,255,0.3)' }}>{i===0?'Water':'DDS'}</span>
                                <span className="hist-file-badge added">added</span>
                                <span className="hist-file-size" style={{ color: 'var(--diff-add)' }}>84.2 KB</span>
                              </div>
                            </HSel>
                          ))}
                        </div>

                        {/* Modified section */}
                        <div className="hist-detail-section">
                          <h3 className="hist-detail-section-title">
                            Modified Files
                            <span style={{ fontSize:'0.6rem', padding:'1px 8px', background:'rgba(251,191,36,0.1)', color:'var(--diff-mod)', border:'1px solid rgba(251,191,36,0.3)', marginLeft:8, fontWeight:600 }}>3</span>
                          </h3>
                          {[
                            { name: 'kaali_save.lua',     cat: 'Props Lua', canEdit: true },
                            { name: 'kaali_scenario.lua', cat: 'Lua',       canEdit: true },
                          ].map(f => (
                            <HSel key={f.name} id={f.canEdit ? 'luaeditor' : 'filecard'} sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                              <div className="hist-file-row" style={{ pointerEvents: 'none' }}>
                                <span className="hist-file-dot" style={{ background: 'var(--diff-mod)' }}></span>
                                <span className="hist-file-name">{f.name}</span>
                                <span className="hist-file-cat" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.cat}</span>
                                <span className="hist-file-badge modified">modified</span>
                                <span className="hist-file-size">12.4 KB / 12.7 KB <span style={{ color:'var(--diff-add)',fontWeight:700 }}>(+0.3 KB)</span></span>
                                {f.canEdit && <span className="hist-file-action-hint">click to edit</span>}
                              </div>
                            </HSel>
                          ))}
                          {/* Binary with diff expanded */}
                          <HSel id="diffview" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                            <div style={{ pointerEvents: 'none' }}>
                              <div className="hist-file-row">
                                <span className="hist-file-dot" style={{ background: 'var(--diff-mod)' }}></span>
                                <span className="hist-file-name">kaali_heightmap.raw</span>
                                <span className="hist-file-cat" style={{ color: 'rgba(255,255,255,0.3)' }}>Heightmap</span>
                                <span className="hist-file-badge modified">modified</span>
                                <span className="hist-file-size">132 KB / 132 KB</span>
                              </div>
                              {/* Mini diff preview */}
                              <div style={{ margin: '6px 0 0 20px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                                  <div style={{ padding:'6px 10px', background:'rgba(239,68,68,0.06)', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ color:'rgba(255,255,255,0.3)',marginBottom:4 }}>Before</div>
                                    <div style={{ color:'rgba(239,68,68,0.8)' }}>− prop_count = 142</div>
                                    <div style={{ color:'rgba(255,255,255,0.3)' }}>  version = "1.0"</div>
                                  </div>
                                  <div style={{ padding:'6px 10px', background:'rgba(74,222,128,0.04)' }}>
                                    <div style={{ color:'rgba(255,255,255,0.3)',marginBottom:4 }}>After</div>
                                    <div style={{ color:'rgba(74,222,128,0.8)' }}>+ prop_count = 156</div>
                                    <div style={{ color:'rgba(255,255,255,0.3)' }}>  version = "1.0"</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </HSel>
                        </div>

                        {/* Unchanged */}
                        <div className="hist-detail-section">
                          <h3 className="hist-detail-section-title">
                            Unchanged
                            <span style={{ fontSize:'0.6rem', padding:'1px 8px', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.25)', border:'1px solid rgba(255,255,255,0.1)', marginLeft:8, fontWeight:600 }}>5</span>
                          </h3>
                          <HSel id="unchanged" sel={helpSelected} setSel={setHelpSelected} style={{ pointerEvents: 'auto' }}>
                            <div className="hist-unchanged-pills" style={{ pointerEvents: 'none' }}>
                              {['kaali_normal.dds','kaali_script.lua','kaali_data.lua','kaali_previewimage.dds','kaali_texturemask.dds'].map(n => (
                                <span key={n} className="hist-unchanged-pill">{n}</span>
                              ))}
                            </div>
                          </HSel>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>{/* end 760px grid */}
              </div>{/* end left scrollable */}

              {/* Right: info panel */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: HIST_COLOR }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: '260px', lineHeight: 1.7 }}>
                      Click any card, button, or section in the replica on the left to learn what it does.
                    </div>
                  </div>
                ) : sel ? (
                  <HistInfoPanel sel={sel} />
                ) : null}
              </div>

            </div>
          )}

          {/* ══════════════ ADVANCED GUIDE TAB ══════════════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">
              <div className="help-adv-subtabs">
                {[
                  { id: 'snapshots',  label: 'Snapshots'       },
                  { id: 'diffeditor', label: 'Diff & Editor'   },
                  { id: 'savepack',   label: 'Save & Repack'   },
                  { id: 'storage',    label: 'Storage & Limits'},
                  { id: 'troubleshoot', label: 'Troubleshooting' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveAdvSubTab(t.id)}
                  >{t.label}</button>
                ))}
              </div>

              {/* ─── SNAPSHOTS ─── */}
              {activeAdvSubTab === 'snapshots' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">How snapshots work</h2>
                    <p className="help-adv-hero-desc">
                      Every time you click Generate Files in any toolkit tab, the History system automatically captures the entire state of your scmap folder — before and after the generation. The result is a permanent record of exactly what changed, browsable at any time.
                    </p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      {['Click Generate Files', 'Before snapshot taken', 'Files are generated', 'After snapshot taken', 'Diff computed + saved'].map((s, i) => (
                        <div key={s} style={{ padding: '5px 12px', background: `rgba(255,138,255,${0.03 + i * 0.02})`, border: '1px solid rgba(255,138,255,0.15)', fontSize: '0.72rem', color: HIST_COLOR, letterSpacing: '0.06em', fontFamily: 'monospace' }}>{s}</div>
                      ))}
                    </div>
                    <div className="help-adv-button-hint">Automatic — no action needed</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>What a snapshot contains</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {[
                      { field: 'mapName',    desc: 'Derived from the scmap folder name — e.g. "kaali.scmap" → "kaali".' },
                      { field: 'tabId',      desc: 'The toolkit tab that triggered the generation (e.g. "wreckages", "props", "scmaptool").' },
                      { field: 'timestamp',  desc: 'ISO 8601 timestamp down to the millisecond, generated at commit time.' },
                      { field: 'before',     desc: 'Full snapshot of all files in the scmap folder immediately before generation. Text files include their full content; binary files include size only.' },
                      { field: 'after',      desc: 'Full snapshot of all files immediately after generation. Same structure as before.' },
                      { field: 'diff',       desc: 'Pre-computed diff: { added, removed, modified, unchanged } arrays. Computed once at commit time using diffScmapSnapshots().' },
                      { field: 'summary',    desc: 'Shorthand counts: { added: N, removed: N, modified: N } — used to render the chips in the entry list without re-computing the diff.' },
                    ].map(r => (
                      <div key={r.field} style={{ display: 'flex', gap: '16px', padding: '12px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <code style={{ color: HIST_COLOR, fontFamily: 'monospace', fontSize: '0.8rem', minWidth: '110px', flexShrink: 0, paddingTop: '2px' }}>{r.field}</code>
                        <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Which files are tracked</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
                    The snapshot system reads every file in your scmap output folder using the <code style={{ color: HIST_COLOR }}>scmap-snapshot-folder</code> IPC call. Files are classified into categories based on name and extension, which determines how they are displayed and diffed.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { cat: 'Props Lua',    pattern: 'props*.lua',      diff: 'Full line + char diff' },
                      { cat: 'Data Lua',     pattern: 'data.lua',        diff: 'Full line + char diff' },
                      { cat: 'Lua (other)',  pattern: '*.lua',           diff: 'Full line + char diff' },
                      { cat: 'Heightmap',    pattern: '*heightmap*',     diff: 'Size comparison only' },
                      { cat: 'Normal Map',   pattern: '*normalmap*',     diff: 'Size comparison only' },
                      { cat: 'Water',        pattern: '*watermap*',      diff: 'Size comparison only' },
                      { cat: 'Texture Mask', pattern: '*texturemask*',   diff: 'Size comparison only' },
                      { cat: 'Preview',      pattern: '*previewimage*',  diff: 'Size comparison only' },
                      { cat: 'DDS (other)',  pattern: '*.dds',           diff: 'Size comparison only' },
                      { cat: 'RAW',          pattern: '*.raw',           diff: 'Size comparison only' },
                    ].map(r => (
                      <div key={r.cat} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px' }}>{r.cat}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: HIST_COLOR, marginBottom: '4px' }}>{r.pattern}</div>
                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>{r.diff}</div>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note" style={{ marginTop: '16px' }}>
                    Binary files (DDS, RAW) are tracked by size only — their actual pixel data is not stored in the snapshot. A binary file is marked as "modified" only if its byte size changed. Two identical-looking DDS files with the same size will appear as "unchanged" even if pixel values differ.
                  </div>
                </div>
              </>)}

              {/* ─── DIFF & EDITOR ─── */}
              {activeAdvSubTab === 'diffeditor' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">The diff viewer and Lua editor</h2>
                    <p className="help-adv-hero-desc">
                      Modified text files show a side-by-side diff with line- and character-level highlights. Lua files go one step further — they open in a full-screen split editor where you can read, compare, and directly edit the current file content.
                    </p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Reading the side-by-side diff</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '24px' }}>
                    {[
                      { color: 'rgba(239,68,68,0.8)',  label: 'Red line (left pane)',  desc: 'A line that existed before but was removed or replaced. The red bar in the gutter (−) confirms it.' },
                      { color: 'rgba(74,222,128,0.8)', label: 'Green line (right pane)',desc: 'A line that was added or replaced. The green bar in the gutter (+) confirms it.' },
                      { color: 'rgba(255,255,255,0.3)', label: 'Dimmed equal line',    desc: 'A line that is identical in both versions. Shown for context only.' },
                      { color: 'rgba(255,255,255,0.1)', label: 'Hatched empty cell',   desc: 'One side has a line here, the other does not — typically when a block of lines was inserted or deleted without a 1:1 replacement.' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', gap: '16px', padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ minWidth: '160px', flexShrink: 0, color: r.color, fontSize: '0.82rem', fontWeight: 700 }}>{r.label}</div>
                        <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{r.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note" style={{ marginTop: '16px' }}>
                    When a line was replaced (one removed + one added at the same position), a character-level diff is applied on top. Red strikethrough highlights the exact characters that were deleted within that line; green background shows what was inserted. This makes it easy to spot single-word or single-value changes in dense Lua tables.
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>The Lua split editor</h3>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,138,255,0.15)', padding: '0', marginTop: '24px', overflow: 'hidden' }}>
                    {/* Mock editor titlebar */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#fff' }}>kaali_save.lua</span>
                        <span style={{ fontSize: '0.62rem', padding: '1px 8px', background: 'rgba(255,138,255,0.12)', color: HIST_COLOR, border: `1px solid ${HIST_COLOR}30` }}>unsaved</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ padding: '4px 14px', background: HIST_COLOR, color: '#000', fontSize: '0.72rem', fontWeight: 700 }}>Save & Repack</div>
                        <div style={{ padding: '4px 10px', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>✕</div>
                      </div>
                    </div>
                    {/* Mock pane headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ padding: '6px 14px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.7rem', background: 'rgba(239,68,68,0.05)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--diff-rem)', display: 'inline-block' }}></span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>BEFORE</span>
                        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>1,248 lines</span>
                        <span style={{ padding: '1px 6px', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>read-only</span>
                      </div>
                      <div style={{ padding: '6px 14px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.7rem', background: 'rgba(74,222,128,0.04)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--diff-add)', display: 'inline-block' }}></span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>AFTER</span>
                        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>1,264 lines</span>
                        <span style={{ padding: '1px 6px', border: '1px solid rgba(74,222,128,0.3)', color: 'rgba(74,222,128,0.6)', fontSize: '0.6rem' }}>editable</span>
                      </div>
                    </div>
                    {/* Mock code lines */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: '20px' }}>
                      {[
                        { l: '  ...', r: '  ...', ld: false, rd: false },
                        { l: "  ['ARMY_1'] = {", r: "  ['ARMY_1'] = {", ld: false, rd: false },
                        { l: '    position = VECTOR3(128, 0, 256),', r: '    position = VECTOR3(192, 0, 320),', ld: true, rd: true },
                        { l: '  },', r: '  },', ld: false, rd: false },
                        { l: '  ...', r: '  ...', ld: false, rd: false },
                      ].map((row, i) => (
                        <React.Fragment key={i}>
                          <div style={{ padding: '0 14px', background: row.ld ? 'rgba(239,68,68,0.08)' : 'transparent', borderRight: '1px solid rgba(255,255,255,0.05)', color: row.ld ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.35)' }}>
                            {row.ld ? '−' : ' '} {row.l}
                          </div>
                          <div style={{ padding: '0 14px', background: row.rd ? 'rgba(74,222,128,0.06)' : 'transparent', color: row.rd ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.35)' }}>
                            {row.rd ? '+' : ' '} {row.r}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {/* Mock status bar */}
                    <div style={{ padding: '4px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '12px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.3)' }}>
                      <span>Lua</span><span>|</span><span>1,248 lines before</span><span>|</span><span>1,264 lines after</span><span>|</span><span style={{ color: 'var(--diff-add)' }}>+16 added</span><span>|</span><span style={{ color: 'var(--diff-rem)' }}>−0 removed</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {[
                      ['How to edit', 'Click anywhere in the right (AFTER) pane and type. The background caret is pink/magenta. The pane is a transparent textarea overlaid on the syntax-highlighted layer — it is a real browser text input.'],
                      ['Scroll sync', 'Scrolling either pane moves both simultaneously. This keeps the before and after versions aligned so you can compare corresponding lines at a glance.'],
                      ['Performance', 'Both panes use virtualised rendering — only lines within ±60 rows of the current scroll position are rendered. Files with 10,000+ lines open instantly and scroll smoothly.'],
                      ['Syntax highlighting', 'Applied client-side using a hand-rolled Lua tokeniser. Keywords (blue), strings (orange), numbers (light green), comments (dark green), operators (grey), identifiers (light blue). The highlight layer is updated on every keystroke.'],
                    ].map(([label, desc]) => (
                      <div key={label} style={{ display: 'flex', gap: '14px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <strong style={{ color: HIST_COLOR, fontSize: '0.82rem', minWidth: '150px', flexShrink: 0 }}>{label}</strong>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── SAVE & REPACK ─── */}
              {activeAdvSubTab === 'savepack' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Save & Repack — editing Lua files in-place</h2>
                    <p className="help-adv-hero-desc">
                      The History tab is not just a read-only viewer. When you edit a Lua file in the split editor and click Save & Repack, your changes are written to disk and the entire scmap folder is immediately repacked into a fresh .scmap binary — no need to switch to the SCMAP Tool tab.
                    </p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>What happens step by step</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'You make a change in the AFTER pane', desc: 'The "Save & Repack" button activates (turns pink/magenta) as soon as the text in the right pane differs from the last saved version. The "unsaved" badge appears in the title bar.', subs: ['The button is disabled if the text matches the last saved state — no accidental double-saves', 'If folderPath is null (the file path is not known), the button stays inactive even with changes'] },
                      { n: '02', title: 'Click Save & Repack', desc: 'Two things happen in sequence. First the edited Lua content is written to disk. Then the parent folder is immediately repacked into a .scmap binary using the same scmap-pack IPC call as the SCMAP Tool tab.', subs: ['Write: IPC write-file writes the textarea content to the .lua file at folderPath', 'Pack: IPC scmap-pack uses the same scmapUtils.writeDatastream() as the Pack panel', 'Both steps are awaited — if either fails, the error appears at the top of the editor and repacking is skipped'] },
                      { n: '03', title: 'A new History snapshot is created', desc: 'After a successful save + repack, the History system takes a fresh before/after snapshot of the scmap folder and commits it as a new entry tagged "history-editor". This means your manual edit is visible in the History list just like any other generation run.', subs: ['The new entry appears under the "History" filter pill', 'It shows the diff between the state before your edit and the state after', 'This creates a full audit trail: original file → generated file → manually edited file'] },
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
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>↩ Undo — restoring a previous state</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '16px' }}>
                    Modified Lua files in the detail panel have an ↩ Undo button. Clicking it does not revert to the before-snapshot text in the editor — it writes the before-snapshot content back to disk and repacks, the same as Save & Repack but in reverse.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      ['What "before" means', 'The before-snapshot is the file state recorded just before the generation run that created this history entry. Undo restores the file to exactly that state.'],
                      ['Confirmation step',   'Clicking ↩ Undo changes the button to a "Zustand wiederherstellen?" prompt with Yes/Cancel. This prevents accidental clicks.'],
                      ['Creates a new snapshot', 'Undo itself is tracked — a new History entry is created after the restore, so you can see the undo in the diff list.'],
                      ['Only works for Lua',  'Binary files (DDS, RAW) do not have an Undo button — their before-state is tracked as size only, not pixel data, so byte-accurate restoration is not possible.'],
                    ].map(([label, desc]) => (
                      <div key={label} style={{ display: 'flex', gap: '14px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <strong style={{ color: HIST_COLOR, fontSize: '0.82rem', minWidth: '170px', flexShrink: 0 }}>{label}</strong>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── STORAGE & LIMITS ─── */}
              {activeAdvSubTab === 'storage' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Storage, limits & persistence</h2>
                    <p className="help-adv-hero-desc">
                      Snapshots are saved to a JSON file in the Electron userData folder — not in the browser's localStorage. This means history persists across app restarts and is not subject to browser storage quotas.
                    </p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Where data is stored</h3>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,138,255,0.15)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, marginTop: '24px', color: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>// Location on Windows:</div>
                    <div><span style={{ color: HIST_COLOR }}>C:\Users\&lt;you&gt;\AppData\Roaming\ForgeMapToolkit\</span>scmap-history.json</div>
                    <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.3)' }}>// Location on macOS:</div>
                    <div><span style={{ color: HIST_COLOR }}>~/Library/Application Support/ForgeMapToolkit/</span>scmap-history.json</div>
                    <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.3)' }}>// IPC channels used:</div>
                    <div>window.electronAPI.invoke(<span style={{ color: HIST_COLOR }}>'history-load'</span>)  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'// → { data: {} }'}</span></div>
                    <div>window.electronAPI.invoke(<span style={{ color: HIST_COLOR }}>'history-save'</span>, {'{'} data {'}'})  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{'// → { success: true }'}</span></div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Limits</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {[
                      { label: 'Max entries per tab', value: '10', note: 'Defined by MAX_ENTRIES in ScmapHistoryTracker.js. When a tab reaches 10 entries and a new one is committed, the oldest entry is automatically dropped from memory and disk.' },
                      { label: 'Text content stored', value: 'Full file content', note: 'Every text file (Lua) in the scmap folder has its full content stored in both the before and after snapshots. For large maps with many Lua files, one snapshot can easily be 200–500 KB of JSON.' },
                      { label: 'Binary content stored', value: 'Size only (bytes)', note: 'DDS, RAW, and other binary files are tracked by byte size only. The actual file data is not stored in the snapshot — this keeps the JSON file manageable.' },
                      { label: 'Total file size', value: 'Unbounded (practical ~10 MB)', note: 'With 10 entries per tab × 11 tabs and large Lua files, the JSON could grow to several MB. There is no automatic size cap beyond the per-tab entry limit.' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', gap: '16px', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ minWidth: '180px', flexShrink: 0 }}>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px' }}>{r.label}</div>
                          <div style={{ fontFamily: 'monospace', color: HIST_COLOR, fontSize: '0.78rem' }}>{r.value}</div>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{r.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="help-adv-note" style={{ marginTop: '16px' }}>
                    If the history file grows very large and the app starts loading slowly, manually delete scmap-history.json from the userData folder. The app will start fresh with an empty history on next launch.
                  </div>
                </div>
              </>)}

              {/* ─── TROUBLESHOOTING ─── */}
              {activeAdvSubTab === 'troubleshoot' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Common issues</h2>
                    <p className="help-adv-hero-desc">
                      Issues specific to the History tab — snapshot not appearing, editor not saving, undo not working, and history being empty on restart.
                    </p>
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Snapshot & display issues</h3>
                  {[
                    [
                      'No snapshot appears after I clicked Generate Files',
                      'Either the generate run failed before completion (check the generating tab\'s log for a red error), or the scmap-snapshot-folder IPC call failed silently when reading the folder. Also check that the scmap folder path exists — snapshots are only committed when both before and after reads succeed.',
                      'Check the toolkit\'s DevTools console (View → Developer Tools) for any "[ScmapHistory]" warning lines. If the folder path is wrong or missing, no snapshot is recorded.',
                    ],
                    [
                      'History is empty after restarting the app',
                      'The history file either does not exist yet (no snapshots have been saved), or the history-load IPC call returned an error on startup.',
                      'Generate Files at least once with a valid scmap folder. Check the userData folder for scmap-history.json after generating. If the file exists but history is still empty, check DevTools for history-load errors.',
                    ],
                    [
                      '"All generations" shows entries from unexpected tabs',
                      'The "All" filter shows snapshots from every tab that has history — including "History" itself (from Save & Repack runs). This is expected behavior.',
                      'Use a specific tab filter pill to narrow the view. The colored badge on each entry card tells you which tab generated it.',
                    ],
                  ].map(([q, cause, fix]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: HIST_COLOR }}>{q}</strong></div>
                      <div className="help-adv-ts-a">
                        <p style={{ marginBottom: '8px' }}>{cause}</p>
                        <p style={{ color: 'rgba(180,255,180,0.65)' }}><strong>Fix: </strong>{fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Editor & save issues</h3>
                  {[
                    [
                      '"Save & Repack" button stays grey/inactive after editing',
                      'The button only activates when the text has actually changed from the last saved state AND folderPath is not null. If you typed something and then deleted it back to the original, the button correctly deactivates. If folderPath is null, the file source is unknown and saving is not possible.',
                      'Check whether the snapshot has a folderPath by looking at the detail header — the folder path is shown below the map name. If it is missing, the history entry was recorded without folder information (older format or a failed snapshot read).',
                    ],
                    [
                      'Save works but the .scmap does not seem to update in FA',
                      'The Save & Repack call packs the extracted scmap folder, but this writes to packed/ — not back to your game maps folder. Copy-back only happens automatically if mapsFolder is set in Settings.',
                      'After Save & Repack, check the SCMAP Tool pack log. If copy-back did not run, set mapsFolder in Settings and re-pack from the SCMAP Tool tab, or manually copy the packed .scmap to your game folder.',
                    ],
                    [
                      '↩ Undo button shows but clicking it does nothing visible',
                      'The undo ran but the before-state content was identical to the current file content — nothing changed on disk.',
                      'This happens if you ran undo on a snapshot where the before and after states were actually the same for this particular file. Check the diff — if the file shows 0 line changes, undo has no meaningful effect.',
                    ],
                  ].map(([q, cause, fix]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon">▸</span><strong style={{ color: HIST_COLOR }}>{q}</strong></div>
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
    </>,
    document.body
  );
}

export default HistoryHelpModal;
