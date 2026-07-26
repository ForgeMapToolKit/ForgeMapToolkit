/**
 * Reference.jsx — Sektion 03: das Objekt, gegen das gemessen wird.
 *
 * Die Meshes kommen aus der Installation des Users, nie aus dem Paket. Ohne
 * gesetzten Installationspfad ist die Sektion deaktiviert statt leer — dieselbe
 * Konvention wie `canScan` in System/Settings.
 *
 * Rein präsentational.
 */

import React from 'react';

const Reference = ({ units, referenceId, showReference, reference, hasInstall, onSelect, onToggle }) => (
  <section className="v3-panel">
    <div className="ctrl-subtitle ctrl-subtitle--flush">Scale Reference</div>

    {!hasInstall ? (
      <div className="v3-note">
        Needs a Supreme Commander install path — set it in Settings. The reference
        meshes are read from your own installation and are never bundled.
      </div>
    ) : (
      <>
        <div className="ctrl-field">
          <label className="v3-check">
            <input
              type="checkbox"
              checked={!!showReference}
              onChange={e => onToggle(e.target.checked)}
            />
            <span>Show reference</span>
          </label>
        </div>

        <div className="v3-ref-list">
          {units.map(u => (
            <button
              key={u.id}
              className={`v3-ref${referenceId === u.id ? ' is-active' : ''}`}
              onClick={() => onSelect(u.id)}
              title={u.note}
              disabled={!showReference}
            >
              <span className="v3-ref-label">{u.label}</span>
              <span className="v3-ref-id">{u.id}</span>
            </button>
          ))}
        </div>

        {reference && (
          <div className="v3-note">
            Standing beside the subject, in its rest pose — animation and skinning
            are not applied.
          </div>
        )}
      </>
    )}
  </section>
);

export default Reference;
