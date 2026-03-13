import { describe, it, expect } from "vitest";
import { levenshtein, SYNONYM_MAP, generateTagsForComponent, tokenizeAndClean, expandCompoundTags } from "../src/ingest/tags.js";
import type { Page, Chunk } from "../src/types.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("button", "button")).toBe(0);
  });

  it("returns correct distance for similar strings", () => {
    expect(levenshtein("button", "buton")).toBe(1);
    expect(levenshtein("select", "selct")).toBe(1);
  });

  it("returns string length for empty comparison", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("tokenizeAndClean", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenizeAndClean("Date Range Selection")).toEqual(["date", "range", "selection"]);
  });

  it("removes stop words", () => {
    const result = tokenizeAndClean("a component for the table");
    expect(result).not.toContain("a");
    expect(result).not.toContain("for");
    expect(result).not.toContain("the");
    expect(result).toContain("table");
  });

  it("removes single-character tokens", () => {
    expect(tokenizeAndClean("a b table")).toEqual(["table"]);
  });

  it("preserves hyphenated terms like date-picker", () => {
    const result = tokenizeAndClean("date-picker component");
    expect(result).toContain("date-picker");
  });
});

describe("expandCompoundTags", () => {
  it("splits compound tags into individual words", () => {
    const result = expandCompoundTags(["date-picker", "button"]);
    expect(result).toContain("date-picker");
    expect(result).toContain("date");
    expect(result).toContain("picker");
    expect(result).toContain("button");
  });

  it("deduplicates expanded tags", () => {
    const result = expandCompoundTags(["date-picker", "date"]);
    const counts = result.filter(t => t === "date").length;
    expect(counts).toBe(1);
  });
});

describe("SYNONYM_MAP", () => {
  it("has synonyms for common component types", () => {
    expect(SYNONYM_MAP["select"]).toContain("dropdown");
    expect(SYNONYM_MAP["button"]).toContain("action");
    expect(SYNONYM_MAP["dialog"]).toContain("modal");
    expect(SYNONYM_MAP["table"]).toContain("grid");
    expect(SYNONYM_MAP["date"]).toContain("calendar");
    expect(SYNONYM_MAP["checkbox"]).toContain("toggle");
  });
});

describe("generateTagsForComponent", () => {
  const page: Page = {
    id: "component:uikit:Select",
    title: "Select",
    page_type: "component",
    library: "uikit",
    url: "https://gravity-ui.com/components/uikit/select",
    breadcrumbs: ["Select"],
    description: "A dropdown select component.",
    section_ids: ["component:uikit:Select:select", "component:uikit:Select:properties", "component:uikit:Select:filtering-options"],
  };

  const introChunk: Chunk = {
    id: "component:uikit:Select:select",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Select",
    breadcrumbs: ["Select"],
    content: "Select is a control that provides a list of options that a user can select.",
    code_examples: [],
    keywords: ["select", "uikit"],
  };

  const propsChunk: Chunk = {
    id: "component:uikit:Select:properties",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Properties",
    breadcrumbs: ["Select", "Properties"],
    content: "| Name | Description |\n| multiple | Allow multiple selections |\n| disabled | Disable the select |\n| filterable | Enable filtering |",
    code_examples: [],
    keywords: ["select", "properties"],
  };

  const filterChunk: Chunk = {
    id: "component:uikit:Select:filtering-options",
    page_id: "component:uikit:Select",
    url: "https://gravity-ui.com/components/uikit/select",
    page_title: "Select",
    page_type: "component",
    library: "uikit",
    section_title: "Filtering options",
    breadcrumbs: ["Select", "Filtering options"],
    content: "You can filter options by typing in the select control.",
    code_examples: [],
    keywords: ["select", "filtering"],
  };

  const chunks = [introChunk, propsChunk, filterChunk];

  it("includes the component name lowercased as a tag", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("select");
  });

  it("includes synonyms for the component name", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("dropdown");
    expect(tags).toContain("picker");
    expect(tags).toContain("combobox");
  });

  it("extracts tags from section titles", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("filtering");
  });

  it("extracts tags from description", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("options");
  });

  it("extracts capability tags from prop names", () => {
    const tags = generateTagsForComponent(page, chunks);
    expect(tags).toContain("multi-select");
  });

  it("deduplicates tags", () => {
    const tags = generateTagsForComponent(page, chunks);
    const uniqueTags = new Set(tags);
    expect(tags.length).toBe(uniqueTags.size);
  });
});
