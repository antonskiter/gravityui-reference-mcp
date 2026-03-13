# Agent-Optimized Tools Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 agent-optimized MCP tools and a tag-generation ingest step to the Gravity UI reference server.

**Architecture:** New tools (`suggest_component`, `get_component_reference`, `get_quick_start`, `get_design_system_overview`) are added alongside existing 5 tools. A new ingest step generates `data/tags.json` and `data/overview.json` at build time. The server loads these at startup into `LoadedData`.

**Tech Stack:** TypeScript, MCP SDK, MiniSearch, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-03-13-agent-optimized-tools-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/ingest/tags.ts` | Synonym map, tag extraction from component pages, Levenshtein helper |
| `src/ingest/overview.ts` | Overview assembly: system philosophy from guides + per-library purpose/deps |
| `src/server/tools/suggest-component.ts` | `suggest_component` handler: tag matching + MiniSearch merge |
| `src/server/tools/get-component-reference.ts` | `get_component_reference` handler: compact/full component ref |
| `src/server/tools/get-quick-start.ts` | `get_quick_start` handler: library install + setup + components |
| `src/server/tools/get-design-system-overview.ts` | `get_design_system_overview` handler: serves pre-built overview |
| `tests/agent-tools.test.ts` | Tests for all 4 new tools |
| `tests/tags.test.ts` | Tests for tag generation and Levenshtein |

### Modified files
| File | Change |
|---|---|
| `src/types.ts` | Add `ComponentTags`, `DesignSystemOverview`, `LibraryOverviewEntry`, `SystemOverview` types |
| `src/ingest/run.ts` | Call `generateTags()` and `generateOverview()` after chunking, write 2 new JSON files |
| `src/server/loader.ts` | Load `tags.json` and `overview.json`, extend `LoadedData` with `tagsByPageId` and `overview` |
| `src/server/server.ts` | Import and register 4 new tools |

---

## Chunk 1: Types, Tag Generation, and Overview Ingest

### Task 1: Add new types to `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Write the type additions**

Add at the end of `src/types.ts`:

```typescript
export type ComponentTags = Record<string, string[]>;

export interface SystemOverview {
  description: string;
  theming: string;
  spacing: string;
  typography: string;
  corner_radius: string;
  branding: string;
}

export interface LibraryOverviewEntry {
  id: string;
  package: string;
  purpose: string;
  component_count: number;
  depends_on: string[];
  is_peer_dependency_of: string[];
}

export interface DesignSystemOverview {
  system: SystemOverview;
  libraries: LibraryOverviewEntry[];
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add types for component tags and design system overview"
```

---

### Task 2: Create tag generation (`src/ingest/tags.ts`)

**Files:**
- Create: `src/ingest/tags.ts`
- Test: `tests/tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tags.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { levenshtein, SYNONYM_MAP, generateTagsForComponent, tokenizeAndClean, expandCompoundTags } from "../src/ingest/tags.js";
import type { Page, Chunk } from "../src/types.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("button", "button")).toBe(0);
  });

  it("returns correct distance for similar strings", () => {
    expect(levenshtein("button", "buton")).toBe(1);
    expect(levenshtein("select", "selct")).toBe(1);
  });

  it("returns string length for empty comparison", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("tokenizeAndClean", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenizeAndClean("Date Range Selection")).toEqual(["date", "range", "selection"]);
  });

  it("removes stop words", () => {
    const result = tokenizeAndClean("a component for the table");
    expect(result).not.toContain("a");
    expect(result).not.toContain("for");
    expect(result).not.toContain("the");
    expect(result).toContain("component");
    expect(result).toContain("table");
  });

  it("removes single-character tokens", () => {
    expect(tokenizeAndClean("a b table")).toEqual(["table"]);
  });

  it("preserves hyphenated terms like date-picker", () => {
    const result = tokenizeAndClean("date-picker component");
    expect(result).toContain("date-picker");
  });
});

describe("expandCompoundTags", () => {
  it("splits compound tags into individual words", () => {
    const result = expandCompoundTags(["date-picker", "button"]);
    expect(result).toContain("date-picker");
    expect(result).toContain("date");
    expect(result).toContain("picker");
    expect(result).toContain("button");
  });

  it("deduplicates expanded tags", () => {
    const result = expandCompoundTags(["date-picker", "date"]);
    const counts = result.filter(t => t === "date").length;
    expect(counts).toBe(1);
  });
});

describe("SYNONYM_MAP", () => {
  it("has synonyms for common component types", () => {
    expect(SYNONYM_MAP["select"]).toContain("dropdown");
    expect(SYNONYM_MAP["button"]).toContain("action");
    expect(SYNONYM_MAP["dialog"]).toContain("modal");
    expect(SYNONYM_MAP["table"]).toContain("grid");
    expect(SYNONYM_MAP["date"]).toContain("calendar");
    expect(SYNONYM_MAP["checkbox"]).toContain("toggle");
  });
});

describe("generateTagsForComponent", () => {
  const page: Page = {
    id: "component:uikit:Select",
    title: "Select",
    page_type: "component",
    library: "uikit",
    url: "https://gravity-ui.com/components/uikit/select",
    breadcrumbs: ["Select"],
    description: "A dropdown select component.",
    section_ids: ["component:uikit:Select:select", "component:uikit:Select:properties", "component:uikit:Select:filtering-options"],
  };

  const introChunk: Chunk = {
    id: "component:uikit:Select:select",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Select",
    breadcrumbs: ["Select"],
    content: "Select is a control that provides a list of options that a user can select.",
    code_examples: [],
    keywords: ["select", "uikit"],
  };

  const propsChunk: Chunk = {
    id: "component:uikit:Select:properties",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Properties",
    breadcrumbs: ["Select", "Properties"],
    content: "| Name | Description |\n| multiple | Allow multiple selections |\n| disabled | Disable the select |\n| filterable | Enable filtering |",
    code_examples: [],
    keywords: ["select", "properties"],
  };

  const filterChunk: Chunk = {
    id: "component:uikit:Select:filtering-options",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Filtering options",
    breadcrumbs: ["Select", "Filtering options"],
    content: "You can filter options by typing in the select control.",
    code_examples: [],
    keywords: ["select", "filtering"],
  };

  const chunks = [introChunk, propsChunk, filterChunk];

  it("includes the component name lowercased as a tag", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("select");
  });

  it("includes synonyms for the component name", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("dropdown");
    expect(tags).toContain("picker");
    expect(tags).toContain("combobox");
  });

  it("extracts tags from section titles", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("filtering");
  });

  it("extracts tags from description", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("options");
  });

  it("extracts capability tags from prop names", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("multi-select");
  });

  it("deduplicates tags", () => {
    const tags = generateTagsForComponent(page, chunks);
    const uniqueTags = new Set(tags);
    expect(tags.length).toBe(uniqueTags.size);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/tags.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/ingest/tags.ts`**

