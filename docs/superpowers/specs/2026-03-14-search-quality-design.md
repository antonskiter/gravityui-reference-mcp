# Search Quality & Ingestion Coverage Fixes

## Problem Statement

The MCP server has four interconnected quality issues:

1. **Badge alt-text pollutes page titles** — Library pages with badge images in H1 headings produce titles like `@gravity-ui/markdown-editor · npm package CI Release storybook` instead of `@gravity-ui/markdown-editor`
2. **Nested components not discovered** — Components in subdirectories (`lab/`, `controls/`, `layout/`) are silently skipped by the discovery regex, which only matches one level deep
3. **Duplicate search results** — Multiple sections from the same page all appear as separate results, wasting tokens and reducing diversity
4. **Library sub-documentation not indexed** — 27 libraries have only their root README indexed despite having rich documentation in `docs/` directories and nested READMEs

## Fix 1: Strip Badge Alt-Text from Titles

**File:** `src/ingest/parse.ts`

**Change:** In `parsePage()`, before calling `mdastToString()` on the H1 heading node, recursively walk its children and remove all `image` nodes. Badge images like `[![npm package](url)](link)` get flattened by `mdastToString()` into junk text. After image removal, trim trailing ` · ` or `·` separators and excess whitespace.

**Before:** `@gravity-ui/markdown-editor · npm package CI Release storybook`
**After:** `@gravity-ui/markdown-editor`

**Scope:** Only affects H1 title extraction. No other parsing logic changes.

## Fix 2: Discover Nested Components

**File:** `src/ingest/discover.ts`

**Change:** Replace the component discovery regex:
- **Current:** `/^src\/components\/([^/]+)\/README\.md$/`
- **New:** `/^src\/components\/(.+)\/README\.md$/`

Extract the component name as the **last path segment** (e.g., `lab/FileDropZone` → name is `FileDropZone`). Include the full relative path in the `page_id` to keep IDs unique (e.g., `component:uikit:lab/FileDropZone`).

**Components gained:** `lab/FileDropZone`, `lab/ColorPicker`, `controls/TextInput`, `controls/TextArea`, `controls/PasswordInput`, `layout/Col`, `layout/Row`, `layout/Flex`, `layout/Box`, `layout/Container`, and any others in subdirectories.

## Fix 3: Deduplicate Search Results by Page

**File:** `src/server/tools/search-docs.ts`

**Change:** In `handleSearchDocs()`, after MiniSearch returns raw results and before applying the limit:

1. Group results by `page_id`
2. For each page, keep only the highest-scoring section
3. Return deduplicated results up to `limit`

To ensure enough results survive dedup, fetch more from MiniSearch internally. Current internal fetch is 50, which should be sufficient. If not, scale to `limit * 10`.

**Before:** 4 results from `markdown-editor`, all score 100, all same URL base
**After:** 1 result from `markdown-editor` (best section), plus 3 results from other pages

## Fix 4: Index Library Documentation Beyond Root README

**File:** `src/ingest/discover.ts`

**Change:** In `buildManifestFromTrees()`, add a new matching pass for each library's tree. The recursive tree data is already fetched — currently only filtered for `src/components/*/README.md`.

**Include patterns:**
- `README.md` at any depth (nested module READMEs)
- `docs/**/*.md` and `docs/**/*.mdx`
- `.md` / `.mdx` files in `src/` subdirectories

**Exclude patterns:**
- `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE.md` (at any depth)
- `__tests__/`, `__fixtures__/`, `test/`, `tests/`
- `node_modules/`, `.github/`, `.storybook/`
- Files with `example` or `migration` in the path

**Page type:** These get `page_type: "library"` with a section ID derived from the file path within the repo (e.g., `library:markdown-editor:docs/getting-started`).

**Deduplication:** The root README is already indexed as a library page. Ensure it's not double-indexed when the new pass also matches it.

## Testing Strategy

1. **Unit tests for title cleaning** — Verify badge stripping produces clean titles
2. **Unit tests for regex change** — Verify nested component paths match correctly
3. **Unit tests for dedup logic** — Verify grouping by page_id keeps best score
4. **Integration test** — Run ingestion, verify new components and library docs appear in the index
5. **Search quality test** — Verify "markdown editor" query returns diverse results

## Implementation Order

1. Fix 1 (title cleaning) — standalone, no dependencies
2. Fix 2 (nested components) — standalone, no dependencies
3. Fix 4 (library docs) — standalone, same file as Fix 2 but independent logic
4. Fix 3 (search dedup) — standalone, search layer only
5. Re-run ingestion to rebuild index with fixes 1, 2, 4
6. Verify search results with Fix 3 active

Fixes 1-4 are all independent and can be implemented in parallel.
