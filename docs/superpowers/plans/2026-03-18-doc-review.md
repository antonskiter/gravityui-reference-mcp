# Documentation vs Source Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a five-phase parallel-agent review of all 11 component libraries, comparing `data/components/*.json` against vendor TSX sources, and produce a severity-classified report at `docs/superpowers/reports/2026-03-18-doc-review.md`.

**Architecture:** Orchestration-only plan — no production code is written. Each task launches one or more AI agents with precise prompts; agents read files, compare data, and write JSON artifacts. Phase 1 runs 11 parallel Haiku scan agents → 1 Haiku batching agent → N parallel Sonnet structural agents → N parallel Sonnet description agents → 1 Sonnet merge agent.

**Tech Stack:** Claude agents (Haiku + Sonnet), filesystem MCP for artifact writes, project files at `/Users/skiter/Documents/Code/gravityui-reference-mcp/`

---

## File Map

Files created by this plan (all artifacts, no source code changes):

- Create: `artifacts/doc-review/scan/<lib>.json` — per-library scan results (Phase 1)
- Create: `artifacts/doc-review/batching-plan.json` — batch manifest (Phase 1-merge)
- Create: `artifacts/doc-review/structural/<batch-id>.json` — prop comparison results (Phase 2a)
- Create: `artifacts/doc-review/descriptions/<batch-id>.json` — description quality results (Phase 2b)
- Create: `docs/superpowers/reports/2026-03-18-doc-review.md` — final report (Phase 3)

---

## Background: Library Config Reference

The 11 libraries in scope (those with `data/components/*.json`):

```
uikit          componentPaths: [src/components, src/components/layout, src/components/controls, src/components/lab]  flatFiles: false
aikit          componentPaths: [src/components/atoms, src/components/molecules, src/components/organisms, src/components/templates, src/components/pages]  flatFiles: false
graph          componentPaths: [src/react-components]  flatFiles: true
components     componentPaths: [src/components]  flatFiles: false
date-components componentPaths: [src/components]  flatFiles: false
navigation     componentPaths: [src/components]  flatFiles: false
table          componentPaths: [src/components]  flatFiles: false
page-constructor componentPaths: [src/components]  flatFiles: false
dashkit        componentPaths: [src/components]  flatFiles: false
blog-constructor componentPaths: [src/components]  flatFiles: false
chartkit       componentPaths: [src/components]  flatFiles: false
```

File resolution strategies:
- `flatFiles: false` → `vendor/<lib>/<componentPath>/<ComponentName>/<ComponentName>.tsx`
- `flatFiles: true` → `vendor/<lib>/<componentPath>/<ComponentName>.tsx`

Component JSON schema (`data/components/<lib>.json`, each entry):

```json
{
  "id": "uikit:Button",
  "library": "uikit",
  "name": "Button",
  "description": "...",
  "category": "...",
  "props": [
    { "name": "size", "type": "string", "required": false, "default": "'m'", "description": "..." }
  ]
}
```

---

## Task 1: Create artifact directories

**Files:**

- Create: `artifacts/doc-review/scan/` (directory)
- Create: `artifacts/doc-review/structural/` (directory)
- Create: `artifacts/doc-review/descriptions/` (directory)
- Create: `docs/superpowers/reports/` (directory)

- [ ] **Step 1.1: Create all artifact directories using filesystem MCP**

Use `mcp__filesystem__create_directory` four times:

```
mcp__filesystem__create_directory("/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/scan")
mcp__filesystem__create_directory("/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/structural")
mcp__filesystem__create_directory("/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/descriptions")
mcp__filesystem__create_directory("/Users/skiter/Documents/Code/gravityui-reference-mcp/docs/superpowers/reports")
```

- [ ] **Step 1.2: Verify directories exist**

Use `mcp__filesystem__list_directory` on `artifacts/doc-review/` — should show `scan/`, `structural/`, `descriptions/`.

---

## Task 2: Phase 1 — Library scan (11 Haiku agents in parallel)

Launch all 11 agents simultaneously in a single message. Use `model: "haiku"` for all.

**Resume check:** Before launching, check which `artifacts/doc-review/scan/<lib>.json` files already exist. Skip agents for libraries that already have a scan artifact.

- [ ] **Step 2.1: Launch all 11 Haiku scan agents in parallel**

Each agent receives the prompt below with library-specific values substituted. All 11 are dispatched in a single `Agent` tool call batch.

