/**
 * evaluator.js — pull-based lazy evaluation with content-hash caching.
 *
 * Given a graph and a "root" node to display/export, it walks the minimal set
 * of upstream nodes, renders each into a pooled framebuffer, and returns the
 * root's texture. Results are cached by the node's content hash
 * (see graph.computeHashes): drag a slider and only the changed node plus its
 * downstream re-render — untouched subtrees return their cached texture
 * instantly.
 *
 * The cache is a Map<hash, target>. Because a cached target can be an input to
 * any number of later passes, we never recycle a cached FBO into a pool; we
 * just cap the cache (LRU) and delete GL resources on eviction. For the graph
 * sizes this tool produces (tens of nodes) that is both simple and correct.
 */

import { getNodeDef } from './registry.js';
import { computeHashes, inputEdgesFor, topoSort } from './graph.js';

const CACHE_CAP = 96; // targets; evicted least-recently-used

// Bypass ("B" hotkey, pink dot) skips a node's own def.render and copies its
// first input straight through instead — same fullscreen-quad convention as
// every other pass, just a fixed no-op shader instead of the node's own.
const PASSTHROUGH_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_in0;
void main() { fragColor = texture(u_in0, v_uv); }`;

export function createEvaluator(ctx) {
  // hash -> { target, lru }
  const cache = new Map();
  let clock = 0;

  function touch(hash) {
    const e = cache.get(hash);
    if (e) e.lru = ++clock;
  }

  function evict() {
    while (cache.size > CACHE_CAP) {
      let oldest = null, oldestKey = null;
      for (const [k, e] of cache) {
        if (!oldest || e.lru < oldest.lru) { oldest = e; oldestKey = k; }
      }
      ctx.freeTarget(oldest.target);
      cache.delete(oldestKey);
    }
  }

  /**
   * Evaluate up to `rootId` and return its target (or null if the graph is
   * empty / root missing). Only dirty nodes render.
   */
  function evaluate(graph, rootId) {
    if (!rootId || !graph.nodes[rootId]) return null;
    const hashes = computeHashes(graph);
    const order = topoSort(graph);
    const need = ancestorsOf(graph, rootId);

    for (const id of order) {
      if (!need.has(id)) continue;
      const hash = hashes.get(id);
      if (cache.has(hash)) { touch(hash); continue; }

      const node = graph.nodes[id];
      const def = getNodeDef(node.type);
      const inputIds = inputEdgesFor(graph, id);
      const inputTargets = inputIds.map(srcId => (srcId ? cache.get(hashes.get(srcId))?.target : null));
      const inputTextures = inputTargets.map(t => (t ? t.tex : null));

      const target = ctx.allocTarget(graph.canvas.w, graph.canvas.h);
      try {
        if (node.bypass && inputTextures[0]) {
          // Bypassed with something wired: ignore this node's own render
          // entirely (params, type, everything) and just forward input 0.
          ctx.pass(ctx.program(PASSTHROUGH_FRAG), { target, inputs: [inputTextures[0]] });
        } else {
          // Bypassed but nothing wired into input 0 has nothing to forward —
          // fall back to the node's normal render (a source node ignores
          // `bypass` outright, same reasoning).
          def.render(ctx, {
            params: node.params,
            inputs: inputTextures,
            inputTargets,
            target,
            canvas: graph.canvas,
          });
        }
      } catch (err) {
        ctx.freeTarget(target);
        err.nodeId = id; // lets the UI redden the specific card that failed
        throw err;
      }
      cache.set(hash, { target, lru: ++clock });
    }

    evict();
    return cache.get(hashes.get(rootId))?.target || null;
  }

  /** Drop every cached target. Needed when a node's output changes without its
   *  content hash changing — e.g. an async texture finished loading behind a
   *  path param that itself never changed. */
  function invalidate() {
    for (const e of cache.values()) ctx.freeTarget(e.target);
    cache.clear();
  }

  function dispose() {
    invalidate();
  }

  return { evaluate, invalidate, dispose, _cache: cache };
}

/** Set of `rootId` and every node upstream of it. */
function ancestorsOf(graph, rootId) {
  const set = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (set.has(id)) continue;
    set.add(id);
    for (const srcId of inputEdgesFor(graph, id)) {
      if (srcId && !set.has(srcId)) stack.push(srcId);
    }
  }
  return set;
}
