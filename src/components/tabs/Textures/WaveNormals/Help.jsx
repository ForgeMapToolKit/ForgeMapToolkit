/**
 * Help.jsx — Wave Normals help register, on the shared HelpPanel.
 *
 * --tab-color comes from .wn-tab; the console inherits the accent.
 */

import React, { useState } from 'react';
import HelpConsole, { HelpButton } from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';
import { TroubleshootSection } from '../../../Shared/Ui/HelpPanel/Sections/index.js';

const HELP_LINKS = [
  { id: 'overview',  label: 'Overview',    hint: 'What this generates and why FA water needs it.' },
  { id: 'physics',   label: 'Sea State',   hint: 'The four spectrum models, wind, fetch, depth, spreading.' },
  { id: 'layers',    label: 'Layers',      hint: 'Tile sizes, band splitting, choppiness, sum compensation.' },
  { id: 'foam',      label: 'Foam',        hint: 'How the alpha channel is derived and how to make it visible in-game.' },
  { id: 'export',    label: 'Export',      hint: 'File format, mipmaps, and the editor values to enter.' },
];

const HELP_CATEGORIES = [
  { id: 'orient', label: 'Getting oriented', hint: 'New here — what does this tab produce?', sectionIds: ['overview'] },
  { id: 'tune',   label: 'Tuning the water', hint: 'The sea does not look how I want.',      sectionIds: ['physics', 'layers'] },
  { id: 'foamq',  label: 'Foam problems',    hint: 'No whitecaps, or far too many.',          sectionIds: ['foam'] },
  { id: 'ship',   label: 'Getting it in-game', hint: 'Files written — now what?',            sectionIds: ['export'] },
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
          <span className="hc-kv__key">{k}</span>
          <span className="hc-kv__val">{v}</span>
        </div>
      ))}
    </div>
  );
}
const Tag = ({ children }) => <code className="hc-tag">{children}</code>;

/* 01 — OVERVIEW */
function SectionOverview() {
  return (
    <Section>
      <Block title="What this generates">
        <p>
          Four tiling normal maps for FA's water shader, plus the foam mask the stock
          textures do not have. The surface is a Tessendorf FFT ocean — the same method
          Blender's Ocean modifier uses — rather than filtered noise, so the wave sizes,
          the grouping into sets, and the sharp-crest / broad-trough asymmetry all come
          out of a measured wave spectrum.
        </p>
      </Block>

      <Block title="Why FA needs it">
        <p>
          <Tag>water2.fx</Tag> samples four normal textures, sums them, and only then
          normalises: <Tag>N = normalize((2·sum.xyz − 4).xzy)</Tag>. Separately it computes
          <Tag>waveCrest = saturate(sum.a − waveCrestThreshold)</Tag> from the four alphas.
        </p>
        <p>
          Every high-resolution wave texture the engine ships (the nine{' '}
          <Tag>waves1/2/3_*m.dds</Tag> at 1024²) has <strong>alpha = 0</strong>. The only
          alpha-bearing ones are 256² and live in the Steam base archive. So on virtually
          every map, foam is off — not misconfigured, absent. Generating your own set
          removes that trade-off: full resolution <em>and</em> a crest mask.
        </p>
      </Block>

      <Block title="Channel layout">
        <KV rows={[
          ['R', 'World X component of the normal'],
          ['G', 'World Z component (the shader swizzles .xzy)'],
          ['B', 'World Y — up'],
          ['A', 'Foam mask. Independent of RGB; this is why a Blender normal bake cannot produce it.'],
        ]} />
      </Block>
    </Section>
  );
}

