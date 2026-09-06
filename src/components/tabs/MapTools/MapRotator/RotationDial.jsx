import React from 'react';
import { normalizeAngle, isQuarterTurn, coverage, northGoesTo } from './angles.js';

/**
 * RotationDial — what the turn does to the map, drawn.
 *
 * The dashed square is the frame the map has to stay inside; the filled one is
 * the map after the turn. On a quarter turn the two coincide. On anything else
 * the four flaps sticking out are what is rotated off the map, and the corners
 * the dashed square keeps are what gets filled by extending the border. The
 * arrow is the map's old north, so you can see where the layout went.
 */
const RotationDial = ({ angle }) => {
  const a       = normalizeAngle(angle);
  const quarter = isQuarterTurn(a);
  const kept    = coverage(a);

  const S  = 168;          // viewBox
  const C  = S / 2;
  const H  = 52;           // half-edge of the map square
  const rad = a * Math.PI / 180;

  // Corners of the rotated map square, in the same clockwise-on-screen sense
  // the engine module uses: x' = x·cos − z·sin, z' = x·sin + z·cos.
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rot = (x, z) => [C + x * cos - z * sin, C + x * sin + z * cos];
  const pts = [[-H, -H], [H, -H], [H, H], [-H, H]]
    .map(([x, z]) => rot(x, z).map(v => v.toFixed(2)).join(','))
    .join(' ');

  // Old north: the midpoint of the map's top edge, after the turn.
  const [nx, nz] = rot(0, -H);

  return (
    <div className="mrot-dial">
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" height="100%" role="img"
           aria-label={`Map rotated ${a} degrees clockwise`}>
        {/* Compass ticks — the frame's own orientation, which never moves */}
        {[['N', C, 12], ['E', S - 9, C + 4], ['S', C, S - 5], ['W', 9, C + 4]].map(([l, x, y]) => (
          <text key={l} x={x} y={y} className="mrot-dial-compass" textAnchor="middle">{l}</text>
        ))}

        {/* The frame the map must fit into */}
        <rect x={C - H} y={C - H} width={H * 2} height={H * 2}
              className="mrot-dial-frame" />

        {/* The map after the turn */}
        <polygon points={pts} className="mrot-dial-map" />

        {/* Old north */}
        <line x1={C} y1={C} x2={nx} y2={nz} className="mrot-dial-needle" />
        <circle cx={nx} cy={nz} r="3.5" className="mrot-dial-needle-tip" />
        <circle cx={C} cy={C} r="2" className="mrot-dial-hub" />
      </svg>

      <div className="mrot-dial-readout">
        <span className="mrot-dial-angle">{a}°</span>
        <span className="mrot-dial-sub">
          {a === 0 ? 'no rotation' : `north → ${northGoesTo(a)}`}
        </span>
        <span className={`mrot-dial-badge${quarter ? ' mrot-dial-badge--lossless' : ''}`}>
          {quarter
            ? 'Lossless quarter turn'
            : `${(kept * 100).toFixed(1)}% kept`}
        </span>
      </div>
    </div>
  );
};

export default RotationDial;
