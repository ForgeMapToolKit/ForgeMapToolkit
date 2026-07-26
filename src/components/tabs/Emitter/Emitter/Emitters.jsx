import React, { useState } from 'react';
import { luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList, DropSlot, Dropdown,
} from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

const MASK_SCAN_OPTIONS = [
  { value: 'right',  label: 'Slide Right' },
  { value: 'left',   label: 'Slide Left'  },
  { value: 'ignore', label: 'Ignore'      },
];

function EmitterToggleBlock({ card, cardIdx, emitterPaths, toggleCardEmitter, getEmitterNameFromPath }) {
  const [open, setOpen] = useState(false);
  const validPaths = emitterPaths.filter(p => p.trim());
  const activeCount = (card.cardEmitters || []).filter(p => validPaths.includes(p)).length;

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 'var(--space-xl)' }}>
      <div className="trace-subsection" onClick={() => setOpen(o => !o)}>
        Emitters ({activeCount} / {validPaths.length})
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'var(--space-sm)' }}>
          {validPaths.length === 0 ? (
            <span className="field-hint">No emitters configured in Configuration.</span>
          ) : validPaths.map((path, pi) => {
            const active = (card.cardEmitters || []).includes(path);
            return (
              <button
                key={pi}
                type="button"
                className={`ctrl-toggle-row${active ? ' on' : ''}`}
                role="switch"
                aria-checked={active}
                onClick={e => { e.stopPropagation(); toggleCardEmitter(cardIdx, path); }}
                title={path}
              >
                <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
                <span className="ctrl-toggle-text">
                  <span className="ctrl-toggle-label">{getEmitterNameFromPath(path)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── GridPlacementBlock — collapsed by default, matches EmitterToggleBlock ── */

function GridPlacementBlock({ card, cardIdx, updateCard, handleGenerateGrid }) {
  const [open, setOpen] = useState(false);

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 'var(--space-xl)' }}>
      <div className="trace-subsection" onClick={() => setOpen(o => !o)}>
        Grid Placement
      </div>
      {open && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
          <div className="ctrl-field">
            <div className="ctrl-label">X Step</div>
            <input
              type="number" min="1"
              className="ctrl-input"
              placeholder="64"
              value={card.gridStepX}
              onChange={e => { e.stopPropagation(); updateCard(cardIdx, 'gridStepX', e.target.value); }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="ctrl-field">
            <div className="ctrl-label">Z Step</div>
            <input
              type="number" min="1"
              className="ctrl-input"
              placeholder="64"
              value={card.gridStepZ}
              onChange={e => { e.stopPropagation(); updateCard(cardIdx, 'gridStepZ', e.target.value); }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="ctrl-action-row" style={{ marginTop: 'var(--space-sm)' }}>
          <button
            className="ctrl-btn-add"
            disabled={!card.gridStepX || !card.gridStepZ}
            onClick={e => { e.stopPropagation(); handleGenerateGrid(cardIdx); }}
          >Generate Grid</button>
        </div>
      </>)}
    </div>
  );
}

export default function EmitterEmitters({
  emitterCards, selectedCard, setSelectedCard,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  deleteAllEmitterCards, addEmitterCard, deleteEmitterCard, updateCard,
  handleGenerateGrid,
  addManualCoordinate, updateCoordinate, deleteCoordinate, clearCoordinates,
  emitterPaths, toggleCardEmitter, getEmitterNameFromPath,
  globalRandomness, setGlobalRandomness,
  maskImageData, handleMaskUpload,
  maskScanMode, setMaskScanMode, maskPreviewUrl, maskWidth, maskHeight, onRemoveMask,
}) {
  return (
    <div className="ctrl-col">

      {/* ── Block 1: Placement Settings ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Placement Settings</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Poisson Min. Distance</div>
            <input
              type="number"
              min="0"
              className="ctrl-input"
              placeholder="0"
              value={globalRandomness.poissonRadius}
              onChange={e => setGlobalRandomness(prev => ({ ...prev, poissonRadius: e.target.value }))}
            />
          </div>
          <div className="ctrl-field" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="ctrl-label">Area Mask</div>
            <DropSlot
              hint="B/W image — dark = excluded"
              acceptInput="image/*"
              status={maskImageData ? 'done' : 'idle'}
              idleText="Click or drop an area mask"
              doneText={maskImageData ? `${maskWidth} × ${maskHeight} px` : undefined}
              onChange={handleMaskUpload}
              onClear={onRemoveMask}
            />
            {maskPreviewUrl && (
              <div className="em-mask-preview">
                <img src={maskPreviewUrl} alt="Area Mask" className="em-mask-img" />
              </div>
            )}
          </div>
          <div className="ctrl-field" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="ctrl-label">Dark Pixel Behaviour</div>
            <Dropdown
              options={MASK_SCAN_OPTIONS}
              value={maskScanMode}
              onChange={setMaskScanMode}
              ariaLabel="Dark pixel behaviour"
            />
          </div>
        </div>
      </div>

      {/* ── Block 2: Emitter Cards ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Emitter Cards</div>
        <div className="ctrl-content">

          {emitterCards.length >= 1 && (
            <div className="ctrl-action-row" style={{ justifyContent: 'flex-end' }}>
              <button className="ctrl-btn-danger" onClick={deleteAllEmitterCards}>Delete All</button>
            </div>
          )}

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
                  <div className="ctrl-field">
                    <input
                      type="text"
                      className="ctrl-input ctrl-input--text"
                      placeholder="e.g. Fire Emitters"
                      value={card.label}
                      onChange={e => { e.stopPropagation(); updateCard(ci, 'label', e.target.value); }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>

                  {/* Emitter toggles */}
                  <EmitterToggleBlock
                    card={card}
                    cardIdx={ci}
                    emitterPaths={emitterPaths}
                    toggleCardEmitter={toggleCardEmitter}
                    getEmitterNameFromPath={getEmitterNameFromPath}
                  />

                  {/* Grid Placement */}
                  <GridPlacementBlock
                    card={card}
                    cardIdx={ci}
                    updateCard={updateCard}
                    handleGenerateGrid={handleGenerateGrid}
                  />

                  {/* Coordinates */}
                  <div style={{ marginTop: 'var(--space-xl)' }}>
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
                  </div>

                </>)}
              </EntityCard>
            ))}
            <AddTile label="Add Emitter Card" onClick={addEmitterCard} />
          </EntityCardGrid>

        </div>
      </div>

    </div>
  );
}
