import React, { useState, useEffect, useRef } from 'react';
import TraceLine from './TraceLine.jsx';

/**
 * ProjectionStage — central projection field of the TRACE home screen.
 *
 * The stage is a surface written by a machine. Every reveal is performed
 * by a plotter gantry: a vertical carriage hairline crosses the stage,
 * the 1px trace (the pen) draws at the baseline, and the typography
 * resolves exactly at the carriage's x-position — clip wipes, carriage
 * and trace share one duration, one easing, one delay.
 *
 * Phases:
 *  standby  — identity card at rest; block cursor blinking (machine on)
 *  print    — carriage pass left → right, stage dims briefly (power draw)
 *  unprint  — carriage returns, typography erased right → left
 *
 * Boot (first mount only, pure CSS): the wordmark prints bright behind
 * a full-width boot line, then settles into the architecture as a ghost.
 *
 * Choreography (from slat hover at T+0):
 *  T+0      slat tick ignites (local, in ToolSlat)
 *  T+120    dwell-intent gate passes — standby exits, stage power dips
 *  T+200    carriage + trace cross (~320ms, fast-out mechanical),
 *           typography resolves at the carriage edge
 *  T+300    descriptor prints (single +100ms stagger), data line trails
 *  settle   carriage lifts; the trace remains as the underline
 *
 * Scrub: the dwell gate (~120ms) throttles the stage — rapid scrubbing
 * flickers only slat ticks; the stage reprints when the cursor settles.
 * Reprint is forced via a keyed remount (printSeq) so the pass restarts
 * in the new hue.
 *
 * Leave: hold ~800ms, then the carriage returns (~260ms), standby
 * resolves back. The machine stands down; it doesn't snap.
 *
 * Commit (click): a shutter — a curtain of darkness led by the tool's
 * hue sweeps the full stage; navigation fires while the stage is dark,
 * so entering the tab reads as a cut, not a route change.
 */

const DWELL_MS   = 120; // scrub-intent gate
const HOLD_MS    = 800; // hold after pointer leaves the rail
const UNPRINT_MS = 280; // unprint duration incl. settle beat (matches CSS)

const ProjectionStage = ({ tool, commitTool, appVersion, lastMap, mapDims }) => {
  const [displayTool, setDisplayTool] = useState(null);
  const [phase,       setPhase]       = useState('standby'); // 'standby' | 'print' | 'unprint'
  const [printSeq,    setPrintSeq]    = useState(0);

  const dwellRef = useRef(null);
  const leaveRef = useRef(null);

  useEffect(() => {
    clearTimeout(dwellRef.current);

    // Commit freezes all choreography — the shutter owns the stage now.
    if (commitTool) return;

    if (!tool) {
      // ── Leave: hold the projection, then unprint, then stand down ──
      if (displayTool && phase === 'print') {
        leaveRef.current = setTimeout(() => {
          setPhase('unprint');
          leaveRef.current = setTimeout(() => {
            setDisplayTool(null);
            setPhase('standby');
          }, UNPRINT_MS);
        }, HOLD_MS);
      }
      return () => clearTimeout(leaveRef.current);
    }

    // Pointer is back on the rail — cancel any pending stand-down.
    clearTimeout(leaveRef.current);

    // Already projecting this tool — nothing to do.
    if (displayTool?.id === tool.id && phase === 'print') return;

    // ── Dwell gate: engage / switch only once the cursor settles ──
    dwellRef.current = setTimeout(() => {
      setDisplayTool(tool);
      setPhase('print');
      setPrintSeq(s => s + 1); // remount → the carriage pass restarts
    }, DWELL_MS);

    return () => clearTimeout(dwellRef.current);
  }, [tool, commitTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear timers on unmount.
  useEffect(() => () => {
    clearTimeout(dwellRef.current);
    clearTimeout(leaveRef.current);
  }, []);

  return (
    <div className="hs-stage">

      {/* ── Standby card — the machine at rest, dials lit ───────── */}
      <div className={`hs-stage-card hs-standby${phase !== 'standby' ? ' hs-standby--hidden' : ''}`}>
        <div className="hs-standby-designation">FORGEMAPTOOLKIT</div>
        {/* Boot line — draws once on launch, then yields to the rule */}
        <div className="hs-standby-bootline" aria-hidden="true" />
        <div className="hs-standby-rule" />
        <div className="hs-standby-meta">
          <span className="hs-meta-item">{appVersion ? `v${appVersion}` : 'v—'}</span>
          <span className="hs-meta-item">
            {lastMap
              ? <>{lastMap}{mapDims ? ` ${mapDims}` : ''}</>
              : 'NO MAP LOADED'
            }
          </span>
          <span className="hs-meta-item">STANDBY</span>
          <span className="hs-standby-cursor" aria-hidden="true" />
        </div>
      </div>

      {/* ── Tool projection — keyed so the carriage pass restarts ── */}
      {displayTool && (
        <div
          key={`${displayTool.id}-${printSeq}`}
          className={`hs-stage-card hs-projection${phase === 'unprint' ? ' hs-projection--unprint' : ''}`}
          style={{
            '--proj-color': displayTool.color,
            '--proj-glow':  displayTool.glow,
          }}
        >
          {/* Ambient wash — the projection's light filling the room */}
          <div className="hs-proj-wash" aria-hidden="true" />

          {/* Power draw — the stage dims for a beat as the projector fires */}
          <div className="hs-proj-dimmer" aria-hidden="true" />

          {/* The gantry — vertical carriage crossing the stage in sync
              with the trace tip and every clip edge */}
          <div className="hs-proj-carriage" aria-hidden="true">
            <div className="hs-carriage-veil" />
            <div className="hs-carriage-head" />
          </div>

          <div className="hs-proj-index">
            {displayTool.index} — {displayTool.category.toUpperCase()}
          </div>

          <div className="hs-proj-designation">
            {displayTool.label.toUpperCase()}
          </div>

          <TraceLine />

          <div className="hs-proj-descriptor">
            {displayTool.navDescription || displayTool.description}
          </div>

          <div className="hs-proj-data">
            <span className="hs-proj-data-item">INDEX {displayTool.index}</span>
            <span className="hs-proj-data-item">{displayTool.category.toUpperCase()}</span>
            {displayTool.status === 'coming-soon' && (
              <span className="hs-proj-data-item hs-proj-soon">COMING SOON</span>
            )}
          </div>
        </div>
      )}

      {/* ── Commit shutter — darkness led by the tool's hue ─────── */}
      {commitTool && (
        <div
          className="hs-commit-track"
          style={{
            '--commit-color': commitTool.color,
            '--commit-glow':  commitTool.glow,
          }}
          aria-hidden="true"
        >
          <div className="hs-commit-curtain" />
          <div className="hs-commit-veil" />
          <div className="hs-commit-head" />
        </div>
      )}

    </div>
  );
};

export default ProjectionStage;
