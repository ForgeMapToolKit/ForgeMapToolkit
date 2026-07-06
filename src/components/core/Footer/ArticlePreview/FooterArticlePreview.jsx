import React from 'react';
import './FooterArticlePreview.css';


// ═══════════════════════════════════════════════════════════════════════════
// FooterArticlePreview
//
// Sits in .ftr-left in place of the four nav columns once a nav action has
// been clicked (Normal mode only -- Quick Link mode skips straight to
// FooterContentViewer, see Footer.jsx's handleNavAction). Pure presentation:
// title + teaser + two buttons. All state (which article, which panel mode)
// lives one level up in Footer.jsx.
// ═══════════════════════════════════════════════════════════════════════════

// Wraps every standalone occurrence of `accentWord` in the title with the
// tool's accent color, so e.g. the product name can read consistently with
// the hero/wordmark treatment elsewhere in the app. Pass no accentWord (or
// one that isn't found in the title) to leave the title unaccented.
function renderTitle(title, accentWord) {
  if (!accentWord) return title;
  const parts = title.split(new RegExp(`(${accentWord})`, 'g'));
  return parts.map((part, i) =>
    part === accentWord
      ? <span key={i} className="ftr-preview-title-accent">{part}</span>
      : part
  );
}

function FooterArticlePreview({ title, teaser, accentWord, onReadMore, onBack }) {
  return (
    <div className="ftr-preview">
      {/* Back + title + teaser + button share one accent-bordered block, so
          Back reads as this article's own breadcrumb instead of a loose
          element floating between the panel header and the content. */}
      <div className="ftr-preview-block">
        <button
          type="button"
          className="ftr-preview-back"
          onClick={onBack}
          aria-label="Back to navigation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <div className="ftr-preview-body">
          <h3 className="ftr-preview-title">{renderTitle(title, accentWord)}</h3>
          <p className="ftr-preview-teaser">{teaser}</p>

          <button type="button" className="ftr-preview-readmore" onClick={onReadMore}>
            Read more
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FooterArticlePreview;
