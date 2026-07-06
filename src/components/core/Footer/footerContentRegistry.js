/**
 * footerContentRegistry — single source of truth for footer article metadata.
 *
 * Mirrors the shape of toolRegistry.js (../Home/Data/toolRegistry.js): a flat
 * array + lookup helper, no nesting.
 *
 * Each entry's `id` matches the `action` string used in Footer.jsx's NAV_COLS
 * (e.g. NAV_COLS[...].items[...].action) and doubles as the article slug --
 * i.e. content-src/footer/<id>.html, public/footer/content/<id>.html and
 * ForgeMapToolkit-Assets/footer/content/<id>.html all share this same name.
 *
 * Consumed by:
 *  - Footer.jsx          (handleNavAction -> getFooterContent(action))
 *  - FooterArticlePreview.jsx (title + teaser, Phase 2)
 *  - FooterContentViewer.jsx  (title + slug, already wired)
 *
 * Adding a new footer article:
 *  1. Add the nav entry's `action` id to NAV_COLS in Footer.jsx
 *  2. Add one entry below with the same id
 *  3. Create content-src/footer/<id>.html (Phase 3) and run the sync script (Phase 5)
 *
 * Field reference:
 *  - id:          action id from NAV_COLS, also used as the article slug
 *  - title:       shown in FooterArticlePreview headline and FooterContentViewer header
 *  - teaser:      2-3 sentence preview shown before "Read more" (placeholder until Phase 6)
 *  - accentWord:  (optional) exact substring within `title` to render in the
 *                 tool accent color (--tab-color), e.g. 'ForgeMapToolkit' or
 *                 just 'ForgeMap'. Omit to leave the title unaccented.
 */

export const FOOTER_CONTENT = [
  {
    id: 'about-fmt',
    title: 'About ForgeMapToolkit',
    teaser: 'What ForgeMapToolkit is, who it is for, and how it fits into the Forged Alliance Forever mapping ecosystem. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'ForgeMapToolkit',
  },
  {
    id: 'about-author',
    title: 'About the Author',
    teaser: 'A short introduction to who builds and maintains ForgeMapToolkit. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Author',
  },
  {
    id: 'contribute',
    title: 'How to Contribute',
    teaser: 'How to report issues, suggest features, or submit changes to the project. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Contribute',
  },
  {
    id: 'donate',
    title: 'Donate',
    teaser: 'Ways to support continued development of ForgeMapToolkit. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Donate',
  },
  {
    id: 'forgetools',
    title: 'ForgeTools',
    teaser: 'An overview of the ForgeTools companion project and how it relates to ForgeMapToolkit. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Forge',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    teaser: 'A running record of what has changed across recent ForgeMapToolkit releases. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Changelog',
  },
  {
    id: 'techstack',
    title: 'Tech Stack',
    teaser: 'The technologies ForgeMapToolkit is built on -- Electron, React, Vite and friends. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Tech',
  },
  {
    id: 'licenses',
    title: 'Licenses',
    teaser: 'License information for ForgeMapToolkit and the third-party libraries it depends on. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Licenses',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    teaser: 'A reference list of keyboard shortcuts available across the toolkit. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Shortcuts',
  },
  {
    id: 'docs',
    title: 'Documentation',
    teaser: 'Where to find in-depth documentation for each tool in the suite. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Documentation',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    teaser: 'A quick-start guide for first-time users of ForgeMapToolkit. Placeholder teaser -- final copy lands in Phase 6.',
    accentWord: 'Started',
  },
];

export const getFooterContent = (actionId) =>
  FOOTER_CONTENT.find((entry) => entry.id === actionId) ?? null;
