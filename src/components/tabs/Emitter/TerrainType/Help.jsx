/**
 * TerrainType help — content + HelpConsole wiring in one file.
 *
 * Usage in TerrainType.jsx:
 *   import { TerrainTypeHelp, TerrainTypeHelpButton } from './Help.jsx';
 *   <TerrainTypeHelpButton open={helpOpen} onClick={() => setHelpOpen(o => !o)} />
 *   <TerrainTypeHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
 *
 * --tab-color is set by .terraintype-tab — accent inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview',  label: 'Overview',      hint: 'What TerrainType is and why auto-painting it from the strata works.' },
  { id: 'workflow',  label: 'Workflow',      hint: 'Analyze → assign layers → tune threshold → apply.' },
  { id: 'layers',    label: 'Layers',        hint: 'The nine ground layers, coverage %, and picking a terrain type per layer.' },
  { id: 'blend',     label: 'Blend & Shader',hint: 'Dominance model, the halfRange remap, and the height-splat shaders.' },
  { id: 'apply',     label: 'Apply',         hint: 'How terrainType.raw is rewritten and repacked in place.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented',   hint: 'What does this tab even do?',            sectionIds: ['overview', 'workflow'] },
  { id: 'setup',  label: 'Assigning layers',   hint: 'Coverage, terrain types, blocking.',      sectionIds: ['layers', 'blend'] },
  { id: 'finish', label: 'Writing the map',    hint: 'Threshold, apply, repack.',               sectionIds: ['apply'] },
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
      <Block title="What the TerrainType Auto-Paint Does">
        <p>
          Ingame, the terrain type under a unit decides which footfall effect
          plays — grey rock dust on geothermal stone, brown dust on dirt. That
          layer is <Tag>terrainType.raw</Tag> inside the <Tag>.scmap</Tag>, one
          byte per cell. Normally you paint it by hand. This tab derives it from
          the textures already on the map.
        </p>
      </Block>
      <Block title="Key Concepts">
        <KV rows={[
          ['Stratum / Layer', 'One of the nine ground textures: the Lower base plus eight masked strata blended over it.'],
          ['Dominance',       'The layer that visually covers a cell the most, from FA\'s real blend of the stratum masks.'],
          ['Terrain Type',    'The material byte (e.g. Rocky12 = geothermal grey) written where a layer dominates.'],
          ['Blocking',        <>A terrain type that also blocks pathing (<Tag>🚫</Tag>) — useful to make cliffs or rock impassable.</>],
        ]} />
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
          { title: 'Analyze the strata', body: 'Enter the map name and hit Analyze. The tool reads the two stratum masks and works out the dominant layer per cell, auto-tuned to the map\'s terrain shader.' },
          { title: 'Assign terrain types', body: 'On the Layers section, give each ground layer a terrain type. Coverage % shows how much of the map that layer dominates. Leave a layer on Default to ignore it.' },
          { title: 'Tune the threshold', body: 'Raise the dominance threshold so only clearly dominant regions get typed; soft, mixed areas stay Default.' },
          { title: 'Apply', body: 'Apply unpacks the map, rewrites terrainType.raw, and repacks it in place.' },
        ]}
      />
    </Section>
  );
}

function SectionLayers() {
  return (
    <Section>
      <Block title="The Nine Layers">
        <p>
          FA blends up to nine ground textures: a <Tag>Lower</Tag> base and
          {' '}<Tag>Stratum 0–7</Tag> painted over it through the stratum masks.
          Each row shows the layer's albedo file name and the share of the map it
          dominates. Pick the terrain type each layer should stamp.
        </p>
      </Block>
      <Block title="Choosing Types">
        <KV rows={[
          ['Grouped picker', 'The dropdown lists every terrain type grouped by biome style (Evergreen, Desert, Lava, Geothermal, Tundra…).'],
          ['Coverage %',     'How much of the map that layer is the dominant one — a layer at 0% won\'t paint anything.'],
          ['Default',        'Leave a layer on “Default” to skip it; its cells fall back to terrain type 1.'],
          ['Blocking',       <>Types marked <Tag>🚫 no-path</Tag> block unit pathing — assign them deliberately for cliffs/rock.</>],
        ]} />
      </Block>
    </Section>
  );
}

function SectionBlend() {
  return (
    <Section>
      <Block title="How Dominance Is Decided">
        <p>
          The engine blends strata as an ordered chain — a later stratum with a
          high mask overdraws earlier ones. The tool computes the true visible
          share of each layer from that chain and picks the largest. This is
          exact for the common TTerrain / TTerrainXP shaders.
        </p>
      </Block>
      <Block title="halfRange & Height-Splat">
        <KV rows={[
          ['Sharp remap', 'Most shaders read the masks through a sharpening remap. The toggle is auto-set from the map\'s shader; flip it only if the segmentation clearly reads too soft or too hard.'],
          ['Threshold',   'Below the threshold a cell is left as Default — this keeps blurry transition bands from being typed.'],
          ['Height-splat', 'Terrain1xx/2xx shaders add a texture-height term. Because terrainType is coarser than the tiling, the mask-based result is still the correct expected label; only the exact boundary shifts.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionApply() {
  return (
    <Section>
      <Block title="What Apply Writes">
        <p>
          Apply builds the full <Tag>terrainType.raw</Tag> grid — the assigned
          type wherever a layer dominates above the threshold, Default (1)
          everywhere else — then unpacks the <Tag>.scmap</Tag>, overwrites
          {' '}<Tag>terrainType.raw</Tag>, and repacks it back in place. A snapshot
          is recorded first so the change is undoable.
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
  { id: 'overview', index: '01', label: 'Overview',       render: () => <SectionOverview /> },
  { id: 'workflow', index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'layers',   index: '03', label: 'Layers',         render: () => <SectionLayers /> },
  { id: 'blend',    index: '04', label: 'Blend & Shader', render: () => <SectionBlend /> },
  { id: 'apply',    index: '05', label: 'Apply',          render: () => <SectionApply /> },
  { id: 'troubleshoot', index: '06', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function TerrainTypeHelp({ open, onClose, contextLabel, mapContext }) {
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

export function TerrainTypeHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
