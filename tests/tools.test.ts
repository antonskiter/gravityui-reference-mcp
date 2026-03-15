import { describe, it, expect, beforeAll } from "vitest";
import { buildIndex } from "../src/ingest/index.js";
import type { LoadedData } from "../src/server/loader.js";
import type { Page, Chunk, IngestMetadata, DesignSystemOverview } from "../src/types.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleListComponents } from "../src/server/tools/list-components.js";

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

const mockOverview: DesignSystemOverview = {
  system: {
    description: "Gravity UI is a design system for building interfaces.",
    theming: "Supports light and dark themes via CSS custom properties.",
    spacing: "Uses a 4px base grid for consistent spacing.",
    typography: "System font stack with defined type scale.",
    corner_radius: "Configurable corner radius tokens.",
    branding: "Supports custom branding through theme overrides.",
  },
  libraries: [
    {
      id: "uikit",
      package: "@gravity-ui/uikit",
      purpose: "Core UI component library",
      component_count: 1,
      depends_on: [],
      is_peer_dependency_of: [],
    },
  ],
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

  const tagsByPageId = new Map<string, string[]>();
  tagsByPageId.set("component:uikit:Select", ["select", "dropdown", "picker", "uikit"]);

  mockData = {
    pages,
    chunks,
    metadata: mockMetadata,
    index,
    pageById,
    chunkById,
    chunksByPageId,
    tagsByPageId,
    overview: mockOverview,
    componentDefs: [],
    componentByName: new Map(),
    componentsByLibrary: new Map(),
    tokens: { spacing: {}, breakpoints: {}, sizes: {} },
    categoryMap: { categories: {}, components: {} },
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

  it("snippet is truncated to word boundary at 500 chars", () => {
    // Use a long content chunk to verify truncation
    const longContent = "word ".repeat(120); // 600 chars
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
    expect(result!.snippet.length).toBeLessThanOrEqual(500);
    // Should not end mid-word
    expect(result!.snippet).not.toMatch(/\s$/);
  });

  it("returns empty results for unknown query", () => {
    const output = handleSearchDocs(mockData, { query: "zzzyyyxxx" });
    expect(output.results).toHaveLength(0);
    expect(output.total_matches).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// list_components tests
// ---------------------------------------------------------------------------

describe("handleListComponents", () => {
  it("returns groups with totalCount", () => {
    const output = handleListComponents(mockData, {});
    // With empty componentDefs, expect 0 total and empty groups
    expect(output.totalCount).toBe(0);
    expect(output.groups).toHaveLength(0);
  });

  it("returns empty groups for unrecognized library filter", () => {
    const output = handleListComponents(mockData, { library: "nonexistent" });
    expect(output.groups).toHaveLength(0);
    expect(output.totalCount).toBe(0);
  });

  it("returns empty groups for unknown category filter", () => {
    const output = handleListComponents(mockData, { category: "nonexistent" });
    expect(output.groups).toHaveLength(0);
    expect(output.totalCount).toBe(0);
  });

  it("groups components by category using componentDefs", () => {
    const comps = [
      { name: "Select", library: "uikit", import_path: "@gravity-ui/uikit", import_statement: "", props: [], examples: [], description: "A dropdown select.", source_file: "" },
    ];
    const testData: LoadedData = {
      ...mockData,
      componentDefs: comps,
      componentByName: new Map([["Select", comps]]),
      componentsByLibrary: new Map([["uikit", comps]]),
      categoryMap: { categories: { forms: "Form Controls" }, components: { Select: "forms" } },
    };
    const output = handleListComponents(testData, {});
    expect(output.totalCount).toBe(1);
    expect(output.groups.length).toBe(1);
    expect(output.groups[0].category).toBe("forms");
    expect(output.groups[0].components[0].name).toBe("Select");
  });

  it("filters by category slug", () => {
    const comps = [
      { name: "Select", library: "uikit", import_path: "@gravity-ui/uikit", import_statement: "", props: [], examples: [], description: "A dropdown.", source_file: "" },
      { name: "Button", library: "uikit", import_path: "@gravity-ui/uikit", import_statement: "", props: [], examples: [], description: "A button.", source_file: "" },
    ];
    const testData: LoadedData = {
      ...mockData,
      componentDefs: comps,
      componentByName: new Map(comps.map(c => [c.name, [c]])),
      componentsByLibrary: new Map([["uikit", comps]]),
      categoryMap: { categories: { forms: "Forms", actions: "Actions" }, components: { Select: "forms", Button: "actions" } },
    };
    const output = handleListComponents(testData, { category: "forms" });
    expect(output.totalCount).toBe(1);
    expect(output.groups[0].components[0].name).toBe("Select");
  });
});

