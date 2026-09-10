# Veeam Interactive Firewall Tool

A browser-based tool for generating firewall-rule lists for Veeam Backup & Replication. Select the components in a Veeam environment, enter the address or addresses for each component, and generate only the documented rules relevant to the selected communication paths.

Live application: **https://peterwroot.github.io/vinfito/**

## Features

- Component selection organized into categories:
  - Infrastructure Components
  - Hypervisor Platforms
  - Backup Repositories
  - Backup Sources
  - Cloud & Veeam-Hosted Services
  - Miscellaneous Services
- Per-component FQDN or IP-address entry.
- Multiple addresses per component, separated by commas, semicolons, or new lines.
- Multiple addresses are grouped into one generated rule for the component relationship rather than expanded into a Cartesian product.
- Filters rules so both the documented source and destination components are selected.
- Optional filtering of rules where the source and destination address are identical.
- CSV export of the generated rules.
- Veeam v13 port definitions stored separately from the UI in `ports-data.js`.
- Includes rules for the Veeam XenServer plugin, as well as core Veeam infrastructure, repositories, hypervisor platforms, services, and integrations.
- Responsive compact layout with Veeam-inspired colors.

## Usage

1. Open the live application or serve the repository locally.
2. Select at least two components.
3. Enter one or more addresses for each selected component.
4. Optionally enable **Exclude same-address rules**.
5. Select **Generate Rules**.
6. Review the generated source, destination, protocol, port, and notes fields.
7. Select **Export CSV** to download the rule list.

The generated address fields contain grouped addresses, for example:

```text
proxy01.example.com, proxy02.example.com, proxy03.example.com
```

## Data source and accuracy

The rule data is based on the Veeam Backup & Replication v13 used-ports documentation:

- Core ports: <https://helpcenter.veeam.com/docs/vbr/userguide/used_ports.html?ver=13>
- XenServer plugin ports: <https://helpcenter.veeam.com/docs/vbr/userguide/xen_used_ports.html?ver=13>
- Veeam Agent for Microsoft Windows ports: <https://helpcenter.veeam.com/docs/agentforwindows/userguide/ports.html?ver=13>

`ports-data.js` contains the documented `From`, `To`, `Protocol`, `Port`, and `Notes` values. Notes are retained from the documentation, including qualifiers such as `Optional`, version-specific conditions, HTML line breaks, and links represented in the source data.

The tool is an aid for preparing firewall-rule lists. Always validate the generated rules against the specific Veeam version, deployment architecture, enabled features, and current official documentation.

## Project structure

```text
.
├── index.html                 # User interface, component catalogue, and browser logic
├── app-core.js                # Testable address parsing and rule-generation logic
├── ports-data.js              # Veeam firewall-rule definitions
├── test_app_core.js           # Node.js tests for app-core.js
└── .github/workflows/
    └── pages.yml              # GitHub Pages deployment workflow
```

### `index.html`

The static single-page application. It renders the categorized component selector, address-entry fields, generated-rule table, CSV export action, and responsive layout.

### `app-core.js`

DOM-independent rule-generation code. It:

- Parses and de-duplicates addresses.
- Matches component roles against the documentation's source and destination text.
- Validates that selected components have addresses.
- Groups all addresses for each component relationship into a single generated rule.
- Applies the same-address exclusion option.

The file supports both browser-global usage through `window.VinfitoCore` and CommonJS usage for Node.js tests.

### `ports-data.js`

The editable rule database. Each entry has this shape:

```js
{
  src: 'Documentation source text',
  dst: 'Documentation destination text',
  proto: 'TCP',
  port: '443',
  notes: 'Documentation note text'
}
```

When adding or auditing a rule, preserve the documentation's wording and qualifiers in `notes`. Keep the source and destination text compatible with the component role mappings in `index.html`.

## Local development

This project has no build step or package installation requirement. A modern browser is sufficient.

Serve the repository with Python:

```bash
python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765/>.

Opening `index.html` directly may work in some browsers, but using a local HTTP server is recommended because the application loads `app-core.js` and `ports-data.js` as separate scripts.

## Testing

Run the core tests:

```bash
node test_app_core.js
```

Check JavaScript syntax:

```bash
node --check app-core.js
node --check ports-data.js
```

Check Git whitespace errors:

```bash
git diff --check
```

## Deployment

GitHub Pages is deployed by `.github/workflows/pages.yml` from the `main` branch. The published site is:

<https://peterwroot.github.io/vinfito/>

Changes to the application should be tested locally before pushing to `main`. After a push, check the GitHub Actions workflow and then refresh the published page once deployment completes.

## License and attribution

This project is an independent utility for preparing Veeam firewall-rule lists. Veeam and Veeam product names are trademarks of Veeam Software. Refer to the official Veeam documentation for authoritative deployment requirements.
