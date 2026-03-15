import { describe, it, expect, beforeAll } from "vitest";
import { buildIndex } from "../src/ingest/index.js";
import type { LoadedData } from "../src/server/loader.js";
import type { Page, Chunk, DesignSystemOverview } from "../src/types.js";
import { handleSuggestComponent } from "../src/server/tools/suggest-component.js";

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
  content: "size: string = m — Button size",
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
  content: "--button-height: Button height",
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
  const pages = [buttonPage, buttonGuide, selectPage, uikitLibPage];
  const chunks = [
    buttonIntroChunk, buttonAppearanceChunk, buttonPropsChunk, buttonCssChunk,
    guideAppearanceChunk, guideSizesChunk, selectIntroChunk,
    uikitIntroChunk, uikitInstallChunk, uikitUsageChunk,
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
    componentDefs: [],
    componentByName: new Map(),
    componentsByLibrary: new Map(),
    tokens: { spacing: {}, breakpoints: {}, sizes: {} },
    categoryMap: { categories: {}, components: {} },
  };
});

// ---------------------------------------------------------------------------
// suggest_component tests
// ---------------------------------------------------------------------------

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
