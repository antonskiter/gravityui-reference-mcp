# Gravity UI Documentation MCP Server — Design Spec

## Problem

An LLM working with Gravity UI needs fast, precise access to design guides, component documentation, and library docs. Whole-page dumps waste context. Training data goes stale. We need section-level retrieval with clean metadata.

## Solution

A local MCP server backed by a pre-built full-text index. Content is fetched directly from GitHub, parsed and chunked by document structure, indexed with MiniSearch, and served through 5 focused tools following the search-and-read pattern.

---

## Content Sources

All content is fetched from GitHub as raw markdown/MDX. No web crawling, no browser rendering.

| Source | Repository | Path pattern | Format | ~Count |
|--------|-----------|--------------|--------|--------|
| Design guides | `gravity-ui/landing` | `src/content/design/guides/content/en/*.mdx` | MDX | 43 |
| Component READMEs | `gravity-ui/{uikit,components,date-components,navigation}` | `src/components/{Name}/README.md` | Markdown | 80 |
| Library READMEs | `gravity-ui/{uikit,components,date-components,navigation}` | `README.md` | Markdown | 4 |

**Discovery:**
- Design guides: enumerate via GitHub API tree endpoint for `gravity-ui/landing`
- Component lists: extracted from the landing repo's registry files at `src/content/components/{lib}/index.ts`, cross-referenced with actual repo file trees
- Library READMEs: hardcoded list of 4 repos

**Locale:** English only. No `/ru/` variants.

**Authentication:** A `GITHUB_TOKEN` environment variable is supported for higher rate limits (5000 req/hr vs 60 unauthenticated). The ingest pipeline checks for it and warns if missing. If rate-limited, the pipeline waits for the reset window and retries. Cached `data/raw-pages.json` from a previous run can be used as fallback for failed fetches.

---

## ID Format

Stable, deterministic IDs for pages and chunks:

| Type | Page ID | Chunk ID |
|------|---------|----------|
| Guide | `guide:{page_name}` | `guide:{page_name}:{section_slug}` |
| Component | `component:{library}:{name}` | `component:{library}:{name}:{section_slug}` |
| Library | `library:{library}` | `library:{library}:{section_slug}` |

`section_slug` is derived from the heading text: lowercased, non-alphanumeric replaced with hyphens, deduplicated.

Examples:
- `guide:Button` → `guide:Button:sizes-and-shapes`
- `component:uikit:Button` → `component:uikit:Button:properties`
- `library:navigation` → `library:navigation:installation`

---

## Canonical URL Mapping

GitHub paths are mapped to gravity-ui.com URLs:

| Source | URL pattern |
|--------|------------|
| Design guide MDX: `.../en/{Name}.mdx` | `https://gravity-ui.com/design/guides?sectionId=guides&articleId={name}` |
| Component README: `gravity-ui/{repo}/.../{Name}/README.md` | `https://gravity-ui.com/components/{repo}/{name}` |
| Library README: `gravity-ui/{repo}/README.md` | `https://gravity-ui.com/libraries/{repo}` |

`{name}` is lowercased from `{Name}`.

---

## Ingest Pipeline

Three stages, fully offline after fetch. Single entry point: `npm run ingest`.

### Stage 1: Discovery & Fetch

1. Call GitHub API tree endpoint for `gravity-ui/landing` to list all `en/*.mdx` design guide files
2. Call GitHub API tree endpoints for each library repo to enumerate `src/components/*/README.md`
3. Fetch each library's root `README.md`
4. Download all files from `raw.githubusercontent.com` (uses `GITHUB_TOKEN` if set)
5. 100ms delay between requests; exponential backoff on 429/403
6. Failed fetches logged and skipped; falls back to cached `raw-pages.json` if available
7. Records source commit SHA per repo (from tree API response)
8. Output: `data/raw-pages.json` — map of URL → raw markdown content + source SHAs

### Stage 2: Parse & Chunk

For each raw page:

1. **Strip MDX syntax**: remove JSX imports, custom component tags, leaving clean markdown
2. **Extract metadata**:
   - Title (h1 or filename)
   - Page type: `guide` | `component` | `library`
   - Library name (from path)
   - Breadcrumbs (from path hierarchy)
   - Short description: first substantive sentence, target ~30-50 chars (soft guideline, not a hard limit — can go up to ~80 if needed for clarity). Strip install instructions, badges, imports. Describes "what it is."
