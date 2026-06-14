import React from 'react';
import '../shared.css';
import '../trace.css';
import '../design-system/index.css';
import './entity-console.css';

/**
 * ENTITY CONSOLE — the reusable Fable5 register-entry toolkit.
 *
 * One source of truth for the pieces that every emitter-style tab shares:
 * the selectable colour-coded card, its coordinate register, the add-tile,
 * the matching-mode selector, the output checklist, the emitter-category
 * assignment overlay and the map preview instrument. Lifted verbatim from
 * the WreckageTab gold standard and parameterised so PropsTab (or any
 * future tab) renders deckungsgleich — only --tab-color changes the hue.
 *
 * Nothing here owns business logic; every mutation flows back through
 * callbacks supplied by the host tab.
 */

/* ── EntityCardGrid — the vertical stack of cards ─────────────────── */

export const EntityCardGrid = ({ children }) => (
  <div className="ec-card-grid">{children}</div>
);

/* ── AddTile — the "+ add another" socket at the foot of the grid ─── */

export const AddTile = ({ label, onClick }) => (
  <div className="ec-add-tile" onClick={onClick}>
    <div className="ec-add-tile-icon">+</div>
    <span className="ec-add-tile-label">{label}</span>
  </div>
);

/* ── EntityCard — one selectable, colour-coded register entry ───────
   Shell only: header (swatch + title + delete), optional colour-picker
   strip, then whatever body the tab passes as children. */

export const EntityCard = ({
  color,
  index = 0,
  selected = false,
  onSelect,
  title,
  onDelete,
  availableColors = [],
  showColorPicker = false,
  onToggleColorPicker,
  onPickColor,
  children,
}) => (
  <div
    className={`ec-card${selected ? ' selected' : ''}`}
    style={{ '--row-i': index, '--uc-color': color }}
    onClick={onSelect}
  >
    <div className="ec-card-header">
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <div
          className="ec-card-dot"
          style={{ backgroundColor: color }}
          onClick={onToggleColorPicker ? (e) => { e.stopPropagation(); onToggleColorPicker(e); } : undefined}
        />
        <span className="ec-card-title">{title}</span>
      </div>
      <button className="delete-button" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
    </div>

    {showColorPicker && (
      <div className="ec-color-picker" onClick={(e) => e.stopPropagation()}>
        <div className="ec-color-grid">
          {availableColors.map((c, i) => (
            <div
              key={i}
              className="ec-color-swatch"
              style={{ backgroundColor: c.color }}
              onClick={() => onPickColor(c.color)}
              title={c.name}
            />
          ))}
        </div>
      </div>
    )}

    {children}
  </div>
);

/* ── CoordinateList — the collapsible point register inside a card ──
   `fields` is an array of rows; each row is an array of
   { key, label, placeholder }. Wreckage uses two rows (x/y/z and
   heading/pitch/roll); Props uses one (x/y/z). */

