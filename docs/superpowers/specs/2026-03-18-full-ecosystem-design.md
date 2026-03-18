# Full GravityUI Ecosystem Expansion — Design Spec

Date: 2026-03-18
Status: Approved

## Goal

Expand the MCP server from a component-only reference (11 libraries) to a complete
GravityUI ecosystem knowledge base covering all 32 of the 35 vendor packages in scope.
Every `get()`, `find()`, and `list()` call should return useful information regardless
of whether the target is a React component, a hook, a utility function, an icon, a
design token, or a config package.

## Problem Statement

Current state:

- 11 of 35 vendor packages have ingested data (`data/components/*.json`)
- 6 component libraries are configured in `library-config.ts` but never ingested:
  markdown-editor, dialog-fields, dynamic-forms, data-source, timeline, yagr
- 1 component library (`charts`) is in vendor/ with no config entry and no data
- 18 packages have no config and no data (including 3 out-of-scope)
- `list()` only surfaces component-library entities
- An agent has no way to discover that `i18n`, `date-utils`, `app-layout`, `icons`,
  or `eslint-config` exist

Phase 1 addresses all 7 missing component libraries (6 configured + charts).

Root causes:

- Ingest pipeline only knows one strategy: React component extraction
- No ingest strategy exists for utilities, assets, or config packages
- Discovery tools (`list`, `find`) are scoped to the component data layer only

## Scope

### In scope (32 packages)

Component libraries (18):

- uikit, aikit, components, date-components, navigation, table, page-constructor,
  dashkit, dialog-fields, dynamic-forms, blog-constructor, data-source, timeline,
  chartkit, yagr, charts, graph, markdown-editor

Asset libraries (2):

- icons, illustrations

Utility libraries (4):

- i18n, date-utils, axios-wrapper, app-layout

Note: app-layout is a pure TypeScript utility (server-side HTML rendering helpers,
no React components, zero .tsx files as of 2026-03-18). It exports functions like
`render()` and utility helpers — processed by the utility strategy, not the component
strategy. The utility ingest script must check for .tsx files in the package before
running; if any are found, abort and surface a reclassification warning so the package
can be moved to the component libraries list and re-run with the component strategy.

Config / tooling (8):

- eslint-config, tsconfig, prettier-config, stylelint-config, babel-preset,
  browserslist-config, webpack-i18n-assets-plugin, page-constructor-builder

### Out of scope (3 packages)

- nodekit — server-side Node.js framework, separate ecosystem
- expresskit — Express.js utilities, separate ecosystem
- landing — internal Next.js documentation site, not a distributable library

## Entity Taxonomy

Six entity types replace the previous component-centric model:

`component`

- React component with props interface
- Source: TSX files in configured componentPaths
- Data: name, description, props (name, type, required, description, default), examples

`hook`

- Exported React hook (name starts with `use`)
- Source: follow the module graph transitively from the package entry point (index.ts),
  tracking all re-exports. Do not walk the filesystem independently — only hooks
  reachable via the public module graph are included.
- Data: name, signature, parameters (name, type, description), returnType,
  importPath, library
- The `rulesOfHooks: true` flag is a static constant on all hook entries (every hook
  by definition obeys Rules of Hooks); it signals to consumers that this entity has
  React call-site restrictions.

`api-function`

- Any named export from a utility library: function, class, type, interface, enum,
  or const. All are filed under the `api-function` entity type regardless of `kind`.
  The `kind` field (see Strategy 3) distinguishes the specific form.
- Source: TypeScript declarations (.d.ts or source), README
- Data: name, kind, signature, parameters, returnType, description, examples,
  importPath, library

`asset`

- Named icon or illustration export
- Source: index.ts of icons/illustrations packages
- Data: name, importPath, category (if available), library

`token`

- Design token (already ingested into `data/tokens.json`, no new ingest needed)
- Included in search index extension (Phase 0) so `find()` surfaces tokens alongside
  other entity types
- Data: name, value, description, category

`config-package`

- Build/lint/format configuration package
- Source: README, package.json
- Data: name, description, howToUse (the config key or CLI usage), library, npmPackage

Additionally, every library itself is a first-class entity accessible via `get('{lib}')`:

- name, npmPackage, description, entityTypes (which of the 6 types it contains),
  installation snippet, quickstart from README

## Ingest Strategies

### Strategy 1: Component + Hook (extended existing pipeline)

Applies to: all 18 component libraries

Component extraction: unchanged from current pipeline.

