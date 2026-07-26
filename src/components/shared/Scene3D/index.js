/**
 * Scene3D — the shared 3D visualisation layer.
 *
 * Phase 1 serves the Viewer3D tab's prop preview. The wave and sky views
 * planned on top of it use the same engine with different content, which is
 * why this sits in Shared/ rather than inside the tab.
 */

export { default as Scene3D } from './Scene3D.jsx';
export { createScene3D } from './engine.js';
export { createGrid } from './grid.js';
export { createOrbit } from './orbit.js';
