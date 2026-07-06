import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTool } from '../Home/Data/toolRegistry.js';
import { getFooterContent } from './footerContentRegistry.js';
import { useFooterPanelState } from './hooks/useFooterPanelState.js';
import { useFooterProximity } from './hooks/useFooterProximity.js';
import FafLogo from './FafLogo/FafLogo.jsx';
import FooterNav from './Nav/FooterNav.jsx';
import FooterArticlePreview from './ArticlePreview/FooterArticlePreview.jsx';
import './FafLogo/FafLogo.css';
import './Footer.css';

const FOOTER_PREFIX = 'footer:';

// Resolve a CSS custom property from :root → "r,g,b" string or null.
// Needed so JS can compose rgba() values for the proximity-wash effect.
function resolveColorVar(colorVar) {
  if (!colorVar) return null;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(colorVar)
    .trim();
  if (!raw) return null;
  const h6 = raw.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (h6) return `${parseInt(h6[1], 16)},${parseInt(h6[2], 16)},${parseInt(h6[3], 16)}`;
  const h3 = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (h3) return `${parseInt(h3[1] + h3[1], 16)},${parseInt(h3[2] + h3[2], 16)},${parseInt(h3[3] + h3[3], 16)}`;
  const m = raw.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  return null;
}

// -- Footer -------------------------------------------------------------------

