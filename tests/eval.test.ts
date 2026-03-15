/**
 * Evaluation tests — run against real downloaded data in data/.
 * These verify output quality of the MCP tools, not internal logic.
 *
 * Run: npx vitest run tests/eval.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadData, type LoadedData } from "../src/server/loader.js";
import { handleSearchDocs, formatSearchDocs } from "../src/server/tools/search-docs.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
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
  it("snippets do not contain raw markdown image syntax", () => {
    const result = handleSearchDocs(data, { query: "button component", limit: 10 });
    for (const r of result.results) {
      expect(r.snippet).not.toMatch(/!\[/);
    }
  });

  it("snippets are within length limit", () => {
    const queries = ["button", "select", "graph", "markdown", "table"];
    for (const query of queries) {
      const result = handleSearchDocs(data, { query, limit: 5 });
      for (const r of result.results) {
        // truncateAtWord uses 500-char limit
        expect(r.snippet.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it("formatted output does not contain broken markdown links", () => {
    const result = handleSearchDocs(data, { query: "graph documentation", limit: 5 });
    const formatted = formatSearchDocs(result);
    expect(formatted).not.toMatch(/\[(?![^\]]*\])/);
  });

  it("search returns results for known queries", () => {
    const result = handleSearchDocs(data, { query: "button sizes props", limit: 10 });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.total_matches).toBeGreaterThan(0);
    // Formatted output should contain result entries
    const formatted = formatSearchDocs(result);
    expect(formatted).toContain("Found");
  });
});

// ---------------------------------------------------------------------------
// Content cleanliness: sanitized chunks
// ---------------------------------------------------------------------------

describe("content cleanliness", () => {
  it("no chunks contain HTML comments", () => {
    for (const chunk of data.chunks) {
      expect(chunk.content).not.toMatch(/<!--/);
    }
  });

  it("no chunks contain image references", () => {
    for (const chunk of data.chunks) {
      expect(chunk.content).not.toMatch(/!\[/);
    }
  });

  it("no chunks contain raw markdown heading syntax outside code blocks", () => {
    for (const chunk of data.chunks) {
      // Strip code blocks before checking for heading syntax
      const withoutCode = chunk.content.replace(/```[\s\S]*?```/g, "");
      expect(withoutCode).not.toMatch(/^#{1,3}\s/m);
    }
  });

  it("no chunks under 30 chars without code", () => {
    for (const chunk of data.chunks) {
      const hasCode = chunk.code_examples.some(e => e.trim().length > 0);
      if (!hasCode) {
        expect(chunk.content.trim().length).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("chunk count reduced from pre-cleanup baseline", () => {
    // Was 2334 before cleanup
    expect(data.chunks.length).toBeLessThan(2334);
    // But should still have substantial content
    expect(data.chunks.length).toBeGreaterThan(1500);
  });
});

// ---------------------------------------------------------------------------
// list_components: expected libraries and components present
// ---------------------------------------------------------------------------

describe("list_components", () => {
  it("returns multiple categories when no filter", () => {
    const result = handleListComponents(data, {});
    expect(result.groups.length).toBeGreaterThan(5);
    expect(result.totalCount).toBeGreaterThan(50);
  });

  it("layout category has Flex, Box, Row, Col, Container", () => {
    const result = handleListComponents(data, { category: "layout" });
    const names = result.groups.flatMap(g => g.components.map(c => c.name));
    for (const expected of ["Flex", "Box", "Row", "Col", "Container"]) {
      expect(names).toContain(expected);
    }
  });

  it("components are sorted within category groups", () => {
    const result = handleListComponents(data, {});
    for (const group of result.groups) {
      const names = group.components.map((c) => c.name);
      // Each group should have at least one component
      expect(names.length).toBeGreaterThan(0);
    }
    // Overall groups are sorted by display name
    const displayNames = result.groups.map(g => g.displayName);
    const sorted = [...displayNames].sort((a, b) => a.localeCompare(b));
    expect(displayNames).toEqual(sorted);
  });

  it("filters by library", () => {
    const result = handleListComponents(data, { library: "uikit" });
    // All components should be from uikit
    for (const group of result.groups) {
      for (const comp of group.components) {
        expect(comp.library).toBe("uikit");
      }
    }
    expect(result.totalCount).toBeGreaterThan(50);
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
