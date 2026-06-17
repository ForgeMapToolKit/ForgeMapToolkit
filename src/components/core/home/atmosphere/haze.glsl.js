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
    float x = clamp(uv.x, 0.0, 1.0);
    float centerY = mix(0.42, 0.56, x) - uFront * 0.02;
    float halfH   = mix(0.30, 0.42, x) * (1.0 - uFront * 0.25);
    float band = 1.0 - smoothstep(halfH * 0.10, halfH * 1.3, abs(uv.y - centerY));

    float rightCut = mix(1.0, 0.80, uFront);
    float hEnv = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(rightCut, rightCut + 0.32, x));
    // Gentle leftward bias: full density at the left, easing to ~55% at the
    // right so the focus leans left while the haze stays present across.
    float hFocus = mix(1.0, 0.55, smoothstep(0.0, 0.9, x));
    float mask = band * hEnv * hFocus;

    float density = fog * mask * uIntensity;

    // Hue from the atmosphere grade, with faint internal luminance variation.
    vec3 col = uColorBase * (0.80 + 0.40 * fogRaw);

    // Premultiplied output. Back material blends additively (adds light);
    // front material blends normally (a faint veil that occludes the title).
    gl_FragColor = vec4(col * density, density);
  }
`;
