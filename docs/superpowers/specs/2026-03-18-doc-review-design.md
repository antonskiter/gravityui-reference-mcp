# Documentation vs Source Review System — Design Spec

Date: 2026-03-18
Status: Approved

## Goal

Systematically verify that the generated component metadata in `data/components/*.json`
accurately reflects the actual TypeScript/React source code in `vendor/*/src/components/`
(and equivalent paths per library config).

The system produces a structured markdown report with all discrepancies classified by
severity. No automatic fixes — review only.

## Scope

All libraries that have both:

- A `data/components/<lib>.json` file
- Vendor source accessible via its configured `componentPaths` (from `src/ingest/library-config.ts`)

Note: component source paths vary per library. Examples:

- `uikit` → `src/components/` (subdirectory convention)
- `graph` → `src/react-components/` (non-standard path)
- `aikit` → `src/components/atoms`, `src/components/molecules`, etc. (multiple paths)
- `timeline`, `yagr` → `src/` with `flatFiles: true` (flat file convention)
- `markdown-editor` → `packages/editor/src` (monorepo-style path)

Phase 1 agents must read `src/ingest/library-config.ts` to resolve the correct paths and
file resolution strategy for their library before scanning.

## File Resolution Strategies

Two conventions exist, controlled by `flatFiles` in library-config:

**Subdirectory convention** (default, `flatFiles: false` or not set):

- File path: `vendor/<lib>/<componentPath>/<ComponentName>/<ComponentName>.tsx`

**Flat file convention** (`flatFiles: true`):

- File path: `vendor/<lib>/<componentPath>/<ComponentName>.tsx`

Phase 1 agents apply the appropriate strategy when mapping component names to TSX files.

## What Is Checked

### Structural checks (mechanical)

- Props present in TSX interface but missing in data (missing props)
- Props present in data but absent in TSX source (phantom props)
- Type mismatches — including union types, type aliases, generics
- Required/optional flag mismatches
- Default value mismatches

### Completeness checks (mechanical)

- Components present in data but with no matching TSX source file (`missing_source`)
- Components present in TSX source but absent from data entirely

### Description quality checks (LLM judgment)

- Does the data description accurately describe what the component does?
- Does the description reference props, variants, or behavior that don't exist in source?
- Is the description materially incomplete or misleading?

## Architecture

Five phases. Artifacts are saved to `artifacts/doc-review/` after each phase.

### Resume behavior

Each phase checks for existing artifacts before launching agents:

- Phase 1-merge: only runs scan agents for libraries missing a `scan/<lib>.json` artifact
- Phase 2a: skips batches that already have a `structural/<batch-id>.json` artifact
- Phase 2b: skips batches that already have a `descriptions/<batch-id>.json` artifact

This allows interrupted runs to be resumed without re-processing completed work.

---

### Phase 1 — Library scan (Haiku, one agent per library, all parallel)

One agent per library with a `data/components/<lib>.json` file (exact count determined
at runtime — typically 10–15 libraries). All agents launch simultaneously.

Each agent:

- Reads `src/ingest/library-config.ts` → resolves `componentPaths` and `flatFiles` for its library
- Reads `data/components/<lib>.json` → component list + count
- Scans each configured component path under `vendor/<lib>/` → maps component names to TSX files
- For each component: determines if a TSX source file exists using the appropriate resolution strategy

Artifact: `artifacts/doc-review/scan/<lib>.json`

Schema:

```json
{
  "library": "uikit",
  "component_count": 112,
  "component_paths": ["src/components"],
  "flat_files": false,
  "components": [
    {
      "name": "Accordion",
      "library": "uikit",
      "data_entry": true,
      "source_file_found": true,
      "source_file": "vendor/uikit/src/components/Accordion/Accordion.tsx"
    },
    {
      "name": "SomeOrphan",
      "library": "uikit",
      "data_entry": true,
      "source_file_found": false,
      "source_file": null
    }
  ],
  "suggested_batches": 8
}
```

---

### Phase 1-merge — Batching plan (Haiku, 1 agent)

Reads all scan artifacts, creates the final batch manifest.

Batching thresholds:

- `>50` components in library → batches of 15
- `15–50` components → batches of 10
- `<15` components → whole library = 1 batch
- `<5` components → group multiple small libraries into 1 batch

Each component entry in the batch manifest carries a `library` field so Phase 2 agents
can unambiguously look up the correct `data/components/<lib>.json`.

Artifact: `artifacts/doc-review/batching-plan.json`

Schema:

```json
{
  "total_batches": 20,
  "total_components": 250,
  "batches": [
    {
      "id": "uikit-1",
      "libraries": ["uikit"],
      "components": [
        { "name": "Accordion", "library": "uikit", "source_file": "vendor/uikit/src/components/Accordion/Accordion.tsx", "source_file_found": true },
        { "name": "Alert",     "library": "uikit", "source_file": "vendor/uikit/src/components/Alert/Alert.tsx",         "source_file_found": true }
      ]
    },
    {
      "id": "small-libs-1",
      "libraries": ["graph", "navigation"],
      "components": [
        { "name": "Graph",   "library": "graph",      "source_file": "vendor/graph/src/react-components/Graph.tsx", "source_file_found": true },
        { "name": "NavMenu", "library": "navigation", "source_file": null, "source_file_found": false }
      ]
    }
  ]
}
```

---

### Phase 2a — Structural review (Sonnet, one agent per batch, all parallel)

Sonnet is used (not Haiku) because TypeScript parsing is non-trivial: type aliases,
intersection types, conditional types, and generics require semantic understanding to
compare correctly.

Each agent:

