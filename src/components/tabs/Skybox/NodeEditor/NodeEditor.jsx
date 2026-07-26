import React, { useEffect, useMemo, useRef, useState, useCallback, useReducer } from 'react';
import './NodeEditor.css';
import './engine/nodes/index.js'; // side-effect: populate the registry

import { createGLContext } from './engine/glContext.js';
import { createEvaluator } from './engine/evaluator.js';
import { createTextureStore } from './engine/textureStore.js';
import { allNodeDefs, getNodeDef, hasNodeDef, categoryColor, CATEGORY_ORDER } from './engine/registry.js';
import { addNode, removeNode, removeNodes, setNodeParams, setNodePos, setNodePositions, setNodeLabel, setNodeBypass, connect, disconnect, findOutput } from './engine/graph.js';
import { MODES, MODE_LIST, DEFAULT_MODE } from './engine/modes.js';
import { exportGraphToDds } from './engine/exportDds.js';

import Viewport from './ui/Viewport.jsx';
import NodeGraph from './ui/NodeGraph.jsx';
import Inspector from './ui/Inspector.jsx';
import NumberField from './ui/NumberField.jsx';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * NodeEditor — the tab parent (docs/NODE_EDITOR_PLAN.md).
 *
 * Owns the WebGL engine + evaluator (imperative, refs), a *workspace* of named
 * .fmtgraph documents ("tabs" — EnvCube / CirrusLayer / WaterRamp / …, one
 * active at a time), and the split-viewport layout. Every edit is a pure
 * graph transform from engine/graph.js applied to the active tab; the engine
 * re-evaluates the minimal dirty set and blits the result into the preview.
 *
 * A workspace is optionally backed by a disk *project* (electron/modules/
 * node-editor.js's node-editor-*-project/-graph IPC): a folder of
 * `<tabLabel>.fmtgraph` files. Outside a project the workspace is still fully
 * usable — Save falls back to a browser download, same as before tabs existed
 * — it just isn't tied to a folder on disk.
 *
 * Editor UX beyond render: node + link selection with keyboard delete, JSON
 * snapshot undo/redo *scoped to the active tab* (continuous gestures like a
 * slider- or node-drag coalesce into one step via a tag+time key; switching
 * tabs resets the stack — cross-document undo would silently restore the
 * wrong document), and a Tab-triggered add-node search.
 */

// A graph restored from disk/the shared store has to still make sense against
// the *current* registry — a stale save referencing a since-removed node type
// would otherwise crash the very first evaluate().
function isRestorableGraph(saved) {
  return !!(saved?.nodes && saved?.canvas && MODES[saved.mode] &&
    Object.values(saved.nodes).every(n => hasNodeDef(n.type)));
}

function normalizeGraph(g) {
  return { ...g, edges: Array.isArray(g.edges) ? g.edges : [] };
}

/** Workspace = which project (if any) + the open tabs + which one is active. */
function initialWorkspace(shared) {
  const saved = shared?.ne_workspace;
  if (saved?.tabs?.length && saved.tabs.every(t => isRestorableGraph(t.graph))) {
    return {
      projectName: saved.projectName || null,
      tabs: saved.tabs.map(t => ({ label: String(t.label || 'Untitled'), graph: normalizeGraph(t.graph) })),
      activeTabIdx: Math.min(Math.max(0, saved.activeTabIdx || 0), saved.tabs.length - 1),
    };
  }
  // Migrate the pre-tabs single-graph save, if any, so in-progress work isn't lost.
  const legacy = shared?.ne_graph;
  if (isRestorableGraph(legacy)) {
    return { projectName: null, tabs: [{ label: 'Untitled', graph: normalizeGraph(legacy) }], activeTabIdx: 0 };
  }
  return { projectName: null, tabs: [{ label: 'Untitled', graph: MODES[DEFAULT_MODE].makeGraph() }], activeTabIdx: 0 };
}

function uniqueLabel(base, existing) {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

const NodeEditor = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const [{ projectName, tabs, activeTabIdx }, setWorkspace] = useState(() => initialWorkspace(shared));
  const graph = tabs[activeTabIdx].graph;
  const activeTabIdxRef = useRef(activeTabIdx);
  activeTabIdxRef.current = activeTabIdx;

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedEdge, setSelectedEdge] = useState(null);
  // Inspector (and the Transform drag mode) only make sense for a single
  // node — box-selecting several just highlights them + enables group
  // move/delete, no per-node param panel.
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  // Freeze: pins the Viewport to one node's output (F key) so you can select
  // and tune EARLIER nodes upstream while still watching this one's result —
  // without freezing, selecting another node would just switch the preview to
  // it instead. Tab-scoped like selection/undo: a node id from a different
  // document makes no sense, so it resets on switch.
  const [frozenId, setFrozenId] = useState(null);
  const [status, setStatus] = useState('');
  const [glError, setGlError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [textureTick, setTextureTick] = useState(0); // bumped when an async texture lands

  // Error state: which node's def.render threw last evaluate() (evaluator.js
  // tags the thrown error with .nodeId). Cleared on every successful pass.
  const [errorNodeId, setErrorNodeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // A|B compare (C key, tab-scoped like selection/undo — see resetHistoryAndSelection):
  // a single {a,b} atom so toggleCompare can see both slots at once instead of
  // two independent setState calls racing each other within one keypress.
  const [compare, setCompare] = useState({ a: null, b: null });
  const [splitFrac, setSplitFrac] = useState(0.5);
  const compareActive = !!(compare.a && compare.b && graph.nodes[compare.a] && graph.nodes[compare.b]);

  // Viewport channel isolate (R/G/B/A toggle) — applies in both normal and compare blits.
  const [channel, setChannel] = useState('rgba');

  // Link-drag-search: a connection dropped on empty canvas opens the add-node
  // search there; picking a node both adds it AND wires it to the socket that
  // was being dragged. null when the search was opened the normal way (Tab).
  const [pendingLink, setPendingLink] = useState(null); // { from:{id,socket,dir}, pos:{x,y}, localPos:{x,y} }

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const evalRef = useRef(null);
  const storeRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Undo/redo: JSON snapshots of the ACTIVE TAB, gesture-coalesced ────────
  // Scoped per tab by simply resetting on every switch (see switchTab) —
  // simpler and safer than juggling one stack per tab, and an undo reaching
  // across a tab switch into an unrelated document would be more surprising
  // than losing history you can just redo by hand.
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const tagRef = useRef(null);
  const timeRef = useRef(0);
  const [, bumpHist] = useReducer(x => x + 1, 0);

  const setTabGraph = useCallback((idx, graphOrUpdater) => {
    setWorkspace(w => {
      const prevGraph = w.tabs[idx].graph;
      const nextGraph = typeof graphOrUpdater === 'function' ? graphOrUpdater(prevGraph) : graphOrUpdater;
      if (nextGraph === prevGraph) return w;
      const tabs2 = [...w.tabs];
      tabs2[idx] = { ...tabs2[idx], graph: nextGraph };
      return { ...w, tabs: tabs2 };
    });
  }, []);

  /** History-aware graph committer for the active tab. `tag` groups a
   *  continuous gesture (drag a slider / a node) into a single undo step;
   *  pass null for discrete edits. */
  const setGraph = useCallback((updater, tag = null) => {
    const idx = activeTabIdxRef.current;
    setTabGraph(idx, prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      const now = Date.now();
      const coalesce = !!tag && tag === tagRef.current && (now - timeRef.current) < 600;
      if (!coalesce) {
        pastRef.current.push(prev);
        if (pastRef.current.length > 120) pastRef.current.shift();
        futureRef.current = [];
      }
      tagRef.current = tag;
      timeRef.current = now;
      return next;
    });
    bumpHist();
  }, [setTabGraph]);

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const idx = activeTabIdxRef.current;
    setTabGraph(idx, prev => {
      futureRef.current.push(prev);
      const restored = pastRef.current.pop();
      tagRef.current = null;
      return restored;
    });
    setSelectedIds(new Set()); setSelectedEdge(null);
    bumpHist();
  }, [setTabGraph]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const idx = activeTabIdxRef.current;
    setTabGraph(idx, prev => {
      pastRef.current.push(prev);
      const restored = futureRef.current.pop();
      tagRef.current = null;
      return restored;
    });
    setSelectedIds(new Set()); setSelectedEdge(null);
    bumpHist();
  }, [setTabGraph]);

  const resetHistoryAndSelection = () => {
    pastRef.current = []; futureRef.current = []; tagRef.current = null;
    setSelectedIds(new Set()); setSelectedEdge(null); setFrozenId(null); setStatus('');
    setCompare({ a: null, b: null }); setPendingLink(null);
  };

  // Toggle freeze on whichever single node is selected (F key or clicking its dot).
  const toggleFreeze = useCallback((id) => {
    setFrozenId(f => (f === id ? null : id));
  }, []);

  // Toggle bypass on whichever single node is selected (B key or its dot) —
  // the evaluator then copies that node's input 0 straight through.
  const toggleBypass = useCallback((id) => {
    setGraph(g => setNodeBypass(g, id, !g.nodes[id]?.bypass));
  }, [setGraph]);

  // C key / dot: mark a node as compare-A or -B. First press fills A, second
  // fills B; pressing C on whichever slot a node already holds clears it;
  // pressing C on a third node once both slots are full replaces B, keeping A
  // stable as the reference the newcomer is compared against.
  const toggleCompare = useCallback((id) => {
    setCompare(({ a, b }) => {
      if (a === id) return { a: null, b };
      if (b === id) return { a, b: null };
      if (!a) return { a: id, b };
      if (!b) return { a, b: id };
      return { a, b: id };
    });
  }, []);

  const onRenameNode = useCallback((id, label) => {
    setGraph(g => setNodeLabel(g, id, label));
  }, [setGraph]);

  // ── Tab management ─────────────────────────────────────────────────────
  const switchTab = useCallback((idx) => {
    setWorkspace(w => (idx === w.activeTabIdx || idx < 0 || idx >= w.tabs.length ? w : { ...w, activeTabIdx: idx }));
    resetHistoryAndSelection();
  }, []);

  const addTab = useCallback(() => {
    setWorkspace(w => {
      const label = uniqueLabel('Untitled', w.tabs.map(t => t.label));
      const template = MODES[w.tabs[w.activeTabIdx].graph.mode]?.makeGraph?.() || MODES[DEFAULT_MODE].makeGraph();
      const tabs2 = [...w.tabs, { label, graph: template }];
      return { ...w, tabs: tabs2, activeTabIdx: tabs2.length - 1 };
    });
    resetHistoryAndSelection();
  }, []);

  const closeTab = useCallback((idx) => {
    setWorkspace(w => {
      if (w.tabs.length <= 1) return w;
      const tabs2 = w.tabs.filter((_, i) => i !== idx);
      let active = w.activeTabIdx;
      if (idx < active) active -= 1;
      else if (idx === active) active = Math.min(active, tabs2.length - 1);
      return { ...w, tabs: tabs2, activeTabIdx: active };
    });
    resetHistoryAndSelection();
  }, []);

  const renameTab = useCallback((idx, newLabel) => {
    setWorkspace(w => {
      const clean = (newLabel || '').trim();
      if (!clean || clean === w.tabs[idx].label) return w;
      const label = uniqueLabel(clean, w.tabs.filter((_, i) => i !== idx).map(t => t.label));
      const tabs2 = [...w.tabs];
      tabs2[idx] = { ...tabs2[idx], label };
      return { ...w, tabs: tabs2 };
    });
  }, []);

  // ── Project management ──────────────────────────────────────────────────
  const [projectList, setProjectList] = useState([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const refreshProjectList = useCallback(async () => {
    try {
      const api = window.electronAPI;
      if (!api?.invoke) return;
      const res = await api.invoke('node-editor-list-projects');
      setProjectList(res?.projects || []);
    } catch { /* desktop app not available — leave the list empty */ }
  }, []);
  useEffect(() => { refreshProjectList(); }, [refreshProjectList]);

  const openProject = async (name) => {
    if (!name) { setWorkspace(w => ({ ...w, projectName: null })); return; }
    setStatus('Opening project…');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('projects need the desktop app');
      const res = await api.invoke('node-editor-load-project', { name });
      if (!res?.success) { setStatus(`⚠ ${res?.error || 'open failed'}`); return; }
      const validTabs = (res.tabs || []).filter(t => isRestorableGraph(t.graph)).map(t => ({ label: t.label, graph: normalizeGraph(t.graph) }));
      setWorkspace({
        projectName: res.name,
        tabs: validTabs.length ? validTabs : [{ label: 'Untitled', graph: MODES[DEFAULT_MODE].makeGraph() }],
        activeTabIdx: 0,
      });
      resetHistoryAndSelection();
      setStatus(`✓ Opened "${res.name}" (${validTabs.length} tab${validTabs.length === 1 ? '' : 's'})`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  };

  const confirmNewProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('projects need the desktop app');
      const res = await api.invoke('node-editor-create-project', { name });
      if (!res?.success) { setStatus(`⚠ ${res?.error || 'create failed'}`); return; }
      setWorkspace(w => ({ ...w, projectName: res.name }));
      setNewProjectOpen(false); setNewProjectName('');
      await refreshProjectList();
      setStatus(`✓ Created project "${res.name}" — Save writes your tabs into it`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  };

  // ── Engine lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const ctx = createGLContext();
      ctxRef.current = ctx;
      evalRef.current = createEvaluator(ctx);
      // Async game textures: when one lands, its node's params (and so its
      // content hash) are unchanged — drop the eval cache and re-render.
      storeRef.current = createTextureStore(ctx, () => {
        evalRef.current?.invalidate();
        setTextureTick(t => t + 1);
      });
      ctx.textureStore = storeRef.current;
    } catch (err) {
      setGlError(err.message);
    }
    return () => {
      storeRef.current?.dispose();
      evalRef.current?.dispose();
      ctxRef.current?.dispose();
      storeRef.current = null;
      evalRef.current = null;
      ctxRef.current = null;
    };
  }, []);

  // Root shown in the preview: a frozen node wins outright (that's the whole
  // point — selecting an earlier node to tune it must NOT change what's
  // pinned in the Viewport), else the single selected node, else the output.
  const previewRoot = useMemo(() => {
    if (frozenId && graph.nodes[frozenId]) return frozenId;
    return selectedId && graph.nodes[selectedId] ? selectedId : findOutput(graph);
  }, [frozenId, selectedId, graph]);

  // ── Re-evaluate + blit whenever the document or preview root changes ──────
  // Compare mode evaluates BOTH marked nodes and splits the blit; otherwise
  // the usual single previewRoot. Either path funnels through the channel
  // isolate. Any node that throws gets tagged (evaluator.js sets err.nodeId)
  // so its card can redden — cleared on the next successful pass.
  useEffect(() => {
    const ctx = ctxRef.current, ev = evalRef.current, canvas = canvasRef.current;
    if (!ctx || !ev || !canvas) return;
    if (!compareActive && !previewRoot) return;
    let raf = requestAnimationFrame(() => {
      try {
        if (compareActive) {
          const tA = ev.evaluate(graph, compare.a);
          const tB = ev.evaluate(graph, compare.b);
          if (tA && tB) ctx.blitCompareToCanvas(tA.tex, tB.tex, canvas, splitFrac, { channel });
        } else {
          const target = ev.evaluate(graph, previewRoot);
          if (target) ctx.blitToCanvas(target.tex, canvas, { channel });
        }
        setStatus('');
        setErrorNodeId(null);
      } catch (err) {
        setStatus(`⚠ ${err.message}`);
        setErrorNodeId(err.nodeId || null);
        setErrorMessage(err.message || String(err));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [graph, previewRoot, textureTick, compareActive, compare.a, compare.b, splitFrac, channel]);

  // Debounced so a drag's stream of updates writes the shared store once it
  // settles, not on every pointermove. Persists the whole workspace (project
  // link + every open tab), not just the active graph.
  useEffect(() => {
    const t = setTimeout(() => onSharedChange('ne_workspace', { projectName, tabs, activeTabIdx }), 250);
    return () => clearTimeout(t);
  }, [projectName, tabs, activeTabIdx, onSharedChange]);

  // ── Graph edits (all pure; tags group drags into single undo steps) ───────
  const onParams = useCallback((id, patch) => {
    setGraph(g => setNodeParams(g, id, patch), `param:${id}:${Object.keys(patch).join(',')}`);
  }, [setGraph]);
  const onMoveNode = useCallback((id, pos) => setGraph(g => setNodePos(g, id, pos), `move:${id}`), [setGraph]);
  // Group drag: every selected node moves in the SAME undo step (one constant
  // tag), not one step per node per pointermove frame.
  const onMoveNodes = useCallback((updates) => setGraph(g => setNodePositions(g, updates), 'move-group'), [setGraph]);
  const onConnect = useCallback((from, to) => setGraph(g => connect(g, from, to)), [setGraph]);
  const onDisconnect = useCallback((edge) => setGraph(g => disconnect(g, edge)), [setGraph]);
  const onRemoveNode = useCallback((id) => {
    setGraph(g => removeNode(g, id));
    setSelectedIds(s => (s.has(id) ? new Set([...s].filter(x => x !== id)) : s));
    setFrozenId(f => (f === id ? null : f));
    setCompare(({ a, b }) => (a === id || b === id ? { a: a === id ? null : a, b: b === id ? null : b } : { a, b }));
  }, [setGraph]);
  const onRemoveNodes = useCallback((ids) => {
    setGraph(g => removeNodes(g, ids));
    setSelectedIds(new Set());
    setFrozenId(f => (ids.includes(f) ? null : f));
    setCompare(({ a, b }) => ({ a: ids.includes(a) ? null : a, b: ids.includes(b) ? null : b }));
  }, [setGraph]);

  const onAddNode = useCallback((type) => {
    setGraph(g => {
      const { graph: ng, id } = addNode(g, type, [40 + Math.random() * 60, 210 + Math.random() * 60]);
      queueMicrotask(() => { setSelectedIds(new Set([id])); setSelectedEdge(null); });
      return ng;
    });
  }, [setGraph]);

  // Output→output drag drop: insert a Combine node wired to both (base/over).
  const onCombineOutputs = useCallback((a, b, pos) => {
    setGraph(g => {
      const { graph: g1, id } = addNode(g, 'layer-composer', [pos.x - 88, pos.y - 15]);
      let g2 = connect(g1, [a.id, a.socket], [id, 'base']);
      g2 = connect(g2, [b.id, b.socket], [id, 'over']);
      queueMicrotask(() => { setSelectedIds(new Set([id])); setSelectedEdge(null); });
      return g2;
    });
  }, [setGraph]);

  // Connection dropped on empty canvas: open the search there, remembering
  // which socket to auto-wire once a type is picked (see addFromSearch).
  const onLinkDragEmpty = useCallback((from, pos, localPos) => {
    setPendingLink({ from, pos, localPos });
    setSearchOpen(true); setSearchQuery('');
    queueMicrotask(() => searchInputRef.current?.focus());
  }, []);

  // Selecting node(s) clears an edge selection and vice-versa.
  const handleSelectNodes = useCallback((ids) => { setSelectedIds(new Set(ids)); setSelectedEdge(null); }, []);
  const handleSelectEdge = useCallback((edge) => { setSelectedEdge(edge); setSelectedIds(new Set()); }, []);

  const onPickMode = (key) => {
    setGraph(() => MODES[key].makeGraph());
    setSelectedIds(new Set()); setSelectedEdge(null); setStatus('');
  };

  const setCanvasSize = (dim, value) => {
    const v = Math.max(1, Math.min(4096, Math.round(Number(value) || 1)));
    setGraph(g => ({ ...g, canvas: { ...g.canvas, [dim]: v } }), `canvas:${dim}`);
  };

  // ── Palette — every registered node, always (no mode filtering) ──────────
  const palette = useMemo(() => {
    const defs = allNodeDefs();
    return CATEGORY_ORDER.map(cat => ({ cat, defs: defs.filter(d => d.category === cat) })).filter(g => g.defs.length);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const flat = palette.flatMap(g => g.defs);
    return q ? flat.filter(d => d.label.toLowerCase().includes(q) || d.type.includes(q)) : flat;
  }, [palette, searchQuery]);

  // Plain Tab-search just adds a node; link-drag-search (pendingLink set) also
  // wires it to whichever socket was being dragged when the drop landed on
  // empty canvas.
  const addFromSearch = useCallback((type) => {
    if (pendingLink) {
      setGraph(g => {
        const { graph: ng, id } = addNode(g, type, [pendingLink.pos.x - 10, pendingLink.pos.y - 15]);
        const def = getNodeDef(type);
        const from = pendingLink.from;
        let g2 = ng;
        if (from.dir === 'out' && def.inputs.length) g2 = connect(ng, [from.id, from.socket], [id, def.inputs[0].name]);
        else if (from.dir === 'in' && def.outputs.length) g2 = connect(ng, [id, def.outputs[0].name], [from.id, from.socket]);
        queueMicrotask(() => { setSelectedIds(new Set([id])); setSelectedEdge(null); });
        return g2;
      });
      setPendingLink(null);
    } else {
      onAddNode(type);
    }
    setSearchOpen(false);
  }, [pendingLink, onAddNode, setGraph]);

  // Viewport drag mode: only when a Transform node is selected and has drag on.
  // The drag writes straight into params.x/y (the parametric rule, §6.1).
  const selectedNode = selectedId ? graph.nodes[selectedId] : null;
  const dragTransform = selectedNode?.type === 'transform' && selectedNode.params?.drag;
  const frozenNode = frozenId ? graph.nodes[frozenId] : null;
  const frozenLabel = frozenNode ? (frozenNode.label || getNodeDef(frozenNode.type).label) : null;
  const onObjectDrag = useCallback((du, dv) => {
    setGraph(g => {
      const n = g.nodes[selectedId];
      if (!n) return g;
      return setNodeParams(g, selectedId, {
        x: (Number(n.params.x) || 0) + du,
        y: (Number(n.params.y) || 0) + dv,
      });
    }, `drag:${selectedId}`);
  }, [selectedId, setGraph]);

  // ── Global keyboard: Tab search, Delete, Undo/Redo ────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

      // Tab opens the add-node search (unless typing in a field). Not a
      // link-drag-search, so make sure a stale pendingLink can't sneak in an
      // auto-connect from some earlier, unrelated drag.
      if (e.key === 'Tab' && !inField && !searchOpen) {
        e.preventDefault();
        setPendingLink(null);
        setSearchOpen(true); setSearchQuery('');
        queueMicrotask(() => searchInputRef.current?.focus());
        return;
      }
      if (inField) return; // let form fields keep their own keys (incl. text undo)

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdge) { onDisconnect(selectedEdge); setSelectedEdge(null); e.preventDefault(); }
        else if (selectedIds.size > 0) { onRemoveNodes([...selectedIds]); e.preventDefault(); }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }

      // F freezes/unfreezes the Viewport on whichever single node is selected.
      if (!mod && !e.altKey && (e.key === 'f' || e.key === 'F') && selectedId) {
        e.preventDefault();
        toggleFreeze(selectedId);
        return;
      }
      // C marks/unmarks the selected node as compare-A or -B.
      if (!mod && !e.altKey && (e.key === 'c' || e.key === 'C') && selectedId) {
        e.preventDefault();
        toggleCompare(selectedId);
        return;
      }
      // B bypasses/un-bypasses the selected node (passthrough of input 0).
      if (!mod && !e.altKey && (e.key === 'b' || e.key === 'B') && selectedId) {
        e.preventDefault();
        toggleBypass(selectedId);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, selectedId, selectedEdge, searchOpen, onDisconnect, onRemoveNodes, undo, redo, toggleFreeze, toggleCompare, toggleBypass]);

  // ── Persistence ────────────────────────────────────────────────────────
  // In a project: Save/Save All write straight to disk (node-editor-save-graph).
  // Outside one: Save falls back to the pre-project browser download.
  const activeTab = tabs[activeTabIdx];

  const downloadGraph = (label, g) => {
    const blob = new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${label || g.mode || 'graph'}.fmtgraph`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const onSave = async () => {
    if (!projectName) { downloadGraph(activeTab.label, activeTab.graph); setStatus('✓ Saved .fmtgraph'); return; }
    setStatus('Saving…');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('project saves need the desktop app');
      const res = await api.invoke('node-editor-save-graph', { project: projectName, label: activeTab.label, graph: activeTab.graph });
      setStatus(res?.success ? `✓ Saved "${activeTab.label}" to ${projectName}` : `⚠ ${res?.error || 'save failed'}`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  };

  const onSaveAll = async () => {
    if (!projectName) return;
    setStatus('Saving all…');
    try {
      const api = window.electronAPI;
      if (!api?.invoke) throw new Error('project saves need the desktop app');
      for (const t of tabs) {
        const res = await api.invoke('node-editor-save-graph', { project: projectName, label: t.label, graph: t.graph });
        if (!res?.success) throw new Error(`${t.label}: ${res?.error || 'save failed'}`);
      }
      setStatus(`✓ Saved all ${tabs.length} tab(s) to ${projectName}`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  };

  const onLoadGraphFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-loading the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.nodes || !parsed.canvas) {
          setStatus('⚠ not a valid .fmtgraph'); return;
        }
        if (!Array.isArray(parsed.edges)) parsed.edges = [];
        const unknown = Object.values(parsed.nodes).find(n => !hasNodeDef(n.type));
        if (unknown) { setStatus(`⚠ unknown node type "${unknown.type}"`); return; }
        setGraph(() => parsed);
        setSelectedIds(new Set()); setSelectedEdge(null);
        setStatus(`✓ Loaded into "${activeTab.label}"`);
      } catch (err) { setStatus(`⚠ load failed: ${err.message}`); }
    };
    reader.readAsText(file);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  // Called with the id of the output node whose commit-button was pressed, so a
  // graph with several outputs exports exactly the one you clicked. Falls back
  // to findOutput() only for programmatic callers that pass nothing.
  const onExport = async (nodeId) => {
    const outputId = nodeId || findOutput(graph);
    if (!outputId) { setStatus('⚠ no output node in the graph'); return; }
    setStatus('Selecting folder…');
    // Prefer the active map's own folder (Settings' mapName) over the bare
    // maps root — exporting a WaterRamp/EnvCube almost always means "into the
    // map I'm currently working on".
    const mapsFolder = (settings?.mapsFolder || '').trim();
    const activeMap = (settings?.mapName || '').trim();
    const defaultPath = (mapsFolder && activeMap ? `${mapsFolder.replace(/[\\/]+$/, '')}\\${activeMap}` : mapsFolder) || undefined;
    let res;
    try {
      res = await window.electronAPI.invoke('settings-pick-folder', { title: 'Export DDS to folder', defaultPath });
    } catch { setStatus('⚠ folder picker unavailable'); return; }
    if (!res?.success || !res.path) { setStatus(''); return; }

    setStatus('Rendering + encoding…');
    try {
      const out = await exportGraphToDds({
        ctx: ctxRef.current, evaluator: evalRef.current, graph, outputId, dir: res.path,
      });
      setStatus(out.success ? `✓ Exported ${out.path} (${(out.bytes / 1024).toFixed(1)} KB)` : `⚠ ${out.error}`);
    } catch (err) {
      setStatus(`⚠ ${err.message}`);
    }
  };

  if (glError) {
    return (
      <div className="node-editor-tab">
        <div className="ne-fatal">WebGL2 is required for the Texture Editor and could not be initialised.<br />{glError}</div>
      </div>
    );
  }

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return (
    <div className="node-editor-tab">
      {/* Toolbar — design-system primitives only (§5): selects are fields with
          a chevron, numbers ride a T2 baseline, and every action is a boxless
          .ctrl-btn-*. There is deliberately NO primary CTA up here: exporting
          belongs to the output node that defines the file (see NodeGraph). */}
      <div className="ne-toolbar">
        <div className="ne-tool-group">
          <span className="ne-tool-label">Asset</span>
          <Dropdown
            value={graph.mode} onChange={onPickMode} ariaLabel="Asset type"
            options={MODE_LIST.map(m => ({ value: m.key, label: m.label }))}
          />
        </div>
        <div className="ne-tool-group">
          <span className="ne-tool-label">Canvas</span>
          <NumberField className="ne-num" min={1} max={4096} value={graph.canvas.w} onChange={v => setCanvasSize('w', v)} />
          <span className="ne-tool-x">×</span>
          <NumberField className="ne-num" min={1} max={4096} value={graph.canvas.h} onChange={v => setCanvasSize('h', v)} />
        </div>
        <div className="ne-tool-group">
          <button className="ctrl-btn-meta ne-glyph-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
          <button className="ctrl-btn-meta ne-glyph-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
        </div>

        <div className="ne-tool-group">
          <span className="ne-tool-label">Project</span>
          <Dropdown
            value={projectName || ''} onChange={openProject} ariaLabel="Project"
            options={[{ value: '', label: '— none —' }, ...projectList.map(p => ({ value: p, label: p }))]}
          />
          <button className="ctrl-btn-add" onClick={() => setNewProjectOpen(o => !o)} title="Create a new project">New</button>
        </div>
        {newProjectOpen && (
          <div className="ne-tool-group ne-tool-newproject">
            <input
              className="ctrl-input ctrl-input--text ne-name-input" type="text" placeholder="project name" autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmNewProject(); else if (e.key === 'Escape') setNewProjectOpen(false); }}
            />
            <button className="ctrl-btn-add" onClick={confirmNewProject}>Create</button>
          </div>
        )}

        <div className="ne-tool-spacer" />
        <div className="ne-tool-group">
          <button className="ctrl-btn-add" onClick={onSave} title={projectName ? `Save "${activeTab.label}" into ${projectName}` : 'Download this tab as a .fmtgraph file'}>Save</button>
          {projectName && <button className="ctrl-btn-add" onClick={onSaveAll} title="Save every open tab into this project">Save All</button>}
          <button className="ctrl-btn-add" onClick={() => fileInputRef.current?.click()} title="Load a .fmtgraph file into the active tab">Load</button>
          <input
            ref={fileInputRef} type="file" accept=".fmtgraph,.json,application/json"
            style={{ display: 'none' }} onChange={onLoadGraphFile}
          />
        </div>
      </div>

      {/* Gaea-style body: viewport (top) + graph (bottom) span the full width;
          the Toolbox docks left inside the graph, Properties right full-height. */}
      <div className="ne-body">
        <div className="ne-stage-left">
          <Viewport
            ref={canvasRef}
            w={graph.canvas.w}
            h={graph.canvas.h}
            status={status}
            onObjectDrag={dragTransform ? onObjectDrag : null}
            frozenLabel={frozenLabel}
            onUnfreeze={() => setFrozenId(null)}
            channel={channel}
            onChannelChange={setChannel}
            compareActive={compareActive}
            splitFrac={splitFrac}
            onSplitChange={setSplitFrac}
            compareALabel={compare.a ? (graph.nodes[compare.a]?.label || getNodeDef(graph.nodes[compare.a]?.type)?.label) : null}
            compareBLabel={compare.b ? (graph.nodes[compare.b]?.label || getNodeDef(graph.nodes[compare.b]?.type)?.label) : null}
            onExitCompare={() => setCompare({ a: null, b: null })}
            tabs={tabs}
            activeTabIdx={activeTabIdx}
            onSwitchTab={switchTab}
            onAddTab={addTab}
            onCloseTab={closeTab}
            onRenameTab={renameTab}
          />

          <div className="ne-graph-zone">
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
              onCombineOutputs={onCombineOutputs}
              onLinkDragEmpty={onLinkDragEmpty}
              errorNodeId={errorNodeId}
              errorMessage={errorMessage}
              compareA={compare.a}
              compareB={compare.b}
              onToggleCompare={toggleCompare}
              onToggleBypass={toggleBypass}
              onExport={onExport}
            />

            {/* Toolbox — .station tiles (primitives §7, the system's grid-style
                picker) rather than bordered buttons. The dock is a surface with
                no border of its own; it reads as docked by position. */}
            <div className="ne-palette-dock">
              <div className="ne-panel-title">Toolbox</div>
              {palette.map(({ cat, defs }) => (
                <div key={cat} className="ne-palette-cat">
                  <div className="ne-palette-cat-label" style={{ color: categoryColor(cat) }}>{cat}</div>
                  {/* The node's category is carried by the LABEL COLOUR, not by
                      a swatch in front of it — one element instead of two, and
                      the hue lands on the thing you actually read. */}
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
              <div className="ne-palette-hint">Tab to search</div>
            </div>

            {searchOpen && (
              <div
                className="ne-search"
                style={pendingLink ? { top: pendingLink.localPos.y + 8, left: pendingLink.localPos.x + 8, transform: 'none' } : undefined}
                onPointerDown={e => e.stopPropagation()}
              >
                {pendingLink && (
                  <div className="ne-search-connect-hint">
                    Connecting {pendingLink.from.dir === 'out' ? 'from' : 'to'} <strong>{pendingLink.from.socket}</strong> — pick a node
                  </div>
                )}
                <input
                  ref={searchInputRef}
                  className="ctrl-input ctrl-input--text ne-search-input"
                  placeholder="Search nodes… (Enter to add, Esc to close)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { const first = searchResults[0]; if (first) addFromSearch(first.type); }
                    else if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); setPendingLink(null); }
                  }}
                />
                <div className="ne-search-list">
                  {searchResults.length === 0 && <div className="ne-search-empty">No matching nodes</div>}
                  {searchResults.map(d => (
                    <button key={d.type} className="station ne-search-item" onClick={() => addFromSearch(d.type)}>
                      <span className="ne-search-item-label" style={{ color: categoryColor(d.category) }}>{d.label}</span>
                      <span className="ne-search-item-cat">{d.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ne-inspector-col">
          <Inspector graph={graph} selectedId={selectedId} selectedCount={selectedIds.size} onParams={onParams} />
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;
