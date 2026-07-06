import React from 'react';
import { luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList, EmitterToggleBlock,
} from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

const unitLabelOf = (u, i) => u.unitType?.toUpperCase() || `Unit ${i + 1}`;

/* ── WreckageUnits ───────────────────────────────────────────────────── */

export default function WreckageUnits({
  units, selectedUnit, setSelectedUnit,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  handleImportFromMap, deleteAllUnits, addUnit, deleteUnit, updateUnit,
  onOpenUnitLibrary,
  addCoordinate, updateCoordinate, deleteCoordinate, deleteAllCoordinates,
  // Emitter props
  blueprintPaths,
  getEmitterName,
  onToggleUnitEmitter,
  onSetUnitSource,
  onClearUnitSource,
  onSetUnitIsSource,
}) {
  return (
    <div className="ctrl-col">
    <div className="ctrl-block">
      <div className="ctrl-subtitle">Units</div>
      <div className="ctrl-content">

        <div className="ctrl-action-row" style={{ justifyContent: 'space-between' }}>
          <button className="ctrl-btn-add" onClick={handleImportFromMap}
            title="Import wreckages from the current map's _script.lua and _save.lua">
            Import from Map
          </button>
          {units.length >= 1 && (
            <button className="ctrl-btn-danger" onClick={deleteAllUnits}>
              Delete All
            </button>
          )}
        </div>

        <EntityCardGrid>
          {units.map((unit, unitIdx) => {
            const isSelected = unitIdx === selectedUnit;
            return (
              <EntityCard
                key={unit.id}
                index={unitIdx}
                color={unit.color}
                selected={isSelected}
                onSelect={() => setSelectedUnit(unitIdx)}
                onDelete={() => deleteUnit(unitIdx)}
                title={unit.unitName ? `${unit.unitName} (${unit.unitType})` : unit.unitType || `Unit ${unitIdx + 1}`}
                availableColors={availableColors}
                showColorPicker={showColorPicker === unitIdx}
                onToggleColorPicker={() => setShowColorPicker(showColorPicker === unitIdx ? null : unitIdx)}
                onPickColor={(color) => { updateUnit(unitIdx, 'color', color); setShowColorPicker(null); }}
              >
                {isSelected && (
                  <>
                    {/* Unit type + library */}
                    <div className="ctrl-field">
                      <div className="ctrl-row">
                        <input
                          type="text"
                          className="ctrl-input"
                          value={unit.unitType}
                          onChange={(e) => updateUnit(unitIdx, 'unitType', e.target.value)}
                          placeholder="UEL0203"
                          onClick={(e) => e.stopPropagation()}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <button
                          className="ftr-preview-readmore"
                          onClick={(e) => { e.stopPropagation(); onOpenUnitLibrary(unitIdx); }}
                        >
                          Library
                        </button>
                      </div>
                    </div>

                    {/* Emitter block — replaces Categories */}
                    <EmitterToggleBlock
                      entity={unit}
                      entityIdx={unitIdx}
                      allEntities={units}
                      configuredEmitters={blueprintPaths}
                      getEmitterName={getEmitterName}
                      labelOf={unitLabelOf}
                      onToggleEmitter={onToggleUnitEmitter}
                      onSetSource={onSetUnitSource}
                      onClearSource={onClearUnitSource}
                      onSetIsSource={onSetUnitIsSource}
                    />

                    {/* Coordinates */}
                    <div style={{ marginTop: 'var(--space-xl)' }}>
                      <CoordinateList
                        coordinates={unit.coordinates}
                        fields={[
                          [
                            { key: 'x', label: 'X', placeholder: '256' },
                            { key: 'y', label: 'Y', placeholder: '26' },
                            { key: 'z', label: 'Z', placeholder: '256' },
                          ],
                          [
                            { key: 'heading', label: 'Heading', placeholder: 'math.pi' },
                            { key: 'pitch', label: 'Pitch', placeholder: '0.0' },
                            { key: 'roll', label: 'Roll', placeholder: 'math.pi' },
                          ],
                        ]}
                        open={!!coordsOpen[unitIdx]}
                        onToggle={() => setCoordsOpen(prev => ({ ...prev, [unitIdx]: !prev[unitIdx] }))}
                        labelFor={(coord, ci) => `Point ${ci + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                        onUpdate={(ci, key, value) => updateCoordinate(unitIdx, ci, key, value)}
                        onDelete={(ci) => deleteCoordinate(unitIdx, ci)}
                        onAdd={() => addCoordinate(unitIdx)}
                        hasPlaced={unit.coordinates.some(c => c.x && c.z)}
                        onDeleteAll={async () => {
                          const confirmed = await luxuryConfirm('Delete all coordinates for this unit?', 'Confirm Delete', 'Delete All', 'Cancel');
                          if (confirmed) deleteAllCoordinates(unitIdx);
                        }}
                      />
                    </div>
                  </>
                )}
              </EntityCard>
            );
          })}

          <AddTile label="Add Unit Type" onClick={addUnit} />
        </EntityCardGrid>

      </div>
    </div>
    </div>
  );
}
