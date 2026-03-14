import { describe, it, expect } from "vitest";
import { chunkPage } from "../chunk.js";
import { parsePage } from "../parse.js";

describe("chunk content sanitization", () => {
  it("stores clean text with markdown formatting stripped", () => {
    const md = "# Button\n\n## Props\n\nThe `size` prop controls **button size**. Use [Button docs](url) for more.";
    const parsed = parsePage(md, "component", "Button");
    const { chunks } = chunkPage(parsed, "component", "Button", "uikit");
    const propsChunk = chunks.find(c => c.section_title === "Props");
    expect(propsChunk).toBeDefined();
    expect(propsChunk!.content).toContain("size");
    expect(propsChunk!.content).not.toContain("**");
    expect(propsChunk!.content).toContain("Button docs");
    expect(propsChunk!.content).not.toContain("](url)");
  });

  it("converts tables to compact format during chunking", () => {
    const md = "# Comp\n\n## Props\n\n| Name | Type | Default | Description |\n| --- | --- | --- | --- |\n| size | `string` | `\"m\"` | Controls the size of the component |\n| variant | `string` | `\"primary\"` | Visual style variant to apply |";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const propsChunk = chunks.find(c => c.section_title === "Props");
    expect(propsChunk).toBeDefined();
    expect(propsChunk!.content).toContain("size");
    expect(propsChunk!.content).not.toContain("|");
  });
});

describe("junk chunk filtering", () => {
  it("filters out heading-only chunks", () => {
    const md = "# Comp\n\n## Properties\n\n## Usage\n\nActual usage content here that is long enough to pass the filter.";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const propsChunk = chunks.find(c => c.section_title === "Properties");
    expect(propsChunk).toBeUndefined();
    const usageChunk = chunks.find(c => c.section_title === "Usage");
    expect(usageChunk).toBeDefined();
  });

  it("keeps chunks with code examples even if content is short", () => {
    const md = "# Comp\n\n## Example\n\n```tsx\nconst x = 1;\n```";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const exampleChunk = chunks.find(c => c.section_title === "Example");
    expect(exampleChunk).toBeDefined();
  });

  it("filters non-Latin content chunks", () => {
    const md = "# Comp\n\n## Описание\n\nЭто описание компонента на русском языке достаточной длины для теста фильтрации.";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const russianChunk = chunks.find(c => c.section_title === "Описание");
    expect(russianChunk).toBeUndefined();
  });
});

describe("keyword deduplication", () => {
  it("does not include component name in keywords (already in page_title)", () => {
    const md = "# Button\n\n## Usage\n\nUse the button component for actions and triggering events in your application.";
    const parsed = parsePage(md, "component", "Button");
    const { chunks } = chunkPage(parsed, "component", "Button", "uikit");
    const chunk = chunks[0];
    expect(chunk).toBeDefined();
    // "Button" should NOT be in keywords — it's already in page_title with 3x boost
    expect(chunk!.keywords).not.toContain("Button");
    // Library should still be there
    expect(chunk!.keywords).toContain("uikit");
  });
});

describe("chunkPage with library sub-docs", () => {
  it("produces unique page_id for library sub-docs", () => {
    const md1 = "# Markdown Editor\n\nMain readme content.";
    const md2 = "# Getting Started\n\nHow to get started.";

    const parsed1 = parsePage(md1, "library", "markdown-editor");
    const parsed2 = parsePage(md2, "library", "markdown-editor/docs/getting-started");

    const result1 = chunkPage(parsed1, "library", "markdown-editor", "markdown-editor");
    const result2 = chunkPage(parsed2, "library", "markdown-editor/docs/getting-started", "markdown-editor");

    expect(result1.page_id).not.toBe(result2.page_id);
    expect(result1.page_id).toBe("library:markdown-editor");
    expect(result2.page_id).toBe("library:markdown-editor:markdown-editor/docs/getting-started");
  });
});
