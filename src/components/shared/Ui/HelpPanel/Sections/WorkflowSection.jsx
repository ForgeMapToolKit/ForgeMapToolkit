/**
 * WorkflowSection — the JOURNEY MAP.
 *
 * A full-width expedition: a single route draws itself from station 01
 * downward; as the line reaches each station a delicate tendril branches
 * organically out of the spine and the station's card prints in at the
 * outer edge. Monumental ghost numerals thread along the line for depth.
 *
 * No hierarchy between stations — every milestone reads equal once found.
 * Depth comes from light, not emphasis: a warm bloom crowns the top of
 * the route and falls away into darkness toward the foot.
 *
 * Boxless by design — a card is pure type. Pure design-system: every
 * value is a token, the one dynamic accent is the inherited --tab-color.
 *
 * Props:
 *   label?     string         eyebrow label
 *   steps      Step[]         milestones, distributed L/R automatically
 *   duration?  number         draw length in seconds (default 5)
 *
 * Step shape: { title: string, body: string | ReactNode }
 */

import React, { useRef, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
  useReducedMotion,
} from 'framer-motion';
import './sections.css';

const EASE        = [0.16, 1, 0.3, 1];
const STATION_H   = 196;     // vertical room per station (px)
const NX_NEAR     = 0.46;    // spine x as a fraction of width (alternates)
const NX_FAR      = 0.54;
const PAD_TOP     = 36;      // head/foot room so end stations never clip
const PAD_BOT     = 36;
const LEAD        = 92;      // route lead-in / lead-out that dissolves to dark
/* per-station inward insets — break the uniform outer edge so the cards
   read as scattered (one nearer the spine, one further out), not a wall */
const JITTER      = [0, 58, 24, 86, 10, 46];

/* ── Spine: a gentle serpentine through the station points ──────────── */
function buildSpine(pts) {
  if (pts.length < 2) return '';
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], my = (a.y + b.y) / 2;
    d.push(`C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`);
  }
  return d.join(' ');
}

/* ── Branch: a tendril rooted EXACTLY on the spine that peels to the card.
 * A station is an on-path anchor of the spine and the spine's tangent
 * there is vertical (the chain's control points share the station x), so
 * the branch starts at (st.x, st.y) heading vertically — tangent-continuous,
 * sitting precisely on the main line — then sweeps out. The tip fades soft
 * via a stroke gradient (two ways gently separating, ending elsewhere). */
function buildBranch(st, anchor) {
  if (!anchor) return '';
  const dir = st.side === 'left' ? -1 : 1;
  return [
    `M ${st.x} ${st.y}`,              // exactly on the spine
    `C ${st.x} ${st.y - 34},`,        // leave along the (vertical) tangent
    `${anchor.x - dir * 64} ${st.y},`,
    `${anchor.x} ${anchor.y}`,
  ].join(' ');
}