const Footer = ({ activeSection, appVersion, mapName, quickLinks = false, onOpenArticle, lastRealTool = null, footerReopenToken = null }) => {
  const barRef      = useRef(null);
  const traceRef    = useRef(null);
  const toolSpanRef = useRef(null);
  const rgbRef      = useRef(null);

  // ── Panel state (expanded / panelMode / activeArticle) ─────────────────────
  const {
    expanded, setExpanded,
    panelMode, setPanelMode,
    activeArticle, setActiveArticle,
  } = useFooterPanelState();

  const [logoAnimate, setLogoAnimate] = useState(false);

  // ── Active tool resolution ──────────────────────────────────────────────────
  const isFooterArticle = typeof activeSection === 'string' && activeSection.startsWith(FOOTER_PREFIX);
  const footerEntry     = isFooterArticle
    ? getFooterContent(activeSection.slice(FOOTER_PREFIX.length))
    : null;

  const tool = getTool(activeSection);

  // Footer articles have no toolRegistry entry by design. lastRealTool
  // (computed once in ForgeMapToolkit.jsx and shared with Banner and
  // FooterArticleTab) carries the last real tool forward so the status bar
  // keeps that tool's accent while an article tab is open.
  const effectiveTool = tool ?? (isFooterArticle ? lastRealTool : null);

  const toolLabel = effectiveTool?.label ?? footerEntry?.title ?? activeSection ?? '\u2014';
  rgbRef.current  = resolveColorVar(effectiveTool?.colorVar ?? null);

  // ── Sync --tab-color onto the footer element ────────────────────────────────
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (effectiveTool?.colorVar) {
      bar.style.setProperty('--tab-color', `var(${effectiveTool.colorVar})`);
    } else {
      bar.style.removeProperty('--tab-color');
    }
  }, [effectiveTool?.colorVar]);

  // ── Proximity wash (extracted hook) ────────────────────────────────────────
  useFooterProximity({
    barRef,
    traceRef,
    toolSpanRef,
    rgbRef,
    expanded,
    onCollapse: () => setExpanded(false),
  });

  // ── External re-open trigger (Back from a footer article) ──────────────────
  // The footer article's Back button lives outside this component and can't
  // reach `expanded` directly -- ForgeMapToolkit.jsx bumps footerReopenToken
  // whenever Back is pressed (see handleBackFromFooterArticle), this just
  // reacts to it. Guarded on != null so the initial mount (token starts
  // null) never force-opens the panel.
  useEffect(() => {
    if (footerReopenToken == null) return;
    setExpanded(true);
  }, [footerReopenToken, setExpanded]);

  // ── Logo draw animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expanded) { setLogoAnimate(false); return; }
    const t = setTimeout(() => setLogoAnimate(true), 300);
    return () => clearTimeout(t);
  }, [expanded]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Looks up the clicked action in footerContentRegistry and routes to either
  // the full article tab (quickLinks mode) or the preview card first.
  const handleNavAction = (action) => {
    const entry = getFooterContent(action);
    if (!entry) {
      console.warn('[Footer] no footerContentRegistry entry for action:', action);
      return;
    }
    if (quickLinks) {
      setExpanded(false);
      onOpenArticle?.(entry.id);
    } else {
      setActiveArticle(entry);
      setPanelMode('preview');
    }
  };

  // Navigates to the full article tab and collapses the panel.
  const handleReadMore = () => {
    if (!activeArticle) return;
    setExpanded(false);
    onOpenArticle?.(activeArticle.id);
  };

  const handlePreviewBack = () => {
    setPanelMode('nav');
    setActiveArticle(null);
  };

  const displayMap = mapName ? mapName.replace(/\.scmap$/i, '') : 'no map loaded';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {expanded && createPortal(
        <div className="ftr-backdrop" onClick={() => setExpanded(false)} aria-hidden="true" />,
        document.body
      )}

      <footer
        ref={barRef}
        className={`ftr-root${expanded ? ' ftr-root--expanded' : ''}`}
        onClick={() => !expanded && setExpanded(true)}
        aria-label="Footer — click to expand"
      >
        {/* Trace line (collapsed bar) */}
        <div ref={traceRef} className="ftr-trace" aria-hidden="true" />

        {/* Collapsed status register */}
        <div className="ftr-status" aria-hidden={expanded}>
          <div className="ftr-seg ftr-seg--ver"><span>v{appVersion || '1.0'}</span></div>
          <div className="ftr-sep" />
          <div className="ftr-seg ftr-seg--map"><span>{displayMap}</span></div>
          <div className="ftr-sep" />
          <div className="ftr-seg ftr-seg--tool">
            <span ref={toolSpanRef}>{toolLabel.toUpperCase()}</span>
          </div>
          <div className="ftr-sep" />
          <div className="ftr-seg ftr-seg--suite"><span>Forged Alliance Forever</span></div>
        </div>

        {/* Expanded panel */}
        <div className="ftr-panel" aria-hidden={!expanded}>

          {/* Traceline across top of panel */}
          <div className="ftr-panel-trace" aria-hidden="true" />

          <div className="ftr-panel-inner">

            {/* Left: header + stage (nav columns or article preview) */}
            <div className="ftr-left">

              <div className="ftr-panel-header">
                <div className="ftr-panel-headline">
                  <span className="ftr-panel-index">{effectiveTool?.index ?? '00'}</span>
                  <span className="ftr-panel-designation">{toolLabel}</span>
                  <div
                    className={`ftr-header-trace${expanded ? ' is-animating' : ''}`}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Stage: swaps between nav / preview; keyed so each switch re-animates */}
              <div className="ftr-stage" key={panelMode}>
                {panelMode === 'nav' && (
                  <FooterNav onNavAction={handleNavAction} />
                )}
                {panelMode === 'preview' && activeArticle && (
                  <FooterArticlePreview
                    title={activeArticle.title}
                    teaser={activeArticle.teaser}
                    accentWord={activeArticle.accentWord}
                    onReadMore={handleReadMore}
                    onBack={handlePreviewBack}
                  />
                )}
              </div>

              {/* Meta strip — pinned to the bottom of the left column */}
              <div className="ftr-meta">
                <span className="ftr-meta-item">v{appVersion || '1.0'}</span>
                <span className="ftr-meta-sep">·</span>
                <span className="ftr-meta-item">Electron · React · Vite</span>
                <span className="ftr-meta-sep">·</span>
                <span className="ftr-meta-item">© Seraphim-Noob</span>
              </div>

            </div>

            {/* Right: FAF logo trace */}
            <div className="ftr-logo-zone">
              <FafLogo animate={logoAnimate} />
              <div className="ftr-logo-wordmark">Forged Alliance Forever</div>
            </div>

          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
