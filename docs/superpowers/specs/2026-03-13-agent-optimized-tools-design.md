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

**Implementation:**
1. Tokenize `use_case` into words, lowercase, remove stop words
2. For each component in `tagsByPageId`, score by counting tag matches (exact + fuzzy via Levenshtein)
3. Also run a MiniSearch query against the index filtered to component pages — merge scores
4. Rank by combined score, return top N

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

**Implementation:**
1. Look up page by constructing `component:${library}:${name}` page ID
2. Gather all chunks for that page via `chunksByPageId`
3. Build response based on `detail` level

**Compact response** (default):
- `import_statement`: `import {${title}} from '@gravity-ui/${library}';`
- `description`: full page description (not truncated)
- `props`: content from chunk with section_title "Properties"
- `example`: first non-empty code example from the intro chunk
- `design_guide_sections`: section_ids from matching guide page

**Full response** — compact plus:
- `all_sections`: `{ title, content, code_examples }[]` for every chunk
- `design_guide`: full content of all design guide sections
- `css_api`: content from "CSS API" chunk

**Import statement derivation:**
- Package: `@gravity-ui/${library}` (consistent across all libraries)
- Component: page title
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

---

## Tool 3: `get_quick_start`

**Purpose:** Agent has decided to use a library — give it install, setup, and component overview.

**Signature:**
```typescript
get_quick_start({
  library: string,       // e.g. "uikit", "navigation"
})
```

**Implementation:**
1. Look up library page via `library:${library}` page ID
2. Extract install/usage from library chunks
3. List components via page filtering

**Extraction logic:**
- `install`: chunk with section_title "Install" → first code block
- `peer_dependencies`: same chunk → second code block or peer dep text
- `setup_code`: chunk with section_title "Usage" → first code block
- `description`: page description or first chunk intro
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

**Implementation:**
1. System-level content is assembled at ingest time from design guide sections (Basics, Color, Module, Typography, CornerRadius, Branding) and stored as `data/overview.json`
2. Per-library entries include purpose (extracted from library page description, ~200 char limit), component count, and dependency relationships (parsed from Install chunk peer dep text)

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
      "depends_on": ["uikit"]
    }
  ]
}
```

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
