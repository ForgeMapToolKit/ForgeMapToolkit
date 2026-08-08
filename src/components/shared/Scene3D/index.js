/**
 * Scene3D — the shared 3D visualisation layer.
 *
 * Serves the Viewer3D tab's Layout and Shading workspaces. It sits in Shared/
 * rather than inside the tab because it is a general object viewer — any tab
 * that needs to show geometry against a measured floor can mount it.
 *
 * `AXIS_COLORS` is exported because the readout, the legend and anything else
 * naming X / Y / Z must use the same red / green / blue the scene draws.
 */

export { default as Scene3D } from './Scene3D.jsx';
export { createScene3D } from './engine.js';
export { createGrid, AXIS_COLORS } from './grid.js';
export { createOrbit } from './orbit.js';
