/**
 * biomeLogic — the decision half of the Biome Changer.
 *
 * `electron/modules/biome.js` reads a map's look and writes a resolved patch; it
 * has no idea what "autumn" means. Everything that *decides* lives here, renderer
 * side, so preset tweaking stays instant and the preset format never touches
 * main-process code. Same split as terrainTypeLogic ↔ modules/terraintype.js.
 *
 * The three ideas worth knowing before reading on:
 *
 * 1. **Layers carry roles, not numbers.** Stratum 3 is rock on one map and sand
 *    on the next, so a preset can never address layers by index. It maps
 *    *roles* (grass, rock, sand…) to textures, and the tool works out which role
 *    each of the map's layers currently plays — guessed from the texture file
 *    names, always overridable by hand.
 *
 * 2. **Absent means "leave alone", everywhere.** Every field of a preset is
 *    optional at every depth. A preset that only fills `textures.rock` is valid
 *    and applies exactly that. This is what makes presets fillable in passes
 *    instead of all at once.
 *
 * 3. **Nothing here is random.** Prop candidates are ranked and tie-broken by
 *    name so the same map plus the same preset always produces the same result —
 *    a re-run must be a no-op, not a reshuffle.
 *
 * 4. **A role may hold several textures.** Real maps carry two or three subtly
 *    different grasses; a single texture per role would flatten them, and a
 *    captured preset could not reproduce the map it came from. So a role entry is
 *    either one object (every layer of that role gets it) or an array (the nth
 *    layer of that role gets the nth entry, the last entry repeating).
 */

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * The role vocabulary a preset is keyed by. `patterns` drive auto-detection
 * against the texture's file name and are ordered most-specific first — the
 * first hit wins, so `cliff` must sit above `rock` and `macro` above everything.
 */
export const BIOME_ROLES = [
  { id: 'macro',  label: 'Macro',   hint: 'Map-wide overlay texture (textures[9]).', patterns: [/macrotexture/, /\bmacro/] },
  { id: 'snow',   label: 'Snow',    hint: 'Snow, ice, frost.',                       patterns: [/snow/, /\bice/, /frost/, /glacier/] },
  { id: 'cliff',  label: 'Cliff',   hint: 'Steep faces and mountain sides.',         patterns: [/cliff/, /\bcrag/, /mountain/] },
  { id: 'rock',   label: 'Rock',    hint: 'Flat stone, slabs, bedrock.',             patterns: [/rock/, /stone/, /slate/, /basalt/, /granite/] },
  { id: 'gravel', label: 'Gravel',  hint: 'Loose stone, scree, pebbles.',            patterns: [/gravel/, /pebble/, /scree/, /shingle/, /rubble/] },
  { id: 'sand',   label: 'Sand',    hint: 'Sand, dunes, beaches.',                   patterns: [/sand/, /\bdune/, /beach/, /desert/] },
  { id: 'dirt',   label: 'Dirt',    hint: 'Bare earth, mud, clay.',                  patterns: [/dirt/, /\bmud/, /soil/, /earth/, /clay/, /loam/] },
  { id: 'grass',  label: 'Grass',   hint: 'Grass, moss, meadow.',                    patterns: [/grass/, /moss/, /meadow/, /turf/] },
  { id: 'accent', label: 'Accent',  hint: 'A distinctive detail layer — coral, ash, crystal, undergrowth.', patterns: [/coral/, /reef/, /flower/, /leaf|leaves/, /\bash\b/, /lava/, /crystal/, /bush|fern/, /algae/, /swamp/] },
  { id: 'base',   label: 'Base',    hint: 'The lower layer everything else is painted over.', patterns: [] },
  { id: 'none',   label: '— skip —', hint: 'Leave this layer exactly as it is.',      patterns: [] },
];

export const ROLE_IDS = BIOME_ROLES.map(r => r.id);
export const roleById = (id) => BIOME_ROLES.find(r => r.id === id) || null;

