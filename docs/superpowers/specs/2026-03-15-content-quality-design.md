# Content Quality & Output Formatting

## Problem Statement

The MCP server has two interconnected quality problems:

1. **Raw markdown stored in chunks** — `chunk.content` contains unsanitized markdown (headings, HTML comments, image refs, link syntax). This pollutes the search index and leaks through to output. ~15% of chunks are junk (heading-only, HTML artifacts, under 30 chars).

2. **Broken output formatting** — 14 instances across 6 format functions where multi-line content loses indentation. 3 tools serve unsanitized `description` fields. No separators between result blocks.

**Root cause:** Cleaning happens at output time via `sanitize()` calls in format functions — inconsistently applied, too late for the search index, and structurally wrong.

**Fix principle:** All cleaning moves to ingestion. Format functions become dumb pipes — arrange, indent, join. No transformation.

## Part 1: Ingestion Cleanup

### 1A. AST-based content cleaning

**File:** `src/ingest/parse.ts`

Add a `cleanAst(tree: Root): Root` function called after `parseMarkdown()` and before any content extraction. It removes junk nodes from the MDAST:

- `html` nodes — kills `<!--GITHUB_BLOCK-->`, `<!--LANDING_BLOCK-->`, all HTML comments (320 chunks affected)
- `image` and `imageReference` nodes — kills `![alt](url)` references (~50+ chunks)
- Paragraphs containing only images/links with no text content — badge rows, shield rows
- Does NOT remove: headings (needed for section splitting), links with text (keep text, strip URL later via sanitize), code nodes

This must run before `extractTitle()`, `extractDescription()`, `extractHeadings()` and before the markdown is passed to `chunkPage()`.

The cleaned AST is stringified back to markdown using `remark-stringify` for downstream processing (section splitting, code extraction).

### 1B. Sanitize content during chunking

**File:** `src/ingest/chunk.ts`

After `extractCodeBlocks()` produces the `content` string, apply `sanitize()` to it before storing in the chunk. The existing `sanitize()` function with `strip-markdown` configured to `keep: ["code"]` does exactly what we need:

- Strips bold/italic/link decorators
- Keeps inline `` `code` `` (valuable for Claude — signals API names, props, types)
- Converts tables to compact format via `compactTable()`
- Cleans up escaped characters, collapses blank lines

After sanitize, the content is clean prose with inline code. This is what gets stored in `chunk.content` and indexed by MiniSearch.

### 1C. Filter junk chunks

**File:** `src/ingest/chunk.ts`

After content sanitization, drop chunks that have no value:

- `content.trim().length < 30` AND `code_examples` is empty or all-whitespace
- Content is predominantly non-Latin characters (>50% of alpha chars are Cyrillic/CJK) — 88 chunks of Russian content

Apply this filter at the end of `chunkPage()` before returning chunks.

### 1D. Fix code block extraction

**File:** `src/ingest/chunk.ts`

The regex `/```[\s\S]*?```/g` in `extractCodeBlocks()` fails when HTML comments sit between code fences. Since HTML comments are now removed in `cleanAst()` (1A), this fixes itself. No code change needed here — just dependency on 1A running first.

### 1E. Clean page.description and overview fields

**File:** `src/ingest/run-build.ts` (or in `parse.ts` for description)

- `page.description` — apply `sanitize()` during `parsePage()` after extracting description text
- `overview.system.*` fields — apply `sanitize()` in `generateOverview()`
- `overview.libraries[].purpose` — apply `sanitize()` in `generateOverview()`

After this, every stored text field is pre-cleaned.

### 1F. Reduce keyword boost stacking

**File:** `src/ingest/chunk.ts`

In `extractKeywords()`, stop adding `name` to keywords — it's already in `page_title` with 3x boost. Remove the `keywords.push(name)` line. Keep library and section title words.

Current effective boost for component name: 3 (title) + 2 (keywords) + 1 (content) = 6x.
After fix: 3 (title) + 1 (content if mentioned) = 4x max. More balanced.

### 1G. Rebuild index

After all ingestion changes, run `npm run build-index` to rebuild. Expected results:

- ~15% fewer chunks (junk filtered out)
- Cleaner search scores (no markdown syntax inflation)
- All content fields contain clean prose with inline code
- No HTML comments, image refs, or badge text in the index

## Part 2: Output Formatting

### 2A. Add `indent()` helper

**File:** `src/server/format.ts`

```typescript
export function indent(text: string, prefix = "   "): string {
  return text.split("\n").map(line => prefix + line).join("\n");
}
```

### 2B. Remove all `sanitize()` calls from format functions

Since data is now pre-cleaned (Part 1), remove:

| File | What to remove |
|------|----------------|
| `search-docs.ts` | `sanitize(r.snippet)` → `r.snippet` |
| `get-component-reference.ts` | `sanitize(result.props)` → `result.props` |
| `get-component-reference.ts` | `sanitize(s.content)` → `s.content` |
| `get-component-reference.ts` | `sanitize(g.content)` → `g.content` |
| `get-component-reference.ts` | `sanitize(result.css_api)` → `result.css_api` |
| `get-section.ts` | `sanitize(result.content)` → `result.content` |
| `get-page.ts` | `sanitize(s.summary)` → `s.summary` |

Also remove `compactTable()` calls from `get-component-reference.ts` — tables are already compacted during ingestion.

Remove `import { sanitize }` and `import { compactTable }` from tool files that no longer need them.

### 2C. Fix multi-line indentation (14 instances)

Replace `lines.push(\`   ${content}\`)` with `lines.push(indent(content))` in:

1. `search-docs.ts:85` — snippet
2. `get-component-reference.ts:135` — props
3. `get-component-reference.ts:153` — section content
4. `get-component-reference.ts:163` — guide content
5. `get-component-reference.ts:168` — CSS API
6. `get-design-system-overview.ts:38` — description
7. `get-design-system-overview.ts:41` — theming
8. `get-design-system-overview.ts:44` — spacing
9. `get-design-system-overview.ts:47` — typography
10. `get-design-system-overview.ts:50` — corner_radius
11. `get-design-system-overview.ts:53` — branding
12. `get-section.ts:74` — content
13. `get-page.ts:78` — summary
14. `suggest-component.ts:148` — description

### 2D. Add result separators in search output

**File:** `search-docs.ts`

Add empty line between each result block in `formatSearchDocs()` so results don't visually collapse:

```
1. Title (type, library) score: 80
   Snippet text here...
   Section: id | url

2. Title (type, library) score: 75
   Snippet text here...
   Section: id | url
```

## Testing Strategy

1. **Update eval tests** — convert the 2 `.todo` tests to passing assertions
2. **Add eval tests for:**
   - No chunks under 30 chars (after filtering)
   - No HTML comments in any chunk content
   - No image refs (`![`) in any chunk content
   - No raw heading syntax (`##`) in chunk content
   - All `page.description` fields are clean
   - Formatted output has consistent indentation
3. **Regression** — existing eval tests still pass (coverage, relevance, dedup, integrity)
4. **Run `npm run build-index`** to rebuild and verify

## Implementation Order

Part 1 and Part 2 are independent and can be parallelized:

**Part 1 (ingestion):**
1. 1A — cleanAst in parse.ts
2. 1B — sanitize in chunk.ts
3. 1C — junk filter in chunk.ts
4. 1E — clean descriptions and overview
5. 1F — keyword dedup
6. 1G — rebuild index

**Part 2 (formatting):**
1. 2A — indent helper
2. 2B — remove sanitize calls
3. 2C — fix 14 indentation instances
4. 2D — result separators

**After both:** update eval tests, verify all pass.
