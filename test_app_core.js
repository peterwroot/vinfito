const assert = require('node:assert/strict');
const {
  parseAddresses,
  componentIdsForSide,
  buildRules,
} = require('./app-core.js');

const components = [
  { id: 'backup_server', label: 'Backup Server', roles: ['Backup Server'], infrastructure: true },
  { id: 'backup_proxy', label: 'Backup Proxy', roles: ['Backup Proxy'], infrastructure: true },
  { id: 'dns_server', label: 'DNS Server', roles: ['DNS Server'], infrastructure: false },
];

assert.deepEqual(
  parseAddresses('backup01.example.com, 10.0.0.2\nbackup02.example.com'),
  ['backup01.example.com', '10.0.0.2', 'backup02.example.com'],
  'addresses support commas and newlines'
);

assert.deepEqual(
  componentIdsForSide('Backup Server / Backup Proxy', components, new Set(['backup_server', 'backup_proxy'])),
  ['backup_server', 'backup_proxy'],
  'compound Veeam role text maps to each selected component'
);

assert.deepEqual(
  componentIdsForSide('Any Backup Infrastructure Component', components, new Set(['backup_proxy', 'dns_server'])),
  ['backup_proxy'],
  'generic infrastructure source maps only selected infrastructure components'
);

const rules = [
  { src: 'Backup Server', dst: 'Backup Proxy', proto: 'TCP', port: '6160', notes: 'test' },
  { src: 'Backup Server', dst: 'DNS Server', proto: 'UDP/TCP', port: '53', notes: 'test' },
];
const generated = buildRules({
  rules,
  components,
  selectedIds: new Set(['backup_server', 'backup_proxy']),
  addresses: {
    backup_server: 'backup01.example.com,backup02.example.com',
    backup_proxy: 'proxy01.example.com',
  },
});
assert.equal(generated.length, 2, 'multiple addresses expand to a Cartesian product');

const sameEndpointRules = buildRules({
  rules: [{ src: 'Backup Server', dst: 'Backup Proxy', proto: 'TCP', port: '443', notes: 'test' }],
  components,
  selectedIds: new Set(['backup_server', 'backup_proxy']),
  addresses: { backup_server: 'shared.example.com', backup_proxy: 'SHARED.EXAMPLE.COM' },
  excludeSameEndpoints: true,
});
assert.equal(sameEndpointRules.length, 0, 'toggle excludes identical source and destination addresses');
assert.deepEqual(generated.map(r => [r.sourceAddress, r.destinationAddress]), [
  ['backup01.example.com', 'proxy01.example.com'],
  ['backup02.example.com', 'proxy01.example.com'],
]);
assert.ok(generated.every(r => r.destinationComponent === 'Backup Proxy'));
assert.ok(!generated.some(r => r.destinationComponent === 'DNS Server'), 'rules with unselected endpoints are excluded');

assert.throws(() => buildRules({
  rules,
  components,
  selectedIds: new Set(['backup_server', 'backup_proxy']),
  addresses: { backup_server: 'backup01.example.com', backup_proxy: '' },
}), /address/i, 'every selected component requires an address');

console.log('app-core tests passed');
