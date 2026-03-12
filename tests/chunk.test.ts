import { describe, it, expect } from "vitest";
import { chunkPage } from "../src/ingest/chunk.js";
import type { ParseResult } from "../src/ingest/parse.js";

// Helper to build a ParseResult
function makeResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    title: "Button",
    description: "Buttons are used to trigger actions.",
    cleanMarkdown: "",
    headings: [],
    ...overrides,
  };
}

const markdownWithH2Sections = `
# Button

Intro paragraph.

## Variants

There are several button variants available.

## Sizes

Buttons come in multiple sizes.

## API

Full API reference here.
`.trim();

const markdownWithCodeBlocks = `
# Select

## Usage

Use the Select component like this:

\`\`\`tsx
import {Select} from '@gravity-ui/uikit';

<Select options={options} value={value} onUpdate={setValue} />
\`\`\`

More details follow.
`.trim();

const markdownWithH3Sections = (content: string) => `
# Button

## Overview

${content}

### Appearance

Details about appearance.

### Behavior

Details about behavior.
`.trim();

// Large content to trigger h3 splitting (> 3000 chars)
const largeContent = "a ".repeat(1600); // 3200 chars

describe("chunkPage", () => {
  it("splits markdown at h2 boundaries", () => {
    const parsed = makeResult({
      cleanMarkdown: markdownWithH2Sections,
      headings: [
        { depth: 2, text: "Variants" },
        { depth: 2, text: "Sizes" },
        { depth: 2, text: "API" },
      ],
    });
    const { chunks } = chunkPage(parsed, "guide", "button");
    const titles = chunks.map((c) => c.section_title);
    expect(titles).toContain("Variants");
    expect(titles).toContain("Sizes");
    expect(titles).toContain("API");
  });

  it("generates stable IDs for guide pages", () => {
    const parsed = makeResult({
      cleanMarkdown: markdownWithH2Sections,
      headings: [{ depth: 2, text: "Variants" }],
    });
    const { chunks } = chunkPage(parsed, "guide", "button");
    const variantsChunk = chunks.find((c) => c.section_title === "Variants");
    expect(variantsChunk).toBeDefined();
    expect(variantsChunk!.id).toBe("guide:button:variants");
  });

  it("generates stable IDs for component pages with library", () => {
    const parsed = makeResult({
      cleanMarkdown: markdownWithH2Sections,
      headings: [{ depth: 2, text: "API" }],
    });
    const { chunks } = chunkPage(parsed, "component", "Button", "uikit");
    const apiChunk = chunks.find((c) => c.section_title === "API");
    expect(apiChunk).toBeDefined();
    expect(apiChunk!.id).toBe("component:uikit:Button:api");
    expect(apiChunk!.library).toBe("uikit");
  });

  it("deduplicates slugs by appending -2, -3", () => {
    const duplicateMd = `
# Button

## Usage

First usage section.

## Usage

Second usage section.
`.trim();
    const parsed = makeResult({
      cleanMarkdown: duplicateMd,
      headings: [
        { depth: 2, text: "Usage" },
        { depth: 2, text: "Usage" },
      ],
    });
    const { chunks } = chunkPage(parsed, "guide", "button");
    const usageChunks = chunks.filter((c) => c.section_title === "Usage");
    expect(usageChunks).toHaveLength(2);
    const ids = usageChunks.map((c) => c.id);
    expect(ids).toContain("guide:button:usage");
    expect(ids).toContain("guide:button:usage-2");
  });

  it("extracts code blocks into code_examples array", () => {
    const parsed = makeResult({
      cleanMarkdown: markdownWithCodeBlocks,
      headings: [{ depth: 2, text: "Usage" }],
    });
    const { chunks } = chunkPage(parsed, "component", "Select", "uikit");
    const usageChunk = chunks.find((c) => c.section_title === "Usage");
    expect(usageChunk).toBeDefined();
    expect(usageChunk!.code_examples.length).toBeGreaterThan(0);
    expect(usageChunk!.code_examples[0]).toContain("import {Select}");
    // content should not contain the raw fenced code block
    expect(usageChunk!.content).not.toContain("```tsx");
  });

  it("extracts keywords from component name and heading", () => {
    const parsed = makeResult({
      cleanMarkdown: markdownWithH2Sections,
      headings: [{ depth: 2, text: "Variants" }],
    });
    const { chunks } = chunkPage(parsed, "component", "Button", "uikit");
    const variantsChunk = chunks.find((c) => c.section_title === "Variants");
    expect(variantsChunk).toBeDefined();
    expect(variantsChunk!.keywords).toContain("Button");
    expect(variantsChunk!.keywords).toContain("variants");
    expect(variantsChunk!.keywords).toContain("uikit");
  });

  it("further splits h2 sections at h3 when section exceeds 3000 chars", () => {
    const md = markdownWithH3Sections(largeContent);
    const parsed = makeResult({
      cleanMarkdown: md,
      headings: [
        { depth: 2, text: "Overview" },
        { depth: 3, text: "Appearance" },
        { depth: 3, text: "Behavior" },
      ],
    });
    const { chunks } = chunkPage(parsed, "guide", "button");
    const titles = chunks.map((c) => c.section_title);
    expect(titles).toContain("Appearance");
    expect(titles).toContain("Behavior");
  });
});