```typescript
import type { Page, Chunk, ComponentTags } from "../types.js";

// ---------------------------------------------------------------------------
// Levenshtein distance (inline, no external dependency)
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// Stop words & tokenizer
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "of", "to", "for",
  "with", "on", "at", "by", "is", "it", "its", "be", "as",
  "are", "was", "were", "that", "this", "from", "up", "how",
  "can", "you", "use", "used", "using", "component", "components",
]);

export function tokenizeAndClean(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_/,.:;()]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/** Split compound tags like "date-picker" into individual words too. */
export function expandCompoundTags(tags: string[]): string[] {
  const expanded = new Set(tags);
  for (const tag of tags) {
    if (tag.includes("-")) {
      for (const part of tag.split("-")) {
        if (part.length > 1) expanded.add(part);
      }
    }
  }
  return [...expanded];
}

// ---------------------------------------------------------------------------
// Synonym map
// ---------------------------------------------------------------------------

export const SYNONYM_MAP: Record<string, string[]> = {
  select: ["dropdown", "picker", "combobox", "chooser"],
  checkbox: ["toggle", "check", "tick", "checkmark"],
  date: ["calendar", "datetime", "date-picker", "datepicker"],
  button: ["action", "submit", "trigger", "cta", "click"],
  dialog: ["modal", "popup", "overlay", "window", "lightbox"],
  table: ["grid", "data-table", "spreadsheet", "rows", "columns", "datagrid"],
  tabs: ["tab-bar", "tab-panel", "tabbed"],
  menu: ["context-menu", "dropdown-menu", "navigation-menu"],
  tooltip: ["hint", "tip", "popover-hint"],
  popover: ["popup", "floating", "bubble"],
  drawer: ["sidebar", "side-panel", "slide-out"],
  breadcrumbs: ["breadcrumb", "navigation-path", "trail"],
  pagination: ["paging", "page-navigation", "paginator"],
  slider: ["range", "range-slider", "track"],
  switch: ["toggle", "toggle-switch", "on-off"],
  radio: ["radio-button", "option", "radio-group"],
  label: ["tag", "badge", "chip"],
  avatar: ["profile-image", "user-icon", "user-photo"],
  loader: ["spinner", "loading", "progress-indicator"],
  skeleton: ["placeholder", "shimmer", "loading-skeleton"],
  input: ["text-field", "text-input", "form-field"],
  link: ["anchor", "hyperlink", "url"],
  card: ["tile", "panel", "container"],
  alert: ["notification", "banner", "message"],
  progress: ["progress-bar", "loading-bar"],
  icon: ["svg", "glyph", "symbol"],
  list: ["item-list", "listbox"],
  spin: ["spinner", "loading-spinner"],
  divider: ["separator", "hr", "line"],
  overlay: ["backdrop", "mask", "curtain"],
  accordion: ["collapsible", "expandable", "disclosure"],
  stepper: ["wizard", "step-indicator", "multi-step"],
  navigation: ["nav", "sidebar", "aside"],
  header: ["app-bar", "top-bar", "navbar"],
  footer: ["bottom-bar"],
  sheet: ["bottom-sheet", "action-sheet"],
  pin: ["otp", "verification-code"],
  number: ["numeric", "counter", "increment"],
  clipboard: ["copy", "copy-to-clipboard"],
  user: ["profile", "identity", "account"],
};

// ---------------------------------------------------------------------------
// Prop name → capability tag mapping
// ---------------------------------------------------------------------------

const PROP_CAPABILITY_MAP: Record<string, string> = {
  multiple: "multi-select",
  filterable: "filtering",
  disabled: "disableable",
  loading: "loading-state",
  sortable: "sorting",
  selectable: "selectable",
  draggable: "drag-and-drop",
  resizable: "resizable",
  editable: "editable",
  searchable: "searchable",
  clearable: "clearable",
  closable: "closable",
  collapsible: "collapsible",
  expandable: "expandable",
  virtualized: "virtualized",
};

// ---------------------------------------------------------------------------
// Tag generation
// ---------------------------------------------------------------------------

function extractPropNames(content: string): string[] {
  // Match prop names from markdown tables: | propName | ...
  const propNames: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^\|\s*(\w+)\s*\|/);
    if (match && match[1] !== "Name" && match[1] !== "---") {
      propNames.push(match[1]);
    }
  }
  return propNames;
}

export function generateTagsForComponent(page: Page, chunks: Chunk[]): string[] {
  const tags = new Set<string>();

  // 1. Component name lowercased
  const nameLower = page.title.toLowerCase();
  tags.add(nameLower);

  // 2. Library name
  if (page.library) {
    tags.add(page.library);
  }

  // 3. Synonym expansion for name words
  const nameWords = tokenizeAndClean(page.title);
  for (const word of nameWords) {
    if (SYNONYM_MAP[word]) {
      for (const syn of SYNONYM_MAP[word]) {
        tags.add(syn);
      }
    }
  }

  // 4. Description tokens
  if (page.description) {
    const descTokens = tokenizeAndClean(page.description);
    for (const token of descTokens) {
      tags.add(token);
      if (SYNONYM_MAP[token]) {
        for (const syn of SYNONYM_MAP[token]) {
          tags.add(syn);
        }
      }
    }
  }

  // 5. Section titles
  for (const chunk of chunks) {
    if (chunk.section_title !== page.title) {
      const titleTokens = tokenizeAndClean(chunk.section_title);
      for (const token of titleTokens) {
        tags.add(token);
      }
    }
  }

  // 6. Prop names → capability tags
  const propsChunk = chunks.find(c =>
    ["properties", "props", "api"].includes(c.section_title.toLowerCase())
  );
  if (propsChunk) {
    const propNames = extractPropNames(propsChunk.content);
    for (const prop of propNames) {
      const capability = PROP_CAPABILITY_MAP[prop.toLowerCase()];
      if (capability) {
        tags.add(capability);
      }
    }
  }

  // Expand compound tags so "date-picker" also produces "date" and "picker"
  return expandCompoundTags([...tags]);
}

export function generateAllTags(pages: Page[], chunks: Chunk[]): ComponentTags {
  const tags: ComponentTags = {};
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  for (const page of pages) {
    if (page.page_type !== "component") continue;
    const pageChunks = chunksByPageId.get(page.id) ?? [];
    tags[page.id] = generateTagsForComponent(page, pageChunks);
  }

  return tags;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/tags.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/tags.ts tests/tags.test.ts
git commit -m "feat: add tag generation for component semantic search"
```

