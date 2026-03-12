import { describe, it, expect } from "vitest";
import { buildIndex, searchIndex, serializeIndex, deserializeIndex } from "../src/ingest/index.js";
import type { Chunk } from "../src/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeChunk(overrides: Partial<Chunk> & { id: string }): Chunk {
  return {
    page_id: "component:uikit:Button",
    url: "https://gravity-ui.com/components/uikit/button",
    page_title: "Button",
    page_type: "component",
    library: "uikit",
    section_title: "Overview",
    breadcrumbs: ["Button"],
    content: "A clickable button component used to trigger actions.",
    code_examples: [],
    keywords: ["Button", "uikit"],
    ...overrides,
  };
}

const buttonChunk = makeChunk({
  id: "component:uikit:Button:overview",
  page_title: "Button",
  section_title: "Overview",
  content: "A clickable button component used to trigger actions.",
  keywords: ["Button", "uikit", "click"],
});

const selectChunk = makeChunk({
  id: "component:uikit:Select:overview",
  page_id: "component:uikit:Select",
  page_title: "Select",
  section_title: "Overview",
  content: "A dropdown select component for picking one option from a list.",
  keywords: ["Select", "uikit", "dropdown"],
});

// A chunk whose content mentions "button" but whose page_title is "TextInput"
const textInputChunk = makeChunk({
  id: "component:uikit:TextInput:overview",
  page_id: "component:uikit:TextInput",
  page_title: "TextInput",
  section_title: "Overview",
  content: "Use instead of a button to get inline text input from the user.",
  keywords: ["TextInput", "uikit", "input"],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildIndex", () => {
  it("creates a searchable index from chunks", () => {
    const index = buildIndex([buttonChunk, selectChunk]);
    // Should return some results for a known term
    const results = searchIndex(index, "button");
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("component:uikit:Button:overview");
  });

  it("returns empty results for an unknown term", () => {
    const index = buildIndex([buttonChunk, selectChunk]);
    const results = searchIndex(index, "zzzyyyxxx");
    expect(results).toHaveLength(0);
  });
});

describe("searchIndex", () => {
  it("returns matching results ranked by score", () => {
    const index = buildIndex([buttonChunk, selectChunk, textInputChunk]);
    const results = searchIndex(index, "dropdown select");
    expect(results.length).toBeGreaterThan(0);
    // selectChunk should appear first or at least be present
    const ids = results.map((r) => r.id);
    expect(ids).toContain("component:uikit:Select:overview");
    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("respects the limit parameter", () => {
    const chunks = [buttonChunk, selectChunk, textInputChunk];
    const index = buildIndex(chunks);
    // "uikit" is in all keywords — should match all three
    const resultsAll = searchIndex(index, "uikit", 10);
    const resultsLimited = searchIndex(index, "uikit", 1);
    expect(resultsLimited.length).toBeLessThanOrEqual(1);
    expect(resultsAll.length).toBeGreaterThanOrEqual(resultsLimited.length);
  });
});

describe("fuzzy matching", () => {
  it("finds Button when searching for typo 'buton'", () => {
    const index = buildIndex([buttonChunk, selectChunk]);
    const results = searchIndex(index, "buton");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("component:uikit:Button:overview");
  });
});

describe("field boosting", () => {
  it("ranks page_title:Button higher than content-only mention of button", () => {
    // buttonChunk has page_title "Button"
    // textInputChunk has page_title "TextInput" but content mentions "button"
    const index = buildIndex([textInputChunk, buttonChunk]);
    const results = searchIndex(index, "button");
    expect(results.length).toBeGreaterThanOrEqual(2);
    const buttonResult = results.find((r) => r.id === "component:uikit:Button:overview");
    const textInputResult = results.find((r) => r.id === "component:uikit:TextInput:overview");
    expect(buttonResult).toBeDefined();
    expect(textInputResult).toBeDefined();
    // page_title boost of 3 should make buttonChunk score higher
    expect(buttonResult!.score).toBeGreaterThan(textInputResult!.score);
  });
});

describe("serialization", () => {
  it("round-trips through serializeIndex / deserializeIndex", () => {
    const index = buildIndex([buttonChunk, selectChunk]);
    const json = serializeIndex(index);
    expect(typeof json).toBe("string");
    const restored = deserializeIndex(json);
    const results = searchIndex(restored, "button");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("component:uikit:Button:overview");
  });
});