Hook extraction (new phase added to existing pipeline):

- Follow the module graph transitively from the package entry point (index.ts)
- Identify all exported functions matching `/^use[A-Z]/`
- Do not walk the filesystem independently — only hooks reachable via the public
  module graph are included; unexported internal hooks are excluded
- Extract TypeScript signature: parameters with types, return type
- Store separately from components in the same library JSON under `hooks: []`

Output: `data/components/{lib}.json` (extended with `hooks` array)

### Strategy 2: Asset

Applies to: icons, illustrations

Steps:

- Read `index.ts` or `index.tsx` at package root
- Collect all named exports
- For icons: attempt to read SVG viewBox or category from file path structure
- No LLM involvement; pure static extraction

Output: `data/assets/{lib}.json`

Format:

```json
{
  "library": "icons",
  "npmPackage": "@gravity-ui/icons",
  "assets": [
    { "name": "ArrowLeft", "importPath": "@gravity-ui/icons", "category": "arrow" }
  ]
}
```

### Strategy 3: Utility

Applies to: i18n, date-utils, axios-wrapper, app-layout

Steps:

- Resolve entry point from package.json `types` or `main` field
- Parse TypeScript declarations: extract all exported functions, classes, and types
- For each export: collect name, full signature, JSDoc description if present
- Extract README sections: Installation, Usage, Getting Started (first 2000 chars)

Output: `data/utilities/{lib}.json`

The `kind` field for each export must be one of:
`function | class | type | interface | enum | const`

Format:

```json
{
  "library": "i18n",
  "npmPackage": "@gravity-ui/i18n",
  "description": "...",
  "readme": "...",
  "exports": [
    {
      "name": "I18n",
      "kind": "class",
      "signature": "class I18n<TKeyset>",
      "description": "...",
      "importPath": "@gravity-ui/i18n"
    }
  ]
}
```

### Strategy 4: Config Package

Applies to: eslint-config, tsconfig, prettier-config, stylelint-config, babel-preset,
browserslist-config, webpack-i18n-assets-plugin, page-constructor-builder

Steps:

- Read package.json: name, description, version
- Extract README: first relevant section explaining how to use/extend
- For eslint/tsconfig/prettier/stylelint: capture the extend/plugin key
- For CLI tools (page-constructor-builder): capture bin name and basic usage flags

Output: `data/configs/{lib}.json`

Format:

```json
{
  "library": "eslint-config",
  "npmPackage": "@gravity-ui/eslint-config",
  "description": "...",
  "howToUse": "extends: ['@gravity-ui/eslint-config']",
  "readme": "..."
}
```

## Discovery Layer Changes

### `list` tool

New `type` parameter (optional):
`component | hook | api-function | asset | token | config-package | library`

Existing `scope` and `library` parameters unchanged.

Behavior:

- `list()` with no filters → all available libraries grouped by category
  (components, utilities, assets, configs). This is the ecosystem overview — use it
  to discover what libraries exist, not to enumerate individual entities.
- `list(type: 'library')` → same as above (explicit form)
- `list(library: 'i18n')` → all exports from i18n utility
- `list(type: 'hook')` → all hooks across all libraries
- `list(library: 'icons', type: 'asset')` → all icons

### `find` tool

Search mechanics are unchanged from the existing implementation (keyword matching
against the search index). This spec only extends what is indexed, not how matching
works. Each index entry gains two new fields: `type` and `library`.

Updated search-index entry schema:

- `type` (one of 6 entity types)
- `library` (source package)
- `name` — indexed as primary match target
- `description` — indexed as secondary match target

Indexed text per entity type:

- component: name + description + prop names
- hook: name + parameter names + return type description
- api-function: name + signature + description
- asset: name + category
- token: name + description + category
- config-package: name + description + howToUse

Examples (keyword matches, not semantic):

- `find('i18n')` → surfaces i18n library + its key exports
- `find('arrow')` → surfaces ArrowLeft and similar icon names
- `find('theme')` → surfaces useTheme hook + token entries

### `get` tool

Resolves by name across all entity types. Resolution works in two stages:

1. If the query exactly matches a known library name (from manifest), return the
   library entity immediately — the cascade is not consulted.
2. For all other queries, apply the collision cascade:
   `component > hook > api-function > asset > token > config-package > library`

Examples:

- `get('i18n')` → library card: description, installation, key exports summary
- `get('useTheme')` → hook entry: signature, parameters, importPath
- `get('ArrowLeft')` → asset entry: importPath, usage snippet
- `get('eslint-config')` → config card: howToUse, README excerpt

