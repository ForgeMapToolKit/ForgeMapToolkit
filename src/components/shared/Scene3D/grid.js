/**
 * grid.js — the ground plane, ruled in ogrids.
 *
 * Everything in the viewer is measured in ogrids because that is the unit a
 * blueprint speaks: `SizeX = 0.5` is half an ogrid, and a scaled .scm lands in
 * the same space. The nominal metre readout the UI shows alongside comes from
 * `OGRID_METRES` in Shared/Ocean/faWater.js — it is the map-scale convention
 * (5 km across 256 ogrids), not a physical measurement of anything, and the UI
 * labels it as nominal for that reason.
 *
 * The grid resizes itself to the subject: a fence post gets a fine grid, a
 * factory a coarse one, so the floor stays legible across two orders of
 * magnitude without the user touching a setting.
 */

import * as THREE from 'three';

/** A round 1-2-5 step that puts roughly 12-25 lines across `extent`. */
function niceStep(extent) {
  const raw = extent / 16;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-4))));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

/**
 * Build the floor: minor lines every `step` ogrids, a heavier line every fifth,
 * and the two axes through the origin picked out in the tab accent.
 *
 * @param {number} extent  half-width of the grid in ogrids
 * @param {THREE.Color} accent  the tab colour, for the axis lines
 * @returns {{group: THREE.Group, step: number, dispose: () => void}}
 */
export function createGrid(extent, accent) {
  const step  = niceStep(extent * 2);
  const half  = Math.ceil(extent / step) * step;
  const group = new THREE.Group();

  const minor = [];
  const major = [];
  const axis  = [];

  for (let i = -half; i <= half + 1e-9; i += step) {
    const v = Math.abs(i) < step * 1e-6 ? 0 : i;
    const target = v === 0 ? axis : (Math.round(v / step) % 5 === 0 ? major : minor);
    target.push(-half, 0, v, half, 0, v);
    target.push(v, 0, -half, v, 0, half);
  }

  const line = (verts, color, opacity) => {
    if (!verts.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const obj = new THREE.LineSegments(geo, mat);
    group.add(obj);
    return obj;
  };

  line(minor, 0x8a93a6, 0.13);
  line(major, 0x8a93a6, 0.26);
  line(axis, accent, 0.55);

  return {
    group,
    step,
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}
