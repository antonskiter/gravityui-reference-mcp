import { describe, it, expect } from "vitest";
import {
  PropDefSchema,
  ComponentDefSchema,
  PageTypeSchema,
  PageSchema,
  ChunkSchema,
  TokenSetSchema,
  CategoryMapSchema,
  SystemOverviewSchema,
  LibraryOverviewEntrySchema,
  DesignSystemOverviewSchema,
  ComponentTagsSchema,
} from "./schemas.js";

describe("PageTypeSchema", () => {
  it("accepts valid page types", () => {
    expect(PageTypeSchema.parse("guide")).toBe("guide");
    expect(PageTypeSchema.parse("component")).toBe("component");
    expect(PageTypeSchema.parse("library")).toBe("library");
  });

  it("rejects invalid page types", () => {
    expect(() => PageTypeSchema.parse("other")).toThrow();
    expect(() => PageTypeSchema.parse("")).toThrow();
  });
});

describe("ComponentDefSchema", () => {
  const minimal: unknown = {
    name: "Button",
    library: "uikit",
    import_path: "@gravity-ui/uikit",
    import_statement: "import {Button} from '@gravity-ui/uikit';",
    props: [],
    examples: [],
    source_file: "src/components/Button/Button.tsx",
  };

  it("accepts a valid minimal ComponentDef", () => {
    const result = ComponentDefSchema.parse(minimal);
    expect(result.name).toBe("Button");
    expect(result.props).toEqual([]);
  });

  it("accepts a ComponentDef with optional fields", () => {
    const full = {
      ...minimal,
      category: "forms",
      description: "A clickable button.",
      props: [
        {
          name: "size",
          type: "'s' | 'm' | 'l' | 'xl'",
          required: false,
          default: "'m'",
          description: "Button size",
          deprecated: false,
        },
      ],
      examples: ["<Button>Click me</Button>"],
    };
    const result = ComponentDefSchema.parse(full);
    expect(result.category).toBe("forms");
    expect(result.props).toHaveLength(1);
    expect(result.props[0].name).toBe("size");
  });

  it("rejects a ComponentDef missing required fields", () => {
    const bad = { name: "Button" };
    expect(() => ComponentDefSchema.parse(bad)).toThrow();
  });
});

describe("ChunkSchema", () => {
  const valid: unknown = {
    id: "chunk-1",
    page_id: "page-1",
    url: "https://example.com/page",
    page_title: "Button",
    page_type: "component",
    section_title: "Overview",
    breadcrumbs: ["Components", "Button"],
    content: "The Button component...",
    code_examples: [],
    keywords: ["button", "click"],
  };

  it("accepts a valid Chunk", () => {
    const result = ChunkSchema.parse(valid);
    expect(result.id).toBe("chunk-1");
    expect(result.page_type).toBe("component");
  });

  it("accepts a Chunk with optional library field", () => {
    const withLib = { ...valid, library: "uikit" };
    const result = ChunkSchema.parse(withLib);
    expect(result.library).toBe("uikit");
  });

  it("rejects a Chunk with an invalid page_type", () => {
    const bad = { ...valid, page_type: "invalid" };
    expect(() => ChunkSchema.parse(bad)).toThrow();
  });

  it("rejects a Chunk missing required fields", () => {
    expect(() => ChunkSchema.parse({ id: "chunk-1" })).toThrow();
  });
});

describe("TokenSetSchema", () => {
  const valid: unknown = {
    spacing: { "0": "0px", "1": "4px" },
    breakpoints: { xs: 0, s: 576 },
    sizes: { xs: "20px", s: "24px" },
  };

  it("accepts a valid TokenSet without colors", () => {
    const result = TokenSetSchema.parse(valid);
    expect(result.spacing["1"]).toBe("4px");
    expect(result.breakpoints["xs"]).toBe(0);
  });

  it("accepts a TokenSet with colors", () => {
    const withColors = {
      ...valid,
      colors: { primary: "#0070f3" },
    };
    const result = TokenSetSchema.parse(withColors);
    expect(result.colors?.["primary"]).toBe("#0070f3");
  });

  it("rejects a TokenSet with wrong breakpoint type", () => {
    const bad = { ...valid, breakpoints: { xs: "0px" } };
    expect(() => TokenSetSchema.parse(bad)).toThrow();
  });

  it("rejects a TokenSet missing required fields", () => {
    expect(() => TokenSetSchema.parse({ spacing: {} })).toThrow();
  });
});

