import { describe, it, expect } from "vitest";
import { buildManifestFromTrees } from "../discover.js";

describe("buildManifestFromTrees", () => {
  const makeTree = (paths: string[]) =>
    paths.map((path) => ({ path, type: "blob" }));

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
