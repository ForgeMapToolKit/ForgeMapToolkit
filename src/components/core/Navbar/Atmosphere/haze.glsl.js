/**
 * haze.glsl — the volumetric backdrop shader.
 *
 * A single full-bleed quad (PlaneGeometry 2×2 viewed through an ortho
 * camera). The fragment stage builds a low-frequency, domain-warped fbm
 * "fog" in screen space, grades it to the atmosphere's colour, and masks
 * it so it pools in the lower-central GULF of the stage (the deliberate
 * dark span between the projection wall and the rail) and fades toward the
 * upper field where the monumental type lives — the volume must never
 * compete with the designation.
 *
 * Composited ADDITIVELY over the existing #070708 + dot-grid backdrop, so
 * it only ever adds faint light and never occludes the instrument surface.
 *
 * Motion is deliberately near-static (uTime advanced very slowly by the
 * engine) to honour the home screen's "no idle motion except the cursor"
 * restraint contract — at standby this reads as a still, cold haze that
 * breathes rather than drifts.
 *
 * Built as a three ShaderMaterial, so position/uv/projectionMatrix/
 * modelViewMatrix attributes & uniforms and the float precision are
 * injected by three — we only declare our own varyings and uniforms.
 *
 * Uniforms the engine drives:
 *  uTime        slow clock (seconds * small factor)
 *  uResolution  canvas px size (for aspect-correct noise)
 *  uColorBase   cold neutral grade at rest; lerped per atmosphere (Stage 3)
 *  uIntensity   overall additive gain; also the master fade
 */

