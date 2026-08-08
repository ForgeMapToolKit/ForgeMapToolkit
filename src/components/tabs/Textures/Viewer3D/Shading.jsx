/**
 * Shading.jsx — the Shading workspace's bottom pane: the Texture Editor's own
 * node graph, scoped to one object's albedo.
 *
 * No viewport lives in this component — the always-mounted Scene3D canvas in
 * Viewer3D.jsx is the viewport, and `onApplyTexture` is the only bridge to it:
 * every time the graph re-evaluates, the output node's pixels are read back
 * and pushed onto the shaded object's mesh live, the same way `exportDds.js`
 * reads pixels back for a file. Same RGBA8 fixed-point target, same
 * `flipY: true` — the mesh's UVs and a DDS both expect row 0 at the top.
 *
 * A graph is scoped to the object, not to the tab: the parent hands in
 * `graph`/`onGraphChange` already keyed by the active object's id, so
 * switching objects is switching documents, same as a Texture Editor tab
 * switch — selection and freeze reset, the graph itself does not.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../TextureEditor/engine/nodes/index.js'; // side-effect: populate the registry
// Reuses the node-card/socket/wire/toolbox vocabulary (.ne-*) as-is — this
// pane never wears .node-editor-tab, so those rules inherit --tab-color from
// .viewer3d-tab instead of the Texture Editor's own accent.
import '../TextureEditor/TextureEditor.css';

import { createGLContext } from '../TextureEditor/engine/glContext.js';
import { createEvaluator } from '../TextureEditor/engine/evaluator.js';
import { createTextureStore } from '../TextureEditor/engine/textureStore.js';
import { allNodeDefs, categoryColor, CATEGORY_ORDER } from '../TextureEditor/engine/registry.js';
import {
  addNode, removeNode, removeNodes, setNodeParams, setNodePos, setNodePositions,
  setNodeLabel, setNodeBypass, connect, disconnect, findOutput,
} from '../TextureEditor/engine/graph.js';
import { MODES, SOURCE_NODE_ID } from '../TextureEditor/engine/modes.js';
import { exportGraphToDds } from '../TextureEditor/engine/exportDds.js';

import NodeGraph from '../TextureEditor/ui/NodeGraph.jsx';
import Inspector from '../TextureEditor/ui/Inspector.jsx';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/** A fresh graph for this object: the propalbedo template, source path filled
 *  in and canvas sized to the object's own albedo when known. */
function initialGraphFor(asset) {
  const g = MODES.propalbedo.makeGraph();
  const w = asset?.texture?.width || g.canvas.w;
  const h = asset?.texture?.height || g.canvas.h;
  g.canvas = { w, h };
  g.nodes[SOURCE_NODE_ID] = {
    ...g.nodes[SOURCE_NODE_ID],
    params: { ...g.nodes[SOURCE_NODE_ID].params, path: asset?.blueprint?.albedoPath || '' },
  };
  return g;
}

