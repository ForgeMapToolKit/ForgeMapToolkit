import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../../shared.css';
import '../../trace.css';
import '../../DesignSystem/index.css';
import './EntityPanel.css';
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
      <button className="ctrl-btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
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
              <button className="ctrl-btn-delete" onClick={() => onDelete(ci)}>×</button>
            </div>
            {fields.map((row, ri) => (
              <div key={ri} className="ec-coord-grid" style={ri > 0 ? { marginTop: '8px' } : undefined}>
                {row.map(f => (
                  <div key={f.key} className="ec-coord-field">
                    <label>{f.label}</label>
                    <input
                      type="text"
                      className="ctrl-input"
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
        <div className="ctrl-action-row" style={{ marginTop: 'var(--space-sm)' }}>
          <button className="ctrl-btn-add" onClick={onAdd}>{addLabel}</button>
          {hasPlaced && (
            <button className="ctrl-btn-danger" onClick={onDeleteAll}>Delete All</button>
          )}
        </div>
      </>)}
    </div>
  );
};

/* ── OutputChecklist — the Output section in full staircase grammar ──
   Two ctrl-blocks: "Generate Options" (ctrl-toggle switches) and
   "Generate Files" (the signature three-layer commit CTA — the primary
   button). `items` = [{ label, sub?, checked, onToggle }]. The subtitle
   labels are overridable so non-wreckage tabs can rename them. */

export const OutputChecklist = ({
  items,
  commitLabel,
  ready,
  readyText = 'Ready',
  notReadyText = 'Not Ready',
  onCommit,
  commitAriaLabel,
  optionsLabel = 'Generate Options',
  filesLabel = 'Generate Files',
}) => (
  <div className="ctrl-col">

    {/* ── Block 1: Generate Options ── */}
    <div className="ctrl-block">
      <div className="ctrl-subtitle">{optionsLabel}</div>
      <div className="ctrl-content">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            className={`ctrl-toggle-row${it.checked ? ' on' : ''}`}
            role="switch"
            aria-checked={it.checked}
            onClick={it.onToggle}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">{it.label}</span>
              {it.sub && <span className="ctrl-toggle-sub">{it.sub}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>

    {/* ── Block 2: Generate Files — primary CTA ── */}
    <div className="ctrl-block">
      <div className="ctrl-subtitle">{filesLabel}</div>
      <div className="ctrl-content">
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
      </div>
    </div>

  </div>
);

/* ── LegendRail — collapsible legend anchored to the canvas edge ──────
   A spine tab (always reachable) + a panel of collapsed unit cards that
   grows into the void beside the canvas. Each card is the entity in a
   second density: square hue swatch + name + placed-point count. Hover a
   card → its markers ignite on the canvas (and back); click → select.
   Portaled by MapPreview into .preview-panel so it escapes the body clip. */

const LegendRail = ({
  title = 'Legend', rows = [], collapsed, onToggle,
  selectedId, onSelect,
}) => (
  <div className={`ec-legend-rail${collapsed ? ' collapsed' : ''}`}>
    <button
      type="button"
      className="ec-legend-spine"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Show legend' : 'Hide legend'}
    >
      <span className="ec-legend-spine-chev" aria-hidden="true">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M6 1.5 L3 4.5 L6 7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        </svg>
      </span>
      <span className="ec-legend-spine-txt">{title}</span>
      <span className="ec-legend-spine-count">{rows.length}</span>
    </button>

    <div className="ec-legend-panel">
      <div className="ec-legend-panel-head">{title}</div>
      <div className="ec-legend-cards">
        {rows.map((row, idx) => (
          <div
            key={row.id ?? idx}
            className={`ec-legend-card${row.id === selectedId ? ' selected' : ''}`}
            style={{ '--uc-color': row.color }}
            onClick={() => onSelect?.(row.id, idx)}
          >
            <span className="ec-card-dot" style={{ backgroundColor: row.color }} />
            <div className="ec-legend-card-info">
              <span className="ec-legend-card-name">{row.label}</span>
              {row.meta && <span className="ec-legend-card-meta">{row.meta}</span>}
            </div>
            {row.pts != null && <span className="ec-legend-card-count">{row.pts}</span>}
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Dropdown — custom dropdown replacing native <select>s across every
   placement tab. Gives full control over panel background, option
   spacing, and selected-state styling that Chromium's native OS widget
   ignores via CSS. `options` = [{ value, label }]. ──────────────────── */

export const Dropdown = ({ options, value, onChange, triggerRef, ariaLabel = 'Select option' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="wr-mirror-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        className={`wr-mirror-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="wr-mirror-label">{selected?.label}</span>
        <svg className="wr-mirror-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square"/>
        </svg>
      </button>

      {open && (
        <ul className="wr-mirror-panel" role="listbox" aria-label={ariaLabel}>
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`wr-mirror-option${opt.value === value ? ' selected' : ''}`}
              onMouseDown={() => pick(opt.value)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── MirrorDropdown — Dropdown preset for the canvas-header mirror-mode
   control. Kept as its own export since every placement tab imports it
   by name. ───────────────────────────────────────────────────────────── */

const MIRROR_OPTIONS = [
  { value: 'none',       label: 'No Mirror' },
  { value: 'diagonal',   label: 'Diagonal'  },
  { value: 'horizontal', label: 'Horizontal'},
  { value: 'vertical',   label: 'Vertical'  },
];

export const MirrorDropdown = ({ value, onChange, triggerRef }) => (
  <Dropdown options={MIRROR_OPTIONS} value={value} onChange={onChange} triggerRef={triggerRef} ariaLabel="Mirror mode" />
);

/* ── EmitterToggleBlock — per-entity direct emitter list with source ─
   Default collapsed (trace-subsection pattern). Extracted from the
   WreckageTab gold standard so every placement tab (Wreckage, Props, …)
   shares the exact same emitter-assignment mechanic: no separate
   matching-mode tab, just toggles living inside the card.

   Source model (declare + dropdown):
     · A card can be DECLARED a source via the "Use as source" toggle. Its
       own emitter selection becomes the template other cards can adopt.
     · A non-source card picks a declared source from the "Inherit from"
       dropdown and follows it live; its own toggles go read-only.
     · The two states are mutually exclusive — a source defines, a follower
       inherits.

   `entity` reads/writes three fields regardless of host tab semantics:
   `unitEmitters` (own active emitter paths), `isEmitterSource`,
   `emitterSourceId`. `labelOf(entity, idx)` renders the card's display
   name for the source dropdown. */

export function EmitterToggleBlock({
  entity, entityIdx, allEntities,
  configuredEmitters, getEmitterName, labelOf,
  onToggleEmitter, onSetSource, onClearSource, onSetIsSource,
}) {
  const [open, setOpen] = useState(false);
  const validPaths = configuredEmitters.filter(p => p.trim());

  const isSource = !!entity.isEmitterSource;

  // Other cards declared as sources — the dropdown pool.
  const sources = allEntities.filter(e => e.id !== entity.id && e.isEmitterSource);
  const sourceEntity = !isSource && entity.emitterSourceId != null
    ? allEntities.find(e => e.id === entity.emitterSourceId)
    : null;

  // Effective emitter set: a follower mirrors its source, otherwise own.
  const effectiveEmitters = sourceEntity
    ? (sourceEntity.unitEmitters || [])
    : (entity.unitEmitters || []);

  const activeCount = effectiveEmitters.filter(p => validPaths.includes(p)).length;
  const readOnly = !!sourceEntity;

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 'var(--space-2xl)' }}>
      <div className="trace-subsection" onClick={() => setOpen(o => !o)}>
        Emitters ({activeCount} / {validPaths.length}){isSource ? ' · source' : sourceEntity ? ` · ← ${labelOf(sourceEntity, allEntities.indexOf(sourceEntity))}` : ''}
      </div>

      {open && (
        <div style={{ marginTop: 'var(--space-sm)' }}>

          {validPaths.length === 0 ? (
            <span className="field-hint">No emitters configured in Configuration.</span>
          ) : (<>

            {/* Source row: label + toggle pill + optional dropdown, all inline */}
            <div className="emitter-source-row">
              <span className="emitter-source-head">Use as source</span>
              <button
                type="button"
                className={`ctrl-toggle-row emitter-source-toggle${isSource ? ' on' : ''}`}
                role="switch"
                aria-checked={isSource}
                onClick={e => { e.stopPropagation(); onSetIsSource(entityIdx, !isSource); }}
              >
                <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
              </button>
              {!isSource && sources.length > 0 && (
                <div className="wr-mirror-wrap emitter-source-select-wrap">
                  <select
                    className="wr-mirror-trigger emitter-source-select"
                    value={sourceEntity ? String(sourceEntity.id) : ''}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      e.stopPropagation();
                      const val = e.target.value;
                      const picked = sources.find(e => String(e.id) === val);
                      picked ? onSetSource(entityIdx, picked.id) : onClearSource(entityIdx);
                    }}
                  >
                    <option value="">None</option>
                    {sources.map((e) => (
                      <option key={e.id} value={String(e.id)}>{labelOf(e, allEntities.indexOf(e))}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Emitter toggle list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'var(--space-sm)' }}>
              {validPaths.map((path, pi) => {
                const active = effectiveEmitters.includes(path);
                return (
                  <button
                    key={pi}
                    type="button"
                    className={`ctrl-toggle-row${active ? ' on' : ''}`}
                    role="switch"
                    aria-checked={active}
                    disabled={readOnly}
                    onClick={e => {
                      e.stopPropagation();
                      if (!readOnly) onToggleEmitter(entityIdx, path);
                    }}
                    title={path}
                    style={{ opacity: readOnly ? 0.55 : 1 }}
                  >
                    <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
                    <span className="ctrl-toggle-text">
                      <span className="ctrl-toggle-label">{getEmitterName(path)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

          </>)}

        </div>
      )}
    </div>
  );
}

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
  subtitle = 'Map Preview',
  controls,
  /* Collapsible legend rail (opt-in). When false the legacy under-canvas
     .ec-legend renders as before — Emitter and any other host stay byte-
     identical. When true the legend becomes a collapsible rail portaled
     to the .preview-panel edge, growing into the outer void. */
  legendCollapsible = false,
  legendCollapsed   = false,
  onToggleLegend,
  selectedLegendId,
  onLegendSelect,
}) => {
  /* The rail must escape .preview-panel-body, whose overflow-y:auto forces
     its overflow-x to clip — anything in normal flow is trapped. We portal
     it into the .preview-panel ancestor (set overflow:visible under the
     .wr-tab scope) so it can sit at the canvas edge and reach the void. */
  const [railHost, setRailHost] = useState(null);
  useEffect(() => {
    if (!legendCollapsible) { setRailHost(null); return; }
    setRailHost(containerRef?.current?.closest('.preview-panel') || null);
  }, [legendCollapsible, containerRef]);

  return (
    <>
    <div className="ctrl-block">
      <div className="mp-subtitle">{subtitle}</div>

      {/* Action row: replace + mirror controls */}
      <div className="mp-action-row">
        {previewLoading ? (
          <span style={{ font: 'var(--font-display)', fontSize: 'var(--text-xs)', color: 'var(--ink-22)', letterSpacing: '0.08em' }}>
            Loading…
          </span>
        ) : (
          <label className="ctrl-btn-add ctrl-btn-add--prev" style={{ cursor: 'pointer' }}>
            {previewImageData ? 'Replace Preview' : 'Upload Preview'}
            <input ref={fileInputRef} type="file" className="ec-file-input" accept="image/*" onChange={onImageUpload} />
          </label>
        )}
        {controls}
      </div>

      {/* Canvas — full width, no indent */}
      <div className="mp-canvas-block">
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
          <div className="ec-canvas-readout" ref={readoutRef}>X  -  Z</div>

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            {markers.map(marker => (
              <div
                key={marker.id}
                onClick={(e) => { e.stopPropagation(); onMarkerDelete(marker); }}
                className={`ec-marker${marker.isSelected ? ' ec-marker--selected' : ''}`}
                style={{
                  '--uc-color': marker.color,
                  left: `${marker.x}%`,
                  top: `${marker.z}%`,
                }}
                title={markerTitle(marker)}
              >

              </div>
            ))}
          </div>

          {showPlaceholder && (
            <div className="ec-canvas-placeholder">{placeholder}</div>
          )}
        </div>
      </div>{/* mp-canvas-block */}
    </div>{/* ctrl-block */}

    {!legendCollapsible && (
    <div className="ec-legend">
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-35)', marginBottom: 'var(--space-xs)' }}>Unit Legend</div>
      <div className="ec-legend-list">
        {legendRows.map((row, idx) => (
          <div key={row.id ?? idx} className="ec-legend-row" style={{ '--row-i': idx, '--uc-color': row.color }}>
            <div className="ec-card-dot" style={{ backgroundColor: row.color }} />
            <span>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
    )}

    {legendCollapsible && railHost && createPortal(
      <LegendRail
        title={legendTitle || 'Legend'}
        rows={legendRows}
        collapsed={legendCollapsed}
        onToggle={onToggleLegend}
        selectedId={selectedLegendId}
        onSelect={onLegendSelect}
      />,
      railHost
    )}
    </>
  );
};


/* ══════════════════════════════════════════════════════════════════════════════
   FILE DROP — shared drag-and-drop primitives
   Used by any tab that accepts file input via drag-and-drop.
   Keeps the global shutter overlay and its counter logic out of tab code.
   ══════════════════════════════════════════════════════════════════════════════

   Usage:
     const { isDragging, dropHandlers } = useFileDrop({
       accept: file => file.name.endsWith('.scmap'),
       onDrop: file => handleFile(file),
     });

     <div className="my-tab" {...dropHandlers}>
       {isDragging && <FileDragOverlay label="Drop .scmap to unpack" />}
       …
     </div>

   Props (useFileDrop)
     accept(file)   predicate — return true to accept. Called on drop only
                    (browsers don't expose filenames during dragenter/over).
                    Default: () => true
     onDrop(file)   called with the first accepted File on drop.
     multi          if true, onDrop receives File[] of all accepted files.
                    Default: false

   Props (FileDragOverlay)
     label          primary heading inside the frame  (required)
     sub            secondary line below the heading  (optional)
   ══════════════════════════════════════════════════════════════════════════════ */

export function useFileDrop({ accept = () => true, onDrop, multi = false } = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const counter = useRef(0);

  const onDragEnter = useCallback(e => {
    e.preventDefault();
    counter.current += 1;
    const hasFile = [...(e.dataTransfer.items || [])].some(i => i.kind === 'file');
    if (hasFile) setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(e => {
    e.preventDefault();
    counter.current -= 1;
    if (counter.current <= 0) { counter.current = 0; setIsDragging(false); }
  }, []);

  const onDragOver = useCallback(e => { e.preventDefault(); }, []);

  const onDropHandler = useCallback(e => {
    e.preventDefault();
    counter.current = 0;
    setIsDragging(false);
    if (!onDrop) return;
    if (multi) {
      const files = [...(e.dataTransfer.files || [])].filter(accept);
      if (files.length) onDrop(files);
    } else {
      const file = e.dataTransfer.files?.[0];
      if (file && accept(file)) onDrop(file);
    }
  }, [accept, onDrop, multi]);

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop: onDropHandler },
  };
}

/* ── DropSlot — universal drag-and-drop target ───────────────────────
   Resting: four L-shaped corner brackets.
   Hover / drag-over: two-phase frame closure animation.
     Phase 1: top (LTR) + bottom (RTL) horizontal lines simultaneously.
     Phase 2: right (TTB) + left (BTT) vertical lines, starting at 60%.
   Filled: top-edge tick ignites, filename shown, idle dash hidden.

   Props:
     label        eyebrow text above the slot (e.g. "Mesh LOD")
     hint         dim file-type hint (e.g. ".lod")
     accept       predicate (file) → bool, forwarded to the input
     value        File | null — controlled; null = empty
     onChange     (File | null) → void
     className    extra classes on the shell
*/

/* ── ToggleSwitch — universal boolean toggle ─────────────────────────
   Uses the same corner-bracket + frame-closure vocabulary as DropSlot
   and EntityCard. OFF: four L-shaped brackets only. ON: all four frame
   lines animate closed (horizontal first, vertical with slight delay),
   phosphor tick ignites on the top edge, background tints to tab-color.

   Props:
     value      boolean — controlled
     onChange   (newValue: boolean) → void
     label      optional string rendered to the left (field-label style)
     className  extra classes on the shell
*/
export const ToggleSwitch = ({ value, onChange, label, className = '' }) => {
  const handleClick = useCallback(() => onChange?.(!value), [value, onChange]);

  return (
    <div
      className={`ec-toggle-field${className ? ` ${className}` : ''}`}
      onClick={e => e.stopPropagation()}
    >
      {label && <span className="ec-toggle-label">{label}</span>}
      <button
        className={`ec-toggle${value ? ' on' : ' off'}`}
        onClick={handleClick}
        role="switch"
        aria-checked={value}
        aria-label={label}
        type="button"
      >
        {/* Phosphor tick — top edge, ignites when on */}
        <span className="ec-toggle-tick" aria-hidden="true" />

        {/* Closing frame lines — animate in when on */}
        <span className="ec-toggle-line ec-toggle-line--top"    aria-hidden="true" />
        <span className="ec-toggle-line ec-toggle-line--bottom" aria-hidden="true" />
        <span className="ec-toggle-line ec-toggle-line--right"  aria-hidden="true" />
        <span className="ec-toggle-line ec-toggle-line--left"   aria-hidden="true" />

        {/* Corner brackets — always visible */}
        <span className="ec-toggle-corner ec-toggle-corner--tl" aria-hidden="true" />
        <span className="ec-toggle-corner ec-toggle-corner--tr" aria-hidden="true" />
        <span className="ec-toggle-corner ec-toggle-corner--br" aria-hidden="true" />
        <span className="ec-toggle-corner ec-toggle-corner--bl" aria-hidden="true" />

        <span className="ec-toggle-text">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
};

/* ── DropSlot — universal drag-and-drop target ───────────────────────
   Three controlled states drive the visual:

     status = 'idle'  (default)
       Brackets + dim dash + hint text. Hover/drag animates the frame
       closed. Clicking opens a file picker.

     status = 'busy'
       Frame is fully drawn (all lines visible, no animation).
       A scanline sweeps top→bottom. Click and drag are disabled.
       Show a `busyText` to describe what's happening.

     status = 'done'
       Top-edge phosphor tick ignites. Primary text shows `doneText`
       (e.g. filename or "Done"). Optional `onClear` shows a remove link.

   For simple file-slot usage (assets), the host manages file state and
   passes it through `value`; the component derives `status` automatically
   when `status` is not supplied. For process-driven usage (Scmap unpack,
   folder drops) the host supplies `status` explicitly and controls all
   text via the text props.

   Props:
     label        eyebrow above the slot            (string)
     hint         dim file-type hint, idle only     (string)  e.g. ".lod"
     accept       (file) → bool, guards drops+input (fn)
     acceptInput  mime/ext string for <input accept> (string) e.g. ".scm,.dds"

     — Controlled file mode (simple asset slots) —
     value        File | null
     onChange     (File | null) → void

     — Explicit status mode (process-driven slots) —
     status       'idle' | 'busy' | 'done'          overrides derived state
     idleText     primary text in idle              (string)
     busyText     primary text in busy              (string)
     doneText     primary text in done              (string)
     onClear      () → void   shows "remove" link when provided
     onClick      () => void  custom click handler (replaces file picker)

     className    extra classes on the shell        (string)
*/
export const DropSlot = ({
  label,
  hint,
  accept,
  acceptInput,
  value = null,
  onChange,
  status: statusProp,
  idleText,
  busyText  = 'Processing…',
  doneText,
  onClear,
  onClick: onClickProp,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const counter  = useRef(0);
  const inputRef = useRef(null);

  // Derive status when not supplied explicitly
  const status = statusProp ?? (value !== null ? 'done' : 'idle');
  const isBusy = status === 'busy';
  const isDone = status === 'done';
  const isIdle = status === 'idle';

  const acceptFile = useCallback(
    (file) => (accept ? accept(file) : true),
    [accept],
  );

  const handleDragEnter = useCallback((e) => {
    if (isBusy) return;
    e.preventDefault();
    counter.current += 1;
    const hasFile = [...(e.dataTransfer.items || [])].some(i => i.kind === 'file');
    if (hasFile) setIsDragging(true);
  }, [isBusy]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    counter.current -= 1;
    if (counter.current <= 0) { counter.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    counter.current = 0;
    setIsDragging(false);
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file && acceptFile(file)) onChange?.(file);
  }, [isBusy, acceptFile, onChange]);

  const handleClick = useCallback(() => {
    if (isBusy) return;
    if (onClickProp) { onClickProp(); return; }
    inputRef.current?.click();
  }, [isBusy, onClickProp]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) onChange?.(file);
    e.target.value = '';
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    if (onClear)        { onClear();        return; }
    if (onChange)       { onChange(null);   return; }
  }, [onClear, onChange]);

  // Resolve display text
  const primaryText = isDone
    ? (doneText ?? value?.name ?? '')
    : isIdle
      ? (idleText ?? '')
      : busyText;

  const stateClass = [
    'ec-drop-slot',
    isDragging ? 'dragging' : '',
    isBusy     ? 'busy'     : '',
    isDone     ? 'done'     : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={stateClass}
      onClick={isBusy ? undefined : handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="button"
      tabIndex={isBusy ? -1 : 0}
      aria-label={label}
      aria-busy={isBusy}
      onKeyDown={(e) => {
        if (!isBusy && (e.key === 'Enter' || e.key === ' ')) handleClick();
      }}
    >
      {/* Eyebrow label */}
      {label && <span className="ec-drop-slot-label">{label}</span>}

      {/* Corner brackets */}
      <span className="ec-drop-slot-corner ec-drop-slot-corner--tl" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--tr" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--br" aria-hidden="true" />
      <span className="ec-drop-slot-corner ec-drop-slot-corner--bl" aria-hidden="true" />

      {/* Closing frame lines — animated on hover/drag, static when busy/done */}
      <span className="ec-drop-slot-line ec-drop-slot-line--top"    aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--bottom" aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--right"  aria-hidden="true" />
      <span className="ec-drop-slot-line ec-drop-slot-line--left"   aria-hidden="true" />

      {/* Busy scanline */}
      {isBusy && <span className="ec-drop-slot-scan" aria-hidden="true" />}

      {/* Inner content */}
      <div className="ec-drop-slot-inner">
        {/* Idle dash */}
        {isIdle && <span className="ec-drop-slot-idle" aria-hidden="true" />}

        {/* Primary text — shown in all states when non-empty */}
        {primaryText && (
          <span
            className={`ec-drop-slot-text${isDone ? ' ec-drop-slot-text--done' : ''}${isBusy ? ' ec-drop-slot-text--busy' : ''}`}
            title={primaryText}
          >
            {primaryText}
          </span>
        )}

        {/* Hint — idle only, below dash */}
        {isIdle && hint && <span className="ec-drop-slot-hint">{hint}</span>}

        {/* Clear affordance — done only, when handler provided */}
        {isDone && (onClear || onChange) && (
          <button
            className="ec-drop-slot-clear"
            onClick={handleClear}
            aria-label={`Remove ${label}`}
          >
            remove
          </button>
        )}
      </div>

      {/* Hidden file input — not rendered in explicit-status mode without onChange */}
      {onChange && (
        <input
          ref={inputRef}
          type="file"
          className="ec-file-input"
          accept={acceptInput}
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export function FileDragOverlay({
  label,
  sub = 'Release to load — processing starts immediately',
}) {
  return (
    <div className="file-drag-overlay" aria-live="assertive" aria-label={label}>
      <div className="file-drag-frame">
        <span className="file-drag-label">{label}</span>
        {sub && <span className="file-drag-sub">{sub}</span>}
      </div>
    </div>
  );
}
