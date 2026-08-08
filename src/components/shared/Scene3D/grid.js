/**
 * grid.js — the floor, drawn the way Blender draws one.
 *
 * The unit is the ogrid, because that is the unit a blueprint speaks: `SizeX =
 * 0.5` is half an ogrid, and a scaled .scm lands in the same space. The nominal
 * metre readout the UI shows alongside comes from `OGRID_METRES` in
 * Shared/Ocean/faWater.js — a map-scale convention (5 km across 256 ogrids), not
 * a physical measurement, and the UI labels it as nominal for that reason.
 *
 * ## Why this is not sized to the object any more
 *
 * The previous floor rebuilt itself around whatever was in the scene: a fence
 * post got a fine grid, a factory a coarse one. That reads well in isolation and
 * is actively misleading side by side — a Commander next to a Factory looked the
 * same size, because the only cue for absolute scale (the squares underneath)
 * silently shrank to match. A ruler that resizes itself is not a ruler.
 *
 * So the grid is now anchored to the **world**, exactly like Blender's:
 *
 *  - The step is a power of ten of an ogrid and depends only on how far the
 *    camera is, never on what is in the scene. Two objects in one scene are
 *    therefore always measured against the same squares.
 *  - Two decades are drawn at once and cross-faded, so zooming in reveals the
 *    finer level instead of snapping to it.
 *  - Each level snaps to its own multiples around the camera target and fades
 *    out radially, which is what makes it read as an infinite plane rather than
 *    a square rug.
 *
 * One unit-step geometry is built once and shared by both levels — a level is
 * just that geometry scaled by its step, so changing zoom costs a scale and two
 * uniforms, not a rebuild.
 */

import * as THREE from 'three';

/**
 * The three dimensions, coloured — X red, Y green, Z blue, the convention
 * Blender, three's own AxesHelper and every DCC tool share. Exported because
 * the axis lines, the per-object origin crosses, the corner gizmo and the size
 * readout in the UI must all agree on them; a fourth opinion would defeat the
 * point of colouring them at all.
 *
 * FA's Y is up (Blender's Z is), so the letters land on different world
 * directions than they would in Blender — the colours stay bound to the letters,
 * which is what the readout shows.
 */
export const AXIS_COLORS = { x: 0xf04a5c, y: 0x88d92c, z: 0x2f83f5 };

/** Half-width of the shared unit grid, in steps. Sets how far a level reaches. */
const HALF_LINES = 64;

/**
 * Distance fade, as a multiple of the camera's distance to its target. The grid
 * is opaque near what you are looking at and gone well before its own edge, so
 * the edge is never visible.
 */
const FADE_START = 0.9;
const FADE_END   = 2.6;

