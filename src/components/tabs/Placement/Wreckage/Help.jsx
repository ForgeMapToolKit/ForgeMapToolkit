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
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import {
  WorkflowSection,
  TroubleshootSection,
  CodeSection,
} from '../../../Shared/Ui/HelpPanel/Sections/index.js';

/* ── Destinations for the Troubleshoot section's "I don't know how…"
   path — one sentence per Help Register section, no separate content. ── */
const HELP_LINKS = [
  { id: 'overview',      label: 'Overview',          hint: 'What the Wreckage generator does and the core terms (Map Name, Unit Card, Coordinate, Emitter, Mirror).' },
  { id: 'workflow',      label: 'Workflow',          hint: 'The full pass: configure map → add emitters & units → place coordinates → generate.' },
  { id: 'configuration', label: 'Configuration',     hint: 'Map name & size, maps/emitter folders, emitter rows, matching mode.' },
  { id: 'units',         label: 'Unit Cards',        hint: 'Unit ID format, colour, categories, coordinates (X/Z/Y and rotation).' },
  { id: 'canvas',        label: 'Preview & Canvas',  hint: 'Auto-loaded preview, click-to-place, coordinate system, rotation in radians.' },
  { id: 'mirror',        label: 'Mirror Modes',      hint: 'No Mirror / Diagonal / Horizontal / Vertical and their coordinate formulas.' },
  { id: 'emitter',       label: 'Emitter Assignment', hint: 'Category matching modes (Smart 3-tier / Simple Union / Last Category) and the fallback.' },
  { id: 'export',        label: 'Export',            hint: 'What Generate writes, how props.lua reaches the .scmap, export settings.' },
];

/* ── Narrowing questions for the "I don't know how…" path — instead of
   dumping all 9 Help Register sections in one flat list, the user first
   picks the area their confusion is actually in, then sees only the 2-3
   sections relevant to it. `sectionIds` reference HELP_LINKS ids above. ── */
const HELP_CATEGORIES = [
  {
    id: 'orient',
    label: 'Getting oriented',
    hint: "I'm new here — what does Wreckage even do?",
    sectionIds: ['overview', 'workflow'],
  },
  {
    id: 'setup',
    label: 'Setting up a run',
    hint: 'Map name, emitter blueprints, unit properties, mirror symmetry.',
    sectionIds: ['configuration', 'units', 'mirror'],
  },
  {
    id: 'place',
    label: 'Placing on the canvas',
    hint: 'Clicking coordinates, reading the preview, assigning emitters by category.',
    sectionIds: ['canvas', 'emitter'],
  },
  {
    id: 'finish',
    label: 'Generating output',
    hint: 'What Generate writes, how props.lua reaches the .scmap, export settings.',
    sectionIds: ['export'],
  },
];

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

