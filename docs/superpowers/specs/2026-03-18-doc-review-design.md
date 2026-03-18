# Documentation vs Source Review System — Design Spec

Date: 2026-03-18
Status: Approved

## Goal

Systematically verify that the generated component metadata in `data/components/*.json`
accurately reflects the actual TypeScript/React source code in `vendor/*/src/components/`.

The system produces a structured markdown report with all discrepancies classified by
severity. No automatic fixes — review only.

## Scope

All libraries that have both:
- A `data/components/<lib>.json` file
- A corresponding `vendor/<lib>/src/components/` directory

## What Is Checked

### Structural checks (mechanical)
- Props present in TSX interface but missing in data (missing props)
- Props present in data but absent in TSX source (phantom props)
- Type mismatches — including union types, type aliases, generics
- Required/optional flag mismatches
- Default value mismatches

### Completeness checks (mechanical)
- Components present in data but with no matching TSX source file
- Components present in TSX source but absent from data entirely (already covered by drift.test.ts but re-verified here for accuracy)

### Description quality checks (LLM judgment)
- Does the data description accurately describe what the component does?
- Does the description reference props, variants, or behavior that don't exist in source?
- Is the description materially incomplete or misleading?

## Architecture

Five phases. Artifacts are saved to `artifacts/doc-review/` after each phase so execution
can be resumed if interrupted.

### Phase 1 — Library scan (Haiku, one agent per library, all parallel)

~28 agents launched simultaneously, one per library.

Each agent:
- Reads `data/components/<lib>.json` → component list + count
- Scans `vendor/<lib>/src/components/` → TSX file list, component-to-file mapping
- Outputs its scan result as a JSON artifact

Artifact: `artifacts/doc-review/scan/<lib>.json`

Schema:
```json
{
  "library": "uikit",
  "component_count": 112,
  "components": [
    {
      "name": "Accordion",
      "data_entry": true,
      "source_file": "vendor/uikit/src/components/Accordion/Accordion.tsx"
    }
  ],
  "suggested_batches": 8
}
```

### Phase 1-merge — Batching plan (Haiku, 1 agent)

Reads all scan artifacts, creates the final batch manifest.

Batching thresholds:
- >50 components in library → batches of 15
- 15–50 components → batches of 10
- <15 components → whole library = 1 batch
- <5 components → group multiple small libraries into 1 batch

Artifact: `artifacts/doc-review/batching-plan.json`

Schema:
```json
{
  "total_batches": 42,
  "total_components": 380,
  "batches": [
    {
      "id": "uikit-1",
      "library": "uikit",
      "components": ["Accordion", "Alert", "ArrowToggle"]
    },
    {
      "id": "small-libs-1",
      "libraries": ["graph", "navigation"],
      "components": [...]
    }
  ]
}
```

### Phase 2a — Structural review (Sonnet, one agent per batch, all parallel)

Sonnet is used (not Haiku) because TypeScript parsing is non-trivial: type aliases,
intersection types, conditional types, and generics require semantic understanding to
compare correctly.

Each agent:
- Reads TSX source files for all components in the batch
- Reads corresponding entries from `data/components/<lib>.json`
- Performs structural and completeness checks
- Extracts description pairs for Phase 2b: `(component, tsx_context, data_description)`

Artifact: `artifacts/doc-review/structural/<batch-id>.json`

Schema:
```json
{
  "batch_id": "uikit-1",
  "library": "uikit",
  "issues": [
    {
      "component": "Button",
      "type": "missing_prop",
      "severity": "HIGH",
      "detail": "prop `loading` exists in TSX as `boolean` but absent from data"
    },
    {
      "component": "Card",
      "type": "phantom_prop",
      "severity": "HIGH",
      "detail": "prop `elevation` in data but not found in TSX interface"
    },
    {
      "component": "Accordion",
      "type": "type_mismatch",
      "severity": "HIGH",
      "detail": "prop `size` — TSX: `\"s\" | \"m\" | \"l\" | \"xl\"`, data: `string`"
    },
    {
      "component": "TextInput",
      "type": "required_mismatch",
      "severity": "MEDIUM",
      "detail": "prop `value` — TSX: optional, data: required"
    },
    {
      "component": "Select",
      "type": "default_mismatch",
      "severity": "MEDIUM",
      "detail": "prop `size` — TSX default: `\"m\"`, data default: `\"s\"`"
    }
  ],
  "description_pairs": [
    {
      "component": "Button",
      "tsx_context": "Full JSDoc + props interface from source",
      "data_description": "Description string from data/components/uikit.json"
    }
  ]
}
```

### Phase 2b — Description quality (Sonnet, one agent per batch, all parallel)

Starts as soon as the corresponding Phase 2a artifact is available (streamed, not waiting
for all Phase 2a to complete). In practice with 40+ parallel agents the difference is
minimal, but the dependency is per-batch not global.

Each agent:
- Receives description pairs from the Phase 2a artifact
- For each component: reads TSX context + evaluates data description
- Assesses: accuracy, completeness, misleading claims

Artifact: `artifacts/doc-review/descriptions/<batch-id>.json`

Schema:
```json
{
  "batch_id": "uikit-1",
  "issues": [
    {
      "component": "Button",
      "severity": "HIGH",
      "issue": "Description claims 'supports href prop' but href is not a direct prop — link behavior requires ButtonLink variant",
      "suggestion": "Clarify that link rendering is achieved via the ButtonLink component type, not a direct href prop on Button"
    },
    {
      "component": "Accordion",
      "severity": "LOW",
      "issue": "Description does not mention that only one item can be open at a time in single-selection mode",
      "suggestion": "Add note about single vs multiple selection behavior controlled by the `multiple` prop"
    }
  ]
}
```

### Phase 3 — Merge and report (Sonnet, 1 agent)

Sonnet (not Haiku) to produce a high-quality report with cross-cutting insights — e.g.,
detecting systemic patterns like "60% of phantom props are deprecated props removed from
source but retained in data".

Reads all structural and description artifacts, generates the final report.

Output: `docs/superpowers/reports/2026-03-18-doc-review.md`

## Report Structure

```
# Documentation Review Report — 2026-03-18

## Summary

- Libraries reviewed: N
- Components reviewed: N
- Total issues: N
  - HIGH: N (missing props, phantom props, type mismatches)
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
- type_mismatch (any prop)

MEDIUM:
- required_mismatch
- default_mismatch
- description_inaccurate (factually wrong claims)

LOW:
- description_incomplete (omits behavior but makes no false claims)

## Artifact Directory Structure

```
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
      ...
    descriptions/
      uikit-1.json
      uikit-2.json
      ...

docs/superpowers/reports/
  2026-03-18-doc-review.md
```

## Agent Count Estimate

- Phase 1 scan: ~28 Haiku agents
- Phase 1 merge: 1 Haiku agent
- Phase 2a structural: ~42 Sonnet agents
- Phase 2b descriptions: ~42 Sonnet agents
- Phase 3 merge: 1 Sonnet agent

Total: ~114 agents, running in 5 waves

## What Is Not Covered

- JSX examples quality (not checked)
- import_path accuracy (not checked — covered by existing validate.ts)
- Recipe docs vs component reality (out of scope for this spec)
- Automatic fixes (report only)
