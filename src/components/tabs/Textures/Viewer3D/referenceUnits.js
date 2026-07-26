/**
 * referenceUnits.js — the objects a prop gets measured against.
 *
 * These meshes are read from the user's own Supreme Commander installation at
 * runtime, never bundled: they are Gas Powered Games' assets, and FMT already
 * reads the install for props, textures and unit blueprints. Without a
 * configured `faInstallPath` the reference section is simply unavailable.
 *
 * Four objects spanning the range a mapper actually needs to judge against —
 * a tank for "is this rock knee-high or house-high", the ACU for the largest
 * thing that walks, a factory for a built footprint. Sizes below are the
 * measured .scm bounding box × the blueprint's UniformScale, in ogrids, and are
 * documentation only: the real numbers are read from the blueprint at load
 * time, so a modded install shows its own.
 */

export const REFERENCE_UNITS = [
  { id: 'UEL0201', label: 'T1 Tank',   note: 'UEF Striker — ~0.57 ogrids wide' },
  { id: 'UEL0105', label: 'Engineer',  note: 'UEF T1 engineer — ~0.54 ogrids wide' },
  { id: 'UEL0001', label: 'Commander', note: 'UEF ACU — ~2.1 ogrids wide' },
  { id: 'UEB0101', label: 'Factory',   note: 'UEF T1 land factory — ~5 ogrids wide' },
];

/** Units keep their blueprint beside their mesh, both named after the unit id. */
export const unitBlueprintPath = (id) => `/units/${id}/${id}_unit.bp`;

/** Archive hint for the resolver — units.scd first, so the search stops early. */
export const UNIT_PREFER = ['units.'];

/** Props live in env.scd; a map's own props resolve from its folder first. */
export const PROP_PREFER = ['env.'];