describe("PropDefSchema", () => {
  it("accepts a valid PropDef", () => {
    const result = PropDefSchema.parse({
      name: "size",
      type: "'s' | 'm'",
      required: true,
    });
    expect(result.required).toBe(true);
    expect(result.default).toBeUndefined();
  });

  it("accepts a PropDef with all optional fields", () => {
    const result = PropDefSchema.parse({
      name: "size",
      type: "'s' | 'm'",
      required: false,
      default: "'m'",
      description: "Control size",
      deprecated: true,
    });
    expect(result.deprecated).toBe(true);
  });
});

describe("PageSchema", () => {
  const valid: unknown = {
    id: "page-1",
    title: "Button",
    page_type: "component",
    url: "https://example.com/button",
    breadcrumbs: ["Components"],
    description: "A button.",
    section_ids: ["s1", "s2"],
  };

  it("accepts a valid Page", () => {
    const result = PageSchema.parse(valid);
    expect(result.id).toBe("page-1");
  });

  it("accepts a Page with optional fields", () => {
    const withOpts = { ...valid, library: "uikit", github_url: "https://github.com/example" };
    const result = PageSchema.parse(withOpts);
    expect(result.library).toBe("uikit");
  });

  it("rejects a Page missing required fields", () => {
    expect(() => PageSchema.parse({ id: "page-1" })).toThrow();
  });
});

describe("CategoryMapSchema", () => {
  it("accepts a valid CategoryMap", () => {
    const result = CategoryMapSchema.parse({
      categories: { forms: "Forms" },
      components: { Button: "forms" },
    });
    expect(result.categories["forms"]).toBe("Forms");
  });

  it("rejects a CategoryMap missing fields", () => {
    expect(() => CategoryMapSchema.parse({ categories: {} })).toThrow();
  });
});

describe("SystemOverviewSchema", () => {
  it("accepts a valid SystemOverview", () => {
    const result = SystemOverviewSchema.parse({
      description: "Gravity UI",
      theming: "Token-based theming",
      spacing: "4px base unit",
      typography: "Inter font",
      corner_radius: "4px",
      branding: "Yandex",
    });
    expect(result.description).toBe("Gravity UI");
  });

  it("rejects a SystemOverview missing fields", () => {
    expect(() => SystemOverviewSchema.parse({ description: "d" })).toThrow();
  });
});

describe("LibraryOverviewEntrySchema", () => {
  it("accepts a valid LibraryOverviewEntry", () => {
    const result = LibraryOverviewEntrySchema.parse({
      id: "uikit",
      package: "@gravity-ui/uikit",
      purpose: "Core UI components",
      component_count: 50,
      depends_on: [],
      is_peer_dependency_of: [],
    });
    expect(result.component_count).toBe(50);
  });
});

describe("DesignSystemOverviewSchema", () => {
  it("accepts a valid DesignSystemOverview", () => {
    const result = DesignSystemOverviewSchema.parse({
      system: {
        description: "Gravity UI",
        theming: "Token-based theming",
        spacing: "4px base unit",
        typography: "Inter font",
        corner_radius: "4px",
        branding: "Yandex",
      },
      libraries: [
        {
          id: "uikit",
          package: "@gravity-ui/uikit",
          purpose: "Core UI components",
          component_count: 50,
          depends_on: [],
          is_peer_dependency_of: [],
        },
      ],
    });
    expect(result.libraries).toHaveLength(1);
  });
});

describe("ComponentTagsSchema", () => {
  it("accepts a valid ComponentTags record", () => {
    const result = ComponentTagsSchema.parse({
      Button: ["interactive", "form"],
      Icon: ["visual"],
    });
    expect(result["Button"]).toContain("interactive");
  });

  it("accepts an empty ComponentTags record", () => {
    const result = ComponentTagsSchema.parse({});
    expect(result).toEqual({});
  });
});
