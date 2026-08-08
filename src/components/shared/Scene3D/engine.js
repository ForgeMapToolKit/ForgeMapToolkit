/**
 * engine.js — the imperative core of the 3D viewer.
 *
 * Owns a WebGL renderer, a scene holding any number of named object slots, the
 * world floor and the orbit camera. React only mounts it, hands it data and
 * disposes it — same division as the homepage atmosphere engine, and for the
 * same reason: a scene graph driven by refs does not want a reconciler in the
 * middle of it.
 *
 *   const engine = createScene3D(mount, { onGridStep: s => setStep(s) });
 *   engine.setObject('a', { positions, normals, uvs, indices, scale, texture });
 *   engine.frameAll();
 *   engine.dispose();
 *
 * Four things this deliberately does:
 *
 *  - **Renders on demand.** A static prop has nothing to animate, so there is
 *    no permanent rAF loop; a frame is drawn when something changes. On a
 *    laptop that is the difference between a warm fan and a silent one.
 *
 *  - **Leaves each mesh where its file puts it.** A pivot is not recentred on
 *    the origin, because a wrong pivot is one of the defects the viewer exists
 *    to expose. Every object carries its own origin cross so you can see it.
 *
 *  - **Measures everything against one floor.** The grid is anchored to the
 *    world and scaled by camera distance only (see grid.js) — never to the
 *    object. That is what makes two objects in one scene comparable at all.
 *
 *  - **Shades with an actual matcap, like Blender's Solid/MatCap viewport.**
 *    No scene lights, no PBR roughness/metalness — a mesh's material samples
 *    a procedurally-baked sphere texture by view-space normal (see
 *    `makeStudioMatcap` below), so "lighting follows the view as you orbit"
 *    is inherent to the lookup, not a light rig re-oriented every frame.
 *    Still neutral studio shading, still not the game's shader — the tab
 *    says so.
 */

import * as THREE from 'three';
import { createOrbit } from './orbit.js';
import { createGrid, AXIS_COLORS } from './grid.js';

/** Gap between objects laid out in a row, as a fraction of the widest one. */
const ROW_GAP = 0.22;

/** Edge length of the corner axis gizmo, in CSS pixels. */
const GIZMO_PX = 84;

