import React, { useRef, useState, useEffect, useCallback } from 'react';
import { getNodeDef, nodeColor } from '../engine/registry.js';

/** Structural equality for an edge (matches disconnect's key fields). */
export function edgeEq(a, b) {
  return !!a && !!b &&
    a.from[0] === b.from[0] && a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] && a.to[1] === b.to[1];
}

/**
 * NodeGraph — the lightweight node canvas (bottom half of the editor).
 *
 * Blender/Gaea-style interaction: drag from a socket and release over the
 * opposite kind of socket (or just over the target node) to connect; the mouse
 * wheel zooms toward the cursor; dragging a header moves a node (or the whole
 * selection, if the dragged node is already part of a multi-selection);
 * middle-mouse drag on empty space pans; a left-drag on empty space instead
 * marquee-selects every node it overlaps (Gaea-style box select — shift
 * extends the existing selection instead of replacing it); a left click with
 * no drag deselects; double-click empty space resets the view. Releasing a
 * connection drag on empty canvas opens the add-node search at that spot and
 * auto-wires whatever gets picked (link-drag-search); releasing it on a
 * SECOND output socket instead inserts a Combine node wired to both outputs.
 * Double-clicking a node's header renames it (a `label` override, same
 * local-edit-buffer/commit-only pattern as the workspace tab strip). All
 * mutations are lifted to the parent as pure graph edits
 * (docs/NODE_EDITOR_PLAN.md §1) — this component holds only view state (pan +
 * zoom, in-progress connection, the marquee rectangle, the rename buffer).
 *
 * Socket positions use fixed card geometry so edge curves are deterministic
 * without DOM measurement; drop targets resolve from data-attributes via
 * elementFromPoint, with a forgiving fallback that snaps to a node's free
 * socket when you release near the node rather than exactly on the dot. The
 * socket hit area is enlarged in CSS so a connection drag never slips through
 * to a background pan.
 */

