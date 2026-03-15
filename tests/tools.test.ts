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
// list_components tests
// ---------------------------------------------------------------------------

describe("handleListComponents", () => {
  it("groups component pages by library in libraries array", () => {
    const output = handleListComponents(mockData, {});
    const uikitLib = output.libraries.find(l => l.id === "uikit");
    expect(uikitLib).toBeDefined();
    expect(uikitLib!.components.some(c => c.name === "Select")).toBe(true);
  });

  it("does not include guide pages in component list", () => {
    const output = handleListComponents(mockData, {});
    for (const lib of output.libraries) {
      for (const comp of lib.components) {
        expect(comp.page_id).not.toMatch(/^guide:/);
      }
    }
  });

  it("filters by library", () => {
    const output = handleListComponents(mockData, { library: "uikit" });
    expect(output.libraries).toHaveLength(1);
    expect(output.libraries[0].id).toBe("uikit");
  });

  it("sets has_design_guide when a guide page with matching name exists", () => {
    // "Button" guide exists; "Select" does not (guide:Button, component:uikit:Select)
    const output = handleListComponents(mockData, {});
    const uikitLib = output.libraries.find(l => l.id === "uikit");
    const selectComp = uikitLib?.components.find(c => c.name === "Select");
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
    const uikitLib = output.libraries.find(l => l.id === "uikit");
    const names = uikitLib!.components.map(c => c.name);
    expect(names).toEqual([...names].sort());
  });
});