---

### Task 3: Create overview generation (`src/ingest/overview.ts`)

**Files:**
- Create: `src/ingest/overview.ts`

- [ ] **Step 1: Write the overview generator**

```typescript
import type { Page, Chunk, DesignSystemOverview, LibraryOverviewEntry, SystemOverview } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  // Find last sentence boundary
  const lastPeriod = truncated.lastIndexOf(". ");
  const lastExcl = truncated.lastIndexOf("! ");
  const boundary = Math.max(lastPeriod, lastExcl);
  if (boundary > maxLen * 0.5) {
    return truncated.slice(0, boundary + 1);
  }
  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

// ---------------------------------------------------------------------------
// System overview from design guides
// ---------------------------------------------------------------------------

const GUIDE_MAPPING: { pageId: string; field: keyof SystemOverview }[] = [
  { pageId: "guide:Basics", field: "description" },
  { pageId: "guide:Color", field: "theming" },
  { pageId: "guide:Module", field: "spacing" },
  { pageId: "guide:Typography", field: "typography" },
  { pageId: "guide:CornerRadius", field: "corner_radius" },
  { pageId: "guide:Branding", field: "branding" },
];

function buildSystemOverview(
  pages: Page[],
  chunks: Chunk[],
): SystemOverview {
  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const system: SystemOverview = {
    description: "",
    theming: "",
    spacing: "",
    typography: "",
    corner_radius: "",
    branding: "",
  };

  for (const { pageId, field } of GUIDE_MAPPING) {
    const page = pageById.get(pageId);
    if (!page) {
      console.warn(`Overview: guide page not found: ${pageId} — skipping`);
      continue;
    }
    const pageChunks = chunksByPageId.get(pageId) ?? [];
    if (pageChunks.length === 0) {
      console.warn(`Overview: no chunks for guide page: ${pageId} — skipping`);
      continue;
    }
    // Use first chunk content
    system[field] = truncateAtSentence(pageChunks[0].content, 300);
  }

  return system;
}

// ---------------------------------------------------------------------------
// Per-library entries with dependency graph
// ---------------------------------------------------------------------------

function parsePeerDeps(chunks: Chunk[]): string[] {
  const installChunk = chunks.find(c =>
    c.section_title.toLowerCase() === "install"
  );
  if (!installChunk) return [];

  // Match @gravity-ui/package-name references in content + code examples
  const allText = installChunk.content + " " + installChunk.code_examples.join(" ");
  const matches = allText.match(/@gravity-ui\/[\w-]+/g) ?? [];
  // Extract library names, deduplicate
  const deps = new Set<string>();
  for (const match of matches) {
    const libName = match.replace("@gravity-ui/", "");
    deps.add(libName);
  }
  return [...deps];
}

function buildLibraryEntries(
  pages: Page[],
  chunks: Chunk[],
): LibraryOverviewEntry[] {
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  // Count components per library
  const componentCounts = new Map<string, number>();
  for (const page of pages) {
    if (page.page_type === "component" && page.library) {
      componentCounts.set(page.library, (componentCounts.get(page.library) ?? 0) + 1);
    }
  }

  // Build forward dependency map
  const forwardDeps = new Map<string, string[]>();
  const libraryPages = pages.filter(p => p.page_type === "library");

  for (const page of libraryPages) {
    const lib = page.library ?? page.id.replace("library:", "");
    const pageChunks = chunksByPageId.get(page.id) ?? [];
    const deps = parsePeerDeps(pageChunks).filter(d => d !== lib); // exclude self
    forwardDeps.set(lib, deps);
  }

  // Invert to get reverse deps
  const reverseDeps = new Map<string, string[]>();
  for (const [lib, deps] of forwardDeps) {
    for (const dep of deps) {
      const list = reverseDeps.get(dep) ?? [];
      list.push(lib);
      reverseDeps.set(dep, list);
    }
  }

  // Build entries for all known libraries (from library pages + component pages)
  const allLibIds = new Set<string>();
  for (const page of pages) {
    if (page.library) allLibIds.add(page.library);
  }

  const entries: LibraryOverviewEntry[] = [];
  for (const lib of [...allLibIds].sort()) {
    const libPage = pages.find(p => p.page_type === "library" && p.library === lib);
    const purpose = libPage
      ? truncateAtSentence(libPage.description || libPage.title, 200)
      : "";

    entries.push({
      id: lib,
      package: `@gravity-ui/${lib}`,
      purpose,
      component_count: componentCounts.get(lib) ?? 0,
      depends_on: forwardDeps.get(lib) ?? [],
      is_peer_dependency_of: reverseDeps.get(lib) ?? [],
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateOverview(pages: Page[], chunks: Chunk[]): DesignSystemOverview {
  return {
    system: buildSystemOverview(pages, chunks),
    libraries: buildLibraryEntries(pages, chunks),
  };
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ingest/overview.ts
git commit -m "feat: add overview generation for design system philosophy and library deps"
```

---

### Task 4: Integrate into ingest pipeline (`src/ingest/run.ts`)

**Files:**
- Modify: `src/ingest/run.ts`

- [ ] **Step 1: Add tag and overview generation to the pipeline**

After the existing Stage 2 (Parse → Chunk) block and before Stage 3 (Index), add:

```typescript
// After the import block at the top, add:
import { generateAllTags } from "./tags.js";
import { generateOverview } from "./overview.js";
```

Then after `console.log(\`  Parsed ${pages.length} pages into ${allChunks.length} chunks\`);` and before `// Stage 3: Index`, add:

```typescript
  // Stage 2b: Generate tags and overview
  console.log("Stage 2b: Generating tags and overview...");
  const tags = generateAllTags(pages, allChunks);
  writeFileSync(join(DATA_DIR, "tags.json"), JSON.stringify(tags, null, 2));
  console.log(`  Generated tags for ${Object.keys(tags).length} components`);

  const overview = generateOverview(pages, allChunks);
  writeFileSync(join(DATA_DIR, "overview.json"), JSON.stringify(overview, null, 2));
  console.log(`  Generated overview with ${overview.libraries.length} libraries`);
```

