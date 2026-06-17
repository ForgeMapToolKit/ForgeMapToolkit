import React from 'react';
import { luxuryConfirm } from '../../../modals/notifications';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
} from '../../../shared/entity-console/EntityConsole.jsx';

export default function EmitterEmitters({
  emitterCards, selectedCard, setSelectedCard,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  deleteAllEmitterCards, addEmitterCard, deleteEmitterCard, updateCard,
  addEmitterCardCategory, updateEmitterCardCategory, deleteEmitterCardCategory,
  updateCardRandomness, handleGenerateGrid,
  addManualCoordinate, updateCoordinate, deleteCoordinate, clearCoordinates,
}) {
  return (
    <>
      <div className="trace-section-head" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {emitterCards.length >= 1 && (
            <button className="action-button action-button--danger" onClick={deleteAllEmitterCards}>
              Delete All
            </button>
          )}
        </div>
      </div>

      <EntityCardGrid>
        {emitterCards.map((card, ci) => (
          <EntityCard
            key={card.id}
            index={ci}
            color={card.color}
            selected={ci === selectedCard}
            onSelect={() => setSelectedCard(ci)}
            onDelete={() => deleteEmitterCard(ci)}
            title={card.label ? card.label.toUpperCase() : `Emitter ${ci + 1}`}
            availableColors={availableColors}
            showColorPicker={showColorPicker === ci}
            onToggleColorPicker={() => setShowColorPicker(showColorPicker === ci ? null : ci)}
            onPickColor={(c) => { updateCard(ci, 'color', c); setShowColorPicker(null); }}
          >
            {ci === selectedCard && (<>
              {/* Label */}
              <div className="form-group">
                <label className="field-label">Label</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="e.g. Fire Emitters"
                  value={card.label}
                  onChange={e => { e.stopPropagation(); updateCard(ci, 'label', e.target.value); }}
                  onClick={e => e.stopPropagation()}
                />
              </div>

              {/* Categories */}
              <div className="form-group">
                <label className="field-label">Emitter Categories (optional)</label>
                {(card.emitterCategories || []).map((cat, catIdx) => (
                  <div key={catIdx} className="ec-input-row">
                    <input
                      type="text"
                      className="field-input"
                      value={cat}
                      onChange={e => { e.stopPropagation(); updateEmitterCardCategory(ci, catIdx, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      placeholder={`Category ${catIdx + 1} (e.g. Smoke, Fog)`}
                    />
                    <button className="delete-button" onClick={e => { e.stopPropagation(); deleteEmitterCardCategory(ci, catIdx); }}>×</button>
                  </div>
                ))}
                <button
                  className="action-button action-button--full"
                  onClick={e => { e.stopPropagation(); addEmitterCardCategory(ci); }}
                >
                  Add Category
                </button>
              </div>

              {/* Grid Placement */}
              <div className="subsection-head">
                <span className="subsection-head-title">Grid Placement</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: '0.72rem' }}>X Step</label>
                  <input
                    type="number" min="1"
                    className="field-input field-input--sm"
                    placeholder="64"
                    value={card.gridStepX}
                    onChange={e => { e.stopPropagation(); updateCard(ci, 'gridStepX', e.target.value); }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label" style={{ fontSize: '0.72rem' }}>Z Step</label>
                  <input
                    type="number" min="1"
                    className="field-input field-input--sm"
                    placeholder="64"
                    value={card.gridStepZ}
                    onChange={e => { e.stopPropagation(); updateCard(ci, 'gridStepZ', e.target.value); }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
              <button
                className="action-button action-button--full"
                style={{ marginBottom: 'var(--space-lg)' }}
                disabled={!card.gridStepX || !card.gridStepZ}
                onClick={e => { e.stopPropagation(); handleGenerateGrid(ci); }}
              >Generate Grid</button>

              {/* Per-card randomness */}
              <div className="subsection-head">
                <span className="subsection-head-title">Card Randomness Override</span>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="field-label" style={{ fontSize: '0.72rem' }}>Poisson Min. Distance</label>
                <input
                  type="number" min="0"
                  className="field-input field-input--sm"
                  placeholder="0"
                  value={card.randomness.poissonRadius}
                  onChange={e => { e.stopPropagation(); updateCardRandomness(ci, 'poissonRadius', e.target.value); }}
                  onClick={e => e.stopPropagation()}
                />
              </div>

              {/* Coordinates */}
              <CoordinateList
                coordinates={card.coordinates}
                fields={[[
                  { key: 'x', label: 'X', placeholder: '256' },
                  { key: 'z', label: 'Z', placeholder: '256' },
                ]]}
                open={!!coordsOpen[ci]}
                onToggle={() => setCoordsOpen(prev => ({ ...prev, [ci]: !prev[ci] }))}
                labelFor={(coord, coordIdx) => `Point ${coordIdx + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                onUpdate={(coordIdx, key, val) => updateCoordinate(ci, coordIdx, key, val)}
                onDelete={(coordIdx) => deleteCoordinate(ci, coordIdx)}
                onAdd={() => addManualCoordinate(ci)}
                hasPlaced={card.coordinates.some(c => c.x && c.z)}
                onDeleteAll={async () => {
                  const ok = await luxuryConfirm('Delete all coordinates for this card?', 'Confirm Delete', 'Delete All', 'Cancel');
                  if (ok) clearCoordinates(ci);
                }}
              />
            </>)}
          </EntityCard>
        ))}
        <AddTile label="Add Emitter Card" onClick={addEmitterCard} />
      </EntityCardGrid>
    </>
  );
}
