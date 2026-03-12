# Gravity UI Documentation MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MCP server that gives LLMs section-level access to Gravity UI documentation via 5 search-and-read tools.

**Architecture:** Content fetched from GitHub as raw markdown/MDX, parsed into semantic chunks at heading boundaries, indexed with MiniSearch, served through an MCP server with stdio transport. Two-phase: offline ingest pipeline builds JSON data files, runtime server loads them into memory.

**Tech Stack:** TypeScript, Node 18+, `@modelcontextprotocol/sdk`, `minisearch`, `unified`/`remark-parse`/`remark-mdx`

**Spec:** `docs/superpowers/specs/2026-03-12-gravity-ui-docs-mcp-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts, engines |
| `tsconfig.json` | TypeScript config (ESM, strict) |
| `.gitignore` | Ignore `data/`, `dist/`, `node_modules/` |
| `src/types.ts` | `Page`, `Chunk`, `RawPage`, `IngestMetadata` interfaces |
| `src/ingest/discover.ts` | Enumerate all pages to fetch via GitHub API tree endpoints |
| `src/ingest/fetch.ts` | Download raw markdown/MDX from `raw.githubusercontent.com` |
| `src/ingest/parse.ts` | Strip MDX, extract metadata, heading hierarchy, description |
| `src/ingest/chunk.ts` | Split into h2/h3 sections, generate IDs, extract code blocks and keywords |
| `src/ingest/index.ts` | Build and serialize MiniSearch index |
| `src/ingest/run.ts` | Pipeline entry point: discover → fetch → parse → chunk → index |
| `src/server/loader.ts` | Load `pages.json`, `chunks.json`, `search-index.json`, `metadata.json` into memory |
| `src/server/tools/search-docs.ts` | `search_docs` tool implementation |
| `src/server/tools/get-section.ts` | `get_section` tool implementation |
| `src/server/tools/get-page.ts` | `get_page` tool implementation |
| `src/server/tools/list-components.ts` | `list_components` tool implementation |
| `src/server/tools/list-sources.ts` | `list_sources` tool implementation |
| `src/server/server.ts` | MCP server setup, tool registration, stdio transport |
| `scripts/test-queries.ts` | Smoke test with example queries against running data |
| `tests/parse.test.ts` | Tests for MDX stripping, metadata extraction |
| `tests/chunk.test.ts` | Tests for chunking logic, ID generation, code extraction |
| `tests/index.test.ts` | Tests for search index building and querying |
| `tests/discover.test.ts` | Tests for manifest building from tree data |
| `tests/tools.test.ts` | Tests for MCP tool handlers (unit, using mock data) |

---

## Chunk 1: Project Skeleton & Types

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gravityui-reference-mcp",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "ingest": "tsx src/ingest/run.ts",
    "serve": "tsx src/server/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test-queries": "tsx scripts/test-queries.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "minisearch": "^7.1.0",
    "zod": "^3.23.0",
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-mdx": "^3.1.0",
    "unist-util-visit": "^5.0.0",
    "mdast-util-to-string": "^4.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "data", "tests"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
data/
*.tsbuildinfo
```

- [ ] **Step 4: Run `npm install`**

Run: `npm install`
Expected: Successful install, `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "feat: initialize project skeleton with dependencies"
```

---

### Task 2: Define shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types file**

```typescript
export type PageType = "guide" | "component" | "library";

export interface Page {
  id: string;
  title: string;
  page_type: PageType;
  library?: string;
  url: string;
  github_url?: string;
  breadcrumbs: string[];
  description: string;
  section_ids: string[];
}

export interface Chunk {
  id: string;
  page_id: string;
  url: string;
  page_title: string;
  page_type: PageType;
  library?: string;
  section_title: string;
  breadcrumbs: string[];
  content: string;
  code_examples: string[];
  keywords: string[];
}

export interface RawPage {
  url: string;
  github_url: string;
  content: string;
  page_type: PageType;
  library?: string;
  name: string;
}

export interface IngestMetadata {
  indexed_at: string;
  source_commits: Record<string, string>;
}

export interface PageManifestEntry {
  raw_url: string;
  github_url: string;
  page_type: PageType;
  library?: string;
  name: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions for Page, Chunk, RawPage"
```

---

## Chunk 2: Ingest Pipeline — Discovery & Fetch

### Task 3: Implement discovery

**Files:**
- Create: `src/ingest/discover.ts`
- Test: `tests/discover.test.ts`

This module calls GitHub API tree endpoints to enumerate all pages to fetch. It returns a list of `PageManifestEntry` objects.

- [ ] **Step 1: Write test for manifest building from mock tree data**

Create `tests/discover.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildManifestFromTrees } from "../src/ingest/discover.js";

describe("buildManifestFromTrees", () => {
  it("extracts MDX design guide entries from landing tree", () => {
    const landingTree = [
      { path: "src/content/design/guides/content/en/Button.mdx", type: "blob" },
      { path: "src/content/design/guides/content/en/Alert.mdx", type: "blob" },
      { path: "src/content/design/guides/content/ru/Button.mdx", type: "blob" },
      { path: "src/content/design/guides/index.ts", type: "blob" },
    ];
    const libTrees = {};
    const result = buildManifestFromTrees(landingTree, libTrees);
    const guides = result.filter((e) => e.page_type === "guide");
    expect(guides).toHaveLength(2);
    expect(guides[0].name).toBe("Button");
    expect(guides[0].page_type).toBe("guide");
    expect(guides[0].raw_url).toContain("raw.githubusercontent.com");
  });

  it("extracts component README entries from library trees", () => {
    const landingTree: any[] = [];
    const libTrees = {
      uikit: [
        { path: "src/components/Button/README.md", type: "blob" },
        { path: "src/components/Button/Button.tsx", type: "blob" },
        { path: "src/components/Select/README.md", type: "blob" },
      ],
    };
    const result = buildManifestFromTrees(landingTree, libTrees);
    const components = result.filter((e) => e.page_type === "component");
    expect(components).toHaveLength(2);
    expect(components[0].library).toBe("uikit");
    expect(components[0].name).toBe("Button");
  });

  it("adds library README entries for each repo", () => {
    const landingTree: any[] = [];
    const libTrees = { uikit: [], navigation: [] };
    const result = buildManifestFromTrees(landingTree, libTrees);
    const libs = result.filter((e) => e.page_type === "library");
    expect(libs).toHaveLength(2);
    expect(libs.map((l) => l.library)).toContain("uikit");
    expect(libs.map((l) => l.library)).toContain("navigation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/discover.test.ts`
Expected: FAIL — `buildManifestFromTrees` not found.

- [ ] **Step 3: Implement `discover.ts`**

Create `src/ingest/discover.ts`:

