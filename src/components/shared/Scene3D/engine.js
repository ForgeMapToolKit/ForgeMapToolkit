/**
 * engine.js — the imperative core of the 3D viewer.
 *
 * Owns a WebGL renderer, a scene with two mesh slots (the subject and an
 * optional size reference), the ogrid floor and the orbit camera. React only
 * mounts it, hands it data and disposes it — same division as the homepage
 * atmosphere engine, and for the same reason: a scene graph driven by refs does
 * not want a reconciler in the middle of it.
 *
 *   const engine = createScene3D(mount, { accent: '#6C63FF' });
 *   engine.setMesh('subject', { positions, normals, uvs, indices, scale, texture });
 *   engine.frame();
 *   engine.dispose();
 *
 * Two things this deliberately does:
 *
 *  - **Renders on demand.** A static prop has nothing to animate, so there is
 *    no permanent rAF loop; a frame is drawn when something changes. On a
 *    laptop that is the difference between a warm fan and a silent one.
 *
 *  - **Leaves the mesh where the file puts it.** The pivot is not recentred on
 *    the origin, because a wrong pivot is one of the defects the viewer exists
 *    to expose. The origin marker shows where (0,0,0) actually is.
 */

import * as THREE from 'three';
import { createOrbit } from './orbit.js';
import { createGrid } from './grid.js';

/** Slot placement — the reference stands beside the subject, never inside it. */
const SLOT_GAP = 0.35;   // as a fraction of the combined width

