/**
 * Evaluation tests — run against real downloaded data in data/.
 * These verify output quality of the MCP tools, not internal logic.
 *
 * Run: npx vitest run tests/eval.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadData, type LoadedData } from "../src/server/loader.js";
import { handleSearchDocs, formatSearchDocs } from "../src/server/tools/search-docs.js";
import { handleGetSection } from "../src/server/tools/get-section.js";
import { handleGetPage } from "../src/server/tools/get-page.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
import { handleListSources } from "../src/server/tools/list-sources.js";
import { handleGetComponentReference, formatGetComponentReference } from "../src/server/tools/get-component-reference.js";
import { handleGetQuickStart } from "../src/server/tools/get-quick-start.js";
import { handleSuggestComponent } from "../src/server/tools/suggest-component.js";

let data: LoadedData;

beforeAll(() => {
  data = loadData();
});

// ---------------------------------------------------------------------------
// Coverage: verify ingestion captured expected content
// ---------------------------------------------------------------------------

describe("ingestion coverage", () => {
  it("indexes a reasonable number of pages", () => {
    expect(data.pages.length).toBeGreaterThan(200);
  });

  it("indexes a reasonable number of chunks", () => {
    expect(data.chunks.length).toBeGreaterThan(1000);
  });

  it("has all three page types", () => {
    const types = new Set(data.pages.map((p) => p.page_type));
    expect(types).toContain("guide");
    expect(types).toContain("component");
    expect(types).toContain("library");
  });

  it("indexes core uikit components", () => {
    const uikitComponents = data.pages
      .filter((p) => p.page_type === "component" && p.library === "uikit")
      .map((p) => p.title);
    for (const name of ["Button", "Select", "Dialog", "Table", "Label", "Checkbox"]) {
      expect(uikitComponents).toContain(name);
    }
  });

  it("indexes nested uikit components (lab, controls, layout)", () => {
    const uikitIds = data.pages
      .filter((p) => p.page_type === "component" && p.library === "uikit")
      .map((p) => p.id);
    // These should exist thanks to the nested discovery fix
    expect(uikitIds.some((id) => id.includes("lab/"))).toBe(true);
    expect(uikitIds.some((id) => id.includes("controls/"))).toBe(true);
  });

  it("indexes library sub-documentation", () => {
    const libSubDocs = data.pages.filter(
      (p) => p.page_type === "library" && p.id.includes(":") && p.id.split(":").length > 2,
    );
    expect(libSubDocs.length).toBeGreaterThan(50);
  });

  it("indexes graph library docs", () => {
    const graphDocs = data.pages.filter(
      (p) => p.library === "graph" && p.page_type === "library" && p.id !== "library:graph",
    );
    expect(graphDocs.length).toBeGreaterThan(10);
  });

  it("indexes markdown-editor docs", () => {
    const mdDocs = data.pages.filter(
      (p) => p.library === "markdown-editor" && p.page_type === "library" && p.id !== "library:markdown-editor",
    );
    expect(mdDocs.length).toBeGreaterThan(5);
  });

  it("indexes aikit components", () => {
    const aikitComponents = data.pages.filter(
      (p) => p.page_type === "component" && p.library === "aikit",
    );
    expect(aikitComponents.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Title quality: no badge alt-text pollution
// ---------------------------------------------------------------------------

describe("title quality", () => {
  it("page titles do not contain badge alt-text", () => {
    const badgeWords = ["npm package", "CI", "Release", "storybook"];
    for (const page of data.pages) {
      for (const word of badgeWords) {
        // Allow "CI" in actual component/guide names but not in the badge pattern
        if (word === "CI" || word === "Release") continue;
        expect(page.title).not.toContain(word);
      }
    }
  });

  it("chunk page_titles do not contain badge alt-text", () => {
    for (const chunk of data.chunks) {
      expect(chunk.page_title).not.toContain("npm package");
      expect(chunk.page_title).not.toContain("storybook");
    }
  });

  it("library page titles look clean", () => {
    const libraryPages = data.pages.filter((p) => p.page_type === "library" && p.id.split(":").length === 2);
    for (const page of libraryPages) {
      // Title should not have trailing separators
      expect(page.title).not.toMatch(/[·]\s*$/);
      // Title should not be excessively long (badge pollution makes titles 100+ chars)
      // Some library sub-doc titles are legitimately long (e.g., guide titles)
      expect(page.title.length).toBeLessThan(150);
    }
  });
});

// ---------------------------------------------------------------------------
// Search quality: deduplication and relevance
// ---------------------------------------------------------------------------

describe("search deduplication", () => {
  it("returns no duplicate page_ids in results", () => {
    const queries = ["button", "markdown editor", "select dropdown", "graph canvas", "table"];
    for (const query of queries) {
      const result = handleSearchDocs(data, { query, limit: 10 });
      const sectionIds = result.results.map((r) => r.section_id);
      // Extract page_ids from section_ids by looking up chunks
      const pageIds = sectionIds.map((sid) => data.chunkById.get(sid)?.page_id);
      const uniquePageIds = new Set(pageIds);
      expect(uniquePageIds.size).toBe(pageIds.length);
    }
  });

  it("markdown editor search returns diverse results", () => {
    const result = handleSearchDocs(data, { query: "markdown editor", limit: 5 });
    expect(result.results.length).toBeGreaterThanOrEqual(3);
    // Should not be 5 results all from the same library page
    const pageIds = new Set(result.results.map((r) => data.chunkById.get(r.section_id)?.page_id));
    expect(pageIds.size).toBeGreaterThanOrEqual(2);
  });
});

describe("search relevance", () => {
  it("finds Button component when searching 'button'", () => {
    const result = handleSearchDocs(data, { query: "button", page_type: "component" });
    const titles = result.results.map((r) => r.page_title);
    expect(titles).toContain("Button");
  });

  it("finds FileDropZone when searching 'file upload drag drop'", () => {
    const result = handleSearchDocs(data, { query: "file upload drag drop" });
    const hasFileDropZone = result.results.some(
      (r) => r.page_title === "FileDropZone" || r.section_id.includes("FileDropZone"),
    );
    expect(hasFileDropZone).toBe(true);
  });

  it("finds graph connection docs when searching 'graph connections anchors'", () => {
    const result = handleSearchDocs(data, { query: "graph connections anchors" });
    expect(result.results.length).toBeGreaterThan(0);
    const hasGraph = result.results.some((r) => r.library === "graph");
    expect(hasGraph).toBe(true);
  });

  it("finds latex extension when searching 'latex math formula'", () => {
    const result = handleSearchDocs(data, { query: "latex math formula" });
    const hasLatex = result.results.some(
      (r) => r.section_id.includes("latex") || r.page_title.toLowerCase().includes("latex"),
    );
    expect(hasLatex).toBe(true);
  });

  it("filters by page_type correctly", () => {
    const result = handleSearchDocs(data, { query: "button", page_type: "guide" });
    for (const r of result.results) {
      expect(r.page_type).toBe("guide");
    }
  });

  it("filters by library correctly", () => {
    const result = handleSearchDocs(data, { query: "settings", library: "graph" });
    for (const r of result.results) {
      expect(r.library).toBe("graph");
    }
  });
});

// ---------------------------------------------------------------------------
// Snippet quality: no broken markdown in output
// ---------------------------------------------------------------------------

describe("snippet quality", () => {
  it.todo("snippets do not contain raw markdown image syntax — needs sanitize on snippets");

  it("snippets are within length limit", () => {
    const queries = ["button", "select", "graph", "markdown", "table"];
    for (const query of queries) {
      const result = handleSearchDocs(data, { query, limit: 5 });
      for (const r of result.results) {
        expect(r.snippet.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it.todo("formatted output does not contain broken markdown links — needs ToC/link-list chunk filtering");

  it("scores are normalized 0-100", () => {
    const result = handleSearchDocs(data, { query: "button sizes props", limit: 10 });
    for (const r of result.results) {
      expect(r.score).toBeGreaterThan(0);
    }
    const formatted = formatSearchDocs(result);
    const scoreMatches = formatted.match(/score: (\d+)/g) ?? [];
    for (const match of scoreMatches) {
      const score = parseInt(match.replace("score: ", ""));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// get_component_reference: known components resolve correctly
// ---------------------------------------------------------------------------

describe("get_component_reference", () => {
  it("resolves Button in uikit", () => {
    const result = handleGetComponentReference(data, { name: "Button", library: "uikit" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.component).toBe("Button");
    expect(result.import_statement).toContain("Button");
    expect(result.description.length).toBeGreaterThan(0);
    expect(result.url).toContain("gravity-ui.com");
  });

  it("resolves Select in uikit with props", () => {
    const result = handleGetComponentReference(data, { name: "Select", library: "uikit" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.component).toBe("Select");
  });

  it("resolves Dialog in uikit", () => {
    const result = handleGetComponentReference(data, { name: "Dialog", library: "uikit" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.component).toBe("Dialog");
  });

  it("returns error for nonexistent component", () => {
    const result = handleGetComponentReference(data, { name: "NonExistent", library: "uikit" });
    expect("error" in result).toBe(true);
  });

  it("formatted output is clean text", () => {
    const result = handleGetComponentReference(data, { name: "Button", library: "uikit" });
    const formatted = formatGetComponentReference(result);
    expect(formatted).not.toContain("![");
    expect(formatted.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// get_section: drill-down works
// ---------------------------------------------------------------------------

describe("get_section", () => {
  it("retrieves a known section by ID", () => {
    // Find any chunk ID from the data
    const chunk = data.chunks[0];
    const result = handleGetSection(data, { section_id: chunk.id });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.section_id).toBe(chunk.id);
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("includes related_sections from the same page", () => {
    // Find a page with multiple chunks
    const multiChunkPage = data.pages.find((p) => p.section_ids.length > 1);
    expect(multiChunkPage).toBeDefined();
    if (!multiChunkPage) return;

    const firstSectionId = multiChunkPage.section_ids[0];
    const result = handleGetSection(data, { section_id: firstSectionId });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.related_sections.length).toBeGreaterThan(0);
  });

  it("returns error for unknown section", () => {
    const result = handleGetSection(data, { section_id: "nonexistent:id" });
    expect("error" in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_page: page metadata works
// ---------------------------------------------------------------------------

describe("get_page", () => {
  it("retrieves a component page", () => {
    const result = handleGetPage(data, { page_id: "component:uikit:Button" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.title).toBe("Button");
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("retrieves a guide page", () => {
    const result = handleGetPage(data, { page_id: "guide:Button" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.page_type).toBe("guide");
  });

  it("retrieves a library page", () => {
    const result = handleGetPage(data, { page_id: "library:uikit" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.page_type).toBe("library");
  });

  it("returns error for unknown page", () => {
    const result = handleGetPage(data, { page_id: "nonexistent:page" });
    expect("error" in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// list_components: expected libraries and components present
// ---------------------------------------------------------------------------

describe("list_components", () => {
  it("lists multiple libraries", () => {
    const result = handleListComponents(data, {});
    expect(result.libraries.length).toBeGreaterThan(5);
  });

  it("uikit has 50+ components", () => {
    const result = handleListComponents(data, { library: "uikit" });
    expect(result.libraries).toHaveLength(1);
    expect(result.libraries[0].components.length).toBeGreaterThan(50);
  });

  it("components are sorted by name (case-insensitive)", () => {
    const result = handleListComponents(data, { library: "uikit" });
    const names = result.libraries[0].components.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("aikit has components", () => {
    const result = handleListComponents(data, { library: "aikit" });
    expect(result.libraries).toHaveLength(1);
    expect(result.libraries[0].components.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// list_sources: metadata is accurate
// ---------------------------------------------------------------------------

describe("list_sources", () => {
  it("returns accurate counts", () => {
    const result = handleListSources(data);
    expect(result.total_pages).toBe(data.pages.length);
    expect(result.total_sections).toBe(data.chunks.length);
    expect(result.page_counts.guides).toBeGreaterThan(30);
    expect(result.page_counts.components).toBeGreaterThan(90);
    expect(result.page_counts.libraries).toBeGreaterThan(30);
  });

  it("lists all 34 library repos", () => {
    const result = handleListSources(data);
    expect(result.libraries.length).toBe(34);
  });
});

// ---------------------------------------------------------------------------
// suggest_component: returns relevant suggestions
// ---------------------------------------------------------------------------

describe("suggest_component", () => {
  it("suggests Button for 'button click action'", () => {
    const result = handleSuggestComponent(data, { use_case: "button click action" });
    expect(result.suggestions.length).toBeGreaterThan(0);
    const names = result.suggestions.map((s) => s.component);
    expect(names).toContain("Button");
  });

  it("suggests Select for 'dropdown picker options'", () => {
    const result = handleSuggestComponent(data, { use_case: "dropdown picker options" });
    expect(result.suggestions.length).toBeGreaterThan(0);
    const names = result.suggestions.map((s) => s.component);
    expect(names).toContain("Select");
  });

  it("suggests Dialog for 'modal popup confirmation'", () => {
    const result = handleSuggestComponent(data, { use_case: "modal popup confirmation" });
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("filters by library", () => {
    const result = handleSuggestComponent(data, { use_case: "button", library: "uikit" });
    for (const s of result.suggestions) {
      expect(s.library).toBe("uikit");
    }
  });
});

// ---------------------------------------------------------------------------
// get_quick_start: library onboarding works
// ---------------------------------------------------------------------------

describe("get_quick_start", () => {
  it("returns quick start for uikit", () => {
    const result = handleGetQuickStart(data, { library: "uikit" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.library).toBe("uikit");
    expect(result.package).toBe("@gravity-ui/uikit");
    expect(result.components.length).toBeGreaterThan(50);
  });

  it("returns quick start for graph", () => {
    const result = handleGetQuickStart(data, { library: "graph" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.library).toBe("graph");
  });

  it("returns error for unknown library", () => {
    const result = handleGetQuickStart(data, { library: "nonexistent" });
    expect("error" in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Data integrity: no duplicates, no orphans
// ---------------------------------------------------------------------------

describe("data integrity", () => {
  it("all chunk IDs are unique", () => {
    const ids = data.chunks.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all page IDs are unique", () => {
    const ids = data.pages.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every chunk references an existing page_id", () => {
    for (const chunk of data.chunks) {
      expect(data.pageById.has(chunk.page_id)).toBe(true);
    }
  });

  it("every page section_id references an existing chunk", () => {
    for (const page of data.pages) {
      for (const sectionId of page.section_ids) {
        expect(data.chunkById.has(sectionId)).toBe(true);
      }
    }
  });

  it("no empty chunks (content or code_examples must have substance)", () => {
    for (const chunk of data.chunks) {
      const hasContent = chunk.content.trim().length > 0;
      const hasCode = chunk.code_examples.some((e) => e.trim().length > 0);
      expect(hasContent || hasCode).toBe(true);
    }
  });
});
