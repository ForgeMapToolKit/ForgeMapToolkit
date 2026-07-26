/**
 * Symmetry Checker help — content + HelpConsole wiring in one file.
 *
 * Usage in SymmetryChecker.jsx:
 *   import { SymmetryHelp, SymmetryHelpButton } from './Help.jsx';
 *   <SymmetryHelpButton open={helpOpen} onClick={() => setHelpOpen(o => !o)} />
 *   <SymmetryHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
 *
 * --tab-color is set by .symmetrychecker-tab — accent inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview',  label: 'Overview',   hint: 'What the checker reads and why a map can look mirrored without being it.' },
  { id: 'workflow',  label: 'Workflow',   hint: 'Check → read the verdicts → drill into a layer → save the report.' },
  { id: 'modes',     label: 'Modes',      hint: 'The six mirrors, and what the detector actually scores.' },
  { id: 'layers',    label: 'Layers',     hint: 'The eight layers, and what "off" means for each one.' },
  { id: 'tolerance', label: 'Tolerance',  hint: 'Raw steps, world units, DXT noise, and the playable-area fold.' },
  { id: 'verdicts',  label: 'Verdicts',   hint: 'Symmetric, near-symmetric, asymmetric — where the line sits.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: 'What does this tab even do?',       sectionIds: ['overview', 'workflow'] },
  { id: 'setup',  label: 'Setting it up',    hint: 'Mirror mode and how strict to be.', sectionIds: ['modes', 'tolerance'] },
  { id: 'read',   label: 'Reading results',  hint: 'Layers, verdicts, offenders.',      sectionIds: ['layers', 'verdicts'] },
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
      <Block title="What the Symmetry Checker Does">
        <p>
          A competitive map has to be fair, and fair means every player gets the
          same terrain, the same reclaim and the same mass points. The editor's
          mirror tools get you most of the way, but a map that has been edited
          after mirroring — one ramp smoothed, one tree dragged, one mass point
          nudged — looks symmetric and is not. This tab compares the map against
          its own reflection and tells you exactly where it stopped matching.
        </p>
        <p>
          It is <strong>read-only</strong>. Nothing is written into the
          {' '}<Tag>.scmap</Tag> or the <Tag>_save.lua</Tag>; the only output is a
          text report you can save beside the map.
        </p>
      </Block>
      <Block title="Where the Data Comes From">
        <KV rows={[
          ['.scmap',    <>The binary map file: heightmap, terrain types, stratum masks, water masks, props and decals.</>],
          ['_save.lua', <>The scenario save: every marker (mass, hydro, spawns) and every pre-placed unit, civilians included.</>],
          ['One read',  'Both files are read once. Changing the mode or a tolerance re-judges the data already in memory — no second disk hit.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionWorkflow() {
  return (
    <Section>
      <WorkflowSection
        duration={2}
        steps={[
          { title: 'Check the map', body: 'Enter the map name and hit Check Symmetry. The map folder\'s .scmap and _save.lua are read in one pass.' },
          { title: 'Confirm the mirror', body: 'The detector scores all six mirrors and checks against the best fit. If it picked wrong — some maps are near-symmetric on two axes — click the mode you meant, or switch detection off and set it by hand.' },
          { title: 'Read the verdicts', body: 'The Findings step lists every layer with its verdict. Click a layer to see its deviation numbers and its worst offenders, with coordinates.' },
          { title: 'Find it on the map', body: 'The Deviation Map overlay shows where a layer breaks: a heatmap for the grids, a dot-and-ring pair for every entity with no partner. The dashed guides are the mirror axes.' },
          { title: 'Save the report', body: 'Copy the report or write it into the map folder as <MapName>_symmetry.txt.' },
        ]}
      />
    </Section>
  );
}

function SectionModes() {
  return (
    <Section>
      <Block title="The Six Mirrors">
        <KV rows={[
          ['Vertical │',   'Folds across a vertical axis — left half against right half.'],
          ['Horizontal ─', 'Folds across a horizontal axis — top half against bottom half.'],
          ['Point ⟳',      'A 180° rotation about the map centre. The most common FA layout, and what the placement tabs call "Diagonal".'],
          ['Diagonal ╲',   'A true reflection across the NW–SE diagonal.'],
          ['Diagonal ╱',   'A true reflection across the NE–SW diagonal.'],
          ['Quad ✚',       <>Both axes at once. Checked as two separate reflections that <em>both</em> have to hold, which is why a group of four props passes and a group of two does not.</>],
        ]} />
      </Block>
      <Block title="What Detection Scores">
        <p>
          Each mode is scored on a subsampled pass over the heightmap (weight
          0.7), the terrain-type grid (0.2) and the props (0.1). The heightmap
          dominates because it is the layer a mapper mirrors first — a map whose
          terrain is a clean point mirror but whose trees were placed by hand
          still <em>has</em> point symmetry, and reporting that honestly is the
          job. The percentage next to each mode is the share of compared samples
          that matched, so you can see when a map sits between two mirrors.
        </p>
      </Block>
    </Section>
  );
}

function SectionLayers() {
  return (
    <Section>
      <Block title="Grid Layers">
        <KV rows={[
          ['Heightmap',    <>Elevation, 16-bit per sample. The grid is <Tag>size+1</Tag> samples per side, so there is a true centre row and the fold is exact.</>],
          ['Terrain Type', 'The material byte per cell — footfall effects and pathing blockers. Compared exactly: a nearby id is a different material, so a tolerance would be meaningless.'],
          ['Texture Masks', 'Both stratum masks, four channels each, resampled to the terrain grid. This is what tells you the painting was mirrored, not just the terrain.'],
          ['Water Masks',  'Foam, flatness and depth bias, each at half the terrain resolution. Reported as one layer.'],
        ]} />
      </Block>
      <Block title="Entity Layers">
        <p>
          Props, decals, markers and units are matched by pairing: for every
          entity, is there one of the <em>same kind</em> at the mirrored position?
          Kind means the blueprint path for props, the decal texture for decals,
          the marker type for markers, and the unit id for units.
        </p>
        <KV rows={[
          ['Props',   'Everything inside the .scmap — trees, rocks, reclaim.'],
          ['Decals',  'Splats and normal decals, matched on texture and type.'],
          ['Markers', <>Mass points, hydrocarbons, spawns, camera and any other save.lua marker. <strong>Path nodes are excluded by default</strong> — the editor's auto-path pass lays that navigation grid out itself, it is routinely unmirrored on maps that are otherwise perfect, and on a 20 km map it outnumbers the real markers five to one. The finding always states how many were left out, and the Configuration step turns them back on.</>],
          ['Units',   <>Civilians and wrecks (<Tag>NEUTRAL_CIVILIAN</Tag>, <Tag>ARMY_17</Tag>) plus anything pre-placed for a playable army. The army is shown per offender but not required to match — a spawn-side unit legitimately belongs to a different army than its mirror.</>],
          ['On the axis', 'An entity standing on the mirror axis is its own partner. That is correct and counted as paired — it is the most common false alarm in a hand-rolled check.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionTolerance() {
  return (
    <Section>
      <Block title="Height Tolerance — game units">
        <p>
          Set in game units, the same unit the editor's elevation brush works in.
          Internally the heightmap is 16-bit and one raw step is
          {' '}<Tag>heightmapScale</Tag> — 1/128 of a unit on every shipped map —
          so the slider shows the raw-step equivalent beside it.
        </p>
        <p>
          Why this needs a tolerance at all: smoothing one ramp after mirroring
          moves thousands of samples by a fraction of a unit. On real maps that
          have been polished post-mirror, the heightmap can report most samples
          "off" at tolerance 0 while every deviation is under a tenth of a unit —
          invisible in game and irrelevant to fairness. The default of 0.05 units
          filters exactly that. Drag it to 0 when you want to know whether the
          mirror is <em>bit-exact</em>, which is a different and stricter question.
        </p>
      </Block>
      <Block title="Mask Tolerance — 0–255">
        <p>
          Governs the texture and water masks. Those are DXT-compressed, and lossy
          compression puts a step or two of noise on every block — a perfectly
          mirrored mask still differs from its reflection byte for byte. The
          default of 4 sees past compression; a mask layer that reports off at 4
          was genuinely painted differently.
        </p>
        <p>
          Terrain type ignores both sliders: it is compared exactly, because a
          nearby type id is a different material, not a near miss.
        </p>
      </Block>
      <Block title="World Tolerance — map units">
        <KV rows={[
          ['What it is', 'How far a mirror partner may sit from the exact mirrored position, in map units (1 unit = 1 ogrid cell).'],
          ['Why 0.5',    'The editor snaps placements to half-cells, so an exactly mirrored prop can still land a fraction off. Below ~0.25 you start reporting snapping as asymmetry.'],
          ['Match height too', 'Off by default. Props injected through a props.lua often carry y = 0 and let the engine correct them at load, so requiring Y to match would flag every one of them.'],
        ]} />
      </Block>
      <Block title="Fold on the playable area">
        <p>
          By default the fold sits at the centre of the full map grid. Maps with
          an inset playable area (a <Tag>RECTANGLE</Tag> smaller than the grid)
          are usually still mirrored about the full centre — but not always. If
          every layer reports asymmetric on a map you know is mirrored, try this
          toggle: it moves the fold onto the playable rectangle instead.
        </p>
      </Block>
    </Section>
  );
}

function SectionVerdicts() {
  return (
    <Section>
      <Block title="The Three Verdicts">
        <KV rows={[
          ['Symmetric',      'Every compared sample or entity matched inside the tolerance.'],
          ['Near-symmetric', 'Up to 0.1 % off. On a hand-mirrored map this is normal and invisible in game — worth knowing, not worth fixing.'],
          ['Asymmetric',     'More than 0.1 % off. Something was edited after the mirror, or was never mirrored.'],
          ['Not checked',    'The layer is absent from this map, or its data could not be decoded. Shown so a missing check is never mistaken for a passing one.'],
        ]} />
      </Block>
      <Block title="Reading a Failure">
        <p>
          Open the layer to get the numbers: how many samples were compared, how
          many were off, and the worst deviation with coordinates. For entity
          layers the offenders are listed with the position where a partner was
          expected and nothing was found — those coordinates go straight into the
          editor. The Deviation Map overlay shows the same thing spatially, which
          is usually faster for terrain: one bright patch means one edited hill.
        </p>
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
  { id: 'overview',  index: '01', label: 'Overview',   render: () => <SectionOverview /> },
  { id: 'workflow',  index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'modes',     index: '03', label: 'Modes',      render: () => <SectionModes /> },
  { id: 'layers',    index: '04', label: 'Layers',     render: () => <SectionLayers /> },
  { id: 'tolerance', index: '05', label: 'Tolerance',  render: () => <SectionTolerance /> },
  { id: 'verdicts',  index: '06', label: 'Verdicts',   render: () => <SectionVerdicts /> },
  { id: 'troubleshoot', index: '07', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function SymmetryHelp({ open, onClose, contextLabel, mapContext }) {
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

export function SymmetryHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
