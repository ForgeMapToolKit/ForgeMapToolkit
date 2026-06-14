/**
 * MediaSection — image embed with multiple layout modes.
 *
 * Modes:
 *   layout="image-left"    image left, text right
 *   layout="image-right"   image right, text left  (default)
 *   layout="comparison"    two images side by side
 *   layout="slideshow"     one image at a time, dot navigation
 *
 * Props (common):
 *   label?       string       eyebrow label
 *   description? string       caption below everything (full width)
 *   layout       string       one of the modes above
 *
 * Props (image-left / image-right):
 *   src          string       image path
 *   alt?         string
 *   title?       string       text panel title
 *   body?        string|node  text panel body
 *
 * Props (comparison):
 *   images       [{ src, alt?, label? }, ...]   exactly 2 items
 *   title?       string       text above both images
 *
 * Props (slideshow):
 *   slides       [{ src, alt?, caption? }, ...]
 *   autoplay?    number       interval in ms (0 = off, default 0)
 *
 * Usage:
 *   <MediaSection
 *     layout="image-right"
 *     label="Canvas overview"
 *     src="./assets/help/canvas.png"
 *     title="The canvas"
 *     body="Scroll to zoom, drag to pan."
 *     description="Canvas renders a real-time top-down preview."
 *   />
 *
 *   <MediaSection
 *     layout="comparison"
 *     label="Before / After"
 *     images={[
 *       { src: './assets/help/before.png', label: 'Before' },
 *       { src: './assets/help/after.png',  label: 'After'  },
 *     ]}
 *   />
 *
 *   <MediaSection
 *     layout="slideshow"
 *     label="Step by step"
 *     slides={[
 *       { src: './assets/help/step1.png', caption: 'Open the file.' },
 *       { src: './assets/help/step2.png', caption: 'Configure units.' },
 *     ]}
 *   />
 */

import React, { useState, useEffect, useRef } from 'react';
import './sections.css';

/* ── Sub-renderers ──────────────────────────────────────────────── */

function SplitLayout({ src, alt, title, body, layout }) {
  return (
    <div className={`hs-media--split hs-media--${layout}`}>
      <div className="hs-media__img-wrap">
        <img className="hs-media__img" src={src} alt={alt || ''} loading="lazy" />
      </div>
      {(title || body) && (
        <div className="hs-media__text">
          {title && <div className="hs-media__text-title">{title}</div>}
          {body  && (
            <div className="hs-media__text-body">
              {typeof body === 'string' ? <p>{body}</p> : body}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonLayout({ images = [], title }) {
  return (
    <>
      {title && <div className="hs-media__text-title" style={{ marginBottom: 'var(--space-sm)' }}>{title}</div>}
      <div className="hs-media--comparison">
        {images.map((img, i) => (
          <div key={i} className="hs-media__img-wrap">
            {img.label && <span className="hs-media__compare-label">{img.label}</span>}
            <img className="hs-media__img" src={img.src} alt={img.alt || ''} loading="lazy" />
          </div>
        ))}
      </div>
    </>
  );
}

function SlideshowLayout({ slides = [], autoplay = 0 }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const count = slides.length;

  const go = (i) => setIdx((i + count) % count);

  useEffect(() => {
    if (autoplay > 0) {
      timerRef.current = setInterval(() => setIdx(p => (p + 1) % count), autoplay);
    }
    return () => clearInterval(timerRef.current);
  }, [autoplay, count]);

  const current = slides[idx] || {};

  return (
    <div className="hs-media--slideshow">
      <div className="hs-media__slide-wrap">
        <div className="hs-media__slide active">
          <img src={current.src} alt={current.alt || ''} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>
        {current.caption && (
          <div className="hs-media__slide-caption">{current.caption}</div>
        )}
      </div>
      {count > 1 && (
        <div className="hs-media__slide-ctrl">
          <button className="hs-media__arrow" onClick={() => go(idx - 1)} aria-label="Previous">←</button>
          <div className="hs-media__dots" role="tablist">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`hs-media__dot${i === idx ? ' active' : ''}`}
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}`}
                role="tab"
                aria-selected={i === idx}
              />
            ))}
          </div>
          <button className="hs-media__arrow" onClick={() => go(idx + 1)} aria-label="Next">→</button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export default function MediaSection({
  label,
  description,
  layout = 'image-right',
  // split props
  src, alt, title, body,
  // comparison props
  images,
  // slideshow props
  slides, autoplay,
}) {
  return (
    <div className="hs-section hs-media">
      {label && <div className="hs-section-label">{label}</div>}

      {(layout === 'image-left' || layout === 'image-right') && (
        <SplitLayout src={src} alt={alt} title={title} body={body} layout={layout} />
      )}

      {layout === 'comparison' && (
        <ComparisonLayout images={images} title={title} />
      )}

      {layout === 'slideshow' && (
        <SlideshowLayout slides={slides} autoplay={autoplay} />
      )}

      {description && (
        <div className="hs-media__desc">{description}</div>
      )}
    </div>
  );
}
