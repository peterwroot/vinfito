(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VinfitoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseAddresses(value) {
    return String(value || '')
      .split(/[\n,;]+/)
      .map(value => value.trim())
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index);
  }

  function normalized(value) {
    return String(value || '').toLowerCase().replace(/&/g, 'and');
  }

  function roleMatches(sideText, role) {
    const side = normalized(sideText);
    const candidate = normalized(role);
    if (!candidate) return false;
    if (side.includes(candidate)) return true;

    // Veeam tables vary capitalization and singular/plural wording.
    const stem = candidate.replace(/\bservers?\b/g, 'server')
      .replace(/\brepositories\b/g, 'repository')
      .replace(/\bproxies\b/g, 'proxy')
      .replace(/\bhosts?\b/g, 'host');
    const sideStem = side.replace(/\bservers?\b/g, 'server')
      .replace(/\brepositories\b/g, 'repository')
      .replace(/\bproxies\b/g, 'proxy')
      .replace(/\bhosts?\b/g, 'host');
    return sideStem.includes(stem);
  }

  function componentIdsForSide(sideText, components, selectedIds) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const side = normalized(sideText);
    if (side.includes('any backup infrastructure component')) {
      return components.filter(c => selected.has(c.id) && c.infrastructure !== false).map(c => c.id);
    }
    return components
      .filter(c => selected.has(c.id) && (c.roles || []).some(role => roleMatches(sideText, role)))
      .map(c => c.id);
  }

  function buildRules({ rules, components, selectedIds, addresses, excludeSameEndpoints = false }) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    if (selected.size < 2) throw new Error('Select at least two components.');

    const componentById = new Map(components.map(c => [c.id, c]));
    const addressMap = {};
    selected.forEach(id => {
      addressMap[id] = parseAddresses(addresses[id]);
      if (!addressMap[id].length) {
        const component = componentById.get(id);
        throw new Error(`Enter at least one address for ${component ? component.label : id}.`);
      }
    });

    const output = [];
    const seen = new Set();
    rules.forEach((rule, sourceRuleIndex) => {
      const sourceIds = componentIdsForSide(rule.src, components, selected);
      const destinationIds = componentIdsForSide(rule.dst, components, selected);
      if (!sourceIds.length || !destinationIds.length) return;

      sourceIds.forEach(sourceId => destinationIds.forEach(destinationId => {
        // A component may legitimately communicate with itself, but only retain it
        // when the official row names that same role on both sides.
        addressMap[sourceId].forEach(sourceAddress => addressMap[destinationId].forEach(destinationAddress => {
          if (excludeSameEndpoints && sourceAddress.trim().toLowerCase() === destinationAddress.trim().toLowerCase()) return;
          const key = [sourceId, sourceAddress, destinationId, destinationAddress, rule.proto, rule.port, rule.notes].join('\u001f');
          if (seen.has(key)) return;
          seen.add(key);
          output.push({
            sourceRuleIndex,
            sourceComponentId: sourceId,
            sourceComponent: componentById.get(sourceId).label,
            sourceAddress,
            destinationComponentId: destinationId,
            destinationComponent: componentById.get(destinationId).label,
            destinationAddress,
            protocol: rule.proto,
            ports: rule.port,
            notes: rule.notes || '—',
          });
        }));
      }));
    });
    return output;
  }

  return { parseAddresses, componentIdsForSide, buildRules };
});
