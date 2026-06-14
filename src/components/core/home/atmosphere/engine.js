import * as THREE from 'three';
import { HAZE_VERT, HAZE_FRAG } from './haze.glsl.js';

/**
 * createAtmosphereEngine — the imperative core behind AtmosphereLayer.
 *
 * Owns the WebGL renderer, a single full-bleed quad carrying the haze
 * shader, and the render loop. Kept framework-free so React only has to
 * mount it, feed it state, and dispose it.
 *
 * ─── STAGE 2 (current) ───────────────────────────────────────────────
 * Renders the standby cold haze: a near-static, domain-warped fog pooled
 * in the lower-central gulf, composited additively over the existing
 * backdrop. setState() is wired but inert here — per-atmosphere grading
 * and transitions arrive in Stage 3.
 *
 *   const engine = createAtmosphereEngine(mount, { quality });
 *   engine.setState({ focusedToolId, commitToolId });
 *   engine.setQuality('performant');
 *   engine.dispose();
 */

// Standby grade — a cold neutral blue-grey. This is the rest colour the
// atmosphere lerps away from when a tool is focused (Stage 3).
const STANDBY_COLOR = [0.34, 0.40, 0.52];

// Per-layer additive gain. Back is the broad body behind the title; front
// is the sparse veil drifting in front of it (kept lower so it only suggests
// depth, never obscures the type).
const BACK_INTENSITY  = 0.95;
const FRONT_INTENSITY = 0.55;

// uTime advances in real seconds; the drift/churn speeds are tuned inside
// the shader. Kept slow so the motion reads as a subtle, living haze.
const TIME_SCALE = 1.0;

export function createAtmosphereEngine(mount, { quality = 'fast', layer = 'back' } = {}) {
  const isFront = layer === 'front';
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Fast quality (and reduced motion) → no drift, no continuous loop. The
  // haze renders on demand: once at setup, then on resize / colour change.
  const isStatic = quality === 'fast' || prefersReducedMotion;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: quality === 'performant' ? 'high-performance' : 'low-power',
      premultipliedAlpha: true,
    });
  } catch {
    return null; // no GL — caller runs without atmosphere
  }

  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
  mount.appendChild(renderer.domElement);

  // Fullscreen quad: a 2×2 plane viewed through an ortho camera. Real 3D
  // bounds, so three's computeBoundingSphere is always valid (no NaN) and
  // the quad is never wrongly culled.
  const geometry = new THREE.PlaneGeometry(2, 2);

  // TEMP: flip to true to paint the quad solid red (pipeline probe).
  const DEBUG = false;

  const uniforms = {
    uTime:       { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uColorBase:  { value: new THREE.Vector3(...STANDBY_COLOR) },
    uIntensity:  { value: isFront ? FRONT_INTENSITY : BACK_INTENSITY },
    uFront:      { value: isFront ? 1 : 0 },
    uDebug:      { value: DEBUG ? 1 : 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader:   HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    uniforms,
    transparent: true,
    // Back adds light behind the title; front veils normally over it.
    blending:    isFront ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthTest:   false,
    depthWrite:  false,
  });

  const scene  = new THREE.Scene();
  // Ortho camera framing the 2×2 plane exactly to the viewport.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad   = new THREE.Mesh(geometry, material);
  scene.add(quad);

  let dprCap = quality === 'performant' ? 1.5 : 1;

  const resize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
    if (isStatic) renderer.render(scene, camera); // re-paint the on-demand frame
  };

  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  // ── Render loop ───────────────────────────────────────────────────
  // The grade eases toward this target; setState retargets it (standby
  // neutral, or the focused tool's hue).
  const targetColor = new THREE.Vector3(...STANDBY_COLOR);

  let raf = 0;
  let last = performance.now();
  let running = true;

  const renderFrame = (dt) => {
    if (!isStatic) uniforms.uTime.value += dt * TIME_SCALE;
    // Ease toward the target hue — snap instantly when static.
    uniforms.uColorBase.value.lerp(targetColor, isStatic ? 1 : 1 - Math.exp(-dt * 6));
    renderer.render(scene, camera);
  };

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); // clamp tab-switch spikes
    last = now;
    renderFrame(dt);
    raf = requestAnimationFrame(frame);
  };

  if (isStatic) {
    renderFrame(0); // single frame; no continuous loop
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    // Retarget the grade. `color` is an [r,g,b] (0..1) or null for standby.
    setState({ color } = {}) {
      const c = color || STANDBY_COLOR;
      targetColor.set(c[0], c[1], c[2]);
      if (isStatic) {
        uniforms.uColorBase.value.copy(targetColor);
        renderFrame(0); // re-paint the on-demand frame in the new hue
      }
    },

    setQuality(q) {
      dprCap = q === 'performant' ? 1.5 : 1;
      resize();
    },

    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