const CARD_W = 176;
const HEADER_H = 30;
const SOCKET_ROW = 24;
const BODY_PAD = 8;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const DRAG_THRESHOLD = 4; // px in screen space before a click becomes a box-select

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function cardHeight(def) {
  return HEADER_H + BODY_PAD + Math.max(1, def.inputs.length) * SOCKET_ROW + BODY_PAD;
}
function outSocketPos(node) {
  return { x: node.pos[0] + CARD_W, y: node.pos[1] + HEADER_H / 2 };
}
function inSocketPos(node, index) {
  return { x: node.pos[0], y: node.pos[1] + HEADER_H + BODY_PAD + SOCKET_ROW * (index + 0.5) };
}
function edgePath(a, b) {
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export default function NodeGraph({
  graph, selectedIds, selectedEdge, frozenId, onToggleFreeze, onSelectNodes, onSelectEdge,
  onMoveNode, onMoveNodes, onRemoveNode, onRemoveNodes, onConnect, onDisconnect,
  onRenameNode, onCombineOutputs, onLinkDragEmpty,
  errorNodeId, errorMessage, compareA, compareB, onToggleCompare, onToggleBypass,
}) {
  const rootRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [conn, setConn] = useState(null); // { from:{id,socket,dir}, start:{x,y}, cursor:{x,y} }
  const [marquee, setMarquee] = useState(null); // screen-space {left,top,width,height} while box-selecting
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const viewRef = useRef(view);
  viewRef.current = view;

  const startNodeRename = (id, current) => { setRenamingId(id); setRenameValue(current); };
  const commitNodeRename = () => {
    if (renamingId !== null) onRenameNode?.(renamingId, renameValue);
    setRenamingId(null);
  };

  const toGraphCoords = (clientX, clientY) => {
    const r = rootRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };

  // ── Wheel zoom (toward cursor) — native non-passive so preventDefault works ─
  useEffect(() => {
    const el = rootRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      setView(v => {
        const zoom = clamp(v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), ZOOM_MIN, ZOOM_MAX);
        const k = zoom / v.zoom;
        return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nodeRect = (id) => {
    const node = graph.nodes[id];
    const def = getNodeDef(node.type);
    return { x1: node.pos[0], y1: node.pos[1], x2: node.pos[0] + CARD_W, y2: node.pos[1] + cardHeight(def) };
  };

  // ── Left button on empty space: click-to-deselect, or drag-to-box-select ──
  // Middle-mouse drag pans (left is reserved for selection so it can deselect
  // on a plain click without also panning).
  const onCanvasPointerDown = (e) => {
    if (e.button === 1) {
      e.preventDefault(); // suppress the browser's middle-click autoscroll icon
      const v = viewRef.current;
      const start = { x: e.clientX - v.x, y: e.clientY - v.y };
      const move = (ev) => setView(cur => ({ ...cur, x: ev.clientX - start.x, y: ev.clientY - start.y }));
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    if (e.button !== 0) return;

    const additive = e.shiftKey;
    const base = additive ? new Set(selectedIds) : new Set();
    const startClient = { x: e.clientX, y: e.clientY };
    let boxing = false;
    const ids = Object.keys(graph.nodes);

    const move = (ev) => {
      const dx = ev.clientX - startClient.x, dy = ev.clientY - startClient.y;
      if (!boxing && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      boxing = true;

      const r = rootRef.current.getBoundingClientRect();
      const left = Math.min(startClient.x, ev.clientX) - r.left;
      const top = Math.min(startClient.y, ev.clientY) - r.top;
      setMarquee({ left, top, width: Math.abs(dx), height: Math.abs(dy) });

      const p1 = toGraphCoords(startClient.x, startClient.y);
      const p2 = toGraphCoords(ev.clientX, ev.clientY);
      const gx1 = Math.min(p1.x, p2.x), gx2 = Math.max(p1.x, p2.x);
      const gy1 = Math.min(p1.y, p2.y), gy2 = Math.max(p1.y, p2.y);

      const hit = new Set(base);
      for (const id of ids) {
        const rc = nodeRect(id);
        if (rc.x1 < gx2 && rc.x2 > gx1 && rc.y1 < gy2 && rc.y2 > gy1) hit.add(id);
      }
      onSelectNodes(hit);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      if (!boxing && !additive) onSelectNodes(new Set());
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── Select (plain click / shift-toggle), no drag — used by the card body ──
  const selectOnClick = (id) => (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.shiftKey) {
      const next = new Set(selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectNodes(next);
    } else {
      onSelectNodes(new Set([id]));
    }
  };

  // ── Drag a node by its header — moves the whole selection if the dragged
  // node is already part of a multi-selection, otherwise just itself ────────
  const startNodeDrag = (id) => (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.shiftKey) {
      const next = new Set(selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectNodes(next);
      return; // shift-click toggles selection; it doesn't also start a drag
    }
    const group = selectedIds.has(id) && selectedIds.size > 1;
    if (!group) onSelectNodes(new Set([id]));
    const dragIds = group ? [...selectedIds] : [id];
    const origins = new Map(dragIds.map(nid => [nid, graph.nodes[nid].pos]));
    const startClient = { x: e.clientX, y: e.clientY };
    const move = (ev) => {
      const z = viewRef.current.zoom;
      const dx = (ev.clientX - startClient.x) / z, dy = (ev.clientY - startClient.y) / z;
      if (dragIds.length > 1) {
        onMoveNodes(dragIds.map(nid => ({ id: nid, pos: [origins.get(nid)[0] + dx, origins.get(nid)[1] + dy] })));
      } else {
        onMoveNode(id, [origins.get(id)[0] + dx, origins.get(id)[1] + dy]);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── Drag-to-connect ────────────────────────────────────────────────────────
  const startConnect = (id, socket, dir) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    onSelectNodes(new Set([id]));
    const node = graph.nodes[id];
    const def = getNodeDef(node.type);
    const start = dir === 'out'
      ? outSocketPos(node)
      : inSocketPos(node, Math.max(0, def.inputs.findIndex(s => s.name === socket)));

    setConn({ from: { id, socket, dir }, start, cursor: start });

    const move = (ev) => setConn(c => (c ? { ...c, cursor: toGraphCoords(ev.clientX, ev.clientY) } : c));
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      resolveDrop(ev.clientX, ev.clientY, { id, socket, dir });
      setConn(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const resolveDrop = (clientX, clientY, from) => {
    const el = document.elementFromPoint(clientX, clientY);

    // 1. Released precisely on a socket.
    const socketEl = el && el.closest('[data-socket-dir]');
    if (socketEl) {
      const t = { id: socketEl.dataset.nodeId, socket: socketEl.dataset.socketName, dir: socketEl.dataset.socketDir };
      if (t.id === from.id) return;
      if (t.dir !== from.dir) return commit(from, t);
      // Two outputs dropped on each other reads as "mix these" — insert a
      // Combine node wired to both instead of silently doing nothing.
      if (from.dir === 'out' && t.dir === 'out') onCombineOutputs?.(from, t, toGraphCoords(clientX, clientY));
      return;
    }
    // 2. Forgiving fallback: released over a node card — snap to a free socket.
    const cardEl = el && el.closest('[data-node-card]');
    if (cardEl) {
      const nodeId = cardEl.dataset.nodeCard;
      if (nodeId === from.id) return;
      const def = getNodeDef(graph.nodes[nodeId].type);
      if (from.dir === 'out' && def.inputs.length) return commit(from, { id: nodeId, socket: def.inputs[0].name, dir: 'in' });
      if (from.dir === 'in' && def.outputs.length) return commit(from, { id: nodeId, socket: def.outputs[0].name, dir: 'out' });
      return;
    }
    // 3. Released over empty canvas — open the add-node search right there
    // and auto-wire whatever gets picked (Blender-style link-drag-search).
    const rect = rootRef.current.getBoundingClientRect();
    onLinkDragEmpty?.(from, toGraphCoords(clientX, clientY), { x: clientX - rect.left, y: clientY - rect.top });
  };

  const commit = (from, to) => {
    if (from.dir === 'out') onConnect([from.id, from.socket], [to.id, to.socket]);
    else onConnect([to.id, to.socket], [from.id, from.socket]);
  };

  const resetView = useCallback(() => setView({ x: 0, y: 0, zoom: 1 }), []);

  // Delete/Backspace handling lives in the parent (needs Inspector context
  // too); this component just needs Delete to work while the graph itself has
  // focus in case the parent's listener is ever scoped narrower.
  const ids = Object.keys(graph.nodes);

  return (
    <div
      ref={rootRef}
      className={`ne-graph${conn ? ' is-connecting' : ''}`}
      onPointerDown={onCanvasPointerDown}
      onDoubleClick={resetView}
      onContextMenu={(e) => { e.preventDefault(); setConn(null); }}
    >
      <div
        className="ne-graph-inner"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg className="ne-edges" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {graph.edges.map((edge, i) => {
            const fromNode = graph.nodes[edge.from[0]];
            const toNode = graph.nodes[edge.to[0]];
            if (!fromNode || !toNode) return null;
            const toDef = getNodeDef(toNode.type);
            const idx = Math.max(0, toDef.inputs.findIndex(s => s.name === edge.to[1]));
            const sel = edgeEq(edge, selectedEdge);
            const d = edgePath(outSocketPos(fromNode), inSocketPos(toNode, idx));
            return (
              // Two paths: a thin visible curve plus a fat transparent "hit"
              // path on top, so the whole ~16px band around the line catches
              // the click instead of only the 2px stroke.
              <g key={i} className="ne-edge-group">
                <path className={`ne-edge${sel ? ' is-sel' : ''}`} d={d} />
                <path
                  className="ne-edge-hit" d={d}
                  onPointerDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); onSelectEdge(edge); }}
                >
                  <title>Click to select · Delete to remove</title>
                </path>
              </g>
            );
          })}
          {conn && <path className="ne-edge ne-edge-pending" d={edgePath(conn.start, conn.cursor)} />}
        </svg>

        {ids.map((id) => {
          const node = graph.nodes[id];
          const def = getNodeDef(node.type);
          const h = cardHeight(def);
          const selected = selectedIds.has(id);
          const accent = nodeColor(def);
          const frozen = id === frozenId;
          const bypassed = !!node.bypass;
          const isCompareA = compareA === id;
          const isCompareB = compareB === id;
          const isError = id === errorNodeId;
          const label = node.label || def.label;
          return (
            <div
              key={id}
              data-node-card={id}
              className={`ne-node${selected ? ' is-sel' : ''}${frozen ? ' is-frozen' : ''}${bypassed ? ' is-bypassed' : ''}${isError ? ' is-error' : ''}`}
              style={{ left: node.pos[0], top: node.pos[1], width: CARD_W, minHeight: h, '--node-accent': accent }}
              onPointerDown={selectOnClick(id)}
              title={isError ? errorMessage : undefined}
            >
              <div
                className="ne-node-head" onPointerDown={startNodeDrag(id)}
                onDoubleClick={(e) => { e.stopPropagation(); startNodeRename(id, label); }}
              >
                <span className="ne-dot" style={{ background: accent }} />
                {renamingId === id ? (
                  <input
                    className="ne-node-rename"
                    value={renameValue}
                    autoFocus
                    onPointerDown={e => e.stopPropagation()}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={commitNodeRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitNodeRename();
                      else if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <span className="ne-node-label" title="Double-click to rename">{label}</span>
                )}
                <button
                  className="ne-node-del" title="Delete node"
                  onPointerDown={(e) => { e.stopPropagation(); onRemoveNode(id); }}
                >×</button>
              </div>

              <div className="ne-node-body">
                {def.inputs.map((s) => (
                  <div key={s.name} className="ne-socket-row">
                    <span
                      className="ne-socket ne-socket-in"
                      data-socket-dir="in" data-node-id={id} data-socket-name={s.name}
                      onPointerDown={startConnect(id, s.name, 'in')}
                      title={`input: ${s.name}`}
                    />
                    <span className="ne-socket-label">{s.name}</span>
                  </div>
                ))}
                {def.inputs.length === 0 && <div className="ne-socket-row ne-socket-none">source</div>}
              </div>

              {def.outputs.length > 0 && (
                <span
                  className={`ne-socket ne-socket-out${conn?.from.id === id ? ' is-armed' : ''}`}
                  style={{ left: CARD_W, top: HEADER_H / 2 }}
                  data-socket-dir="out" data-node-id={id} data-socket-name={def.outputs[0].name}
                  onPointerDown={startConnect(id, def.outputs[0].name, 'out')}
                  title="output — drag to an input"
                />
              )}
              {frozen && (
                <span
                  className="ne-node-freeze-dot"
                  title="Viewport pinned here (F to unfreeze)"
                  onPointerDown={(e) => { e.stopPropagation(); onToggleFreeze(id); }}
                />
              )}
              {(bypassed || isCompareA || isCompareB) && (
                <div className="ne-node-badges-left">
                  {bypassed && (
                    <span
                      className="ne-node-bypass-dot"
                      title="Bypassed — passes input 0 straight through (B to toggle)"
                      onPointerDown={(e) => { e.stopPropagation(); onToggleBypass(id); }}
                    />
                  )}
                  {(isCompareA || isCompareB) && (
                    <span
                      className={`ne-node-compare-dot${isCompareA ? ' is-a' : ' is-b'}`}
                      title={`Compare ${isCompareA ? 'A' : 'B'} (C to toggle)`}
                      onPointerDown={(e) => { e.stopPropagation(); onToggleCompare(id); }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {marquee && <div className="ne-marquee" style={marquee} />}

      <div className="ne-zoom-badge" title="Scroll to zoom · middle-drag to pan · drag to box-select · double-click to reset">{Math.round(view.zoom * 100)}%</div>
      {conn && <div className="ne-graph-hint">Release on a socket to connect · on empty canvas to search · on another output to Combine</div>}
    </div>
  );
}
