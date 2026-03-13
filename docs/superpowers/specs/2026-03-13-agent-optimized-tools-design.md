# Agent-Optimized Tools for Gravity UI Reference MCP

**Date:** 2026-03-13
**Status:** Approved

## Problem

The existing 5 MCP tools (search_docs, get_section, get_page, list_components, list_sources) are designed for browsing and targeted lookup. An AI agent writing code with Gravity UI needs ~15 tool calls to gather enough context for a 3-component form. The tools lack:

- A single-call component reference (props + example + import)
- Semantic "what component should I use?" suggestions
- Library onboarding (install + setup + component overview)
- Design system philosophy (theming, spacing, color model)

## Solution

Add 4 new tools alongside the existing 5 (no changes to existing tools), plus a new ingest step for semantic tag generation.

---

## Tool 1: `suggest_component`

**Purpose:** Agent describes a need → gets ranked component suggestions.

**Signature:**
```typescript
suggest_component({
  use_case: string,       // e.g. "date range selection", "sidebar navigation"
  library?: string,       // optional filter
  limit?: number,         // 1-5, default 3
})
```

**MCP tool description:**
`"Suggest Gravity UI components for a described use case. Returns ranked suggestions based on semantic tag matching. Use this when you know what you need but not which component provides it."`

**Implementation:**
1. Tokenize `use_case` into words, lowercase, remove stop words
2. For each component in `tagsByPageId` (scoped to `page_type === "component"` only), score by counting tag matches (exact + fuzzy via inline Levenshtein, ~15 lines, no external dependency)
3. Also run a MiniSearch query against the index, then post-filter results to `page_type === "component"` only (consistent with existing `search-docs.ts` filtering pattern). Merge scores.
4. **Score normalization:** normalize MiniSearch scores to 0-1 by dividing by max score in the post-filtered result set (guard: if no results, MiniSearch component is 0); normalize tag scores to 0-1 by dividing by number of query terms. Combine: `0.4 * tagScore + 0.6 * searchScore`. If either source returns zero results, that component contributes 0 to the final score.
5. Rank by combined score, return top N

**Error handling:** If no matches found, return `{ suggestions: [] }`. No error object — an empty result is valid.

**Response:**
```json
{
  "suggestions": [
    {
      "component": "DatePicker",
      "library": "date-components",
      "page_id": "component:date-components:DatePicker",
      "description": "DatePicker allows users to select a single date...",
      "matching_tags": ["date", "calendar", "date-picker"],
      "score": 0.92
    }
  ]
}
```

---

## Tool 2: `get_component_reference`

**Purpose:** Single call to get everything an agent needs to write code with a component.

**Signature:**
```typescript
get_component_reference({
  name: string,          // e.g. "Button", "Select"
  library: string,       // e.g. "uikit", "date-components"
  detail?: "compact" | "full",  // default "compact"
})
```

**MCP tool description:**
`"Get a complete reference for a Gravity UI component in a single call. Returns import statement, props, code example, and optionally full documentation. Use this when you know which component you need and want to start coding."`

**Implementation:**
1. Look up page by constructing `component:${library}:${name}` page ID. If not found, return `{ error: "Component not found: ${name} in ${library}" }`.
2. Gather all chunks for that page via `chunksByPageId`
3. Build response based on `detail` level