/** Roles a preset is expected to fill — `none` is a UI choice, not preset data. */
export const PRESET_ROLE_IDS = ROLE_IDS.filter(id => id !== 'none');

/**
 * The ten texture slots a biome touches. The first nine mirror STRATUM_SLOTS
 * (each has an albedo *and* a normal); `macro` is textures[9], which has no
 * normal of its own.
 */
export const BIOME_LAYER_SLOTS = [
  { slot: 0, key: 'lower',    label: 'Lower (Base)', texIndex: 0, normalIndex: 0 },
  { slot: 1, key: 'stratum0', label: 'Stratum 0',    texIndex: 1, normalIndex: 1 },
  { slot: 2, key: 'stratum1', label: 'Stratum 1',    texIndex: 2, normalIndex: 2 },
  { slot: 3, key: 'stratum2', label: 'Stratum 2',    texIndex: 3, normalIndex: 3 },
  { slot: 4, key: 'stratum3', label: 'Stratum 3',    texIndex: 4, normalIndex: 4 },
  { slot: 5, key: 'stratum4', label: 'Stratum 4',    texIndex: 5, normalIndex: 5 },
  { slot: 6, key: 'stratum5', label: 'Stratum 5',    texIndex: 6, normalIndex: 6 },
  { slot: 7, key: 'stratum6', label: 'Stratum 6',    texIndex: 7, normalIndex: 7 },
  { slot: 8, key: 'stratum7', label: 'Stratum 7',    texIndex: 8, normalIndex: 8 },
  { slot: 9, key: 'macro',    label: 'Macro Overlay', texIndex: 9, normalIndex: null },
];

const baseName = (p) => String(p || '').replace(/\\/g, '/').split('/').pop().toLowerCase();

/**
 * Guess the role one layer plays, from its albedo name and — as a second
 * opinion — its normal map name. Returns `null` when nothing matches, which the
 * UI shows as "unassigned" rather than inventing a role: a wrong guess silently
 * paints sand where rock was, so no-guess is the safer failure.
 */
export function guessRole({ albedoPath, normalPath, isBase = false, isMacro = false }) {
  if (isMacro) return 'macro';
  const names = [baseName(albedoPath), baseName(normalPath)].filter(Boolean);
  for (const name of names) {
    for (const role of BIOME_ROLES) {
      if (role.patterns.some(rx => rx.test(name))) return role.id;
    }
  }
  return isBase ? 'base' : null;
}

/** Guess every layer's role from a biome state. → { [slot]: roleId|null } */
export function guessRoles(state) {
  const out = {};
  if (!state) return out;
  for (const sl of BIOME_LAYER_SLOTS) {
    const albedoPath = state.textures?.[sl.texIndex]?.path || '';
    const normalPath = sl.normalIndex != null ? (state.normals?.[sl.normalIndex]?.path || '') : '';
    // A layer with scale 0 is unused in FA — don't guess a role for it.
    const scale = state.textures?.[sl.texIndex]?.scale;
    if (!albedoPath && !normalPath) { out[sl.slot] = null; continue; }
    out[sl.slot] = scale === 0
      ? null
      : guessRole({ albedoPath, normalPath, isBase: sl.slot === 0, isMacro: sl.key === 'macro' });
  }
  return out;
}

// ─── Channels ─────────────────────────────────────────────────────────────────

/**
 * The switchable halves of a biome. Each is independent: a user who likes their
 * own water keeps it and takes only the textures. `presetKey` is the preset field
 * the channel reads; `stateKey` is what it overwrites on the map.
 */