- [ ] **Step 2: Run the ingest pipeline to generate data files**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npm run ingest`
Expected: prints "Stage 2b: Generating tags and overview..." with counts, exits successfully. Files `data/tags.json` and `data/overview.json` should exist.

- [ ] **Step 3: Verify the generated data looks correct**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && node -e "const t=JSON.parse(require('fs').readFileSync('data/tags.json','utf8')); console.log('Tag entries:', Object.keys(t).length); console.log('Sample (Button):', t['component:uikit:Button']?.slice(0,8))"`
Expected: Tag entries count > 90, sample shows tags like `["button", "uikit", "action", ...]`

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && node -e "const o=JSON.parse(require('fs').readFileSync('data/overview.json','utf8')); console.log('System keys:', Object.keys(o.system)); console.log('Libraries:', o.libraries.length); console.log('uikit deps_of:', o.libraries.find(l=>l.id==='uikit')?.is_peer_dependency_of?.slice(0,5))"`
Expected: System keys include description/theming/spacing/typography/corner_radius/branding; libraries count ~34; uikit has dependents

- [ ] **Step 4: Commit**

```bash
git add src/ingest/run.ts data/tags.json data/overview.json
git commit -m "feat: integrate tag and overview generation into ingest pipeline"
```

---

### Task 5: Extend `LoadedData` in `src/server/loader.ts`

**Files:**
- Modify: `src/server/loader.ts`

- [ ] **Step 1: Add tags and overview to LoadedData and loadData()**

Add import for new types and re-export `DesignSystemOverview` (so tool handlers can import it from `loader.js` like they do with `LoadedData`):

```typescript
import type { Page, Chunk, IngestMetadata, ComponentTags, DesignSystemOverview } from "../types.js";
export type { DesignSystemOverview };
```

Extend `LoadedData` interface with:

```typescript
  tagsByPageId: Map<string, string[]>;
  overview: DesignSystemOverview;
```

In `loadData()` function, after existing file loading, add:

```typescript
  const tagsRecord: ComponentTags = JSON.parse(readFileSync(join(DATA_DIR, "tags.json"), "utf-8"));
  const tagsByPageId = new Map(Object.entries(tagsRecord));
  const overview: DesignSystemOverview = JSON.parse(readFileSync(join(DATA_DIR, "overview.json"), "utf-8"));
```

Update the return statement to include `tagsByPageId, overview`.

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/server/loader.ts
git commit -m "feat: load tags and overview data into LoadedData"
```

---

## Chunk 2: Tool Handlers

### Task 6: Create `get_component_reference` handler

**Files:**
- Create: `src/server/tools/get-component-reference.ts`
- Test: `tests/agent-tools.test.ts` (start the file)

- [ ] **Step 1: Write failing tests for get_component_reference**

Create `tests/agent-tools.test.ts` with mock data and tests:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { buildIndex } from "../src/ingest/index.js";
import type { LoadedData } from "../src/server/loader.js";
import type { Page, Chunk, IngestMetadata, DesignSystemOverview } from "../src/types.js";
import { handleGetComponentReference } from "../src/server/tools/get-component-reference.js";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const buttonPage: Page = {
  id: "component:uikit:Button",
  title: "Button",
  page_type: "component",
  library: "uikit",
  url: "https://gravity-ui.com/components/uikit/button",
  github_url: "https://github.com/gravity-ui/uikit/tree/main/src/components/Button",
  breadcrumbs: ["Button"],
  description: "Buttons act as a trigger for certain actions.",
  section_ids: [
    "component:uikit:Button:button",
    "component:uikit:Button:appearance",
    "component:uikit:Button:properties",
    "component:uikit:Button:css-api",
  ],
};

const buttonGuide: Page = {
  id: "guide:Button",
  title: "Button",
  page_type: "guide",
  url: "https://gravity-ui.com/design/guides?articleId=button",
  breadcrumbs: ["Button"],
  description: "Design guide for Button.",
  section_ids: ["guide:Button:appearance", "guide:Button:sizes"],
};

const selectPage: Page = {
  id: "component:uikit:Select",
  title: "Select",
  page_type: "component",
  library: "uikit",
  url: "https://gravity-ui.com/components/uikit/select",
  breadcrumbs: ["Select"],
  description: "A dropdown select component.",
  section_ids: ["component:uikit:Select:select"],
};

const buttonIntroChunk: Chunk = {
  id: "component:uikit:Button:button",
  page_id: "component:uikit:Button",
  url: "https://gravity-ui.com/components/uikit/button",
  page_title: "Button",
  page_type: "component",
  library: "uikit",
  section_title: "Button",
  breadcrumbs: ["Button"],
  content: "Buttons act as a trigger for certain actions.",
  code_examples: ["<Button view=\"action\" size=\"l\">Action</Button>"],
  keywords: ["button", "uikit"],
};

const buttonAppearanceChunk: Chunk = {
  id: "component:uikit:Button:appearance",
  page_id: "component:uikit:Button",
  url: "https://gravity-ui.com/components/uikit/button",
  page_title: "Button",
  page_type: "component",
  library: "uikit",
  section_title: "Appearance",
  breadcrumbs: ["Button", "Appearance"],
  content: "There are four Button types: basic, outlined, flat, and contrast.",
  code_examples: ["<Button view=\"outlined\">Outlined</Button>"],
  keywords: ["button", "appearance"],
};

const buttonPropsChunk: Chunk = {
  id: "component:uikit:Button:properties",
  page_id: "component:uikit:Button",
  url: "https://gravity-ui.com/components/uikit/button",
  page_title: "Button",
  page_type: "component",
  library: "uikit",
  section_title: "Properties",
  breadcrumbs: ["Button", "Properties"],
  content: "| Name | Description | Type | Default |\n| size | Button size | string | m |",
  code_examples: [],
  keywords: ["button", "properties"],
};

const buttonCssChunk: Chunk = {
  id: "component:uikit:Button:css-api",
  page_id: "component:uikit:Button",
  url: "https://gravity-ui.com/components/uikit/button",
  page_title: "Button",
  page_type: "component",
  library: "uikit",
  section_title: "CSS API",
  breadcrumbs: ["Button", "CSS API"],
  content: "| Name | Description |\n| --button-height | Button height |",
  code_examples: [],
  keywords: ["button", "css"],
};

const guideAppearanceChunk: Chunk = {
  id: "guide:Button:appearance",
  page_id: "guide:Button",
  url: "https://gravity-ui.com/design/guides?articleId=button",
  page_title: "Button",
  page_type: "guide",
  section_title: "Appearance",
  breadcrumbs: ["Button", "Appearance"],
  content: "The button supports accent, primary, and semantic styles.",
  code_examples: [],
  keywords: ["button", "appearance"],
};

