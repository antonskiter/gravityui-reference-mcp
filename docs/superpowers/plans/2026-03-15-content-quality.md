# Content Quality & Output Formatting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all content cleaning to ingestion (store clean data), simplify output formatting to dumb pipes.

**Architecture:** String-based markdown cleanup in parse.ts, sanitize during chunking in chunk.ts, filter junk chunks, then remove all sanitize/compactTable calls from tool format functions and handlers. Add indent() helper for multi-line output.

**Tech Stack:** TypeScript, vitest, remark/strip-markdown (existing deps)

**Spec:** `docs/superpowers/specs/2026-03-15-content-quality-design.md`

---

## File Structure

**Modified files:**
- `src/ingest/parse.ts` — add `cleanMarkdownString()`, apply to pipeline
- `src/ingest/chunk.ts` — sanitize content during chunking, filter junk chunks, keyword dedup
- `src/ingest/overview.ts` — sanitize overview fields
- `src/server/format.ts` — add `indent()` helper
- `src/server/tools/search-docs.ts` — remove sanitize, fix indentation, add separators
- `src/server/tools/get-component-reference.ts` — remove sanitize/compactTable from handler+format
- `src/server/tools/get-section.ts` — remove sanitize/compactTable from handler+format
- `src/server/tools/get-page.ts` — remove sanitize from format
- `src/server/tools/get-design-system-overview.ts` — remove sanitize from format, fix indentation
- `src/server/tools/suggest-component.ts` — fix indentation

**Test files:**
- `src/ingest/__tests__/parse.test.ts` — add cleanMarkdownString tests
- `src/ingest/__tests__/chunk.test.ts` — add sanitize + filter tests
- `tests/eval.test.ts` — update eval assertions

---

## Chunk 1: Ingestion Cleanup

### Task 1: Add cleanMarkdownString to parse.ts

**Files:**
- Modify: `src/ingest/parse.ts`
- Test: `src/ingest/__tests__/parse.test.ts`

- [ ] **Step 1: Write failing tests for cleanMarkdownString**

Add to `src/ingest/__tests__/parse.test.ts`:

```typescript
describe("cleanMarkdownString", () => {
  // Import the function — it needs to be exported for testing
  // We test via parsePage since cleanMarkdownString is internal

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

  it("removes image-only lines", () => {
    const md = `# Title\n\n[![badge](https://img.shields.io/badge)](url)\n\nReal content.`;
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ingest/__tests__/parse.test.ts`
Expected: FAIL — cleanMarkdown still contains HTML comments and images

- [ ] **Step 3: Implement cleanMarkdownString**

In `src/ingest/parse.ts`, add this function before `parsePage`:

```typescript
/**
 * Remove junk from markdown string before parsing/chunking.
 * Operates on the string (not AST) to avoid remark-stringify dependency.
 */
function cleanMarkdownString(md: string): string {
  return md
    // Remove HTML comments (single and multi-line)
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove image references: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Remove linked images: [![alt](img-url)](link-url)
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    // Remove lines that are only whitespace after cleanup
    .replace(/^\s+$/gm, "")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

Then modify `parsePage` to call it:

```typescript
export function parsePage(
  rawContent: string,
  pageType: PageType,
  name: string,
): ParseResult {
  const stripped = stripMdx(rawContent);
  const cleanMarkdown = cleanMarkdownString(stripped);
  const tree = parseMarkdown(cleanMarkdown);

  const title = extractTitle(tree) ?? name;
  const description = extractDescription(tree);
  const headings = extractHeadings(tree);

  return { title, description, cleanMarkdown, headings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingest/__tests__/parse.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/parse.ts src/ingest/__tests__/parse.test.ts
git commit -m "feat: add cleanMarkdownString to strip HTML comments and images during ingestion"
```

---

### Task 2: Sanitize content during chunking and filter junk chunks

**Files:**
- Modify: `src/ingest/chunk.ts`
- Test: `src/ingest/__tests__/chunk.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/ingest/__tests__/chunk.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { chunkPage } from "../chunk.js";
import { parsePage } from "../parse.js";

describe("chunk content sanitization", () => {
  it("stores clean text with inline code preserved", () => {
    const md = "# Button\n\n## Props\n\nThe `size` prop controls **button size**. Use [Button docs](url) for more.";
    const parsed = parsePage(md, "component", "Button");
    const { chunks } = chunkPage(parsed, "component", "Button", "uikit");
    const propsChunk = chunks.find(c => c.section_title === "Props");
    expect(propsChunk).toBeDefined();
    // Should keep inline code
    expect(propsChunk!.content).toContain("`size`");
    // Should strip bold markers
    expect(propsChunk!.content).not.toContain("**");
    // Should strip link URL, keep text
    expect(propsChunk!.content).toContain("Button docs");
    expect(propsChunk!.content).not.toContain("](url)");
  });

  it("converts tables to compact format during chunking", () => {
    const md = "# Comp\n\n## Props\n\n| Name | Type | Default |\n| --- | --- | --- |\n| size | `string` | `\"m\"` |";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const propsChunk = chunks.find(c => c.section_title === "Props");
    expect(propsChunk).toBeDefined();
    // compactTable format: "name: type = default"
    expect(propsChunk!.content).toContain("size");
    // Should not contain pipe characters from table
    expect(propsChunk!.content).not.toContain("|");
  });
});