const Shading = ({ objects, activeId, onSelect, graph, onGraphChange, onApplyTexture }) => {
  const shadable = objects.filter(o => o.asset && !o.loading);
  const active = shadable.find(o => o.id === activeId) || null;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedEdge, setSelectedEdge] = useState(null);
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const [frozenId, setFrozenId] = useState(null);
  const [compare, setCompare] = useState({ a: null, b: null });
  const [status, setStatus] = useState('');
  const [errorNodeId, setErrorNodeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [textureTick, setTextureTick] = useState(0);

  const ctxRef = useRef(null);
  const evalRef = useRef(null);
  const storeRef = useRef(null);

  // ── Engine lifecycle — one GL context for the life of this pane ──────────
  useEffect(() => {
    const ctx = createGLContext();
    ctxRef.current = ctx;
    evalRef.current = createEvaluator(ctx);
    storeRef.current = createTextureStore(ctx, () => {
      evalRef.current?.invalidate();
      setTextureTick(t => t + 1);
    });
    ctx.textureStore = storeRef.current;
    return () => {
      storeRef.current?.dispose();
      evalRef.current?.dispose();
      ctxRef.current?.dispose();
      storeRef.current = null; evalRef.current = null; ctxRef.current = null;
    };
  }, []);

  // Switching the shaded object is switching documents — selection state from
  // the last one means nothing here.
  useEffect(() => {
    setSelectedIds(new Set()); setSelectedEdge(null); setFrozenId(null);
    setCompare({ a: null, b: null }); setStatus(''); setErrorNodeId(null);
  }, [activeId]);

  // First time this object is shaded, seed its graph.
  useEffect(() => {
    if (active && !graph) onGraphChange(initialGraphFor(active.asset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, !!graph]);

  const setGraph = useCallback((updater) => {
    onGraphChange(typeof updater === 'function' ? updater(graph) : updater);
  }, [graph, onGraphChange]);

  const previewRoot = useMemo(() => {
    if (!graph) return null;
    if (frozenId && graph.nodes[frozenId]) return frozenId;
    return selectedId && graph.nodes[selectedId] ? selectedId : findOutput(graph);
  }, [frozenId, selectedId, graph]);

  // ── Re-evaluate + push the result onto the mesh ───────────────────────────
  useEffect(() => {
    const ctx = ctxRef.current, ev = evalRef.current;
    if (!ctx || !ev || !graph || !previewRoot) return undefined;
    const raf = requestAnimationFrame(() => {
      try {
        const target = ev.evaluate(graph, previewRoot);
        if (target) {
          const rgba = ctx.readPixels(target, { flipY: true });
          onApplyTexture({ data: rgba, width: target.w, height: target.h });
        }
        setStatus(''); setErrorNodeId(null);
      } catch (err) {
        setStatus(`⚠ ${err.message}`);
        setErrorNodeId(err.nodeId || null);
        setErrorMessage(err.message || String(err));
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, previewRoot, textureTick]);

  // Reset to the object's own albedo when this pane goes away (object switch
  // or leaving Shading) — a stale override should never survive its editor.
  useEffect(() => () => onApplyTexture(null), [active?.id]);

  // ── Graph edits ───────────────────────────────────────────────────────────
  const onParams = useCallback((id, patch) => setGraph(g => setNodeParams(g, id, patch)), [setGraph]);
  const onMoveNode = useCallback((id, pos) => setGraph(g => setNodePos(g, id, pos)), [setGraph]);
  const onMoveNodes = useCallback((updates) => setGraph(g => setNodePositions(g, updates)), [setGraph]);
  const onConnect = useCallback((from, to) => setGraph(g => connect(g, from, to)), [setGraph]);
  const onDisconnect = useCallback((edge) => setGraph(g => disconnect(g, edge)), [setGraph]);
  const onRenameNode = useCallback((id, label) => setGraph(g => setNodeLabel(g, id, label)), [setGraph]);
  const toggleFreeze = useCallback((id) => setFrozenId(f => (f === id ? null : id)), []);
  const toggleBypass = useCallback((id) => setGraph(g => setNodeBypass(g, id, !g.nodes[id]?.bypass)), [setGraph]);
  const toggleCompare = useCallback((id) => {
    setCompare(({ a, b }) => {
      if (a === id) return { a: null, b };
      if (b === id) return { a, b: null };
      if (!a) return { a: id, b };
      if (!b) return { a, b: id };
      return { a, b: id };
    });
  }, []);

  const onRemoveNode = useCallback((id) => {
    setGraph(g => removeNode(g, id));
    setSelectedIds(s => (s.has(id) ? new Set([...s].filter(x => x !== id)) : s));
    setFrozenId(f => (f === id ? null : f));
  }, [setGraph]);
  const onRemoveNodes = useCallback((ids) => {
    setGraph(g => removeNodes(g, ids));
    setSelectedIds(new Set());
    setFrozenId(f => (ids.includes(f) ? null : f));
  }, [setGraph]);

  const handleSelectNodes = useCallback((ids) => { setSelectedIds(new Set(ids)); setSelectedEdge(null); }, []);
  const handleSelectEdge = useCallback((edge) => { setSelectedEdge(edge); setSelectedIds(new Set()); }, []);

  const onAddNode = useCallback((type) => {
    setGraph(g => {
      const { graph: ng, id } = addNode(g, type, [40 + (g ? Object.keys(g.nodes).length * 12 : 0), 240]);
      queueMicrotask(() => { setSelectedIds(new Set([id])); setSelectedEdge(null); });
      return ng;
    });
  }, [setGraph]);

  // Delete key: same convenience as the full editor, minus undo/redo (no
  // history stack here — the graph is small, hand-edits are cheap to redo).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdge) { onDisconnect(selectedEdge); setSelectedEdge(null); }
        else if (selectedIds.size > 0) { onRemoveNodes([...selectedIds]); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, selectedEdge, onDisconnect, onRemoveNodes]);

  const palette = useMemo(() => {
    const defs = allNodeDefs();
    return CATEGORY_ORDER.map(cat => ({ cat, defs: defs.filter(d => d.category === cat) })).filter(g => g.defs.length);
  }, []);

  // Writes the same DDS an export node always writes — reuses the exact
  // readback+encode path exportDds.js already gives the full Texture Editor.
  const onExport = useCallback(async (nodeId) => {
    const outputId = nodeId || findOutput(graph);
    if (!outputId) return;
    setStatus('Selecting folder…');
    let res;
    try {
      res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Export shaded texture to folder' });
    } catch { setStatus('⚠ folder picker unavailable'); return; }
    if (!res?.success || !res.path) { setStatus(''); return; }
    setStatus('Rendering + encoding…');
    try {
      const out = await exportGraphToDds({ ctx: ctxRef.current, evaluator: evalRef.current, graph, outputId, dir: res.path });
      setStatus(out.success ? `✓ Exported ${out.path}` : `⚠ ${out.error}`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  }, [graph]);

  if (!active) {
    return (
      <div className="v3-shading-empty">
        <div className="v3-readout-empty">
          {shadable.length === 0
            ? 'Load an object in Layout first — Shading needs its albedo to adjust.'
            : 'Pick an object to shade'}
        </div>
        {shadable.length > 0 && (
          <div className="v3-shading-pick-list">
            {shadable.map(o => (
              <button key={o.id} className="station v3-shading-pick" onClick={() => onSelect(o.id)}>{o.label}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!graph) return null; // one-frame gap while the initial graph is being seeded

  return (
    <div className="v3-shading-editor">
      <div className="v3-shading-toolbar">
        <span className="v3-tool-label">Shading</span>
        <Dropdown
          value={activeId} onChange={onSelect} ariaLabel="Object to shade"
          options={shadable.map(o => ({ value: o.id, label: o.label }))}
        />
        {status && <span className="v3-shading-status">{status}</span>}
      </div>

      <div className="v3-shading-row">
        <div className="ne-graph-zone v3-shading-graph-zone">
          <NodeGraph
            graph={graph}
            selectedIds={selectedIds}
            selectedEdge={selectedEdge}
            frozenId={frozenId}
            onToggleFreeze={toggleFreeze}
            onSelectNodes={handleSelectNodes}
            onSelectEdge={handleSelectEdge}
            onMoveNode={onMoveNode}
            onMoveNodes={onMoveNodes}
            onRemoveNode={onRemoveNode}
            onRemoveNodes={onRemoveNodes}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onRenameNode={onRenameNode}
            onCombineOutputs={null}
            onLinkDragEmpty={null}
            errorNodeId={errorNodeId}
            errorMessage={errorMessage}
            compareA={compare.a}
            compareB={compare.b}
            onToggleCompare={toggleCompare}
            onToggleBypass={toggleBypass}
            onExport={onExport}
          />

          <div className="ne-palette-dock">
            <div className="ne-panel-title">Toolbox</div>
            {palette.map(({ cat, defs }) => (
              <div key={cat} className="ne-palette-cat">
                <div className="ne-palette-cat-label" style={{ color: categoryColor(cat) }}>{cat}</div>
                <div className="ne-palette-items">
                  {defs.map(d => (
                    <button
                      key={d.type} className="station ne-palette-item"
                      style={{ color: categoryColor(d.category) }}
                      onClick={() => onAddNode(d.type)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="v3-shading-inspector">
          <Inspector graph={graph} selectedId={selectedId} selectedCount={selectedIds.size} onParams={onParams} />
        </div>
      </div>
    </div>
  );
};

export default Shading;
