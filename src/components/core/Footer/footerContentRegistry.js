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
 *  - teaser:      2-3 sentence preview shown before "Read more"
 *  - accentWord:  (optional) exact substring within `title` to render in the
 *                 tool accent color (--tab-color), e.g. 'ForgeMapToolkit' or
 *                 just 'ForgeMap'. Omit to leave the title unaccented.
 *
 * Note: 'shortcuts' still carries a placeholder teaser. The article body
 * itself is still demo content proving out the fcv-* markup, not the real
 * keybinding list, so a final teaser doesn't have anything real to summarize
 * yet either.
 */

export const FOOTER_CONTENT = [
  {
    id: 'about-fmt',
    title: 'About ForgeMapToolkit',
    teaser: 'What ForgeMapToolkit is for and how a handful of Python scripts for wreckage placement grew into a 15 tab toolkit for advanced, atmosphere focused Supreme Commander mapping.',
    accentWord: 'ForgeMapToolkit',
  },
  {
    id: 'about-author',
    title: 'About the Author',
    teaser: 'Seraphim-noob\'s path through the FAF community, from a first game in 2013 to joining the trainer team and the FAF Association, and how that led into building ForgeMapToolkit.',
    accentWord: 'Author',
  },
  {
    id: 'contribute',
    title: 'How to Contribute',
    teaser: 'How to set up ForgeMapToolkit locally, what the TRACE design system expects from any UI change, and the current state of contributing to an early, mostly solo project.',
    accentWord: 'Contribute',
  },
  {
    id: 'donate',
    title: 'Donate',
    teaser: 'ForgeMapToolkit is free and stays that way. An overview of the optional ways to support development.',
    accentWord: 'Donate',
  },
  {
    id: 'changelog',
    title: 'Changelog',
    teaser: 'There is no changelog yet. Why that is, and when entries here will start.',
    accentWord: 'Changelog',
  },
  {
    id: 'techstack',
    title: 'Tech Stack',
    teaser: 'The technologies ForgeMapToolkit is built on, Electron, React and Vite, why each was chosen, and the key libraries doing the heavy lifting across its tools.',
    accentWord: 'Tech',
  },
  {
    id: 'licenses',
    title: 'Licenses',
    teaser: 'License information for ForgeMapToolkit itself and for the third-party libraries and bundled assets it depends on.',
    accentWord: 'Licenses',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    teaser: 'A reference list of keyboard shortcuts available across the toolkit. Placeholder teaser -- final copy lands once the real shortcut list replaces the current demo content.',
    accentWord: 'Shortcuts',
  },
  {
    id: 'docs',
    title: 'Documentation',
    teaser: 'Every tab has its own help console covering exactly how that tool is meant to be used. Where to find it and how it is organized.',
    accentWord: 'Documentation',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    teaser: 'Set your game paths, scan the libraries, and jump into whichever tab you want to start with. A three step quick-start for first-time users.',
    accentWord: 'Started',
  },
];

export const getFooterContent = (actionId) =>
  FOOTER_CONTENT.find((entry) => entry.id === actionId) ?? null;
