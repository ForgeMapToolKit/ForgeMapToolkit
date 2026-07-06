import React from 'react';
import { getFooterContent } from '../footerContentRegistry.js';
import FooterContentViewer from '../ContentViewer/FooterContentViewer.jsx';
import './FooterArticleTab.css';

// ═══════════════════════════════════════════════════════════════════════════════
// FooterArticleTab
//
// Thin wrapper that lets a footer article (changelog, licenses, docs, ...) be
// routed to like any other tab -- see TabRoutes.jsx's "footer:<slug>" catch-all.
// Looks up its own title from footerContentRegistry.js by slug and hands the
// rest off to FooterContentViewer, the same viewer Footer.jsx's old
// panelMode:'full' step used to render inline in the footer panel.
//
// --tab-color: footer articles have no toolRegistry entry of their own, so
// this themes itself off `lastRealTool` -- the same carry-over value Banner.jsx
// and Footer.jsx use (computed once in ForgeMapToolkit.jsx, passed down via
// tabProps). A local ref inside this component couldn't do the same job: this
// component only exists while a "footer:<slug>" id is active, so it mounts
// fresh with no memory of whatever tool was open immediately before -- the
// carry-over has to come from something that stays mounted across navigation.
// ForgeMapToolkit.jsx also resolves its data-active-theme to lastRealTool.id
// while a footer article is open, so the app-wide --current-accent layer
// (mega navbar indicator etc.) stays in sync with this component's local
// --tab-color instead of idling on the default theme.
//
// NOT YET WIRED -- later steps in the plan:
//  - The "Copy URL" share-link's color param and the "Open in Browser"
//    button are Step 3's job (FooterContentViewer.jsx itself).
// ═══════════════════════════════════════════════════════════════════════════════

function FooterArticleTab({ slug, onNavigateBack, lastRealTool }) {
  const entry = getFooterContent(slug);

  if (!entry) {
    return (
      <div className="fat-missing">
        <div className="fat-missing-title">Article not found</div>
        <div className="fat-missing-slug">No footerContentRegistry entry for &ldquo;{slug}&rdquo;.</div>
      </div>
    );
  }

  // Inline style is the sanctioned exception for --tab-color (TAB_CONTRACT §5):
  // it's genuinely dynamic here, not a fixed per-tab identity color.
  const accentStyle = lastRealTool ? {
    '--tab-color':       lastRealTool.color,
    '--tab-glow':        lastRealTool.glow,
    '--tab-glow-strong': lastRealTool.glowStrong,
  } : undefined;

  return (
    <div className="fat-root" style={accentStyle}>
      <FooterContentViewer
        slug={entry.id}
        title={entry.title}
        onClose={onNavigateBack}
      />
    </div>
  );
}

export default FooterArticleTab;
