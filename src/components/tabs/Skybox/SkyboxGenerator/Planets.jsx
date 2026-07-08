/**
 * SkyboxGenerator_Planets.jsx — Sektion 03: Planets (manuell)
 *
 * Rein präsentational.
 */
import React from 'react';
import { EntityCardGrid, EntityCard, AddTile } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { PLANET_UV_COLORS } from './utils.js';

const Planets = ({
  planets, onAddPlanet, onRemovePlanet, onUpdatePlanet,
  decalGlowMult, setDecalGlowMult, albedo, setAlbedo, glow, setGlow,
}) => {
  return (
    <div className="ctrl-col">

      {/* Decal Textures — the technique sky.fx uses to render these planet billboards */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Decal Textures</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Decal Glow Multiplier</div>
            <input className="ctrl-input" value={decalGlowMult} onChange={e=>setDecalGlowMult(e.target.value)} placeholder="0.1"/>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Albedo Texture</div>
            <input className="ctrl-input ctrl-input--text" value={albedo} onChange={e=>setAlbedo(e.target.value)}/>
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Glow Texture</div>
            <input className="ctrl-input ctrl-input--text" value={glow} onChange={e=>setGlow(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Manual Planets ({planets.length})</div>
        <div className="ctrl-content">
          <p className="sb-field-help">
            Manual planets are placed at exact world coordinates. For procedural stars, use the Stars section.
          </p>

          <EntityCardGrid>
            {planets.map((planet, i) => {
              const col = PLANET_UV_COLORS[i % PLANET_UV_COLORS.length];
              return (
                <EntityCard
                  key={planet.id}
                  index={i}
                  color={col}
                  title={`P${String(i + 1).padStart(2, '0')}`}
                  onDelete={() => onRemovePlanet(planet.id)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="ctrl-field">
                      <div className="ctrl-label">Position (X, Y, Z)</div>
                      <div className="ctrl-row">
                        {['x', 'y', 'z'].map(axis => (
                          <input key={axis} className="ctrl-input"
                            value={planet[axis]}
                            onChange={e => onUpdatePlanet(planet.id, axis, e.target.value)}
                            placeholder={axis.toUpperCase()} />
                        ))}
                      </div>
                    </div>

                    <div className="sb-cfg-row sb-cfg-row--3">
                      <div className="ctrl-field">
                        <div className="ctrl-label">Rotation</div>
                        <input className="ctrl-input" value={planet.rotation}
                          onChange={e => onUpdatePlanet(planet.id, 'rotation', e.target.value)} />
                      </div>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Scale X</div>
                        <input className="ctrl-input" value={planet.scaleX}
                          onChange={e => onUpdatePlanet(planet.id, 'scaleX', e.target.value)} />
                      </div>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Scale Y</div>
                        <input className="ctrl-input" value={planet.scaleY}
                          onChange={e => onUpdatePlanet(planet.id, 'scaleY', e.target.value)} />
                      </div>
                    </div>

                    <div className="ctrl-field">
                      <div className="ctrl-label">UV (X, Y, Z, W)</div>
                      <div className="ctrl-row">
                        {['uvX', 'uvY', 'uvZ', 'uvW'].map(field => (
                          <input key={field} className="ctrl-input"
                            value={planet[field]}
                            onChange={e => onUpdatePlanet(planet.id, field, e.target.value)}
                            placeholder={field.slice(2)} />
                        ))}
                      </div>
                    </div>
                  </div>
                </EntityCard>
              );
            })}
            <AddTile label="Add Planet" onClick={onAddPlanet} />
          </EntityCardGrid>
        </div>
      </div>
    </div>
  );
};

export default Planets;