export const BIOME_CHANNELS = [
  {
    id: 'textures', presetKey: 'textures', label: 'Textures & Normals',
    hint: 'Swaps each layer\'s albedo and normal by role. Stratum masks are untouched — the distribution stays, only the material changes.',
  },
  {
    id: 'water', presetKey: 'water', label: 'Water',
    hint: 'Surface colour, fresnel, sun response, water ramp and cubemap, wave normals. Water *level* is never touched — that is map geometry.',
  },
  {
    id: 'lighting', presetKey: 'lighting', label: 'Lighting & Fog',
    hint: 'Sun colour and direction, ambience, shadow fill, specular, bloom, fog colour and range.',
  },
  {
    id: 'skybox', presetKey: 'skybox', label: 'Skybox',
    hint: 'Horizon, zenith and cirrus colours plus the sky decal textures. Dome geometry stays — that scales with map size. Needs a v60 map.',
  },
  {
    id: 'env', presetKey: 'env', label: 'Environment Cube',
    hint: 'The background and sky-cube textures the terrain reflects.',
  },
  {
    id: 'minimap', presetKey: 'minimap', label: 'Minimap Colours',
    hint: 'The five minimap colours, so the tactical view matches the new ground.',
  },
  {
    id: 'props', presetKey: 'props', label: 'Props',
    hint: 'Remaps prop blueprints to the target env family, tree for tree and rock for rock. Changes reclaim — check the delta before applying.',
  },
];

export const DEFAULT_CHANNELS = {
  textures: true, water: true, lighting: true,
  skybox: true, env: false, minimap: true, props: false,
};

// ─── Preset inspection ────────────────────────────────────────────────────────

const isFilled = (v) => v !== null && v !== undefined
  && !(typeof v === 'object' && Object.keys(v).length === 0);

/**
 * The texture entry a role contributes to its `occurrence`-th layer. One object
 * covers every layer of the role; an array addresses them in order and its last
 * entry repeats, so a two-variant role still covers four layers.
 */
export function roleEntry(value, occurrence = 0) {
  if (!value) return null;
  if (!Array.isArray(value)) return value;
  if (value.length === 0) return null;
  return value[Math.min(occurrence, value.length - 1)] || null;
}

/**
 * What a preset actually covers, per channel — the honest answer to "is this one
 * ready?". Deliberately not a pass/fail: a preset with only textures filled is
 * usable, it just does less.
 */
export function presetCoverage(preset) {
  const tex = preset?.textures || {};
  const roles = PRESET_ROLE_IDS.filter(r => isFilled(tex[r]));
  const out = {};
  for (const ch of BIOME_CHANNELS) {
    out[ch.id] = ch.id === 'textures'
      ? { filled: roles.length > 0, detail: `${roles.length}/${PRESET_ROLE_IDS.length} roles`, roles }
      : { filled: isFilled(preset?.[ch.presetKey]), detail: isFilled(preset?.[ch.presetKey]) ? 'set' : '—' };
  }
  const filledCount = Object.values(out).filter(c => c.filled).length;
  // `isEmpty` asks "would this preset change how the map looks?", so the props
  // channel does not count: a skeleton that names nothing but an env family is
  // still an unfilled preset as far as the eye is concerned.
  const lookFilled = BIOME_CHANNELS.filter(ch => ch.id !== 'props' && out[ch.id].filled).length;
  return { channels: out, filledCount, lookFilled, isEmpty: lookFilled === 0 };
}

/**
 * Structural problems in a preset — typos, not gaps. Missing fields are legal
 * (see the module header); an *unknown* field or a malformed value is not, since
 * modules/biome.js will reject the patch at apply time and a preset author wants
 * to hear about it here instead.
 */