const guideSizesChunk: Chunk = {
  id: "guide:Button:sizes",
  page_id: "guide:Button",
  url: "https://gravity-ui.com/design/guides?articleId=button",
  page_title: "Button",
  page_type: "guide",
  section_title: "Sizes",
  breadcrumbs: ["Button", "Sizes"],
  content: "Each button can have four sizes: XS, S, M, L.",
  code_examples: [],
  keywords: ["button", "sizes"],
};

const selectIntroChunk: Chunk = {
  id: "component:uikit:Select:select",
  page_id: "component:uikit:Select",
  url: "https://gravity-ui.com/components/uikit/select",
  page_title: "Select",
  page_type: "component",
  library: "uikit",
  section_title: "Select",
  breadcrumbs: ["Select"],
  content: "Select is a control that provides a list of options.",
  code_examples: [],
  keywords: ["select", "uikit"],
};

const mockOverview: DesignSystemOverview = {
  system: {
    description: "test",
    theming: "test",
    spacing: "test",
    typography: "test",
    corner_radius: "test",
    branding: "test",
  },
  libraries: [
    {
      id: "uikit",
      package: "@gravity-ui/uikit",
      purpose: "Core component library.",
      component_count: 2,
      depends_on: [],
      is_peer_dependency_of: [],
    },
  ],
};

let mockData: LoadedData;

