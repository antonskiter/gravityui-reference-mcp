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

describe("cleanMarkdownString", () => {
  it("removes HTML comments from content", () => {
    const md = `# Title\n\n<!--GITHUB_BLOCK-->\n\nSome content here.\n\n<!--/GITHUB_BLOCK-->`;
    const result = parsePage(md, "component", "Test");
    expect(result.cleanMarkdown).not.toContain("<!--");
    expect(result.cleanMarkdown).toContain("Some content here.");
  });

  it("removes image references from content", () => {
    const md = `# Title\n\n## Sizes\n\n![Sizes](/static/images/Button/sizes.png)\n\nEach button has four sizes.`;
    const result = parsePage(md, "guide", "Test");
    expect(result.cleanMarkdown).not.toContain("![");
    expect(result.cleanMarkdown).toContain("Each button has four sizes.");
  });

  it("removes linked images (badge pattern)", () => {
    const md = `# Title\n\n[![badge](https://img.shields.io/badge)](https://url)\n\nReal content.`;
    const result = parsePage(md, "library", "Test");
    expect(result.cleanMarkdown).not.toContain("badge");
    expect(result.cleanMarkdown).toContain("Real content.");
  });

  it("preserves headings for section splitting", () => {
    const md = `# Title\n\n## Section One\n\nContent one.\n\n## Section Two\n\nContent two.`;
    const result = parsePage(md, "component", "Test");
    expect(result.cleanMarkdown).toContain("## Section One");
    expect(result.cleanMarkdown).toContain("## Section Two");
  });

  it("preserves code blocks", () => {
    const md = "# Title\n\n```tsx\nconst x = 1;\n```\n\nText.";
    const result = parsePage(md, "component", "Test");
    expect(result.cleanMarkdown).toContain("```tsx");
  });

  it("collapses resulting blank lines", () => {
    const md = `# Title\n\n<!--comment-->\n\n\n\n<!--comment-->\n\nContent.`;
    const result = parsePage(md, "component", "Test");
    expect(result.cleanMarkdown).not.toMatch(/\n{4,}/);
  });
});