```typescript
import type { PageManifestEntry } from "../types.js";

const GITHUB_RAW = "https://raw.githubusercontent.com/gravity-ui";
const GITHUB_API = "https://api.github.com/repos/gravity-ui";
const LIBRARY_REPOS = ["uikit", "components", "date-components", "navigation"];
const LANDING_REPO = "landing";
const DESIGN_GUIDE_PREFIX = "src/content/design/guides/content/en/";

interface TreeEntry {
  path: string;
  type: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function buildManifestFromTrees(
  landingTree: TreeEntry[],
  libTrees: Record<string, TreeEntry[]>,
): PageManifestEntry[] {
  const entries: PageManifestEntry[] = [];

  // Design guides from landing repo
  for (const item of landingTree) {
    if (
      item.type === "blob" &&
      item.path.startsWith(DESIGN_GUIDE_PREFIX) &&
      item.path.endsWith(".mdx")
    ) {
      const name = item.path
        .slice(DESIGN_GUIDE_PREFIX.length)
        .replace(/\.mdx$/, "");
      entries.push({
        raw_url: `${GITHUB_RAW}/${LANDING_REPO}/main/${item.path}`,
        github_url: `https://github.com/gravity-ui/${LANDING_REPO}/blob/main/${item.path}`,
        page_type: "guide",
        name,
      });
    }
  }

  // Components and library READMEs from each library repo
  for (const [repo, tree] of Object.entries(libTrees)) {
    // Library-level README
    entries.push({
      raw_url: `${GITHUB_RAW}/${repo}/main/README.md`,
      github_url: `https://github.com/gravity-ui/${repo}`,
      page_type: "library",
      library: repo,
      name: repo,
    });

    // Component READMEs
    for (const item of tree) {
      const match = item.path.match(
        /^src\/components\/([^/]+)\/README\.md$/,
      );
      if (item.type === "blob" && match) {
        const componentName = match[1];
        entries.push({
          raw_url: `${GITHUB_RAW}/${repo}/main/${item.path}`,
          github_url: `https://github.com/gravity-ui/${repo}/tree/main/src/components/${componentName}`,
          page_type: "component",
          library: repo,
          name: componentName,
        });
      }
    }
  }

  return entries;
}

export async function fetchTree(
  repo: string,
): Promise<{ tree: TreeEntry[]; sha: string }> {
  const url = `${GITHUB_API}/${repo}/git/trees/main?recursive=1`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API error for ${repo}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tree: TreeEntry[]; sha: string };
  return { tree: data.tree, sha: data.sha };
}

