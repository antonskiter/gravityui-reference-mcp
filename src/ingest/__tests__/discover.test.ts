import { describe, it, expect } from "vitest";
import { buildManifestFromTrees } from "../discover.js";

const makeTree = (paths: string[]) =>
  paths.map((path) => ({ path, type: "blob" }));

describe("buildManifestFromTrees — nested components", () => {
  it("discovers nested components in lab/", () => {
    const libTrees = {
      uikit: {
        tree: makeTree([
          "src/components/Button/README.md",
          "src/components/lab/FileDropZone/README.md",
          "src/components/lab/ColorPicker/README.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const components = entries.filter((e) => e.page_type === "component");
    const names = components.map((c) => c.name);
    expect(names).toContain("Button");
    expect(names).toContain("lab/FileDropZone");
    expect(names).toContain("lab/ColorPicker");
  });

  it("discovers nested components in controls/ and layout/", () => {
    const libTrees = {
      uikit: {
        tree: makeTree([
          "src/components/controls/TextInput/README.md",
          "src/components/layout/Flex/README.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const components = entries.filter((e) => e.page_type === "component");
    const names = components.map((c) => c.name);
    expect(names).toContain("controls/TextInput");
    expect(names).toContain("layout/Flex");
  });

  it("generates correct github_url for nested components", () => {
    const libTrees = {
      uikit: {
        tree: makeTree(["src/components/lab/FileDropZone/README.md"]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const comp = entries.find((e) => e.name === "lab/FileDropZone");
    expect(comp?.github_url).toBe(
      "https://github.com/gravity-ui/uikit/tree/main/src/components/lab/FileDropZone",
    );
  });

  it("still discovers top-level components", () => {
    const libTrees = {
      uikit: {
        tree: makeTree(["src/components/Button/README.md"]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const comp = entries.find((e) => e.name === "Button");
    expect(comp).toBeDefined();
    expect(comp?.page_type).toBe("component");
  });
});

describe("buildManifestFromTrees — library sub-documentation", () => {
  it("discovers docs/ markdown files as library pages", () => {
    const libTrees = {
      "markdown-editor": {
        tree: makeTree([
          "README.md",
          "docs/getting-started.md",
          "docs/extensions.md",
          "docs/api/toolbar.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const libPages = entries.filter(
      (e) => e.page_type === "library" && e.library === "markdown-editor",
    );
    // Root README + 3 docs files = 4 library pages
    expect(libPages.length).toBe(4);
  });

  it("skips CHANGELOG, CONTRIBUTING, LICENSE", () => {
    const libTrees = {
      uikit: {
        tree: makeTree([
          "README.md",
          "CHANGELOG.md",
          "CONTRIBUTING.md",
          "LICENSE.md",
          "docs/guide.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const libPages = entries.filter(
      (e) => e.page_type === "library" && e.library === "uikit",
    );
    // Root README + docs/guide.md = 2 (excludes CHANGELOG, CONTRIBUTING, LICENSE)
    expect(libPages.length).toBe(2);
  });

  it("skips test/fixture/example directories", () => {
    const libTrees = {
      chartkit: {
        tree: makeTree([
          "README.md",
          "docs/usage.md",
          "__tests__/helper.md",
          "tests/fixtures/data.md",
          "examples/demo.md",
          ".github/workflows/ci.md",
          ".storybook/config.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const libPages = entries.filter(
      (e) => e.page_type === "library" && e.library === "chartkit",
    );
    // Root README + docs/usage.md = 2
    expect(libPages.length).toBe(2);
  });

  it("does not double-index root README.md", () => {
    const libTrees = {
      graph: {
        tree: makeTree(["README.md", "docs/api.md"]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const readmeEntries = entries.filter(
      (e) => e.library === "graph" && e.name === "graph",
    );
    // Only one root README entry
    expect(readmeEntries.length).toBe(1);
  });

  it("gives sub-doc pages unique names from file path", () => {
    const libTrees = {
      "markdown-editor": {
        tree: makeTree(["README.md", "docs/getting-started.md"]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const subDoc = entries.find((e) => e.name === "markdown-editor/docs/getting-started");
    expect(subDoc).toBeDefined();
    expect(subDoc?.page_type).toBe("library");
    expect(subDoc?.library).toBe("markdown-editor");
  });

  it("discovers nested README.md files (not root)", () => {
    const libTrees = {
      aikit: {
        tree: makeTree([
          "README.md",
          "src/hooks/README.md",
          "src/components/README.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const libPages = entries.filter(
      (e) => e.page_type === "library" && e.library === "aikit",
    );
    // Root README + 2 nested READMEs = 3
    expect(libPages.length).toBe(3);
  });

  it("does not double-index component READMEs", () => {
    const libTrees = {
      uikit: {
        tree: makeTree([
          "README.md",
          "src/components/Button/README.md",
          "src/components/Label/README.md",
        ]),
        branch: "main",
      },
    };
    const entries = buildManifestFromTrees([], libTrees);
    const componentEntries = entries.filter((e) => e.page_type === "component");
    const libSubDocs = entries.filter(
      (e) => e.page_type === "library" && e.name !== "uikit",
    );
    expect(componentEntries.length).toBe(2); // Button + Label as components
    expect(libSubDocs.length).toBe(0); // No library sub-docs from component paths
  });
});
