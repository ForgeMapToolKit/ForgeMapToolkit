/**
 * WorkflowSection — vertical SVG timeline.
 *
 * Renders a winding SVG path from top to bottom, with numbered nodes
 * for each step. The path is drawn dynamically after the DOM mounts
 * so node positions are measured from the real layout — no hardcoded
 * pixel values.
 *
 * Props:
 *   label?  string       eyebrow label above the section
 *   steps   Step[]
 *
 * Step shape:
 *   { title: string, body: string | ReactNode, bullets?: string[] }
 *
 * Usage:
 *   <WorkflowSection
 *     label="Typical Workflow"
 *     steps={[
 *       { title: 'Open the file', body: 'Navigate to File → Open.' },
 *       { title: 'Configure', body: 'Set the options.', bullets: ['Option A', 'Option B'] },
 *     ]}
 *   />
 */

import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import './sections.css';

/* ── SVG path builder ───────────────────────────────────────────── */

/**
 * Builds a smooth SVG path that threads through a list of {x, y} points,
 * adding a gentle S-curve wiggle between each consecutive pair.
 * The x coordinate of the center column is `cx`; the path enters/exits
 * each node on the center line.
 */
function buildPath(points, cx) {
  if (points.length < 2) return '';
  const parts = [`M ${cx} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dy = b.y - a.y;
    const amp = Math.min(10, dy * 0.18); // gentle wiggle amplitude
    const cp1x = cx + amp;
    const cp1y = a.y + dy * 0.35;
    const cp2x = cx - amp;
    const cp2y = a.y + dy * 0.65;
    parts.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx} ${b.y}`);
  }
  return parts.join(' ');
}

/* ── Component ──────────────────────────────────────────────────── */

export default function WorkflowSection({ label, steps = [] }) {
  const wrapRef   = useRef(null);
  const nodeRefs  = useRef([]);
  const [pathD, setPathD]     = useState('');
  const [svgH, setSvgH]       = useState(0);
  const NODE_CX = 20; // center x of the 40px svg column

  const measure = useCallback(() => {
    if (!wrapRef.current) return;
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const pts = nodeRefs.current
      .filter(Boolean)
      .map(el => {
        const r = el.getBoundingClientRect();
        // center of node, relative to wrapper top
        return { y: r.top - wrapRect.top + r.height / 2 };
      });

    if (pts.length < 2) return;
    setSvgH(wrapRect.height);
    setPathD(buildPath(pts, NODE_CX));
  }, []);

  // Measure after paint + on resize
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure, steps]);

  return (
    <div className="hs-section hs-workflow" ref={wrapRef}>
      {label && <div className="hs-section-label">{label}</div>}

      {/* SVG line — positioned absolute behind the steps */}
      <div className="hs-workflow__svg-wrap">
        <svg
          className="hs-workflow__svg"
          width={40}
          height={svgH || 1}
          style={{ height: svgH || 1 }}
          aria-hidden="true"
        >
          {pathD && (
            <path className="hs-workflow__path" d={pathD} />
          )}
        </svg>
      </div>

      {/* Steps */}
      <div className="hs-workflow__steps">
        {steps.map((step, i) => (
          <div
            key={i}
            className="hs-workflow__step"
            style={{ animationDelay: `${0.1 + i * 0.07}s` }}
          >
            {/* Node marker — measured for SVG path */}
            <div
              className="hs-workflow__node"
              ref={el => { nodeRefs.current[i] = el; }}
            >
              {i + 1}
            </div>

            <div className="hs-workflow__step-title">{step.title}</div>

            <div className="hs-workflow__step-body">
              {typeof step.body === 'string'
                ? <p>{step.body}</p>
                : step.body}
            </div>

            {step.bullets?.length > 0 && (
              <ul className="hs-workflow__bullets">
                {step.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
