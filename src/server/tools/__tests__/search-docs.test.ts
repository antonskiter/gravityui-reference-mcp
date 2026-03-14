import { describe, it, expect } from "vitest";
import { handleSearchDocs } from "../search-docs.js";
import type { LoadedData } from "../../loader.js";
import type { Chunk } from "../../../types.js";
import MiniSearch from "minisearch";

function makeChunk(overrides: Partial<Chunk> & { id: string; page_id: string }): Chunk {
  return {
    url: "https://gravity-ui.com/test",
    page_title: "Test Page",
    page_type: "component",
    section_title: "Section",
    breadcrumbs: ["Test"],
    content: "test content",
    code_examples: [],
    keywords: ["test"],
    ...overrides,
  };
}

function buildTestData(chunks: Chunk[]): LoadedData {
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const ms = new MiniSearch({
    fields: ["page_title", "section_title", "keywords_joined", "content"],
    storeFields: ["id"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  ms.addAll(
    chunks.map((c) => ({
      id: c.id,
      page_title: c.page_title,
      section_title: c.section_title,
      keywords_joined: c.keywords.join(" "),
      content: c.content,
    })),
  );
  return { index: ms, chunkById } as unknown as LoadedData;
}

describe("handleSearchDocs deduplication", () => {
  it("returns only one result per page_id", () => {
    const chunks = [
      makeChunk({
        id: "library:md-editor:intro",
        page_id: "library:md-editor",
        page_title: "Markdown Editor",
        section_title: "Introduction",
        content: "markdown editor introduction getting started",
      }),
      makeChunk({
        id: "library:md-editor:install",
        page_id: "library:md-editor",
        page_title: "Markdown Editor",
        section_title: "Install",
        content: "markdown editor install npm",
      }),
      makeChunk({
        id: "library:md-editor:api",
        page_id: "library:md-editor",
        page_title: "Markdown Editor",
        section_title: "API",
        content: "markdown editor api reference",
      }),
      makeChunk({
        id: "component:uikit:TextInput:intro",
        page_id: "component:uikit:TextInput",
        page_title: "TextInput",
        section_title: "TextInput",
        content: "text input component for editing markdown",
      }),
    ];
    const data = buildTestData(chunks);
    const result = handleSearchDocs(data, { query: "markdown editor", limit: 5 });

    // Should only have 1 result from md-editor page, not 3
    const mdEditorResults = result.results.filter((r) =>
      r.section_id.startsWith("library:md-editor"),
    );
    expect(mdEditorResults).toHaveLength(1);

    // Should have diverse results
    expect(result.results.length).toBeGreaterThanOrEqual(2);
  });
});
