/**
 * orbit.js — pointer-driven orbit camera, hand-rolled.
 *
 * three ships OrbitControls under `three/examples/jsm/`, but pulling an addon
 * in adds a second module path to the Vite bundle and therefore a second set of
 * CSP hashes to keep in step with `utils/generate-csp-hashes.js`. What we need
 * is eighty lines of spherical arithmetic, so it lives here instead.
 *
 * The camera is described in spherical coordinates around a target point:
 * azimuth (around Y), elevation (from the horizon), distance. Y is up, matching
 * both three and the .scm coordinate system.
 *
 *   const orbit = createOrbit(canvas, camera, () => engine.requestRender());
 *   orbit.frame(center, radius);   // fit an object
 *   orbit.dispose();
 */

import * as THREE from 'three';

// Stop just short of the poles: at exactly ±90° the up vector and the view
// direction are parallel and the camera's roll becomes undefined, which reads
// as a sudden spin.
const MAX_ELEVATION = Math.PI / 2 - 0.01;
const MIN_ELEVATION = -MAX_ELEVATION;

const ORBIT_SPEED = 0.008;   // radians per pixel
const PAN_SPEED   = 0.0016;  // fraction of distance per pixel
const ZOOM_STEP   = 0.0011;  // per wheel unit

export function createOrbit(element, camera, onChange) {
  const target = new THREE.Vector3(0, 0, 0);
  let azimuth   = Math.PI * 0.25;
  let elevation = Math.PI * 0.18;
  let distance  = 10;
  let minDistance = 0.05;
  let maxDistance = 500;

  let dragging = null;      // 'orbit' | 'pan' | null
  let lastX = 0, lastY = 0;

  function apply() {
    const cosE = Math.cos(elevation);
    camera.position.set(
      target.x + distance * cosE * Math.sin(azimuth),
      target.y + distance * Math.sin(elevation),
      target.z + distance * cosE * Math.cos(azimuth),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    onChange();
  }

  // Pan moves the target across the camera's own screen plane, so dragging
  // right always moves the scene right regardless of where we orbited to.
  const right = new THREE.Vector3();
  const up    = new THREE.Vector3();
  function pan(dx, dy) {
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    const k = distance * PAN_SPEED;
    target.addScaledVector(right, -dx * k);
    target.addScaledVector(up, dy * k);
  }

  function onPointerDown(e) {
    if (e.button === 2) return;                       // right-click stays free
    dragging = (e.button === 1 || e.shiftKey) ? 'pan' : 'orbit';
    lastX = e.clientX; lastY = e.clientY;
    element.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    if (dragging === 'pan') {
      pan(dx, dy);
    } else {
      azimuth  -= dx * ORBIT_SPEED;
      elevation = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, elevation + dy * ORBIT_SPEED));
    }
    apply();
  }

  function onPointerUp(e) {
    dragging = null;
    try { element.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  // Exponential so a wheel click covers the same *proportion* of the distance
  // whether you are inspecting a fence post or a factory.
  function onWheel(e) {
    e.preventDefault();
    distance = Math.min(maxDistance, Math.max(minDistance, distance * Math.exp(e.deltaY * ZOOM_STEP)));
    apply();
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerUp);
  element.addEventListener('wheel', onWheel, { passive: false });

  apply();

  return {
    /** Fit a sphere in view and re-derive sensible zoom limits from its size. */
    frame(center, radius) {
      const r = Math.max(radius, 0.01);
      target.copy(center);
      distance    = r * 3.2;
      minDistance = r * 0.15;
      maxDistance = r * 60;
      azimuth     = Math.PI * 0.25;
      elevation   = Math.PI * 0.18;
      apply();
    },
    get distance() { return distance; },
    dispose() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
    },
  };
}