describe("junk chunk filtering", () => {
  it("filters out heading-only chunks", () => {
    const md = "# Comp\n\n## Properties\n\n## Usage\n\nActual usage content here that is long enough.";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    // "Properties" section has no content — should be filtered
    const propsChunk = chunks.find(c => c.section_title === "Properties");
    expect(propsChunk).toBeUndefined();
    // "Usage" section has content — should remain
    const usageChunk = chunks.find(c => c.section_title === "Usage");
    expect(usageChunk).toBeDefined();
  });

  it("keeps chunks with code examples even if content is short", () => {
    const md = "# Comp\n\n## Example\n\n```tsx\n<Button />\n```";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const exampleChunk = chunks.find(c => c.section_title === "Example");
    expect(exampleChunk).toBeDefined();
  });

  it("filters non-Latin content chunks", () => {
    const md = "# Comp\n\n## Описание\n\nЭто описание компонента на русском языке достаточной длины.";
    const parsed = parsePage(md, "component", "Comp");
    const { chunks } = chunkPage(parsed, "component", "Comp", "uikit");
    const russianChunk = chunks.find(c => c.section_title === "Описание");
    expect(russianChunk).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ingest/__tests__/chunk.test.ts`
Expected: FAIL — content not sanitized, junk not filtered

- [ ] **Step 3: Implement sanitization and filtering in chunkPage**

In `src/ingest/chunk.ts`, add import and helpers:

```typescript
import { sanitize } from "../server/format.js";
```

Add junk detection helpers before `chunkPage`:

```typescript
/** Check if content is predominantly non-Latin (Cyrillic, CJK, etc.) */
function isNonLatin(text: string): boolean {
  const alphaChars = text.replace(/[^a-zA-Zа-яёА-ЯЁ\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, "");
  if (alphaChars.length === 0) return false;
  const latinChars = text.replace(/[^a-zA-Z]/g, "").length;
  return latinChars / alphaChars.length < 0.5;
}

/** Check if a chunk has enough value to keep */
function isJunkChunk(content: string, codeExamples: string[]): boolean {
  const hasCode = codeExamples.some(e => e.trim().length > 0);
  if (hasCode) return false;
  if (content.trim().length < 30) return true;
  if (isNonLatin(content)) return true;
  return false;
}
```

Then in the `chunkPage` function, after `extractCodeBlocks` and before pushing to chunks array, add sanitization and filtering. Modify the chunk creation loop:

```typescript
    const { content: rawContent, codeExamples } = extractCodeBlocks(section.body);
    const content = sanitize(rawContent);

    if (isJunkChunk(content, codeExamples)) continue;

    const keywords = extractKeywords(name, section.title, library);
    // ... rest of chunk creation
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingest/__tests__/chunk.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/chunk.ts src/ingest/__tests__/chunk.test.ts
git commit -m "feat: sanitize chunk content during ingestion and filter junk chunks"
```

---

### Task 3: Keyword deduplication

**Files:**
- Modify: `src/ingest/chunk.ts`
- Test: `src/ingest/__tests__/chunk.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/ingest/__tests__/chunk.test.ts`:

```typescript
describe("keyword deduplication", () => {
  it("does not include component name in keywords (already in page_title)", () => {
    const md = "# Button\n\n## Usage\n\nUse the button component for actions.";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ingest/__tests__/chunk.test.ts`
Expected: FAIL — keywords still contain "Button"

- [ ] **Step 3: Remove name from extractKeywords**

In `src/ingest/chunk.ts`, modify `extractKeywords`:

```typescript
function extractKeywords(
  name: string,
  sectionTitle: string,
  library?: string,
): string[] {
  const keywords: string[] = [];

  // Don't add name — it's already in page_title with 3x boost

  // Library name
  if (library) {
    keywords.push(library);
  }

  // Words from the section title, lower-cased, stop-words filtered
  const titleWords = sectionTitle
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  keywords.push(...titleWords);

  // Deduplicate while preserving order
  return [...new Set(keywords)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ingest/__tests__/chunk.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/chunk.ts src/ingest/__tests__/chunk.test.ts
git commit -m "fix: remove component name from keywords to reduce boost stacking"
```

---

### Task 4: Clean overview fields

**Files:**
- Modify: `src/ingest/overview.ts`

- [ ] **Step 1: Read overview.ts to understand field population**

Read `src/ingest/overview.ts` to confirm where `system.*` and `libraries[].purpose` fields come from.

- [ ] **Step 2: Add sanitize import and apply to overview fields**

In `src/ingest/overview.ts`, add:

```typescript
import { sanitize } from "../server/format.js";
```

Then wrap `system.*` fields and `purpose` field with `sanitize()` where they are populated. The `system.*` fields come from chunk content (which is now pre-sanitized in Task 2), so they should already be clean. But `purpose` comes from `page.description` — wrap it:

```typescript
purpose: sanitize(libPage.description || libPage.title),
```

- [ ] **Step 3: Run build-index to verify no errors**

Run: `npx vitest run src/ingest/__tests__/ && npm run build-index`
Expected: Tests pass, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/ingest/overview.ts
git commit -m "fix: sanitize overview fields during ingestion"
```

---

### Task 5: Rebuild index and verify

- [ ] **Step 1: Rebuild the index**

Run: `npm run build-index`
Expected: Fewer chunks than before (was 2334), no errors

- [ ] **Step 2: Run eval tests**

Run: `npx vitest run tests/eval.test.ts`
Expected: Existing tests pass. Note any changes in counts.

- [ ] **Step 3: Commit rebuilt data**

```bash
git add data/
git commit -m "data: rebuild index with clean content and junk filtering"
```

---

## Chunk 2: Output Formatting

### Task 6: Add indent() helper

**Files:**
- Modify: `src/server/format.ts`

- [ ] **Step 1: Add indent function**

In `src/server/format.ts`, add:

```typescript
/** Indent all lines of multi-line text. Empty lines stay empty. */
export function indent(text: string, prefix = "   "): string {
  return text.split("\n").map(line => line ? prefix + line : "").join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/format.ts
git commit -m "feat: add indent() helper for multi-line output formatting"
```

---

### Task 7: Clean up search-docs format

**Files:**
- Modify: `src/server/tools/search-docs.ts`

- [ ] **Step 1: Remove sanitize import and call, add indent, add separators**

```typescript
// Remove: import { sanitize } from "../format.js";
// Add:    import { indent } from "../format.js";
```

In `formatSearchDocs`, replace:
```typescript
lines.push(`   ${sanitize(r.snippet)}`);
```
with:
```typescript
lines.push(indent(r.snippet));
```

And add empty line between result blocks — after the `Section:` line, push `""`:

```typescript
results.forEach((r, i) => {
  const lib = r.library ? `, ${r.library}` : "";
  lines.push(`${i + 1}. ${r.page_title} (${r.page_type}${lib}) score: ${Math.min(100, Math.round(r.score))}`);
  lines.push(indent(r.snippet));
  lines.push(`   Section: ${r.section_id} | ${r.url}`);
  if (i < results.length - 1) lines.push(""); // separator
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/server/tools/search-docs.ts
git commit -m "refactor: remove sanitize from search format, add indent and separators"
```

---

### Task 8: Clean up get-component-reference

**Files:**
- Modify: `src/server/tools/get-component-reference.ts`

- [ ] **Step 1: Remove sanitize and compactTable from handler and format**

In the handler `handleGetComponentReference`:
- Remove `compactTable()` calls on lines 86, 97, 105, 117 — replace with bare field access
- `result.props = propsChunk.content;` (was `compactTable(propsChunk.content)`)
- `content: c.content,` (was `compactTable(c.content)`)
- `result.css_api = cssChunk.content;` (was `compactTable(cssChunk.content)`)

In the format `formatGetComponentReference`:
- Replace `sanitize(result.props)` with `result.props`
- Replace `sanitize(s.content)` with `s.content`
- Replace `sanitize(g.content)` with `g.content`
- Replace `sanitize(result.css_api)` with `result.css_api`
- Wrap all multi-line content fields with `indent()`

Update imports:
```typescript
// Remove: import { codeBlock, compactTable, sanitize } from "../format.js";
// Add:    import { codeBlock, indent } from "../format.js";
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/server/tools/get-component-reference.ts
git commit -m "refactor: remove sanitize/compactTable from component reference, add indent"
```

---

### Task 9: Clean up get-section

**Files:**
- Modify: `src/server/tools/get-section.ts`

- [ ] **Step 1: Remove compactTable from handler, sanitize from format**

Read the file first to find exact locations, then:
- Handler: replace `compactTable(chunk.content)` with `chunk.content`
- Format: replace `sanitize(...)` with bare field, wrap with `indent()` where multi-line

Update imports to remove `sanitize` and `compactTable`, add `indent` if needed.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/server/tools/get-section.ts
git commit -m "refactor: remove sanitize/compactTable from get-section, add indent"
```

---

### Task 10: Clean up remaining format functions

**Files:**
- Modify: `src/server/tools/get-page.ts`
- Modify: `src/server/tools/get-design-system-overview.ts`
- Modify: `src/server/tools/suggest-component.ts`

- [ ] **Step 1: Fix get-page.ts**

Read file, find `sanitize(s.summary)`, replace with `s.summary`. Add `indent()` if the summary is on its own line.

- [ ] **Step 2: Fix get-design-system-overview.ts**

Read file, find all `sanitize(system.*)` calls (6 instances), replace with bare field access. Wrap with `indent()` since these are multi-line. Update imports.

- [ ] **Step 3: Fix suggest-component.ts**

Read file, find description output. Wrap with `indent()` for multi-line safety. The description comes from `page.description` which is now pre-cleaned.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/get-page.ts src/server/tools/get-design-system-overview.ts src/server/tools/suggest-component.ts
git commit -m "refactor: remove sanitize from remaining format functions, add indent"
```

---

## Chunk 3: Eval Tests & Verification

### Task 11: Update eval tests

**Files:**
- Modify: `tests/eval.test.ts`

- [ ] **Step 1: Convert .todo tests to passing assertions**

Replace the two `.todo` lines:

```typescript
it("snippets do not contain raw markdown image syntax", () => {
  const result = handleSearchDocs(data, { query: "button component", limit: 10 });
  for (const r of result.results) {
    expect(r.snippet).not.toMatch(/!\[/);
  }
});

it("formatted output does not contain broken markdown links", () => {
  const result = handleSearchDocs(data, { query: "graph documentation", limit: 5 });
  const formatted = formatSearchDocs(result);
  expect(formatted).not.toMatch(/\[(?![^\]]*\])/);
});
```

- [ ] **Step 2: Add new content quality assertions**

```typescript
describe("content cleanliness", () => {
  it("no chunks contain HTML comments", () => {
    for (const chunk of data.chunks) {
      expect(chunk.content).not.toMatch(/<!--/);
    }
  });

  it("no chunks contain image references", () => {
    for (const chunk of data.chunks) {
      expect(chunk.content).not.toMatch(/!\[/);
    }
  });

  it("no chunks contain raw markdown heading syntax", () => {
    for (const chunk of data.chunks) {
      expect(chunk.content).not.toMatch(/^#{1,3}\s/m);
    }
  });

  it("no chunks under 30 chars without code", () => {
    for (const chunk of data.chunks) {
      const hasCode = chunk.code_examples.some(e => e.trim().length > 0);
      if (!hasCode) {
        expect(chunk.content.trim().length).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("chunk count reduced from pre-cleanup baseline", () => {
    // Was 2334 before cleanup
    expect(data.chunks.length).toBeLessThan(2334);
    // But should still have substantial content
    expect(data.chunks.length).toBeGreaterThan(1500);
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run tests/eval.test.ts`
Expected: All pass (including the 2 previously-todo tests)

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add tests/eval.test.ts
git commit -m "test: update eval tests for content quality — all assertions passing"
```