export function validatePreset(preset) {
  const problems = [];
  const push = (where, msg) => problems.push(`${where}: ${msg}`);

  if (!preset?.id)    push('preset', 'has no id');
  if (!preset?.label) push('preset', 'has no label');

  for (const [role, value] of Object.entries(preset?.textures || {})) {
    if (!PRESET_ROLE_IDS.includes(role)) { push(`textures.${role}`, `not a known role (${PRESET_ROLE_IDS.join(', ')})`); continue; }
    const variants = Array.isArray(value) ? value : [value];
    variants.forEach((entry, i) => {
      const where = `textures.${role}${Array.isArray(value) ? `[${i}]` : ''}`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { push(where, 'must be an object'); return; }
      for (const k of Object.keys(entry)) {
        if (!['albedo', 'normal', 'scale', 'normalScale'].includes(k)) push(`${where}.${k}`, 'unknown key');
      }
      if (entry.albedo && typeof entry.albedo !== 'string') push(`${where}.albedo`, 'must be a game path string');
      if (role === 'macro' && entry.normal) push(`${where}.normal`, 'the macro overlay has no normal slot');
    });
  }

  const vecLen = { surfaceColor: 3, colorLerp: 2, sunDirection: 3, sunColor: 3, sunAmbience: 3,
    shadowFillColor: 3, specularColor: 4, fogColor: 3, waveNormalRepeats: 4,
    horizonColor: 3, zenithColor: 3, midColor: 3, cirrusColor: 3 };
  for (const block of ['water', 'lighting', 'skybox']) {
    for (const [k, v] of Object.entries(preset?.[block] || {})) {
      const want = vecLen[k];
      if (want && !(Array.isArray(v) && v.length === want)) push(`${block}.${k}`, `must be an array of ${want} numbers`);
    }
  }
  for (const [k, v] of Object.entries(preset?.minimap || {})) {
    if (typeof v !== 'string' || !/^[0-9a-fA-F]{8}$/.test(v)) push(`minimap.${k}`, 'must be 8 hex digits (rrggbbaa)');
  }
  return problems;
}

// ─── Texture plan ─────────────────────────────────────────────────────────────

/**
 * One row per layer: what it is now, what the preset would make it, and why not
 * if it wouldn't. This is what the Layers section renders and what the patch is
 * built from — the UI never sees a decision the patch doesn't make.
 */
export function planTextureSwap({ state, preset, roleBySlot, adoptScales = false }) {
  if (!state) return [];
  // Occurrence index of each slot within its own role, in slot order — that is
  // what picks the variant out of an array-valued role entry.
  const seen = {};
  const occurrenceOf = {};
  for (const sl of BIOME_LAYER_SLOTS) {
    const role = roleBySlot?.[sl.slot] ?? null;
    if (!role || role === 'none') continue;
    occurrenceOf[sl.slot] = seen[role] || 0;
    seen[role] = occurrenceOf[sl.slot] + 1;
  }

  return BIOME_LAYER_SLOTS.map((sl) => {
    const role  = roleBySlot?.[sl.slot] ?? null;
    const entry = role && role !== 'none'
      ? roleEntry(preset?.textures?.[role], occurrenceOf[sl.slot] || 0)
      : null;

    const fromAlbedo = state.textures?.[sl.texIndex]?.path || '';
    const fromScale  = state.textures?.[sl.texIndex]?.scale;
    const fromNormal = sl.normalIndex != null ? (state.normals?.[sl.normalIndex]?.path || '') : '';
    const normalScale = sl.normalIndex != null ? state.normals?.[sl.normalIndex]?.scale : undefined;

    const toAlbedo = entry?.albedo || null;
    const toNormal = sl.normalIndex != null ? (entry?.normal || null) : null;
    const toScale  = adoptScales && entry?.scale != null ? entry.scale : null;
    const toNormalScale = adoptScales && sl.normalIndex != null && entry?.normalScale != null ? entry.normalScale : null;

    let skip = null;
    if (!role)                       skip = 'no role assigned';
    else if (role === 'none')        skip = 'skipped';
    else if (!entry)                 skip = `preset has no "${role}" texture`;
    else if (!toAlbedo && !toNormal) skip = `preset "${role}" has no albedo or normal`;
    if (fromScale === 0 && !skip)    skip = 'layer unused on this map (scale 0)';

    return {
      ...sl, role,
      fromAlbedo, fromNormal, fromScale, normalScale,
      toAlbedo, toNormal, toScale, toNormalScale,
      skip,
      changed: !skip && (
        (!!toAlbedo && toAlbedo !== fromAlbedo) ||
        (!!toNormal && toNormal !== fromNormal) ||
        (toScale != null && toScale !== fromScale) ||
        (toNormalScale != null && toNormalScale !== normalScale)
      ),
    };
  });
}

