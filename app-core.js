/*
 * Core rule-generation logic for Vinfito.
 *
 * This file has no browser or DOM dependencies, which makes the important
 * behavior easy to test with Node.js. The browser page loads the same file and
 * receives these functions through window.VinfitoCore.
 */
(function exposeCore(globalObject, createCore) {
  const core = createCore();

  // CommonJS is used by test_app_core.js. Browsers use the global export.
  if (typeof module === 'object' && module.exports) {
    module.exports = core;
  } else {
    globalObject.VinfitoCore = core;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCore() {
  /**
   * Convert the address field into a clean, unique list.
   *
   * The UI accepts one address per line, or addresses separated by commas or
   * semicolons. Keeping this normalization in one place means the UI and the
   * rule generator use exactly the same interpretation of user input.
   */
  function parseAddresses(value) {
    return String(value || '')
      .split(/[\n,;]+/)
      .map(address => address.trim())
      .filter(Boolean)
      .filter((address, index, all) => all.indexOf(address) === index);
  }

  /** Normalize text before comparing it with documentation role names. */
  function normalize(value) {
    return String(value || '').toLowerCase().replace(/&/g, 'and');
  }

  /**
   * Make the common singular/plural forms used by the documentation compare
   * consistently (for example, "Backup Proxies" and "Backup Proxy").
   */
  function singularizeInfrastructureTerms(value) {
    return value
      .replace(/\bservers?\b/g, 'server')
      .replace(/\brepositories\b/g, 'repository')
      .replace(/\bproxies\b/g, 'proxy')
      .replace(/\bhosts?\b/g, 'host');
  }

  /** Return true when a component role appears in a documentation cell. */
  function roleMatches(sideText, role) {
    const side = singularizeInfrastructureTerms(normalize(sideText));
    const candidate = singularizeInfrastructureTerms(normalize(role));
    return Boolean(candidate) && side.includes(candidate);
  }

  /**
   * Find selected component IDs represented by one From or To cell.
   *
   * Veeam sometimes uses the broad phrase "Any backup infrastructure
   * component". That phrase maps to every selected component marked as
   * infrastructure, rather than to a component with a literal matching name.
   */
  function componentIdsForSide(sideText, components, selectedIds) {
    const selected = selectedIds instanceof Set
      ? selectedIds
      : new Set(selectedIds || []);

    if (normalize(sideText).includes('any backup infrastructure component')) {
      return components
        .filter(component => selected.has(component.id) && component.infrastructure !== false)
        .map(component => component.id);
    }

    return components
      .filter(component => selected.has(component.id)
        && (component.roles || []).some(role => roleMatches(sideText, role)))
      .map(component => component.id);
  }

  /**
   * Validate selected components and build a map of component ID to addresses.
   * A map makes the main generation loop easier to read.
   */
  function collectAddresses(selected, components, addresses) {
    const componentById = new Map(components.map(component => [component.id, component]));
    const addressMap = new Map();

    selected.forEach(componentId => {
      const componentAddresses = parseAddresses(addresses[componentId]);
      if (!componentAddresses.length) {
        const component = componentById.get(componentId);
        throw new Error(`Enter at least one address for ${component ? component.label : componentId}.`);
      }
      addressMap.set(componentId, componentAddresses);
    });

    return { componentById, addressMap };
  }

  /**
   * Remove addresses shared by both sides when the user enables the toggle.
   * Comparisons are case-insensitive, but the original spelling is preserved
   * for every address that remains in the output.
   */
  function removeSharedAddresses(sourceAddresses, destinationAddresses) {
    const destinationNames = new Set(
      destinationAddresses.map(address => address.trim().toLowerCase()),
    );
    const source = sourceAddresses.filter(address => !destinationNames.has(address.trim().toLowerCase()));
    const sourceNames = new Set(source.map(address => address.trim().toLowerCase()));
    const destination = destinationAddresses.filter(address => !sourceNames.has(address.trim().toLowerCase()));
    return { source, destination };
  }

  /**
   * Generate rules for selected component relationships.
   *
   * Each documentation row can match one or more selected components on each
   * side. The output contains one rule per component relationship. Addresses
   * are deliberately joined into one field; we do not create a Cartesian
   * product of source and destination addresses.
   */
  function buildRules({ rules, components, selectedIds, addresses, excludeSameEndpoints = false }) {
    const selected = selectedIds instanceof Set
      ? selectedIds
      : new Set(selectedIds || []);
    if (selected.size < 2) throw new Error('Select at least two components.');

    const { componentById, addressMap } = collectAddresses(selected, components, addresses);
    const output = [];
    const seen = new Set();

    rules.forEach((rule, sourceRuleIndex) => {
      const sourceIds = componentIdsForSide(rule.src, components, selected);
      const destinationIds = componentIdsForSide(rule.dst, components, selected);
      if (!sourceIds.length || !destinationIds.length) return;

      sourceIds.forEach(sourceId => {
        destinationIds.forEach(destinationId => {
          let sourceAddresses = addressMap.get(sourceId).slice();
          let destinationAddresses = addressMap.get(destinationId).slice();

          if (excludeSameEndpoints) {
            ({ source: sourceAddresses, destination: destinationAddresses } = removeSharedAddresses(
              sourceAddresses,
              destinationAddresses,
            ));
          }
          if (!sourceAddresses.length || !destinationAddresses.length) return;

          const sourceAddress = sourceAddresses.join(', ');
          const destinationAddress = destinationAddresses.join(', ');
          const key = [
            sourceId,
            sourceAddress,
            destinationId,
            destinationAddress,
            rule.proto,
            rule.port,
            rule.notes,
          ].join('\u001f');
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
        });
      });
    });

    return output;
  }

  return { parseAddresses, componentIdsForSide, buildRules };
});