beforeAll(() => {
  const pages = [buttonPage, buttonGuide, selectPage];
  const chunks = [
    buttonIntroChunk, buttonAppearanceChunk, buttonPropsChunk, buttonCssChunk,
    guideAppearanceChunk, guideSizesChunk, selectIntroChunk,
  ];
  const index = buildIndex(chunks);

  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunkById = new Map(chunks.map(c => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const tagsByPageId = new Map<string, string[]>([
    ["component:uikit:Button", ["button", "action", "submit", "trigger"]],
    ["component:uikit:Select", ["select", "dropdown", "picker"]],
  ]);

  mockData = {
    pages, chunks, metadata: { indexed_at: "2026-03-13T00:00:00Z", source_commits: {} },
    index, pageById, chunkById, chunksByPageId,
    tagsByPageId,
    overview: mockOverview,
  };
});

// ---------------------------------------------------------------------------
// get_component_reference tests
// ---------------------------------------------------------------------------

describe("handleGetComponentReference", () => {
  it("returns compact reference for known component", () => {
    const output = handleGetComponentReference(mockData, { name: "Button", library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.component).toBe("Button");
    expect(output.library).toBe("uikit");
    expect(output.import_statement).toBe("import {Button} from '@gravity-ui/uikit';");
    expect(output.description).toBe("Buttons act as a trigger for certain actions.");
    expect(output.props).toContain("| Name |");
    expect(output.example).toBe("<Button view=\"action\" size=\"l\">Action</Button>");
    expect(output.url).toBe("https://gravity-ui.com/components/uikit/button");
    expect(output.github_url).toBe("https://github.com/gravity-ui/uikit/tree/main/src/components/Button");
  });

  it("includes design_guide_sections when guide exists", () => {
    const output = handleGetComponentReference(mockData, { name: "Button", library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.design_guide_sections).toContain("guide:Button:appearance");
    expect(output.design_guide_sections).toContain("guide:Button:sizes");
  });

  it("returns empty design_guide_sections when no guide exists", () => {
    const output = handleGetComponentReference(mockData, { name: "Select", library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.design_guide_sections).toEqual([]);
  });

  it("returns full response with all_sections and design_guide", () => {
    const output = handleGetComponentReference(mockData, { name: "Button", library: "uikit", detail: "full" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.all_sections).toBeDefined();
    expect(output.all_sections!.length).toBe(4);
    expect(output.design_guide).toBeDefined();
    expect(output.design_guide!.length).toBe(2);
    expect(output.css_api).toContain("--button-height");
  });

  it("returns error for unknown component", () => {
    const output = handleGetComponentReference(mockData, { name: "Foo", library: "uikit" });
    expect("error" in output).toBe(true);
    if ("error" in output) {
      expect(output.error).toContain("Foo");
      expect(output.error).toContain("uikit");
    }
  });

  it("omits props when no Properties chunk exists", () => {
    const output = handleGetComponentReference(mockData, { name: "Select", library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.props).toBeUndefined();
  });

  it("omits example when intro chunk has no code examples", () => {
    const output = handleGetComponentReference(mockData, { name: "Select", library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.example).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server/tools/get-component-reference.ts`**

```typescript
import type { LoadedData } from "../loader.js";

export interface GetComponentReferenceInput {
  name: string;
  library: string;
  detail?: "compact" | "full";
}

interface SectionEntry {
  title: string;
  content: string;
  code_examples: string[];
}

interface GuideEntry {
  title: string;
  content: string;
}

export interface GetComponentReferenceOutput {
  component: string;
  library: string;
  import_statement: string;
  description: string;
  props?: string;
  example?: string;
  design_guide_sections: string[];
  url: string;
  github_url?: string;
  // Full mode only
  all_sections?: SectionEntry[];
  design_guide?: GuideEntry[];
  css_api?: string;
}

export interface GetComponentReferenceError {
  error: string;
}

const PROPS_TITLES = ["properties", "props", "api"];
const CSS_API_TITLE = "css api";

export function handleGetComponentReference(
  data: LoadedData,
  input: GetComponentReferenceInput,
): GetComponentReferenceOutput | GetComponentReferenceError {
  const { name, library, detail = "compact" } = input;
  const pageId = `component:${library}:${name}`;
  const page = data.pageById.get(pageId);

  if (!page) {
    return { error: `Component not found: ${name} in ${library}` };
  }

  const chunks = data.chunksByPageId.get(page.id) ?? [];

  // Import statement
  const import_statement = `import {${page.title}} from '@gravity-ui/${library}';`;

  // Props: find chunk with matching section title
  const propsChunk = chunks.find(c =>
    PROPS_TITLES.includes(c.section_title.toLowerCase())
  );

  // Example: first non-empty code example from intro chunk
  const introChunk = chunks[0];
  const firstExample = introChunk?.code_examples?.find(e => e.length > 0);

  // Design guide sections
  const guidePageId = `guide:${page.title}`;
  const guidePage = data.pageById.get(guidePageId);
  const design_guide_sections = guidePage?.section_ids ?? [];

  const result: GetComponentReferenceOutput = {
    component: page.title,
    library: library,
    import_statement,
    description: page.description,
    design_guide_sections,
    url: page.url,
    github_url: page.github_url,
  };

  if (propsChunk) {
    result.props = propsChunk.content;
  }

  if (firstExample) {
    result.example = firstExample;
  }

  // Full mode
  if (detail === "full") {
    result.all_sections = chunks.map(c => ({
      title: c.section_title,
      content: c.content,
      code_examples: c.code_examples,
    }));

    // Design guide content
    if (guidePage) {
      const guideChunks = data.chunksByPageId.get(guidePage.id) ?? [];
      result.design_guide = guideChunks.map(c => ({
        title: c.section_title,
        content: c.content,
      }));
    } else {
      result.design_guide = [];
    }

    // CSS API
    const cssChunk = chunks.find(c =>
      c.section_title.toLowerCase() === CSS_API_TITLE
    );
    if (cssChunk) {
      result.css_api = cssChunk.content;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/get-component-reference.ts tests/agent-tools.test.ts
git commit -m "feat: add get_component_reference tool handler with tests"
```

---

### Task 7: Create `get_quick_start` handler

**Files:**
- Create: `src/server/tools/get-quick-start.ts`
- Modify: `tests/agent-tools.test.ts`

- [ ] **Step 1: Add failing tests to `tests/agent-tools.test.ts`**

Add to the existing test file. First, add the following pages/chunks to the mock data constants section (before `beforeAll`), then add them to the `pages` and `chunks` arrays inside `beforeAll`, and rebuild all maps. Finally add the test describe block after the `get_component_reference` tests:

```typescript
import { handleGetQuickStart } from "../src/server/tools/get-quick-start.js";

// Add to mock data setup:
const uikitLibPage: Page = {
  id: "library:uikit",
  title: "UIKit",
  page_type: "library",
  library: "uikit",
  url: "https://gravity-ui.com/libraries/uikit",
  github_url: "https://github.com/gravity-ui/uikit",
  breadcrumbs: ["UIKit"],
  description: "A set of flexible React components for creating rich web applications.",
  section_ids: ["library:uikit:uikit", "library:uikit:install", "library:uikit:usage"],
};

const uikitInstallChunk: Chunk = {
  id: "library:uikit:install",
  page_id: "library:uikit",
  url: "https://gravity-ui.com/libraries/uikit",
  page_title: "UIKit",
  page_type: "library",
  library: "uikit",
  section_title: "Install",
  breadcrumbs: ["UIKit", "Install"],
  content: "Install the package:",
  code_examples: ["npm install --save-dev @gravity-ui/uikit"],
  keywords: ["uikit", "install"],
};

const uikitUsageChunk: Chunk = {
  id: "library:uikit:usage",
  page_id: "library:uikit",
  url: "https://gravity-ui.com/libraries/uikit",
  page_title: "UIKit",
  page_type: "library",
  library: "uikit",
  section_title: "Usage",
  breadcrumbs: ["UIKit", "Usage"],
  content: "Import and use components:",
  code_examples: ["import {Button} from '@gravity-ui/uikit';"],
  keywords: ["uikit", "usage"],
};

const uikitIntroChunk: Chunk = {
  id: "library:uikit:uikit",
  page_id: "library:uikit",
  url: "https://gravity-ui.com/libraries/uikit",
  page_title: "UIKit",
  page_type: "library",
  library: "uikit",
  section_title: "UIKit",
  breadcrumbs: ["UIKit"],
  content: "A set of flexible React components.",
  code_examples: [],
  keywords: ["uikit"],
};
```

Add these pages/chunks to the `beforeAll` setup and add tests:

```typescript
describe("handleGetQuickStart", () => {
  it("returns library info with install, setup, and components", () => {
    const output = handleGetQuickStart(mockData, { library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.library).toBe("uikit");
    expect(output.package).toBe("@gravity-ui/uikit");
    expect(output.install).toContain("npm install");
    expect(output.setup_code).toContain("import");
    expect(output.components.length).toBeGreaterThan(0);
    expect(output.url).toBe("https://gravity-ui.com/libraries/uikit");
  });

  it("returns error for unknown library", () => {
    const output = handleGetQuickStart(mockData, { library: "nonexistent" });
    expect("error" in output).toBe(true);
  });

  it("omits setup_code when no Usage chunk exists", () => {
    // Create a minimal library with no Usage chunk
    const minimalLibPage: Page = {
      id: "library:icons",
      title: "Icons",
      page_type: "library",
      library: "icons",
      url: "https://gravity-ui.com/libraries/icons",
      breadcrumbs: ["Icons"],
      description: "Icon library.",
      section_ids: ["library:icons:icons"],
    };
    const minimalChunk: Chunk = {
      id: "library:icons:icons",
      page_id: "library:icons",
      url: "https://gravity-ui.com/libraries/icons",
      page_title: "Icons",
      page_type: "library",
      library: "icons",
      section_title: "Icons",
      breadcrumbs: ["Icons"],
      content: "Icon library for Gravity UI.",
      code_examples: [],
      keywords: ["icons"],
    };

    const pages = [...mockData.pages, minimalLibPage];
    const chunks = [...mockData.chunks, minimalChunk];
    const testData: LoadedData = {
      ...mockData,
      pages,
      chunks,
      pageById: new Map(pages.map(p => [p.id, p])),
      chunkById: new Map(chunks.map(c => [c.id, c])),
      chunksByPageId: new Map<string, Chunk[]>(),
      index: buildIndex(chunks),
    };
    for (const chunk of chunks) {
      const list = testData.chunksByPageId.get(chunk.page_id) ?? [];
      list.push(chunk);
      testData.chunksByPageId.set(chunk.page_id, list);
    }

    const output = handleGetQuickStart(testData, { library: "icons" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.setup_code).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: FAIL — module not found for get-quick-start

- [ ] **Step 3: Implement `src/server/tools/get-quick-start.ts`**

```typescript
import type { LoadedData } from "../loader.js";

export interface GetQuickStartInput {
  library: string;
}

interface QuickStartComponent {
  name: string;
  description: string;
  page_id: string;
}

export interface GetQuickStartOutput {
  library: string;
  package: string;
  install?: string;
  peer_dependencies?: string;
  setup_code?: string;
  description: string;
  components: QuickStartComponent[];
  url: string;
  github_url?: string;
}

export interface GetQuickStartError {
  error: string;
}

const USAGE_TITLES = ["usage", "getting started", "get started"];

export function handleGetQuickStart(
  data: LoadedData,
  input: GetQuickStartInput,
): GetQuickStartOutput | GetQuickStartError {
  const { library } = input;
  const pageId = `library:${library}`;
  const page = data.pageById.get(pageId);

  if (!page) {
    return { error: `Library not found: ${library}` };
  }

  const chunks = data.chunksByPageId.get(page.id) ?? [];

  // Install chunk
  const installChunk = chunks.find(c =>
    c.section_title.toLowerCase() === "install"
  );

  // Usage chunk
  const usageChunk = chunks.find(c =>
    USAGE_TITLES.includes(c.section_title.toLowerCase())
  );

  // Components for this library
  const components: QuickStartComponent[] = data.pages
    .filter(p => p.page_type === "component" && p.library === library)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(p => ({
      name: p.title,
      description: p.description,
      page_id: p.id,
    }));

  const result: GetQuickStartOutput = {
    library,
    package: `@gravity-ui/${library}`,
    description: page.description || page.title,
    components,
    url: page.url,
    github_url: page.github_url,
  };

  if (installChunk) {
    const firstCode = installChunk.code_examples[0];
    if (firstCode) result.install = firstCode;

    const secondCode = installChunk.code_examples[1];
    if (secondCode) result.peer_dependencies = secondCode;
  }

  if (usageChunk) {
    const firstCode = usageChunk.code_examples[0];
    if (firstCode) result.setup_code = firstCode;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/get-quick-start.ts tests/agent-tools.test.ts
git commit -m "feat: add get_quick_start tool handler with tests"
```

---

### Task 8: Create `get_design_system_overview` handler

**Files:**
- Create: `src/server/tools/get-design-system-overview.ts`
- Modify: `tests/agent-tools.test.ts`

- [ ] **Step 1: Add failing tests to `tests/agent-tools.test.ts`**

```typescript
import { handleGetDesignSystemOverview } from "../src/server/tools/get-design-system-overview.js";

describe("handleGetDesignSystemOverview", () => {
  it("returns full overview with system and libraries", () => {
    const output = handleGetDesignSystemOverview(mockData, {});
    if ("error" in output) throw new Error("Expected success");
    expect(output.system).toBeDefined();
    expect(output.system.description).toBe("test");
    expect(output.libraries).toBeDefined();
  });

  it("filters libraries when library param provided", () => {
    const output = handleGetDesignSystemOverview(mockData, { library: "uikit" });
    if ("error" in output) throw new Error("Expected success");
    expect(output.system).toBeDefined(); // system always present
    expect(output.libraries.every(l => l.id === "uikit")).toBe(true);
  });

  it("returns error when filtered library not found", () => {
    const output = handleGetDesignSystemOverview(mockData, { library: "nonexistent" });
    expect("error" in output).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server/tools/get-design-system-overview.ts`**

```typescript
import type { LoadedData, DesignSystemOverview } from "../loader.js";

export interface GetDesignSystemOverviewInput {
  library?: string;
}

export interface GetDesignSystemOverviewError {
  error: string;
}

export function handleGetDesignSystemOverview(
  data: LoadedData,
  input: GetDesignSystemOverviewInput,
): DesignSystemOverview | GetDesignSystemOverviewError {
  const { library } = input;

  if (library) {
    const libEntry = data.overview.libraries.find(l => l.id === library);
    if (!libEntry) {
      return { error: `Library not found: ${library}` };
    }
    return {
      system: data.overview.system,
      libraries: [libEntry],
    };
  }

  return data.overview;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/get-design-system-overview.ts tests/agent-tools.test.ts
git commit -m "feat: add get_design_system_overview tool handler with tests"
```

---

### Task 9: Create `suggest_component` handler

**Files:**
- Create: `src/server/tools/suggest-component.ts`
- Modify: `tests/agent-tools.test.ts`

- [ ] **Step 1: Add failing tests to `tests/agent-tools.test.ts`**

```typescript
import { handleSuggestComponent } from "../src/server/tools/suggest-component.js";

describe("handleSuggestComponent", () => {
  it("suggests components matching use case by tags", () => {
    const output = handleSuggestComponent(mockData, { use_case: "dropdown selection" });
    expect(output.suggestions.length).toBeGreaterThan(0);
    const names = output.suggestions.map(s => s.component);
    expect(names).toContain("Select");
  });

  it("returns matching_tags in suggestions", () => {
    const output = handleSuggestComponent(mockData, { use_case: "action trigger" });
    expect(output.suggestions.length).toBeGreaterThan(0);
    const buttonSuggestion = output.suggestions.find(s => s.component === "Button");
    expect(buttonSuggestion).toBeDefined();
    expect(buttonSuggestion!.matching_tags.length).toBeGreaterThan(0);
  });

  it("respects limit parameter", () => {
    const output = handleSuggestComponent(mockData, { use_case: "button", limit: 1 });
    expect(output.suggestions.length).toBeLessThanOrEqual(1);
  });

  it("filters by library", () => {
    const output = handleSuggestComponent(mockData, { use_case: "button", library: "uikit" });
    for (const suggestion of output.suggestions) {
      expect(suggestion.library).toBe("uikit");
    }
  });

  it("returns empty suggestions for nonsense input", () => {
    const output = handleSuggestComponent(mockData, { use_case: "zzzyyyxxx" });
    expect(output.suggestions).toHaveLength(0);
  });

  it("suggestions are ranked by score descending", () => {
    const output = handleSuggestComponent(mockData, { use_case: "button action" });
    for (let i = 1; i < output.suggestions.length; i++) {
      expect(output.suggestions[i].score).toBeLessThanOrEqual(output.suggestions[i - 1].score);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server/tools/suggest-component.ts`**

```typescript
import { searchIndex } from "../../ingest/index.js";
import { levenshtein, tokenizeAndClean } from "../../ingest/tags.js";
import type { LoadedData } from "../loader.js";

export interface SuggestComponentInput {
  use_case: string;
  library?: string;
  limit?: number;
}

interface ComponentSuggestion {
  component: string;
  library: string;
  page_id: string;
  description: string;
  matching_tags: string[];
  score: number;
}

export interface SuggestComponentOutput {
  suggestions: ComponentSuggestion[];
}

const FUZZY_THRESHOLD = 2; // max Levenshtein distance for fuzzy match

function computeTagScore(
  queryTokens: string[],
  tags: string[],
): { score: number; matchingTags: string[] } {
  if (queryTokens.length === 0) return { score: 0, matchingTags: [] };

  const matchingTags: string[] = [];
  let matchCount = 0;

  for (const token of queryTokens) {
    for (const tag of tags) {
      if (tag === token) {
        matchCount++;
        if (!matchingTags.includes(tag)) matchingTags.push(tag);
        break;
      }
      if (token.length >= 4 && tag.length >= 4 && levenshtein(token, tag) <= FUZZY_THRESHOLD) {
        matchCount += 0.5; // partial credit for fuzzy
        if (!matchingTags.includes(tag)) matchingTags.push(tag);
        break;
      }
    }
  }

  return {
    score: matchCount / queryTokens.length,
    matchingTags,
  };
}

export function handleSuggestComponent(
  data: LoadedData,
  input: SuggestComponentInput,
): SuggestComponentOutput {
  const { use_case, library, limit = 3 } = input;
  const queryTokens = tokenizeAndClean(use_case);

  if (queryTokens.length === 0) {
    return { suggestions: [] };
  }

  // --- Tag-based scoring ---
  const tagScores = new Map<string, { score: number; matchingTags: string[] }>();
  for (const [pageId, tags] of data.tagsByPageId) {
    if (library) {
      const page = data.pageById.get(pageId);
      if (!page || page.library !== library) continue;
    }
    const result = computeTagScore(queryTokens, tags);
    if (result.score > 0) {
      tagScores.set(pageId, result);
    }
  }

  // --- MiniSearch-based scoring ---
  const searchResults = searchIndex(data.index, use_case, 50);
  const searchScores = new Map<string, number>();
  let maxSearchScore = 0;

  for (const result of searchResults) {
    const chunk = data.chunkById.get(result.id);
    if (!chunk || chunk.page_type !== "component") continue;
    if (library && chunk.library !== library) continue;

    const pageId = chunk.page_id;
    const current = searchScores.get(pageId) ?? 0;
    if (result.score > current) {
      searchScores.set(pageId, result.score);
      if (result.score > maxSearchScore) maxSearchScore = result.score;
    }
  }

  // --- Merge scores ---
  const allPageIds = new Set([...tagScores.keys(), ...searchScores.keys()]);
  const combined: { pageId: string; score: number; matchingTags: string[] }[] = [];

  for (const pageId of allPageIds) {
    const tagResult = tagScores.get(pageId);
    const normalizedTagScore = tagResult?.score ?? 0;
    const rawSearchScore = searchScores.get(pageId) ?? 0;
    const normalizedSearchScore = maxSearchScore > 0 ? rawSearchScore / maxSearchScore : 0;

    const finalScore = 0.4 * normalizedTagScore + 0.6 * normalizedSearchScore;

    if (finalScore > 0) {
      combined.push({
        pageId,
        score: Math.round(finalScore * 100) / 100,
        matchingTags: tagResult?.matchingTags ?? [],
      });
    }
  }

  // Sort by score descending
  combined.sort((a, b) => b.score - a.score);

  // Build suggestions
  const suggestions: ComponentSuggestion[] = [];
  for (const entry of combined.slice(0, limit)) {
    const page = data.pageById.get(entry.pageId);
    if (!page) continue;

    suggestions.push({
      component: page.title,
      library: page.library ?? "",
      page_id: page.id,
      description: page.description,
      matching_tags: entry.matchingTags,
      score: entry.score,
    });
  }

  return { suggestions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx vitest run tests/agent-tools.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/suggest-component.ts tests/agent-tools.test.ts
git commit -m "feat: add suggest_component tool handler with tests"
```

---

## Chunk 3: Server Registration and Integration

### Task 10: Register all 4 new tools in `src/server/server.ts`

**Files:**
- Modify: `src/server/server.ts`

- [ ] **Step 1: Add imports and tool registrations**

Add imports after existing tool imports:

```typescript
import { handleSuggestComponent } from "./tools/suggest-component.js";
import { handleGetComponentReference } from "./tools/get-component-reference.js";
import { handleGetQuickStart } from "./tools/get-quick-start.js";
import { handleGetDesignSystemOverview } from "./tools/get-design-system-overview.js";
```

Add tool registrations after the existing `list_sources` registration:

```typescript
server.tool(
  "suggest_component",
  "Suggest Gravity UI components for a described use case. Returns ranked suggestions based on semantic tag matching. Use this when you know what you need but not which component provides it.",
  {
    use_case: z.string().describe("Describe what you need, e.g. 'date range selection' or 'sidebar navigation'"),
    library: z.string().optional().describe("Filter suggestions to a specific library"),
    limit: z.number().int().min(1).max(5).optional().describe("Maximum number of suggestions (1-5, default 3)"),
  },
  (args) => {
    const result = handleSuggestComponent(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_component_reference",
  "Get a complete reference for a Gravity UI component in a single call. Returns import statement, props, code example, and optionally full documentation. Use this when you know which component you need and want to start coding.",
  {
    name: z.string().describe("Component name, e.g. 'Button', 'Select', 'DatePicker'"),
    library: z.string().describe("Library name, e.g. 'uikit', 'date-components'"),
    detail: z.enum(["compact", "full"]).optional().describe("Level of detail: 'compact' (default) for props + example, 'full' for everything"),
  },
  (args) => {
    const result = handleGetComponentReference(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_quick_start",
  "Get everything needed to start using a Gravity UI library: install command, setup code, and a list of available components. Use this when you've decided which library to use and need to set it up.",
  {
    library: z.string().describe("Library name, e.g. 'uikit', 'navigation', 'date-components'"),
  },
  (args) => {
    const result = handleGetQuickStart(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_design_system_overview",
  "Get the Gravity UI design system philosophy and library overview. Returns theming model, color system, spacing conventions, and per-library purpose with dependency relationships. Call this once at the start of a session to understand the design system before building with it.",
  {
    library: z.string().optional().describe("Optional: filter to show only this library's entry alongside the system overview"),
  },
  (args) => {
    const result = handleGetDesignSystemOverview(data, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run all tests**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && npm test`
Expected: all tests pass (both existing `tests/tools.test.ts` and new `tests/agent-tools.test.ts` and `tests/tags.test.ts`)

- [ ] **Step 4: Commit**

```bash
git add src/server/server.ts
git commit -m "feat: register 4 agent-optimized tools in MCP server"
```

---

### Task 11: End-to-end smoke test

**Files:**
- None (manual verification)

- [ ] **Step 1: Run the server and verify tools are listed**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx src/server/server.ts 2>/dev/null | head -20`
Expected: JSON output listing 9 tools (5 existing + 4 new)

- [ ] **Step 2: Test suggest_component**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"suggest_component","arguments":{"use_case":"date range selection"}}}' | npx tsx src/server/server.ts 2>/dev/null`
Expected: suggestions containing DatePicker or RangeCalendar

- [ ] **Step 3: Test get_component_reference**

Run: `cd /Users/skiter/Documents/Code/gravityui-reference-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_component_reference","arguments":{"name":"Button","library":"uikit"}}}' | npx tsx src/server/server.ts 2>/dev/null`
Expected: JSON with import_statement, props, example fields

- [ ] **Step 4: Commit (final)**

```bash
git add -A
git commit -m "feat: agent-optimized tools complete — 4 new tools + tag/overview ingest"
```