**Agent prompt template (substitute `{{LIBRARY}}`, `{{COMPONENT_PATHS}}`, `{{FLAT_FILES}}`):**

```
You are a library scan agent. Your task: scan the vendor source for a single library and
produce a JSON artifact mapping each component in data/ to its TSX source file.

Working directory: /Users/skiter/Documents/Code/gravityui-reference-mcp

Library: {{LIBRARY}}
Component paths: {{COMPONENT_PATHS}}
FlatFiles mode: {{FLAT_FILES}}

## Step 1: Read data components

Read the file: data/components/{{LIBRARY}}.json
Extract every object's `name` field. This is the list of components to scan.

## Step 2: For each component, find its TSX source file

Use the file resolution strategy:
- If flatFiles is false: look for vendor/{{LIBRARY}}/{{COMPONENT_PATH}}/<ComponentName>/<ComponentName>.tsx
  Try each componentPath in order, stop at first match.
- If flatFiles is true: look for vendor/{{LIBRARY}}/{{COMPONENT_PATH}}/<ComponentName>.tsx
  Try each componentPath in order, stop at first match.

Use the Read tool (or Glob) to check if each candidate path exists. Set source_file_found: true/false accordingly.

## Step 3: Write artifact

Write the following JSON to artifacts/doc-review/scan/{{LIBRARY}}.json:

{
  "library": "{{LIBRARY}}",
  "component_count": <total components in data>,
  "component_paths": [{{COMPONENT_PATHS}}],
  "flat_files": {{FLAT_FILES}},
  "components": [
    {
      "name": "<ComponentName>",
      "library": "{{LIBRARY}}",
      "data_entry": true,
      "source_file_found": true | false,
      "source_file": "<path>" | null
    },
    ...one entry per component in data/components/{{LIBRARY}}.json...
  ],
  "suggested_batches": <ceil(component_count / 15) if component_count > 50, ceil(component_count / 10) if 15-50, 1 otherwise>
}

Write this file using the Write tool to:
/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/scan/{{LIBRARY}}.json
```

**Substitution table for all 11 agents:**

> Note: these values are extracted from `src/ingest/library-config.ts` at time of writing.
> If the config has changed since, verify against that file before launching agents.

```
Agent 1:  LIBRARY=uikit          COMPONENT_PATHS=src/components,src/components/layout,src/components/controls,src/components/lab   FLAT_FILES=false
Agent 2:  LIBRARY=aikit          COMPONENT_PATHS=src/components/atoms,src/components/molecules,src/components/organisms,src/components/templates,src/components/pages   FLAT_FILES=false
Agent 3:  LIBRARY=graph          COMPONENT_PATHS=src/react-components   FLAT_FILES=true
Agent 4:  LIBRARY=components     COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 5:  LIBRARY=date-components COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 6:  LIBRARY=navigation     COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 7:  LIBRARY=table          COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 8:  LIBRARY=page-constructor COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 9:  LIBRARY=dashkit        COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 10: LIBRARY=blog-constructor COMPONENT_PATHS=src/components   FLAT_FILES=false
Agent 11: LIBRARY=chartkit       COMPONENT_PATHS=src/components   FLAT_FILES=false
```

- [ ] **Step 2.2: Verify all 11 scan artifacts were written**

Use `mcp__filesystem__list_directory` on `artifacts/doc-review/scan/` — must show 11 `.json` files. If any are missing, re-run that agent only.

- [ ] **Step 2.3: Spot-check one artifact for correctness**

Read `artifacts/doc-review/scan/uikit.json`. Verify it has `components` array with `source_file_found` and `source_file` fields on each entry.

---

## Task 3: Phase 1-merge — Batching plan (1 Haiku agent)

- [ ] **Step 3.1: Launch the batching agent (Haiku)**