3. **Extract heading hierarchy**: h1 → h2 → h3
4. **Split into semantic chunks at h2 boundaries**
   - Further split at h3 if an h2 section exceeds ~3000 chars
   - Keep code blocks attached to their parent section
5. **Generate stable section IDs** per the ID Format table above
6. **Extract code examples** as separate array per chunk
7. **Extract keywords**: component/library name, all heading words tokenized, prop names from API tables if present. No external alias mapping — keywords are derived from the document content only.

**Chunk schema:**
```typescript
interface Chunk {
  id: string;               // stable section ID (see ID Format table)
  page_id: string;          // parent page ID (see ID Format table)
  url: string;              // canonical gravity-ui.com URL
  page_title: string;
  page_type: "guide" | "component" | "library";
  library?: string;
  section_title: string;
  breadcrumbs: string[];
  content: string;          // markdown text without code blocks
  code_examples: string[];  // extracted code blocks
  keywords: string[];       // stored as array, joined to space-separated string for MiniSearch indexing
}
```

**Page schema:**
```typescript
interface Page {
  id: string;               // see ID Format table
  title: string;
  page_type: "guide" | "component" | "library";
  library?: string;
  url: string;              // canonical gravity-ui.com URL
  github_url?: string;
  breadcrumbs: string[];
  description: string;      // short, ~30-50 chars target
  section_ids: string[];    // ordered list of chunk IDs
}
```

Output: `data/pages.json`, `data/chunks.json`

### Stage 3: Index

Build a MiniSearch index over all chunks with field boosting:

| Field | Boost |
|-------|-------|
| `page_title` | 3x |
| `section_title` | 2x |
| `keywords` | 2x |
| `content` | 1x |

MiniSearch config:
- Prefix search enabled
- Fuzzy matching with threshold 0.2
- Combine score with field weights
- `keywords` field uses custom `extractField` that joins the `string[]` to a space-separated string before indexing

Expected index size: ~500 chunks, serialized JSON ~1-3 MB.

Output: `data/search-index.json` (serialized MiniSearch)

---

## MCP Server

Reads pre-built index and data files on startup. All data held in memory. 5 tools.

### Tool 1: `search_docs`

```
Description: "Search Gravity UI documentation by keyword or question.
Returns ranked snippets with section IDs for drill-down.
Use this as the first step for any documentation question.
Call get_section afterward to retrieve full content.
Prefer specific terms over vague queries. Do not call more than 3 times per question."

Input:
  query: string (required) — search terms or natural language question
  limit: number (optional, default 5, max 10)
  page_type: "guide" | "component" | "library" (optional)
  library: string (optional) — e.g. "uikit"

Output:
  results: [{
    section_id: string,
    score: number,
    page_title: string,
    page_type: string,
    library?: string,
    section_title: string,
    snippet: string,      // first 200 chars of chunk content, truncated at word boundary
    url: string
  }]
  total_matches: number
```

### Tool 2: `get_section`

```
Description: "Retrieve the full content of a documentation section by its ID.
Use this after search_docs to get complete text and code examples.
Do not call this without first searching — use the section_id from search results."

Input:
  section_id: string (required)

Output:
  section_id: string,
  page_title: string,
  page_type: string,
  library?: string,
  section_title: string,
  breadcrumbs: string[],
  content: string (full markdown),
  code_examples: string[],
  related_sections: [{section_id: string, title: string}],  // sibling chunks on the same page, derived from page.section_ids
  url: string
```

### Tool 3: `get_page`

```
Description: "Get the full structure of a documentation page — metadata and
a table of contents with section summaries. Use this when you need to understand
what a component or guide covers before drilling into specific sections.
Do not use this for search — use search_docs instead."

Input:
  page_id: string (required) — e.g. "guide:Button", "component:uikit:Button"

Output:
  page_id: string,
  title: string,
  page_type: string,
  library?: string,
  url: string,
  breadcrumbs: string[],
  description: string,
  github_url?: string,
  sections: [{
    section_id: string,
    title: string,
    summary: string,     // first 150 chars of chunk content, truncated at word boundary
    has_code: boolean    // true if chunk has any code_examples
  }]
```

