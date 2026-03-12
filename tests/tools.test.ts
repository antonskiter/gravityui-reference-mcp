import { describe, it, expect, beforeAll } from "vitest";
import { buildIndex } from "../src/ingest/index.js";
import type { LoadedData } from "../src/server/loader.js";
import type { Page, Chunk, IngestMetadata } from "../src/types.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleGetSection } from "../src/server/tools/get-section.js";
import { handleGetPage } from "../src/server/tools/get-page.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
import { handleListSources } from "../src/server/tools/list-sources.js";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const guideButtonPage: Page = {
  id: "guide:Button",
  title: "Button",
  page_type: "guide",
  url: "https://gravity-ui.com/guides/button",
  breadcrumbs: ["Guides", "Button"],
  description: "Design guide for the Button component.",
  section_ids: ["guide:Button:appearance", "guide:Button:sizes"],
};

const componentSelectPage: Page = {
  id: "component:uikit:Select",
  title: "Select",
  page_type: "component",
  library: "uikit",
  url: "https://gravity-ui.com/components/uikit/select",
  breadcrumbs: ["Components", "uikit", "Select"],
  description: "A dropdown select component.",
  section_ids: ["component:uikit:Select:usage"],
};

const chunk1: Chunk = {
  id: "guide:Button:appearance",
  page_id: "guide:Button",
  url: "https://gravity-ui.com/guides/button#appearance",
  page_title: "Button",
  page_type: "guide",
  section_title: "Appearance",
  breadcrumbs: ["Guides", "Button", "Appearance"],
  content: "The Button component supports multiple visual styles: primary, secondary, and outlined. Each variant conveys a different level of importance.",
  code_examples: ["<Button view='primary'>Click me</Button>"],
  keywords: ["button", "appearance", "style", "variant"],
};

const chunk2: Chunk = {
  id: "guide:Button:sizes",
  page_id: "guide:Button",
  url: "https://gravity-ui.com/guides/button#sizes",
  page_title: "Button",
  page_type: "guide",
  section_title: "Sizes",
  breadcrumbs: ["Guides", "Button", "Sizes"],
  content: "Buttons come in three sizes: small, medium, and large. Use the size prop to control the button size.",
  code_examples: [],
  keywords: ["button", "size", "small", "large"],
};

const chunk3: Chunk = {
  id: "component:uikit:Select:usage",
  page_id: "component:uikit:Select",
  url: "https://gravity-ui.com/components/uikit/select#usage",
  page_title: "Select",
  page_type: "component",
  library: "uikit",
  section_title: "Usage",
  breadcrumbs: ["Components", "uikit", "Select", "Usage"],
  content: "The Select component allows users to pick one option from a dropdown list. Import it from @gravity-ui/uikit.",
  code_examples: ["<Select options={options} />"],
  keywords: ["select", "dropdown", "uikit", "options"],
};

const mockMetadata: IngestMetadata = {
  indexed_at: "2026-03-12T00:00:00.000Z",
  source_commits: { uikit: "abc123", guides: "def456" },
};

let mockData: LoadedData;