```
You are a batching plan agent. Your task: read all 11 library scan artifacts and produce
a unified batching plan that groups components into review batches.

Working directory: /Users/skiter/Documents/Code/gravityui-reference-mcp

## Step 1: Read all scan artifacts

Read all 11 files:
- artifacts/doc-review/scan/uikit.json
- artifacts/doc-review/scan/aikit.json
- artifacts/doc-review/scan/graph.json
- artifacts/doc-review/scan/components.json
- artifacts/doc-review/scan/date-components.json
- artifacts/doc-review/scan/navigation.json
- artifacts/doc-review/scan/table.json
- artifacts/doc-review/scan/page-constructor.json
- artifacts/doc-review/scan/dashkit.json
- artifacts/doc-review/scan/blog-constructor.json
- artifacts/doc-review/scan/chartkit.json

## Step 2: Apply batching rules per library

For each library, split its components into batches:
- component_count > 50 → batches of 15 (e.g., uikit-1, uikit-2, ...)
- component_count 15–50 → batches of 10
- component_count < 15 → 1 batch for the whole library
- component_count < 5 → group with another small library in the same batch

Name each batch: <library>-<N> (e.g., uikit-1, uikit-2, navigation-1).
For grouped small libraries: name it <lib1>-<lib2>-1.

Each component entry in the batch must carry: name, library, source_file, source_file_found.

## Step 3: Write batching plan

Write the following JSON to artifacts/doc-review/batching-plan.json:

{
  "total_batches": <count>,
  "total_components": <count>,
  "batches": [
    {
      "id": "<batch-id>",
      "libraries": ["<lib>"],
      "components": [
        { "name": "<name>", "library": "<lib>", "source_file": "<path>|null", "source_file_found": true|false }
      ]
    }
  ]
}

Write to:
/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/batching-plan.json
```

- [ ] **Step 3.2: Verify batching plan**

Read `artifacts/doc-review/batching-plan.json`. Check:
- `total_batches` is non-zero
- `total_components` roughly matches sum of all scan artifact `component_count` fields
- Each batch has `id`, `libraries`, `components` array
- Each component has `name`, `library`, `source_file`, `source_file_found`

---

## Task 4: Phase 2a — Structural review (Sonnet agents, all batches in parallel)

Read `artifacts/doc-review/batching-plan.json` to get the list of batch IDs. Launch one Sonnet agent per batch, all simultaneously. Use `model: "sonnet"`.

**Resume check:** Before launching, check which `artifacts/doc-review/structural/<batch-id>.json` files already exist. Skip agents for batches that already have a structural artifact.

- [ ] **Step 4.1: Launch one Sonnet structural agent per batch (all parallel)**

**Agent prompt template (substitute `{{BATCH_ID}}` and `{{BATCH_COMPONENTS_JSON}}`):**

```
You are a structural review agent. Your task: compare each component's TSX source interface
against its data/components JSON entry and report all structural discrepancies.

Working directory: /Users/skiter/Documents/Code/gravityui-reference-mcp

Batch ID: {{BATCH_ID}}
Components to review (JSON array from batching plan):
{{BATCH_COMPONENTS_JSON}}

## Severity classification

HIGH:
- missing_prop — prop in TSX interface but absent from data props array
- phantom_prop — prop in data props array but not in TSX interface
- missing_source — source_file_found is false
- type_mismatch — prop type differs between TSX and data

MEDIUM:
- required_mismatch — required/optional differs between TSX and data
- default_mismatch — default value differs between TSX and data

## For each component in the batch:

### If source_file_found is false:
Record one issue: type=missing_source, severity=HIGH, detail="no TSX source file found".
Skip to next component.

### If source_file_found is true:
1. Read the TSX source file at the given source_file path
2. Find the main props interface (the one exported or used by the component's forwardRef/FC)
   - For union-type components (e.g., ButtonButtonProps | ButtonLinkProps), use the UNION
     of all props across all variants — any prop appearing in any variant counts as existing
3. Extract all props: name, type (as literal string from source), required (no `?` = required),
   default (from defaultProps or parameter destructuring defaults)
4. Read data/components/<library>.json and find the entry where name matches this component
5. Compare TSX props vs data props:
   - For each TSX prop: is it in data? If not → missing_prop HIGH
   - For each data prop: is it in TSX? If not → phantom_prop HIGH
   - For matching props: compare type strings (allow semantic equivalence — "boolean" == "bool"),
     required flag, default value

### Also check: TSX components absent from data

After processing all components in the batch:
- List all component names found in the TSX source paths for this batch's libraries
  (i.e., all .tsx files matching the file resolution pattern — use Glob)
- For each TSX component that has no entry in data/components/<lib>.json → record issue:
  type=missing_from_data, severity=HIGH,
  detail="component exists in TSX source but has no entry in data/components/<lib>.json"

### Extract description pairs for Phase 2b:
For each component with source_file_found true, extract:
- tsx_context: the JSDoc comment above the component export + the full props interface text
  (verbatim from source, max 2000 chars)
- data_description: the description field from the data JSON entry

## Output

Write this JSON to artifacts/doc-review/structural/{{BATCH_ID}}.json:

{
  "batch_id": "{{BATCH_ID}}",
  "libraries": [<unique library names in this batch>],
  "issues": [
    {
      "component": "<name>",
      "library": "<lib>",
      "type": "missing_prop|phantom_prop|missing_source|type_mismatch|required_mismatch|default_mismatch",
      "severity": "HIGH|MEDIUM",
      "detail": "<human-readable explanation>"
    }
  ],
  "description_pairs": [
    {
      "component": "<name>",
      "library": "<lib>",
      "tsx_context": "<JSDoc + interface text>",
      "data_description": "<description from data JSON>"
    }
  ]
}

If a component has no issues, do not add any entries to issues[] for it.
Write to:
/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/structural/{{BATCH_ID}}.json
```

