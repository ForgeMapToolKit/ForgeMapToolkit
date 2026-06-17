/**
 * Emitter ↔ category matching logic shared by the placement tabs.
 *
 * Encapsulates the category bookkeeping (which emitters are active for which
 * category) and the Smart / Simple / Last-Category resolution that decides which
 * emitters a given entity (card / prop / unit) may use.
 *
 * @param {object}   opts
 * @param {Array}    opts.entities            current cards/props/units
 * @param {Function} opts.getCategories       entity => string[] (its category list)
 * @param {string[]} opts.emitters            configured emitter paths (may include '')
 * @param {object}   opts.emitterCategories   { emitterPath: string[] } disabled-categories map
 * @param {Function} opts.setEmitterCategories setter for emitterCategories
 * @param {string}   opts.matchingMode        'smart' | 'simple' | 'lastCategory'
 */
export function useEmitterCategories({
  entities, getCategories, emitters, emitterCategories, setEmitterCategories, matchingMode,
}) {
  const getAllUniqueCategories = () => {
    const set = new Set();
    (entities || []).forEach(entity => {
      (getCategories(entity) || []).forEach(cat => {
        if (cat && cat.trim()) set.add(cat.trim());
      });
    });
    return Array.from(set).sort();
  };

  const isEmitterActiveForCategory = (emitterPath, category) => {
    if (!emitterCategories[emitterPath]) return true;
    return !emitterCategories[emitterPath].includes(category);
  };

  const toggleEmitterCategory = (emitterPath, category) => {
    setEmitterCategories(prev => {
      const next = { ...prev };
      if (!next[emitterPath]) next[emitterPath] = [];
      const idx = next[emitterPath].indexOf(category);
      next[emitterPath] = idx > -1
        ? next[emitterPath].filter(c => c !== category)
        : [...next[emitterPath], category];
      return next;
    });
  };

  const getEmitterNameFromPath = (path) => {
    const filename = path.split('/').pop();
    return filename.replace('_emit.bp', '').replace('.bp', '').replace(/_/g, ' ');
  };

  /** Resolve which emitter paths an entity may use, honouring the matching mode. */
  const getEmittersForEntity = (entity) => {
    const valid = (emitters || []).filter(p => p.trim());
    const activeCategories = (getCategories(entity) || []).filter(c => c.trim());
    if (activeCategories.length === 0) return valid;

    if (matchingMode === 'smart') {
      const perfect = valid.filter(p => activeCategories.every(cat => isEmitterActiveForCategory(p, cat.trim())));
      if (perfect.length > 0) return perfect;
      const partial = valid.filter(p => activeCategories.some(cat => isEmitterActiveForCategory(p, cat.trim())));
      return partial.length > 0 ? partial : valid;
    }
    if (matchingMode === 'simple') {
      const union = valid.filter(p => activeCategories.some(cat => isEmitterActiveForCategory(p, cat.trim())));
      return union.length > 0 ? union : valid;
    }
    if (matchingMode === 'lastCategory') {
      const last = activeCategories[activeCategories.length - 1].trim();
      const match = valid.filter(p => isEmitterActiveForCategory(p, last));
      return match.length > 0 ? match : valid;
    }
    return valid;
  };

  return {
    getAllUniqueCategories,
    isEmitterActiveForCategory,
    toggleEmitterCategory,
    getEmitterNameFromPath,
    getEmittersForEntity,
  };
}
