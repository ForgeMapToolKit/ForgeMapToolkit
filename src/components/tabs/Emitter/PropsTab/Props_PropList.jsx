import React from 'react';
import { luxuryConfirm } from '../../../modals/notifications';
import {
  EntityCard, EntityCardGrid, AddTile, CoordinateList,
} from '../../../shared/entity-console/EntityConsole.jsx';

export default function PropsPropList({
  props, selectedProp, setSelectedProp,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  handleOpenPropsImport, propsImportLoading,
  deleteAllProps, addProp, deleteProp, updatePropColor, updatePropName,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  updateBlueprintPath, deleteBlueprintPath, onOpenBlueprintLibrary,
  addCoordinate, updateCoordinate, deleteCoordinate, deleteAllCoordinates,
}) {
  return (
    <>
      <div className="trace-section-head" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="action-button" onClick={handleOpenPropsImport} disabled={propsImportLoading} title="Import props from the current map's .scmap">
            {propsImportLoading ? '…' : 'Import from Map'}
          </button>
          {props.length >= 1 && (
            <button className="action-button action-button--danger" onClick={deleteAllProps} title="Delete all prop cards">Delete All</button>
          )}
        </div>
      </div>
      <EntityCardGrid>
        {props.map((prop, propIdx) => (
          <EntityCard
            key={prop.id}
            index={propIdx}
            color={prop.color}
            selected={propIdx === selectedProp}
            onSelect={() => setSelectedProp(propIdx)}
            onDelete={() => deleteProp(propIdx)}
            title={prop.propName ? `${prop.propName.toUpperCase()}` : `Prop ${propIdx + 1}`}
            availableColors={availableColors}
            showColorPicker={showColorPicker === propIdx}
            onToggleColorPicker={() => setShowColorPicker(showColorPicker === propIdx ? null : propIdx)}
            onPickColor={(color) => { updatePropColor(propIdx, color); setShowColorPicker(null); }}
          >
            {propIdx === selectedProp && (<>
              <div className="form-group">
                <label className="field-label">Prop Name</label>
                <input type="text" className="field-input" value={prop.propName} onChange={(e) => updatePropName(propIdx, e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="e.g. lava_tree01" />
              </div>
              <div className="form-group">
                <label className="field-label">Categories (optional)</label>
                {(prop.propCategories || []).map((cat, catIdx) => (
                  <div key={catIdx} className="ec-input-row">
                    <input
                      type="text"
                      className="field-input"
                      value={cat}
                      onChange={(e) => onUpdateCategory(propIdx, catIdx, e.target.value)}
                      placeholder={`Category ${catIdx + 1} (e.g., Forest, Dense)`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button className="delete-button" onClick={(e) => { e.stopPropagation(); onDeleteCategory(propIdx, catIdx); }}>×</button>
                  </div>
                ))}
                <button
                  className="action-button action-button--full"
                  onClick={(e) => { e.stopPropagation(); onAddCategory(propIdx); }}
                >Add Category</button>
              </div>
              <div className="form-group">
                <label className="field-label">Blueprint Paths</label>
                {prop.blueprintPaths.map((path, pathIdx) => (
                  <div key={pathIdx} className="ec-input-row">
                    <input type="text" className="field-input" value={path} onChange={(e) => updateBlueprintPath(propIdx, pathIdx, e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp" />
                    <button className="delete-button" onClick={() => deleteBlueprintPath(propIdx, pathIdx)}>×</button>
                  </div>
                ))}
                <button onClick={(e) => { e.stopPropagation(); onOpenBlueprintLibrary(propIdx); }} className="action-button action-button--full">Library</button>
              </div>
              <CoordinateList
                coordinates={prop.coordinates}
                fields={[[
                  { key: 'x', label: 'X', placeholder: '256' },
                  { key: 'y', label: 'Y', placeholder: '26' },
                  { key: 'z', label: 'Z', placeholder: '256' },
                ]]}
                open={!!coordsOpen[propIdx]}
                onToggle={() => setCoordsOpen(prev => ({ ...prev, [propIdx]: !prev[propIdx] }))}
                labelFor={(coord, ci) => `Point ${ci + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                onUpdate={(ci, key, value) => updateCoordinate(propIdx, ci, key, value)}
                onDelete={(ci) => deleteCoordinate(propIdx, ci)}
                onAdd={() => addCoordinate(propIdx)}
                hasPlaced={prop.coordinates.some(c => c.x && c.z)}
                onDeleteAll={async () => {
                  const ok = await luxuryConfirm('Delete all coordinates for this prop?', 'Confirm Delete', 'Delete All', 'Cancel');
                  if (ok) deleteAllCoordinates(propIdx);
                }}
              />
            </>)}
          </EntityCard>
        ))}
        <AddTile label="Add Prop Type" onClick={addProp} />
      </EntityCardGrid>
    </>
  );
}