- [ ] **Step 4.2: Verify all structural artifacts were written**

Use `mcp__filesystem__list_directory` on `artifacts/doc-review/structural/`. Count must match `total_batches` from the batching plan. Re-run any missing agents.

- [ ] **Step 4.3: Spot-check one artifact**

Read `artifacts/doc-review/structural/uikit-1.json`. Verify it has `issues` and `description_pairs` arrays. Both may be empty arrays if no issues found.

---

## Task 5: Phase 2b — Description quality (Sonnet agents, all batches in parallel)

Launch one Sonnet agent per batch simultaneously. These can start as soon as all Phase 2a artifacts are present. Use `model: "sonnet"`.

**Resume check:** Before launching, check which `artifacts/doc-review/descriptions/<batch-id>.json` files already exist. Skip completed batches.

- [ ] **Step 5.1: Launch one Sonnet description agent per batch (all parallel)**

**Agent prompt template (substitute `{{BATCH_ID}}`):**

```
You are a description quality agent. Your task: evaluate whether each component's description
in the data JSON accurately reflects what the component does based on its TSX source.

Working directory: /Users/skiter/Documents/Code/gravityui-reference-mcp

Batch ID: {{BATCH_ID}}

## Step 1: Read the structural artifact for this batch

Read: artifacts/doc-review/structural/{{BATCH_ID}}.json

Extract the `description_pairs` array. If it is empty, write an empty issues array and stop.

## Step 2: For each description pair, evaluate

You have:
- tsx_context: JSDoc comment + props interface from the actual TypeScript source
- data_description: the description stored in our data JSON

Evaluate the data_description against the tsx_context:

Severity MEDIUM — description_inaccurate — if the description:
- Claims a prop/feature/behavior exists that is NOT in the TSX source
- States the component does something fundamentally different from what the source shows
- References a prop name that does not exist

Severity LOW — description_incomplete — if the description:
- Omits a significant behavior visible in the source (e.g., ignores a key prop entirely)
- Is vague enough that it could describe a completely different component
- Is accurate but missing semantically important details

Do NOT flag:
- Minor wording differences
- Descriptions that are accurate but could be more detailed
- Stylistic choices or marketing language
- Descriptions that are short but factually correct

## Step 3: Write artifact

Write JSON to artifacts/doc-review/descriptions/{{BATCH_ID}}.json:

{
  "batch_id": "{{BATCH_ID}}",
  "issues": [
    {
      "component": "<name>",
      "library": "<lib>",
      "severity": "MEDIUM|LOW",
      "issue": "<what is wrong>",
      "suggestion": "<what the description should say instead>"
    }
  ]
}

Write to:
/Users/skiter/Documents/Code/gravityui-reference-mcp/artifacts/doc-review/descriptions/{{BATCH_ID}}.json
```

- [ ] **Step 5.2: Verify all description artifacts were written**

Use `mcp__filesystem__list_directory` on `artifacts/doc-review/descriptions/`. Count must match `total_batches`. Re-run any missing agents.

---

## Task 6: Phase 3 — Merge and report (1 Sonnet agent)

- [ ] **Step 6.1: Launch the merge agent (Sonnet)**