- Reads the batch's component list from the batching plan artifact
- For each component where `source_file_found: true`: reads TSX source, reads data entry, compares
- For each component where `source_file_found: false`: records a `missing_source` HIGH issue, skips prop comparison
- Extracts description pairs for Phase 2b: `(component, library, tsx_context, data_description)`

Artifact: `artifacts/doc-review/structural/<batch-id>.json`

Schema:

```json
{
  "batch_id": "uikit-1",
  "libraries": ["uikit"],
  "issues": [
    {
      "component": "Button",
      "library": "uikit",
      "type": "missing_prop",
      "severity": "HIGH",
      "detail": "prop `loading` exists in TSX as `boolean` but absent from data"
    },
    {
      "component": "Card",
      "library": "uikit",
      "type": "phantom_prop",
      "severity": "HIGH",
      "detail": "prop `elevation` in data but not found in TSX interface"
    },
    {
      "component": "NavMenu",
      "library": "navigation",
      "type": "missing_source",
      "severity": "HIGH",
      "detail": "no TSX source file found for this component"
    },
    {
      "component": "TextInput",
      "library": "uikit",
      "type": "required_mismatch",
      "severity": "MEDIUM",
      "detail": "prop `value` — TSX: optional, data: required"
    }
  ],
  "description_pairs": [
    {
      "component": "Button",
      "library": "uikit",
      "tsx_context": "Full JSDoc + props interface from source",
      "data_description": "Description string from data/components/uikit.json"
    }
  ]
}
```

---

### Phase 2b — Description quality (Sonnet, one agent per batch, all parallel)

Starts as soon as the corresponding Phase 2a artifact is available (streamed per-batch,
not waiting for all Phase 2a to complete). Components with `missing_source` have no TSX
context and are skipped for description evaluation.

Each agent:

- Reads description pairs from the Phase 2a artifact
- For each component: evaluates data description against TSX context
- Assesses: accuracy, completeness, misleading claims

Artifact: `artifacts/doc-review/descriptions/<batch-id>.json`

Schema:

```json
{
  "batch_id": "uikit-1",
  "issues": [
    {
      "component": "Button",
      "library": "uikit",
      "severity": "HIGH",
      "issue": "Description claims 'supports href prop' but href is not a direct prop — link behavior requires ButtonLink variant",
      "suggestion": "Clarify that link rendering is achieved via the ButtonLink component type, not a direct href prop on Button"
    },
    {
      "component": "Accordion",
      "library": "uikit",
      "severity": "LOW",
      "issue": "Description does not mention that only one item can be open at a time in single-selection mode",
      "suggestion": "Add note about single vs multiple selection behavior controlled by the `multiple` prop"
    }
  ]
}
```

---

### Phase 3 — Merge and report (Sonnet, 1 agent)

Sonnet (not Haiku) to produce a high-quality report with cross-cutting insights — e.g.,
detecting systemic patterns like "60% of phantom props are deprecated props removed from
source but retained in data".

Reads all structural and description artifacts, generates the final report.

Output: `docs/superpowers/reports/2026-03-18-doc-review.md`

## Report Structure

```markdown
# Documentation Review Report — 2026-03-18

## Summary

- Libraries reviewed: N
- Components reviewed: N
- Total issues: N
  - HIGH: N (missing props, phantom props, type mismatches, missing source)
  - MEDIUM: N (required/default mismatches, material description errors)
  - LOW: N (incomplete or imprecise descriptions)

## Systemic Findings

Cross-cutting patterns observed across libraries. Examples:
- "N phantom props across N libraries are likely deprecated props not cleaned from data"
- "Union types are consistently stored as `string` in data across N components"

## Per-Library Results

### uikit — 112 components, N issues

#### HIGH

- **Button**: prop `loading` missing in data (TSX: `boolean`)
- **Card**: prop `elevation` in data but not in TSX (phantom)

#### MEDIUM

- **Accordion**: prop `size` type mismatch (TSX: `"s" | "m" | "l"`, data: `string`)

#### LOW

- **Alert**: description omits behavior of `theme` prop

### aikit — ...

## Appendix: Issue Type Reference

- missing_prop — prop exists in TSX interface but absent from data
- phantom_prop — prop exists in data but not found in TSX interface
- missing_source — no TSX source file found for component in data
- type_mismatch — prop type differs between TSX and data
- required_mismatch — required/optional flag differs
- default_mismatch — default value differs
- description_inaccurate — description contains factually wrong claims
- description_incomplete — description omits significant behavior
```

## Severity Classification

HIGH:

- missing_prop
- phantom_prop
- missing_source
- type_mismatch (any prop)

MEDIUM:

- required_mismatch
- default_mismatch
- description_inaccurate (factually wrong claims)

LOW:

- description_incomplete (omits behavior but makes no false claims)

## Artifact Directory Structure

```text
artifacts/
  doc-review/
    scan/
      uikit.json
      aikit.json
      ...
    batching-plan.json
    structural/
      uikit-1.json
      uikit-2.json
      small-libs-1.json
      ...
    descriptions/
      uikit-1.json
      uikit-2.json
      small-libs-1.json
      ...

docs/superpowers/reports/
  2026-03-18-doc-review.md
```

## Agent Count Estimate

- Phase 1 scan: one Haiku agent per library (exact count from `data/components/` at runtime)
- Phase 1 merge: 1 Haiku agent
- Phase 2a structural: one Sonnet agent per batch
- Phase 2b descriptions: one Sonnet agent per batch
- Phase 3 merge: 1 Sonnet agent

Total: determined at runtime based on library and component counts.

## What Is Not Covered

- JSX examples quality (not checked)
- import_path accuracy (not checked — covered by existing validate.ts)
- Recipe docs vs component reality (out of scope for this spec)
- Automatic fixes (report only)