/* 01 — OVERVIEW */
function SectionOverview() {
  return (
    <Section>
      <Block title="What the Wreckage Generator Does">
        <p>
          The Wreckage tab places destroyed-unit wreckages — each with an
          attached particle emitter (smoke, fire) — onto your map. You point at
          a map preview, click where each wreckage should sit, and the tool
          writes the game files that spawn it in-game.
        </p>
        <p>
          For every placed coordinate it generates a marker <Tag>_prop.bp</Tag>
          {' '}and a <Tag>_script.lua</Tag> that spawns the unit, turns it into a
          wreckage, and attaches an emitter. All placements are collected into a
          {' '}<Tag>props.lua</Tag> chunk that is injected straight into your
          {' '}<Tag>.scmap</Tag> — no external tools like BrewMapTool needed.
        </p>
      </Block>

      <Block title="Key Concepts">
        <KV rows={[
          ['Map Name',    <>The map folder inside <Tag>/maps</Tag>, e.g. <Tag>Hades_Dust.v0002</Tag>. Every output path is built from it.</>],
          ['Unit Card',   'One wreckage type — its blueprint ID, canvas colour, category tags, and its list of placed coordinates.'],
          ['Coordinate',  'One placement (X / Z from a canvas click, plus Y height and rotation). One wreckage is spawned per coordinate.'],
          ['Emitter',     'A particle-effect .bp attached to each wreckage. Multiple emitters = random variety per wreckage.'],
          ['Mirror Mode', 'How many coordinates one click makes — one, or an automatic symmetric pair.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 02 — WORKFLOW — the centerpiece route */
function SectionWorkflow() {
  return (
    <Section>
      <WorkflowSection
        duration={5}
        steps={[
          { title: 'Configure the map',      body: 'Enter the Map Name (e.g. Hades_Dust.v0002). Map Size is auto-read from save.lua — no manual input. Maps & Emitter folders are set once in Settings.' },
          { title: 'Add emitters & units',   body: 'Add emitter paths via the Library, then create one Unit Card per wreckage type and fill its blueprint ID (Library or manual).' },
          { title: 'Place coordinates',       body: 'The preview loads automatically from the .scmap. Pick a mirror mode, select a unit card, then click the canvas to drop wreckage positions.' },
          { title: 'Generate files',          body: 'GENERATE FILES writes every _prop.bp + _script.lua, injects a props.lua chunk into the .scmap, and repacks — all in one click.' },
        ]}
      />
    </Section>
  );
}

/* 03 — CONFIGURATION */
function SectionConfiguration() {
  return (
    <Section>
      <Block title="Map Info">
        <KV rows={[
          ['Map Name', <>Exact folder name in <Tag>/maps</Tag>, format <Tag>MapName.vXXXX</Tag>. Case-sensitive; omitting <Tag>.v0001</Tag> auto-appends it. A wrong name breaks every output path.</>],
          ['Map Size', <>Auto-detected from <Tag>save.lua</Tag> — no manual input. 256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km; non-power-of-2 (e.g. 768 = 15×15 km) is supported. Falls back to 1024 if the name is wrong or save.lua is missing.</>],
        ]} />
      </Block>

      <Block title="Folders (set once in Settings)">
        <KV rows={[
          ['Maps Folder',   'Absolute path to your /maps directory. Required — generation fails without it. Persists across sessions.'],
          ['Emitter Folder', <>Source folder for emitter <Tag>.bp</Tag> files. Optional — without it wreckages generate but have no effect. Files copy to <Tag>env/props/emitter/wreckages/</Tag>.</>],
        ]} />
      </Block>

      <Block title="Emitters & Matching">
        <KV rows={[
          ['Emitter Row',    <>One in-game <Tag>.bp</Tag> path. Multiple rows = one picked at random per wreckage for variety. Use the Library button — typing paths is error-prone.</>],
          ['Matching Mode',  <>How emitters map to a unit's categories: <Tag>Smart (3-Tier)</Tag>, <Tag>Simple Union</Tag>, or <Tag>Last Category Only</Tag> — see Emitter Assignment.</>],
          ['Generate README', 'Optional plain-text summary of the whole run written next to the map.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 04 — UNITS */
function SectionUnits() {
  return (
    <Section>
      <Block title="Unit Card">
        <p>
          Each Unit Card is one wreckage type with its own blueprint ID, canvas
          colour, optional category tags, and coordinate list. Add one card per
          unique unit on the map — typically 2–6. Only the selected card receives
          new coordinates from canvas clicks.
        </p>
      </Block>

      <Block title="Unit ID">
        <p>
          The blueprint ID: <Tag>2-letter faction</Tag> + <Tag>1 type letter</Tag>
          {' '}+ <Tag>4-digit code</Tag>. Use the Library to search by name instead
          of memorising IDs — a wrong ID means the game can't find the blueprint,
          so no wreckage spawns.
        </p>
        <KV rows={[
          ['Faction', <><Tag>UE</Tag> UEF · <Tag>UA</Tag> Aeon · <Tag>UR</Tag> Cybran · <Tag>XS</Tag> Seraphim</>],
          ['Type',    <><Tag>L</Tag> Land · <Tag>A</Tag> Air · <Tag>S</Tag> Naval · <Tag>B</Tag> Building</>],
          ['Tech',    <><Tag>01/11</Tag> T1 · <Tag>02</Tag> T2 · <Tag>03</Tag> T3 · <Tag>04</Tag> Experimental</>],
          ['Example', <><Tag>UEL0203</Tag> = UEF · Land · T2 → Riptide</>],
        ]} />
      </Block>

      <Block title="Colour & Categories">
        <KV rows={[
          ['Colour Dot', 'Canvas marker colour — purely visual, no effect on output. Use distinct colours per unit. Also shown in the legend.'],
          ['Categories', <>Optional tags (Land, Air, T3, Experimental…) that drive emitter matching. Must match the names in the Emitter-Category Assignment overlay exactly. Order matters in <Tag>Last Category Only</Tag> mode.</>],
        ]} />
      </Block>

      <Block title="Coordinates">
        <KV rows={[
          ['X / Z',     'Set by canvas clicks — also editable in the coordinate list.'],
          ['Y (height)', <>Default <Tag>26</Tag>, written per coordinate into the spawn script. Adjust if wreckages sink into or float above uneven terrain.</>],
          ['Rotation',  <>Heading / Pitch / Roll in radians — see Preview &amp; Canvas. Defaults are correct for all standard wreckages.</>],
          ['Delete',    'Click × on a row to remove one coordinate; Delete All clears the unit.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 05 — PREVIEW & CANVAS */
function SectionCanvas() {
  return (
    <Section>
      <Block title="Map Preview">
        <p>
          The preview image is read automatically from the <Tag>.scmap</Tag> the
          moment a valid Map Name is set (a spinner shows while it extracts). You
          only need to upload manually to override it, or when the .scmap doesn't
          exist yet — any <Tag>PNG</Tag>, <Tag>JPG</Tag> or <Tag>WEBP</Tag> works.
          {' '}<Tag>Delete Preview</Tag> clears it; auto-load runs again next time.
        </p>
      </Block>

      <Block title="Canvas Interaction">
        <KV rows={[
          ['Click empty',   'Adds a coordinate for the selected unit card.'],
          ['Click marker',  'Deletes that coordinate — and its mirror pair, if any.'],
          ['Selection',     'Only the selected unit card receives new coordinates.'],
          ['Legend',        'Lists each unit with its colour and coordinate count (read-only).'],
        ]} />
      </Block>

      <Block title="Coordinate System">
        <p>
          Supreme Commander uses a <Tag>left-handed</Tag> system. Origin
          {' '}<Tag>(0, 0)</Tag> is the NW corner. <Tag>X</Tag> runs West→East,
          {' '}<Tag>Z</Tag> runs North→South, both scaled by Map Size. <Tag>Y</Tag>
          {' '}is height (default 26). All rotation is in radians.
        </p>
      </Block>

      <Block title="Rotation (radians)">
        <KV rows={[
          ['Heading', <>Yaw around Y. Default <Tag>math.pi</Tag> (180° = South) — standard wreckage facing. 0 = North, <Tag>math.pi/2</Tag> ≈ East.</>],
          ['Pitch',   <>Forward tilt around X. Default <Tag>0.0</Tag> (flat). Positive = nose down, negative = nose up.</>],
          ['Roll',    <>Side tilt around Z. Default <Tag>math.pi</Tag> (upright). <Tag>0.0</Tag> = upside-down.</>],
        ]} />
      </Block>

      <CodeSection
        label="radian quick reference"
        lang="lua"
        code={`0.0           -- 0°    North / Flat
math.pi/2     -- 90°   East
math.pi       -- 180°  South
3*math.pi/2   -- 270°  West`}
      />
    </Section>
  );
}

/* 06 — MIRROR MODES */
function SectionMirror() {
  return (
    <Section>
      <Block title="How Mirroring Works">
        <p>
          A mirror mode makes one canvas click place a second, mirrored
          coordinate automatically — position (and rotation) are computed for you.
          The mirror math depends entirely on <Tag>Map Size</Tag>: set it before
          placing anything or the pairs land in the wrong spot.
        </p>
      </Block>

      <Block title="Modes">
        <KV rows={[
          [<Tag>No Mirror</Tag>,  '1 click = 1 coordinate. Freeform placement for asymmetric maps.'],
          [<Tag>Diagonal</Tag>,   <>1 click = 2. Mirror at <Tag>(mapSize−X, mapSize−Z)</Tag> — 180° rotational symmetry. The most common competitive-map mode.</>],
          [<Tag>Horizontal</Tag>, <>1 click = 2. Mirror at <Tag>same X, mapSize−Z</Tag> — North/South symmetry.</>],
          [<Tag>Vertical</Tag>,   <>1 click = 2. Mirror at <Tag>mapSize−X, same Z</Tag> — East/West symmetry.</>],
        ]} />
      </Block>

      <Block title="Good to Know">
        <p>
          Mirror pairs are always deleted together to keep the map symmetric —
          edit the original and its mirror follows. If a mirrored point would
          overlap an existing coordinate, no duplicate is created. Switching mode
          mid-session only affects new clicks; coordinates keep their original
          mirror state.
        </p>
      </Block>
    </Section>
  );
}

/* 07 — EMITTER ASSIGNMENT */
function SectionEmitter() {
  return (
    <Section>
      <Block title="Why Assign Emitters">
        <p>
          By default every emitter path can be used on every unit. Category
          assignment lets you steer which effects appear where — lava zones get
          fire, snow zones get frost — for visual variety, thematic consistency,
          and exclusion control. Tag your units with categories, then toggle which
          emitters each category may use in the assignment overlay
          {' '}(<Tag>active</Tag> = highlighted, <Tag>excluded</Tag> = dimmed).
        </p>
      </Block>

      <Block title="Matching Modes">
        <KV rows={[
          [<Tag>Smart (3-Tier)</Tag>,       'Most specific first. Tier 1: emitters active for ALL of a unit\'s categories. Tier 2: active for ANY category. Tier 3: all emitters. Best for precise control.'],
          [<Tag>Simple Union</Tag>,         'OR-based: collect every emitter active for ANY of the unit\'s categories. Broad variety, simplest to reason about.'],
          [<Tag>Last Category Only</Tag>,   'Only the LAST tag in the list is matched. Ideal when categories go general → specific.'],
        ]} />
      </Block>

      <CodeSection
        label="same config, three modes — categories [Smoke, Dense]"
        lang="lua"
        code={`--  SMOKE:  A ✓   B ✓   C ✗
--  DENSE:  A ✓   B ✗   C ✓

-- Smart (3-Tier):  A         -- perfect match: active for BOTH
-- Simple Union:    A, B, C   -- union: active for at least ONE
-- Last Category:   A, C      -- only "Dense" (the last tag) is read`}
      />

      <Block title="The Safety Net">
        <p>
          Every mode shares one fallback: if <Tag>nothing</Tag> matches a unit's
          categories, <Tag>all</Tag> configured emitters are used — so a placed
          wreckage is never left with zero effects. Disabling every emitter for a
          category therefore gives it all of them, not none. Each unit is matched
          independently.
        </p>
      </Block>
    </Section>
  );
}

/* 08 — EXPORT */
function SectionExport() {
  return (
    <Section>
      <Block title="What Generate Writes">
        <p>
          Every placement produces <Tag>three files</Tag> in the map folder, and
          the run as a whole produces one <Tag>props.lua</Tag> that lists them all.
          They form a chain: <Tag>props.lua</Tag> drops a lightweight marker at each
          coordinate, the marker's <Tag>_script.lua</Tag> spawns the real content
          there, and the <Tag>_prop.bp</Tag> is just the marker's blueprint.
        </p>
        <p>
          <Tag>_prop.bp</Tag> is a fixed template — it is byte-for-byte identical
          for every placement except its <Tag>HelpText</Tag> (the instance name).
          The <Tag>_script.lua</Tag> is where the real per-placement changes live:
          which blueprint to build, the exact position, and which emitter to attach.
        </p>
      </Block>

      <Block title="The Three Files, Side by Side">
        <div className="hc-code-row">
          <CodeSection
            label="props.lua · the placement index"
            lang="lua"
            code={`return {
    {
        -- points at the _prop.bp →
        path = "/maps/Hades_Dust.v0003/env/props/Forest/Bottom_Center/Group1/Bottom_CenterG1_prop.bp",

        -- X, Y(0 = on terrain), Z
        position  = { 144.5, 0, 140.0 },

        -- orientation basis vectors,
        -- identity = upright / no rotation
        rotationX = { 1, 0, 0 },
        rotationY = { 0, 1, 0 },
        rotationZ = { 0, 0, 1 },

        scale     = { 1, 1, 1 },  -- 1 = native
    },
    -- …one entry per placement
}`}
          />

          <CodeSection
            label="…_script.lua · the real logic"
            lang="lua"
            code={`local Prop = import('/lua/sim/Prop.lua').Prop

Bottom_CenterG1 = Class(Prop) {
    OnCreate = function(self)
        Prop.OnCreate(self)
        -- (guarded to run once, then destroys itself)

        -- THE real placement — blueprint + position:
        local grp = CreateProp(
            Vector(144.5, 2.5, 140.0),
            '/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp'
        )

        -- attach this placement's emitter:
        grp.Trash:Add(CreateEmitterAtBone(grp, -1, -1,
            '/maps/Hades_Dust.v0003/env/props/Forest/Bottom_Center/Group1/Bottom_CenterG1_emit.bp'
        ))

        self:Destroy()
    end,
}
TypeClass = Bottom_CenterG1`}
          />

          <CodeSection
            label="…_prop.bp · fixed template"
            lang="lua"
            code={`PropBlueprint {
    -- Invisible marker. Identical for
    -- every placement — only HelpText
    -- (the instance name) changes.
    Display = {
        Mesh = { LODs = {{
            AlbedoName = '/env/common/props/marker01_albedo.dds',
            MeshName   = '/env/common/props/marker01_lod0.scm',
            ShaderName = 'TMeshNoNormals',
        }}},
        UniformScale = 0,
    },
    Economy   = { ReclaimEnergyMax = 0, ReclaimMassMax = 0 },
    Interface = { HelpText = 'Bottom_CenterG1' },  -- ← only change
    Physics   = { BlockPath = false },
    SizeX = 1, SizeY = 1, SizeZ = 1,
}`}
          />
        </div>
      </Block>

      <Block title="How props.lua Reaches the Map">
        <p>
          <Tag>props.lua</Tag> has to live inside the packed <Tag>.scmap</Tag> to
          load in-game — a .scmap is a zip archive. By default the toolkit does
          the round-trip for you:
        </p>
        <ol>
          <li>The map's <Tag>.scmap</Tag> is unpacked to a temporary folder.</li>
          <li><Tag>props.lua</Tag> is written into the unpacked contents.</li>
          <li>The folder is repacked into a fresh <Tag>.scmap</Tag>.</li>
          <li>The repacked archive is copied back over the original in the map folder.</li>
        </ol>
        <p>
          If a <Tag>props.lua</Tag> already exists it is not overwritten — the next
          free name is used instead (<Tag>props1.lua</Tag>, <Tag>props2.lua</Tag>, …).
        </p>
      </Block>

      <Block title="Export Settings">
        <KV rows={[
          ['Generate README',            'Write a plain-text summary of the run (placements, output dir, emitters) next to the map.'],
          [<>Export props.lua <Tag>no SCMAP</Tag></>, 'Skip the unpack/repack round-trip and drop the raw props.lua straight into the map folder instead — useful for inspecting output or packing by hand.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 10 — TROUBLESHOOT */
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

/* ════════════════════════════════════════════════════════════════
   SECTIONS REGISTRY
   ════════════════════════════════════════════════════════════════ */

const SECTIONS = [
  { id: 'overview',      index: '01', label: 'Overview',        render: () => <SectionOverview /> },
  { id: 'workflow',      index: '02', label: 'Workflow',  bare: true, render: () => <SectionWorkflow /> },
  { id: 'configuration', index: '03', label: 'Configuration',   render: () => <SectionConfiguration /> },
  { id: 'units',         index: '04', label: 'Unit Cards',       render: () => <SectionUnits /> },
  { id: 'canvas',        index: '05', label: 'Preview & Canvas', render: () => <SectionCanvas /> },
  { id: 'mirror',        index: '06', label: 'Mirror Modes',    render: () => <SectionMirror /> },
  { id: 'emitter',       index: '07', label: 'Emitter Assignment', render: () => <SectionEmitter /> },
  { id: 'export',        index: '08', label: 'Export',          render: () => <SectionExport /> },
  { id: 'troubleshoot',  index: '09', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

/* ════════════════════════════════════════════════════════════════
   EXPORTS
   ════════════════════════════════════════════════════════════════ */

export function WreckageHelp({ open, onClose, contextLabel, mapContext }) {
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

export function WreckageHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