// ─── Prop plan ────────────────────────────────────────────────────────────────

/** What to do with a prop whose type does not exist in the target family. */
export const PROP_POLICIES = [
  { id: 'keep',     label: 'Keep as is',        hint: 'Leave the prop untouched — the map stays mixed rather than losing detail.' },
  { id: 'any-type', label: 'Any type in family', hint: 'Substitute something else from the target family — most consistent look, least faithful shape.' },
  { id: 'drop',     label: 'Remove',            hint: 'Delete the prop. Removes its reclaim from the map entirely.' },
];
const POLICY_IDS = PROP_POLICIES.map(p => p.id);

/** propType from a blueprint path: /env/<fam>/props/<type>/x.bp → '<type>'. */
function propTypeOf(gamePath) {
  const parts = String(gamePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
  const i = parts.findIndex(p => p.toLowerCase() === 'props');
  const next = i !== -1 ? parts[i + 1] : null;
  return next && !next.toLowerCase().endsWith('.bp') ? next.toLowerCase() : null;
}

const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z]+/).filter(t => t.length > 2);

/** Shared-token count between two prop names — a cheap "looks like the same thing". */
function nameAffinity(a, b) {
  const ta = new Set(tokens(a));
  return tokens(b).filter(t => ta.has(t)).length;
}

/**
 * Map every prop blueprint on the map onto one in the target env family.
 *
 * Deterministic and one-to-one per *blueprint*, not per instance: a map with five
 * tree types keeps five tree types rather than collapsing to one, and a re-run
 * with the same inputs produces the same mapping.
 *
 * Two independent knobs. `policy` handles the case where the target family has
 * nothing of the source's type. `matchReclaim` decides how candidates are ranked:
 * off ranks by name affinity alone (best-looking match), on lets reclaim mass
 * break ties so the map's economy moves as little as possible. Reclaim is always
 * *reported*, never silently equalised.
 */
