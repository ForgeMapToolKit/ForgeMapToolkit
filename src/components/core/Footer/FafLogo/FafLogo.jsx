import React, { useRef, useEffect } from 'react';
import './FafLogo.css';

// FAF logo shape definitions.
const FAF_SHAPES = [
  { type: 'polygon', points: '561.3,187.18 653.75,347.29 594.8,347.29 473.49,136.23 659.6,136.23 689,187.16 561.32,187.16' },
  { type: 'polygon', points: '410.52,26.71 596.34,26.71 628.74,82.81 442.76,82.81' },
  { type: 'path',    d: 'M354.05,26.71h-1.49L167.47,347.29h56.78l44-76.23H435.89l44,76.23h58.43ZM305.57,207.25l46.52-80.56,46.51,80.56Z' },
  { type: 'polygon', points: '74.26,82.81 106.66,26.71 295.93,26.71 263.53,82.81' },
  { type: 'polygon', points: '110.82,347.29 49.23,347.29 141.68,187.18 14,187.18 43.4,136.25 232.67,136.25' },
];

function ShapeEl({ shape, className, style, dataAttr }) {
  const common = {
    className,
    fill: 'none',
    style,
    ...(dataAttr ? { 'data-faf-shape': true } : {}),
  };
  return shape.type === 'path'
    ? <path {...common} d={shape.d} />
    : <polygon {...common} points={shape.points} />;
}

// Smoothstep — eases the tip-glow in/out in sync with the CSS dashoffset transition.
function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * FafLogo
 *
 * Flat 2D line-draw animation of the FAF logo. Strokes animate in via
 * stroke-dashoffset (driven from CSS with a per-shape delay), and a small
 * glow dot rides the leading edge of each line via a RAF loop that reads the
 * live CSS-transitioned dashoffset each frame.
 *
 * @param {object}  props
 * @param {boolean} props.animate - whether to run the draw-on animation
 */
function FafLogo({ animate }) {
  const svgRef    = useRef(null);
  const tipRafRef = useRef(null);

  // Drive the draw-on: snap all shapes to fully-undrawn (no transition),
  // force reflow, then re-enable transitions and pull dashoffset to 0.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const shapes = Array.from(svg.querySelectorAll('[data-faf-shape]'));

    shapes.forEach((el) => {
      const len = el.getTotalLength?.() ?? 800;
      el.style.transition       = 'none';
      el.style.strokeDasharray  = len;
      el.style.strokeDashoffset = len;
    });

    // Force the browser to commit the hidden state before the transition is re-enabled
    void svg.getBoundingClientRect();
    shapes.forEach((el) => { el.style.transition = ''; });

    if (!animate) return;

    const raf = requestAnimationFrame(() => {
      shapes.forEach((el) => { el.style.strokeDashoffset = '0'; });
    });
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  // Drive the tip-glow: sample live dashoffset each frame, place the glow
  // dot at getPointAtLength, fade it in/out around the leading edge.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const shapeEls = Array.from(svg.querySelectorAll('[data-faf-shape]'));
    const tipEls   = Array.from(svg.querySelectorAll('[data-faf-tip]'));

    if (tipRafRef.current) cancelAnimationFrame(tipRafRef.current);

    if (!animate) {
      tipEls.forEach((tip) => { tip.style.opacity = '0'; });
      return;
    }

    const maxDelay  = (shapeEls.length - 1) * 0.14;
    const runtimeMs = (maxDelay + 1.1 + 0.05) * 1000;
    const startedAt = performance.now();

    const tick = () => {
      shapeEls.forEach((pathEl, i) => {
        const tip = tipEls[i];
        if (!tip) return;
        const len = pathEl.getTotalLength?.() ?? 0;
        if (!len) return;

        const offset   = parseFloat(getComputedStyle(pathEl).strokeDashoffset) || len;
        const distance = Math.min(len, Math.max(0, len - offset));
        const progress = distance / len;

        const point = pathEl.getPointAtLength(distance);
        tip.setAttribute('cx', point.x);
        tip.setAttribute('cy', point.y);

        const fadeIn  = smoothstep(0, 0.06, progress);
        const fadeOut = 1 - smoothstep(0.90, 1.0, progress);
        tip.style.opacity = String(fadeIn * fadeOut);
      });

      if (performance.now() - startedAt < runtimeMs) {
        tipRafRef.current = requestAnimationFrame(tick);
      } else {
        tipEls.forEach((tip) => { tip.style.opacity = '0'; });
      }
    };

    tipRafRef.current = requestAnimationFrame(tick);
    return () => { if (tipRafRef.current) cancelAnimationFrame(tipRafRef.current); };
  }, [animate]);

  return (
    <svg
      ref={svgRef}
      className="ftr-logo-svg"
      viewBox="0 0 703 374"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="ftr-tip-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>

      <g>
        {FAF_SHAPES.map((shape, i) => (
          <ShapeEl
            key={`line-${i}`}
            shape={shape}
            dataAttr
            className="ftr-logo-shape"
            style={{ '--shape-delay': `${i * 0.14}s` }}
          />
        ))}
      </g>

      <g>
        {FAF_SHAPES.map((_, i) => (
          <circle key={`tip-${i}`} data-faf-tip className="ftr-logo-tip" r={5} cx={0} cy={0} />
        ))}
      </g>
    </svg>
  );
}

export default FafLogo;