/* 02 — SEA STATE */
function SectionPhysics() {
  return (
    <Section>
      <Block title="Spectrum models">
        <KV rows={[
          ['Phillips',           'Tessendorf\'s classic. Broad and forgiving; good general-purpose open water.'],
          ['Pierson-Moskowitz',  'A fully developed sea — the wind has blown long enough that the spectrum stopped growing. Wind speed alone sets the wavelength.'],
          ['JONSWAP',            'Fetch-limited with a sharpened peak. Coastal water, bays, lakes. Fetch matters as much as wind.'],
          ['TMA',                'JONSWAP plus depth attenuation and finite-depth dispersion. Shelf and shore.'],
        ]} />
      </Block>

      <Block title="What each control actually does">
        <KV rows={[
          ['Wind speed',    <>Sets wave height throughout, and wavelength in PM. Peak wavelength is λ = 2πV²/g — roughly 10 m at 4 m/s, 40 m at 8 m/s.</>],
          ['Fetch',         'How much open water the wind has crossed. Short fetch gives short, steep chop; long fetch gives long swell at the same wind speed.'],
          ['γ',             'JONSWAP peak enhancement. 1 collapses it onto Pierson-Moskowitz; 3.3 is the North Sea average; higher makes the sea more monochromatic.'],
          ['Depth',         <>Switches dispersion to ω = √(gk·tanh(kD)). Long waves slow down and steepen as they feel the bottom.</>],
          ['Spread',        'Exponent in cos²ˢ(Δθ/2). Low values fan the waves out; high values give tight parallel trains. Nothing travels into the wind at any setting.'],
          ['Cutoff',        'Damps waves shorter than this. Raise it if the finest layer shimmers rather than showing detail.'],
          ['Seed',          'Same seed and parameters always give the same sea. Re-roll to change the arrangement without changing the physics.'],
        ]} />
      </Block>

      <Block title="Sanity check">
        <p>
          The readout shows the predicted peak wavelength and, after a bake, the realised
          RMS wave height. If those two disagree with what you see, something upstream is
          wrong — that is the check, not a decoration.
        </p>
      </Block>
    </Section>
  );
}

/* 03 — LAYERS */
function SectionLayers() {
  return (
    <Section>
      <Block title="Tile sizes are not four free choices">
        <p>
          <Tag>normalRepeatRate</Tag> maps world position to UV, so one texture period
          covers <Tag>1 / repeatRate</Tag> ogrids — that is the editor's <strong>Scale</strong>{' '}
          field. With 1 ogrid = 19.53 m, vanilla's four rates work out to tiles of
          21.7 km, 2.17 km, 391 m and 39 m.
        </p>
        <p>
          A wind sea peaks around 10–40 m and dies off exponentially at longer wavelengths.
          Vanilla's two largest slots therefore sit entirely above any wave scale that
          exists — they can only ever carry near-flat noise. The recommended preset spans
          19.5 m to 1953 m instead, with round repeat rates.
        </p>
      </Block>

      <Block title="Band split">
        <KV rows={[
          ['Band-matched', 'Each layer gets the wind speed (or fetch) whose spectral peak lands in its own band. Every layer carries real structure, and it matches the physical situation: local wind sea at short scales, distant swell at long ones.'],
          ['Strict octave', 'One sea split into four power-complementary bands. Exact — with the honest consequence that layers above the sea\'s wavelength range come out flat. The tab flags those as "empty band".'],
          ['Independent',  'The full spectrum at every tile size. What four separate Blender bakes would give you; the large layers show the same waves rendered larger.'],
        ]} />
      </Block>

      <Block title="Choppiness and sum compensation">
        <p>
          Choppiness is Tessendorf's horizontal displacement. At 0 the surface is a sum of
          sine waves — corrugated iron. Raising it moves mass toward the crests, producing
          the sharp-crest / broad-trough profile real water has. Above about 1.5 the
          surface starts folding through itself, which is what feeds the foam channel.
        </p>
        <p>
          <strong>Sum compensation</strong> exists because the engine normalises the sum of
          four near-vertical normals, so |Σn| ≈ 4 and what gets rendered is their{' '}
          <em>mean</em> slope. Each layer therefore has to encode 4× its band's slope to
          contribute that band in full. Turning it off makes the water four times flatter.
        </p>
      </Block>

      <Block title="Supersampling">
        <p>
          The simulation runs at a multiple of the output resolution and is resolved down
          through the displacement scatter, which doubles as a tent reconstruction filter.
          At 1× the surface aliases at Nyquist and shimmers; 2× is the sensible default.
        </p>
      </Block>
    </Section>
  );
}