export function createScene3D(mount, { onGridStep = null } = {}) {
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

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 20000);

  // ── Shading: an actual matcap, like Blender's Solid/MatCap viewport ───────
  // Blender's Solid shading is not PBR — there is no roughness/metalness
  // response, no GGX, no physically-based Fresnel. It is a studio light baked
  // as a small set of spherical-harmonic coefficients (Studio) or, in MatCap
  // mode, a texture indexed directly by the view-space normal. Both read as
  // "shading painted onto a sphere, looked up by which way the surface faces
  // the screen" — which is exactly what a matcap material *is*, and why
  // swapping the PBR material for one is a reproduction, not an approximation
  // biased to taste. Because the lookup is view-space, orbiting the camera
  // reproduces Blender's "lighting rotates with the view" for free — no light
  // rig to re-orient every frame, unlike the previous version of this file.
  const matcap = makeStudioMatcap();

  const content = new THREE.Group();
  scene.add(content);

  const grid = createGrid();
  scene.add(grid.group);

  const { scene: gizmoScene, camera: gizmoCam, group: gizmoGroup, dispose: disposeGizmo } = createAxisGizmo();

  /** id → { group, mesh, ownTexture, overrideTexture } — insertion order is layout order. */
  const slots = new Map();
  let wireframe = false;
  let pending = false;
  let disposed = false;

  // Declared before createOrbit: the constructor positions the camera once and
  // calls straight back into onCameraChange, which would otherwise read
  // `pending` inside its temporal dead zone.
  const orbit = createOrbit(renderer.domElement, camera, onCameraChange);

  // ── Rendering ─────────────────────────────────────────────────────────────

  function onCameraChange() {
    const changed = grid.update(orbit.target, orbit.distance);
    if (changed && onGridStep) onGridStep(grid.step);
    // Origin crosses are sized in grid squares, so a decade change resizes them.
    if (changed) sizeOriginMarkers();
    requestRender();
  }

  function requestRender() {
    if (pending || disposed) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (disposed) return;
      draw();
    });
  }

  function draw() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // Corner gizmo: same orientation as the main camera, drawn into a small
    // scissored viewport on top. Cheap — six primitives and three sprites.
    gizmoGroup.quaternion.copy(camera.quaternion).invert();
    const pad = 12;
    const size = Math.min(GIZMO_PX, w * 0.28, h * 0.28);
    renderer.setScissorTest(true);
    renderer.setViewport(w - size - pad, pad, size, size);
    renderer.setScissor(w - size - pad, pad, size, size);
    renderer.clearDepth();
    renderer.render(gizmoScene, gizmoCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  // ── Textures ──────────────────────────────────────────────────────────────

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

  // ── Object slots ──────────────────────────────────────────────────────────

  function disposeSlot(id) {
    const slot = slots.get(id);
    if (!slot) return;
    content.remove(slot.group);
    slot.mesh.geometry.dispose();
    slot.mesh.material.dispose();
    slot.ownTexture?.dispose();
    slot.overrideTexture?.dispose();
    slot.marker.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    slots.delete(id);
  }

  /**
   * Add, replace or remove one object.
   *
   * @param {string} id  stable across reloads of the same object
   * @param {null | {positions: Float32Array, normals: Float32Array, uvs: Float32Array,
   *                 indices: Uint16Array, scale: number,
   *                 texture: ?{data: Uint8Array, width: number, height: number},
   *                 alphaCutout: ?boolean}} data
   *   `alphaCutout` null means "no blueprint said" — fall back to guessing.
   */
  function setObject(id, data) {
    const wasVisible = slots.get(id)?.group.visible ?? true;
    disposeSlot(id);
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
      const mesh = new THREE.Mesh(geo, new THREE.MeshMatcapMaterial({
        map,
        matcap,
        // Blender's default surface grey, so an untextured mesh reads as
        // "no albedo" rather than as a colour someone chose.
        color: map ? 0xffffff : 0xb4b8bd,
        wireframe,
        // Prop meshes lean on single-sided cards for foliage and detail, which
        // vanish from behind under FrontSide.
        side: THREE.DoubleSide,
        alphaTest: cutout ? 0.4 : 0,
      }));
      mesh.scale.setScalar(data.scale || 1);

      const marker = originMarker();
      const group = new THREE.Group();
      group.visible = wasVisible;
      group.add(mesh, marker);
      content.add(group);
      slots.set(id, { group, mesh, marker, ownTexture: map, overrideTexture: null, alphaCutout: cutout });
    }
    layout();
    sizeOriginMarkers();
    requestRender();
  }

  /**
   * Swap in a texture computed elsewhere — the Shading workspace's node graph
   * output. Passing null puts the asset's own albedo back, so "reset" costs
   * nothing and never needs a reload.
   */
  function setObjectTexture(id, texture) {
    const slot = slots.get(id);
    if (!slot) return;
    slot.overrideTexture?.dispose();
    slot.overrideTexture = texture ? makeTexture(texture) : null;
    const map = slot.overrideTexture || slot.ownTexture;
    slot.mesh.material.map = map;
    slot.mesh.material.color.setHex(map ? 0xffffff : 0xb4b8bd);
    slot.mesh.material.needsUpdate = true;
    requestRender();
  }

  /** World-space bounding box of one object, honouring its scale and offset. */
  function slotBox(slot) {
    return new THREE.Box3().setFromObject(slot.mesh);
  }

  /**
   * Stand the objects in a row along X, in insertion order.
   *
   * The first one keeps world position zero so its pivot stays where the file
   * put it — the origin cross under it is then a real reading. The rest are
   * offset only along X, so their height and depth relative to the floor stay
   * honest too, and each still shows its own pivot within its own group.
   */
  function layout() {
    const list = [...slots.values()].filter(s => s.group.visible);
    if (!list.length) return;

    list.forEach(s => s.group.position.set(0, 0, 0));
    list.forEach(s => s.group.updateMatrixWorld(true));

    const boxes = list.map(slotBox);
    const widest = Math.max(...boxes.map(b => b.max.x - b.min.x), 1e-4);
    const gap = widest * ROW_GAP;

    let cursor = boxes[0].max.x + gap;
    for (let i = 1; i < list.length; i++) {
      list[i].group.position.x = cursor - boxes[i].min.x;
      list[i].group.updateMatrixWorld(true);
      cursor += (boxes[i].max.x - boxes[i].min.x) + gap;
    }
    // Hidden objects sit at zero and are skipped by the row; nothing to place.
  }

  /** Origin crosses are measured in grid squares — one square across. */
  function sizeOriginMarkers() {
    const s = Math.max(grid.step * 0.5, 1e-4);
    slots.forEach(slot => slot.marker.scale.setScalar(s));
  }

  function contentBox() {
    const list = [...slots.values()].filter(s => s.group.visible);
    if (!list.length) return null;
    const box = new THREE.Box3();
    list.forEach(s => box.union(slotBox(s)));
    return box;
  }

  // ── Public surface ────────────────────────────────────────────────────────

  const api = {
    setObject,
    setObjectTexture,
    requestRender,
    resize,

    setObjectVisible(id, on) {
      const slot = slots.get(id);
      if (!slot) return;
      slot.group.visible = !!on;
      layout();
      requestRender();
    },

    clearObjects() {
      [...slots.keys()].forEach(disposeSlot);
      requestRender();
    },

    setWireframe(on) {
      wireframe = !!on;
      slots.forEach(s => { s.mesh.material.wireframe = wireframe; });
      requestRender();
    },

    /**
     * Fit the scene — or one object — in view, keeping the current viewing
     * angle. `reset` asks for the home angle as well.
     */
    frame(id = null, { reset = false } = {}) {
      const slot = id ? slots.get(id) : null;
      const box = slot ? slotBox(slot) : contentBox();
      if (!box || box.isEmpty()) { orbit.frame(new THREE.Vector3(0, 0.5, 0), 1, { reset }); return; }
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      orbit.frame(sphere.center, sphere.radius, { reset });
    },

    /** Measured extent of one object in ogrids, after UniformScale. */
    objectSize(id) {
      const slot = slots.get(id);
      if (!slot) return null;
      const b = slotBox(slot);
      return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
    },

    gridStep: () => grid.step,

    dispose() {
      disposed = true;
      orbit.dispose();
      [...slots.keys()].forEach(disposeSlot);
      scene.remove(grid.group);
      grid.dispose();
      disposeGizmo();
      matcap.dispose();
      renderer.dispose();
      // Without this the context lingers until GC, and the browser caps how
      // many are alive at once — the atmosphere layer already holds two.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };

  resize();
  api.frame(null, { reset: true });
  return api;
}

/**
 * Blender's default Solid-mode studio light, authored the way a real matcap
 * is: shade a hypothetical sphere once, per pixel, and look the result up by
 * view-space normal at render time — no scene lights, no roughness/metalness
 * response, because Blender's Solid shading has neither. `MeshMatcapMaterial`
 * multiplies this by the mesh's own colour/map, so the albedo still reads.
 *
 * The lighting itself is a soft key from the upper-left (matching Blender's
 * default studio rig), a cool fill from the opposite side, a broad — not
 * sharp — specular, and a gentle darkening toward the silhouette standing in
 * for the ambient-occlusion falloff Blender's baked studio light carries.
 * Half-lambert (`ndotl*0.5+0.5`) rather than a plain clamp, so the shadow
 * side is dim, never black — the whole point of Solid shading is that
 * nothing goes unreadable.
 */
function makeStudioMatcap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);

  const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const key  = norm([-0.55, 0.55, 0.62]);
  const fill = norm([0.65, -0.1, 0.4]);
  const eye  = [0, 0, 1];

  for (let py = 0; py < size; py++) {
    const v = 1 - (py + 0.5) / size * 2;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size * 2 - 1;
      const r2 = u * u + v * v;
      const i = (py * size + px) * 4;
      if (r2 > 1) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = 0; continue; }

      const z = Math.sqrt(1 - r2);
      const n = [u, v, z];

      const wrapKey  = Math.max(0, dot(n, key) * 0.5 + 0.5);
      const wrapFill = Math.max(0, dot(n, fill) * 0.5 + 0.5);
      // Reflect the fixed eye vector about n — R = 2*(n·eye)*n - eye — for a
      // broad, soft specular lobe (small power) instead of Blinn-Phong's
      // usual tight highlight, matching Solid shading's non-glossy look.
      const nDotEye = dot(n, eye);
      const r = [2 * nDotEye * n[0] - eye[0], 2 * nDotEye * n[1] - eye[1], 2 * nDotEye * n[2] - eye[2]];
      const spec = Math.pow(Math.max(0, dot(r, key)), 5) * 0.35;

      // Silhouette falloff: a soft multiply toward the rim reads as roundness
      // without a hard rim-light — Blender's studio setup barely has one.
      const rim = 0.82 + 0.18 * z;

      const base = 0.30;
      const rCh = (base + wrapKey * 0.62 + wrapFill * 0.10 + spec) * rim;
      const gCh = (base + wrapKey * 0.60 + wrapFill * 0.12 + spec) * rim;
      const bCh = (base + wrapKey * 0.56 + wrapFill * 0.16 + spec * 1.05) * rim;

      img.data[i]     = Math.round(Math.min(1, rCh) * 255);
      img.data[i + 1] = Math.round(Math.min(1, gCh) * 255);
      img.data[i + 2] = Math.round(Math.min(1, bCh) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * A small three-armed cross at an object's own origin, in the axis colours, so
 * the pivot is both locatable and orientable. Unit-sized; the engine scales it
 * to one grid square.
 */
function originMarker() {
  const group = new THREE.Group();
  group.renderOrder = 2;
  const arm = (a, b, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b], 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false });
    return new THREE.LineSegments(geo, mat);
  };
  group.add(
    arm([-1, 0, 0], [1, 0, 0], AXIS_COLORS.x),
    arm([0, 0, 0], [0, 1.4, 0], AXIS_COLORS.y),
    arm([0, 0, -1], [0, 0, 1], AXIS_COLORS.z),
  );
  return group;
}

