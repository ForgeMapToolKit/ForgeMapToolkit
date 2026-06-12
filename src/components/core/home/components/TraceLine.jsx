import React from 'react';

/**
 * TraceLine — the filament. The emotional signature of the home screen.
 *
 * Three layers, one motion:
 *  - bloom: a pre-blurred energy field hugging the line — burns hard
 *           during the sweep, settles to a resident glow
 *  - line:  the 1px resident core in the tool's hue
 *  - hot:   a white-hot overlay riding the same sweep, cooling to the
 *           hue over ~1s after the pass — a filament losing heat
 *
 * All three are driven by the same scaleX sweep (duration, easing,
 * delay shared with the carriage and the typography clip wipes), so
 * the energy, the line and the type resolve as one signal crossing
 * the surface. Colors inherit --proj-color / --proj-glow from the
 * projection card.
 */
const TraceLine = () => (
  <div className="trace-line-container" aria-hidden="true">
    <div className="trace-bloom" />
    <div className="trace-line" />
    <div className="trace-hot" />
  </div>
);

export default TraceLine;
