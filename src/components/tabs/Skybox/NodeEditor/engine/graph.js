/**
 * graph.js — the `.fmtgraph` document model and its pure helpers.
 *
 * The document is the single source of truth (see docs/NODE_EDITOR_PLAN.md §1).
 * Every mouse interaction — dragging a node, dragging a planet inside a
 * Transform's sub-editor — only ever writes into this JSON. That is what makes
 * undo a snapshot, copy/paste a subtree, and rendering reproducible.
 *
 *   graph = {
 *     version: 1,
 *     mode: 'waterramp',
 *     canvas: { w, h },                    // render resolution for every pass
 *     nodes: { id: { type, params, pos:[x,y] } },
 *     edges: [ { from:[nodeId, socket], to:[nodeId, socket] } ],
 *   }
 *
 * These helpers are all pure: they take a graph and return a new graph (or a
 * derived value). No GL, no React — that keeps them trivially testable and
 * keeps the "document is truth" rule honest.
 */

import { getNodeDef, defaultParams } from './registry.js';

let _idCounter = 0;
// Ids avoid Math.random()/Date.now() (unavailable in some sandboxes and bad for
// reproducibility): a monotonic counter seeded from the existing node ids.
export function freshId(graph, prefix = 'n') {
  let max = _idCounter;
  for (const id of Object.keys(graph?.nodes || {})) {
    const m = /^[a-z]+(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  _idCounter = max + 1;
  return `${prefix}${_idCounter}`;
}

export function createNode(graph, type, pos = [0, 0]) {
  const id = freshId(graph);
  // `label` (custom display name, null = use the def's) and `bypass`
  // (passthrough of input 0, see evaluator.js) are document metadata sibling
  // to `pos` — not shader params, so they stay out of `params`/the hash-input
  // JSON.stringify and out of the auto-generated Inspector UI.
  return { id, node: { type, params: defaultParams(type), pos, label: null, bypass: false } };
}

export function addNode(graph, type, pos) {
  const { id, node } = createNode(graph, type, pos);
  return { graph: { ...graph, nodes: { ...graph.nodes, [id]: node } }, id };
}

export function removeNode(graph, id) {
  const nodes = { ...graph.nodes };
  delete nodes[id];
  const edges = graph.edges.filter(e => e.from[0] !== id && e.to[0] !== id);
  return { ...graph, nodes, edges };
}

/** Batched removeNode — a box-select multi-delete is one undo step, not N. */
export function removeNodes(graph, ids) {
  const idSet = new Set(ids);
  const nodes = { ...graph.nodes };
  for (const id of idSet) delete nodes[id];
  const edges = graph.edges.filter(e => !idSet.has(e.from[0]) && !idSet.has(e.to[0]));
  return { ...graph, nodes, edges };
}

/** Batched setNodePos — a group drag moves every selected node in one step. */
export function setNodePositions(graph, updates) {
  const nodes = { ...graph.nodes };
  for (const { id, pos } of updates) {
    if (nodes[id]) nodes[id] = { ...nodes[id], pos };
  }
  return { ...graph, nodes };
}

export function setNodeParams(graph, id, params) {
  const node = graph.nodes[id];
  if (!node) return graph;
  return { ...graph, nodes: { ...graph.nodes, [id]: { ...node, params: { ...node.params, ...params } } } };
}

export function setNodePos(graph, id, pos) {
  const node = graph.nodes[id];
  if (!node) return graph;
  return { ...graph, nodes: { ...graph.nodes, [id]: { ...node, pos } } };
}

/** Custom display name; empty/whitespace clears the override back to the def's label. */
export function setNodeLabel(graph, id, label) {
  const node = graph.nodes[id];
  if (!node) return graph;
  const clean = (label || '').trim();
  return { ...graph, nodes: { ...graph.nodes, [id]: { ...node, label: clean || null } } };
}

/** Bypass = the evaluator copies input 0 straight to output, skipping def.render
 *  entirely (see evaluator.js). Part of the hash (computeHashes below) since it
 *  changes what actually renders. */
export function setNodeBypass(graph, id, bypass) {
  const node = graph.nodes[id];
  if (!node) return graph;
  return { ...graph, nodes: { ...graph.nodes, [id]: { ...node, bypass: !!bypass } } };
}

/** Connect two sockets. An input socket accepts exactly one edge — the new one
 *  replaces any existing edge into that (node, socket). Rejects cycles. */
export function connect(graph, from, to) {
  if (from[0] === to[0]) return graph; // no self-loops
  const edges = graph.edges.filter(e => !(e.to[0] === to[0] && e.to[1] === to[1]));
  const candidate = { ...graph, edges: [...edges, { from, to }] };
  if (hasCycle(candidate)) return graph; // reject — keep it a DAG
  return candidate;
}

export function disconnect(graph, edge) {
  return {
    ...graph,
    edges: graph.edges.filter(
      e => !(e.from[0] === edge.from[0] && e.from[1] === edge.from[1] &&
             e.to[0] === edge.to[0] && e.to[1] === edge.to[1]),
    ),
  };
}

/** Input textures for a node, ordered by its def's `inputs`. Missing → null. */
export function inputEdgesFor(graph, id) {
  const def = getNodeDef(graph.nodes[id].type);
  return def.inputs.map(socket => {
    const edge = graph.edges.find(e => e.to[0] === id && e.to[1] === socket.name);
    return edge ? edge.from[0] : null; // source node id or null
  });
}

function adjacency(graph) {
  // node id -> [downstream node ids]
  const adj = new Map(Object.keys(graph.nodes).map(id => [id, []]));
  for (const e of graph.edges) {
    if (adj.has(e.from[0])) adj.get(e.from[0]).push(e.to[0]);
  }
  return adj;
}

export function hasCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(Object.keys(graph.nodes).map(id => [id, WHITE]));
  const adj = adjacency(graph);
  const visit = (id) => {
    color.set(id, GRAY);
    for (const next of adj.get(id) || []) {
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE && visit(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  };
  for (const id of color.keys()) {
    if (color.get(id) === WHITE && visit(id)) return true;
  }
  return false;
}

/** Kahn topological order over the whole graph. Throws on a cycle. */
export function topoSort(graph) {
  const indeg = new Map(Object.keys(graph.nodes).map(id => [id, 0]));
  for (const e of graph.edges) {
    if (indeg.has(e.to[0])) indeg.set(e.to[0], indeg.get(e.to[0]) + 1);
  }
  const adj = adjacency(graph);
  const queue = [...indeg.keys()].filter(id => indeg.get(id) === 0);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of adj.get(id) || []) {
      indeg.set(next, indeg.get(next) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== indeg.size) throw new Error('[node-editor] graph has a cycle');
  return order;
}

/** The output node, if any (first node whose def.isOutput). */
export function findOutput(graph) {
  return Object.keys(graph.nodes).find(id => {
    try { return getNodeDef(graph.nodes[id].type).isOutput; } catch { return false; }
  }) || null;
}

// ── Content hashing (drives the evaluator's cache) ──────────────────────────
// A node's hash folds in its type, its params, and its inputs' hashes. If a
// slider changes, only that node and everything downstream get a new hash and
// re-render; untouched subtrees hit the cache. Memoised per call.

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function computeHashes(graph) {
  const hashes = new Map();
  const order = topoSort(graph);
  for (const id of order) {
    const node = graph.nodes[id];
    const inputs = inputEdgesFor(graph, id)
      .map(srcId => (srcId ? hashes.get(srcId) : 'ø'))
      .join(',');
    hashes.set(id, djb2(`${node.type}|${JSON.stringify(node.params)}|${node.bypass ? 1 : 0}|${inputs}|${graph.canvas.w}x${graph.canvas.h}`));
  }
  return hashes;
}
