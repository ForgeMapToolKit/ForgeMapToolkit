import React, { useState } from 'react';
import { EntityCard, EntityCardGrid, AddTile, DropSlot } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/* Collapsible per-card subsection — same idiom as RockErosion's RulePrefsBlock:
   local open state, trace-subsection header toggles, stopPropagation so
   clicks never bubble up to the card's own onSelect. */
function CardSubsection({ title, initialOpen = false, children }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 'var(--space-lg)' }}>
      <div className="trace-subsection" onClick={() => setOpen(o => !o)}>{title}</div>
      {open && <div style={{ marginTop: 'var(--space-sm)' }}>{children}</div>}
    </div>
  );
}

export default function TreesCards({
  propCards, selectedProp, setSelectedProp,
  availableColors, showColorPicker, setShowColorPicker,
  deleteAllPropCards, addPropCard, deletePropCard, updatePropCard,
  removeBlueprintPath, updateBlueprintPath,
  onOpenBlueprintLibrary,
  handleCardHeightmapFile, clearCardHeightmap,
  handleDetermineAreaFile, clearDetermineArea,
  handlePropDensityMapFile, clearPropDensityMap,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Prop Cards</div>
        <div className="ctrl-content">

          {propCards.length >= 1 && (
            <div className="ctrl-action-row">
              <button className="ctrl-btn-danger" onClick={deleteAllPropCards}>Delete All</button>
            </div>
          )}

          <EntityCardGrid>
            {propCards.map((card, idx) => (
              <EntityCard
                key={card.id}
                index={idx}
                color={card.color}
                selected={idx === selectedProp}
                onSelect={() => setSelectedProp(idx)}
                onDelete={() => deletePropCard(idx)}
                title={(card.propName || `Prop ${idx + 1}`).toUpperCase()}
                availableColors={availableColors}
                showColorPicker={showColorPicker === idx}
                onToggleColorPicker={() => setShowColorPicker(showColorPicker === idx ? null : idx)}
                onPickColor={(color) => { updatePropCard(idx, 'color', color); setShowColorPicker(null); }}
              >
                {idx === selectedProp && (
                  <div onClick={(e) => e.stopPropagation()}>

                    <div className="ctrl-field">
                      <input
                        type="text"
                        className="ctrl-input ctrl-input--text"
                        value={card.propName}
                        onChange={(e) => updatePropCard(idx, 'propName', e.target.value)}
                        placeholder="Prop name..."
                      />
                    </div>

                    <div className="trace-subsection">Blueprint Paths</div>
                    <div className="ctrl-row-gap">
                      {card.blueprintPaths.map((path, pi) => (
                        <div key={pi} className="ctrl-row">
                          <input
                            className="ctrl-input field-input--mono"
                            value={path}
                            onChange={(e) => updateBlueprintPath(idx, pi, e.target.value)}
                            placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp"
                          />
                          <button className="ctrl-btn-delete" onClick={() => removeBlueprintPath(idx, pi)}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className="ctrl-action-row">
                      <button className="ftr-preview-readmore" onClick={() => onOpenBlueprintLibrary(idx)}>Library</button>
                    </div>

                    {/* Density & Diffusion — open state IS card.customValuesOpen: opening
                        this block is what activates the per-card override in generation,
                        exactly like the legacy tab-bar toggle did. */}
                    <div style={{ marginTop: 'var(--space-lg)' }}>
                      <div
                        className="trace-subsection"
                        onClick={() => updatePropCard(idx, 'customValuesOpen', !card.customValuesOpen)}
                      >
                        Density &amp; Diffusion Override
                      </div>
                      {card.customValuesOpen && (
                        <div className="tm-density-grid" style={{ marginTop: 'var(--space-sm)' }}>
                          <div className="ctrl-field">
                            <div className="ctrl-label">Density Multiplier</div>
                            <input
                              type="number" step="0.1" min="0.00001"
                              className="ctrl-input"
                              value={card.customDensityMultiplier}
                              onChange={(e) => updatePropCard(idx, 'customDensityMultiplier', e.target.value)}
                              onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) updatePropCard(idx, 'customDensityMultiplier', '0.00001'); }}
                            />
                          </div>
                          <div className="ctrl-field">
                            <div className="ctrl-label">Diffusion (0–100)</div>
                            <input
                              type="number" step="1" min="0" max="100"
                              className="ctrl-input"
                              value={card.customDiffusion}
                              onChange={(e) => updatePropCard(idx, 'customDiffusion', e.target.value)}
                              onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) updatePropCard(idx, 'customDiffusion', '0'); else if (v > 100) updatePropCard(idx, 'customDiffusion', '100'); }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <CardSubsection title="Terrain Rules" initialOpen={card.allowWaterSpawn || card.slopeMin !== '0' || card.slopeMax !== '90'}>
                      <button
                        type="button"
                        className={`ctrl-toggle-row${card.allowWaterSpawn ? ' on' : ''}`}
                        role="switch"
                        aria-checked={!!card.allowWaterSpawn}
                        onClick={() => updatePropCard(idx, 'allowWaterSpawn', !card.allowWaterSpawn)}
                      >
                        <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
                        <span className="ctrl-toggle-text">
                          <span className="ctrl-toggle-label">Allow Spawn In Water</span>
                        </span>
                      </button>
                      <div className="tm-density-grid" style={{ marginTop: 'var(--space-sm)' }}>
                        <div className="ctrl-field">
                          <div className="ctrl-label">Min Slope (°)</div>
                          <input
                            type="number" step="1" min="0" max="90"
                            className="ctrl-input"
                            value={card.slopeMin ?? '0'}
                            onChange={(e) => updatePropCard(idx, 'slopeMin', e.target.value)}
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) updatePropCard(idx, 'slopeMin', '0'); }}
                          />
                        </div>
                        <div className="ctrl-field">
                          <div className="ctrl-label">Max Slope (°)</div>
                          <input
                            type="number" step="1" min="0" max="90"
                            className="ctrl-input"
                            value={card.slopeMax ?? '90'}
                            onChange={(e) => updatePropCard(idx, 'slopeMax', e.target.value)}
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (isNaN(v) || v > 90) updatePropCard(idx, 'slopeMax', '90'); }}
                          />
                        </div>
                      </div>
                    </CardSubsection>

                    <CardSubsection title="Custom Treeline" initialOpen={!!card.customTreelineImage}>
                      <DropSlot
                        acceptInput="image/*"
                        status={card.customTreelineImage ? 'done' : 'idle'}
                        idleText="Click or drop a custom heightmap"
                        doneText="Heightmap loaded"
                        onChange={(file) => handleCardHeightmapFile(idx, file)}
                        onClear={() => clearCardHeightmap(idx)}
                      />
                      <div className="ctrl-field" style={{ marginTop: 'var(--space-sm)' }}>
                        <div className="ctrl-label">Treeline Cutoff (0–255) <span className="tm-slider-value">{card.customTreeline}</span></div>
                        <input type="range" min="0" max="255" step="1" value={card.customTreeline} onChange={(e) => updatePropCard(idx, 'customTreeline', e.target.value)} />
                        <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={card.customTreeline} onChange={(e) => updatePropCard(idx, 'customTreeline', e.target.value)} />
                      </div>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Treeline Min (0–255) <span className="tm-slider-value">{card.customTreelineMin}</span></div>
                        <input type="range" min="0" max="255" step="1" value={card.customTreelineMin} onChange={(e) => updatePropCard(idx, 'customTreelineMin', e.target.value)} />
                        <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={card.customTreelineMin} onChange={(e) => updatePropCard(idx, 'customTreelineMin', e.target.value)} />
                      </div>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Min Gradient Width <span className="tm-slider-value">{card.customTreelineMinGradient}</span></div>
                        <input type="range" min="0" max="255" step="1" value={card.customTreelineMinGradient} onChange={(e) => updatePropCard(idx, 'customTreelineMinGradient', e.target.value)} />
                        <input type="number" min="0" max="255" step="1" className="ctrl-input tm-slider-number" value={card.customTreelineMinGradient} onChange={(e) => updatePropCard(idx, 'customTreelineMinGradient', e.target.value)} />
                      </div>
                    </CardSubsection>

                    <CardSubsection title="Determine Area" initialOpen={!!card.determineAreaImage}>
                      <DropSlot
                        acceptInput="image/*"
                        status={card.determineAreaImage ? 'done' : 'idle'}
                        idleText="Click or drop a placement mask"
                        doneText="Area loaded"
                        onChange={(file) => handleDetermineAreaFile(idx, file)}
                        onClear={() => clearDetermineArea(idx)}
                      />
                    </CardSubsection>

                    <CardSubsection title="Prop Density Map" initialOpen={!!card.propDensityMapImage}>
                      <DropSlot
                        acceptInput="image/*"
                        status={card.propDensityMapImage ? 'done' : 'idle'}
                        idleText="Click or drop a per-card density mask"
                        doneText="Density Map loaded"
                        onChange={(file) => handlePropDensityMapFile(idx, file)}
                        onClear={() => clearPropDensityMap(idx)}
                      />
                    </CardSubsection>

                  </div>
                )}
              </EntityCard>
            ))}
            <AddTile label="Add Prop Card" onClick={addPropCard} />
          </EntityCardGrid>

        </div>
      </div>
    </div>
  );
}
