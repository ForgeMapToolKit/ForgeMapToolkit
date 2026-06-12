/**
 * toolRegistry — single source of truth for all tool metadata.
 *
 * Consumed by:
 *  - HomeScreen (ToolRail / ToolSlat / ProjectionStage)
 *  - ForgeMapToolkit.jsx (mega navbar config, header accent resolution)
 *
 * Adding a new tool:
 *  1. Add its accent variables to root.css (--<id>-color / -glow / -glow-strong)
 *  2. Add one entry to TOOLS below — home screen and navbar pick it up automatically
 *  3. Register its component + route in ForgeMapToolkit.jsx
 *
 * Field reference:
 *  - color/glow/glowStrong: CSS color strings used for accent injection
 *  - colorVar:              bare custom-property name used by the mega navbar
 *  - description:           short copy (home screen)
 *  - navDescription:        long copy (mega navbar description panel)
 *  - index:                 two-digit designation for the future TRACE rail
 *  - status:                'active' | 'coming-soon'
 */

export const CATEGORIES = [
  { key: 'emitter',   homeLabel: 'Emitter Tools', navLabel: 'Emitter',   navDefaultDesc: 'Place and configure particle emitters on the map with full control over type, frequency and output.' },
  { key: 'generator', homeLabel: 'Generators',    navLabel: 'Generator', navDefaultDesc: 'Generate and distribute props, trees and terrain features procedurally using masks and erosion maps.' },
  { key: 'skybox',    homeLabel: 'Skybox',        navLabel: 'Skybox',    navDefaultDesc: 'Design realistic star distributions and full skyboxes for immersive map atmospheres.' },
  { key: 'tools',     homeLabel: 'Tools',         navLabel: 'Tools',     navDefaultDesc: 'Unpack, edit and analyse map files — resize, adapt and preview your maps.' },
  { key: 'community', homeLabel: 'Community' },
  { key: 'config',    homeLabel: 'Configuration' },
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
    id: 'stars',
    label: 'Stars',
    category: 'skybox',
    index: '07',
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
    index: '08',
    color: 'var(--skybox-generator-color)',
    glow: 'var(--skybox-generator-glow)',
    glowStrong: 'var(--skybox-generator-glow-strong)',
    colorVar: '--skybox-generator-color',
    description: 'Design a full skybox.',
    navDescription: 'Design a complete skybox — gradient, clouds, sun position and atmospheric haze.',
    status: 'active',
  },
  {
    id: 'scmaptool',
    label: 'SCMAP Tool',
    category: 'tools',
    index: '09',
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
    category: 'tools',
    index: '10',
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
    category: 'tools',
    index: '11',
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
    category: 'tools',
    index: '12',
    color: '#00E5CC',
    glow: 'rgba(0, 229, 204, 0.20)',
    glowStrong: 'rgba(0, 229, 204, 0.45)',
    colorVar: '--mapresizer-color',
    description: 'Resize any FA map to a new grid — heightmap, textures, props, markers and areas scaled proportionally.',
    navDescription: 'Resize any FA map — heightmap, textures, props and markers all scaled proportionally.',
    status: 'active',
  },
  {
    id: 'previewimage',
    label: 'Preview Image',
    category: 'tools',
    index: '13',
    color: 'var(--previewimage-color)',
    glow: 'var(--previewimage-glow)',
    glowStrong: 'var(--previewimage-glow-strong)',
    colorVar: '--previewimage-color',
    description: 'Generate and export a preview image for your map.',
    navDescription: 'Generate and export a preview image for your map.',
    status: 'active',
  },
  {
    id: 'contributions',
    label: 'Contributions',
    category: 'community',
    index: '14',
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
    category: 'config',
    index: '15',
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
    index: '16',
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
