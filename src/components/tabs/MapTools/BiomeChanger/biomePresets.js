/**
 * biomePresets — the biome library. **This is the file you fill in.**
 *
 * Nothing else needs touching to add a biome: drop another object into
 * BIOME_PRESETS and it appears in the tab, with its coverage measured and shown.
 *
 * ─── The one rule ────────────────────────────────────────────────────────────
 *
 * **Absent means "leave alone".** Every field at every depth is optional. A
 * preset holding nothing but `textures.rock` is valid and does exactly that — it
 * swaps rock and touches nothing else. So fill presets in passes: textures first,
 * water and lighting when you have values you like, props last.
 *
 * The flip side: an *unknown* key or a malformed value is an error, not a no-op.
 * `validatePreset()` reports those in the tab, and `electron/modules/biome.js`
 * rejects the patch — a typo must never read as success.
 *
 * ─── The fast way to fill one ─────────────────────────────────────────────────
 *
 * Don't type paths. Open a map whose look you want in the tab, read its biome,
 * check the guessed roles in the Layers section, then hit **Capture as preset**
 * in Configuration. You get a complete preset object as JSON on the clipboard —
 * paste it in here, give it an id, label, blurb and swatch, done. The `tropical`
 * entry below was made exactly that way (from the stock map X1MP_010), and is the
 * reference for what a filled preset looks like.
 *
 * ─── Schema ───────────────────────────────────────────────────────────────────
 *
 *   id       string   unique, kebab-case. The value persisted in user settings.
 *   label    string   what the user sees.
 *   blurb    string   one line, shown under the label.
 *   swatch   string[] 2–3 hex colours for the preset card. UI only, never written
 *                     to the map. Capture derives them from water/sun/fog.
 *
 *   textures { <role>: { albedo, normal, scale, normalScale }
 *                     | [ { … }, { … } ] }
 *     Keyed by ROLE, never by layer index — stratum 3 is rock on one map and sand
 *     on the next. Roles: base · grass · dirt · sand · gravel · rock · cliff ·
 *     snow · accent · macro  (see BIOME_ROLES in Shared/MapLogic/biomeLogic.js).
 *     A role may hold ONE object (every layer of that role gets it) or an ARRAY
 *     of variants (the nth layer of that role gets the nth entry, the last entry
 *     repeating). Real maps carry two or three subtly different grasses, and a
 *     single texture per role would flatten them — that is what variants are for.
 *     `macro` is textures[9], the map-wide overlay, and has no normal.
 *     `scale`/`normalScale` are only applied when the user enables "adopt preset
 *     tile scales" — off by default, because tiling is authored per map.
 *     Always give `base` a value: it is the layer that shows everywhere.
 *
 *   water    { surfaceColor:[r,g,b], colorLerp:[a,b], refractionScale, fresnelBias,
 *              fresnelPower, unitReflection, skyReflection, sunShininess,
 *              sunStrength, sunDirection:[x,y,z], sunColor:[r,g,b], sunReflection,
 *              sunGlow, texPathCubeMap, texPathWaterRamp, waveNormalRepeats:[4],
 *              waveTextures:[{ path, movement:[u,v] } × 4] }
 *     Water *level* (elevation / elevationDeep / elevationAbyss) is not patchable
 *     — it is map geometry, and moving it would re-flood the terrain.
 *
 *   lighting { lightingMultiplier, sunDirection:[x,y,z], sunAmbience:[r,g,b],
 *              sunColor:[r,g,b], shadowFillColor:[r,g,b], specularColor:[4],
 *              bloom, fogColor:[r,g,b], fogStart, fogEnd }
 *     Colour channels routinely exceed 1.0 in FA — that is intended, not a bug.
 *     Leave fogStart/fogEnd out unless you mean them: they scale with map size.
 *
 *   skybox   { horizonColor:[r,g,b], zenithColor:[r,g,b], midColor:[r,g,b],
 *              cirrusColor:[r,g,b], cirrusMultiplier, cirrusTexture, albedo,
 *              glow, decalGlowMultiplier }
 *     Needs a v60 map. Dome geometry is not patchable — it scales with map size.
 *
 *   env      { backgroundPath, skyCubePath }   the sky the terrain reflects
 *   minimap  { miniMapDeepWaterColor, miniMapContourColor, miniMapShoreColor,
 *              miniMapLandStartColor, miniMapLandEndColor }  — 8 hex digits, rrggbbaa
 *
 *   props    { family, overrides }
 *     `family` is an env folder under /env/ that the prop scan found, i.e. one of
 *     crystalline · desert · evergreen · geothermal · lava · redrocks · swamp ·
 *     tropical · tundra. The swap maps tree→tree and rock→rock inside that family;
 *     it never invents assets, so a family with no trees is reported, not faked.
 *     `overrides: { '<source .bp path, lowercase>': '<target .bp path>' }` pins
 *     individual blueprints when the automatic match picks something you dislike.
 */

