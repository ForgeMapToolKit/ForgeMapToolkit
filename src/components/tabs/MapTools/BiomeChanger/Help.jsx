/**
 * BiomeChanger help — content + HelpConsole wiring in one file.
 *
 * Usage in BiomeChanger.jsx:
 *   import { BiomeChangerHelp, BiomeChangerHelpButton } from './Help.jsx';
 *
 * --tab-color is set by .biomechanger-tab — accent inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview', label: 'Overview',   hint: 'What a biome is made of, and why swapping textures alone never looks right.' },
  { id: 'workflow', label: 'Workflow',   hint: 'Read → pick a preset → confirm roles → check props → apply.' },
  { id: 'roles',    label: 'Layer Roles',hint: 'Why presets address roles instead of layer numbers, and how the guess works.' },
  { id: 'channels', label: 'Channels',   hint: 'The seven switchable halves of a biome, and what each one writes.' },
  { id: 'props',    label: 'Props & Reclaim', hint: 'How blueprints are matched and what it does to the map economy.' },
  { id: 'presets',  label: 'Filling Presets', hint: 'The preset file, the capture shortcut, and the absent-means-leave-alone rule.' },
  { id: 'limits',   label: 'What Is Never Touched', hint: 'Geometry, masks, markers — and why.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: 'What does this tab do?',        sectionIds: ['overview', 'workflow'] },
  { id: 'using',  label: 'Using it well',    hint: 'Roles, channels, props.',       sectionIds: ['roles', 'channels', 'props'] },
  { id: 'author', label: 'Authoring biomes', hint: 'Filling and capturing presets.', sectionIds: ['presets', 'limits'] },
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
      <Block title="Why This Exists">
        <p>
          Deciding whether a map wants to be autumn or desert is a judgement you can
          only make by looking at it. Doing that by hand means swapping nine layer
          textures, then finding that the water is still the old blue, the sun is
          still the old colour and the trees are still the old family — so you never
          see the biome, only a half-finished one, and you cannot judge it.
        </p>
        <p>
          This tab applies the whole set at once, so the question becomes a click.
        </p>
      </Block>
      <Block title="What A Biome Is Made Of">
        <KV rows={[
          ['Layers',   'Nine ground textures with their normals, plus the map-wide macro overlay.'],
          ['Water',    'Surface colour, fresnel, sun response, the water ramp and cubemap, four wave normals.'],
          ['Lighting', 'Sun colour and direction, ambience, shadow fill, specular, bloom, fog.'],
          ['Skybox',   'Horizon, zenith, mid and cirrus colours plus the sky decals (v60 maps).'],
          ['Props',    'Which env family the trees and rocks come from.'],
          ['Minimap',  'The five colours the tactical view draws the map in.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionWorkflow() {
  return (
    <Section>
      <WorkflowSection
        duration={4}
        steps={[
          { title: 'Read the biome', body: 'Enter the map name and hit Read Biome. Nothing is unpacked — the tool reads the packed .scmap directly and reports what the map wears today, including which env families its props come from.' },
          { title: 'Pick a preset and channels', body: 'Choose the target biome. Each card shows how complete that preset is. Then switch off any channel you want to keep your own — most people keep their water level and take everything else.' },
          { title: 'Confirm the layer roles', body: 'The tool guesses which role each layer plays from its texture file name. Check the Layers section and correct any guess before applying — this is the one step worth reading carefully.' },
          { title: 'Check the props', body: 'If the Props channel is on, look at the reclaim delta. A tree-for-rock swap changes the map economy, which matters more than the look on a competitive map.' },
          { title: 'Apply', body: 'Output lists exactly what will be written. Apply duplicates the map to a new version by default, then unpacks, patches and repacks it.' },
        ]}
      />
    </Section>
  );
}

function SectionRoles() {
  return (
    <Section>
      <Block title="Roles, Not Layer Numbers">
        <p>
          Stratum 3 is rock on one map and sand on the next. A preset that addressed
          layers by number would put sand where rock was, and the map would look
          broken for a reason nobody can see. So presets map <em>roles</em> —
          {' '}<Tag>grass</Tag> <Tag>dirt</Tag> <Tag>sand</Tag> <Tag>gravel</Tag>
          {' '}<Tag>rock</Tag> <Tag>cliff</Tag> <Tag>snow</Tag> <Tag>accent</Tag>
          {' '}<Tag>base</Tag> <Tag>macro</Tag> — and the tool works out which role
          each of <em>your</em> layers currently plays.
        </p>
      </Block>
      <Block title="How The Guess Works">
        <KV rows={[
          ['Source',      'The albedo file name, then the normal map name as a second opinion. FA names its layers descriptively (evgrass010a, trrock007, eg_dirt002), so this is right on most stock-textured maps.'],
          ['No guess',    'When nothing matches, the row stays unassigned rather than picking something — a wrong role is worse than no role, so you decide.'],
          ['Unused layers', 'A layer with scale 0 is unused in FA and is left alone.'],
          ['Overriding',  'Set any row by hand. Re-guess from file names resets the whole set.'],
        ]} />
      </Block>
      <Block title="Several Textures In One Role">
        <p>
          Maps routinely carry two or three subtly different grasses. A role may
          therefore hold a list of variants instead of a single texture: the first
          grass layer takes the first variant, the second the second, and the last
          variant repeats for any further layers. Capture writes variants
          automatically, which is why applying a captured preset back onto the map
          it came from changes nothing at all.
        </p>
      </Block>
      <Block title="The Masks Stay">
        <p>
          Only the material changes — the stratum masks that decide <em>where</em> each
          layer is painted are never touched. Your terrain composition survives the
          swap; only what it is made of changes.
        </p>
      </Block>
    </Section>
  );
}

function SectionChannels() {
  return (
    <Section>
      <Block title="Seven Independent Channels">
        <p>
          Each channel is an independent switch, so a preset is a menu rather than an
          all-or-nothing. A channel whose preset block is empty says so on the row and
          writes nothing even when switched on.
        </p>
        <KV rows={[
          ['Textures & Normals', 'Albedo and normal per layer, by role.'],
          ['Water',              'Look only. Water level is never included — see the last help section.'],
          ['Lighting & Fog',     'Sun, ambience, shadow, specular, bloom, fog colour.'],
          ['Skybox',             'Sky colours and decals. Needs a v60 map; on v56 the row says so and the apply is refused rather than half-written.'],
          ['Environment Cube',   'Background and sky-cube textures the terrain reflects. Off by default — it is the most map-specific of the set.'],
          ['Minimap Colours',    'So the tactical view matches the new ground.'],
          ['Props',              'Off by default, because it changes reclaim.'],
        ]} />
      </Block>
      <Block title="Tile Scales">
        <p>
          Adopting the preset&apos;s tile scales is a separate switch, off by default.
          Scale is authored for a specific map size — a 5 km map and a 40 km map want
          different tiling of the same texture, so keeping your own scale is usually
          right.
        </p>
      </Block>
    </Section>
  );
}

function SectionProps() {
  return (
    <Section>
      <Block title="How Blueprints Are Matched">
        <KV rows={[
          ['Family',        'The preset names one env family (desert, tundra, lava…). Candidates come from the scanned game library, so the tool only ever uses props your install actually has.'],
          ['Type for type', 'Trees map to trees, rocks to rocks, from the /props/<type>/ folder in the path.'],
          ['One-to-one',    'Matching is per blueprint, not per instance: a map with five tree types keeps five tree types instead of collapsing to one. The same inputs always produce the same result — a second run is a no-op.'],
          ['No candidate',  <>You choose: <Tag>keep</Tag> the prop, take <Tag>any type</Tag> from the family, or <Tag>remove</Tag> it.</>],
          ['Overrides',     'A preset can pin individual blueprints when the automatic match picks something you dislike.'],
        ]} />
      </Block>
      <Block title="Reclaim Is Not Decoration">
        <p>
          A tree and a rock carry different reclaim mass. Swapping them is an economy
          change, so the delta is shown before the apply button and never smoothed
          over. <em>Prefer similar reclaim</em> lets mass break ties between
          candidates, which protects balance at some cost to the look.
        </p>
        <p>
          Totals only count props the scan knows a reclaim value for; unknown ones
          count as zero, so treat the delta as a strong signal rather than an audit.
        </p>
      </Block>
    </Section>
  );
}

function SectionPresets() {
  return (
    <Section>
      <Block title="One File">
        <p>
          Biomes live in <Tag>biomePresets.js</Tag> next to this tab. Adding one is
          adding an object to the array — no other file needs touching, and the tab
          measures and displays its coverage automatically.
        </p>
      </Block>
      <Block title="Absent Means Leave Alone">
        <p>
          Every field at every depth is optional. A preset holding nothing but
          {' '}<Tag>textures.rock</Tag> is valid and swaps exactly that. So presets can
          be filled in passes instead of all at once. An <em>unknown</em> key or a
          malformed value is a different matter — that is reported as a problem and
          the apply is refused, because a typo must never read as success.
        </p>
      </Block>
      <Block title="Capture Instead Of Typing">
        <p>
          The fast way to fill a preset is not to look up paths. Open a map whose look
          you want, read it, check the guessed roles, then hit
          {' '}<Tag>Capture as preset</Tag> in Configuration. The complete preset lands
          on your clipboard as JSON — paste it into the file and give it an id, label,
          blurb and swatch.
        </p>
      </Block>
    </Section>
  );
}

function SectionLimits() {
  return (
    <Section>
      <Block title="Never Touched">
        <p>
          A biome changes how a map looks, never what it is. These are excluded at the
          engine level, not by convention, so no preset can reach them however complete
          it claims to be:
        </p>
        <KV rows={[
          ['Heightmap & masks',  'The terrain and the stratum masks that place each layer.'],
          ['Water level',        <>Elevation, deep and abyss. Moving them re-floods the terrain and invalidates every spawn and mex the author placed.</>],
          ['Skybox geometry',    'Dome scale, position and heights — those scale with map size and belong to the Map Resizer.'],
          ['Terrain shader',     'It decides how the masks blend; swapping it would change the texture layout, not the palette.'],
          ['Terrain type',       'The material layer under units — that is the TerrainType tab.'],
          ['Markers & areas',    'Nothing in save.lua or scenario.lua is read or written here.'],
          ['Contour interval',   'A reading aid tied to the map&apos;s height range.'],
        ]} />
      </Block>
      <Block title="Safety">
        <p>
          Apply creates a new map version by default, so the original folder stays
          untouched, and a snapshot is recorded either way — the History tab can take
          you back.
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
  { id: 'overview', index: '01', label: 'Overview',    render: () => <SectionOverview /> },
  { id: 'workflow', index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'roles',    index: '03', label: 'Layer Roles', render: () => <SectionRoles /> },
  { id: 'channels', index: '04', label: 'Channels',    render: () => <SectionChannels /> },
  { id: 'props',    index: '05', label: 'Props & Reclaim', render: () => <SectionProps /> },
  { id: 'presets',  index: '06', label: 'Filling Presets', render: () => <SectionPresets /> },
  { id: 'limits',   index: '07', label: 'Never Touched',   render: () => <SectionLimits /> },
  { id: 'troubleshoot', index: '08', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function BiomeChangerHelp({ open, onClose, contextLabel, mapContext }) {
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

export function BiomeChangerHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