/** A letter on a transparent disc, for the gizmo's positive-axis balls. */
function letterSprite(letter, hex) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const css = '#' + hex.toString(16).padStart(6, '0');
  g.fillStyle = css;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0b0d11';
  g.font = `bold ${size * 0.58}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, size / 2, size / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.setScalar(0.62);
  return sprite;
}

/**
 * Blender's corner navigation gizmo, read-only: three axes in the shared
 * colours with a labelled ball on each positive end.
 *
 * It lives in its own scene under an orthographic camera and is drawn into a
 * scissored corner of the same canvas, so it costs one extra draw call and no
 * second GL context.
 */
function createAxisGizmo() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.9, 1.9, 1.9, -1.9, 0.1, 20);
  camera.position.set(0, 0, 6);

  const group = new THREE.Group();
  scene.add(group);

  const disposables = [];
  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), color: AXIS_COLORS.x, letter: 'X' },
    { dir: new THREE.Vector3(0, 1, 0), color: AXIS_COLORS.y, letter: 'Y' },
    { dir: new THREE.Vector3(0, 0, 1), color: AXIS_COLORS.z, letter: 'Z' },
  ];

  for (const { dir, color, letter } of axes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -dir.x, -dir.y, -dir.z, dir.x, dir.y, dir.z,
    ], 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75, depthTest: false });
    const line = new THREE.LineSegments(geo, mat);
    group.add(line);
    disposables.push(geo, mat);

    const label = letterSprite(letter, color);
    label.position.copy(dir);
    group.add(label);
    disposables.push(label.material.map, label.material);
  }

  return {
    scene,
    camera,
    group,
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