export const BIOME_PRESETS = [
  // ══ FILLED — the reference. Captured from the stock map X1MP_010 (v60,
  //    TTerrainXP), floats rounded to four decimals for legibility. ══════════
  {
    id: 'tropical',
    label: 'Tropical',
    blurb: 'Coral shallows, humid haze, hard equatorial sun.',
    swatch: ['#1cffff', '#ffff8c', '#9cb2c7'],

    textures: {
      base:   { albedo: '/env/tropical/layers/trop_sand_albedo.dds',        scale: 5,  normal: '/env/desert/layers/des_sandlight_normal.dds', normalScale: 4 },
      // Identical to `base` on purpose: the source map's lower layer *is* its sand,
      // normal included. Pairing an albedo with a normal from a different layer
      // would make applying this preset to its own map a change instead of a no-op.
      sand:   { albedo: '/env/tropical/layers/trop_sand_albedo.dds',        scale: 5,  normal: '/env/desert/layers/des_sandlight_normal.dds', normalScale: 4 },
      accent: { albedo: '/env/tropical/layers/tr_reef_coral2_albedo.dds',   scale: 13, normal: '/env/tropical/layers/tr_reef_coral_normal.dds', normalScale: 8 },
      gravel: { albedo: '/env/evergreen2/layers/eg_gravel005_albedo.dds',   scale: 6,  normal: '/env/desert/layers/des_sandlight_normal.dds', normalScale: 4 },
      dirt:   { albedo: '/env/evergreen2/layers/eg_dirt002_albedo.dds',     scale: 8,  normal: '/env/tropical/layers/trbush_moss_normal.dds', normalScale: 7.3 },
      rock:   { albedo: '/env/tropical/layers/trrock007_albedo.dds',        scale: 10, normal: '/env/tropical/layers/trrock006_normal.dds',   normalScale: 12 },
      // Four grass layers on the source map, two distinct textures — captured as
      // variants so applying this preset back onto its own map is a true no-op.
      grass: [
        { albedo: '/env/evergreen2/layers/evgrass010a_albedo.dds', scale: 10, normal: '/env/tropical/layers/trop_rock_normal.dds', normalScale: 10 },
        { albedo: '/env/evergreen2/layers/evgrass009_albedo.dds',  scale: 15.3, normal: '/env/tropical/layers/trop_sand_normal.dds', normalScale: 10 },
        { albedo: '/env/evergreen2/layers/evgrass010a_albedo.dds', scale: 15, normal: '/env/tropical/layers/trop_sand_normal.dds', normalScale: 12 },
        { albedo: '/env/evergreen2/layers/evgrass010a_albedo.dds', scale: 15, normal: '/env/evergreen2/layers/eg_snow_normal.dds', normalScale: 10 },
      ],
      macro:  { albedo: '/env/evergreen/layers/macrotexture000_albedo.dds', scale: 128 },
      // cliff and snow deliberately absent — the source map has neither, so those
      // layers stay as they are on any map that does. Fill them when you find a
      // tropical cliff/snow pair you like.
    },

    water: {
      surfaceColor:      [0.11, 1.03, 2.0],
      colorLerp:         [0.0, 0.0],
      refractionScale:   0.386,
      fresnelBias:       0.14,
      fresnelPower:      1.5,
      unitReflection:    0.5,
      skyReflection:     0.678,
      sunShininess:      78.9,
      sunStrength:       3.9,
      sunDirection:      [0.0995, -0.9626, 0.2519],
      sunColor:          [0.52, 0.4741, 0.35],
      sunReflection:     2.02,
      sunGlow:           0.165,
      texPathCubeMap:    '/textures/environment/skycube_evergreen01a.dds',
      texPathWaterRamp:  '/textures/engine/waterramp_tropical02.dds',
      waveNormalRepeats: [0.05, 0.05, 0.1, 0.8],
      waveTextures: [
        { path: '/textures/engine/waves000.dds', movement: [-0.0052, 0.0295] },
        { path: '/textures/engine/waves.dds',    movement: [-0.0025, 0.0043] },
        { path: '/textures/engine/waves001.dds', movement: [0.0014, 0.0079] },
        { path: '/textures/engine/waves001.dds', movement: [0.0005, 0.0009] },
      ],
    },

    lighting: {
      lightingMultiplier: 1.5,
      sunDirection:    [-0.6601, 0.7071, -0.2534],
      sunAmbience:     [0.0, 0.0, 0.0],
      sunColor:        [1.53, 1.51, 1.38],
      shadowFillColor: [0.24, 0.24, 0.28],
      // [0..2] is terrain specular; [3] is the shader blurriness field, which the
      // source map left as denormal noise — written as a clean 0.
      specularColor:   [0.39, 0.39, 0.39, 0],
      bloom:           0.005,
      fogColor:        [0.61, 0.7, 0.78],
      // fogStart/fogEnd omitted on purpose — they scale with map size.
    },

    skybox: {
      horizonColor:        [0.6486, 0.8205, 0.84],
      zenithColor:         [0.0, 0.5, 0.75],
      midColor:            [0, 0, 0],
      cirrusColor:         [1.16, 1.16, 1.23],
      cirrusMultiplier:    1.8,
      cirrusTexture:       '/textures/environment/cirrus000.dds',
      albedo:              '/textures/environment/Decal_test_Albedo003.dds',
      glow:                '/textures/environment/Decal_test_Glow003.dds',
      decalGlowMultiplier: 0.1,
    },

    env: {
      backgroundPath: '/textures/environment/blackbackground.dds',
      skyCubePath:    '/textures/environment/defaultskycube.dds',
    },

    minimap: {
      miniMapDeepWaterColor: 'b58c47ff',
      miniMapContourColor:   '707070ff',
      miniMapShoreColor:     'e0c98cff',
      miniMapLandStartColor: '6b6375ff',
      miniMapLandEndColor:   'b0ceceff',
    },

    props: { family: 'tropical' },
  },

  // ══ TO FILL ═══════════════════════════════════════════════════════════════
  // Skeletons only. Each carries its label, blurb, swatch and prop family — the
  // parts that need no map to decide. `textures` and the look blocks come from
  // Capture: find a map with that biome, read it, capture, paste over the empty
  // blocks below. The tab shows each preset's coverage, so an unfilled one is
  // visibly unfilled rather than quietly doing nothing.
  //
  // `family` values are the env folders the prop scan actually found in this
  // install: crystalline · desert · evergreen · geothermal · lava · redrocks ·
  // swamp · tropical · tundra. Biomes without a folder of their own (autumn,
  // paradise, arctic) borrow the closest one — noted per entry.

  {
    id: 'autumn',
    label: 'Autumn',
    blurb: 'Rust and ochre ground, low amber sun, cold water.',
    swatch: ['#8a5a2b', '#ffd39c', '#5c6b78'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    // No /env/autumn in FA — evergreen carries the deciduous trees.
    props: { family: 'evergreen' },
  },
  {
    id: 'desert',
    label: 'Desert',
    blurb: 'Bleached sand, hard shadows, shallow turquoise water.',
    swatch: ['#c8a96b', '#fff0c4', '#3fa9a0'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'desert' },
  },
  {
    id: 'paradise',
    label: 'Paradise',
    blurb: 'Saturated green, white sand, clear lagoon blue.',
    swatch: ['#2fb84f', '#f2e6c8', '#27b6d8'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'tropical' },
  },
  {
    id: 'tundra',
    label: 'Tundra',
    blurb: 'Frozen gravel and lichen, thin pale light.',
    swatch: ['#8a9099', '#dfe6ec', '#4a5a6b'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'tundra' },
  },
  {
    id: 'arctic',
    label: 'Arctic',
    blurb: 'Deep snow, blue shadow, black open water.',
    swatch: ['#e8f1f7', '#9fc0dd', '#16283a'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    // No /env/arctic — tundra is the closest prop set.
    props: { family: 'tundra' },
  },
  {
    id: 'evergreen',
    label: 'Evergreen',
    blurb: 'The stock temperate look — grass, dirt, grey rock.',
    swatch: ['#4a7a3a', '#d8d2b8', '#3b5a6b'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'evergreen' },
  },
  {
    id: 'lava',
    label: 'Lava',
    blurb: 'Black basalt, ash drift, molten glow from below.',
    swatch: ['#2a2320', '#ff6a1e', '#8a2b12'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'lava' },
  },
  {
    id: 'swamp',
    label: 'Swamp',
    blurb: 'Wet moss and silt, heavy green haze, brown water.',
    swatch: ['#3d4a2b', '#7a8a5c', '#4a4028' ],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'swamp' },
  },
  {
    id: 'redrocks',
    label: 'Red Barrens',
    blurb: 'Iron-red rock and dust, dry light, no green at all.',
    swatch: ['#8a3a20', '#d98a5c', '#5a2a18'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'redrocks' },
  },
  {
    id: 'geothermal',
    label: 'Geothermal',
    blurb: 'Grey stone, sulphur staining, steam-lit sky.',
    swatch: ['#6b6b66', '#c8b45c', '#8a9aa8'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'geothermal' },
  },
  {
    id: 'crystalline',
    label: 'Crystalline',
    blurb: 'Alien violet mineral fields with hard specular light.',
    swatch: ['#7a5ca8', '#c8a8ff', '#2b2340'],
    textures: {},
    water: null, lighting: null, skybox: null, env: null, minimap: null,
    props: { family: 'crystalline' },
  },
];

export const getPreset = (id) => BIOME_PRESETS.find(p => p.id === id) ?? null;

export default BIOME_PRESETS;
