# gravityui-reference-mcp

An MCP (Model Context Protocol) server providing AI-optimized access to [Gravity UI](https://gravity-ui.com) documentation — a comprehensive UI component library ecosystem with 34 libraries. Pre-ingested data is included in the repo, so the server works offline with no setup beyond `npm install`.

## Tools

The server exposes 5 tools:

**list_components** — Browse available Gravity UI components grouped by category. Filter by library or category. Good for discovering what components exist.

- `library` (optional) — e.g. "uikit", "components"
- `category` (optional) — e.g. "layout", "forms", "actions", "feedback", "navigation", "overlays", "data-display", "typography", "utility"

**suggest_component** — Find the right component for a use case. Describe what you need in plain language. Uses multi-scoring: semantic tags (30%), full-text search (50%), ComponentDef fuzzy match (20%).

- `use_case` (required) — plain-language description of what you need
- `library` (optional)
- `limit` (optional) — 1-5, default 3

**get_component** — Complete API reference: import statement, TypeScript props interface, code example. Use when you know which component you need.

- `name` (required) — e.g. "Button", "Select"
- `library` (optional)
- `detail` (optional) — "compact" or "full"

**search_docs** — Full-text search for behavioral questions, guides, usage patterns. Use when you need to understand HOW something works.

- `query` (required)
- `limit` (optional) — 1-10
- `page_type` (optional) — "component", "guide", or "library"
- `library` (optional)

**get_design_tokens** — Design system values: spacing scale, breakpoints, component size heights, colors.

- `topic` (optional) — "spacing", "breakpoints", "sizes", or "colors"

## Setup

```bash
npm install
```

## Usage

### Local setup

1. **Clone and install**

   ```bash
   git clone https://github.com/antonskiter/gravityui-reference-mcp.git
   cd gravityui-reference-mcp
   npm install
   ```

2. **Verify the server starts**

   ```bash
   npm run serve
   ```

   You should see no errors — the server communicates over stdio and waits for MCP messages.
   Press `Ctrl+C` to stop it.

### With Claude Code

Register the server globally (available in all projects):

```bash
claude mcp add gravityui-docs -s user -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Or for a single project only:

```bash
claude mcp add gravityui-docs -- npx tsx /absolute/path/to/gravityui-reference-mcp/src/server/server.ts
```

Verify the connection:

```bash
claude mcp list
# gravityui-docs: ... - ✓ Connected
```

> **Important:** Use the absolute path to `src/server/server.ts`. The `claude mcp add` CLI does not support `cwd`, so relative paths won't work.

### With Cursor

Create or edit `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "gravityui-docs": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/gravityui-reference-mcp/src/server/server.ts"]
    }
  }
}
```

Then restart Cursor or reload the MCP servers from **Cursor Settings > MCP**. The server should appear with a green status indicator.

### Test it

Ask your AI assistant something like:

> I need a date range picker for a booking form

It should use `suggest_component` to find the right component, then `get_component` to get the import and props.

### Standalone (stdio)

```bash
npm run serve
```

The server communicates over stdio using the MCP protocol.

## Re-ingesting data

The project uses a 4-phase LLM-orchestrated ingestion pipeline. Before re-ingesting, update the vendor submodules:

```bash
npm run update-submodules
```

Then run the phases:

- **Phase 0 — Manifest building:** `npm run llm-ingest` — Builds manifest from vendor/ submodules, discovers components, groups into batches
- **Phase 1 — Per-library extraction:** LLM agents extract ComponentDef, pages, and content chunks for each library
- **Phase 2 — Synthesis:** LLM agent produces tags, tokens, overview, and category mappings
- **Phase 3 — Validation:** `npm run validate-data` — Validates all data with Zod schemas
- **Phase 4 — Search index:** `npm run build-search-index` — Builds the serialized MiniSearch index

## Gravity UI Libraries

All 34 libraries available at [gravity-ui.com/libraries](https://gravity-ui.com/libraries):

- UIKit — <https://gravity-ui.com/libraries/uikit>
- Components — <https://gravity-ui.com/libraries/components>
- Date Components — <https://gravity-ui.com/libraries/date-components>
- Navigation — <https://gravity-ui.com/libraries/navigation>
- Markdown Editor — <https://gravity-ui.com/libraries/markdown-editor>
- AIKit — <https://gravity-ui.com/libraries/aikit>
- Graph — <https://gravity-ui.com/libraries/graph>
- Icons — <https://gravity-ui.com/libraries/icons>
- Illustrations — <https://gravity-ui.com/libraries/illustrations>
- Dynamic Forms — <https://gravity-ui.com/libraries/dynamic-forms>
- Page Constructor — <https://gravity-ui.com/libraries/page-constructor>
- Blog Constructor — <https://gravity-ui.com/libraries/blog-constructor>
- ChartKit — <https://gravity-ui.com/libraries/chartkit>
- Charts — <https://gravity-ui.com/libraries/charts>
- Table — <https://gravity-ui.com/libraries/table>
- DashKit — <https://gravity-ui.com/libraries/dashkit>
- Yagr — <https://gravity-ui.com/libraries/yagr>
- Timeline — <https://gravity-ui.com/libraries/timeline>
- NodeKit — <https://gravity-ui.com/libraries/nodekit>
- ExpressKit — <https://gravity-ui.com/libraries/expresskit>
- App Layout — <https://gravity-ui.com/libraries/app-layout>
- Date Utils — <https://gravity-ui.com/libraries/date-utils>
- Axios Wrapper — <https://gravity-ui.com/libraries/axios-wrapper>
- Dialog Fields — <https://gravity-ui.com/libraries/dialog-fields>
- I18n — <https://gravity-ui.com/libraries/i18n>
- Data Source — <https://gravity-ui.com/libraries/data-source>
- Page Constructor Builder — <https://gravity-ui.com/libraries/page-constructor-builder>
- ESLint Config — <https://gravity-ui.com/libraries/eslint-config>
- TSconfig — <https://gravity-ui.com/libraries/tsconfig>
- Prettier Config — <https://gravity-ui.com/libraries/prettier-config>
- Stylelint Config — <https://gravity-ui.com/libraries/stylelint-config>
- Babel Preset — <https://gravity-ui.com/libraries/babel-preset>
- Browserslist Config — <https://gravity-ui.com/libraries/browserslist-config>
- Webpack i18n Plugin — <https://gravity-ui.com/libraries/webpack-i18n-assets-plugin>

## Scripts

- `npm run serve` — Start the MCP server (stdio)
- `npm run build` — Compile TypeScript
- `npm test` — Run tests (Vitest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test-queries` — Run example queries against the server
- `npm run update-submodules` — Update vendor git submodules
- `npm run build-search-index` — Rebuild the MiniSearch search index
- `npm run llm-ingest` — Run the LLM ingestion pipeline (Phase 0 manifest builder)
- `npm run validate-data` — Validate ingested data with Zod schemas

## License

This project is licensed under the [MIT License](LICENSE).

Documentation content included in the `data/` directory is sourced from [Gravity UI](https://github.com/gravity-ui) repositories and is copyright the Gravity UI contributors, licensed under MIT. See the individual repositories listed above for their license files.
