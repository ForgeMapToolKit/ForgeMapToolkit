import React, { useRef, useState, useEffect } from 'react';

/**
 * Viewport — the rendered-output pane (top half).
 *
 * Wraps the <canvas> the parent blits the evaluated texture into. Supports the
 * same navigation as the node graph: mouse-wheel zoom toward the cursor and
 * drag-to-pan, double-click to reset. The backing store matches the graph
 * canvas resolution; the transform only scales the display, so the preview
 * stays crisp when you zoom in on small (256×16) outputs.
 *
 * When `onObjectDrag` is set (a Transform node is selected with drag enabled),
 * a left-drag moves the *object* instead of the view: the pointer delta is
 * converted to UV and handed up, where it lands in params.x/y. That is the
 * plan's drag mode (§6.1) and it doesn't break the parametric rule — dragging
 * only ever writes numbers into the document.
 *
 * Its bottom bar doubles as the workspace's tab strip — one tab per open
 * .fmtgraph document (EnvCube / CirrusLayer / WaterRamp / …). Rename-in-place
 * (double-click) keeps its edit buffer local to this component, same as pan/
 * zoom; only the *commit* (`onRenameTab`) reaches the parent, which is the one
 * writing the actual document.
 *
 * Two more display modes live here: a channel isolate (R/G/B/A toggle, baked
 * into the GPU blit by the parent) and an A|B compare split (set by marking
 * two nodes with "C" in the graph). In compare mode a left-drag moves the
 * split instead of panning — same priority slot as the Transform drag mode,
 * since both repurpose the canvas's own drag gesture for something other than
 * view navigation.
 */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 16;
const CHANNELS = ['rgba', 'r', 'g', 'b', 'a'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const Viewport = React.forwardRef(function Viewport({
  w, h, status, onObjectDrag,
  frozenLabel, onUnfreeze,
  channel = 'rgba', onChannelChange,
  compareActive, splitFrac = 0.5, onSplitChange,
  compareALabel, compareBLabel, onExitCompare,
  tabs = [], activeTabIdx = 0, onSwitchTab, onAddTab, onCloseTab, onRenameTab,
}, ref) {
  const stageRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [renamingIdx, setRenamingIdx] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = (idx, current) => { setRenamingIdx(idx); setRenameValue(current); };
  const commitRename = () => {
    if (renamingIdx !== null) onRenameTab?.(renamingIdx, renameValue);
    setRenamingIdx(null);
  };

  useEffect(() => {
    const el = stageRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top - r.height / 2;
      setView(v => {
        const zoom = clamp(v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), ZOOM_MIN, ZOOM_MAX);
        const k = zoom / v.zoom;
        return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startPan = (e) => {
    if (e.button !== 0) return;

    // Compare mode: drag moves the A|B split instead of panning. Reads the
    // canvas's own rendered bounding box, so it stays correct through
    // zoom/pan/CSS max-width scaling without any separate measurement code.
    if (compareActive && onSplitChange) {
      const updateFromEvent = (ev) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || !rect.width) return;
        onSplitChange(clamp((ev.clientX - rect.left) / rect.width, 0, 1));
      };
      updateFromEvent(e);
      const move = (ev) => updateFromEvent(ev);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    // Drag mode: move the selected object, not the view. Pointer pixels →
    // UV, scaled by the current zoom; screen-down is -v because the blit puts
    // uv.y = 1 at the top.
    if (onObjectDrag) {
      let last = { x: e.clientX, y: e.clientY };
      const move = (ev) => {
        const z = viewRef.current.zoom || 1;
        const du = (ev.clientX - last.x) / (w * z);
        const dv = -(ev.clientY - last.y) / (h * z);
        last = { x: ev.clientX, y: ev.clientY };
        onObjectDrag(du, dv);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    const v = viewRef.current;
    const start = { x: e.clientX - v.x, y: e.clientY - v.y };
    const move = (ev) => setView(cur => ({ ...cur, x: ev.clientX - start.x, y: ev.clientY - start.y }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="ne-viewport">
      <div
        ref={stageRef}
        className={`ne-viewport-stage${compareActive ? ' is-compare' : ''}`}
        onPointerDown={startPan}
        onDoubleClick={() => setView({ x: 0, y: 0, zoom: 1 })}
      >
        <canvas
          ref={ref} width={w} height={h} className="ne-viewport-canvas"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        />
      </div>
      <div className="ne-viewport-bar">
        <div className="ne-tabstrip">
          {tabs.map((t, i) => (
            <div
              key={i}
              className={`ne-tab${i === activeTabIdx ? ' is-active' : ''}`}
              onClick={() => onSwitchTab?.(i)}
              onDoubleClick={() => startRename(i, t.label)}
              title={t.label}
            >
              {renamingIdx === i ? (
                <input
                  className="ne-tab-rename"
                  value={renameValue}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename();
                    else if (e.key === 'Escape') setRenamingIdx(null);
                  }}
                />
              ) : (
                <span className="ne-tab-label">{t.label}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="ne-tab-close" title="Close tab"
                  onClick={e => { e.stopPropagation(); onCloseTab?.(i); }}
                >×</button>
              )}
            </div>
          ))}
          <button className="ne-tab-add" title="New tab" onClick={onAddTab}>+</button>
        </div>
        <div className="ne-viewport-info">
          {frozenLabel && (
            <button className="ne-freeze-badge" onClick={onUnfreeze} title="Viewport pinned here — click (or press F on this node) to unfreeze">
              <span className="ne-freeze-dot" /> {frozenLabel}
            </button>
          )}
          {compareActive && (
            <button className="ne-compare-badge" onClick={onExitCompare} title="A|B compare — click (or press C on either node) to exit">
              <span className="ne-compare-swatch is-a" /> {compareALabel}
              <span className="ne-compare-vs">|</span>
              <span className="ne-compare-swatch is-b" /> {compareBLabel}
            </button>
          )}
          <div className="ne-channel-group" title="Isolate a channel">
            {CHANNELS.map(c => (
              <button
                key={c}
                className={`ne-channel-btn${channel === c ? ' is-active' : ''}`}
                onClick={() => onChannelChange?.(c)}
              >{c === 'rgba' ? 'RGB' : c.toUpperCase()}</button>
            ))}
          </div>
          <span className="ne-viewport-dim">{w} × {h}</span>
          <span className="ne-viewport-zoom">{Math.round(view.zoom * 100)}%</span>
          {status && <span className="ne-viewport-status">{status}</span>}
        </div>
      </div>
    </div>
  );
});

export default Viewport;
