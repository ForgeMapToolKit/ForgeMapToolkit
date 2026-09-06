/**
 * Map Rotator help — content + HelpConsole wiring in one file.
 *
 * Usage in MapRotator.jsx:
 *   import { RotatorHelp, RotatorHelpButton } from './Help.jsx';
 *
 * --tab-color is set by .map-rotator-tab — accent inherited automatically.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { WorkflowSection, TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview',  label: 'Overview',   hint: 'What a rotation touches, and what it deliberately does not.' },
  { id: 'workflow',  label: 'Workflow',   hint: 'Name the map → pick an angle → rotate → re-save in the editor.' },
  { id: 'angles',    label: 'Angles',     hint: 'Why 90/180/270 are free and everything else costs something.' },
  { id: 'layers',    label: 'Layers',     hint: 'Every layer the tool turns, and how.' },
  { id: 'limits',    label: 'Limits',     hint: 'Terrain normals, compressed textures, repeated turns.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: 'What does this tab even do?',   sectionIds: ['overview', 'workflow'] },
  { id: 'setup',  label: 'Choosing an angle', hint: 'Lossless versus arbitrary.',   sectionIds: ['angles'] },
  { id: 'detail', label: 'What gets moved',  hint: 'Layers and known limits.',      sectionIds: ['layers', 'limits'] },
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
      <Block title="What the Map Rotator Does">
        <p>
          It turns a finished map about its own centre. Not the camera, not the
          preview — the data. The heightmap, the terrain types, the texture and
          water masks, every prop with its facing, every decal, every marker,
          every pre-placed unit and every area rectangle all move together, so
          the map that comes out is the same map seen from a different side.
        </p>
        <p>
          The usual reason is spawn fairness or variety: a 4-player map whose
          layout favours the north gets a second life at 90°, and a mirrored map
          rotated 180° gives you the same terrain with the teams swapped. It is
          also the fastest way to fix a map that was built against the wrong
          edge.
        </p>
      </Block>
      <Block title="What It Deliberately Leaves Alone">
        <KV rows={[
          ['Map size',  <>A rotation keeps the map square and the same grid. <Tag>size</Tag> in data.lua and <Tag>_scenario.lua</Tag> is untouched — use the Map Resizer for that.</>],
          ['Skybox',    'The dome, its cirrus layers and its cube map stay where they are. Rotating a sky that is mostly gradient and cloud buys nothing and risks a visible seam.'],
          ['Sun',       <>Off by default, for the same reason: leaving the sun fixed keeps the lighting agreeing with the skybox. Turn <Tag>Rotate Sun Direction</Tag> on if you would rather keep the map's authored shadows and accept that the sky no longer matches.</>],
          ['Heights',   'Terrain heights are moved, never changed. A rotation does not touch elevation, water level or fog.'],
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
          { title: 'Name the map', body: 'Type the versioned folder name, e.g. Hades_Dust.v0002. The grid size is read from the map and shown under the field — the rotation needs it to know where the centre is.' },
          { title: 'Pick an angle', body: 'The three quarter-turn buttons are the safe ones. The custom field takes any angle in degrees clockwise; the dial below shows what the turn does and how much of the map survives it.' },
          { title: 'Choose the layers', body: 'The rail on the right lists everything the rotation touches. Leave it alone unless you have a reason — turning one layer off leaves the map internally inconsistent, which is occasionally exactly what you want and usually a bug.' },
          { title: 'Rotate', body: 'Step 02 runs it. With Create new version on, a fresh vNNNN folder is made first and the original is never written to. The map is unpacked, patched, packed and the _save.lua rewritten in one pass.' },
          { title: 'Re-save in the FA editor', body: 'Open the rotated map once in the editor and save it. That regenerates the terrain normal map, which this tool moves but cannot re-derive — see Limits.' },
        ]}
      />
    </Section>
  );
}

function SectionAngles() {
  return (
    <Section>
      <Block title="Positive Is Clockwise">
        <p>
          Angles are degrees clockwise as you look at the minimap. 90° sends the
          map's north edge to the east, 180° sends it to the south, 270° to the
          west. The dial draws it: the dashed square is the frame the map has to
          fit into, the filled one is the map after the turn, and the needle is
          where north went.
        </p>
      </Block>
      <Block title="Quarter Turns Are Free">
        <p>
          90°, 180° and 270° are a pure index permutation. Every raster cell
          lands exactly on another raster cell, so nothing is interpolated,
          nothing is clipped and nothing is lost — the rotated heightmap is
          bit-for-bit the original heightmap, rearranged. Rotate a map four
          times by 90° and the rasters come back byte-identical.
        </p>
        <p>
          Coordinates in the Lua files are written to five decimal places, the
          same precision the rest of the toolkit uses, so those round-trip to
          the value you started with rather than to the same bits. Prop
          orientations are exact even so: a quarter turn only swaps and negates
          the components of their rotation vectors, which is why the tool turns
          those vectors instead of converting them to an angle and back.
        </p>
        <p>
          This works because the map centre sits at pixel <Tag>(N−1)/2</Tag> for
          every layer at once: the heightmap's <Tag>size+1</Tag> vertices, the
          full-resolution <Tag>size</Tag> cell grids and the half-resolution
          water masks. All three land on integers under a quarter turn.
        </p>
      </Block>
      <Block title="Everything Else Costs Two Things">
        <KV rows={[
          ['Resampling', 'Raster layers have to be sampled bilinearly (nearest-neighbour for terrain types, which are an enum and cannot be averaged). The terrain softens a little. Props, decals, markers, units and areas are computed in floating point and stay exact at any angle.'],
          ['Clipping',   'A square rotated inside its own frame pushes four flaps out and leaves four corners empty. At 45° — the worst case — 17.2 % of the map falls outside and is gone. The dial prints the exact figure for the angle you picked.'],
          ['The corners', 'The empty corners are filled by extending the border outwards rather than by a flat fill, which keeps the shoreline and the water level continuous instead of dropping a cliff at the map edge. It still looks like a smear. Plan to hand-fix the corners after a non-quarter turn.'],
        ]} />
      </Block>
    </Section>
  );
}

function SectionLayers() {
  return (
    <Section>
      <Block title="Inside the .scmap">
        <KV rows={[
          ['heightmap.raw',   <>(size+1)² of 16-bit heights. Rotated by position; the height values themselves are never scaled.</>],
          ['terrainType.raw', 'size² of one-byte terrain ids. Nearest neighbour — interpolating an enum would invent terrain types that do not exist.'],
          ['Texture masks',   <><Tag>textureMaskLow</Tag> and <Tag>textureMaskHigh</Tag>, the stratum blend weights, rotated with the terrain.</>],
          ['Water masks',     <><Tag>waterFoamMask</Tag>, <Tag>waterFlatness</Tag> and <Tag>waterDepthBiasMask</Tag> at half resolution.</>],
          ['previewImage',    'The minimap thumbnail baked into the .scmap, so the map picker shows the rotated map.'],
          ['Props',           <>Position rotates about the centre and all three rotation vectors rotate with it. Doing it as vectors rather than as a heading is correct whether the stored triple is the matrix' rows or its columns — both reduce to the same operation. Prop <Tag>scale</Tag> is untouched.</>],
          ['Decals',          <>Position rotates; the turn is subtracted from the euler-Y heading. Decal <Tag>scale</Tag> is a size, not a direction, so it stays.</>],
          ['Wave generators', <>Position, <Tag>rotation</Tag> and <Tag>velocity</Tag>, plus the four water wave-texture scroll directions in <Tag>waterSettings</Tag>.</>],
        ]} />
      </Block>
      <Block title="Inside _save.lua">
        <KV rows={[
          ['Markers',     <>Every <Tag>VECTOR3</Tag> position, snapped back onto the half-grid the editor uses, and every <Tag>orientation</Tag>.</>],
          ['Units',       <>Pre-placed units and civilians: <Tag>Position</Tag> and <Tag>Orientation</Tag>.</>],
          ['Areas',       <>A <Tag>RECTANGLE</Tag> has no orientation, so a rotated one is written as the bounding box of its four rotated corners, clamped to the map. On a quarter turn that is the same rectangle turned; on any other angle it grows.</>],
        ]} />
      </Block>
      <Block title="Prop Scripts">
        <p>
          A prop whose blueprint ends in <Tag>_prop.bp</Tag> can have a sibling
          {' '}<Tag>_script.lua</Tag> under your maps folder that spawns wreckage or
          civilians at hard-coded coordinates. Those files are found the same way
          the Map Resizer finds them, and their <Tag>CreateUnitHPR</Tag> and
          {' '}<Tag>CreatePropHPR</Tag> calls get both their coordinates and their
          heading rotated. Headings written as an expression rather than a number
          — <Tag>math.pi</Tag>, say — are left alone rather than guessed at.
        </p>
      </Block>
    </Section>
  );
}

function SectionLimits() {
  return (
    <Section>
      <Block title="Terrain Normals Need One Editor Save">
        <p>
          <Tag>normalMap.dds</Tag> stores terrain normals as encoded vectors. The
          tool rotates the image, so every normal ends up on the right pixel —
          but the vectors themselves still point the way they did before the
          turn, and re-deriving them would mean guessing at the channel
          encoding. The consequence is subtly wrong terrain shading, most
          visible on steep slopes.
        </p>
        <p>
          The fix is one step: open the rotated map in the FA editor and save it.
          The editor regenerates the normal map from the heightmap, which is
          already correct. Do this after every rotation.
        </p>
      </Block>
      <Block title="Compressed Textures Turn Only by a Quarter">
        <p>
          FA stores <Tag>normalMap.dds</Tag> and <Tag>waterMap.dds</Tag> as DXT5
          and the stratum masks uncompressed. A DXT texture is not a grid of
          pixels but a grid of 4×4 blocks, each holding two endpoint colours and
          sixteen indices into them.
        </p>
        <p>
          On a quarter turn that structure is an advantage: because the map is a
          multiple of four across, rotating the block grid and rotating the
          sixteen indices inside every block — by the same permutation — is
          exactly a rotation of the image. The endpoint colours are a palette,
          not a layout, so they are copied untouched. Nothing is decoded, nothing
          is re-encoded, the file does not change size and not one pixel changes
          value.
        </p>
        <p>
          At any other angle the blocks no longer line up and the texture would
          have to be decoded, resampled and re-compressed — and this project has
          no DXT encoder. Rather than write back something worse than it found,
          the tool leaves those textures alone and names them in the completion
          message. That is the strongest reason to prefer a quarter turn: at 37°
          your terrain rotates and its normal and water maps do not.
        </p>
      </Block>
      <Block title="Non-Square Layers">
        <p>
          Every layer is checked against the size it should be for the map's
          grid before it is touched. A layer that does not match — a
          hand-edited raster, a non-square DDS — is skipped with a warning in
          the log instead of being rotated into garbage.
        </p>
      </Block>
      <Block title="Rotating Twice">
        <p>
          Quarter turns compose cleanly: two 90° passes equal one 180° pass,
          exactly. Arbitrary angles do not — each pass resamples and clips
          again, so 30° three times is visibly worse than 90° once. If you want
          an arbitrary angle, get there in a single rotation from the original.
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
  { id: 'overview',     index: '01', label: 'Overview',        render: () => <SectionOverview /> },
  { id: 'workflow',     index: '02', label: 'Workflow', bare: true, render: () => <SectionWorkflow /> },
  { id: 'angles',       index: '03', label: 'Angles',          render: () => <SectionAngles /> },
  { id: 'layers',       index: '04', label: 'Layers',          render: () => <SectionLayers /> },
  { id: 'limits',       index: '05', label: 'Limits',          render: () => <SectionLimits /> },
  { id: 'troubleshoot', index: '06', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function RotatorHelp({ open, onClose, contextLabel, mapContext }) {
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

export function RotatorHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
