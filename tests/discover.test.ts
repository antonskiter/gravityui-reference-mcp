import { describe, it, expect } from "vitest";
import { buildManifestFromTrees } from "../src/ingest/discover.js";

describe("buildManifestFromTrees", () => {
  it("extracts MDX design guide entries from landing tree", () => {
    const landingTree = [
      { path: "src/content/design/guides/content/en/Button.mdx", type: "blob" },
      { path: "src/content/design/guides/content/en/Alert.mdx", type: "blob" },
      { path: "src/content/design/guides/content/ru/Button.mdx", type: "blob" },
      { path: "src/content/design/guides/index.ts", type: "blob" },
    ];
    const libTrees = {};
    const result = buildManifestFromTrees(landingTree, libTrees);
    const guides = result.filter((e) => e.page_type === "guide");
    expect(guides).toHaveLength(2);
    expect(guides[0].name).toBe("Button");
    expect(guides[0].page_type).toBe("guide");
    expect(guides[0].raw_url).toContain("raw.githubusercontent.com");
  });

  it("extracts component README entries from library trees", () => {
    const landingTree: any[] = [];
    const libTrees = {
      uikit: [
        { path: "src/components/Button/README.md", type: "blob" },
        { path: "src/components/Button/Button.tsx", type: "blob" },
        { path: "src/components/Select/README.md", type: "blob" },
      ],
    };
    const result = buildManifestFromTrees(landingTree, libTrees);
    const components = result.filter((e) => e.page_type === "component");
    expect(components).toHaveLength(2);
    expect(components[0].library).toBe("uikit");
    expect(components[0].name).toBe("Button");
  });

  it("adds library README entries for each repo", () => {
    const landingTree: any[] = [];
    const libTrees = { uikit: [], navigation: [] };
    const result = buildManifestFromTrees(landingTree, libTrees);
    const libs = result.filter((e) => e.page_type === "library");
    expect(libs).toHaveLength(2);
    expect(libs.map((l) => l.library)).toContain("uikit");
    expect(libs.map((l) => l.library)).toContain("navigation");
  });
});
