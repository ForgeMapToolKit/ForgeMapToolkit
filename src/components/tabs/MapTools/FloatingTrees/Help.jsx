/**
 * Floating Trees help — content + HelpConsole wiring in one file.
 *
 * Usage in FloatingTrees.jsx:
 *   import { FloatingTreesHelp, FloatingTreesHelpButton } from './Help.jsx';
 *   <FloatingTreesHelpButton open={helpOpen} onClick={() => setHelpOpen(o => !o)} />
 *   <FloatingTreesHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
 *
 * --tab-color is set by .floatingtrees-tab — accent inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview',  label: 'Overview',   hint: 'Why a tree group floats even though the prop was placed correctly.' },
  { id: 'workflow',  label: 'Workflow',   hint: 'Scan → hotspots → fix the ground or the asset → re-scan.' },
  { id: 'measure',   label: 'Measurement', hint: 'What air gap, sink and origin drift actually measure.' },
  { id: 'tolerance', label: 'Tolerance',  hint: 'How much air is invisible, and why the slider has a floor.' },
  { id: 'fixing',    label: 'Fixing It',  hint: 'Flatten, re-place, or swap the asset — which one when.' },
  { id: 'limits',    label: 'Limits',     hint: 'What this tab cannot see, and what it deliberately ignores.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: 'What does this tab even do?',        sectionIds: ['overview', 'workflow'] },
  { id: 'read',   label: 'Reading results',  hint: 'The numbers and where the line is.', sectionIds: ['measure', 'tolerance'] },
  { id: 'act',    label: 'Acting on it',     hint: 'Fixes, and what is out of scope.',   sectionIds: ['fixing', 'limits'] },
];

function Section({ children }) { return <div className="hc-section">{children}</div>; }
function Block({ title, children }) {
  return <div className="hc-block">{title && <h3>{title}</h3>}{children}</div>;
}
function KV({ rows }) {
  return (
    <div className="hc-kv">
      {rows.map(([k, v], i) => (
        <div className="hc-kv__row" key={i}>
          <div className="hc-kv__key">{k}</div>
          <div className="hc-kv__val">{v}</div>
        </div>
      ))}
    </div>
  );
}
function Tag({ children }) { return <span className="hc-tag">{children}</span>; }

function SectionOverview() {
  return (
    <Section>
      <Block title="Why a Correctly Placed Prop Floats">
        <p>
          The editor puts a prop on the ground by snapping <strong>one</strong>
          {' '}point to the terrain: the prop's own origin. For a single tree that
          is the whole story and it works.
        </p>
        <p>
          A tree <em>group</em> is not a single tree. It is one prop holding a
          dozen or more trees, and the artist authored all of them standing on one
          flat plane. Snapping the origin therefore snaps the entire slab at once.
          The centre tree lands perfectly; the outer ones inherit the centre's
          elevation whether or not the ground out there is at that height.
        </p>
        <p>
          On flat terrain nobody notices. Along a cliff, a ramp or a crater rim
          the ground under the outer trees is metres lower — so they hang in the
          air — while the ones facing uphill get driven into the mountain. This
          tab measures the terrain under <em>each individual tree</em> and reports
          both.
        </p>
      </Block>
      <Block title="It Is Not Only Trees">
        <p>
          The same measurement applies to anything in the <Tag>.scmap</Tag> prop
          list. A wide rock on a slope has one origin and a footprint that leaves
          the ground on its low side, and it shows up the same way — labelled
          {' '}<Tag>single mesh</Tag> so you can tell the two cases apart, and
          switchable off in Configuration if you only care about groups.
        </p>
        <p>
          It is <strong>read-only</strong>. Nothing is written into the map; the
          only output is a text report you can save beside it.
        </p>
      </Block>
    </Section>
  );
}

function SectionWorkflow() {
  return (
    <Section>
      <WorkflowSection
        duration={3}
        steps={[
          { title: 'Scan the map', body: 'Enter the map name and hit Scan. The .scmap is read once, then every distinct prop blueprint is resolved to its LOD0 mesh and split into the objects it holds — a 20 km map is around a hundred thousand objects. The measurement itself is fast; the first scan of a session also pays for opening the game\'s asset archives, so expect a few seconds then and well under one afterwards. A map that references an asset which cannot be found is the slow case, because a miss has to look in every archive before giving up.' },
          { title: 'Start at the hotspots', body: 'Findings opens with places, not props. Nearby offenders are clustered, so one bad cliff edge is one row instead of twenty coordinates. Click a row to ring it on the map.' },
          { title: 'Check which asset is failing', body: 'Placements leads with By Asset. If one blueprint accounts for most of the findings, the fix is usually the asset — a smaller group, or single trees — rather than the terrain.' },
          { title: 'Fix in the editor', body: 'Flatten the ground under the group, move the prop off the edge, or swap it. See the Fixing It section for which applies.' },
          { title: 'Re-scan and save', body: 'Scan again to confirm, then copy the report or write it into the map folder as <MapName>_floating_trees.txt.' },
        ]}
      />
    </Section>
  );
}

function SectionMeasure() {
  return (
    <Section>
      <Block title="The Three Numbers">
        <KV rows={[
          ['Air gap  +', <>Space between the bottom of an object and the <em>lowest</em> terrain under its base footprint. This is what a player sees, and it is the floating criterion.</>],
          ['Sink  −',    <>How far terrain rises above the prop's ground plane. A trunk with no visible base, or a canopy poking out of a hillside.</>],
          ['Origin drift', <>How far the prop's stored height sits from the terrain under its own origin. Normally zero — the editor writes the snapped height. When it is not, the ground was edited <em>after</em> the prop was placed, and then the whole prop is off, centre tree included.</>],
        ]} />
      </Block>
      <Block title="Why the Footprint, Not a Point">
        <p>
          The terrain is sampled at the centre of each object's base
          <em> and around its rim</em>. A trunk standing on a step reads perfectly
          clean at its centre while showing daylight on its low side — a single
          sample misses exactly the case that is most visible in game.
        </p>
        <p>
          "Base footprint" means the lowest tenth of the object's height, not its
          whole hull. A leaning canopy would otherwise drag the measured centre
          metres away from the trunk it is supposed to be standing on.
        </p>
      </Block>
      <Block title="Artist Offsets Are Accounted For">
        <p>
          Artists routinely author a trunk reaching <em>below</em> the group's
          ground plane, so its roots stay buried on uneven terrain.
          {' '}<Tag>Dead01_Group2</Tag> sinks three of its twelve trunks that way.
          The air gap includes that offset, because the offset is genuinely part
          of why the tree does or does not show daylight.
        </p>
        <p>
          Sink deliberately ignores it and measures against the group plane
          instead: how deep an artist chose to bury a trunk is not the mapper's
          problem, and counting it reported all twelve trees of that group as
          defects on a perfectly fine map.
        </p>
      </Block>
    </Section>
  );
}

function SectionTolerance() {
  return (
    <Section>
      <Block title="One World Unit Is One Ogrid">
        <p>
          Everything here is in world units — the same unit the heightmap is
          sampled in, one unit per texel, roughly a tree-trunk width.
        </p>
        <KV rows={[
          ['under ~0.3', 'Only visible standing on the ground next to it. Most polished maps have some of this and it is not worth chasing.'],
          ['0.3 – 1.0',  'Visible if you look. The default of 0.5 sits here deliberately: high enough to ignore terrain noise, low enough to catch a real edge.'],
          ['over 1.0',   'Obvious from normal camera height. These are flagged in the error hue and are what the verdict reacts to.'],
        ]} />
      </Block>
      <Block title="Why the Slider Has a Floor">
        <p>
          The scan throws away everything under <Tag>0.15</Tag> before the result
          reaches the interface — a large map holds over a hundred thousand
          objects and keeping them all would be a pointless payload. That means a
          tolerance below the floor could not be answered honestly, so the slider
          stops there and says so when it clamps.
        </p>
      </Block>
      <Block title="Under Water">
        <p>
          Objects standing below the water plane are excluded by default: a gap
          nobody can see is not a defect. Turn them on when you are auditing a map
          whose water level you might still lower.
        </p>
      </Block>
    </Section>
  );
}

function SectionFixing() {
  return (
    <Section>
      <Block title="Which Fix Applies">
        <KV rows={[
          ['Many findings, one asset',   <>The group is too wide for that terrain. Swap it for a smaller group or single trees — one asset change clears every placement at once. This is why <strong>By Asset</strong> comes before the placement list.</>],
          ['Findings along one edge',    'A cliff or ramp the brush was dragged across. Either flatten a shelf for the props to stand on, or pull that stroke back from the edge.'],
          ['One prop, badly off',        'Move or delete it. Groups sitting half over a drop rarely look right at any elevation.'],
          ['Origin drift reported',      <>Do <em>not</em> reshape the terrain — the ground is current and the prop is stale. Re-drop the prop so the editor re-snaps it.</>],
          ['Buried but not floating',    'Usually harmless and sometimes intentional. Judge it in game before spending time on it — a partly sunk trunk reads as undergrowth.'],
        ]} />
      </Block>
      <Block title="A Note on Re-Scanning">
        <p>
          Changing the tolerance re-judges the scan already in memory — instant,
          no disk access. Changing the <em>map</em> needs a new scan. After an edit
          in the editor, scan again: the numbers come from the file on disk, not
          from what the editor currently has open.
        </p>
      </Block>
    </Section>
  );
}

function SectionLimits() {
  return (
    <Section>
      <Block title="What This Tab Cannot See">
        <KV rows={[
          ['Unresolved blueprints', <>A prop whose <Tag>.bp</Tag> or mesh cannot be found is not measured, and Configuration says so. Usually a missing install path in Settings, or a map-local asset that was deleted.</>],
          ['LOD0 only',            'Measurement uses the highest-detail mesh. A group whose lower LODs are arranged differently is judged by its LOD0 layout, which is what you see up close.'],
          ['Result cap',           'Very broken maps can exceed the scan\'s result cap. When that happens the counts are reported as a floor rather than a total, and the report says how many were cut.'],
          ['Mirror ambiguity',     'Whether a mesh\'s local X/Z map onto world X/Z unmirrored is not provable from the data — all four variants score within 2 % of each other, because terrain roughness dominates. The natural reading is used. A mirror could reshuffle which tree in a group gets named; it cannot change whether the prop has a problem.'],
        ]} />
      </Block>
      <Block title="What It Deliberately Ignores">
        <KV rows={[
          ['Decals and markers',  'Neither has geometry standing on the ground. Use the Symmetry Checker for those.'],
          ['Units and wrecks',    'Placed through the scenario save, not the prop list, and the engine grounds them itself at load.'],
          ['Slope',              'A tree standing straight out of a 40° slope is not measured as a defect — it touches the ground, it just looks odd. That is an aesthetic call, not a geometric one.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionTroubleshoot({ onNavigate, contextLabel, mapContext }) {
  return (
    <Section>
      <TroubleshootSection
        contextLabel={contextLabel}
        mapContext={mapContext}
        helpLinks={HELP_LINKS}
        helpCategories={HELP_CATEGORIES}
        onNavigate={onNavigate}
      />
    </Section>
  );
}

const SECTIONS = [
  { id: 'overview',  index: '01', label: 'Overview',    render: () => <SectionOverview /> },
  { id: 'workflow',  index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'measure',   index: '03', label: 'Measurement', render: () => <SectionMeasure /> },
  { id: 'tolerance', index: '04', label: 'Tolerance',   render: () => <SectionTolerance /> },
  { id: 'fixing',    index: '05', label: 'Fixing It',   render: () => <SectionFixing /> },
  { id: 'limits',    index: '06', label: 'Limits',      render: () => <SectionLimits /> },
  { id: 'troubleshoot', index: '07', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function FloatingTreesHelp({ open, onClose, contextLabel, mapContext }) {
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
      {active.render({ onNavigate: setActiveSection, contextLabel, mapContext })}
    </HelpConsole>
  );
}

export function FloatingTreesHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