export async function discover(): Promise<{
  manifest: PageManifestEntry[];
  commits: Record<string, string>;
}> {
  const commits: Record<string, string> = {};

  // Fetch landing repo tree
  console.log("Fetching tree: gravity-ui/landing");
  const landing = await fetchTree(LANDING_REPO);
  commits[LANDING_REPO] = landing.sha;

  // Fetch each library repo tree
  const libTrees: Record<string, TreeEntry[]> = {};
  for (const repo of LIBRARY_REPOS) {
    console.log(`Fetching tree: gravity-ui/${repo}`);
    const result = await fetchTree(repo);
    libTrees[repo] = result.tree;
    commits[repo] = result.sha;
  }

  const manifest = buildManifestFromTrees(landing.tree, libTrees);
  console.log(`Discovered ${manifest.length} pages to fetch`);
  return { manifest, commits };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/discover.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/discover.ts tests/discover.test.ts
git commit -m "feat: implement page discovery from GitHub API trees"
```

---

### Task 4: Implement fetch

**Files:**
- Create: `src/ingest/fetch.ts`

This module downloads raw content for each manifest entry. No unit test needed — it's a thin HTTP wrapper. Tested via integration in the full pipeline.

- [ ] **Step 1: Implement `fetch.ts`**

Create `src/ingest/fetch.ts`:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PageManifestEntry, RawPage } from "../types.js";

const DELAY_MS = 100;
const DATA_DIR = join(process.cwd(), "data");

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: getHeaders() });
    if (res.ok) {
      return res.text();
    }
    if (res.status === 429 || res.status === 403) {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const waitMs = resetHeader
        ? Math.max(0, Number(resetHeader) * 1000 - Date.now()) + 1000
        : Math.pow(2, attempt + 1) * 1000;
      console.warn(
        `Rate limited on ${url}, waiting ${Math.round(waitMs / 1000)}s...`,
      );
      await delay(waitMs);
      continue;
    }
    console.warn(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    return null;
  }
  return null;
}

function loadCachedPages(): Map<string, string> {
  const cachePath = join(DATA_DIR, "raw-pages.json");
  if (!existsSync(cachePath)) return new Map();
  try {
    const data = JSON.parse(readFileSync(cachePath, "utf-8"));
    const map = new Map<string, string>();
    for (const page of data.pages || []) {
      map.set(page.url, page.content);
    }
    console.log(`Loaded ${map.size} cached pages as fallback`);
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchAllPages(
  manifest: PageManifestEntry[],
): Promise<RawPage[]> {
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "Warning: GITHUB_TOKEN not set. Rate limit is 60 req/hr. Set GITHUB_TOKEN for 5000 req/hr.",
    );
  }

  const cache = loadCachedPages();
  const pages: RawPage[] = [];
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    console.log(
      `Fetching [${i + 1}/${manifest.length}] ${entry.page_type}:${entry.name}`,
    );
    let content = await fetchWithRetry(entry.raw_url);
    if (!content && cache.has(entry.raw_url)) {
      console.warn(`  Using cached version for ${entry.name}`);
      content = cache.get(entry.raw_url)!;
    }
    if (content) {
      pages.push({
        url: entry.raw_url,
        github_url: entry.github_url,
        content,
        page_type: entry.page_type,
        library: entry.library,
        name: entry.name,
      });
    }
    await delay(DELAY_MS);
  }
  console.log(`Fetched ${pages.length}/${manifest.length} pages successfully`);
  return pages;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ingest/fetch.ts
git commit -m "feat: implement raw page fetcher with rate limiting and retry"
```

---

## Chunk 3: Ingest Pipeline — Parse & Chunk

### Task 5: Implement MDX/Markdown parser

**Files:**
- Create: `src/ingest/parse.ts`
- Test: `tests/parse.test.ts`

This module strips MDX syntax, extracts metadata (title, description, headings), and returns a clean structure.

- [ ] **Step 1: Write parse tests**

Create `tests/parse.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePage } from "../src/ingest/parse.js";

const SAMPLE_MDX = `import {Image} from '@components/Image';

# Button

A clickable action trigger with multiple style variants.

<Image src="/static/images/design/Button/Example.png" />

## Appearance

Buttons come in five types: accent, primary, semantic, raised, and contrasting.

### Accent buttons

Accent buttons highlight key actions.

\`\`\`tsx
<Button view="action">Click me</Button>
\`\`\`

## Sizes

Four sizes are available: XS, S, M (default), L, and XL.
`;

const SAMPLE_README = `# Select

A dropdown selection input for choosing from a list of options.

## Installation

\`\`\`bash
npm install @gravity-ui/uikit
\`\`\`

## Usage

Use the Select component in forms.

\`\`\`tsx
import { Select } from '@gravity-ui/uikit';
\`\`\`

## Properties

| Name | Type | Default |
|------|------|---------|
| size | string | m |
| disabled | boolean | false |
`;

describe("parsePage", () => {
  it("strips MDX imports and JSX components", () => {
    const result = parsePage(SAMPLE_MDX, "guide", "Button");
    expect(result.cleanMarkdown).not.toContain("import {Image}");
    expect(result.cleanMarkdown).not.toContain("<Image");
  });

  it("extracts title from h1", () => {
    const result = parsePage(SAMPLE_MDX, "guide", "Button");
    expect(result.title).toBe("Button");
  });

  it("extracts description from first paragraph", () => {
    const result = parsePage(SAMPLE_MDX, "guide", "Button");
    expect(result.description).toMatch(/clickable action trigger/i);
  });

  it("extracts heading hierarchy", () => {
    const result = parsePage(SAMPLE_MDX, "guide", "Button");
    expect(result.headings).toEqual([
      { depth: 2, text: "Appearance" },
      { depth: 3, text: "Accent buttons" },
      { depth: 2, text: "Sizes" },
    ]);
  });

  it("falls back to name if no h1", () => {
    const result = parsePage("## Just a section\n\nSome text.", "component", "Fallback");
    expect(result.title).toBe("Fallback");
  });

  it("strips install instructions from description", () => {
    const result = parsePage(SAMPLE_README, "component", "Select");
    expect(result.description).not.toContain("npm install");
    expect(result.description).toMatch(/dropdown selection/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parse.test.ts`
Expected: FAIL — `parsePage` not found.

- [ ] **Step 3: Implement `parse.ts`**

Create `src/ingest/parse.ts`:

```typescript
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { PageType } from "../types.js";

interface Heading {
  depth: number;
  text: string;
}

export interface ParseResult {
  title: string;
  description: string;
  cleanMarkdown: string;
  headings: Heading[];
}

function stripMdxSyntax(content: string): string {
  // Remove import statements
  let cleaned = content.replace(/^import\s+.*$/gm, "");
  // Remove JSX self-closing tags like <Image ... />
  cleaned = cleaned.replace(/<[A-Z][a-zA-Z]*\s[^>]*\/>/g, "");
  // Remove JSX opening+closing tags and their content if single-line
  cleaned = cleaned.replace(/<[A-Z][a-zA-Z]*[^>]*>.*?<\/[A-Z][a-zA-Z]*>/gs, "");
  // Remove remaining JSX tags (opening/closing) that span lines
  cleaned = cleaned.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, "");
  // Remove export statements
  cleaned = cleaned.replace(/^export\s+.*$/gm, "");
  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

function extractDescription(content: string, name: string): string {
  const tree = unified().use(remarkParse).parse(content);
  let description = "";
  let foundH1 = false;

  for (const node of tree.children) {
    if (node.type === "heading" && (node as any).depth === 1) {
      foundH1 = true;
      continue;
    }
    if (foundH1 && node.type === "paragraph") {
      const text = toString(node).trim();
      // Skip install instructions, badge lines, import lines
      if (
        text.startsWith("npm ") ||
        text.startsWith("yarn ") ||
        text.startsWith("pnpm ") ||
        text.startsWith("[![") ||
        text.startsWith("import ")
      ) {
        continue;
      }
      description = text;
      break;
    }
    // If no h1, grab first paragraph
    if (!foundH1 && node.type === "paragraph") {
      const text = toString(node).trim();
      if (
        !text.startsWith("npm ") &&
        !text.startsWith("[![") &&
        !text.startsWith("import ")
      ) {
        description = text;
        break;
      }
    }
  }

  // Truncate to first sentence, target ~30-80 chars
  if (description.length > 80) {
    const sentenceEnd = description.indexOf(". ");
    if (sentenceEnd > 0 && sentenceEnd <= 80) {
      description = description.slice(0, sentenceEnd + 1);
    } else {
      description = description.slice(0, 80).replace(/\s+\S*$/, "") + "...";
    }
  }

  return description || name;
}

export function parsePage(
  rawContent: string,
  pageType: PageType,
  name: string,
): ParseResult {
  const cleanMarkdown = stripMdxSyntax(rawContent);
  const tree = unified().use(remarkParse).parse(cleanMarkdown);

  let title = name;
  const headings: Heading[] = [];

  visit(tree, "heading", (node: any) => {
    const text = toString(node);
    if (node.depth === 1 && title === name) {
      title = text;
    } else if (node.depth >= 2 && node.depth <= 3) {
      headings.push({ depth: node.depth, text });
    }
  });

  const description = extractDescription(cleanMarkdown, name);

  return { title, description, cleanMarkdown, headings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/parse.ts tests/parse.test.ts
git commit -m "feat: implement MDX/markdown parser with metadata extraction"
```

---

### Task 6: Implement chunking

**Files:**
- Create: `src/ingest/chunk.ts`
- Test: `tests/chunk.test.ts`

Splits parsed content into semantic chunks at h2/h3 boundaries, generates stable IDs, extracts code blocks and keywords.

- [ ] **Step 1: Write chunk tests**

Create `tests/chunk.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { chunkPage } from "../src/ingest/chunk.js";
import type { ParseResult } from "../src/ingest/parse.js";
import type { PageType } from "../src/types.js";

function makeParseResult(markdown: string, headings: any[]): ParseResult {
  return {
    title: "Button",
    description: "Action trigger",
    cleanMarkdown: markdown,
    headings,
  };
}

describe("chunkPage", () => {
  it("creates one chunk per h2 section", () => {
    const md = `# Button

Intro text.

## Appearance

Appearance content here.

## Sizes

Sizes content here.
`;
    const parsed = makeParseResult(md, [
      { depth: 2, text: "Appearance" },
      { depth: 2, text: "Sizes" },
    ]);
    const result = chunkPage(parsed, "guide", "Button");
    // Intro + 2 h2 sections
    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    const titles = result.chunks.map((c) => c.section_title);
    expect(titles).toContain("Appearance");
    expect(titles).toContain("Sizes");
  });

  it("generates stable section IDs", () => {
    const md = `# Button\n\n## Sizes\n\nContent.\n`;
    const parsed = makeParseResult(md, [{ depth: 2, text: "Sizes" }]);
    const result = chunkPage(parsed, "guide", "Button");
    const sizeChunk = result.chunks.find((c) => c.section_title === "Sizes");
    expect(sizeChunk?.id).toBe("guide:Button:sizes");
  });

  it("generates component chunk IDs with library", () => {
    const md = `# Button\n\n## Properties\n\nContent.\n`;
    const parsed = makeParseResult(md, [{ depth: 2, text: "Properties" }]);
    const result = chunkPage(parsed, "component", "Button", "uikit");
    const chunk = result.chunks.find((c) => c.section_title === "Properties");
    expect(chunk?.id).toBe("component:uikit:Button:properties");
  });

  it("deduplicates identical slugs", () => {
    const md = `# Test\n\n## Examples\n\nFirst.\n\n## Examples\n\nSecond.\n`;
    const parsed = makeParseResult(md, [
      { depth: 2, text: "Examples" },
      { depth: 2, text: "Examples" },
    ]);
    const result = chunkPage(parsed, "guide", "Test");
    const ids = result.chunks
      .filter((c) => c.section_title === "Examples")
      .map((c) => c.id);
    expect(ids[0]).toBe("guide:Test:examples");
    expect(ids[1]).toBe("guide:Test:examples-2");
  });

  it("extracts code blocks separately", () => {
    const md = `# Button\n\n## Usage\n\nSome text.\n\n\`\`\`tsx\n<Button />\n\`\`\`\n\nMore text.\n`;
    const parsed = makeParseResult(md, [{ depth: 2, text: "Usage" }]);
    const result = chunkPage(parsed, "guide", "Button");
    const chunk = result.chunks.find((c) => c.section_title === "Usage");
    expect(chunk?.code_examples).toHaveLength(1);
    expect(chunk?.code_examples[0]).toContain("<Button />");
    expect(chunk?.content).not.toContain("```");
  });

  it("extracts keywords from headings and component name", () => {
    const md = `# Button\n\n## Sizes and shapes\n\nContent.\n`;
    const parsed = makeParseResult(md, [{ depth: 2, text: "Sizes and shapes" }]);
    const result = chunkPage(parsed, "component", "Button", "uikit");
    const chunk = result.chunks.find((c) => c.section_title === "Sizes and shapes");
    expect(chunk?.keywords).toContain("Button");
    expect(chunk?.keywords).toContain("sizes");
    expect(chunk?.keywords).toContain("shapes");
  });

  it("splits large h2 sections at h3 boundaries", () => {
    const longContent = "A".repeat(3100);
    const md = `# Test\n\n## Big Section\n\n${longContent}\n\n### Sub A\n\nSub A content.\n\n### Sub B\n\nSub B content.\n`;
    const parsed = makeParseResult(md, [
      { depth: 2, text: "Big Section" },
      { depth: 3, text: "Sub A" },
      { depth: 3, text: "Sub B" },
    ]);
    const result = chunkPage(parsed, "guide", "Test");
    expect(result.chunks.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chunk.test.ts`
Expected: FAIL — `chunkPage` not found.

- [ ] **Step 3: Implement `chunk.ts`**

Create `src/ingest/chunk.ts`. The function:
1. Splits content by h2 regex
2. For each h2 section, checks size and splits further by h3 if > 3000 chars
3. Extracts code blocks into `code_examples`
4. Generates stable IDs per the spec's ID format table
5. Extracts keywords from component name + heading words

```typescript
import type { Chunk, PageType } from "../types.js";
import type { ParseResult } from "./parse.js";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeChunkId(
  pageType: PageType,
  name: string,
  slug: string,
  library?: string,
): string {
  if (pageType === "guide") return `guide:${name}:${slug}`;
  if (pageType === "component") return `component:${library}:${name}:${slug}`;
  return `library:${library}:${slug}`;
}

function makePageId(pageType: PageType, name: string, library?: string): string {
  if (pageType === "guide") return `guide:${name}`;
  if (pageType === "component") return `component:${library}:${name}`;
  return `library:${library}`;
}

function makeCanonicalUrl(
  pageType: PageType,
  name: string,
  library?: string,
): string {
  const base = "https://gravity-ui.com";
  if (pageType === "guide") {
    return `${base}/design/guides?sectionId=guides&articleId=${name.toLowerCase()}`;
  }
  if (pageType === "component") {
    return `${base}/components/${library}/${name.toLowerCase()}`;
  }
  return `${base}/libraries/${library}`;
}

function extractCodeBlocks(text: string): { content: string; code_examples: string[] } {
  const code_examples: string[] = [];
  const content = text.replace(/```[\s\S]*?```/g, (match) => {
    // Extract just the code (without the fences)
    const inner = match.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    code_examples.push(inner);
    return "";
  });
  return { content: content.replace(/\n{3,}/g, "\n\n").trim(), code_examples };
}

function extractKeywords(name: string, sectionTitle: string, library?: string): string[] {
  const words = new Set<string>();
  words.add(name);
  if (library) words.add(library);
  for (const word of sectionTitle.split(/\s+/)) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.length > 1) words.add(clean);
  }
  return [...words];
}

interface Section {
  title: string;
  depth: number;
  content: string;
}

function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h2Match) {
      if (current) {
        current.content = buffer.join("\n").trim();
        sections.push(current);
      } else if (buffer.length > 0) {
        // Intro content before first h2
        sections.push({
          title: "Introduction",
          depth: 2,
          content: buffer.join("\n").trim(),
        });
      }
      current = { title: h2Match[1], depth: 2, content: "" };
      buffer = [];
    } else {
      // h3 headings and all other lines go to buffer.
      // h3 markers are preserved for splitSectionByH3 to split on later.
      buffer.push(line);
    }
  }

  if (current) {
    current.content = buffer.join("\n").trim();
    sections.push(current);
  } else if (buffer.length > 0) {
    sections.push({
      title: "Introduction",
      depth: 2,
      content: buffer.join("\n").trim(),
    });
  }

  return sections;
}

function splitSectionByH3(section: Section): Section[] {
  if (section.content.length <= 3000) return [section];

  const lines = section.content.split("\n");
  const subSections: Section[] = [];
  let current: Section = { ...section, content: "" };
  let buffer: string[] = [];

  for (const line of lines) {
    const h3Match = line.match(/^### (.+)/);
    if (h3Match) {
      current.content = buffer.join("\n").trim();
      if (current.content) {
        subSections.push(current);
      }
      current = { title: h3Match[1], depth: 3, content: "" };
      buffer = [];
    } else {
      buffer.push(line);
    }
  }

  current.content = buffer.join("\n").trim();
  if (current.content) {
    subSections.push(current);
  }

  return subSections.length > 1 ? subSections : [section];
}

export function chunkPage(
  parsed: ParseResult,
  pageType: PageType,
  name: string,
  library?: string,
): { page_id: string; chunks: Chunk[] } {
  const page_id = makePageId(pageType, name, library);
  const url = makeCanonicalUrl(pageType, name, library);
  const breadcrumbs =
    pageType === "guide"
      ? ["Design", "Guides", parsed.title]
      : pageType === "component"
        ? ["Components", library!, parsed.title]
        : ["Libraries", parsed.title];

  const rawSections = splitIntoSections(parsed.cleanMarkdown);
  const allSections: Section[] = [];
  for (const section of rawSections) {
    allSections.push(...splitSectionByH3(section));
  }

  // Filter out empty intro sections
  const sections = allSections.filter(
    (s) => s.content || s.title !== "Introduction",
  );

  const slugCounts = new Map<string, number>();
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const baseSlug = toSlug(section.title);
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

    const { content, code_examples } = extractCodeBlocks(section.content);
    const keywords = extractKeywords(name, section.title, library);

    chunks.push({
      id: makeChunkId(pageType, name, slug, library),
      page_id,
      url,
      page_title: parsed.title,
      page_type: pageType,
      library,
      section_title: section.title,
      breadcrumbs,
      content,
      code_examples,
      keywords,
    });
  }

  return { page_id, chunks };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chunk.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/chunk.ts tests/chunk.test.ts
git commit -m "feat: implement semantic chunking with stable IDs and code extraction"
```

---

## Chunk 4: Ingest Pipeline — Index & Runner

### Task 7: Implement index building

**Files:**
- Create: `src/ingest/index.ts`
- Test: `tests/index.test.ts`

- [ ] **Step 1: Write index tests**

Create `tests/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildIndex, searchIndex } from "../src/ingest/index.js";
import type { Chunk } from "../src/types.js";

function makeChunk(overrides: Partial<Chunk>): Chunk {
  return {
    id: "guide:Button:appearance",
    page_id: "guide:Button",
    url: "https://gravity-ui.com/design/guides?articleId=button",
    page_title: "Button",
    page_type: "guide",
    section_title: "Appearance",
    breadcrumbs: ["Design", "Guides", "Button"],
    content: "Buttons come in five types: accent, primary, semantic, raised, and contrasting.",
    code_examples: [],
    keywords: ["Button", "appearance"],
    ...overrides,
  };
}

describe("buildIndex", () => {
  it("builds a searchable index from chunks", () => {
    const chunks = [
      makeChunk({}),
      makeChunk({
        id: "guide:Button:sizes",
        section_title: "Sizes",
        content: "Four sizes are available: XS, S, M, L, XL.",
        keywords: ["Button", "sizes"],
      }),
    ];
    const index = buildIndex(chunks);
    expect(index).toBeDefined();
  });
});

describe("searchIndex", () => {
  it("returns matching results ranked by score", () => {
    const chunks = [
      makeChunk({}),
      makeChunk({
        id: "guide:Button:sizes",
        section_title: "Sizes",
        content: "Four sizes are available: XS, S, M, L, XL.",
        keywords: ["Button", "sizes"],
      }),
    ];
    const index = buildIndex(chunks);
    const results = searchIndex(index, "sizes");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("guide:Button:sizes");
  });

  it("supports fuzzy matching", () => {
    const chunks = [
      makeChunk({
        content: "Buttons come in five types: accent, primary, semantic.",
      }),
    ];
    const index = buildIndex(chunks);
    const results = searchIndex(index, "buton"); // typo
    expect(results.length).toBeGreaterThan(0);
  });

  it("boosts page_title matches", () => {
    const chunks = [
      makeChunk({
        id: "guide:Dialog:usage",
        page_title: "Dialog",
        section_title: "Usage",
        content: "A dialog shows a button to close.",
        keywords: ["Dialog"],
      }),
      makeChunk({
        id: "guide:Button:appearance",
        page_title: "Button",
        section_title: "Appearance",
        content: "Buttons have several types.",
        keywords: ["Button"],
      }),
    ];
    const index = buildIndex(chunks);
    const results = searchIndex(index, "button");
    expect(results[0].id).toBe("guide:Button:appearance");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/index.test.ts`
Expected: FAIL — `buildIndex` not found.

- [ ] **Step 3: Implement `index.ts`**

Create `src/ingest/index.ts`:

```typescript
import MiniSearch from "minisearch";
import type { Chunk } from "../types.js";

const FIELDS = ["page_title", "section_title", "keywords_joined", "content"];
const STORE_FIELDS = ["id"];
const BOOST = {
  page_title: 3,
  section_title: 2,
  keywords_joined: 2,
  content: 1,
};

interface IndexDocument {
  id: string;
  page_title: string;
  section_title: string;
  keywords_joined: string;
  content: string;
}

function chunkToDoc(chunk: Chunk): IndexDocument {
  return {
    id: chunk.id,
    page_title: chunk.page_title,
    section_title: chunk.section_title,
    keywords_joined: chunk.keywords.join(" "),
    content: chunk.content,
  };
}

export function buildIndex(chunks: Chunk[]): MiniSearch {
  const index = new MiniSearch<IndexDocument>({
    fields: FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: {
      boost: BOOST,
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const docs = chunks.map(chunkToDoc);
  index.addAll(docs);
  return index;
}

export interface SearchResult {
  id: string;
  score: number;
}

export function searchIndex(
  index: MiniSearch,
  query: string,
  limit = 10,
): SearchResult[] {
  const results = index.search(query);
  return results.slice(0, limit).map((r) => ({
    id: r.id as string,
    score: r.score,
  }));
}

export function serializeIndex(index: MiniSearch): string {
  return JSON.stringify(index);
}

export function deserializeIndex(json: string): MiniSearch {
  return MiniSearch.loadJSON(json, {
    fields: FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: {
      boost: BOOST,
      prefix: true,
      fuzzy: 0.2,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/index.ts tests/index.test.ts
git commit -m "feat: implement MiniSearch index building with field boosting"
```

---

### Task 8: Implement ingest pipeline runner

**Files:**
- Create: `src/ingest/run.ts`

Orchestrates: discover → fetch → parse → chunk → index → write JSON files. No unit test — this is the integration entry point tested end-to-end.

- [ ] **Step 1: Implement `run.ts`**

Create `src/ingest/run.ts`:

```typescript
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { discover } from "./discover.js";
import { fetchAllPages } from "./fetch.js";
import { parsePage } from "./parse.js";
import { chunkPage } from "./chunk.js";
import { buildIndex, serializeIndex } from "./index.js";
import type { Page, Chunk, IngestMetadata } from "../types.js";

const DATA_DIR = join(process.cwd(), "data");

async function run() {
  console.log("=== Gravity UI Docs Ingest Pipeline ===\n");

  // Ensure data directory exists
  mkdirSync(DATA_DIR, { recursive: true });

  // Stage 1: Discover & Fetch
  console.log("Stage 1: Discovery & Fetch\n");
  const { manifest, commits } = await discover();
  const rawPages = await fetchAllPages(manifest);

  // Save raw pages
  writeFileSync(
    join(DATA_DIR, "raw-pages.json"),
    JSON.stringify({ commits, pages: rawPages }, null, 2),
  );
  console.log(`\nSaved ${rawPages.length} raw pages.\n`);

  // Stage 2: Parse & Chunk
  console.log("Stage 2: Parse & Chunk\n");
  const pages: Page[] = [];
  const allChunks: Chunk[] = [];

  for (const raw of rawPages) {
    const parsed = parsePage(raw.content, raw.page_type, raw.name);
    const { page_id, chunks } = chunkPage(
      parsed,
      raw.page_type,
      raw.name,
      raw.library,
    );

    pages.push({
      id: page_id,
      title: parsed.title,
      page_type: raw.page_type,
      library: raw.library,
      url: chunks[0]?.url || "",
      github_url: raw.github_url,
      breadcrumbs: chunks[0]?.breadcrumbs || [],
      description: parsed.description,
      section_ids: chunks.map((c) => c.id),
    });

    allChunks.push(...chunks);
  }

  console.log(`Parsed ${pages.length} pages into ${allChunks.length} chunks.\n`);

  // Save pages and chunks
  writeFileSync(join(DATA_DIR, "pages.json"), JSON.stringify(pages, null, 2));
  writeFileSync(join(DATA_DIR, "chunks.json"), JSON.stringify(allChunks, null, 2));

  // Stage 3: Index
  console.log("Stage 3: Build Index\n");
  const index = buildIndex(allChunks);
  writeFileSync(join(DATA_DIR, "search-index.json"), serializeIndex(index));

  // Save metadata
  const metadata: IngestMetadata = {
    indexed_at: new Date().toISOString(),
    source_commits: commits,
  };
  writeFileSync(
    join(DATA_DIR, "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  console.log("=== Ingest Complete ===");
  console.log(`  Pages: ${pages.length}`);
  console.log(`  Chunks: ${allChunks.length}`);
  console.log(`  Index size: ${(serializeIndex(index).length / 1024).toFixed(0)} KB`);
  console.log(`  Data dir: ${DATA_DIR}`);
}

run().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ingest/run.ts
git commit -m "feat: implement ingest pipeline runner (discover, fetch, parse, chunk, index)"
```

- [ ] **Step 4: Run the full ingest pipeline**

Run: `GITHUB_TOKEN=${GITHUB_TOKEN} npm run ingest`
Expected: Pipeline completes, `data/` directory contains `raw-pages.json`, `pages.json`, `chunks.json`, `search-index.json`, `metadata.json`.

- [ ] **Step 5: Verify output**

Run: `ls -la data/ && npx tsx -e "import p from './data/pages.json' with { type: 'json' }; import c from './data/chunks.json' with { type: 'json' }; console.log('Pages:', p.length, 'Chunks:', c.length)"`
Expected: ~130 pages, ~500 chunks.

- [ ] **Step 6: Commit data directory note (not the data itself)**

Data is gitignored. No commit needed for output. Move to server implementation.

---

## Chunk 5: MCP Server — Loader & Tools

### Task 9: Implement data loader

**Files:**
- Create: `src/server/loader.ts`

- [ ] **Step 1: Implement `loader.ts`**

Create `src/server/loader.ts`:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deserializeIndex } from "../ingest/index.js";
import type { Page, Chunk, IngestMetadata } from "../types.js";
import type MiniSearch from "minisearch";

const DATA_DIR = join(process.cwd(), "data");

export interface LoadedData {
  pages: Page[];
  chunks: Chunk[];
  metadata: IngestMetadata;
  index: MiniSearch;
  // Lookup maps
  pageById: Map<string, Page>;
  chunkById: Map<string, Chunk>;
  chunksByPageId: Map<string, Chunk[]>;
}

export function loadData(): LoadedData {
  const pages: Page[] = JSON.parse(
    readFileSync(join(DATA_DIR, "pages.json"), "utf-8"),
  );
  const chunks: Chunk[] = JSON.parse(
    readFileSync(join(DATA_DIR, "chunks.json"), "utf-8"),
  );
  const metadata: IngestMetadata = JSON.parse(
    readFileSync(join(DATA_DIR, "metadata.json"), "utf-8"),
  );
  const indexJson = readFileSync(join(DATA_DIR, "search-index.json"), "utf-8");
  const index = deserializeIndex(indexJson);

  // Build lookup maps
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) || [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  return { pages, chunks, metadata, index, pageById, chunkById, chunksByPageId };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/loader.ts
git commit -m "feat: implement data loader with lookup maps"
```

---

### Task 10: Implement MCP tools

**Files:**
- Create: `src/server/tools/search-docs.ts`
- Create: `src/server/tools/get-section.ts`
- Create: `src/server/tools/get-page.ts`
- Create: `src/server/tools/list-components.ts`
- Create: `src/server/tools/list-sources.ts`
- Test: `tests/tools.test.ts`

- [ ] **Step 1: Write tool tests with mock data**

Create `tests/tools.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import type { Page, Chunk, IngestMetadata } from "../src/types.js";
import type { LoadedData } from "../src/server/loader.js";
import { buildIndex } from "../src/ingest/index.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleGetSection } from "../src/server/tools/get-section.js";
import { handleGetPage } from "../src/server/tools/get-page.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
import { handleListSources } from "../src/server/tools/list-sources.js";

function buildMockData(): LoadedData {
  const chunks: Chunk[] = [
    {
      id: "guide:Button:appearance",
      page_id: "guide:Button",
      url: "https://gravity-ui.com/design/guides?articleId=button",
      page_title: "Button",
      page_type: "guide",
      section_title: "Appearance",
      breadcrumbs: ["Design", "Guides", "Button"],
      content: "Buttons come in five types: accent, primary, semantic, raised, and contrasting.",
      code_examples: ['<Button view="action">Click</Button>'],
      keywords: ["Button", "appearance"],
    },
    {
      id: "guide:Button:sizes",
      page_id: "guide:Button",
      url: "https://gravity-ui.com/design/guides?articleId=button",
      page_title: "Button",
      page_type: "guide",
      section_title: "Sizes",
      breadcrumbs: ["Design", "Guides", "Button"],
      content: "Four sizes are available: XS, S, M (default), L, and XL.",
      code_examples: [],
      keywords: ["Button", "sizes"],
    },
    {
      id: "component:uikit:Select:usage",
      page_id: "component:uikit:Select",
      url: "https://gravity-ui.com/components/uikit/select",
      page_title: "Select",
      page_type: "component",
      library: "uikit",
      section_title: "Usage",
      breadcrumbs: ["Components", "uikit", "Select"],
      content: "Use the Select component for dropdown selection in forms.",
      code_examples: ['<Select options={items} />'],
      keywords: ["Select", "uikit", "usage"],
    },
  ];

  const pages: Page[] = [
    {
      id: "guide:Button",
      title: "Button",
      page_type: "guide",
      url: "https://gravity-ui.com/design/guides?articleId=button",
      github_url: "https://github.com/gravity-ui/landing/blob/main/src/content/design/guides/content/en/Button.mdx",
      breadcrumbs: ["Design", "Guides", "Button"],
      description: "Action trigger with style variants",
      section_ids: ["guide:Button:appearance", "guide:Button:sizes"],
    },
    {
      id: "component:uikit:Select",
      title: "Select",
      page_type: "component",
      library: "uikit",
      url: "https://gravity-ui.com/components/uikit/select",
      github_url: "https://github.com/gravity-ui/uikit/tree/main/src/components/Select",
      breadcrumbs: ["Components", "uikit", "Select"],
      description: "Dropdown selection input",
      section_ids: ["component:uikit:Select:usage"],
    },
  ];

  const metadata: IngestMetadata = {
    indexed_at: "2026-03-12T10:00:00.000Z",
    source_commits: { landing: "abc123", uikit: "def456" },
  };

  const index = buildIndex(chunks);

  return {
    pages,
    chunks,
    metadata,
    index,
    pageById: new Map(pages.map((p) => [p.id, p])),
    chunkById: new Map(chunks.map((c) => [c.id, c])),
    chunksByPageId: new Map([
      ["guide:Button", [chunks[0], chunks[1]]],
      ["component:uikit:Select", [chunks[2]]],
    ]),
  };
}

describe("search_docs", () => {
  let data: LoadedData;
  beforeAll(() => { data = buildMockData(); });

  it("returns matching results for a query", () => {
    const result = handleSearchDocs(data, { query: "button sizes" });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].section_id).toBeDefined();
    expect(result.results[0].snippet).toBeDefined();
  });

  it("filters by page_type", () => {
    const result = handleSearchDocs(data, { query: "button", page_type: "component" });
    for (const r of result.results) {
      expect(r.page_type).toBe("component");
    }
  });

  it("filters by library", () => {
    const result = handleSearchDocs(data, { query: "select", library: "uikit" });
    for (const r of result.results) {
      expect(r.library).toBe("uikit");
    }
  });

  it("respects limit", () => {
    const result = handleSearchDocs(data, { query: "button", limit: 1 });
    expect(result.results).toHaveLength(1);
  });
});

describe("get_section", () => {
  let data: LoadedData;
  beforeAll(() => { data = buildMockData(); });

  it("returns full section by ID", () => {
    const result = handleGetSection(data, { section_id: "guide:Button:appearance" });
    expect(result.section_title).toBe("Appearance");
    expect(result.content).toContain("five types");
    expect(result.code_examples).toHaveLength(1);
  });

  it("includes related_sections from the same page", () => {
    const result = handleGetSection(data, { section_id: "guide:Button:appearance" });
    expect(result.related_sections).toHaveLength(1);
    expect(result.related_sections[0].section_id).toBe("guide:Button:sizes");
  });

  it("returns error for unknown ID", () => {
    const result = handleGetSection(data, { section_id: "guide:Fake:nothing" });
    expect(result.error).toBeDefined();
  });
});

describe("get_page", () => {
  let data: LoadedData;
  beforeAll(() => { data = buildMockData(); });

  it("returns page metadata with section summaries", () => {
    const result = handleGetPage(data, { page_id: "guide:Button" });
    expect(result.title).toBe("Button");
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].summary).toBeDefined();
    expect(result.sections[0].has_code).toBe(true);
    expect(result.sections[1].has_code).toBe(false);
  });

  it("returns error for unknown page", () => {
    const result = handleGetPage(data, { page_id: "guide:Fake" });
    expect(result.error).toBeDefined();
  });
});

describe("list_components", () => {
  let data: LoadedData;
  beforeAll(() => { data = buildMockData(); });

  it("lists components grouped by library", () => {
    const result = handleListComponents(data, {});
    expect(result.libraries.length).toBeGreaterThan(0);
    const uikit = result.libraries.find((l: any) => l.id === "uikit");
    expect(uikit).toBeDefined();
    expect(uikit.components[0].name).toBe("Select");
    expect(uikit.components[0].description).toBeDefined();
  });

  it("filters by library", () => {
    const result = handleListComponents(data, { library: "uikit" });
    expect(result.libraries).toHaveLength(1);
    expect(result.libraries[0].id).toBe("uikit");
  });
});

describe("list_sources", () => {
  let data: LoadedData;
  beforeAll(() => { data = buildMockData(); });

  it("returns index metadata", () => {
    const result = handleListSources(data);
    expect(result.indexed_at).toBeDefined();
    expect(result.source_commits).toBeDefined();
    expect(result.total_pages).toBe(2);
    expect(result.total_sections).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL — tool handler modules not found.

- [ ] **Step 3: Implement `search-docs.ts`**

Create `src/server/tools/search-docs.ts`:

```typescript
import type { LoadedData } from "../loader.js";
import { searchIndex } from "../../ingest/index.js";

interface SearchDocsInput {
  query: string;
  limit?: number;
  page_type?: string;
  library?: string;
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export function handleSearchDocs(data: LoadedData, input: SearchDocsInput) {
  const limit = Math.min(input.limit || 5, 10);
  const raw = searchIndex(data.index, input.query, 50); // Get extra for filtering

  const results = [];
  for (const r of raw) {
    if (results.length >= limit) break;
    const chunk = data.chunkById.get(r.id);
    if (!chunk) continue;

    // Pre-filters
    if (input.page_type && chunk.page_type !== input.page_type) continue;
    if (input.library && chunk.library !== input.library) continue;

    results.push({
      section_id: chunk.id,
      score: Math.round(r.score * 100) / 100,
      page_title: chunk.page_title,
      page_type: chunk.page_type,
      library: chunk.library,
      section_title: chunk.section_title,
      snippet: truncateAtWord(chunk.content, 200),
      url: chunk.url,
    });
  }

  return { results, total_matches: raw.length };
}
```

- [ ] **Step 4: Implement `get-section.ts`**

Create `src/server/tools/get-section.ts`:

```typescript
import type { LoadedData } from "../loader.js";

interface GetSectionInput {
  section_id: string;
}

export function handleGetSection(data: LoadedData, input: GetSectionInput) {
  const chunk = data.chunkById.get(input.section_id);
  if (!chunk) {
    return { error: "Section not found", section_id: input.section_id };
  }

  const page = data.pageById.get(chunk.page_id);
  const siblings = page
    ? page.section_ids
        .filter((id) => id !== chunk.id)
        .map((id) => {
          const s = data.chunkById.get(id);
          return s ? { section_id: s.id, title: s.section_title } : null;
        })
        .filter(Boolean)
    : [];

  return {
    section_id: chunk.id,
    page_title: chunk.page_title,
    page_type: chunk.page_type,
    library: chunk.library,
    section_title: chunk.section_title,
    breadcrumbs: chunk.breadcrumbs,
    content: chunk.content,
    code_examples: chunk.code_examples,
    related_sections: siblings,
    url: chunk.url,
  };
}
```

- [ ] **Step 5: Implement `get-page.ts`**

Create `src/server/tools/get-page.ts`:

```typescript
import type { LoadedData } from "../loader.js";

interface GetPageInput {
  page_id: string;
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export function handleGetPage(data: LoadedData, input: GetPageInput) {
  const page = data.pageById.get(input.page_id);
  if (!page) {
    return { error: "Page not found", page_id: input.page_id };
  }

  const chunks = data.chunksByPageId.get(page.id) || [];
  const sections = chunks.map((c) => ({
    section_id: c.id,
    title: c.section_title,
    summary: truncateAtWord(c.content, 150),
    has_code: c.code_examples.length > 0,
  }));

  return {
    page_id: page.id,
    title: page.title,
    page_type: page.page_type,
    library: page.library,
    url: page.url,
    breadcrumbs: page.breadcrumbs,
    description: page.description,
    github_url: page.github_url,
    sections,
  };
}
```

- [ ] **Step 6: Implement `list-components.ts`**

Create `src/server/tools/list-components.ts`:

```typescript
import type { LoadedData } from "../loader.js";

interface ListComponentsInput {
  library?: string;
}

export function handleListComponents(data: LoadedData, input: ListComponentsInput) {
  const componentPages = data.pages.filter((p) => p.page_type === "component");
  const guidePageIds = new Set(
    data.pages.filter((p) => p.page_type === "guide").map((p) => p.title),
  );

  // Group by library
  const grouped = new Map<string, typeof componentPages>();
  for (const page of componentPages) {
    if (input.library && page.library !== input.library) continue;
    const lib = page.library || "unknown";
    const list = grouped.get(lib) || [];
    list.push(page);
    grouped.set(lib, list);
  }

  const libraries = [...grouped.entries()]
    .map(([id, pages]) => ({
      id,
      title: id,
      components: pages
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((p) => ({
          name: p.title,
          page_id: p.id,
          description: p.description,
          has_design_guide: guidePageIds.has(p.title),
        })),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { libraries };
}
```

- [ ] **Step 7: Implement `list-sources.ts`**

Create `src/server/tools/list-sources.ts`:

```typescript
import type { LoadedData } from "../loader.js";

export function handleListSources(data: LoadedData) {
  const componentPages = data.pages.filter((p) => p.page_type === "component");
  const libCounts = new Map<string, number>();
  for (const p of componentPages) {
    const lib = p.library || "unknown";
    libCounts.set(lib, (libCounts.get(lib) || 0) + 1);
  }

  return {
    indexed_at: data.metadata.indexed_at,
    source_commits: data.metadata.source_commits,
    libraries: [...libCounts.entries()]
      .map(([id, count]) => ({
        id,
        title: id,
        component_count: count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    total_pages: data.pages.length,
    total_sections: data.chunks.length,
    page_counts: {
      guides: data.pages.filter((p) => p.page_type === "guide").length,
      components: componentPages.length,
      libraries: data.pages.filter((p) => p.page_type === "library").length,
    },
  };
}
```

- [ ] **Step 8: Run all tool tests**

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add src/server/tools/ src/server/loader.ts tests/tools.test.ts
git commit -m "feat: implement all 5 MCP tool handlers with tests"
```

---

## Chunk 6: MCP Server & Smoke Test

### Task 11: Implement MCP server

**Files:**
- Create: `src/server/server.ts`

- [ ] **Step 1: Implement `server.ts`**

Create `src/server/server.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadData } from "./loader.js";
import { handleSearchDocs } from "./tools/search-docs.js";
import { handleGetSection } from "./tools/get-section.js";
import { handleGetPage } from "./tools/get-page.js";
import { handleListComponents } from "./tools/list-components.js";
import { handleListSources } from "./tools/list-sources.js";

const data = loadData();
console.error(`Loaded ${data.pages.length} pages, ${data.chunks.length} chunks`);

const server = new McpServer({
  name: "gravityui-docs",
  version: "0.1.0",
});

server.tool(
  "search_docs",
  `Search Gravity UI documentation by keyword or question.
Returns ranked snippets with section IDs for drill-down.
Use this as the first step for any documentation question.
Call get_section afterward to retrieve full content.
Prefer specific terms over vague queries. Do not call more than 3 times per question.`,
  {
    query: z.string().describe("Search terms or natural language question"),
    limit: z.number().min(1).max(10).optional().describe("Max results (default 5, max 10)"),
    page_type: z.enum(["guide", "component", "library"]).optional().describe("Filter by content type"),
    library: z.string().optional().describe("Filter by library, e.g. 'uikit'. Guides excluded when set."),
  },
  async (input) => ({
    content: [{ type: "text" as const, text: JSON.stringify(handleSearchDocs(data, input), null, 2) }],
  }),
);

server.tool(
  "get_section",
  `Retrieve the full content of a documentation section by its ID.
Use this after search_docs to get complete text and code examples.
Do not call this without first searching — use the section_id from search results.`,
  {
    section_id: z.string().describe("Section ID from search results"),
  },
  async (input) => ({
    content: [{ type: "text" as const, text: JSON.stringify(handleGetSection(data, input), null, 2) }],
  }),
);

server.tool(
  "get_page",
  `Get the full structure of a documentation page — metadata and a table of contents with section summaries.
Use this when you need to understand what a component or guide covers before drilling into specific sections.
Do not use this for search — use search_docs instead.`,
  {
    page_id: z.string().describe("Page ID, e.g. 'guide:Button' or 'component:uikit:Button'"),
  },
  async (input) => ({
    content: [{ type: "text" as const, text: JSON.stringify(handleGetPage(data, input), null, 2) }],
  }),
);

server.tool(
  "list_components",
  `List all available components, optionally filtered by library.
Use this for discovery — to see what components exist before searching.
Returns names, short descriptions, and IDs only.`,
  {
    library: z.string().optional().describe("Filter by library name, omit for all"),
  },
  async (input) => ({
    content: [{ type: "text" as const, text: JSON.stringify(handleListComponents(data, input), null, 2) }],
  }),
);

server.tool(
  "list_sources",
  `Show what documentation is indexed: libraries, page counts, and freshness.
Call this once at the start of a session to understand available coverage.`,
  {},
  async () => ({
    content: [{ type: "text" as const, text: JSON.stringify(handleListSources(data), null, 2) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gravity UI Docs MCP server running on stdio");
}

main().catch((err) => {
  console.error("Server failed:", err);
  process.exit(1);
});
```

Note: `zod` is already in `package.json` dependencies from Task 1.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/server.ts
git commit -m "feat: implement MCP server with stdio transport and 5 tools"
```

---

### Task 12: Create smoke test script

**Files:**
- Create: `scripts/test-queries.ts`

- [ ] **Step 1: Implement smoke test**

Create `scripts/test-queries.ts`:

```typescript
import { loadData } from "../src/server/loader.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleGetSection } from "../src/server/tools/get-section.js";
import { handleGetPage } from "../src/server/tools/get-page.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
import { handleListSources } from "../src/server/tools/list-sources.js";

const data = loadData();

console.log("=== Smoke Test: Gravity UI Docs MCP ===\n");

// Test 1: search_docs
console.log("--- search_docs('button sizes') ---");
const search1 = handleSearchDocs(data, { query: "button sizes", limit: 3 });
console.log(JSON.stringify(search1, null, 2));

// Test 2: search_docs with filter
console.log("\n--- search_docs('select', page_type='component') ---");
const search2 = handleSearchDocs(data, { query: "select", page_type: "component", limit: 3 });
console.log(JSON.stringify(search2, null, 2));

// Test 3: get_section (use first result from search1)
if (search1.results.length > 0) {
  const sectionId = search1.results[0].section_id;
  console.log(`\n--- get_section('${sectionId}') ---`);
  const section = handleGetSection(data, { section_id: sectionId });
  console.log(JSON.stringify(section, null, 2));
}

// Test 4: get_page
console.log("\n--- get_page('guide:Button') ---");
const page = handleGetPage(data, { page_id: "guide:Button" });
console.log(JSON.stringify(page, null, 2));

// Test 5: list_components (uikit only)
console.log("\n--- list_components('uikit') ---");
const components = handleListComponents(data, { library: "uikit" });
console.log(`Found ${components.libraries[0]?.components.length || 0} uikit components`);
console.log(components.libraries[0]?.components.slice(0, 5).map(
  (c: any) => `  ${c.name}: ${c.description}`
).join("\n"));

// Test 6: list_sources
console.log("\n--- list_sources() ---");
const sources = handleListSources(data);
console.log(JSON.stringify(sources, null, 2));

console.log("\n=== Smoke Test Complete ===");
```

- [ ] **Step 2: Run smoke test**

Run: `npx tsx scripts/test-queries.ts`
Expected: All 6 queries produce meaningful results — search returns ranked snippets, section returns full content, page shows TOC, components lists names with descriptions, sources shows counts.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-queries.ts
git commit -m "feat: add smoke test script with example queries"
```

---

### Task 13: Run all tests and verify

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (discover, parse, chunk, index, tools).

- [ ] **Step 2: Verify MCP server starts**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | npx tsx src/server/server.ts 2>/dev/null | head -1`
Expected: JSON response with server capabilities.

- [ ] **Step 3: Final commit if any changes needed**

```bash
git add -A && git status
```

Only commit if there are changes.