export function createScene3D(mount, { accent = '#6C63FF' } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;   // no GL context available — the caller renders a fallback
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
  mount.appendChild(renderer.domElement);

  const accentColor = new THREE.Color(accent);
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);

  // Neutral studio light. Not the game's lighting — the tab says so, and the
  // real shader approximation is a later phase.
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x23262e, 1.15));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.85);
  key.position.set(1, 1.6, 0.9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fa7ff, 0.45);
  fill.position.set(-1.2, 0.5, -1);
  scene.add(fill);

  const content = new THREE.Group();
  scene.add(content);

  let grid = null;
  const origin = originMarker(accentColor);
  scene.add(origin);

  const slots = { subject: null, reference: null };
  let wireframe = false;
  let pending = false;
  let disposed = false;

  // Declared before createOrbit: the constructor positions the camera once and
  // calls straight back into requestRender, which would otherwise read `pending`
  // inside its temporal dead zone.
  const orbit = createOrbit(renderer.domElement, camera, requestRender);

  // ── Rendering ─────────────────────────────────────────────────────────────

  function requestRender() {
    if (pending || disposed) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!disposed) renderer.render(scene, camera);
    });
  }

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  // ── Meshes ────────────────────────────────────────────────────────────────

  /**
   * A DDS decodes to top-down rows and three's DataTexture leaves flipY off, so
   * data row 0 lands at t = 0 — which is exactly where FA's D3D-convention UVs
   * expect the top of the image. The .scm reader passes UVs through unflipped
   * to keep that pairing (see electron/modules/mesh.js).
   */
  function makeTexture({ data, width, height }) {
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Guess whether an albedo's alpha is a cutout mask — used only when the
   * caller has no blueprint to read a shader name from.
   *
   * It has to be *both* tests, because FA puts two unrelated things in that
   * channel. A cutout is bimodal: a solid body plus holes. A team-colour mask
   * on a `Unit`-shader prop is uniformly near zero — measured across the
   * vanilla set, Aeon_Bus and friends are 100% below alpha 16 with nothing
   * opaque at all. Cutting on that erases the entire mesh.
   *
   * Even so this is a guess, and an ambiguous one: a dead tree reads 87/7 and
   * a Seraphim car 83/11, which no threshold separates. That is exactly why
   * blueprint-backed assets go by shader name instead.
   */
  function guessAlphaCutout(data) {
    let zero = 0, opaque = 0, n = 0;
    // Every 41st pixel — a prime stride, so a regular pattern in the texture
    // can't alias with the sampling and hide the alpha.
    for (let i = 3; i < data.length; i += 4 * 41) {
      const a = data[i]; n++;
      if (a < 16) zero++; else if (a > 240) opaque++;
    }
    if (!n) return false;
    return zero / n > 0.05 && opaque / n > 0.15;
  }

  function disposeSlot(name) {
    const mesh = slots[name];
    if (!mesh) return;
    content.remove(mesh);
    mesh.geometry.dispose();
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
    slots[name] = null;
  }

  /**
   * @param {'subject'|'reference'} name
   * @param {null | {positions: Float32Array, normals: Float32Array, uvs: Float32Array,
   *                 indices: Uint16Array, scale: number,
   *                 texture: ?{data: Uint8Array, width: number, height: number},
   *                 alphaCutout: ?boolean}} data
   *   `alphaCutout` null means "no blueprint said" — fall back to guessing.
   */
  function setMesh(name, data) {
    disposeSlot(name);
    if (data) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();

      const map = data.texture ? makeTexture(data.texture) : null;
      const cutout = !map ? false
        : (data.alphaCutout ?? guessAlphaCutout(data.texture.data));
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map,
        color: map ? 0xffffff : 0x99a1b0,
        roughness: 0.82,
        metalness: 0.0,
        wireframe,
        // Prop meshes lean on single-sided cards for foliage and detail, which
        // vanish from behind under FrontSide.
        side: THREE.DoubleSide,
        alphaTest: cutout ? 0.4 : 0,
      }));
      mesh.scale.setScalar(data.scale || 1);
      mesh.userData.isReference = name === 'reference';
      content.add(mesh);
      slots[name] = mesh;
    }
    layout();
    rebuildGrid();
    requestRender();
  }

  /** World-space bounding box of one slot, honouring its scale and offset. */
  function slotBox(mesh) {
    return new THREE.Box3().setFromObject(mesh);
  }

  /** Stand the reference beside the subject along X, clear of it. */
  function layout() {
    const { subject, reference } = slots;
    if (!reference) return;
    reference.position.set(0, 0, 0);
    if (!subject) return;

    reference.updateMatrixWorld(true);
    subject.updateMatrixWorld(true);
    const s = slotBox(subject);
    const r = slotBox(reference);
    const gap = (s.max.x - s.min.x + r.max.x - r.min.x) * SLOT_GAP;
    // Put the reference's left edge one gap past the subject's right edge.
    reference.position.x = s.max.x + gap - r.min.x;
    reference.updateMatrixWorld(true);
  }

  /** Size the floor to whatever is currently in the scene. */
  function rebuildGrid() {
    if (grid) { scene.remove(grid.group); grid.dispose(); grid = null; }
    const box = contentBox();
    if (!box) return;
    const extent = Math.max(
      Math.abs(box.min.x), Math.abs(box.max.x),
      Math.abs(box.min.z), Math.abs(box.max.z), 0.5,
    ) * 1.6;
    grid = createGrid(extent, accentColor);
    scene.add(grid.group);
    origin.scale.setScalar(Math.max(grid.step * 0.5, 0.02));
  }

  function contentBox() {
    const meshes = Object.values(slots).filter(Boolean);
    if (!meshes.length) return null;
    const box = new THREE.Box3();
    meshes.forEach(m => box.union(slotBox(m)));
    return box;
  }

  // ── Public surface ────────────────────────────────────────────────────────

  const api = {
    setMesh,
    requestRender,
    resize,

    setWireframe(on) {
      wireframe = !!on;
      Object.values(slots).forEach(m => { if (m) m.material.wireframe = wireframe; });
      requestRender();
    },

    setReferenceVisible(on) {
      if (slots.reference) slots.reference.visible = !!on;
      requestRender();
    },

    /** Fit everything in view. Falls back to a unit sphere on an empty scene. */
    frame() {
      const box = contentBox();
      if (!box) { orbit.frame(new THREE.Vector3(0, 0.5, 0), 1); return; }
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      orbit.frame(sphere.center, sphere.radius);
    },

    /** Measured extent of the subject in ogrids, after UniformScale. */
    subjectSize() {
      if (!slots.subject) return null;
      const b = slotBox(slots.subject);
      return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
    },

    gridStep: () => (grid ? grid.step : null),

    dispose() {
      disposed = true;
      orbit.dispose();
      disposeSlot('subject');
      disposeSlot('reference');
      if (grid) { scene.remove(grid.group); grid.dispose(); }
      origin.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose();
      // Without this the context lingers until GC, and the browser caps how
      // many are alive at once — the atmosphere layer already holds two.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };

  resize();
  api.frame();
  return api;
}

/** A small upright cross at world origin, so the mesh's pivot is readable. */
function originMarker(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0,
    0, 0, -1, 0, 0, 1,
    0, 0, 0, 0, 1.4, 0,
  ], 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false });
  const marker = new THREE.LineSegments(geo, mat);
  marker.renderOrder = 2;
  return marker;
}