export const CoordinateList = ({
  coordinates,
  fields,
  open,
  onToggle,
  labelFor,
  onUpdate,
  onDelete,
  onAdd,
  onDeleteAll,
  hasPlaced,
  addLabel = 'Add Coordinate',
}) => {
  const count = coordinates.filter(c => c.x && c.z).length;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="trace-subsection" onClick={onToggle}>
        Coordinates ({count})
      </div>
      {open && (<>
        {coordinates.map((coord, ci) => (
          <div key={ci} className={`ec-coord-entry${coord.isMirrored ? ' mirror' : ''}`}>
            <div className="ec-coord-label-row">
              <span>{labelFor(coord, ci)}</span>
              <button className="delete-button" onClick={() => onDelete(ci)}>×</button>
            </div>
            {fields.map((row, ri) => (
              <div key={ri} className="ec-coord-grid" style={ri > 0 ? { marginTop: '8px' } : undefined}>
                {row.map(f => (
                  <div key={f.key} className="ec-coord-field">
                    <label>{f.label}</label>
                    <input
                      type="text"
                      className="field-input field-input--sm"
                      value={coord[f.key] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => onUpdate(ci, f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="action-button" style={{ flex: 1 }} onClick={onAdd}>{addLabel}</button>
          {hasPlaced && (
            <button className="action-button action-button--danger" onClick={onDeleteAll}>Delete All</button>
          )}
        </div>
      </>)}
    </div>
  );
};

/* ── MatchingMode — emitter-matching strategy picker ────────────────
   `modes` = [{ key, label, desc, note }]. Selection is signalled by the
   station lift (no radio dot), exactly as the gold standard. */

export const MatchingMode = ({
  modes,
  value,
  onChange,
  onConfigure,
  configureLabel = 'Configure Emitter-Category Assignment',
}) => (
  <>
    <div style={{ marginBottom: '16px' }}>
      {modes.map(({ key, label, desc, note }) => (
        <div
          key={key}
          className={`station option-row${value === key ? ' active' : ''}`}
          onClick={() => onChange(key)}
        >
          <div className="option-row-head">
            <div className={`option-radio${value === key ? ' on' : ''}`}>
              {value === key && <div className="option-radio-dot" />}
            </div>
            <span className="option-label">{label}</span>
          </div>
          <div className="option-desc">{desc}</div>
          <em className="option-note">{note}</em>
        </div>
      ))}
    </div>
    <button className="action-button action-button--full" onClick={onConfigure}>
      {configureLabel}
    </button>
  </>
);

/* ── OutputChecklist — README/raw toggles + the signature commit CTA ─
   Uses the shared SVG checkmark (not a square) and the three-layer
   commit-button. `items` = [{ label, checked, onToggle }]. */

export const OutputChecklist = ({
  items,
  commitLabel,
  ready,
  readyText = 'Ready',
  notReadyText = 'Not Ready',
  onCommit,
  commitAriaLabel,
}) => (
  <>
    {items.map((it, i) => (
      <label
        key={i}
        className="checkbox-label"
        style={{ marginBottom: i < items.length - 1 ? '12px' : '20px', cursor: 'pointer' }}
        onClick={it.onToggle}
      >
        <div className={`checkbox${it.checked ? ' checked' : ''}`}>
          {it.checked && (
            <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="checkbox-text">{it.label}</span>
      </label>
    ))}
    <button
      className="commit-button"
      disabled={!ready}
      onClick={ready ? onCommit : undefined}
      aria-label={commitAriaLabel}
    >
      <span className="commit-button-label">{commitLabel}</span>
      <span className="commit-button-status">{ready ? readyText : notReadyText}</span>
      <span className="commit-button-bloom" aria-hidden="true" />
      <span className="commit-button-line" aria-hidden="true" />
    </button>
  </>
);

/* ── EmitterAssignmentOverlay — full-bleed category↔emitter register ─
   Not a modal. A full-screen register printed on the same instrument
   plate as the home screen and the tabs (28px dot grid + accent hue
   bleed). Left: the matrix — a printed section header (eyebrow → hero
   title → trace filament → desc) above per-category station grids,
   where an active emitter LIFTS and ignites its top tick (the matching-
   mode mechanic). Right: the live-preview rail in the tab's own
   preview-panel grammar (accent edge), holding resting entity cards.
   Nothing carries a box; the commit-button closes (Generate-Files
   grammar). Everything recolors from the inherited --tab-color.

   `colorVars` — the host passes the three --tab-* tokens for its hue.
   `tabVar` — fallback when no colorVars: a tab accent var name like
   '--emitter-color', from which the three tokens are derived. */

export const EmitterAssignmentOverlay = ({
  entities,
  getEntityTitle,
  getEntityColor,
  getEntityCategories,
  getEmittersForEntity,
  categories,
  emitters,
  isActive,
  onToggle,
  getName,
  entityNoun = 'unit',
  tabVar = '--tab-color',
  colorVars: colorVarsProp,
  onClose,
  title = 'Assignment',
}) => {
  const base = tabVar.replace(/-color$/, '');
  const colorVars = colorVarsProp ?? {
    '--tab-color':       `var(${base}-color)`,
    '--tab-glow':        `var(${base}-glow)`,
    '--tab-glow-strong': `var(${base}-glow-strong)`,
  };

  // Escape closes — the overlay is full-bleed, there is no backdrop to click.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const plural   = entityNoun + 's';
  const noCats    = categories.length === 0;
  const noEmitters = emitters.length === 0;
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="eao-overlay" style={colorVars}>
      <div className="eao-wrap">

        {/* ── Matrix column ── */}
        <div className="eao-main">
          <div className="section-eyebrow">EMITTER REGISTER — CATEGORY ASSIGNMENT</div>
          <h2 className="section-title">{title}</h2>
          <div className="section-trace" aria-hidden="true">
            <div className="section-trace-line" />
            <div className="section-trace-hot" />
          </div>
          <p className="section-desc">
            Control which emitters drive each category. A {entityNoun} inherits every
            emitter left active for its categories — engage a station to remove it.
          </p>

          {noCats ? (
            <div className="ec-empty-state" style={{ padding: 'var(--space-3xl) var(--space-md)', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', color: 'var(--ink-55)' }}>No {entityNoun} categories defined</p>
              <span className="field-hint">Add categories to your {plural} first, then assign emitters here.</span>
            </div>
          ) : noEmitters ? (
            <div className="ec-empty-state" style={{ padding: 'var(--space-3xl) var(--space-md)', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', color: 'var(--ink-55)' }}>No emitters configured</p>
              <span className="field-hint">Add emitter paths in the Configuration section first.</span>
            </div>
          ) : (
            categories.map((category, catIdx) => {
              const activeCount = emitters.filter(p => isActive(p, category)).length;
              return (
                <div key={catIdx} className="eao-group">
                  <div className="subsection-head">
                    <span className="subsection-head-title">{category}</span>
                    <span className="eao-group-count">{pad(activeCount)} / {pad(emitters.length)}</span>
                  </div>
                  <div className="eao-emitter-grid">
                    {emitters.map((path, eIdx) => {
                      const active = isActive(path, category);
                      return (
                        <div
                          key={eIdx}
                          className={`station eao-emitter${active ? ' active' : ''}`}
                          onClick={() => onToggle(path, category)}
                          title={path}
                        >
                          <span className="eao-emitter-label">{getName(path)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div className="eao-foot">
            <button className="commit-button" onClick={onClose} aria-label="Done — close assignment">
              <span className="commit-button-label">Done</span>
              <span className="commit-button-status">Changes applied live</span>
              <span className="commit-button-bloom" aria-hidden="true" />
              <span className="commit-button-line" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Live-preview rail ── */}
        <aside className="eao-side" aria-label="Live preview">
          <div className="eao-side-head">
            <span className="eao-side-cap">Live Preview</span>
          </div>
          <div className="eao-side-body">
            {entities.map((entity, idx) => {
              const applicable = getEmittersForEntity(entity);
              const cats  = (getEntityCategories(entity) || []).filter(c => c.trim());
              const color = getEntityColor(entity);
              return (
                <div key={entity.id ?? idx} className="ec-card" style={{ cursor: 'default', '--uc-color': color }}>
                  <div className="ec-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div className="ec-card-dot" style={{ backgroundColor: color }} />
                      <span className="ec-card-title">{getEntityTitle(entity, idx)}</span>
                    </div>
                  </div>
                  {cats.length > 0 && (
                    <div className="eao-pv-cats">{cats.join(' · ')}</div>
                  )}
                  {applicable.length > 0 ? (
                    applicable.map((p, i) => (
                      <div key={i} className="eao-pv-emitter" title={p}>{getName(p)}</div>
                    ))
                  ) : (
                    <div className="eao-pv-warn">No matching emitters</div>
                  )}
                </div>
              );
            })}
            {entities.length === 0 && (
              <div className="ec-empty-state">No {plural} configured yet.</div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
};

/* ── MapPreview — upload + recessed canvas well + legend + hint ──────
   The same instrument in both tabs. Markers/legend/hint are supplied by
   the host; the readout + scanline are CSS-driven and optional. */

export const MapPreview = ({
  previewLoading,
  previewImageData,
  onUploadClick,
  fileInputRef,
  onImageUpload,
  canvasRef,
  canvasSize = 1024,
  onCanvasClick,
  containerRef,
  onCanvasMove,
  onCanvasLeave,
  readoutRef,
  markers = [],
  onMarkerDelete,
  markerTitle = () => '',
  showPlaceholder,
  placeholder,
  legendTitle,
  legendRows = [],
  hint,
}) => (
  <>
    {previewLoading ? (
      <div className="ec-upload" style={{ pointerEvents: 'none', opacity: 0.6 }}>
        <span>Loading preview from .scmap…</span>
      </div>
    ) : (
      <div
        className="ec-upload"
        onClick={onUploadClick}
        title={previewImageData ? 'Click to replace preview image' : 'Click to upload map image'}
      >
        <span>{previewImageData ? 'Replace Map Image' : 'Upload Map Image'}</span>
        <input ref={fileInputRef} type="file" className="ec-file-input" accept="image/*" onChange={onImageUpload} />
      </div>
    )}

    <div
      ref={containerRef}
      className="ec-canvas-wrap"
      style={{ width: '100%', aspectRatio: '1' }}
      onMouseMove={onCanvasMove}
      onMouseLeave={onCanvasLeave}
    >
      <canvas
        ref={canvasRef}
        className="ec-canvas"
        width={canvasSize}
        height={canvasSize}
        onClick={onCanvasClick}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div className="ec-canvas-scan" aria-hidden="true" />
      <div className="ec-canvas-readout" ref={readoutRef}>— · —</div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        {markers.map(marker => (
          <div
            key={marker.id}
            onClick={(e) => { e.stopPropagation(); onMarkerDelete(marker); }}
            style={{
              position: 'absolute',
              left: `${marker.x}%`,
              top: `${marker.z}%`,
              transform: 'translate(-50%, -50%)',
              width: marker.isSelected ? '16px' : '12px',
              height: marker.isSelected ? '16px' : '12px',
              borderRadius: '50%',
              backgroundColor: marker.color,
              border: marker.isSelected ? '3px solid white' : '2px solid white',
              boxShadow: `0 0 ${marker.isSelected ? '20px' : '15px'} ${marker.color}, 0 0 ${marker.isSelected ? '10px' : '5px'} rgba(255,255,255,0.5)`,
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            title={markerTitle(marker)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
              e.currentTarget.style.boxShadow = `0 0 30px ${marker.color}, 0 0 15px rgba(255,255,255,0.8)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
              e.currentTarget.style.boxShadow = `0 0 ${marker.isSelected ? '20px' : '15px'} ${marker.color}, 0 0 ${marker.isSelected ? '10px' : '5px'} rgba(255,255,255,0.5)`;
            }}
          >
            {marker.isMirrored && (
              <div style={{ position: 'absolute', inset: '-2px', borderLeft: '2px solid white', borderTop: '2px solid white' }} />
            )}
          </div>
        ))}
      </div>

      {showPlaceholder && (
        <div className="ec-canvas-placeholder">{placeholder}</div>
      )}
    </div>

    <div className="ec-legend">
      <div className="ec-legend-title">{legendTitle}</div>
      <div className="ec-legend-list">
        {legendRows.map((row, idx) => (
          <div key={row.id ?? idx} className="ec-legend-row" style={{ '--row-i': idx, '--dot-c': row.color }}>
            <div className="ec-legend-dot" style={{ backgroundColor: row.color }} />
            <span>{row.label}</span>
            <span className="ec-legend-pts">{row.pts} pts</span>
          </div>
        ))}
      </div>
    </div>

    <div className="ec-hint">{hint}</div>
  </>
);