## Data Storage Layout

```text
data/
  components/     ← existing, extended with hooks[]
    uikit.json
    ...
  assets/         ← new
    icons.json
    illustrations.json
  utilities/      ← new
    i18n.json
    date-utils.json
    axios-wrapper.json
    app-layout.json
  configs/        ← new
    eslint-config.json
    tsconfig.json
    ...
  search-index.json   ← extended to include all entity types
  manifest.json       ← extended to list all 32 in-scope libraries
```

## Validation Layer

After each ingest run, a swarm of parallel mini-agents validates data quality against
vendor sources. Pattern: one agent per library runs in parallel; each agent reads the
generated JSON data and the corresponding vendor source, compares them, and emits
a list of discrepancies with severity HIGH / MEDIUM / LOW. A coordinator agent
aggregates all per-library reports into a single markdown file. No automatic fixes —
review only. (Established in `docs/superpowers/reports/2026-03-18-doc-review.md`.)

### Agent types per entity type

Component/hook-agent (existing, extended):

- Props in JSON vs actual TypeScript interfaces
- Missing components or hooks vs exports in source
- Empty descriptions
- Hook signature accuracy vs source

Utility-agent (new):

- Function signatures in JSON vs `.d.ts` declarations
- Missing exports vs actual package entry point
- Incorrect parameter/return types

Asset-agent (new):

- Export names in JSON vs actual `index.ts`
- Missing or surplus entries

Config-agent (new):

- Correctness of `howToUse` / extend key vs actual package config
- README accuracy

### Output

Single aggregated report: `docs/superpowers/reports/YYYY-MM-DD-ecosystem-review.md`

Sections: one per library, issues classified HIGH / MEDIUM / LOW.

Validation is not blocking — it runs after ingest completes and produces a report for
manual review. HIGH issues (wrong signatures, missing exports) must be resolved manually
before the phase is considered complete.

## Implementation Phases

Phase 0 — Search index schema extension:

- Define extended search-index entry schema: add `type` field (one of 6 entity types)
  and `library` field to every entry
- Migrate existing `search-index.json` entries to new schema
- Update server search logic to accept and filter on `type`
- Token entries from `data/tokens.json` added to search index in this phase
- Update `manifest.json` to list all 32 in-scope libraries (enables Stage 1 fast path
  in `get()` for library-name exact matches from Phase 1 onward)
- All subsequent phases write to this schema

Phase 1 — Fix the 7 missing component libraries (components only, no hooks yet):

- Add `charts` to `library-config.ts` with appropriate config
- Run component ingest for: dialog-fields, dynamic-forms, data-source, timeline,
  yagr, charts
- Fix markdown-editor moduleBased discovery issue
- Run component validation swarm for new data (reads JSON files directly, not via MCP tools)

Note: `chartkit` is already ingested (one of the 11 existing `data/components/*.json`
files). It is not part of the 7 missing libraries addressed in this phase.

Note: Phase 1 intentionally produces component-only data. Hook extraction is added
in Phase 2, which re-runs ingest for all 18 libraries. This two-pass design allows
early validation of component data before introducing hook extraction complexity.

Phase 2 — Hook extraction:

- Add hook-extraction phase to existing component pipeline
- Re-run ingest for all 18 component libraries to populate `hooks[]`
- Update search index

Phase 3 — Asset ingest:

- Implement asset strategy for icons and illustrations
- Populate `data/assets/`
- Extend search index

Phase 4 — Utility ingest:

- Implement utility strategy for i18n, date-utils, axios-wrapper, app-layout
- Populate `data/utilities/`
- Extend search index

Phase 5 — Config ingest:

- Implement config strategy for 8 config/tooling packages
- Populate `data/configs/`
- Extend search index

Phase 6 — Discovery layer:

- Extend `list` with `type` parameter
- Extend `find` search index to all entity types
- Extend `get` resolver to all entity types and data directories

Note: new entity types written in Phases 1–5 are not surfaced by the MCP tools until
Phase 6 completes. Validation swarms run in Phases 1–5 read JSON files directly from
`data/` — they do not use `get()`. Phase 7 validation is the first swarm that uses
the MCP tools. Phase 6 must therefore complete before Phase 7.

Phase 7 — Full ecosystem validation:

- Run validation swarm across all entity types
- Generate ecosystem-review report
- Fix HIGH severity issues