const FADE_VERT = `
uniform vec2 uCenter;
uniform float uFadeStart;
uniform float uFadeEnd;
varying float vFade;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float d = distance(world.xz, uCenter);
  vFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FADE_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  float a = uOpacity * vFade;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

function fadeMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    vertexShader: FADE_VERT,
    fragmentShader: FADE_FRAG,
    uniforms: {
      uCenter:    { value: new THREE.Vector2(0, 0) },
      uFadeStart: { value: 1 },
      uFadeEnd:   { value: 3 },
      uColor:     { value: new THREE.Color(color) },
      uOpacity:   { value: opacity },
    },
    transparent: true,
    depthWrite: false,
  });
}

/** A grid of unit-spaced lines on the XZ plane, `HALF_LINES` steps out. */
function unitGridGeometry() {
  const verts = [];
  const h = HALF_LINES;
  for (let i = -h; i <= h; i++) {
    verts.push(-h, 0, i, h, 0, i);
    verts.push(i, 0, -h, i, 0, h);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

/** A single segment along one axis, from -1 to +1, to be scaled into a long line. */
function axisGeometry(axis) {
  const a = axis === 'x' ? [-1, 0, 0, 1, 0, 0] : [0, 0, -1, 0, 0, 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  return geo;
}

/**
 * Build the floor.
 *
 * Nothing here depends on the scene's contents — call `update()` whenever the
 * camera moves and the grid re-derives itself from the camera alone.
 *
 * @returns {{group: THREE.Group, step: number, update: (target: THREE.Vector3, distance: number) => boolean, dispose: () => void}}
 *   `update` returns true when the effective (finer) step changed, so the caller
 *   can re-label the readout without polling.
 */
export function createGrid() {
  const group = new THREE.Group();
  group.renderOrder = -1;   // under the meshes, and under their origin crosses

  const geo = unitGridGeometry();

  // Two decades, cross-faded. `fine` is the smaller step and fades out as the
  // camera pulls back; `coarse` carries the picture on its own from there.
  //
  // Opacities are well above what the flat maths would suggest is "enough" —
  // a 0.3-alpha line over a near-black viewport background measured as
  // indistinguishable from nothing in practice (verified by direct pixel
  // inspection), which read as "the grid doesn't render". These are tuned to
  // actually be visible, not just non-zero.
  const fine   = new THREE.LineSegments(geo, fadeMaterial(0x8a93a6, 0.40));
  const coarse = new THREE.LineSegments(geo, fadeMaterial(0x8a93a6, 0.65));
  group.add(fine, coarse);

  const axisX = new THREE.LineSegments(axisGeometry('x'), fadeMaterial(AXIS_COLORS.x, 0.85));
  const axisZ = new THREE.LineSegments(axisGeometry('z'), fadeMaterial(AXIS_COLORS.z, 0.85));
  group.add(axisX, axisZ);

  const levels = [fine, coarse, axisX, axisZ];
  let step = 1;

  function update(target, distance) {
    const d = Math.max(distance, 1e-4);

    // Which decade the camera is in. The -1 puts roughly ten to a hundred fine
    // squares across the view, which is where a grid stops being noise and
    // starts being readable.
    const level = Math.log10(d) - 1;
    const decade = Math.floor(level);
    const t = level - decade;                    // 0…1 through this decade

    const fineStep   = Math.pow(10, decade);
    const coarseStep = fineStep * 10;
    const changed = fineStep !== step;
    step = fineStep;

    // The fine level is at full strength at the start of a decade and gone by
    // its end, where the coarse level has become the new fine one.
    fine.material.uniforms.uOpacity.value = 0.40 * (1 - t);
    coarse.material.uniforms.uOpacity.value = 0.65;

    fine.scale.setScalar(fineStep);
    coarse.scale.setScalar(coarseStep);

    // Snap each level to its own multiples so lines never crawl while panning,
    // and keep it centred on what the camera is looking at.
    fine.position.set(Math.round(target.x / fineStep) * fineStep, 0, Math.round(target.z / fineStep) * fineStep);
    coarse.position.set(Math.round(target.x / coarseStep) * coarseStep, 0, Math.round(target.z / coarseStep) * coarseStep);

    // The axes stay ON their axis — only their reach follows the camera, so
    // world X=0 and Z=0 remain readable however far you pan.
    const reach = d * FADE_END * 1.2;
    axisX.scale.set(reach, 1, 1);
    axisX.position.set(target.x, 0, 0);
    axisZ.scale.set(1, 1, reach);
    axisZ.position.set(0, 0, target.z);

    for (const obj of levels) {
      const u = obj.material.uniforms;
      u.uCenter.value.set(target.x, target.z);
      u.uFadeStart.value = d * FADE_START;
      u.uFadeEnd.value = d * FADE_END;
    }

    return changed;
  }

  return {
    group,
    get step() { return step; },
    update,
    dispose() {
      geo.dispose();
      axisX.geometry.dispose();
      axisZ.geometry.dispose();
      levels.forEach(o => o.material.dispose());
    },
  };
}
