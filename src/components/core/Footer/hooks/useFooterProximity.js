import { useRef, useCallback, useEffect } from 'react';

/**
 * useFooterProximity
 *
 * Drives the proximity-wash effect on the collapsed footer bar:
 * as the cursor approaches from above, the bar gets a colored gradient
 * background, a glowing top border, a subtle lift, and the trace line + tool
 * label both pick up the tab-color glow.
 *
 * Also handles the auto-close timer: when the panel is expanded and the
 * cursor leaves the panel area (above panelTop), starts a 420ms timer to
 * collapse it. Cancelled if the cursor returns before the timer fires.
 *
 * @param {object} params
 * @param {React.RefObject} params.barRef       - ref to the footer root element
 * @param {React.RefObject} params.traceRef     - ref to the .ftr-trace element
 * @param {React.RefObject} params.toolSpanRef  - ref to the tool-label <span>
 * @param {React.RefObject} params.rgbRef       - ref holding "r,g,b" string or null
 * @param {boolean}         params.expanded     - whether the panel is open
 * @param {function}        params.onCollapse   - called to collapse the panel
 */
export function useFooterProximity({ barRef, traceRef, toolSpanRef, rgbRef, expanded, onCollapse }) {
  const rafRef                = useRef(null);
  const proximityCloseTimerRef = useRef(null);

  const clearProximityStyles = useCallback(() => {
    const bar   = barRef.current;
    const trace = traceRef.current;
    const span  = toolSpanRef.current;
    if (bar)   { bar.style.background = ''; bar.style.borderTopColor = ''; bar.style.boxShadow = ''; bar.style.transform = ''; }
    if (trace) { trace.style.background = ''; trace.style.boxShadow = ''; }
    if (span)  span.style.textShadow = '';
  }, [barRef, traceRef, toolSpanRef]);

  const onMouseMove = useCallback((e) => {
    const bar = barRef.current;
    if (!bar) return;

    if (expanded) {
      const panelTop = window.innerHeight * 0.30 - 60;
      if (e.clientY < panelTop) {
        if (!proximityCloseTimerRef.current) {
          proximityCloseTimerRef.current = setTimeout(() => {
            onCollapse();
            proximityCloseTimerRef.current = null;
          }, 420);
        }
      } else {
        if (proximityCloseTimerRef.current) {
          clearTimeout(proximityCloseTimerRef.current);
          proximityCloseTimerRef.current = null;
        }
      }
      return;
    }

    const trace = traceRef.current;
    const span  = toolSpanRef.current;
    const rect  = bar.getBoundingClientRect();
    const dist  = Math.max(0, rect.top - e.clientY);
    const proximity = Math.max(0, Math.min(1, 1 - dist / 150));
    const rgb   = rgbRef.current;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!rgb) {
        clearProximityStyles();
        return;
      }
      const washTop = (0.014 + proximity * 0.09).toFixed(3);
      const washMid = (0.005 + proximity * 0.03).toFixed(3);
      bar.style.background     = `linear-gradient(180deg, rgba(${rgb},${washTop}) 0%, rgba(${rgb},${washMid}) 40%, rgba(${rgb},0) 100%), #030304`;
      bar.style.borderTopColor = `rgba(${rgb},${(0.06 + proximity * 0.55).toFixed(2)})`;
      bar.style.boxShadow      = `0 ${Math.round(proximity * 14)}px ${Math.round(proximity * 26)}px -14px rgba(0,0,0,0.8), 0 0 ${Math.round(proximity * 28)}px -4px rgba(${rgb},${(proximity * 0.18).toFixed(2)})`;
      bar.style.transform      = `translateY(${(-proximity * 3).toFixed(1)}px)`;

      if (trace) {
        trace.style.background = `rgba(${rgb},${(0.06 + proximity * 0.7).toFixed(2)})`;
        trace.style.boxShadow  = proximity > 0.05
          ? `0 0 ${Math.round(proximity * 18)}px ${Math.round(proximity * 6)}px rgba(${rgb},${(proximity * 0.5).toFixed(2)})`
          : 'none';
      }
      if (span) {
        span.style.textShadow = proximity > 0.1
          ? `0 0 ${Math.round(proximity * 16)}px rgba(${rgb},0.5)`
          : 'none';
      }
    });
  }, [expanded, barRef, traceRef, toolSpanRef, rgbRef, onCollapse, clearProximityStyles]);

  const onMouseLeave = useCallback(() => {
    if (proximityCloseTimerRef.current) {
      clearTimeout(proximityCloseTimerRef.current);
      proximityCloseTimerRef.current = null;
    }
    if (expanded) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    clearProximityStyles();
  }, [expanded, clearProximityStyles]);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (proximityCloseTimerRef.current) clearTimeout(proximityCloseTimerRef.current);
    };
  }, [onMouseMove, onMouseLeave]);

  // Re-clear styles when the active tool changes color or the panel collapses
  useEffect(() => {
    if (!expanded) clearProximityStyles();
  }, [expanded, clearProximityStyles]);

  return { clearProximityStyles };
}