export function planPropSwap({ state, library = [], preset, policy = 'keep', matchReclaim = false }) {
  const family = preset?.props?.family || null;
  const overrides = preset?.props?.overrides || {};
  const rows = [];
  const remap = {};
  const drop = [];
  let reclaimFrom = 0, reclaimTo = 0, changedInstances = 0;

  if (!state?.props?.byPath?.length) {
    return { rows, remap, drop, family, reclaimFrom, reclaimTo, reclaimDelta: 0, changedInstances, unmatched: 0 };
  }
  const effectivePolicy = POLICY_IDS.includes(policy) ? policy : 'keep';

  const byGamePath = new Map(library.map(p => [String(p.gamePath || '').toLowerCase(), p]));
  const inFamily = family
    ? library.filter(p => (p.biome || '').toLowerCase() === family.toLowerCase() && !p.isGroup)
    : [];

  // Candidates per propType, ranked once — stable order so the assignment below
  // is reproducible.
  const byType = new Map();
  for (const cand of inFamily) {
    const t = (cand.propType || propTypeOf(cand.gamePath) || 'misc').toLowerCase();
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(cand);
  }
  for (const list of byType.values()) list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const used = new Set();
  const sources = [...state.props.byPath].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  for (const src of sources) {
    const key    = src.path.toLowerCase();
    const libSrc = byGamePath.get(key);
    const type   = (libSrc?.propType || propTypeOf(src.path) || 'misc').toLowerCase();
    const massFrom = libSrc?.reclaimMass ?? null;

    let target = null;
    let note   = null;

    if (overrides[key]) {
      target = byGamePath.get(String(overrides[key]).toLowerCase())
            || { gamePath: overrides[key], name: baseName(overrides[key]), reclaimMass: null };
      note = 'preset override';
    } else if (!family) {
      note = 'preset names no env family';
    } else if ((src.family || '').toLowerCase() === family.toLowerCase()) {
      note = 'already in target family';
    } else {
      let pool = byType.get(type) || [];
      if (pool.length === 0 && effectivePolicy === 'any-type') {
        pool = [...byType.values()].flat();
        if (pool.length) note = `no ${type} in ${family} — took another type`;
      }
      const fresh = pool.filter(c => !used.has(c.gamePath));
      const ranked = (fresh.length ? fresh : pool).slice().sort((a, b) => {
        const affinity = nameAffinity(src.path, b.name) - nameAffinity(src.path, a.name);
        if (affinity) return affinity;
        if (matchReclaim && massFrom != null) {
          const da = Math.abs((a.reclaimMass ?? 0) - massFrom);
          const db = Math.abs((b.reclaimMass ?? 0) - massFrom);
          if (da !== db) return da - db;
        }
        return String(a.name).localeCompare(String(b.name));
      });
      target = ranked[0] || null;
      if (!target) {
        note = effectivePolicy === 'drop'
          ? `no ${type} in ${family} — removed`
          : `no ${type} in ${family} — kept`;
        if (effectivePolicy === 'drop') drop.push(key);
      }
    }

    if (target) used.add(target.gamePath);

    const massTo = target?.reclaimMass ?? null;
    if (target && target.gamePath.toLowerCase() !== key) {
      remap[key] = target.gamePath;
      changedInstances += src.count;
      reclaimFrom += (massFrom ?? 0) * src.count;
      reclaimTo   += (massTo   ?? 0) * src.count;
    }

    rows.push({
      from: src.path, fromName: libSrc?.name || baseName(src.path),
      fromFamily: src.family, count: src.count, type,
      to: target?.gamePath || null, toName: target?.name || null,
      massFrom, massTo, note,
      dropped: drop.includes(key),
      changed: !!target && target.gamePath.toLowerCase() !== key,
    });
  }

  return {
    rows, remap, drop, family,
    reclaimFrom, reclaimTo, reclaimDelta: reclaimTo - reclaimFrom,
    changedInstances,
    unmatched: rows.filter(r => !r.changed && !r.dropped).length,
  };
}

// ─── Patch ────────────────────────────────────────────────────────────────────

// scmap floats are float32, so a preset's 0.386 and the map's 0.38600000739 are
// the same number. Compared with tolerance, or a re-apply would look like work.
const sameNumber = (a, b) => Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b));

function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  if (typeof a === 'number' && typeof b === 'number') return sameNumber(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return Object.keys(a).every(k => sameValue(a[k], b[k]));
  }
  return false;
}

/**
 * Drop every field whose value the map already holds. The change list is this
 * tab's contract — "everything listed gets written, nothing else is touched" — and
 * a row for a field that is already correct breaks the second half of that: it
 * makes re-applying the same preset look like work instead of a no-op.
 */
