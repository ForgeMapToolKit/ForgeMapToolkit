/**
 * Help.jsx — Hilfe für den 3D Viewer, über HelpPanel (TAB_CONTRACT §7).
 *
 * Vorlage: Tabs/Emitter/Wreckage/Help.jsx. --tab-color kommt von .viewer3d-tab,
 * der Akzent wird also vererbt.
 *
 *   import { Viewer3DHelp, Viewer3DHelpButton } from './Help.jsx';
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const KV = ({ rows }) => (
  <div className="hc-kv">
    {rows.map(([k, v]) => (
      <div className="hc-kv__row" key={k}>
        <div className="hc-kv__key">{k}</div>
        <div className="hc-kv__val">{v}</div>
      </div>
    ))}
  </div>
);

const SectionOverview = () => (
  <div className="hc-section">
    <div className="hc-block">
      <p>
        A prop is judged in space, not on a swatch. The <strong>Layout</strong>{' '}
        workspace loads any number of Supreme Commander meshes with their
        albedo and stands them side by side on one shared floor ruled in
        ogrids, like Blender&rsquo;s viewport — so &ldquo;is this rock the
        right size next to that tank&rdquo; is answered by eye before the map
        is packed, not after. The <strong>Shading</strong> workspace picks one
        of those loaded objects and opens the Texture Editor&rsquo;s node
        graph on its albedo, painting the mesh live as you adjust hue,
        brightness or anything else in the graph.
      </p>
    </div>

    <div className="hc-block">
      <KV rows={[
        ['Ogrid', 'The unit a blueprint speaks. A 5 km map is 256 ogrids across, so one ogrid is nominally 19.5 m. Nominal — it is a map-scale convention, not a measurement.'],
        ['UniformScale', 'The blueprint field that shrinks the mesh. Every vanilla prop has one, median 0.05: the .scm is authored roughly twenty times oversized.'],
        ['Footprint', 'SizeX / SizeZ in the blueprint — what blocks pathing. Frequently left at the template 0.5 / 1 regardless of the object, so it is shown for information, not as a check.'],
        ['Pivot', 'Where (0,0,0) sits, marked by the accent cross. The mesh is not recentred: a wrong pivot is a defect worth seeing.'],
      ]} />
    </div>
  </div>
);

const SectionWorkflow = () => (
  <WorkflowSection
    label="Comparing and shading props"
    steps={[
      {
        title: 'Add objects in Layout',
        body: 'Browse the Props Library (pick several at once) or add a reference unit — tank, ACU, factory — from your own installation. Drop a loose .scm with its _albedo.dds for anything not in the library. Every object you add stands on the same floor, in the order you added it.',
      },
      {
        title: 'Set the scale, if one is loose',
        body: 'A dropped mesh has no blueprint and so no UniformScale. The presets under it cover the range vanilla uses (0.025 to 0.25). Skip this and the mesh stands about twenty times too tall.',
      },
      {
        title: 'Toggle and remove',
        body: 'Each object in the list has a visibility checkbox and a remove button — hide the reference to judge two props against each other instead, without losing either.',
      },
      {
        title: 'Switch to Shading to adjust one',
        body: 'Pick the object from the dropdown; the viewport isolates it while its node graph opens below, seeded from its own albedo. Every edit paints the mesh above live — no export needed to see it, though the output node can still write a DDS.',
      },
      {
        title: 'Read the numbers, then orbit',
        body: 'The size line under each object is its measured mesh extent after scaling. Drag to orbit, wheel to zoom, shift-drag or middle-drag to pan, Frame to refit.',
      },
    ]}
  />
);

const SectionLimits = () => (
  <div className="hc-section">
    <div className="hc-block">
      <p>
        What this view is not: the game. The lighting here is a neutral studio
        rig, and the blueprint&rsquo;s <span className="hc-tag">ShaderName</span> is
        read and shown but not applied. Vanilla props declare sixteen different
        shader names between them; approximating those is a later phase, and
        until it lands a confident-looking render would be a claim this tab
        cannot back.
      </p>
    </div>

    <div className="hc-block">
      <KV rows={[
        ['Not applied', 'Normal maps, specular and team-colour masks, the game shaders, LOD switching by distance.'],
        ['Approximated', 'Alpha cutout — enabled when the albedo has a meaningful alpha channel, so foliage cards read correctly.'],
        ['Exact', 'Geometry, UVs, UniformScale, the ogrid grid, the reference unit’s size.'],
        ['Rest pose', 'Units are drawn unskinned. Fine for a size reference; not a pose the game would show.'],
      ]} />
    </div>
  </div>
);

const SectionProblems = () => (
  <div className="hc-section">
    <div className="hc-block">
      <KV rows={[
        ['The prop dwarfs the tank',
          'A loose .scm carries no UniformScale. Set it under the object’s scale presets in the Objects list — vanilla props sit between 0.025 and 0.25, median 0.05.'],
        ['The mesh loads but is grey',
          'No albedo resolved. A library prop names its texture relative to its blueprint; if that .dds is not in the installation there is nothing to load. For a dropped mesh, drop the .dds alongside it.'],
        ['Foliage renders as solid cards',
          'The alpha cutout only switches on when the albedo actually carries alpha. An albedo whose alpha channel is fully opaque has no cutout to apply — that is the texture, not the viewer.'],
        ['Reference units are unavailable',
          'No Supreme Commander install path is configured. Set it in Settings; the reference meshes are read from your installation and are never shipped with the toolkit.'],
        ['A library prop will not load',
          'Four of the 334 stock prop blueprints (LavaSteam, some editor markers) are effect-only and point at a mesh that is not there. Nothing to fix on this side.'],
        ['Shading says to load an object first',
          'The Shading workspace adjusts an object that is already in Layout — it needs an albedo to seed its graph from. Add one in Layout, then switch workspaces.'],
      ]} />
    </div>
  </div>
);

/* Destinations for the Troubleshoot section's "I don't know how…" path. */
const HELP_LINKS = [
  { id: 'overview', label: 'Overview',       hint: 'What the viewer shows and the terms it uses — ogrid, UniformScale, footprint, pivot.' },
  { id: 'workflow', label: 'Workflow',       hint: 'The full pass: pick a source, set its scale, add a reference, read the numbers.' },
  { id: 'limits',   label: 'What It Shows',  hint: 'Which parts are exact, which are approximated, and which are not applied at all.' },
  { id: 'problems', label: 'Common Problems', hint: 'Oversized meshes, grey meshes, solid foliage, a disabled reference section.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: "I'm new here — what does this tab do?", sectionIds: ['overview', 'workflow'] },
  { id: 'wrong',  label: 'It looks wrong',   hint: 'Size, colour or shading is not what I expected.', sectionIds: ['problems', 'limits'] },
];

const SECTIONS = [
  { id: 'overview',     index: '01', label: 'Overview',        render: () => <SectionOverview /> },
  { id: 'workflow',     index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'limits',       index: '03', label: 'What It Shows',   render: () => <SectionLimits /> },
  { id: 'problems',     index: '04', label: 'Common Problems', render: () => <SectionProblems /> },
  {
    id: 'troubleshoot', index: '05', label: 'Troubleshooting',
    render: (nav) => (
      <TroubleshootSection {...nav} helpLinks={HELP_LINKS} helpCategories={HELP_CATEGORIES} contextLabel="3D Viewer" />
    ),
  },
];

export function Viewer3DHelp({ open, onClose }) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const active = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];
  return (
    <HelpConsole
      open={open}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelect={setActiveSection}
      onClose={onClose}
    >
      {active.render({ onNavigate: setActiveSection })}
    </HelpConsole>
  );
}

export function Viewer3DHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
