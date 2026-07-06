/**
 * navColumns.js — static data for the footer nav grid.
 *
 * Pure data: no JSX, no imports. Each column has a label and a list of items.
 * Items have either:
 *   - action  : string → handled by handleNavAction in Footer.jsx
 *   - href    : string → rendered as an <a> tag
 *   - extern  : bool   → adds target="_blank" rel="noreferrer"
 */
export const NAV_COLS = [
  {
    label: 'Project',
    items: [
      { label: 'About ForgeMapToolkit', action: 'about-fmt' },
      { label: 'About the Author',      action: 'about-author' },
      { label: 'How to Contribute',     action: 'contribute' },
      { label: 'Donate',                action: 'donate' },
    ],
  },
  {
    label: 'Ecosystem',
    items: [
      { label: 'ForgeClient',    href: 'https://github.com/Seraphim-Noob/ForgeClient', extern: true },
      { label: 'ForgeTools',     action: 'forgetools' },
      { label: 'FAF Map Editor', href: 'https://github.com/FAForever/FAForeverMapEditor', extern: true },
      { label: 'FAF Discord',    href: 'https://discord.gg/hgvj6Af', extern: true },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Changelog',          action: 'changelog' },
      { label: 'Tech Stack',         action: 'techstack' },
      { label: 'Licenses',           action: 'licenses' },
      { label: 'Keyboard Shortcuts', action: 'shortcuts' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Documentation',  action: 'docs' },
      { label: 'Getting Started', action: 'getting-started' },
      { label: 'Report an Issue', href: 'https://github.com/ForgeMapToolKit/ForgeMapToolkit/issues', extern: true },
      { label: 'FAF Forums',      href: 'https://forum.faforever.com', extern: true },
    ],
  },
];