**Compact response** (default):
- `import_statement`: `import {${title}} from '@gravity-ui/${library}';` (assumes PascalCase page titles, which holds for all current components)
- `description`: full page description (not truncated)
- `props`: content from chunk whose `section_title` case-insensitively matches `["Properties", "Props", "API"]` (first match wins). Field is optional — omitted if no matching chunk found.
- `example`: first non-empty code example from the intro chunk. Optional — omitted if none.
- `design_guide_sections`: found by constructing `guide:${page.title}` (using the looked-up page's `title` field, not the raw `name` input) and looking up in `pageById`. If found, return its `section_ids`. If no guide exists, return empty array `[]`.

**Full response** — compact plus:
- `all_sections`: `{ title, content, code_examples }[]` for every chunk on the page (including intro/Properties — no deduplication, keeps response predictable)
- `design_guide`: array of `{ title: string, content: string }` objects, one per section of the matching guide page. Empty array if no guide.
- `css_api`: content from "CSS API" chunk. Optional — omitted if not found.

**Import statement derivation:**
- Package: `@gravity-ui/${library}` (consistent across all libraries)
- Component: page title (PascalCase, no spaces in current data)
- Result: `import {${title}} from '@gravity-ui/${library}';`

**Response (compact):**
```json
{
  "component": "Button",
  "library": "uikit",
  "import_statement": "import {Button} from '@gravity-ui/uikit';",
  "description": "Buttons act as a trigger for certain actions...",
  "props": "| Name | Description | Type | Default |\n...",
  "example": "<Button view=\"action\" size=\"l\">Action</Button>",
  "design_guide_sections": ["guide:Button:appearance", "guide:Button:sizes"],
  "url": "https://gravity-ui.com/components/uikit/button",
  "github_url": "https://github.com/gravity-ui/uikit/tree/main/src/components/Button"
}
```

**Response (full) — extends compact with:**
```json
{
  "...compact fields...",
  "all_sections": [
    { "title": "Button", "content": "Buttons act as a trigger...", "code_examples": ["<Button view=\"action\">Action</Button>"] },
    { "title": "Appearance", "content": "There are four Button types...", "code_examples": [] },
    { "title": "Properties", "content": "| Name | Description | ...", "code_examples": [] }
  ],
  "design_guide": [
    { "title": "Appearance", "content": "..." },
    { "title": "Sizes", "content": "Each button can have four sizes..." }
  ],
  "css_api": "| Name | Description |\n| --button-height | ... |"
}
```

**Error response:**
```json
{ "error": "Component not found: Foo in uikit" }
```

---

## Tool 3: `get_quick_start`

**Purpose:** Agent has decided to use a library — give it install, setup, and component overview.

**Signature:**
```typescript
get_quick_start({
  library: string,       // e.g. "uikit", "navigation"
})
```

**MCP tool description:**
`"Get everything needed to start using a Gravity UI library: install command, setup code, and a list of available components. Use this when you've decided which library to use and need to set it up."`

**Implementation:**
1. Look up library page via `library:${library}` page ID. If not found, return `{ error: "Library not found: ${library}" }`.
2. Extract install/usage from library chunks
3. List components via page filtering

**Extraction logic:**
- `install`: chunk with section_title "Install" → first code block. Optional — omitted if no Install chunk.
- `peer_dependencies`: same Install chunk → second code block or text mentioning peer deps. Optional — omitted if not found.
- `setup_code`: chunk with section_title matching `["Usage", "Getting started", "Get started"]` (case-insensitive) → first code block. Optional — omitted if no matching chunk (only ~5 of 34 libraries have this).
- `description`: page description or first chunk intro text
- `components`: `data.pages.filter(p => p.page_type === "component" && p.library === library)`

**Response:**
```json
{
  "library": "navigation",
  "package": "@gravity-ui/navigation",
  "install": "npm install @gravity-ui/navigation",
  "peer_dependencies": "npm install --dev @gravity-ui/uikit@^6.15.0 ...",
  "setup_code": "import {AsideHeader} from '@gravity-ui/navigation';...",
  "description": "Aside Header Navigation",
  "components": [
    {
      "name": "AsideHeader",
      "description": "Flexible and customizable navigation...",
      "page_id": "component:navigation:AsideHeader"
    }
  ],
  "url": "https://gravity-ui.com/libraries/navigation",
  "github_url": "https://github.com/gravity-ui/navigation"
}
```

---

## Tool 4: `get_design_system_overview`

**Purpose:** System-level Gravity UI philosophy + per-library purpose and relationships.

**Signature:**
```typescript
get_design_system_overview({
  library?: string,   // optional — if set, return system-level + only that library's section
})
```

**MCP tool description:**
`"Get the Gravity UI design system philosophy and library overview. Returns theming model, color system, spacing conventions, and per-library purpose with dependency relationships. Call this once at the start of a session to understand the design system before building with it."`

**Implementation:**
1. System-level content is assembled at ingest time from specific design guide page IDs: `["guide:Basics", "guide:Color", "guide:Module", "guide:Typography", "guide:CornerRadius", "guide:Branding"]`. Content is pulled from the first section of each guide and truncated to ~300 chars at sentence boundary. Stored as `data/overview.json`. **Fallback:** if a guide page ID does not exist (renamed/removed), skip it and log a warning during ingest. The overview is valid with partial data.
2. Per-library entries include purpose (extracted from library page description with ~200 char limit), component count, and dependency relationships.
3. **Dependency graph:** parse peer dependencies from each library's Install chunk text (regex for `@gravity-ui/` package references). Build forward map (`depends_on`), then invert to build reverse map (`is_peer_dependency_of`).

**Error handling:** If `library` filter is provided and not found, return `{ error: "Library not found: ${library}" }`. System section is always returned.

**Response:**
```json
{
  "system": {
    "description": "Gravity UI is a collection of libraries and components for building functional user interfaces...",
    "theming": "Supports light, dark, and high-contrast themes. Two-layer color model: private palette (RGBA values) and semantic palette (applied to UI elements)...",
    "spacing": "4x4px module system. All spacings and sizes derive from this unit...",
    "typography": "Based on Inter (standard) and monospace. Configurable font styles, weights, sizes, and leading...",
    "corner_radius": "CSS variables for control radii. Change variables to adjust all controls consistently...",
    "branding": "Quick theme creation via base brand colors, typography overrides, and technical colors..."
  },
  "libraries": [
    {
      "id": "uikit",
      "package": "@gravity-ui/uikit",
      "purpose": "Core component library — buttons, inputs, dialogs, tables, navigation elements. The foundation that all other libraries build on.",
      "component_count": 59,
      "is_peer_dependency_of": ["navigation", "date-components", "components"],
      "depends_on": []
    },
    {
      "id": "date-components",
      "package": "@gravity-ui/date-components",
      "purpose": "Date and time selection components — DatePicker, RangeCalendar, RelativeDatePicker.",
      "component_count": 6,
      "depends_on": ["uikit"],
      "is_peer_dependency_of": []
    }
  ]
}
```

Both `depends_on` and `is_peer_dependency_of` are always present (empty array when none). `url` and `github_url` for components and libraries come directly from the `Page` record fields.

---

## Ingest Pipeline: Tag Generation

**New file:** `src/ingest/tags.ts`

A new step between chunking and indexing in `run.ts` that generates semantic tags for each component page.

**Tag sources:**
1. **Description text**: tokenize, remove stop words, extract meaningful terms
2. **Section titles**: "Filtering options" → `filtering`, "Selecting multiple options" → `multi-select`
3. **Prop names**: parse Properties section for prop names like `multiple`, `disabled` → infer capability tags
4. **Synonym expansion**: static synonym map in code:
   - `"select"` → `["dropdown", "picker", "combobox"]`
   - `"checkbox"` → `["toggle", "check", "tick"]`
   - `"date"` → `["calendar", "datetime", "date-picker"]`
   - `"button"` → `["action", "submit", "trigger", "cta"]`
   - `"dialog"` → `["modal", "popup", "overlay", "window"]`
   - `"table"` → `["grid", "data-table", "spreadsheet", "rows", "columns"]`
   - etc.

**Output:** `data/tags.json`
```json
{
  "component:uikit:Button": ["button", "action", "submit", "trigger", "link", "form"],
  "component:uikit:Select": ["select", "dropdown", "picker", "combobox", "form-input", "multi-select", "filtering"],
  "component:date-components:DatePicker": ["date", "calendar", "date-picker", "datetime", "form-input"]
}
```

## Ingest Pipeline: Overview Generation

**New logic in:** `src/ingest/tags.ts` (or separate `overview.ts`)

Assembles `data/overview.json` at ingest time:
1. **System section**: pull content from design guide sections (Basics, Color two-layer system, Module, Typography). Truncate each to ~300 chars at sentence boundary.
2. **Library entries**: for each library page, extract extended description (~200 chars) and parse peer dependencies from Install chunk to build dependency graph.

---

## File Changes

### New files
| File | Purpose |
|---|---|
| `src/ingest/tags.ts` | Tag extraction + synonym map + overview assembly |
| `src/server/tools/suggest-component.ts` | `suggest_component` handler |
| `src/server/tools/get-component-reference.ts` | `get_component_reference` handler |
| `src/server/tools/get-quick-start.ts` | `get_quick_start` handler |
| `src/server/tools/get-design-system-overview.ts` | `get_design_system_overview` handler |

### Modified files
| File | Change |
|---|---|
| `src/types.ts` | Add `ComponentTags` (`Record<string, string[]>`) and `DesignSystemOverview` types |
| `src/ingest/run.ts` | Call tag generation + overview assembly after chunking, write `data/tags.json` and `data/overview.json` |
| `src/server/loader.ts` | Load `tags.json` and `overview.json`, add `tagsByPageId` and `overview` to `LoadedData` |
| `src/server/server.ts` | Import + register 4 new tools |

### New data files
| File | Purpose |
|---|---|
| `data/tags.json` | Pre-computed semantic tags per component |
| `data/overview.json` | Design system philosophy + per-library purpose/deps |

### Unchanged
- Existing 5 tools (untouched)
- `parse.ts`, `chunk.ts`, `index.ts` (no modifications)
- `discover.ts`, `fetch.ts` (no new data sources)

### Implementation notes

**`LoadedData` extensions:**
- `tagsByPageId: Map<string, string[]>` — loaded from `tags.json` Record and converted to Map for consistency with existing `pageById`/`chunkById` pattern
- `overview: DesignSystemOverview` — loaded from `overview.json`

**DATA_DIR resolution:** `run.ts` uses `process.cwd()` for DATA_DIR while `loader.ts` uses `__dirname`-relative paths. New data files (`tags.json`, `overview.json`) must be loaded in `loader.ts` using the existing `__dirname`-based DATA_DIR, same as `pages.json` and `chunks.json`. Writing in `run.ts` continues to use `process.cwd()` (existing pattern).

---

## Testing

New tool handlers should have unit tests in `tests/tools.test.ts` (extending existing test file), covering:

- **`suggest_component`**: matching known components by use case, empty results for nonsense input, library filter, score ordering
- **`get_component_reference`**: compact vs full response, missing component error, missing Properties/guide graceful fallback
- **`get_quick_start`**: library with full data (uikit), library with minimal data (missing Usage section), unknown library error
- **`get_design_system_overview`**: full response, library filter, unknown library error
- **Tag generation**: synonym expansion, keyword extraction from description, prop name inference

---

## Agent Workflow (Before vs After)

### Before: "Build a form with DatePicker, Select, and Button"
```
1. search_docs("DatePicker")           → snippet
2. get_section(...)                     → intro
3. get_page(...)                        → TOC
4. get_section("...properties")         → props
5. get_section("...usage")             → example
   ... repeat for Select, Button ...
≈ 15 tool calls
```

### After:
```
1. get_design_system_overview()                        → philosophy + library map
2. get_component_reference("DatePicker", "date-components")  → import + props + example
3. get_component_reference("Select", "uikit")                → import + props + example
4. get_component_reference("Button", "uikit")                → import + props + example
= 4 tool calls
```

### "I need something for date range selection but don't know the component":
```
1. suggest_component("date range selection")                          → RangeCalendar
2. get_component_reference("RangeCalendar", "date-components")        → everything needed
= 2 tool calls
```