### Tool 4: `list_components`

```
Description: "List all available components, optionally filtered by library.
Use this for discovery — to see what components exist before searching.
Returns names, short descriptions, and IDs only."

Input:
  library: string (optional) — omit for all libraries

Output:
  libraries: [{
    id: string,
    title: string,
    components: [{
      name: string,
      page_id: string,
      description: string (30-50 chars, e.g. "Action trigger with style variants"),
      has_design_guide: boolean
    }]
  }]
```

### Tool 5: `list_sources`

```
Description: "Show what documentation is indexed: libraries, page counts, and freshness.
Call this once at the start of a session to understand available coverage."

Input: (none)

Output:
  indexed_at: string (ISO date),
  source_commits: {[repo: string]: string},  // repo → commit SHA at time of ingest
  libraries: [{id: string, title: string, component_count: number}],
  total_pages: number,
  total_sections: number,
  page_counts: {guides: number, components: number, libraries: number}
```

### Error Handling

All errors returned inside the result object, not as protocol-level errors:
```json
{ "error": "Section not found", "section_id": "component:uikit:Foo:bar" }
```

---

## File Structure

```
gravityui-reference-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── ingest/
│   │   ├── discover.ts      # enumerate pages from GitHub API + registry
│   │   ├── fetch.ts         # download raw markdown/MDX
│   │   ├── parse.ts         # strip MDX, extract headings, metadata
│   │   ├── chunk.ts         # split into h2/h3 sections, generate IDs
│   │   ├── index.ts         # build MiniSearch index
│   │   └── run.ts           # pipeline entry point
│   ├── server/
│   │   ├── server.ts        # MCP server setup, tool registration
│   │   ├── tools/
│   │   │   ├── search-docs.ts
│   │   │   ├── get-section.ts
│   │   │   ├── get-page.ts
│   │   │   ├── list-components.ts
│   │   │   └── list-sources.ts
│   │   └── loader.ts        # load data files into memory
│   └── types.ts             # shared types
├── data/                    # generated by ingest, gitignored
│   ├── raw-pages.json
│   ├── pages.json
│   ├── chunks.json
│   └── search-index.json
└── scripts/
    └── test-queries.ts      # smoke test with example queries
```

## Tech Stack

| Dependency | Purpose |
|-----------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `minisearch` | Full-text search with fuzzy matching |
| `unified` + `remark-parse` + `remark-mdx` | MDX/markdown parsing |
| Native `fetch` (Node 18+) | HTTP requests to GitHub |

No Playwright. No Cheerio. No Turndown. No vector DB.

**Runtime requirement:** Node.js >= 18 (for native `fetch`). Enforced via `engines` field in `package.json`.

## Scripts

| Command | Action |
|---------|--------|
| `npm run ingest` | Fetch + parse + chunk + index |
| `npm run serve` | Start MCP server |
| `npm run test-queries` | Run smoke tests |

---

## Design Decisions

1. **GitHub raw fetch over web crawling** — The landing site is a Next.js SPA where design/component pages require JS rendering. But all content exists as MDX/markdown in GitHub repos. Direct fetch is faster, cleaner, and more reliable.

2. **Semantic chunking over character-count splitting** — h2/h3 boundaries preserve document structure. A section about "Button sizes" stays intact rather than being split mid-paragraph.

3. **Two-step retrieval (search → drill-down)** — Validated by Microsoft Learn MCP, Context7, and AWS Docs MCP. Avoids flooding context with full pages on first query.

4. **5 tools, not more** — Best practice is 5-8 tools per MCP server. Each tool has one clear purpose with behavioral guidance in descriptions.

5. **MiniSearch over vector search** — For ~130 docs with ~500 sections, BM25-style full-text search with fuzzy matching is sufficient and keeps the stack simple. No embedding model, no vector DB.

6. **Flat JSON storage** — Easy to inspect, easy to rebuild, easy to version. No database to manage.

7. **Server-side ranking** — Return 5 good results, not 50 for the LLM to filter. Context7 showed 65% token reduction with this approach.

8. **Short component descriptions** — 30-50 char "what it is" summaries (e.g. "Collapsible sidebar navigation") so the model can scan a list of 80 components without wasting context.