function diffBlock(presetBlock, stateBlock) {
  if (!presetBlock) return null;
  const out = {};
  for (const [k, v] of Object.entries(presetBlock)) {
    if (v === null || v === undefined) continue;
    if (stateBlock && k in stateBlock && sameValue(v, stateBlock[k])) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// skyBox.midColor is bytes on the map and may be floats in a preset (the engine
// accepts both), so it needs its own comparison before the generic diff sees it.
function normalizeMidColor(v) {
  if (!Array.isArray(v) || v.length < 3) return v;
  return v.every(n => n >= 0 && n <= 1) ? v.map(n => Math.round(n * 255)) : v.map(n => Math.round(n));
}

/**
 * Turn plans + channel switches into the patch modules/biome.js consumes. Only
 * enabled channels contribute, only fields the preset actually fills, and only
 * where the map does not already agree — the patch is the single source of truth
 * for what apply will do, so anything the UI shows as "unchanged" must be absent.
 */
export function buildBiomePatch({ state, preset, roleBySlot, channels = DEFAULT_CHANNELS, adoptScales = false, propPlan = null }) {
  const patch = {};
  if (!state || !preset) return patch;

  if (channels.textures) {
    const rows = planTextureSwap({ state, preset, roleBySlot, adoptScales }).filter(r => r.changed);
    const textures = [], normals = [];
    for (const r of rows) {
      const tex = { index: r.texIndex };
      if (r.toAlbedo && r.toAlbedo !== r.fromAlbedo) tex.path = r.toAlbedo;
      if (r.toScale != null && r.toScale !== r.fromScale) tex.scale = r.toScale;
      if (tex.path || tex.scale != null) textures.push(tex);

      if (r.normalIndex != null) {
        const nrm = { index: r.normalIndex };
        if (r.toNormal && r.toNormal !== r.fromNormal) nrm.path = r.toNormal;
        if (r.toNormalScale != null && r.toNormalScale !== r.normalScale) nrm.scale = r.toNormalScale;
        if (nrm.path || nrm.scale != null) normals.push(nrm);
      }
    }
    if (textures.length) patch.textures = textures;
    if (normals.length)  patch.normals  = normals;
  }

  if (channels.water && isFilled(preset.water)) {
    // waveTextures sit beside the flat water block in the state, not inside it.
    const { waveTextures, ...flat } = preset.water;
    const water = diffBlock(flat, state.water) || {};
    if (waveTextures && !sameValue(waveTextures, state.waveTextures)) water.waveTextures = waveTextures;
    if (Object.keys(water).length) patch.water = water;
  }
  if (channels.lighting && isFilled(preset.lighting)) {
    const d = diffBlock(preset.lighting, state.lighting);
    if (d) patch.lighting = d;
  }
  if (channels.skybox && isFilled(preset.skybox) && state.skybox) {
    const { midColor, ...flat } = preset.skybox;
    const sky = diffBlock(flat, state.skybox) || {};
    if (midColor != null && !sameValue(normalizeMidColor(midColor), normalizeMidColor(state.skybox.midColor))) {
      sky.midColor = midColor;
    }
    if (Object.keys(sky).length) patch.skybox = sky;
  } else if (channels.skybox && isFilled(preset.skybox) && !state.skybox) {
    // No skybox block on this map — kept in the patch so the engine refuses it
    // loudly instead of the UI quietly dropping a channel the user switched on.
    patch.skybox = { ...preset.skybox };
  }
  if (channels.env && isFilled(preset.env)) {
    const d = diffBlock(preset.env, { backgroundPath: state.backgroundPath, skyCubePath: state.skyCubePath });
    if (d) patch.env = d;
  }
  if (channels.minimap && isFilled(preset.minimap)) {
    const d = diffBlock(preset.minimap, state.minimap);
    if (d) patch.minimap = d;
  }

  if (channels.props && propPlan && (Object.keys(propPlan.remap || {}).length || propPlan.drop?.length)) {
    patch.props = { remap: propPlan.remap || {}, drop: propPlan.drop || [] };
  }

  return patch;
}

/** Human-readable "what will change" rows for the Output section. */
export function describePatch(patch, propPlan) {
  const rows = [];
  const n = (v) => (Array.isArray(v) ? v.length : Object.keys(v || {}).length);
  if (patch.textures?.length) rows.push({ id: 'textures', label: 'Layer albedos', detail: `${patch.textures.length} slot(s)` });
  if (patch.normals?.length)  rows.push({ id: 'normals',  label: 'Layer normals', detail: `${patch.normals.length} slot(s)` });
  if (patch.water)    rows.push({ id: 'water',    label: 'Water',            detail: `${n(patch.water)} field(s)` });
  if (patch.lighting) rows.push({ id: 'lighting', label: 'Lighting & fog',    detail: `${n(patch.lighting)} field(s)` });
  if (patch.skybox)   rows.push({ id: 'skybox',   label: 'Skybox',           detail: `${n(patch.skybox)} field(s)` });
  if (patch.env)      rows.push({ id: 'env',      label: 'Environment cube',  detail: `${n(patch.env)} field(s)` });
  if (patch.minimap)  rows.push({ id: 'minimap',  label: 'Minimap colours',   detail: `${n(patch.minimap)} colour(s)` });
  if (patch.props) {
    rows.push({
      id: 'props', label: 'Props',
      detail: `${propPlan?.changedInstances ?? 0} instance(s) across ${n(patch.props.remap)} blueprint(s)`
            + (patch.props.drop?.length ? `, ${patch.props.drop.length} removed` : ''),
    });
  }
  return rows;
}

export const patchIsEmpty = (patch) => !patch || Object.keys(patch).length === 0;

// ─── Capture ──────────────────────────────────────────────────────────────────

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const hex2 = (n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
/** vec3 of floats (which FA lets exceed 1) → a clamped #rrggbb for a UI swatch. */
export const vecToHex = (v) => (Array.isArray(v) && v.length >= 3 ? `#${hex2(v[0])}${hex2(v[1])}${hex2(v[2])}` : null);

/**
 * Build a preset out of a map that already looks right — the fast way to fill the
 * preset file: open a map whose biome you like, capture, paste. Roles come from
 * the same guesser the Layers section shows, so what you saw is what you get.
 */
export function presetFromState({ state, roleBySlot, id = 'my-preset', label = 'My Preset', blurb = '' }) {
  if (!state) return null;

  // One variant per layer, in slot order, so a map with three different grasses
  // captures as three — applying the result back is then a true no-op. Roles
  // whose variants are all identical collapse to a single object, which keeps the
  // preset file readable.
  const collected = {};
  for (const sl of BIOME_LAYER_SLOTS) {
    const role = roleBySlot?.[sl.slot];
    if (!role || role === 'none') continue;
    const albedo = state.textures?.[sl.texIndex]?.path || '';
    if (!albedo) continue;
    const entry = { albedo, scale: state.textures[sl.texIndex].scale };
    if (sl.normalIndex != null) {
      const nrm = state.normals?.[sl.normalIndex];
      if (nrm?.path) { entry.normal = nrm.path; entry.normalScale = nrm.scale; }
    }
    (collected[role] ||= []).push(entry);
  }

  const textures = {};
  for (const [role, variants] of Object.entries(collected)) {
    const first = JSON.stringify(variants[0]);
    textures[role] = variants.every(v => JSON.stringify(v) === first) ? variants[0] : variants;
  }

  // The lower layer is written under `base` as well as under whatever it was
  // detected as. Without this, capturing a map whose lower layer reads as "sand"
  // produces a preset that skips the lower layer of every map where it reads as
  // plain "base" — and the base layer is the one that shows everywhere.
  const lower = state.textures?.[0];
  if (lower?.path && !textures.base) {
    textures.base = { albedo: lower.path, scale: lower.scale };
    const nrm = state.normals?.[0];
    if (nrm?.path) { textures.base.normal = nrm.path; textures.base.normalScale = nrm.scale; }
  }

  const swatch = [
    vecToHex(state.water?.surfaceColor),
    vecToHex(state.lighting?.sunColor),
    vecToHex(state.lighting?.fogColor),
  ].filter(Boolean);

  const water = { ...(state.water || {}) };
  if (state.waveTextures?.length) {
    water.waveTextures = state.waveTextures.map(wt => ({ path: wt.path, movement: wt.movement }));
  }

  return {
    id, label, blurb, swatch,
    textures,
    water,
    lighting: { ...(state.lighting || {}) },
    skybox:   state.skybox ? { ...state.skybox } : null,
    env: {
      backgroundPath: state.backgroundPath || undefined,
      skyCubePath:    state.skyCubePath || undefined,
    },
    minimap: { ...(state.minimap || {}) },
    props: {
      family: state.props?.byFamily?.find(f => f.family !== 'unknown')?.family || null,
      unmatched: 'keep',
    },
  };
}

/** The capture, as the text that goes into biomePresets.js. */
export const presetToSource = (preset) => JSON.stringify(preset, null, 2);