/* 04 — FOAM */
function SectionFoam() {
  return (
    <Section>
      <Block title="Where the mask comes from">
        <p>
          With choppy displacement the surface normal is the cross product of the two
          displaced tangents, and the <em>y component of that cross product is the Jacobian
          determinant</em> of the horizontal map. Where it approaches zero the surface has
          folded through itself — a breaking wave. So the foam mask falls out of the same
          expression that produced the normal, and the whitecaps sit on the crests because
          the mathematics puts them there, not because a noise mask was laid over the top.
        </p>
      </Block>

      <Block title="Making it visible in-game">
        <p>
          The engine computes <Tag>saturate(sum.a − waveCrestThreshold)</Tag> over four
          summed alphas. A single layer averaging 0.15 produces nothing on its own — foam
          appears where several scales agree there is a breaking crest, which is exactly
          the right behaviour. The Export section solves the threshold from the four baked
          alphas for a target coverage; use that number rather than guessing.
        </p>
      </Block>

      <Block title="Why the large layers contribute less">
        <p>
          A det(J) mask computed on a kilometre-wide tile is a perfectly valid breaking-wave
          mask for kilometre-long waves — but over a 100 m view it is a slow, soft blob that
          swamps <Tag>sum.a</Tag> and turns the water into white patches. Layers are
          therefore weighted by size, with the fine ones carrying the actual foam.
        </p>
      </Block>

      <Block title="Compression note">
        <p>
          DXT5 stores alpha as two endpoints plus 3-bit indices per 4×4 block. High-frequency
          foam turns blocky there — the mask blur exists for that case. The uncompressed
          export has no such problem.
        </p>
      </Block>
    </Section>
  );
}

/* 05 — EXPORT */
function SectionExport() {
  return (
    <Section>
      <Block title="Format">
        <p>
          Uncompressed A8R8G8B8 is the default here, which is the opposite of the usual
          advice. Measured on a real bake, a PCA + least-squares BC3 encoder reaches about
          31.8 dB against 28.7 dB for naive min/max endpoints — but that still amounts to
          roughly 4° of mean normal error, and a further ±1 endpoint search buys only 0.1 dB.
          The limit is the four-entry palette, not the endpoints: water normals simply vary
          too much inside a 4×4 block. At 512² with mips a layer is 1.4 MB, so the set costs
          5.6 MB against a 20 MB scmap.
        </p>
      </Block>

      <Block title="Mipmaps">
        <p>
          Always written, down to 1×1. Normals are averaged as vectors and renormalised, not
          box-filtered as bytes. Without a mip chain the finest layer — which tiles every
          ogrid or two — aliases into shimmer at any camera distance.
        </p>
      </Block>

      <Block title="Wiring it into the map">
        <p>
          The DDS files go to <Tag>&lt;map&gt;/env/layers/water/</Tag>. With <em>Patch the
          .scmap water settings</em> on (default), the export also unpacks the map, rewrites the
          four wave-texture paths, movement vectors and repeat rates in its <Tag>data.lua</Tag>,
          and repacks — so nothing has to be assembled by hand. Slots left on their stock
          texture (deselected above) keep their vanilla path. The Scale/Speed/Angle block is
          still printed as a record and a manual fallback.
        </p>
        <p>
          Scroll speeds are derived from each band's deep-water phase speed c = √(g/k), so long
          waves travel faster than chop — vanilla's hand-set vectors get that ordering wrong.
        </p>
      </Block>

      <Block title="Lifting the sun">
        <p>
          The stock water sun points ~74° below the horizon, which routes
          <Tag>calculateSunReflection</Tag> into a legacy path with the specular highlight off —
          the reason FA water looks matte on nearly every map. The optional <em>Lift the water
          sun</em> toggle flips it above the horizon (keeping azimuth) so your normals actually
          catch light. It is off by default because it changes the whole water look; turn it on
          if the water still reads flat in-game.
        </p>
      </Block>

      <Block title="One thing to check first">
        <p>
          The editor has no field for the water sun direction, only a "Calculate from light
          settings" checkbox that is off by default. The stock value points 74° <em>below</em>{' '}
          the horizon, which routes <Tag>calculateSunReflection</Tag> into a legacy path and
          switches the specular highlight off. If your new normals look flat in-game, that
          is the first thing to check — no normal map is visible without a light above it.
        </p>
      </Block>
    </Section>
  );
}

/* 06 — TROUBLESHOOT */
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
  { id: 'physics',      index: '02', label: 'Sea State',       render: () => <SectionPhysics /> },
  { id: 'layers',       index: '03', label: 'Layers',          render: () => <SectionLayers /> },
  { id: 'foam',         index: '04', label: 'Foam',            render: () => <SectionFoam /> },
  { id: 'export',       index: '05', label: 'Export',          render: () => <SectionExport /> },
  { id: 'troubleshoot', index: '06', label: 'Troubleshooting', render: (nav) => <SectionTroubleshoot {...nav} /> },
];

export function WaveNormalsHelp({ open, onClose, contextLabel, mapContext }) {
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

export function WaveNormalsHelpButton({ open, onClick }) {
  return <HelpButton open={open} onClick={onClick} />;
}
