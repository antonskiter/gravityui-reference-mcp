import { describe, it, expect } from "vitest";
import { parsePage } from "../parse.js";

describe("parsePage title extraction", () => {
  it("strips badge image alt-text from H1", () => {
    const md = `# @gravity-ui/markdown-editor · [![npm package](https://img.shields.io/npm/v/@gravity-ui/markdown-editor)](https://npmjs.com) [![CI](https://img.shields.io/badge/CI-passing-green)](https://ci.com) [![storybook](https://img.shields.io/badge/storybook-link-blue)](https://storybook.com)

Some description here.
`;
    const result = parsePage(md, "library", "markdown-editor");
    expect(result.title).toBe("@gravity-ui/markdown-editor");
  });

  it("keeps clean titles unchanged", () => {
    const md = `# Button\n\nA button component.`;
    const result = parsePage(md, "component", "Button");
    expect(result.title).toBe("Button");
  });

  it("strips trailing dot-separator after badge removal", () => {
    const md = `# UIKit · [![npm](https://badge.url)](https://npm.url)\n\nDesc.`;
    const result = parsePage(md, "library", "uikit");
    expect(result.title).toBe("UIKit");
  });

  it("handles title with no badges", () => {
    const md = `# Simple Title\n\nContent.`;
    const result = parsePage(md, "guide", "simple");
    expect(result.title).toBe("Simple Title");
  });
});
