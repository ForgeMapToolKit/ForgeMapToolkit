import React from 'react';

/**
 * ToolSlat — a single station on the TRACE rail.
 *
 * Two-part construction:
 *  - the BUTTON is the socket: full rail height, fixed geometry, never
 *    moves — so the hit target is stable under the cursor
 *  - the COLUMN is the rigid block inside it: machined face, neutral
 *    top edge, accent tick, index + label. At rest it sits recessed,
 *    its top face 34px below the rail's top hairline.
 *
 * On engage (hover/focus/active):
 *  - the column rises 30px as one rigid body — a control pillar
 *    unlocking upward from the machine surface. No scaling, no bounce,
 *    no neighbor displacement; the rail stays grounded
 *  - rise is heavy and engineered (~260ms, damped stop); release is a
 *    slow hydraulic settle (~550ms)
 *  - the tick ignites electrically (~60ms), label steps to primary one
 *    beat later; both decay like phosphor on leave
 *  - label goes muted → primary white, never accent: the only colored
 *    elements on screen are the tick and the trace
 *
 * Boot: each tick runs a one-time lamp-test flash on mount, staggered
 * by registry index (--lamp-delay).
 *
 * Props:
 *  - tool:         toolRegistry entry
 *  - active:       boolean (focused tool / pending commit)
 *  - onSelect(id): commit — shutter sweep, then navigation
 *  - onFocus(id):  hover/focus intent → ProjectionStage dwell gate
 *  - onBlur():     pointer/focus left
 */
const ToolSlat = ({ tool, active, onSelect, onFocus, onBlur }) => {
  const comingSoon = tool.status === 'coming-soon';
  const lampDelay  = (parseInt(tool.index, 10) || 0) * 40;

  return (
    <button
      className={`hs-slat${active ? ' hs-slat-active' : ''}${comingSoon ? ' hs-slat-soon' : ''}`}
      data-tool={tool.id}
      style={{
        '--slat-color': tool.color,
        '--slat-glow':  tool.glow,
        '--lamp-delay': `${lampDelay}ms`,
      }}
      onClick={comingSoon ? undefined : () => onSelect(tool.id)}
      onMouseEnter={() => { if (!comingSoon) onFocus(tool.id); }}
      onMouseLeave={onBlur}
      onFocus={() => { if (!comingSoon) onFocus(tool.id); }}
      onBlur={onBlur}
      aria-label={tool.label}
      disabled={comingSoon}
      tabIndex={comingSoon ? -1 : 0}
    >
      {/* The rigid block — rises out of the rail bed on engage */}
      <div className="hs-slat-column">
        <div className="hs-slat-tick" aria-hidden="true" />
        <div className="hs-slat-body">
          <span className="hs-slat-index">{tool.index}</span>
          <span className="hs-slat-label">{tool.label.toUpperCase()}</span>
        </div>
      </div>
    </button>
  );
};

export default ToolSlat;
