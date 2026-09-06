/**
 * toolRegistry — single source of truth for all tool metadata.
 *
 * Consumed by:
 *  - HomeScreen (ToolRail / ToolSlat / ProjectionStage)
 *  - ForgeMapToolkit.jsx (mega navbar config, header accent resolution)
 *
 * Adding a new tool:
 *  1. Add its accent variables to the design-system SSOT
 *     shared/DesignSystem/tokens.css (--<id>-color / -glow / -glow-strong)
 *  2. Add one entry to TOOLS below — home screen and navbar pick it up automatically
 *  3. Register its component + route in tabRoutes.jsx
 *
 * The `category` field is not just navigation metadata: `src/components/tabs/`
 * mirrors it on disk, one folder per category navLabel (Emitter, Scenery, Skybox,
 * Textures, MapTools, System, Community). Changing a tool's category means moving
 * its folder too, or the two drift apart again.
 *
 * Field reference:
 *  - color/glow/glowStrong: CSS color strings used for accent injection
 *  - colorVar:              bare custom-property name used by the mega navbar
 *  - description:           short copy (home screen)
 *  - navDescription:        long copy (mega navbar description panel)
 *  - index:                 two-digit designation for the future TRACE rail
 *  - status:                'active' | 'coming-soon'
 */

/**
 * Every category is defined by the *object it operates on*, never as "everything
 * else". `tools` used to be the only negatively-defined entry in this list, which
 * is why it collected anything without another home — a residual category always
 * does. Splitting it by "does this touch the map or not" would only move that
 * argument down a level (the SCMAP tool edits the map file more directly than
 * anything else here, yet reads as a utility), so the split is by object: a whole
 * map, a texture, or the suite itself.
 */
export const CATEGORIES = [
  { key: 'emitter',   homeLabel: 'Emitter Tools', navLabel: 'Emitter',   navDefaultDesc: 'Place and configure particle emitters — freestanding, attached to props and wreckages, and the terrain types that decide what units kick up as they drive.' },
  { key: 'generator', homeLabel: 'Scenery',        navLabel: 'Scenery',   navDefaultDesc: 'Generate and distribute props, trees and rock formations procedurally using masks and erosion maps.' },
  { key: 'skybox',    homeLabel: 'Skybox',        navLabel: 'Skybox',    navDefaultDesc: 'Design realistic star distributions and full skyboxes for immersive map atmospheres.' },
  { key: 'textures',  homeLabel: 'Textures',      navLabel: 'Textures',  navDefaultDesc: 'Author the texture assets a map loads — compose them from a node graph, or simulate them physically.' },
  { key: 'maptools',  homeLabel: 'Map Tools',     navLabel: 'Map Tools', navDefaultDesc: 'Work on a map as a whole — unpack and repack it, resize it, adapt it to another format, or render its preview.' },
  { key: 'system',    homeLabel: 'System',        navLabel: 'System',    navDefaultDesc: 'The suite itself rather than any one map — generation history, the raw editor CLI, and your settings.' },
  { key: 'community', homeLabel: 'Community' },
];

