import React from 'react';
import { luxuryConfirm } from '../../../modals/notifications';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
} from '../../../shared/entity-console/EntityConsole.jsx';

export default function WreckageUnits({
  units, selectedUnit, setSelectedUnit,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  handleImportFromMap, deleteAllUnits, addUnit, deleteUnit, updateUnit,
  onOpenUnitLibrary,
  addUnitCategory, updateUnitCategory, deleteUnitCategory,
  addCoordinate, updateCoordinate, deleteCoordinate, deleteAllCoordinates,
}) {
  return (
    <>
      <div className="trace-section-head" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="action-button"
            onClick={handleImportFromMap}
            title="Import wreckages from the current map's _script.lua and _save.lua"
          >
            Import from Map
          </button>
          {units.length >= 1 && (
            <button className="action-button action-button--danger" onClick={deleteAllUnits}>Delete All</button>
          )}
        </div>
      </div>

      <EntityCardGrid>
        {units.map((unit, unitIdx) => (
          <EntityCard
            key={unit.id}
            index={unitIdx}
            color={unit.color}
            selected={unitIdx === selectedUnit}
            onSelect={() => setSelectedUnit(unitIdx)}
            onDelete={() => deleteUnit(unitIdx)}
            title={unit.unitName ? `${unit.unitName} (${unit.unitType})` : unit.unitType || `Unit ${unitIdx + 1}`}
            availableColors={availableColors}
            showColorPicker={showColorPicker === unitIdx}
            onToggleColorPicker={() => setShowColorPicker(showColorPicker === unitIdx ? null : unitIdx)}
            onPickColor={(color) => { updateUnit(unitIdx, 'color', color); setShowColorPicker(null); }}
          >
            <div style={{ marginBottom: '8px' }}>
              <div className="ec-input-row">
                <input
                  type="text"
                  className="field-input"
                  value={unit.unitType}
                  onChange={(e) => updateUnit(unitIdx, 'unitType', e.target.value)}
                  placeholder="UEL0203"
                  onClick={(e) => e.stopPropagation()}
                  style={{ textTransform: 'uppercase' }}
                />
                <button
                  className="action-button"
                  style={{ flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); onOpenUnitLibrary(unitIdx); }}
                >
                  Library
                </button>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <label className="field-label" style={{ marginBottom: '10px' }}>Unit Categories (optional)</label>
              {unit.unitCategories && unit.unitCategories.map((category, catIdx) => (
                <div key={catIdx} className="ec-input-row">
                  <input
                    type="text"
                    className="field-input"
                    value={category}
                    onChange={(e) => updateUnitCategory(unitIdx, catIdx, e.target.value)}
                    placeholder={`Category ${catIdx + 1} (e.g., Land, T2)`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="delete-button"
                    onClick={(e) => { e.stopPropagation(); deleteUnitCategory(unitIdx, catIdx); }}
                  >×</button>
                </div>
              ))}
              <button
                className="action-button action-button--full"
                onClick={(e) => { e.stopPropagation(); addUnitCategory(unitIdx); }}
              >Add Category</button>
            </div>

            {unit.unitCategories && unit.unitCategories.length > 0 && (
              <div className="ec-cat-path">
                wreckages/{unit.unitCategories.filter(c => c.trim()).join('/')}/{unit.unitType || 'unit_id'}
              </div>
            )}

            {unitIdx === selectedUnit && (
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
            )}
          </EntityCard>
        ))}

        <AddTile label="Add Unit Type" onClick={addUnit} />
      </EntityCardGrid>
    </>
  );
}
