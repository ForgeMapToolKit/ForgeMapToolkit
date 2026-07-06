/**
 * SkyboxGenerator_help.jsx — Hilfe via shared HelpConsole (TAB-CONTRACT §7)
 *
 * Interner State für activeSection — der Parent übergibt nur onClose.
 * Aufruf im Parent: {showHelp && <Help onClose={() => setShowHelp(false)} />}
 */
import React, { useState } from 'react';
import HelpPanel from '../../../Shared/Ui/HelpPanel/HelpPanel.jsx';

// ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'guide',      index: '01', label: 'Help Guide'     },
  { id: 'atmosphere', index: '02', label: 'Atmosphere'      },
  { id: 'cirrus',     index: '03', label: 'Cirrus Clouds'   },
  { id: 'planets',    index: '04', label: 'Planets'         },
  { id: 'stars',      index: '05', label: 'Stars'           },
  { id: 'output',     index: '06', label: 'Output & Inject' },
];

// ── Kleine Layout-Helfer (inline, kein shared import nötig) ──────
const Step = ({ index, title, children, notes }) => (
  <div className="hc-step">
    <div className="hc-step-num">{index}</div>
    <div className="hc-step-body">
      {title && <h4 className="hc-step-title">{title}</h4>}
      {children && <p className="hc-step-desc">{children}</p>}
      {notes?.length > 0 && (
        <ul className="hc-step-notes">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  </div>
);

const Plain = ({ children }) => (
  <div className="hc-plain">
    <span className="hc-plain-icon">💬</span>
    <span>{children}</span>
  </div>
);

const Block = ({ title, children }) => (
  <div className="hc-block">
    {title && <h3 className="hc-block-title">{title}</h3>}
    {children}
  </div>
);

const TsItem = ({ problem, solution }) => (
  <div className="hc-ts-item">
    <div className="hc-ts-q"><strong>{problem}</strong></div>
    <div className="hc-ts-a">{solution}</div>
  </div>
);

const CodeBox = ({ children }) => (
  <pre className="hc-code-box">{children}</pre>
);

// ══════════════════════════════════════════════════════════════════
const Help = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('guide');

  return (
    <HelpConsole
      open
      sections={SECTIONS}
      activeSection={activeSection}
      onSelect={setActiveSection}
      onClose={onClose}
      eyebrowPrefix="Skybox Generator"
    >

      {/* ═══ 01 HELP GUIDE ══════════════════════════════════════ */}
      {activeSection === 'guide' && (
        <>
          <Block title="Full Workflow Overview">
            <p className="hc-desc">
              The Skybox Generator configures four independent rendering techniques from FA's sky.fx
              shader — Atmosphere (dome gradient), Decal (planets), Cirrus (clouds), and Stars
              (billboard props). All four are serialised into a single <code>skyBox</code> Lua table
              injected into <code>data.lua</code>.
            </p>
            <Plain>
              Think of the skybox as four transparent layers stacked above the map. The bottom layer
              is the coloured dome gradient. Above that sit planet and star billboard sprites. On top
              of everything are the scrolling cloud layers. The generator lets you configure all four
              and writes the result into your map file in one click.
            </Plain>
            <Step index="01" title="Map Context"
              notes={['Wrong name → skyBox written to wrong data.lua', 'Auto-appends .v0001 if no version suffix found', 'Maps Folder path comes from global Settings']}>
              Map Name must exactly match your /maps subfolder including the version suffix
              (e.g. Hades_Dust.v0002). Map Size drives the Scale constant used by dome geometry
              and star world coordinates.
            </Step>
            <Step index="02" title="Atmosphere"
              notes={['horizonHeight/zenithHeight define the gradient Y range', 'SubtractHeight controls how far below the horizon the dome extends', 'Load a Library preset for working texture paths']}>
              Sets dome colours, heights, mesh subdivisions, and the two DDS textures (albedo + glow).
              The Dome Preview canvas updates live so you can judge the gradient before injecting.
            </Step>
            <Step index="03" title="Cirrus Clouds"
              notes={['freqX/Y: texture tiling density', 'speed + dirX/dirY: scroll rate and direction', 'cirrusMult: global brightness scale for all layers']}>
              Up to four cloud layers, each scrolling independently across the dome. sky.fx multiplies
              all four channel samples together to produce cloud opacity.
            </Step>
            <Step index="04" title="Planets"
              notes={['Positive Y = above horizon — keep Y well above terrain level', 'UV slot selects which sprite in the texture atlas is shown', 'Rotation is in radians — π/2 ≈ 1.571 = 90°']}>
              Each planet is a camera-facing billboard quad defined by world position, scale, rotation,
              and UV atlas region. The Decal technique in sky.fx renders them.
            </Step>
            <Step index="05" title="Stars"
              notes={['Cluster centers placed first, stars scattered around them', 'Exclusion zones block placement in defined sky regions', 'Fix seed before final run — re-inject replaces, does not append']}>
              Stars are placed procedurally using a seeded Gaussian cluster model. Each star becomes
              a billboard prop entry in the Planets block of the Lua output.
            </Step>
            <Step index="06" title="Output & Generate"
              notes={['All other data.lua content (lighting, water) is preserved', 'Re-generate is safe — same block overwritten each time', 'Back up data.lua before the first generate, just in case']}>
              The Lua Preview shows the full skyBox table. Inject unpacks the .scmap, replaces only
              the skyBox block in data.lua, and repacks — all in one step.
            </Step>
          </Block>

          <Block title="Best Practices">
            <Step index="①" title="Load a Library Preset First">
              The Library ships complete skyboxes with working albedo + glow DDS paths. Starting from
              a preset avoids the most common failure: a black sky caused by a broken texture path.
            </Step>
            <Step index="②" title="Set Map Context Before Anything Else">
              Map Name and Map Size affect output paths and star world coordinates. Getting these
              wrong means re-doing everything else.
            </Step>
            <Step index="③" title="Fix Star Seed Before Final Inject">
              Without a fixed seed, every Generate call produces a different layout. Re-inject
              overwrites — so a second run without a fixed seed gives a completely different sky.
            </Step>
            <Step index="④" title="Use the Dome Preview">
              The Dome Preview canvas shows the vertical gradient cross-section live. Injecting a
              gradient that looks wrong in the preview will look wrong in-game.
            </Step>
            <Step index="⑤" title="Keep cirrusMult Between 1 and 2">
              The shader multiplies four channel samples together. Values well above 2 push the
              product toward a uniform flat haze. Values below 1 make clouds faint.
            </Step>
            <Step index="⑥" title="Test Planets at scale=50 First">
              Planet scale is in world units. scale=50 at Y=500 is clearly visible and easy to
              reposition. Scale up once the position looks right.
            </Step>
          </Block>

          <Block title="Troubleshooting">
            <TsItem
              problem="Generate button is greyed out"
              solution="Map Name and Maps Folder must both be set. Map Name is in the Atmosphere section; Maps Folder is in global Settings. The Maps Folder must point to the folder that contains your map subfolder."
            />
            <TsItem
              problem="Nothing changes in-game after inject"
              solution="FA caches the .scmap on load. Close and fully reopen FA after injecting. Also confirm the .scmap modification date updated after inject."
            />
            <TsItem
              problem="skyBox block not found — inject fails"
              solution="data.lua must already contain a skyBox = { ... } block. Open the map in FA editor and save it at least once, then inject."
            />
          </Block>
        </>
      )}

      {/* ═══ 02 ATMOSPHERE ══════════════════════════════════════ */}
      {activeSection === 'atmosphere' && (
        <>
          <Block title="How the Gradient Works">
            <p className="hc-desc">
              AtmospherePS in sky.fx computes the gradient by mapping each dome vertex's world-Y
              elevation to a 0–1 blend value, then mixing between the two configured colours.
            </p>
            <CodeBox>{`tv = clamp((elevation − horizonBegin) / (horizonEnd − horizonBegin), 0, 1)
output = lerp(horizonColor, skyColor, 1 − tv)`}</CodeBox>
            <Step index="tv" title="Elevation normalisation">
              Maps the raw world-Y of each vertex into a 0–1 range. Below horizonBegin → tv = 0
              (pure horizon colour). Above horizonEnd → tv = 1 (pure zenith colour). Everything
              between is a smooth linear mix.
            </Step>
            <Step index="lerp" title="Final colour blend">
              output = lerp(horizonColor, skyColor, 1 − tv). t = 0 gives pure horizonColor at the
              base; t = 1 gives pure skyColor at the top.
            </Step>
          </Block>

          <Block title="Dome Geometry Parameters">
            <Step index="Scale" title="Scale = MapSize × 2.288"
              notes={['Changing Map Size scales all billboard positions in the sky proportionally', 'Star and planet world coordinates must be sized relative to this value']}>
              Physical radius of the sky sphere in world units, computed automatically from Map Size.
              A 1024-unit map produces a dome radius of ~2343 world units.
            </Step>
            <Step index="SH" title="SubtractHeight → SphereLerp"
              notes={['Higher SubtractHeight → dome extends further below horizon', 'Default 1.2566 (≈ π/2.5) is the FA standard value']}>
              SphereLerp = 1 − (SubtractHeight × 2 / π). Controls how far the dome extends below
              the equator.
            </Step>
            <Plain>
              Without subtracting any height, the dome would be a perfect hemisphere with a hard
              visible edge at the horizon. SubtractHeight pulls the dome past the horizon so the
              gradient colour blends smoothly into the terrain instead of cutting off sharply.
            </Plain>
            <Step index="sA" title="SubdivAxis — horizontal segments"
              notes={['16 is the FA standard — no visible faceting at game camera distances', 'Values above 64 rarely produce visible improvement']}>
              Number of horizontal polygon columns around the dome.
            </Step>
            <Step index="sH" title="SubdivHeight — vertical rings"
              notes={['Only increase if visible gradient banding appears in the sky']}>
              Number of vertical polygon rows. FA standard is 6.
            </Step>
          </Block>

          <Block title="Albedo & Glow Textures">
            <Step index="P0" title="Albedo Pass — DecalAlbedoPS"
              notes={['Blank path → no texture, pure gradient only']}>
              Samples the albedo DDS and writes its full RGBA to the render target using standard
              alpha blending. This is the primary sky texture.
            </Step>
            <Step index="P1" title="Glow Pass — DecalGlowPS"
              notes={['Default Decal Glow Multiplier: 0.1 — subtle haze', 'Values above 0.5 produce very intense atmospheric effects', 'Set to 0 to disable glow without removing the texture path']}>
              Reads only the alpha channel: output.a = decalGlowMultiplier × texel.a. High-alpha
              regions in the glow DDS produce bright atmospheric haze.
            </Step>
            <Plain>
              The glow pass doesn't add colour — it adds brightness. Decal Glow Multiplier scales
              the overall intensity — set it to 0 to fully suppress glow.
            </Plain>
          </Block>

          <Block title="Troubleshooting">
            <TsItem problem="Sky is completely black" solution="The albedo DDS path is wrong or the file does not exist. sky.fx silently renders nothing if the sampler finds no file. Load a Library preset to get a guaranteed working path." />
            <TsItem problem="Dome is a single flat colour — no gradient" solution="horizonHeight and zenithHeight are equal or inverted. Ensure zenithHeight is clearly above horizonHeight." />
            <TsItem problem="Colour seam visible at terrain edge" solution="Set horizonHeight to a negative value (e.g. −100). Pure horizonColor below horizonBegin extends below the terrain, hiding the boundary line." />
          </Block>
        </>
      )}

      {/* ═══ 03 CIRRUS CLOUDS ═══════════════════════════════════ */}
      {activeSection === 'cirrus' && (
        <>
          <Block title="Multiplicative Layer Blending">
            <p className="hc-desc">
              CirrusPS samples the cloud DDS four times — each layer reading a different colour
              channel (R, G, B, A) at its own independently scrolling UV position. All four values
              are multiplied together to produce the final cloud opacity.
            </p>
            <CodeBox>{`c0=tex(...).r  ·  c1=tex(...).g  ·  c2=tex(...).b  ·  c3=tex(...).a
alpha = cirrusMultiplier × c0 × c1 × c2 × c3`}</CodeBox>
            <Step index="①" title="Same DDS, four channels"
              notes={['Channels are typically authored as four different noise octaves in the RGBA DDS', 'Unused layers: set speed=0 and low frequency — do not leave uninitialised']}>
              The texture is sampled four times at different UV positions. Each layer reads a
              different colour channel — R, G, B, A — so one DDS file carries four independent
              cloud density maps.
            </Step>
            <Step index="②" title="Multiplication is AND-logic">
              c0 × c1 × c2 × c3 is only large where all four channels are large. A single layer at
              0.3 caps the total to at most 0.3, regardless of the other three.
            </Step>
            <Plain>
              Imagine four transparent sheets of cloud laid on top of each other. A cloud is only
              bright where all four sheets are bright at the same spot. This AND-like logic produces
              complex shapes from simple textures.
            </Plain>
            <Step index="③" title="cirrusMultiplier"
              notes={['Values above ~2.5 push most of the sky toward full cloud opacity — uniform haze', 'Set to 0 for instant debugging — all clouds disappear, gradient visible underneath']}>
              Scales the final product before writing to alpha. Default 1.8.
            </Step>
          </Block>

          <Block title="UV Scroll Formula">
            <Step index="①" title="direction = normalize(cirrus.direction)"
              notes={['(1,0) scrolls east · (0,1) scrolls north · (−1,0) scrolls west']}>
              Normalises dirX/dirY to a unit vector. The generator stores the raw values — the
              shader normalises them.
            </Step>
            <Step index="②" title="Frequency"
              notes={['Typical freqX/Y: 0.0001 (coarse) to 0.005 (fine detail)']}>
              freqX and freqY are the zoom level of the cloud pattern. Low values (0.0001) produce
              large coarse clouds. High values (0.005) produce fine wispy clouds with many repetitions.
            </Step>
            <Step index="③" title="Speed & time offset"
              notes={['Keep speed below 15 for smooth motion — very high values produce visible per-frame jumps', 'speed=0 → static layer, no movement']}>
              speed controls how fast the whole pattern slides in world units per frame tick.
            </Step>
          </Block>

          <Block title="Best Practices">
            <Step index="①" title="Different Speeds Per Layer">
              Layers at the same speed move in lock-step — cloud gaps repeat visibly. Use e.g. 7.8,
              1.28, 0, 0.55 across the four layers to break synchronisation permanently.
            </Step>
            <Step index="②" title="Different Frequencies Per Layer">
              Vary them (e.g. 0.0001, 0.001, 0.0006, 0.003) to get both large and fine cloud
              structure simultaneously.
            </Step>
            <Step index="③" title="One Static Base Layer">
              Set speed=0 on one layer for a fixed base distribution. Moving layers add variation on
              top. This prevents the sky from ever going completely clear between moving patches.
            </Step>
          </Block>

          <Block title="Troubleshooting">
            <TsItem problem="Clouds completely invisible" solution="cirrusMultiplier is 0, or the DDS path is broken. Set multiplier to 1.8 and confirm the texture exists. The DDS must use WRAP address mode — a CLAMP texture produces invisible results near the dome edges." />
            <TsItem problem="Uniform flat haze instead of cloud shapes" solution="cirrusMultiplier is too high. Lower it to 1.0–1.5. Also ensure layers have different frequencies — identical freqX/Y across all four layers eliminates the multiplicative contrast." />
            <TsItem problem="Cloud movement looks jerky" solution="Speed values are too large (>20). Keep speed below 15 for smooth motion." />
          </Block>
        </>
      )}

      {/* ═══ 04 PLANETS ═════════════════════════════════════════ */}
      {activeSection === 'planets' && (
        <>
          <Block title="Billboard Construction (DecalVS)">
            <p className="hc-desc">
              DecalVS builds each billboard from a two-triangle corner-pair quad. It rotates the
              corners by the planet's rotation, scales them by the size field, then offsets them from
              the anchor along the camera's viewRight and viewUp vectors.
            </p>
            <Step index="①" title="Rotation"
              notes={['π/2 ≈ 1.571 = 90°  ·  π ≈ 3.14 = 180°  ·  2π ≈ 6.28 = full rotation', 'Rotation spins the sprite around its own center — does not change world position']}>
              position.w is your Rotation field in radians. The four quad corners are rotated around
              the billboard center by this angle before scaling.
            </Step>
            <Step index="②" title="UV atlas mapping"
              notes={['Standard 2×2 atlas: top-left (0,0,0.5,0.5) · top-right (0.5,0,0.5,0.5) · full texture (0,0,1,1)', 'x+z ≤ 1.0 and y+w ≤ 1.0 — exceeding 1.0 causes wrapping artefacts']}>
              UV (x,y,z,w): x,y is the starting corner (top-left); z,w is the sprite size in UV
              space. The shader applies texcoord.y = 1 − texcoord.y internally — enter Y as if Y=0
              is the top of the image.
            </Step>
            <Plain>
              x,y is the top-left corner of the sprite in the atlas (after the shader's Y-flip).
              z,w is how wide and tall the sprite region is. Enter values matching how the image
              looks in your editor — top row = 0, bottom row = 0.5.
            </Plain>
            <Step index="③" title="Billboard placement"
              notes={['Positive Y = above horizon. Negative Y = below terrain, invisible', 'Keep Y at 300+ to ensure the planet sits above terrain on all map sizes']}>
              The rotated, scaled corner offset is added along the camera's world-space right and up
              axes. This guarantees the quad faces the camera regardless of view angle.
            </Step>
          </Block>

          <Block title="Troubleshooting">
            <TsItem problem="Planet not visible in-game" solution="Check that Y is positive and large enough. Verify the UV region is not pointing to a transparent atlas area — use (0,0,1,1) to display the full texture as a quick test." />
            <TsItem problem="Planet in wrong part of the sky" solution="Adjust X and Z in increments of 500+ — the dome is very large. Y controls altitude (higher = more directly overhead)." />
            <TsItem problem="Planet looks squashed or stretched" solution="Scale X and Scale Y control half-extents independently. Set both to the same value for a circular planet." />
          </Block>
        </>
      )}

      {/* ═══ 05 STARS ═══════════════════════════════════════════ */}
      {activeSection === 'stars' && (
        <>
          <Block title="Placement Algorithm">
            <p className="hc-desc">
              Stars are placed procedurally using a seeded Gaussian cluster model. Cluster anchor
              points are generated first; each star is then placed either near an anchor using a
              bell-curve offset, or uniformly across the full sky as a background star.
            </p>
            <Step index="①" title="Cluster centers"
              notes={['Centers placed once, shared by all cluster stars', 'Each cluster star picks a center by random index — natural uneven distribution']}>
              nClusters anchor points are placed before any stars. X and Z are uniform random in
              ±spread. Y follows the selected distribution mode.
            </Step>
            <Step index="②" title="Background / cluster coin flip"
              notes={['bgRatio=0.0: all stars cluster · bgRatio=1.0: all background', 'Coin re-flips on retry — mode can switch between attempts']}>
              rng() &lt; backgroundRatio — one draw per attempt. Background stars land uniformly
              across ±spread. Cluster stars scatter around a randomly chosen center using a Gaussian offset.
            </Step>
            <Plain>
              A weighted coin decides each star's mode. backgroundRatio=0.45 means roughly 45% go
              to background, 55% to a cluster. Because the coin re-flips on retry, a rejected star
              might switch modes on the next attempt — this is intentional.
            </Plain>
            <Step index="③" title="Gaussian cluster offset (Box-Muller)"
              notes={['Stars can land outside ±spread if the Gaussian tail is wide', 'Background stars use simple uniform XZ in ±spread instead']}>
              result = std × √(−2 × ln(u1)) × cos(2π × u2). Applied independently to X and Z.
              Produces values concentrated near zero — most cluster stars land within ±1 clusterStdDev
              of their center.
            </Step>
            <Step index="④" title="Exclusion zone check"
              notes={['No RNG consumed on rejection — zones do not shift the seed sequence', 'Max 50 × nStars total attempts — generator gives up if ceiling is hit']}>
              Each committed zone defines a world-XZ rectangle. If the candidate position falls
              inside any active zone, the position is discarded and the loop restarts.
            </Step>
            <Step index="⑤" title="UV, scale, rotation"
              notes={['UV: weighted random from the UV rows table', 'Scale: uniform random in [scaleMin, scaleMax]', 'Rotation: uniform random in [0, 2π]']}>
              weightedPick selects a UV row (1 RNG call). scale = lerp(scaleMin, scaleMax, rng()).
              rotation = rng() × 2π.
            </Step>
          </Block>

          <Block title="Y-Distribution Modes">
            <Step index="flat" title="flat" notes={['1 RNG call per Y sample']}>
              Uniform random Y in [0, yMax]. All heights equally likely. Best starting point.
            </Step>
            <Step index="gauss" title="gaussian" notes={['2 RNG calls per sample (Box-Muller)', 'Result clamped to [0, yMax]']}>
              Bell curve centered at yCenter with standard deviation yStdDev. Stars concentrate
              near yCenter.
            </Step>
            <Step index="layer" title="layered" notes={['1 RNG call for band pick + 2 for the Gaussian sample']}>
              Multiple Gaussian bands. Each row defines center, stdDev, weight. Useful for
              galaxy-arm structures with distinct altitude layers.
            </Step>
            <Step index="disk" title="disk_halo" notes={['Low diskStdDev + high haloStdDev = sharp disk with diffuse outer glow']}>
              Two-component model: a dense Gaussian disk plus a diffuse spherical halo. Most
              realistic Milky Way profile.
            </Step>
            <Step index="curve" title="curve" notes={['Fully freeform — any distribution shape possible']}>
              Custom probability density drawn interactively on the curve editor canvas. Control
              points define the probability of landing at each height.
            </Step>
          </Block>

          <Block title="Seed & Reproducibility">
            <p className="hc-desc">
              The seed generates one deterministic sequence of random numbers consumed left to right.
              Any change that affects an earlier draw shifts all subsequent star positions — even with
              the same seed value.
            </p>
            <Plain>
              Changing nClusters means it reads a different count of values for the centers, shifting
              everything that follows. Safe changes: numStars, UV weights, exclusion zones.
              Unsafe: nClusters, spread, stdDev, backgroundRatio, Y-mode parameters.
            </Plain>
          </Block>

          <Block title="Troubleshooting">
            <TsItem problem="Stars appear at ground level" solution="yMax is too small, or yMode is 'flat' with a very low Max Height. Increase yMax to 500–1500. Also draw an exclusion zone around world (0,0) to block the map-center ground area." />
            <TsItem problem="Star layout changes every run" solution="Fixed Seed is disabled. Enable it, pick a seed, and lock it before the final generate." />
            <TsItem problem="Fewer stars than requested" solution="Exclusion zones may cover too much sky area, causing the 50×nStars attempt ceiling to be hit. Reduce zone size, or reduce nClusters so more cluster centers land outside zones." />
          </Block>
        </>
      )}

      {/* ═══ 06 OUTPUT & INJECT ═════════════════════════════════ */}
      {activeSection === 'output' && (
        <>
          <Block title="Lua Output Format">
            <p className="hc-desc">
              The skyBox table maps directly to sky.fx shader variables. Colours are linear RGB 0–1.
              The Planets array contains both manual planets and generated stars interleaved in
              insertion order.
            </p>
            <CodeBox>{`skyBox = {
    HorizonColor = { R, G, B, 1 },  -- horizonColor (linear 0–1)
    ZenithColor  = { R, G, B, 1 },  -- skyColor
    HorizonHeight = N,               -- horizonBegin in sky.fx
    ZenithHeight  = N,               -- horizonEnd in sky.fx
    Scale         = N,               -- dome radius (MapSize × 2.288)
    SubtractHeight = N,
    SubdivAxis    = N,
    SubdivHeight  = N,
    DecalGlowMultiplier = N,
    Albedo  = '/path/to/albedo.dds',
    Glow    = '/path/to/glow.dds',
    CirrusMultiplier = N,
    CirrusColor = { R, G, B },
    Cirrus = {
        { freqX, freqY, speed, dirX, dirY },  -- 4 entries always written
    },
    Planets = {
        { position = {X,Y,Z}, rotation = R,
          scale = {SX,SY}, uv = {X,Y,Z,W} },  -- planets + stars combined
    },
}`}</CodeBox>
          </Block>

          <Block title="IPC Injection Pipeline">
            <p className="hc-desc">
              The inject operation runs entirely via IPC calls to the main Electron process. It
              decompresses the .scmap, patches data.lua with a regex replacement, and recompresses
              — all other map data is untouched.
            </p>
            <Plain>
              A .scmap is a compressed archive — like a zip file. Inside it is data.lua, a plain
              text file defining the skybox, lighting, and water for your map. The injector opens
              the archive, finds the skyBox block in that text, replaces it with the new
              configuration, and closes the archive again. Every other part of the file is untouched.
            </Plain>
            <Step index="1" title="Find .scmap" notes={['Uses first .scmap if multiple exist', 'FA must have run at least one save']}>
              Scans the map folder for a file ending in .scmap.
            </Step>
            <Step index="2" title="Unpack" notes={['Snapshot enables revert via history']}>
              scmap-unpack IPC call decompresses the binary .scmap into a temp folder. A history
              snapshot is taken before any modification.
            </Step>
            <Step index="3" title="Replace skyBox block" notes={['Re-generate is safe — same block overwritten, never appended']}>
              A regex finds <code>skyBox = {'{ ... }'}</code> in data.lua and replaces it with the
              newly generated table. Only the skyBox key is touched.
            </Step>
            <Step index="4" title="Repack & copy back">
              scmap-pack compresses the modified temp folder into a new .scmap binary. The result
              overwrites the original map file.
            </Step>
          </Block>

          <Block title="Troubleshooting">
            <TsItem problem="Nothing changes in-game after inject" solution="FA caches the .scmap on load. Close and fully reopen FA after injecting. Confirm the .scmap modification date changed — if it did not, inject failed silently." />
            <TsItem problem="skyBox block not found — inject fails" solution="data.lua must already contain a skyBox = { ... } block. Open the map in FA editor and save it at least once, then inject." />
            <TsItem problem="Colours look blown out" solution="FA uses linear RGB 0–1. Values entered as 0–255 will be far too bright. Divide by 255 first — e.g. 200 → 0.784." />
          </Block>
        </>
      )}

    </HelpConsole>
  );
};

export default Help;
