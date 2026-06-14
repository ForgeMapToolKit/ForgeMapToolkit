/**
 * Wreckage_help.jsx
 *
 * Wreckage help modal — all content + HelpConsole wiring in one file.
 *
 * Usage in Wreckage.jsx:
 *
 *   import { WreckageHelp, WreckageHelpButton } from './Wreckage_help';
 *
 *   const [helpOpen, setHelpOpen] = useState(false);
 *
 *   <WreckageHelpButton open={helpOpen} onClick={() => setHelpOpen(o => !o)} />
 *   <WreckageHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
 *
 * --tab-color is already set by .wr-tab — accent colour inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../shared/help-console/HelpConsole.jsx';
import {
  WorkflowSection,
  TroubleshootSection,
} from '../../../shared/help-console/sections/index.js';

/* ── Content primitives (hc-* classes defined in HelpConsole.css) ── */

/** Outer section wrapper — stacks Block children with xl gap */
function Section({ children }) {
  return <div className="hc-section">{children}</div>;
}

/** Groups one h3 heading with its directly following content */
function Block({ title, children }) {
  return (
    <div className="hc-block">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

/** Key/value reference table */
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

/** Inline monospace badge */
function Tag({ children }) {
  return <span className="hc-tag">{children}</span>;
}

/* ════════════════════════════════════════════════════════════════
   SECTIONS
   ════════════════════════════════════════════════════════════════ */

/* 01 — TAB REPLICA */
function SectionReplica() {
  return (
    <Section>
      <Block title="Interface Replica">
        <p style={{ fontStyle: 'italic', opacity: 0.5 }}>
          The interactive UI replica will be embedded here. It reflects the
          Wreckage WorkspaceConsole layout for quick visual reference.
        </p>
        <div style={{
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: 3,
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.18)',
        }}>
          REPLICA COMPONENT SLOT
        </div>
      </Block>
    </Section>
  );
}

/* 02 — OVERVIEW */
function SectionOverview() {
  return (
    <Section>
      <Block title="What Wreckage Does">
        <p>
          Wreckage is the prop-placement layer of ForgeMap. It lets you scatter
          destructible or decorative assets across the map — wreckages, rocks,
          cliffs, foliage — with precise control over density, rotation,
          randomisation, and mirror symmetry.
        </p>
        <p>
          Each wreckage type is configured as a <Tag>Unit</Tag> entry. Units are
          combined into a placement run and written to the map's scenario script.
        </p>
      </Block>

      <WorkflowSection
        label="Typical Workflow"
        steps={[
          { title: 'Select a brush zone',       body: 'Pick a RECT, POLY, or FULL brush on the Canvas. FULL covers the entire map.' },
          { title: 'Add Unit entries',           body: 'Open the unit library and click a row to add it to the current run.' },
          { title: 'Configure per-unit props',   body: 'Set density, scale range, rotation range, and cluster radius for each unit.' },
          { title: 'Choose a mirror mode',       body: 'Pick NONE, X, Y, XY, POINT, or QUAD_ROT to match your map\'s symmetry.' },
          { title: 'Assign an Emitter',          body: 'Optional — link a height-map layer to bias placement by terrain elevation.' },
          { title: 'Preview, iterate, generate', body: 'Check the canvas preview, adjust settings, then click GENERATE to write output files.' },
        ]}
      />

      <Block title="Key Concepts">
        <KV rows={[
          ['Unit',    'A single asset type with its own density/rotation settings.'],
          ['Brush',   'The rectangular or polygon zone where units are placed.'],
          ['Emitter', 'A height-map reference that biases unit placement by elevation.'],
          ['Run',     'One full placement pass — all units, one mirror mode, one brush.'],
          ['Seed',    'RNG seed. Same seed + same config = reproducible layout.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 03 — CONFIGURATION */
function SectionConfiguration() {
  return (
    <Section>
      <Block title="Global Settings">
        <KV rows={[
          ['Seed',           'Integer. Controls randomisation. Change for a different layout, fix for reproducible results.'],
          ['Density Scale',  'Float 0–10. Multiplies all per-unit density values globally.'],
          ['Height Min/Max', 'Clamp placement to an elevation range (uses terrain height map).'],
          ['Margin',         'Border padding (oefas units) — keeps props away from map edges.'],
        ]} />
      </Block>

      <Block title="Per-Unit Properties">
        <KV rows={[
          ['ID',            'Blueprint path string. E.g. /env/common/props/rocks/rock01_prop.bp'],
          ['Density',       'Expected props per 100×100 oefas area.'],
          ['Scale Min/Max', 'Random scale range. 1.0 = native size.'],
          ['Rot Min/Max',   'Rotation range in degrees. 0–360 for fully random.'],
          ['Rot Snap',      'Snap rotation to N-degree increments (0 = off).'],
          ['Cluster R',     'Cluster radius. Props group within this radius when > 0.'],
          ['Weight',        'Relative probability when multiple units share a brush.'],
          ['Enabled',       'Toggle unit without deleting configuration.'],
        ]} />
      </Block>

      <Block title="Brush Settings">
        <KV rows={[
          ['Mode',        <><Tag>RECT</Tag> · <Tag>POLY</Tag> · <Tag>FULL</Tag></>],
          ['Rect X/Y',    'Top-left corner of the rectangular brush in map coordinates.'],
          ['Rect W/H',    'Width and height of the rectangular brush.'],
          ['Poly Points', 'Comma-separated coordinate pairs for a polygon brush.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 04 — UNITS & MARKERS */
function SectionUnits() {
  return (
    <Section>
      <Block title="Unit Library">
        <p>
          The unit library lists available blueprint paths grouped by asset category
          (rocks, trees, foliage, wrecks, structures). Click a row to add it to the
          current run. Use the filter bar to search by name or path fragment.
        </p>
      </Block>

      <Block title="Unit Card Controls">
        <KV rows={[
          ['▲ / ▼ arrows',    'Reorder units within the run (affects layering in output).'],
          ['⊕ duplicate',     'Clone card with identical settings — useful for small variations.'],
          ['× remove',        'Delete unit from this run.'],
          ['Collapse toggle', 'Fold the card to a one-line summary to save vertical space.'],
        ]} />
      </Block>

      <Block title="Marker Types">
        <KV rows={[
          [<Tag>MASS</Tag>,    'Mass extractor anchor. Placed at precise coordinates, not scattered.'],
          [<Tag>SPAWN</Tag>,   'Army spawn point. Orientation matters — use Rot fixed to face inward.'],
          [<Tag>NAVMESH</Tag>, 'Invisible exclusion volume. Blocks AI pathfinding in a radius.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 05 — CANVAS */
function SectionCanvas() {
  return (
    <Section>
      <Block title="Preview Canvas">
        <p>
          The canvas gives a real-time top-down preview of current placement.
          It updates after each config change (debounced 300 ms).
        </p>
      </Block>

      <Block title="Interaction">
        <KV rows={[
          ['Scroll wheel',     'Zoom in / out around cursor position.'],
          ['Click + drag',     'Pan the view.'],
          ['Right-click drag', 'Draw / resize the RECT brush interactively.'],
          ['Shift + click',    'Add vertex to POLY brush.'],
          ['Double-click',     'Close POLY brush and commit.'],
          ['G key',            'Toggle grid overlay.'],
          ['R key',            'Reset zoom and pan to fit full map.'],
        ]} />
      </Block>

      <Block title="Coordinate System">
        <KV rows={[
          ['Origin',   'Top-left corner of the map (0, 0).'],
          ['X-axis',   'Increases rightward (east).'],
          ['Y-axis',   'Increases downward (south). Same as FAF internal convention.'],
          ['Unit',     'Oefas (1 oefa = 1 game unit ≈ 0.1 m).'],
          ['Map size', 'Displayed in the status bar; typical values 256–2048 oefas.'],
        ]} />
      </Block>

      <Block title="Rotation Convention">
        <p>
          0° points north (−Y direction). Rotation is clockwise. 90° = east.
          Mirror modes may apply additional transforms — see Mirror Modes.
        </p>
      </Block>
    </Section>
  );
}

/* 06 — MIRROR MODES */
function SectionMirror() {
  return (
    <Section>
      <Block title="Symmetry System">
        <p>
          Mirror modes duplicate placements across one or more axes automatically.
          The primary placement (your brush zone) is always quadrant 1; mirrors
          are derived and written to the output together.
        </p>
      </Block>

      <Block title="Available Modes">
        <KV rows={[
          [<Tag>NONE</Tag>,     'No mirroring. Brush zone is the full placement area.'],
          [<Tag>X</Tag>,        'Mirror across the vertical centre line (left ↔ right).'],
          [<Tag>Y</Tag>,        'Mirror across the horizontal centre line (top ↔ bottom).'],
          [<Tag>XY</Tag>,       'Both axes — 4-fold symmetry. Brush covers one quadrant.'],
          [<Tag>POINT</Tag>,    '180° rotational symmetry around map centre.'],
          [<Tag>QUAD_ROT</Tag>, '90° rotational symmetry — 4 copies rotated 0/90/180/270°.'],
        ]} />
      </Block>

      <Block title="Rotation Handling in Mirror">
        <p>
          When a unit is mirrored, its rotation is automatically flipped to maintain
          visual coherence. Disable with <Tag>rot-inherit</Tag> in the unit card
          if you prefer a raw copy.
        </p>
      </Block>
    </Section>
  );
}

/* 07 — EMITTER LINK */
function SectionEmitter() {
  return (
    <Section>
      <Block title="Emitter Assignment">
        <p>
          An emitter is a height-map weight layer that biases where props are placed.
          High emitter values = higher placement probability at that pixel.
        </p>
      </Block>

      <WorkflowSection
        label="Assigning an Emitter"
        steps={[
          { title: 'Open the Emitter panel',     body: 'Press E or click the emitter toolbar icon.' },
          { title: 'Select or paint a layer',    body: 'Choose an existing emitter layer or paint a new weight map.' },
          { title: 'Reference in the unit card', body: <span>Set the <Tag>Emitter</Tag> field to the layer name.</span> },
          { title: 'Tune strength',              body: <span>Adjust <Tag>Emitter Strength</Tag> — 0 ignores it, 1 applies full bias.</span> },
        ]}
      />

      <Block title="Emitter Properties">
        <KV rows={[
          ['Layer Name',       'String ID referencing a named emitter layer.'],
          ['Emitter Strength', '0–1. How strongly the emitter weight biases density.'],
          ['Invert',           'Flip the weight map — place on low-value areas instead.'],
          ['Blur Radius',      'Smooth the weight map before sampling (0 = sharp).'],
        ]} />
      </Block>
    </Section>
  );
}

/* 08 — EXPORT */
function SectionExport() {
  return (
    <Section>
      <Block title="Generate Files">
        <p>
          Clicking <Tag>GENERATE</Tag> writes placement data to the map's scenario
          script directory. Existing entries for the current run ID are replaced;
          other run IDs are left intact.
        </p>
      </Block>

      <Block title="Output Files">
        <KV rows={[
          ['_scenario.lua', 'Updated with wreckage prop group tables.'],
          ['_wreckage.lua', 'Separate file per run, included by the scenario script.'],
          ['_preview.png',  'Optional raster preview — enable in Export Settings.'],
        ]} />
      </Block>

      <Block title="Export Settings">
        <KV rows={[
          ['Run ID',          'Unique string per placement run. Used as table key in output.'],
          ['Overwrite mode',  <><Tag>REPLACE</Tag> or <Tag>MERGE</Tag>. Replace clears old run; Merge appends.</>],
          ['Float precision', 'Decimal places for coordinates in .lua output (default 4).'],
          ['Include preview', 'Write a _preview.png alongside the .lua files.'],
        ]} />
      </Block>

      <TroubleshootSection
        label="Common Errors"
        items={[
          { q: 'No units configured',  a: 'Add at least one unit card before generating.' },
          { q: 'Brush out of bounds',  a: 'Rect or poly brush exceeds map extents — resize or switch to FULL mode.' },
          { q: 'Density = 0',          a: 'No props will be placed. Check both per-unit density and the global Density Scale.' },
          { q: 'Missing emitter ref',  a: "The unit references a layer name that doesn't exist — check spelling against the emitter panel." },
        ]}
      />
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════════
   SECTIONS REGISTRY
   ════════════════════════════════════════════════════════════════ */

const SECTIONS = [
  { id: 'replica',       index: '01', label: 'Tab Replica',     render: () => <SectionReplica /> },
  { id: 'overview',      index: '02', label: 'Overview',        render: () => <SectionOverview /> },
  { id: 'configuration', index: '03', label: 'Configuration',   render: () => <SectionConfiguration /> },
  { id: 'units',         index: '04', label: 'Units & Markers', render: () => <SectionUnits /> },
  { id: 'canvas',        index: '05', label: 'Canvas',          render: () => <SectionCanvas /> },
  { id: 'mirror',        index: '06', label: 'Mirror Modes',    render: () => <SectionMirror /> },
  { id: 'emitter',       index: '07', label: 'Emitter Link',    render: () => <SectionEmitter /> },
  { id: 'export',        index: '08', label: 'Export',          render: () => <SectionExport /> },
];

/* ════════════════════════════════════════════════════════════════
   EXPORTS
   ════════════════════════════════════════════════════════════════ */

export function WreckageHelp({ open, onClose }) {
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
      {active.render()}
    </HelpConsole>
  );
}

export function WreckageHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
