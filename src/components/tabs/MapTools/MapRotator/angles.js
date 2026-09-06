/**
 * Angle helpers shared by the Map Rotator's sections.
 *
 * Positive angles are clockwise as seen on the minimap, which is the same
 * convention electron/modules/map-rotator.js uses.
 */

export const QUARTER_TURNS = [
  { value: 90,  label: '90°',  desc: 'Quarter · CW'  },
  { value: 180, label: '180°', desc: 'Half turn'     },
  { value: 270, label: '270°', desc: 'Quarter · CCW' },
];

/** Any angle folded into [0, 360). */
export const normalizeAngle = (deg) => {
  const a = Number(deg) % 360;
  return Number.isFinite(a) ? (a < 0 ? a + 360 : a) : 0;
};

/** True when the angle is an exact multiple of 90° — the lossless case. */
export const isQuarterTurn = (deg) => normalizeAngle(deg) % 90 === 0;

/**
 * Fraction of the map that stays inside the frame.
 *
 * Two congruent squares sharing a centre and rotated against each other by θ
 * overlap in a regular octagon of area 2 / (1 + cosθ + sinθ). At 45° that is
 * 2(√2 − 1) ≈ 0.828 — the worst case, and the number that tells a mapper
 * whether a given angle is worth it.
 */
export const coverage = (deg) => {
  const t = (normalizeAngle(deg) % 90) * Math.PI / 180;
  return 2 / (1 + Math.cos(t) + Math.sin(t));
};

/** Where the map's north edge ends up, as a compass label. */
export const northGoesTo = (deg) => {
  const a = normalizeAngle(deg);
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(a / 45) % 8];
};