export const HAZE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;                                   // 0..1 across the plane
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const HAZE_FRAG = /* glsl */ `
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec3  uColorBase;
  uniform float uIntensity;
  uniform float uFront;       // 0 = back body (additive), 1 = front veil (normal)
  uniform float uDebug;       // TEMP: >0.5 paints solid red to prove the pipeline
  uniform float uRightBias;   // 0 = home's left-leaning focus (default, unchanged);
                               // 1 = focus fully mirrored to the right. Navbar-only knob.
  uniform float uDiagShift;   // 0 = flat band (home default, unaffected);
                               // >0 = centerY rises linearly from left to right,
                               // so the haze body follows a diagonal arc.
                               // At 1.0 the right edge lifts ~0.55 UV units. Navbar-only.

  // ── value noise + fbm ────────────────────────────────────────────
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);          // smootherstep
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {                // 3 octaves — cheap, low-freq
      v += amp * vnoise(p);
      p = p * 2.02 + 7.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    // TEMP debug: prove the quad reaches the framebuffer at all.
    if (uDebug > 0.5) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      return;
    }

    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    // ── Subtle motion: a slow up-right waft plus internal churn. The front
    // veil drifts a touch more than the back body, so the layers shear
    // against each other — motion parallax reads as depth.
    float t = uTime;
    vec2  flow = vec2(0.021, 0.011) * t * (1.0 + uFront * 0.6);
    vec2  pf   = p + flow;

    // ── Two-scale domain-warped fbm → a soft body with internal depth ─
    // A large, slow base (the mass of the mist) carries a finer detail
    // layer (its structure). Combined, they read as volume, not a blob.
    vec2  q       = vec2(fbm(pf * 0.9 + 1.3 + 0.07 * t), fbm(pf * 0.9 + 6.7 - 0.055 * t));
    float baseFog = fbm(pf * 0.9 + 1.10 * q);
    vec2  r       = vec2(fbm(pf * 2.1 + 3.1 * q), fbm(pf * 2.1 + 8.2 * q));
    float detail  = fbm(pf * 2.1 + 1.60 * r);
    float fogRaw  = mix(baseFog, detail, 0.45);

    // Back = broad soft body; front = only the densest tips, so it reads
    // as sparse wisps drifting across the title rather than a sheet.
    float fogBack  = smoothstep(0.06, 0.90, fogRaw);
    float fogFront = smoothstep(0.46, 0.95, fogRaw);
    float fog = mix(fogBack, fogFront, uFront);

    // ── Band mask centred on the hero title, climbing gently rightward.
    // Starts at the far left and reaches up around the title so the hero
    // sits INSIDE the haze; the front veil pulls a little tighter.
    //
    // uRightBias mirrors the x coordinate used by the mask (xb): at 0 (home
    // default) xb === x, identical to the original left-leaning mask. At 1
    // xb is fully flipped (1.0 - x), so the whole envelope + focus body
    // relocates to the right edge instead of just nudging density — the
    // previous version only varied hFocus by ±0.45, which barely read at
    // all once band/hEnv (unaffected by bias) still pinned the visible
    // shape to the left. Mirroring the coordinate moves the actual shape.
    float x  = clamp(uv.x, 0.0, 1.0);
    float xb = mix(x, 1.0 - x, clamp(uRightBias, 0.0, 1.0));

    // ── Diagonal shear (Navbar-only, uDiagShift=0 on home screen) ─────
    // Instead of adjusting centerY (which fights against hEnv/biasCutEdge),
    // we shear the Y coordinate itself: subtract a left→right ramp from
    // uv.y so that ALL mask calculations see a diagonally-shifted space.
    // At x=0 (left): shearY = uv.y − uDiagShift  → band sits low / off-screen
    // At x=1 (right): shearY = uv.y + 0           → band stays at its normal UV
    // At uDiagShift=0: shearY = uv.y exactly, home screen completely unaffected.
    // Shear: at x=0 (left) shearY is shifted down by uDiagShift,
    // so the band mask sees that pixel as being higher → haze appears lower.
    // at x=1 (right) shearY = uv.y, no shift — haze stays at centerY.
    float shearY = uv.y + uDiagShift * (1.0 - x) - uDiagShift;

    // In diagonal mode, pull centerY downward so the right-side anchor
    // sits in the lower half of the panel rather than near the top.
    // At uDiagShift=0 this is 0, home screen unaffected.
    float centerBase = mix(0.42, 0.56, xb) - uFront * 0.02;
    float centerY = centerBase - uDiagShift * 0.75;
    // In navbar/diagonal mode, expand halfH so the haze spreads into a
    // volumetric cloud rather than a tight band. At uDiagShift=0 (home)
    // this is exactly the original expression.
    float halfHBase = mix(0.30, 0.42, xb) * (1.0 - uFront * 0.25);
    float halfH     = mix(halfHBase, halfHBase * 2.0, clamp(uDiagShift, 0.0, 1.0));
    float band = 1.0 - smoothstep(halfH * 0.10, halfH * 1.3, abs(shearY - centerY));

    float rightCut = mix(1.0, 0.80, uFront);
    float hEnv = smoothstep(0.0, 0.12, xb) * (1.0 - smoothstep(rightCut, rightCut + 0.32, xb));

    float biasCutEdge = mix(1.32, 0.55, clamp(uRightBias, 0.0, 1.0));
    hEnv *= 1.0 - smoothstep(biasCutEdge, biasCutEdge + 0.32, xb);

    float hFocus = mix(1.0, 0.55, smoothstep(0.0, 0.9, xb));
    float mask = band * hEnv * hFocus;

    // In diagonal/navbar mode, boost overall density so the haze reads
    // clearly against the dark panel. At uDiagShift=0 boost=1.0 (home
    // screen completely unaffected).
    float navbarBoost = mix(1.0, 1.5, clamp(uDiagShift, 0.0, 1.0));
    float density = fog * mask * uIntensity * navbarBoost;

    // Hue from the atmosphere grade, with faint internal luminance variation.
    vec3 col = uColorBase * (0.80 + 0.40 * fogRaw);

    // Premultiplied output. Back material blends additively (adds light);
    // front material blends normally (a faint veil that occludes the title).
    gl_FragColor = vec4(col * density, density);
  }
`;
