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
  RecipeLevelSchema,
  RecipeDefSchema,
  RecipeSectionSchema,
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
  const minimal = {
    name: "Button",
    library: "uikit",
    import_path: "@gravity-ui/uikit",
    import_statement: "import {Button} from '@gravity-ui/uikit';",
    props: [] as unknown[],
    examples: [] as string[],
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
  const valid = {
    id: "chunk-1",
    page_id: "page-1",
    url: "https://example.com/page",
    page_title: "Button",
    page_type: "component" as const,
    section_title: "Overview",
    breadcrumbs: ["Components", "Button"],
    content: "The Button component...",
    code_examples: [] as string[],
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
  const valid = {
    spacing: { "0": "0px", "1": "4px" } as Record<string, string>,
    breakpoints: { xs: 0, s: 576 } as Record<string, number>,
    sizes: { xs: "20px", s: "24px" } as Record<string, string>,
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

  it("accepts a TokenSet with typography", () => {
    const withTypo = {
      ...valid,
      typography: { body1: "14px/20px Inter", heading1: "28px/36px Inter" },
    };
    const result = TokenSetSchema.parse(withTypo);
    expect(result.typography?.["body1"]).toBe("14px/20px Inter");
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
  const valid = {
    id: "page-1",
    title: "Button",
    page_type: "component" as const,
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

describe("RecipeLevelSchema", () => {
  it("accepts valid levels", () => {
    expect(RecipeLevelSchema.parse("foundation")).toBe("foundation");
    expect(RecipeLevelSchema.parse("molecule")).toBe("molecule");
    expect(RecipeLevelSchema.parse("organism")).toBe("organism");
  });

  it("rejects invalid levels", () => {
    expect(() => RecipeLevelSchema.parse("atom")).toThrow();
    expect(() => RecipeLevelSchema.parse("")).toThrow();
  });
});

describe("RecipeSectionSchema", () => {
  it("accepts a valid decision section", () => {
    const result = RecipeSectionSchema.parse({
      type: "decision",
      when: "User needs to confirm an action",
      not_for: "Multi-step wizards",
    });
    expect(result.type).toBe("decision");
  });

  it("accepts a decision section with matrix", () => {
    const result = RecipeSectionSchema.parse({
      type: "decision",
      when: "Showing feedback",
      not_for: "Persistent messages",
      matrix: [
        { situation: "success", component: "Toaster", why: "Non-blocking" },
      ],
    });
    expect(result.type).toBe("decision");
    if (result.type === "decision") {
      expect(result.matrix).toHaveLength(1);
    }
  });

  it("accepts a valid components section", () => {
    const result = RecipeSectionSchema.parse({
      type: "components",
      items: [
        { name: "Dialog", library: "uikit", usage: "required", role: "overlay" },
      ],
    });
    expect(result.type).toBe("components");
  });

  it("accepts a valid example section", () => {
    const result = RecipeSectionSchema.parse({
      type: "example",
      title: "Basic usage",
      code: "<Button>Click</Button>",
    });
    expect(result.type).toBe("example");
  });

  it("accepts a valid structure section with tree and flow", () => {
    const result = RecipeSectionSchema.parse({
      type: "structure",
      tree: ["Button", "  Dialog"],
      flow: ["User clicks -> open dialog"],
    });
    expect(result.type).toBe("structure");
  });

  it("accepts a valid avoid section", () => {
    const result = RecipeSectionSchema.parse({
      type: "avoid",
      items: ["Custom modal -- ConfirmDialog handles it"],
    });
    expect(result.type).toBe("avoid");
  });

  it("accepts a valid related section", () => {
    const result = RecipeSectionSchema.parse({
      type: "related",
      items: [{ id: "user-feedback", note: "Use Toaster after action" }],
    });
    expect(result.type).toBe("related");
  });

  it("rejects an unknown section type", () => {
    expect(() => RecipeSectionSchema.parse({
      type: "unknown",
      data: "test",
    })).toThrow();
  });

  it("rejects a components section with invalid usage value", () => {
    expect(() => RecipeSectionSchema.parse({
      type: "components",
      items: [
        { name: "Dialog", library: "uikit", usage: "mandatory", role: "overlay" },
      ],
    })).toThrow();
  });
});

describe("RecipeDefSchema", () => {
  const minimal = {
    id: "confirmation-dialog",
    title: "Confirmation Dialog",
    description: "A confirmation dialog pattern",
    level: "molecule",
    use_cases: ["confirm deletion"],
    packages: ["@gravity-ui/uikit"],
    tags: ["confirm", "dialog"],
    sections: [
      {
        type: "decision",
        when: "User must confirm an action",
        not_for: "Multi-step wizards",
      },
      {
        type: "example",
        title: "Basic",
        code: "<ConfirmDialog />",
      },
    ],
  };

  it("accepts a valid minimal RecipeDef", () => {
    const result = RecipeDefSchema.parse(minimal);
    expect(result.id).toBe("confirmation-dialog");
    expect(result.level).toBe("molecule");
    expect(result.sections).toHaveLength(2);
  });

  it("accepts a RecipeDef with all section types", () => {
    const full = {
      ...minimal,
      sections: [
        { type: "decision", when: "when", not_for: "not_for" },
        { type: "setup", steps: ["npm install"] },
        { type: "components", items: [{ name: "Dialog", library: "uikit", usage: "required", role: "overlay" }] },
        { type: "custom_parts", items: [{ name: "Dropzone", description: "drag area", approach: "use DS tokens" }] },
        { type: "structure", tree: ["Dialog"], flow: ["open -> close"] },
        { type: "example", title: "Basic", code: "<Dialog />" },
        { type: "avoid", items: ["Custom modal"] },
        { type: "related", items: [{ id: "theming", note: "setup theme first" }] },
      ],
    };
    const result = RecipeDefSchema.parse(full);
    expect(result.sections).toHaveLength(8);
  });

  it("rejects a RecipeDef missing required fields", () => {
    expect(() => RecipeDefSchema.parse({ id: "test" })).toThrow();
  });

  it("rejects a RecipeDef with invalid level", () => {
    expect(() => RecipeDefSchema.parse({
      ...minimal,
      level: "atom",
    })).toThrow();
  });

  it("accepts extra fields in sections (passthrough)", () => {
    const withExtra = {
      ...minimal,
      sections: [
        {
          type: "decision",
          when: "when",
          not_for: "not for",
        },
        {
          type: "example",
          title: "Basic",
          code: "<X />",
        },
      ],
    };
    const result = RecipeDefSchema.parse(withExtra);
    expect(result.sections).toHaveLength(2);
  });
});
