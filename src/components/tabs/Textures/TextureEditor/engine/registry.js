/**
 * registry.js — the single extension point of the node editor.
 *
 * A node *type* registers itself here with everything the rest of the system
 * needs to treat it uniformly: a params schema (drives validation + the
 * auto-generated inspector UI), its input/output sockets, an optional custom
 * sub-editor component, and a `render(ctx, args)` that produces its output
 * texture. The engine, the graph UI and the inspector never special-case a
 * node type — they read it out of this registry.
 *
 * This is what collapses the old "general vs. SupCom-specific nodes"
 * distinction into nothing: a `sky-gradient` source (reads a .scmap) and a
 * `noise` source (pure shader) are the same kind of registry entry with
 * different `render` bodies.
 *
 * Node contract (see nodes/*.js):
 *   {
 *     type:     'gradient',
 *     category: 'source' | 'modifier' | 'compositor' | 'output',
 *     label:    'Gradient',
 *     accent:   '#rrggbb',              // card tint (optional)
 *     params:   { key: { type, default, min?, max?, step?, label?, options? } },
 *     inputs:   [{ name: 'in' }],        // bound to u_in0, u_in1, … in render order
 *     outputs:  [{ name: 'out' }],
 *     editor:   ReactComponent | null,   // custom sub-editor; else auto-UI from params
 *     isOutput: false,
 *     render:   (ctx, { params, inputs, target }) => void   // draws into target
 *   }
 *
 * `render` receives already-evaluated input textures and a freshly-allocated
 * target; it must be a pure function of (params, inputs) — no hidden state.
 */

const REGISTRY = new Map();

export function registerNode(def) {
  if (!def?.type) throw new Error('[node-editor] registerNode: missing type');
  if (REGISTRY.has(def.type)) {
    throw new Error(`[node-editor] node type "${def.type}" already registered`);
  }
  const normalised = {
    accent: '#8aa0c0',
    inputs: [],
    outputs: [{ name: 'out' }],
    editor: null,
    isOutput: def.category === 'output',
    params: {},
    ...def,
  };
  REGISTRY.set(def.type, normalised);
  return normalised;
}

export function getNodeDef(type) {
  const def = REGISTRY.get(type);
  if (!def) throw new Error(`[node-editor] unknown node type "${type}"`);
  return def;
}

export function hasNodeDef(type) {
  return REGISTRY.has(type);
}

export function allNodeDefs() {
  return [...REGISTRY.values()];
}

/** Default params object for a freshly-created node of `type`. */
export function defaultParams(type) {
  const { params } = getNodeDef(type);
  const out = {};
  for (const key in params) out[key] = structuredClone(params[key].default);
  return out;
}

export const CATEGORY_ORDER = ['source', 'modifier', 'compositor', 'output'];

// Semantic node colours — a node's hue means its *role*, not its identity:
// every source is one colour, every modifier another, etc. (Blender's node
// families read the same way.) These are data/object colours (Role 2), fed to
// the UI inline as `--node-accent`; per-node `accent` fields in the defs are
// legacy fallbacks and no longer drive the card colour.
export const CATEGORY_COLORS = {
  source:     '#5ec8ff', // blue
  modifier:   '#b98cff', // purple
  compositor: '#ffb454', // amber
  output:     '#ff6b8a', // rose
};

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#8aa0c0';
}

/** The semantic colour for a node def (by category). */
export function nodeColor(def) {
  return categoryColor(def?.category);
}
