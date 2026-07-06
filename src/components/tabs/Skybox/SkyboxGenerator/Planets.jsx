/**
 * SkyboxGenerator_Planets.jsx — Sektion 03: Planets (manuell)
 *
 * Rein präsentational.
 */
import React from 'react';
import { PLANET_UV_COLORS } from './utils.js';

const Planets = ({ planets, onAddPlanet, onRemovePlanet, onUpdatePlanet }) => {
  return (
    <div className="skybox-section-stack">
      <div className="skybox-section-card">
        <div className="skybox-card-header">
          <h2 className="skybox-section-title">Manual Planets ({planets.length})</h2>
          <button className="btn-secondary" onClick={onAddPlanet}>+ Add Planet</button>
        </div>
        <p className="skybox-form-help" style={{marginBottom:'16px'}}>
          Manual planets are placed at exact world coordinates. For procedural stars, use the Stars section.
        </p>

        {planets.length === 0 && (
          <div className="sb-empty-state">No planets added yet.</div>
        )}

        {planets.map((planet, i) => {
          const col = PLANET_UV_COLORS[i % PLANET_UV_COLORS.length];
          return (
            <div key={planet.id} className="sb-planet-card" style={{borderLeft:`3px solid ${col}`}}>
              <div className="sb-planet-card-header">
                <span style={{color:col, fontWeight:700, fontFamily:'monospace', fontSize:'0.8rem'}}>
                  P{String(i+1).padStart(2,'0')}
                </span>
                <button className="btn-delete-xs" onClick={() => onRemovePlanet(planet.id)}>×</button>
              </div>

              <div className="skybox-form-group">
                <label className="skybox-form-label">Position (X, Y, Z)</label>
                <div className="skybox-form-row">
                  {['x','y','z'].map(axis => (
                    <input key={axis} className="skybox-input" style={{minWidth:0}}
                      value={planet[axis]}
                      onChange={e=>onUpdatePlanet(planet.id,axis,e.target.value)}
                      placeholder={axis.toUpperCase()}/>
                  ))}
                </div>
              </div>

              <div className="skybox-form-row">
                <div className="skybox-form-group">
                  <label className="skybox-form-label">Rotation</label>
                  <input className="skybox-input" value={planet.rotation}
                    onChange={e=>onUpdatePlanet(planet.id,'rotation',e.target.value)}/>
                </div>
                <div className="skybox-form-group">
                  <label className="skybox-form-label">Scale X</label>
                  <input className="skybox-input" value={planet.scaleX}
                    onChange={e=>onUpdatePlanet(planet.id,'scaleX',e.target.value)}/>
                </div>
                <div className="skybox-form-group">
                  <label className="skybox-form-label">Scale Y</label>
                  <input className="skybox-input" value={planet.scaleY}
                    onChange={e=>onUpdatePlanet(planet.id,'scaleY',e.target.value)}/>
                </div>
              </div>

              <div className="skybox-form-group">
                <label className="skybox-form-label">UV (X, Y, Z, W)</label>
                <div className="skybox-form-row">
                  {['uvX','uvY','uvZ','uvW'].map(field => (
                    <input key={field} className="skybox-input" style={{minWidth:0}}
                      value={planet[field]}
                      onChange={e=>onUpdatePlanet(planet.id,field,e.target.value)}
                      placeholder={field.slice(2)}/>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Planets;
