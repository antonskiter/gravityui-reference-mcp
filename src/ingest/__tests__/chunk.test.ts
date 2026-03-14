import { describe, it, expect } from "vitest";
import { chunkPage } from "../chunk.js";
import { parsePage } from "../parse.js";

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