beforeAll(() => {
  const pages = [guideButtonPage, componentSelectPage];
  const chunks = [chunk1, chunk2, chunk3];
  const index = buildIndex(chunks);

  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunkById = new Map(chunks.map(c => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  mockData = {
    pages,
    chunks,
    metadata: mockMetadata,
    index,
    pageById,
    chunkById,
    chunksByPageId,
  };
});

// ---------------------------------------------------------------------------
// search_docs tests
// ---------------------------------------------------------------------------

describe("handleSearchDocs", () => {
  it("returns matches for a known query", () => {
    const output = handleSearchDocs(mockData, { query: "button" });
    expect(output.results.length).toBeGreaterThan(0);
    const ids = output.results.map(r => r.section_id);
    expect(ids.some(id => id.startsWith("guide:Button"))).toBe(true);
  });

  it("filters by page_type", () => {
    const output = handleSearchDocs(mockData, { query: "button", page_type: "guide" });
    for (const result of output.results) {
      expect(result.page_type).toBe("guide");
    }
  });

  it("filters by library", () => {
    const output = handleSearchDocs(mockData, { query: "select dropdown", library: "uikit" });
    for (const result of output.results) {
      expect(result.library).toBe("uikit");
    }
    expect(output.results.length).toBeGreaterThan(0);
  });

  it("respects the limit parameter", () => {
    const output = handleSearchDocs(mockData, { query: "button", limit: 1 });
    expect(output.results.length).toBeLessThanOrEqual(1);
  });

  it("snippet is truncated to word boundary at 200 chars", () => {
    // chunk1 content is < 200 chars so snippet equals content; use a long content chunk
    const longContent = "word ".repeat(60); // 300 chars
    const longChunk: Chunk = {
      ...chunk1,
      id: "guide:Button:long",
      content: longContent,
      keywords: ["longcontent", "button"],
    };
    const pages = mockData.pages;
    const chunks = [...mockData.chunks, longChunk];
    const index = buildIndex(chunks);
    const pageById = new Map(pages.map(p => [p.id, p]));
    const chunkById = new Map(chunks.map(c => [c.id, c]));
    const testData: LoadedData = { ...mockData, index, chunkById, chunks };

    const output = handleSearchDocs(testData, { query: "longcontent" });
    const result = output.results.find(r => r.section_id === "guide:Button:long");
    expect(result).toBeDefined();
    expect(result!.snippet.length).toBeLessThanOrEqual(200);
    // Should not end mid-word (last char should be a letter of "word" or be end of word)
    expect(result!.snippet).not.toMatch(/\s$/);
  });

  it("returns empty results for unknown query", () => {
    const output = handleSearchDocs(mockData, { query: "zzzyyyxxx" });
    expect(output.results).toHaveLength(0);
    expect(output.total_matches).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// get_section tests
// ---------------------------------------------------------------------------

describe("handleGetSection", () => {
  it("returns full content for a known section", () => {
    const output = handleGetSection(mockData, { section_id: "guide:Button:appearance" });
    expect("error" in output).toBe(false);
    if ("error" in output) return;
    expect(output.section_id).toBe("guide:Button:appearance");
    expect(output.content).toBe(chunk1.content);
    expect(output.code_examples).toEqual(chunk1.code_examples);
    expect(output.section_title).toBe("Appearance");
  });

  it("includes related_sections (siblings on same page)", () => {
    const output = handleGetSection(mockData, { section_id: "guide:Button:appearance" });
    if ("error" in output) throw new Error("Expected success");
    const relatedIds = output.related_sections.map(r => r.section_id);
    expect(relatedIds).toContain("guide:Button:sizes");
    expect(relatedIds).not.toContain("guide:Button:appearance");
  });

  it("returns error for unknown section ID", () => {
    const output = handleGetSection(mockData, { section_id: "nonexistent:section" });
    expect("error" in output).toBe(true);
    if ("error" in output) {
      expect(output.error).toContain("nonexistent:section");
    }
  });
});

// ---------------------------------------------------------------------------
// get_page tests
// ---------------------------------------------------------------------------

describe("handleGetPage", () => {
  it("returns page metadata with section summaries and has_code flag", () => {
    const output = handleGetPage(mockData, { page_id: "guide:Button" });
    expect("error" in output).toBe(false);
    if ("error" in output) return;
    expect(output.page_id).toBe("guide:Button");
    expect(output.title).toBe("Button");
    expect(output.page_type).toBe("guide");
    expect(output.sections).toHaveLength(2);

    const appearanceSection = output.sections.find(s => s.section_id === "guide:Button:appearance");
    expect(appearanceSection).toBeDefined();
    expect(appearanceSection!.has_code).toBe(true);
    expect(appearanceSection!.summary.length).toBeLessThanOrEqual(150);

    const sizesSection = output.sections.find(s => s.section_id === "guide:Button:sizes");
    expect(sizesSection).toBeDefined();
    expect(sizesSection!.has_code).toBe(false);
  });

  it("returns error for unknown page ID", () => {
    const output = handleGetPage(mockData, { page_id: "nonexistent:page" });
    expect("error" in output).toBe(true);
    if ("error" in output) {
      expect(output.error).toContain("nonexistent:page");
    }
  });
});

// ---------------------------------------------------------------------------
// list_components tests
// ---------------------------------------------------------------------------

describe("handleListComponents", () => {
  it("groups component pages by library", () => {
    const output = handleListComponents(mockData, {});
    expect(output.components_by_library).toHaveProperty("uikit");
    const uikitComponents = output.components_by_library["uikit"];
    expect(uikitComponents).toBeDefined();
    expect(uikitComponents.some(c => c.name === "Select")).toBe(true);
  });

  it("does not include guide pages in component list", () => {
    const output = handleListComponents(mockData, {});
    for (const components of Object.values(output.components_by_library)) {
      for (const comp of components) {
        expect(comp.page_id).not.toMatch(/^guide:/);
      }
    }
  });

  it("filters by library", () => {
    const output = handleListComponents(mockData, { library: "uikit" });
    const keys = Object.keys(output.components_by_library);
    expect(keys).toContain("uikit");
    // Only uikit library should be present
    for (const key of keys) {
      expect(key).toBe("uikit");
    }
  });

  it("sets has_design_guide when a guide page with matching name exists", () => {
    // "Button" guide exists; "Select" does not (guide:Button, component:uikit:Select)
    const output = handleListComponents(mockData, {});
    const selectComp = output.components_by_library["uikit"]?.find(c => c.name === "Select");
    // There's no guide page named "Select", so has_design_guide should be false
    expect(selectComp?.has_design_guide).toBe(false);
  });

  it("sorts components by name within library", () => {
    // Add another component to test sorting
    const buttonComponentPage: Page = {
      id: "component:uikit:Button",
      title: "Button",
      page_type: "component",
      library: "uikit",
      url: "https://gravity-ui.com/components/uikit/button",
      breadcrumbs: ["Components", "uikit", "Button"],
      description: "A clickable button.",
      section_ids: [],
    };
    const pages = [...mockData.pages, buttonComponentPage];
    const testData: LoadedData = {
      ...mockData,
      pages,
      pageById: new Map(pages.map(p => [p.id, p])),
    };
    const output = handleListComponents(testData, { library: "uikit" });
    const names = output.components_by_library["uikit"].map(c => c.name);
    expect(names).toEqual([...names].sort());
  });
});

// ---------------------------------------------------------------------------
// list_sources tests
// ---------------------------------------------------------------------------

describe("handleListSources", () => {
  it("returns metadata with counts grouped by type", () => {
    const output = handleListSources(mockData);
    expect(output.indexed_at).toBe(mockMetadata.indexed_at);
    expect(output.source_commits).toEqual(mockMetadata.source_commits);
    expect(output.total_pages).toBe(2);
    expect(output.total_sections).toBe(3);
    expect(output.by_type).toHaveProperty("guide");
    expect(output.by_type).toHaveProperty("component");
    expect(output.by_type["guide"].page_count).toBe(1);
    expect(output.by_type["guide"].section_count).toBe(2);
    expect(output.by_type["component"].page_count).toBe(1);
    expect(output.by_type["component"].section_count).toBe(1);
  });
});
