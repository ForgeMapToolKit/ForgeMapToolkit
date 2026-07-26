// Shared by Section 02 and Section 03: both rank rows by how much air there is,
// and the class has to be a complete literal so design-lint can resolve it.
import { FLOAT_OBVIOUS } from '../../../Shared/MapLogic';

const SEVERITY_CLASS = { bad: 'ft-row--bad', warn: 'ft-row--warn' };

/** Feedback hue for a gap, in world units (§7 Role 3 — never --tab-color). */
export const severityClass = (v) => (v >= FLOAT_OBVIOUS ? SEVERITY_CLASS.bad : SEVERITY_CLASS.warn);

export const shortName = (p) => (p || '').replace(/\\/g, '/').split('/').pop() || '—';