export default function WorkflowSection({ label, steps = [], duration = 5 }) {
  const wrapRef  = useRef(null);
  const pathRef     = useRef(null);
  const cometRef    = useRef(null);
  const fracRef     = useRef([]);
  const controlsRef = useRef(null);

  const [w, setW]           = useState(0);
  const [active, setActive] = useState(-1);

  const draw   = useMotionValue(0);
  const reduce = useReducedMotion();

  const stageH = PAD_TOP + steps.length * STATION_H + PAD_BOT;

  /* station geometry + branch anchors — fully analytic (no measuring of
     the spine or the framer-animated cards, so nothing races the draw) */
  const stations = useMemo(() => {
    if (!w) return [];
    const cw = Math.max(220, Math.min(0.30 * w, 360)); // mirrors the card clamp
    return steps.map((s, i) => {
      const side  = i % 2 === 0 ? 'left' : 'right';
      const inset = JITTER[i % JITTER.length];
      const y = PAD_TOP + STATION_H / 2 + i * STATION_H;
      return {
        side, y, inset,
        x: (side === 'left' ? NX_NEAR : NX_FAR) * w,
        anchor: { x: side === 'left' ? inset + cw : w - inset - cw, y },
      };
    });
  }, [w, steps]);

  /* spine threads the stations. The lead-in runs all the way to the very
     top of the content (y=0, just under the console traceline) where the
     route gradient dissolves it to nothing — so the top reads as the line
     emerging from the edge, with no hard cut (and no dependence on the
     traceline, which fades). A lead-out dissolves the foot the same way. */
  const spineD = useMemo(() => {
    if (stations.length < 2) return '';
    const first = stations[0];
    const last  = stations[stations.length - 1];
    return buildSpine([
      { x: first.x, y: 0 },
      ...stations,
      { x: last.x, y: last.y + LEAD },
    ]);
  }, [stations]);
  const branchDs = useMemo(
    () => stations.map((st) => buildBranch(st, st.anchor)),
    [stations],
  );

  /* ── Measure width only ───────────────────────────────────────────── */
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (wrap) setW(wrap.getBoundingClientRect().width);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  /* ── The draw — runs on mount and on Replay ───────────────────────── */
  const runDraw = useCallback(() => {
    const path = pathRef.current;
    if (!path || !spineD) return;
    controlsRef.current?.stop();

    const len = path.getTotalLength();
    fracRef.current = stations.map((st) => {
      let best = 0, bestD = Infinity;
      for (let l = 0; l <= len; l += 5) {
        const p = path.getPointAtLength(l);
        const dd = (p.x - st.x) ** 2 + (p.y - st.y) ** 2;
        if (dd < bestD) { bestD = dd; best = l; }
      }
      return best / len;
    });

    if (reduce) { draw.set(1); setActive(steps.length - 1); return; }
    setActive(-1);
    draw.set(0);
    controlsRef.current = animate(draw, 1, { duration, ease: EASE });
  }, [spineD, stations, duration, reduce, steps.length, draw]);

  useLayoutEffect(() => {
    runDraw();
    return () => controlsRef.current?.stop();
  }, [runDraw]);

  /* ── Comet + reveals ride the draw value ──────────────────────────── */
  useMotionValueEvent(draw, 'change', (v) => {
    const path = pathRef.current;
    if (path && cometRef.current) {
      const len = path.getTotalLength();
      const p = path.getPointAtLength(len * v);
      cometRef.current.setAttribute('cx', p.x);
      cometRef.current.setAttribute('cy', p.y);
      cometRef.current.style.opacity = v > 0.01 && v < 0.985 ? '1' : '0';
    }
    let hi = -1;
    fracRef.current.forEach((f, i) => { if (v >= f) hi = i; });
    setActive((prev) => (hi > prev ? hi : prev));
  });

  /* white-hot streak riding the leading edge */
  const sparkOffset  = useTransform(draw, (v) => 1 - v);
  const sparkOpacity = useTransform(draw, [0, 0.03, 0.95, 1], [0, 1, 1, 0]);

  const cardVariants = {
    hidden: (side) => ({ opacity: 0, x: reduce ? 0 : side === 'left' ? -20 : 20 }),
    shown:  {
      opacity: 1, x: 0,
      transition: { duration: 0.6, ease: EASE, staggerChildren: 0.06, delayChildren: 0.04 },
    },
  };
  const lineVariants = {
    hidden: { opacity: 0, y: reduce ? 0 : 8 },
    shown:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div className={`hs-section hs-journey${reduce ? ' is-static' : ''}`} ref={wrapRef}>
      <div className="hs-journey__stage" style={{ height: stageH }}>
        {/* depth layer — monumental ghost numerals */}
        <div className="hs-journey__ghosts" aria-hidden="true">
          {stations.map((st, i) => (
            <div
              key={i}
              className={`hs-journey__numeral${i <= active ? ' is-on' : ''}`}
              style={{ left: st.x + (i === 0 ? -20 : 0), top: st.y }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* the route + tendrils */}
        <svg
          className="hs-journey__svg"
          viewBox={`0 0 ${w || 1} ${stageH || 1}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hsj-route" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--tab-color)" stopOpacity="0" />
              <stop offset="10%"  stopColor="var(--tab-color)" stopOpacity="1" />
              <stop offset="62%"  stopColor="var(--tab-color)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--tab-color)" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="hsj-brL" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%"  stopColor="var(--tab-color)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--tab-color)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hsj-brR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor="var(--tab-color)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--tab-color)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {spineD && <path className="hs-journey__ghostline" d={spineD} />}

          {branchDs.map((d, i) =>
            d ? (
              <path
                key={i}
                className={`hs-journey__branch${i <= active ? ' is-on' : ''}`}
                d={d}
                pathLength="1"
                stroke={`url(#hsj-br${stations[i].side === 'left' ? 'L' : 'R'})`}
              />
            ) : null,
          )}

          {spineD && (
            <motion.path
              ref={pathRef}
              className="hs-journey__route"
              d={spineD}
              style={{ pathLength: reduce ? 1 : draw }}
              initial={false}
            />
          )}
          {spineD && (
            <motion.path
              className="hs-journey__spark"
              d={spineD}
              pathLength="1"
              strokeDasharray="0.04 0.96"
              style={{ strokeDashoffset: sparkOffset, opacity: reduce ? 0 : sparkOpacity }}
            />
          )}
          <circle ref={cometRef} className="hs-journey__comet" r="5" />
        </svg>

        {/* cards — outer edges, all equal. The positioning wrapper owns the
            vertical centring so framer's transform (opacity + x) is free. */}
        <div className="hs-journey__cards">
          {stations.map((st, i) => (
            <div
              key={i}
              className={`hs-journey__cardpos hs-journey__cardpos--${st.side}`}
              style={st.side === 'left'
                ? { top: st.y, left: st.inset }
                : { top: st.y, right: st.inset }}
            >
              <motion.div
                className={`hs-journey__card hs-journey__card--${st.side}`}
                custom={st.side}
                variants={cardVariants}
                initial={reduce ? 'shown' : 'hidden'}
                animate={reduce || i <= active ? 'shown' : 'hidden'}
              >
                <motion.div className="hs-journey__card-index" variants={lineVariants}>
                  <span className="hs-journey__card-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hs-journey__card-tag">Station</span>
                </motion.div>
                <motion.div className="hs-journey__card-title" variants={lineVariants}>
                  {steps[i].title}
                </motion.div>
                <motion.div className="hs-journey__card-rule" variants={lineVariants} />
                <motion.div className="hs-journey__card-body" variants={lineVariants}>
                  {typeof steps[i].body === 'string' ? <p>{steps[i].body}</p> : steps[i].body}
                </motion.div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