export const TOOLS = [
  {
    id: 'emitter',
    label: 'Emitter',
    category: 'emitter',
    index: '01',
    color: 'var(--emitter-color)',
    glow: 'var(--emitter-glow)',
    glowStrong: 'var(--emitter-glow-strong)',
    colorVar: '--emitter-color',
    description: 'Place and configure emitters.',
    navDescription: 'Place and configure particle emitters on the map with full control over type, frequency and output.',
    status: 'active',
  },
  {
    id: 'wreckages',
    label: 'Wreckages',
    category: 'emitter',
    index: '02',
    color: 'var(--wreckages-color)',
    glow: 'var(--wreckages-glow)',
    glowStrong: 'var(--wreckages-glow-strong)',
    colorVar: '--wreckages-color',
    description: 'Place and configure emitters attached to wreckages.',
    navDescription: 'Attach emitters to wreckage objects — smoke, fire and debris for authentic battlefield atmosphere.',
    status: 'active',
  },
  {
    id: 'props',
    label: 'Props',
    category: 'emitter',
    index: '03',
    color: 'var(--props-color)',
    glow: 'var(--props-glow)',
    glowStrong: 'var(--props-glow-strong)',
    colorVar: '--props-color',
    description: 'Place and configure emitters attached to props.',
    navDescription: 'Configure emitters on prop objects to add life and detail to static map elements.',
    status: 'active',
  },
  {
    id: 'customprops',
    label: 'Custom Props',
    category: 'generator',
    index: '04',
    color: 'var(--customprops-color)',
    glow: 'var(--customprops-glow)',
    glowStrong: 'var(--customprops-glow-strong)',
    colorVar: '--customprops-color',
    description: 'Generate custom prop files with texture adjustments from the library.',
    navDescription: 'Generate custom prop files with texture adjustments directly from the library assets.',
    status: 'active',
  },
  {
    id: 'treemap',
    label: 'TreeMap',
    category: 'generator',
    index: '05',
    color: 'var(--treemap-color)',
    glow: 'var(--treemap-glow)',
    glowStrong: 'var(--treemap-glow-strong)',
    colorVar: '--treemap-color',
    description: 'Generate and distribute Props based on Masks.',
    navDescription: 'Distribute props procedurally using painted masks for natural, organic placement across the map.',
    status: 'active',
  },
  {
    id: 'rockerosion',
    label: 'Rock Erosion',
    category: 'generator',
    index: '06',
    color: 'var(--rockerosion-color)',
    glow: 'var(--rockerosion-glow)',
    glowStrong: 'var(--rockerosion-glow-strong)',
    colorVar: '--rockerosion-color',
    description: 'Generate and distribute Props based on Erosion Masks.',
    navDescription: 'Generate and distribute rock props based on erosion masks derived from the heightmap.',
    status: 'active',
  },
  {
    id: 'wavenormals',
    label: 'Wave Normals',
    category: 'textures',
    index: '07',
    color: 'var(--wavenormals-color)',
    glow: 'var(--wavenormals-glow)',
    glowStrong: 'var(--wavenormals-glow-strong)',
    colorVar: '--wavenormals-color',
    description: 'Simulate ocean wave normal maps for water.',
    navDescription: 'Simulate a real sea state with an FFT ocean and bake the four water normal layers FA needs — including the foam mask the stock textures do not have.',
    status: 'active',
  },
  {
    id: 'terraintype',
    label: 'Terrain Type',
    category: 'emitter',
    index: '19',
    color: 'var(--terraintype-color)',
    glow: 'var(--terraintype-glow)',
    glowStrong: 'var(--terraintype-glow-strong)',
    colorVar: '--terraintype-color',
    description: 'Auto-paint terrain types from stratum masks.',
    navDescription: 'Derive the terrainType layer automatically — assign each texture layer a terrain type and let the tool paint every area where that layer is dominant, from the map\'s own stratum masks.',
    status: 'active',
  },
  {
    id: 'stars',
    label: 'Stars',
    category: 'skybox',
    index: '08',
    color: 'var(--stars-color)',
    glow: 'var(--stars-glow)',
    glowStrong: 'var(--stars-glow-strong)',
    colorVar: '--stars-color',
    description: 'Generate a realistic star distribution for skyboxes.',
    navDescription: 'Generate a realistic star distribution across the skybox for night and space environments.',
    status: 'active',
  },
  {
    id: 'skybox-generator',
    label: 'Skybox Generator',
    category: 'skybox',
    index: '09',
    color: 'var(--skybox-generator-color)',
    glow: 'var(--skybox-generator-glow)',
    glowStrong: 'var(--skybox-generator-glow-strong)',
    colorVar: '--skybox-generator-color',
    description: 'Design a full skybox.',
    navDescription: 'Design a complete skybox — gradient, clouds, sun position and atmospheric haze.',
    status: 'active',
  },
  {
    // The id stays `node-editor`: it is the route key and the saved start-tab
    // value in Settings, so renaming it would silently break both. `label` is
    // the user-facing name, which is exactly the split id/label exists for.
    id: 'node-editor',
    label: 'Texture Editor',
    category: 'textures',
    index: '20',
    color: 'var(--node-editor-color)',
    glow: 'var(--node-editor-glow)',
    glowStrong: 'var(--node-editor-glow-strong)',
    colorVar: '--node-editor-color',
    description: 'Compose SupCom textures procedurally from a node graph.',
    navDescription: 'Author SupCom textures from a node graph: build EnvCube, WaterRamp, WaveNormal and other assets out of sources, modifiers, compositors and output nodes, with a live WebGL preview.',
    status: 'active',
  },
  {
    id: 'viewer3d',
    label: '3D Viewer',
    category: 'textures',
    index: '21',
    color: 'var(--viewer3d-color)',
    glow: 'var(--viewer3d-glow)',
    glowStrong: 'var(--viewer3d-glow-strong)',
    colorVar: '--viewer3d-color',
    description: 'Inspect a prop in 3D against a unit for scale.',
    navDescription: 'Load a .scm mesh with its albedo and stand it on an ogrid grid beside a unit from your installation — so scale, proportion and pivot are judged before the map is packed. Waves and sky views share this viewer later.',
    status: 'active',
  },
  {
    id: 'scmaptool',
    label: 'SCMAP Tool',
    category: 'maptools',
    index: '10',
    color: '#FFFA00',
    glow: 'rgba(255,250,0,0.35)',
    glowStrong: 'rgba(255,250,0,0.6)',
    colorVar: '--scmaptool-color',
    description: 'Unpack, edit and repack Supreme Commander .scmap map files.',
    navDescription: 'Unpack, edit and repack Supreme Commander .scmap map files with full asset access.',
    status: 'active',
  },
  {
    id: 'adaptivemaphelper',
    label: 'Adaptive Map Helper',
    category: 'maptools',
    index: '11',
    color: '#ff8c00',
    glow: 'rgba(255,140,0,0.35)',
    glowStrong: 'rgba(255,140,0,0.6)',
    colorVar: '--adaptivemaphelper-color',
    description: 'Intelligently adapt and optimize map configurations for different sizes and formats.',
    navDescription: 'Intelligently adapt and optimise map configurations for different sizes and formats.',
    status: 'active',
  },
  {
    id: 'history',
    label: 'History',
    category: 'system',
    index: '12',
    color: '#FF8AFF',
    glow: 'rgba(255, 138, 255, 0.35)',
    glowStrong: 'rgba(255, 138, 255, 0.6)',
    colorVar: '--history-color',
    description: 'Browse and restore previous generation states.',
    navDescription: 'Browse and restore previous generation states for any tool in the suite.',
    status: 'active',
  },
  {
    id: 'mapresizer',
    label: 'Map Resizer',
    category: 'maptools',
    index: '13',
    color: '#00E5CC',
    glow: 'rgba(0, 229, 204, 0.20)',
    glowStrong: 'rgba(0, 229, 204, 0.45)',
    colorVar: '--mapresizer-color',
    description: 'Resize any FA map to a new grid — heightmap, textures, props, markers and areas scaled proportionally.',
    navDescription: 'Resize any FA map — heightmap, textures, props and markers all scaled proportionally.',
    status: 'active',
  },
  {
    id: 'maprotator',
    label: 'Map Rotator',
    category: 'maptools',
    index: '25',
    color: 'var(--maprotator-color)',
    glow: 'var(--maprotator-glow)',
    glowStrong: 'var(--maprotator-glow-strong)',
    colorVar: '--maprotator-color',
    description: 'Turn a whole map about its centre — terrain, props, decals, markers and areas rotated together.',
    navDescription: 'Turn a finished map about its centre. Quarter turns are lossless — heightmap, texture masks, props with their facing, decals, markers, units and areas all move as one, so the map comes out the same map seen from another side.',
    status: 'active',
  },
  {
    id: 'biomechanger',
    label: 'Biome Changer',
    category: 'maptools',
    index: '22',
    color: 'var(--biomechanger-color)',
    glow: 'var(--biomechanger-glow)',
    glowStrong: 'var(--biomechanger-glow-strong)',
    colorVar: '--biomechanger-color',
    description: 'Rebuild a map\'s whole look from a biome preset.',
    navDescription: 'Try a whole biome on a finished map in one move — layer textures, normals, water, lighting, skybox, minimap and props swapped as one coherent set, so you can judge whether the map wants to be autumn or desert instead of guessing.',
    status: 'active',
  },
  {
    id: 'symmetrychecker',
    label: 'Symmetry Checker',
    category: 'maptools',
    index: '23',
    color: 'var(--symmetrychecker-color)',
    glow: 'var(--symmetrychecker-glow)',
    glowStrong: 'var(--symmetrychecker-glow-strong)',
    colorVar: '--symmetrychecker-color',
    description: 'Verify that a map is exactly mirrored — terrain, props, markers, civilians.',
    navDescription: 'Prove a map is fair instead of assuming it. Every layer is compared against its own reflection — heightmap, terrain types, texture and water masks, props, decals, markers and civilian units — with the deviation located on the map and written out as a report.',
    status: 'active',
  },
  {
    id: 'floatingtrees',
    label: 'Floating Trees',
    category: 'maptools',
    index: '24',
    color: 'var(--floatingtrees-color)',
    glow: 'var(--floatingtrees-glow)',
    glowStrong: 'var(--floatingtrees-glow-strong)',
    colorVar: '--floatingtrees-color',
    description: 'Find props that do not sit on the ground — floating tree groups, buried trunks, stale placements.',
    navDescription: 'The editor snaps a prop to the terrain at one point: its origin. A tree group is a dozen trees on one flat plane, so along a cliff or a ramp the outer trees keep the centre\'s elevation and hang in the air while the uphill ones sink into the hill. This measures the terrain under every individual tree, clusters the offenders into places worth visiting, and names the asset that keeps failing. Works on any prop, not just trees.',
    status: 'active',
  },
  {
    id: 'previewimage',
    label: 'Preview Image',
    category: 'maptools',
    index: '14',
    color: 'var(--previewimage-color)',
    glow: 'var(--previewimage-glow)',
    glowStrong: 'var(--previewimage-glow-strong)',
    colorVar: '--previewimage-color',
    description: 'Generate and export a preview image for your map.',
    navDescription: 'Generate and export a preview image for your map.',
    status: 'active',
  },
  {
    id: 'cliterminal',
    label: 'CLI Terminal',
    category: 'system',
    index: '17',
    color: 'var(--cliterminal-color)',
    glow: 'var(--cliterminal-glow)',
    glowStrong: 'var(--cliterminal-glow-strong)',
    colorVar: '--cliterminal-color',
    description: 'Run map editor CLI commands with live output — render preview, unpack and pack .scmap.',
    navDescription: 'Run map editor CLI commands with live streaming output. Registry keys are set automatically before every render.',
    status: 'active',
  },
  {
    id: 'contributions',
    label: 'Contributions',
    category: 'community',
    index: '15',
    color: 'var(--contributions-color)',
    glow: 'var(--contributions-glow)',
    glowStrong: 'var(--contributions-glow-strong)',
    colorVar: '--contributions-color',
    description: 'Upload and browse community assets — props, skyboxes, emitters, textures.',
    navDescription: 'Upload and browse community assets — props, skyboxes, emitters, textures.',
    status: 'active',
  },
  {
    id: 'settings',
    label: 'Settings',
    category: 'system',
    index: '16',
    color: 'var(--settings-color, #888)',
    glow: 'var(--settings-glow, rgba(136,136,136,0.15))',
    glowStrong: 'var(--settings-glow-strong, rgba(136,136,136,0.3))',
    colorVar: '--settings-color',
    description: 'Configure paths, appearance and defaults.',
    navDescription: 'Configure paths, appearance and defaults.',
    status: 'active',
  },
  {
    id: 'guides',
    label: 'Guides',
    category: 'community',
    index: '18',
    color: '#C86FFF',
    glow: 'rgba(200,111,255,0.25)',
    glowStrong: 'rgba(200,111,255,0.5)',
    colorVar: null,
    description: 'Browse mapping guides — wikis, forum posts and video tutorials.',
    navDescription: 'Browse mapping guides — wikis, forum posts and video tutorials.',
    status: 'coming-soon',
  },
];

export const getTool = (id) => TOOLS.find(t => t.id === id) ?? null;

export const getToolsByCategory = (categoryKey) =>
  TOOLS.filter(t => t.category === categoryKey);

export const getCategory = (categoryKey) =>
  CATEGORIES.find(c => c.key === categoryKey) ?? null;