```
You are the report merge agent. Your task: read all structural and description artifacts,
identify systemic patterns, and generate the final documentation review report.

Working directory: /Users/skiter/Documents/Code/gravityui-reference-mcp

## Step 1: Read the batching plan

Read: artifacts/doc-review/batching-plan.json
Extract the list of all batch IDs and total counts.

## Step 2: Read all structural artifacts

For each batch ID, read: artifacts/doc-review/structural/<batch-id>.json
Collect all issues arrays. Merge into a per-library index.

## Step 3: Read all description artifacts

For each batch ID, read: artifacts/doc-review/descriptions/<batch-id>.json
Collect all issues arrays. Merge into the same per-library index.

## Step 4: Identify systemic patterns

Look for cross-library patterns in the merged issue set. Examples:
- "Union types stored as plain `string` in data across N components in N libraries"
- "Deprecated props present in data but removed from TSX source in N libraries"
- "Components with missing TSX source are concentrated in X library"
- "Description issues are predominantly in Y category of component"

## Step 5: Build summary counts

Per severity (HIGH/MEDIUM/LOW), count total issues. Count by issue type.
Count per library: how many components reviewed, how many have at least one issue.

## Step 6: Write the report

Write a markdown report to docs/superpowers/reports/2026-03-18-doc-review.md with this structure:

---
# Documentation Review Report — 2026-03-18

## Summary

- Libraries reviewed: N
- Components reviewed: N
- Total issues: N (HIGH: N, MEDIUM: N, LOW: N)

Top issue types:
- missing_prop: N occurrences across N libraries
- phantom_prop: N occurrences
- missing_from_data: N occurrences
- type_mismatch: N occurrences
- required_mismatch: N occurrences
- default_mismatch: N occurrences
- description_inaccurate: N occurrences
- description_incomplete: N occurrences
- missing_source: N occurrences

## Systemic Findings

[Describe 3–5 cross-cutting patterns you observed. Be specific — name libraries and issue
types. These should be actionable insights, not vague observations.]

## Per-Library Results

For each library (ordered by issue count, highest first):

### <library> — <N> components, <N> issues (HIGH: N, MEDIUM: N, LOW: N)

#### HIGH

- **<Component>**: <issue type> — <detail>
[one bullet per HIGH issue]

#### MEDIUM

- **<Component>**: <issue type> — <detail>

#### LOW

- **<Component>**: <issue>

(Omit a severity section entirely if that library has zero issues of that severity.)
(If a library has zero issues at all, write: "No issues found." under the library header.)

## Appendix: Issue Type Reference

- missing_prop — prop exists in TSX interface but absent from data (HIGH)
- phantom_prop — prop exists in data but not found in TSX interface (HIGH)
- missing_source — no TSX source file found for component in data (HIGH)
- missing_from_data — component exists in TSX source but absent from data (HIGH)
- type_mismatch — prop type differs between TSX and data (HIGH)
- required_mismatch — required/optional flag differs (MEDIUM)
- default_mismatch — default value differs (MEDIUM)
- description_inaccurate — description contains factually wrong claims (MEDIUM)
- description_incomplete — description omits significant behavior (LOW)
---

Write to:
/Users/skiter/Documents/Code/gravityui-reference-mcp/docs/superpowers/reports/2026-03-18-doc-review.md
```

- [ ] **Step 6.2: Verify the report was written**

Read `docs/superpowers/reports/2026-03-18-doc-review.md`. Verify it contains:
- A Summary section with numeric counts
- A Systemic Findings section with at least 1 finding
- At least one Per-Library section

If the file is empty or missing key sections, re-run the merge agent.

---

## Task 7: Commit artifacts and report

- [ ] **Step 7.1: Stage and commit**

```bash
git add -f artifacts/doc-review docs/superpowers/reports/2026-03-18-doc-review.md
git commit -m "feat: run documentation vs source review, generate report"
```

- [ ] **Step 7.2: Confirm commit succeeded**

Run `git log --oneline -3` and confirm the new commit appears.

---

## Notes for Executing Agent

- This plan is **orchestration only** — no TypeScript/JavaScript source code is written or modified
- All file writes use the Write tool or filesystem MCP
- Agent model selection matters: Haiku for mechanical tasks (scan, batching), Sonnet for judgment tasks (structural comparison, description quality, final report)
- Phase 2a and 2b can be batched and launched together if the orchestrator reads the batching plan first and knows all batch IDs — this saves one round trip
- If a batch agent fails mid-run and its artifact is incomplete, delete the partial artifact and re-run that agent only
